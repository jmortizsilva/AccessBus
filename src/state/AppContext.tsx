import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { DiaServicio, getDiaServicio, getLineas, getStopsAround, NearbyResult } from '../services/emt';
import { Linea, Parada } from '../types';

const STORAGE_FAVORITES = 'busmadrid.favorites.v1';
const STORAGE_LINEAS = 'busmadrid.lineas.v1';
const STORAGE_LINEAS_TS = 'busmadrid.lineas.ts.v1';
const STORAGE_LOCATION = 'busmadrid.location.v1';
const STORAGE_RADIUS = 'busmadrid.radius.v1';

const STATIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RADIUS_OPTIONS = [300, 500, 1000, 1500, 2000, 3000];
export const DEFAULT_RADIUS = 500;

export interface CurrentLocation {
  lat: number;
  lon: number;
  name?: string;
}

export type NearbyStop = NearbyResult;

interface AppContextValue {
  lineas: Linea[];
  favorites: Parada[];
  currentLocation: CurrentLocation | undefined;
  diaServicio: DiaServicio | undefined;
  searchRadiusM: number;
  nearby: NearbyStop[];
  loadingLineas: boolean;
  loadingNearby: boolean;
  loadingLocation: boolean;
  message: string;
  refreshLineas: (force?: boolean) => Promise<void>;
  refreshLocation: (opts?: { silent?: boolean }) => Promise<void>;
  setSearchRadiusM: (meters: number) => Promise<void>;
  isFavorite: (stopCode: string) => boolean;
  addFavorite: (parada: Parada) => Promise<void>;
  removeFavorite: (stopCode: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [favorites, setFavorites] = useState<Parada[]>([]);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | undefined>(undefined);
  const [diaServicio, setDiaServicio] = useState<DiaServicio | undefined>(undefined);
  const [searchRadiusM, setSearchRadiusState] = useState<number>(DEFAULT_RADIUS);
  const [nearby, setNearby] = useState<NearbyStop[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [message, setMessage] = useState('');

  const lineasRef = useRef<Linea[]>([]);
  lineasRef.current = lineas;

  // Carga inicial desde caché.
  useEffect(() => {
    const load = async () => {
      const [favRaw, lineasRaw, locRaw, radiusRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_FAVORITES),
        AsyncStorage.getItem(STORAGE_LINEAS),
        AsyncStorage.getItem(STORAGE_LOCATION),
        AsyncStorage.getItem(STORAGE_RADIUS),
      ]);
      parseInto(favRaw, setFavorites);
      parseInto(lineasRaw, setLineas);
      if (locRaw) {
        try {
          const parsed = JSON.parse(locRaw) as CurrentLocation;
          if (parsed?.lat !== undefined && parsed?.lon !== undefined) {
            setCurrentLocation(parsed);
          }
        } catch {
          // ignora caché corrupta
        }
      }
      const radius = Number(radiusRaw);
      if (Number.isFinite(radius) && radius > 0) {
        setSearchRadiusState(radius);
      }
      void refreshLineas(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (message.trim()) {
      void AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);

  // Tipo de día de servicio (laborable/sábado/festivo) y aviso de huelga.
  useEffect(() => {
    let active = true;
    getDiaServicio()
      .then((dia) => active && dia && setDiaServicio(dia))
      .catch(() => {
        // no crítico
      });
    return () => {
      active = false;
    };
  }, []);

  // Paradas cercanas: se recalculan (llamada a la API) al cambiar ubicación o radio.
  useEffect(() => {
    if (!currentLocation) {
      setNearby([]);
      return;
    }
    let active = true;
    setLoadingNearby(true);
    getStopsAround(currentLocation.lat, currentLocation.lon, searchRadiusM)
      .then((r) => active && setNearby(r))
      .catch((error) => {
        if (active) {
          setMessage(`No se pudieron cargar las paradas cercanas: ${errText(error)}`);
        }
      })
      .finally(() => active && setLoadingNearby(false));
    return () => {
      active = false;
    };
  }, [currentLocation, searchRadiusM]);

  const refreshLineas = useCallback(async (force = false) => {
    if (!force) {
      const ts = Number((await AsyncStorage.getItem(STORAGE_LINEAS_TS)) ?? 0);
      if (lineasRef.current.length > 0 && Date.now() - ts < STATIC_TTL_MS) {
        return;
      }
    }
    setLoadingLineas(true);
    try {
      const data = await getLineas();
      if (data.length > 0) {
        setLineas(data);
        await Promise.all([
          AsyncStorage.setItem(STORAGE_LINEAS, JSON.stringify(data)),
          AsyncStorage.setItem(STORAGE_LINEAS_TS, String(Date.now())),
        ]);
      }
    } catch (error) {
      if (lineasRef.current.length === 0) {
        setMessage(`No se pudieron cargar las líneas: ${errText(error)}`);
      }
    } finally {
      setLoadingLineas(false);
    }
  }, []);

  const refreshLocation = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (silent) {
          return;
        }
        permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(
            'Permiso denegado',
            'Necesito permiso de ubicación para mostrarte las paradas más cercanas.'
          );
          return;
        }
      }
      if (!silent) {
        setLoadingLocation(true);
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let name: string | undefined;
      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        name = geocoded[0]?.street ?? geocoded[0]?.city ?? undefined;
      } catch {
        // opcional
      }
      const loc: CurrentLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name,
      };
      setCurrentLocation(loc);
      await AsyncStorage.setItem(STORAGE_LOCATION, JSON.stringify(loc));
      if (!silent) {
        setMessage('Ubicación actualizada. Mostrando paradas cercanas.');
      }
    } catch (error) {
      if (!silent) {
        setMessage(`Error con la ubicación: ${errText(error)}`);
      }
    } finally {
      if (!silent) {
        setLoadingLocation(false);
      }
    }
  }, []);

  const setSearchRadiusM = useCallback(async (meters: number) => {
    setSearchRadiusState(meters);
    await AsyncStorage.setItem(STORAGE_RADIUS, String(meters));
  }, []);

  const persistFavorites = useCallback(async (next: Parada[]) => {
    setFavorites(next);
    await AsyncStorage.setItem(STORAGE_FAVORITES, JSON.stringify(next));
  }, []);

  const isFavorite = useCallback(
    (stopCode: string) => favorites.some((f) => f.stopCode === stopCode),
    [favorites]
  );

  const addFavorite = useCallback(
    async (parada: Parada) => {
      if (favorites.some((f) => f.stopCode === parada.stopCode)) {
        return;
      }
      await persistFavorites([...favorites, parada]);
      setMessage(`${parada.stopName} añadida a favoritos.`);
    },
    [favorites, persistFavorites]
  );

  const removeFavorite = useCallback(
    async (stopCode: string) => {
      const removed = favorites.find((f) => f.stopCode === stopCode);
      await persistFavorites(favorites.filter((f) => f.stopCode !== stopCode));
      if (removed) {
        setMessage(`${removed.stopName} quitada de favoritos.`);
      }
    },
    [favorites, persistFavorites]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      lineas,
      favorites,
      currentLocation,
      diaServicio,
      searchRadiusM,
      nearby,
      loadingLineas,
      loadingNearby,
      loadingLocation,
      message,
      refreshLineas,
      refreshLocation,
      setSearchRadiusM,
      isFavorite,
      addFavorite,
      removeFavorite,
    }),
    [
      lineas,
      favorites,
      currentLocation,
      diaServicio,
      searchRadiusM,
      nearby,
      loadingLineas,
      loadingNearby,
      loadingLocation,
      message,
      refreshLineas,
      refreshLocation,
      setSearchRadiusM,
      isFavorite,
      addFavorite,
      removeFavorite,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return context;
}

function parseInto<T>(raw: string | null, setter: (value: T) => void) {
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    if (parsed) {
      setter(parsed);
    }
  } catch {
    // ignora caché corrupta
  }
}

function errText(error: unknown): string {
  return String((error as Error)?.message ?? error);
}
