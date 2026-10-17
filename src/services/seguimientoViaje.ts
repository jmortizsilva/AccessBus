import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Linea, Parada } from '../types';
import {
  calcularNivelAviso,
  localizarParadaMasCercana,
  NivelAviso,
  PuntoGPS,
} from '../utils/seguimientoParada';
import { viajeVigente } from '../utils/viaje';
import { asegurarPermisoNotificaciones, avisar } from './notificaciones';

/**
 * Orquesta el "viaje activo" del aviso de parada de bajada: guarda el estado en
 * AsyncStorage (la tarea en segundo plano, `tareaSeguimiento.ts`, corre fuera del
 * árbol de React y solo puede leer/escribir aquí, nunca el estado de un componente)
 * y arranca/para el tracking de ubicación en segundo plano de expo-location.
 */

export const TASK_SEGUIMIENTO = 'accessbus-seguimiento-parada';

const STORAGE_VIAJE = 'busmadrid.viaje.v1';

/** Sin avanzar de parada en este tiempo, se para el seguimiento (atasco, batería). */
const LIMITE_INACTIVIDAD_MS = 25 * 60 * 1000;
/** Tope absoluto de seguridad, por si algo deja el viaje "activo" indefinidamente. */
const LIMITE_DURACION_MS = 3 * 60 * 60 * 1000;

export type EstadoViaje = 'activo' | 'llegado' | 'timeout';

export interface ViajeActivo {
  lin: string;
  dir: 1 | 2;
  destinoNombre: string;
  /** Secuencia completa de la línea en ese sentido (con lat/lon y ordenSentido). */
  secuencia: Parada[];
  indiceOrigen: number;
  indiceDestino: number;
  indiceActual: number;
  nivelAvisado: NivelAviso | null;
  iniciadoEn: number;
  ultimaActividadEn: number;
  /** Cuándo dejó de estar activo; a partir de ahí se muestra un rato y se borra. */
  finalizadoEn?: number;
  estado: EstadoViaje;
}

export async function leerViajeActivo(): Promise<ViajeActivo | null> {
  const raw = await AsyncStorage.getItem(STORAGE_VIAJE);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ViajeActivo;
  } catch {
    return null;
  }
}

/** Como `leerViajeActivo`, pero borra el registro si terminó hace rato. */
export async function leerViajeVigente(ahora = Date.now()): Promise<ViajeActivo | null> {
  const viaje = await leerViajeActivo();
  if (viaje && !viajeVigente(viaje, ahora)) {
    await AsyncStorage.removeItem(STORAGE_VIAJE);
    return null;
  }
  return viaje;
}

async function guardarViaje(viaje: ViajeActivo): Promise<void> {
  await AsyncStorage.setItem(STORAGE_VIAJE, JSON.stringify(viaje));
}

async function pararTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASK_SEGUIMIENTO)) {
    await Location.stopLocationUpdatesAsync(TASK_SEGUIMIENTO);
  }
}

export interface IniciarViajeParams {
  linea: Linea;
  dir: 1 | 2;
  /** Secuencia completa de la línea en ese sentido, con `ordenSentido`. */
  secuencia: Parada[];
  origen: Parada;
  bajada: Parada;
}

/**
 * Arranca el seguimiento: valida que la parada de bajada va después de la de
 * subida en el recorrido real, pide los permisos (notificaciones, ubicación en
 * uso y, por último, en segundo plano) y arranca `Location.startLocationUpdatesAsync`.
 */
export async function iniciarViaje(
  params: IniciarViajeParams,
): Promise<{ ok: boolean; motivo?: string }> {
  const indiceOrigen = params.secuencia.findIndex((p) => p.stopCode === params.origen.stopCode);
  const indiceDestino = params.secuencia.findIndex((p) => p.stopCode === params.bajada.stopCode);
  if (indiceOrigen === -1 || indiceDestino === -1 || indiceOrigen >= indiceDestino) {
    return {
      ok: false,
      motivo: 'La parada de bajada no está después de la de subida en este recorrido.',
    };
  }

  if (!(await asegurarPermisoNotificaciones())) {
    return { ok: false, motivo: 'Sin permiso de notificaciones, no puedo avisarte.' };
  }

  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      return { ok: false, motivo: 'Sin permiso de ubicación, no puedo seguir tu trayecto.' };
    }
  }
  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      return {
        ok: false,
        motivo:
          'Necesito el permiso de ubicación "Siempre" para avisarte con la pantalla bloqueada.',
      };
    }
  }

  const ahora = Date.now();
  await guardarViaje({
    lin: params.linea.lin,
    dir: params.dir,
    destinoNombre: params.bajada.stopName,
    secuencia: params.secuencia,
    indiceOrigen,
    indiceDestino,
    indiceActual: indiceOrigen,
    nivelAvisado: null,
    iniciadoEn: ahora,
    ultimaActividadEn: ahora,
    estado: 'activo',
  });

  await pararTracking();
  await Location.startLocationUpdatesAsync(TASK_SEGUIMIENTO, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 30,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
  });

  return { ok: true };
}

/** Para el tracking pero conserva el registro (para que la UI muestre el motivo). */
export async function detenerViaje(motivo: Exclude<EstadoViaje, 'activo'>): Promise<void> {
  const viaje = await leerViajeActivo();
  if (viaje) {
    await guardarViaje({ ...viaje, estado: motivo, finalizadoEn: Date.now() });
  }
  await pararTracking();
}

/** Cancelación explícita del usuario: para el tracking y borra el registro. */
export async function cancelarViajeActivo(): Promise<void> {
  await pararTracking();
  await AsyncStorage.removeItem(STORAGE_VIAJE);
}

function tituloAviso(nivel: NivelAviso): string {
  switch (nivel) {
    case 'dos_paradas':
      return 'Quedan 2 paradas';
    case 'una_parada':
      return 'Queda 1 parada';
    case 'llegando':
      return 'Llegando a tu parada';
    case 'pasada':
      return 'Aviso de parada';
  }
}

function cuerpoAviso(nivel: NivelAviso, destino: string): string {
  switch (nivel) {
    case 'dos_paradas':
      return `Prepárate: quedan 2 paradas para ${destino}.`;
    case 'una_parada':
      return `Prepárate: queda 1 parada para ${destino}.`;
    case 'llegando':
      return `Estás llegando a ${destino}.`;
    case 'pasada':
      return destino;
  }
}

/**
 * Llamada desde la tarea en segundo plano (`tareaSeguimiento.ts`) con cada
 * ubicación nueva: localiza la parada más cercana hacia delante, decide si toca
 * avisar y para el seguimiento al llegar o si lleva demasiado tiempo sin avanzar.
 */
export async function procesarUbicacion(coords: PuntoGPS): Promise<void> {
  const viaje = await leerViajeActivo();
  if (!viaje || viaje.estado !== 'activo') {
    return;
  }

  const ahora = Date.now();
  const localizado = localizarParadaMasCercana(coords, viaje.secuencia, viaje.indiceActual);
  const avanzo = Boolean(localizado && localizado.indice > viaje.indiceActual);
  const indiceActual = avanzo ? localizado!.indice : viaje.indiceActual;
  const ultimaActividadEn = avanzo ? ahora : viaje.ultimaActividadEn;

  const nivel = calcularNivelAviso(indiceActual, viaje.indiceDestino);
  if (nivel && nivel !== 'pasada' && nivel !== viaje.nivelAvisado) {
    await avisar(tituloAviso(nivel), cuerpoAviso(nivel, viaje.destinoNombre));
  }
  if (nivel === 'llegando' || nivel === 'pasada') {
    await detenerViaje('llegado');
    return;
  }

  if (
    ahora - ultimaActividadEn > LIMITE_INACTIVIDAD_MS ||
    ahora - viaje.iniciadoEn > LIMITE_DURACION_MS
  ) {
    await avisar(
      'Seguimiento detenido',
      'Llevas mucho tiempo sin avanzar; he detenido el seguimiento de tu viaje.',
    );
    await detenerViaje('timeout');
    return;
  }

  await guardarViaje({
    ...viaje,
    indiceActual,
    ultimaActividadEn,
    nivelAvisado: nivel ?? viaje.nivelAvisado,
  });
}
