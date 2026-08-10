import { haversineMeters } from './distance';
import { Parada } from '../types';

/**
 * Emparejamiento de la posición GPS del usuario con la secuencia de paradas
 * de la línea que lleva, para el aviso de "quedan N paradas para bajar".
 *
 * Decisión de diseño: vecino más cercano dentro de una ventana hacia delante
 * desde el último índice conocido (el recorrido de un bus nunca retrocede).
 * No se proyecta sobre el segmento entre paradas consecutivas: con paradas
 * urbanas cada 250-400 m el vecino más cercano ya es preciso de sobra, y esta
 * versión es mucho más simple de razonar y de testear que una proyección
 * geométrica (que además podría dar un resultado "detrás" por ruido de GPS).
 */

export interface PuntoGPS {
  lat: number;
  lon: number;
}

export interface EstadoSeguimiento {
  /** Índice en la secuencia de la parada más cercana encontrada. */
  indice: number;
  distanciaM: number;
}

/** Paradas a mirar por delante del índice mínimo antes de rendirse en esa lectura. */
const VENTANA_DEFECTO = 15;

/**
 * Busca la parada más cercana al punto dado, sin retroceder nunca del índice
 * mínimo conocido. Devuelve `undefined` si ninguna parada dentro de la
 * ventana tiene coordenadas o si la secuencia se ha agotado.
 */
export function localizarParadaMasCercana(
  punto: PuntoGPS,
  secuencia: Parada[],
  indiceMinimo: number,
  ventana: number = VENTANA_DEFECTO,
): EstadoSeguimiento | undefined {
  const fin = Math.min(secuencia.length, indiceMinimo + ventana);
  let mejor: EstadoSeguimiento | undefined;
  for (let i = Math.max(0, indiceMinimo); i < fin; i++) {
    const parada = secuencia[i];
    if (parada.lat === undefined || parada.lon === undefined) {
      continue;
    }
    const distanciaM = haversineMeters(punto.lat, punto.lon, parada.lat, parada.lon);
    if (!mejor || distanciaM < mejor.distanciaM) {
      mejor = { indice: i, distanciaM };
    }
  }
  return mejor;
}

export type NivelAviso = 'dos_paradas' | 'una_parada' | 'llegando' | 'pasada';

/**
 * Nivel de aviso según cuántas paradas quedan hasta la de bajada.
 * `undefined` cuando aún faltan más de 2 y no toca avisar todavía.
 */
export function calcularNivelAviso(
  indiceActual: number,
  indiceDestino: number,
): NivelAviso | undefined {
  const restantes = indiceDestino - indiceActual;
  if (restantes < 0) {
    return 'pasada';
  }
  if (restantes === 0) {
    return 'llegando';
  }
  if (restantes === 1) {
    return 'una_parada';
  }
  if (restantes === 2) {
    return 'dos_paradas';
  }
  return undefined;
}
