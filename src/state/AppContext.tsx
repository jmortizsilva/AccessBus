import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, AppState } from 'react-native';
import { DiaServicio, getAvisosLinea, getDiaServicio, getLineas, getStopsAround, NearbyResult } from '../services/emt';
import { asegurarPermisoNotificaciones, avisar } from '../services/notificaciones';
import { Linea, Parada } from '../types';

const STORAGE_FAVORITES = 'busmadrid.favorites.v1';
const STORAGE_LINEAS = 'busmadrid.lineas.v1';
const STORAGE_LINEAS_TS = 'busmadrid.lineas.ts.v1';
const STORAGE_LOCATION = 'busmadrid.location.v1';
const STORAGE_RADIUS = 'busmadrid.radius.v1';
const STORAGE_FAV_LINEAS = 'busmadrid.favlineas.v1';
const STORAGE_AVISOS_VISTOS = 'busmadrid.avisosvistos.v1';
const STORAGE_NOTIF = 'busmadrid.notificaciones.v1';
const STORAGE_UMBRAL = 'busmadrid.umbral.v1';

const STATIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RADIUS_OPTIONS = [300, 500, 1000, 1500, 2000, 3000];
export const DEFAULT_RADIUS = 500;

/** Minutos de antelación para avisar de que el autobús está llegando. */
export const UMBRAL_OPTIONS = [2, 3, 5, 10];
export const DEFAULT_UMBRAL = 3;

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
  /** Líneas que el usuario sigue, para recibir avisos de incidencias. */
  favoriteLineas: string[];
  isFavoriteLinea: (lin: string) => boolean;
  toggleFavoriteLinea: (lin: string) => Promise<void>;
  notificacionesActivas: boolean;
  setNotificacionesActivas: (activas: boolean) => Promise<void>;
  umbralMin: number;
  setUmbralMin: (min: number) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [favorites, setFavorites] = useState<Parada[]>([]);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | undefined>(undefined);
  const [diaServicio, setDiaServicio] = useState<DiaServicio | undefined>(undefined);
  const [searchRadiusM, setSearchRadiusState] = useState<number>(DEFAULT_RADIUS);
  const [nearby, setNearby] = useState<NearbyStop[]>([]);
  const [favoriteLineas, setFavoriteLineas] = useState<string[]>([]);
  const [notificacionesActivas, setNotifState] = useState(false);
  const [umbralMin, setUmbralState] = useState<number>(DEFAULT_UMBRAL);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [message, setMessage] = useState('');

  const lineasRef = useRef<Linea[]>([]);
  lineasRef.current = lineas;

  // Carga inicial desde caché.
  useEffect(() => {
    const load = async () => {
      const [favRaw, lineasRaw, locRaw, radiusRaw, favLinRaw, notifRaw, umbralRaw] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_FAVORITES),
          AsyncStorage.getItem(STORAGE_LINEAS),
          AsyncStorage.getItem(STORAGE_LOCATION),
          AsyncStorage.getItem(STORAGE_RADIUS),
          AsyncStorage.getItem(STORAGE_FAV_LINEAS),
          AsyncStorage.getItem(STORAGE_NOTIF),
          AsyncStorage.getItem(STORAGE_UMBRAL),
        ]);
      parseInto(favRaw, setFavorites);
      parseInto(lineasRaw, setLineas);
      parseInto(favLinRaw, setFavoriteLineas);
      setNotifState(notifRaw === 'true');
      const umbral = Number(umbralRaw);
      if (Number.isFinite(umbral) && umbral > 0) {
        setUmbralState(umbral);
      }
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

  const isFavoriteLinea = useCallback(
    (lin: string) => favoriteLineas.includes(lin),
    [favoriteLineas]
  );

  const toggleFavoriteLinea = useCallback(
    async (lin: string) => {
      const sigue = favoriteLineas.includes(lin);
      const next = sigue ? favoriteLineas.filter((l) => l !== lin) : [...favoriteLineas, lin];
      setFavoriteLineas(next);
      await AsyncStorage.setItem(STORAGE_FAV_LINEAS, JSON.stringify(next));
      setMessage(sigue ? `Ya no sigues la línea ${lin}.` : `Siguiendo la línea ${lin}.`);
    },
    [favoriteLineas]
  );

  const setNotificacionesActivas = useCallback(async (activas: boolean) => {
    if (activas) {
      const ok = await asegurarPermisoNotificaciones();
      if (!ok) {
        setMessage('No se han concedido los permisos de notificaciones.');
        return;
      }
    }
    setNotifState(activas);
    await AsyncStorage.setItem(STORAGE_NOTIF, String(activas));
  }, []);

  const setUmbralMin = useCallback(async (min: number) => {
    setUmbralState(min);
    await AsyncStorage.setItem(STORAGE_UMBRAL, String(min));
  }, []);

  /**
   * Comprueba las incidencias de las líneas seguidas y notifica solo las nuevas.
   * La primera vez marca las existentes como vistas sin avisar, para no soltar
   * una ráfaga de notificaciones al activar la función.
   */
  const comprobarAvisosLineas = useCallback(async () => {
    if (!notificacionesActivas || favoriteLineas.length === 0) {
      return;
    }
    if (!(await asegurarPermisoNotificaciones())) {
      return;
    }
    const raw = await AsyncStorage.getItem(STORAGE_AVISOS_VISTOS);
    const primeraVez = raw === null;
    const vistos = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);

    for (const lin of favoriteLineas) {
      try {
        const avisos = await getAvisosLinea(lin);
        for (const a of avisos) {
          const id = a.guid ?? `${lin}:${a.titulo}`;
          if (vistos.has(id)) {
            continue;
          }
          vistos.add(id);
          if (!primeraVez) {
            await avisar(`Aviso en la línea ${lin}`, a.titulo);
          }
        }
      } catch {
        // una línea que falle no debe impedir las demás
      }
    }
    // Conservamos solo los últimos ids para que no crezca sin control.
    await AsyncStorage.setItem(STORAGE_AVISOS_VISTOS, JSON.stringify([...vistos].slice(-300)));
  }, [notificacionesActivas, favoriteLineas]);

  // Comprueba al arrancar y cada vez que la app vuelve a primer plano.
  useEffect(() => {
    void comprobarAvisosLineas();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        void comprobarAvisosLineas();
      }
    });
    return () => sub.remove();
  }, [comprobarAvisosLineas]);

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
      favoriteLineas,
      isFavoriteLinea,
      toggleFavoriteLinea,
      notificacionesActivas,
      setNotificacionesActivas,
      umbralMin,
      setUmbralMin,
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
      favoriteLineas,
      isFavoriteLinea,
      toggleFavoriteLinea,
      notificacionesActivas,
      setNotificacionesActivas,
      umbralMin,
      setUmbralMin,
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
