import type { ViajeActivo } from '../services/seguimientoViaje';
import { Parada } from '../types';

/**
 * Lo que se enseña del viaje del aviso de bajada: si sigue mereciendo la pena
 * mostrarlo, el resumen y el tramo de paradas con su estado.
 */

/** Tiempo que se sigue mostrando un viaje ya terminado (llegada o parada por inactividad). */
export const MARGEN_TRAS_FIN_MS = 10 * 60 * 1000;

/**
 * Si el viaje se sigue mostrando. Los registros guardados antes de existir
 * `finalizadoEn` usan la última actividad: llevan ahí desde entonces.
 */
export function viajeVigente(viaje: ViajeActivo, ahora: number): boolean {
  if (viaje.estado === 'activo') {
    return true;
  }
  const fin = viaje.finalizadoEn ?? viaje.ultimaActividadEn;
  return ahora - fin < MARGEN_TRAS_FIN_MS;
}

export function textoRestantes(restantes: number): string {
  return restantes === 1 ? 'Queda 1 parada' : `Quedan ${restantes} paradas`;
}

export function resumenViaje(viaje: ViajeActivo): string {
  switch (viaje.estado) {
    case 'activo': {
      const restantes = Math.max(0, viaje.indiceDestino - viaje.indiceActual);
      return `Línea ${viaje.lin}, bajas en ${viaje.destinoNombre}. ${textoRestantes(restantes)}.`;
    }
    case 'llegado':
      return `Línea ${viaje.lin}. Has llegado a ${viaje.destinoNombre}.`;
    case 'timeout':
      return `Línea ${viaje.lin}. Seguimiento detenido: llevabas mucho tiempo sin avanzar hacia ${viaje.destinoNombre}.`;
  }
}

export type EstadoParadaViaje = 'pasada' | 'actual' | 'pendiente';

export interface ParadaTramo {
  parada: Parada;
  estado: EstadoParadaViaje;
  esBajada: boolean;
  texto: string;
}

/** Paradas de la subida a la bajada, cada una con su estado respecto a la posición. */
export function tramoViaje(viaje: ViajeActivo): ParadaTramo[] {
  // Al llegar, la tarea para el seguimiento sin guardar el último índice: el
  // registro se queda con la parada anterior a la de bajada.
  const actual = viaje.estado === 'llegado' ? viaje.indiceDestino : viaje.indiceActual;
  return viaje.secuencia.slice(viaje.indiceOrigen, viaje.indiceDestino + 1).map((parada, i) => {
    const indice = viaje.indiceOrigen + i;
    const estado: EstadoParadaViaje =
      indice < actual ? 'pasada' : indice === actual ? 'actual' : 'pendiente';
    const esBajada = indice === viaje.indiceDestino;
    const partes = [
      estado === 'pasada' ? 'Pasada' : estado === 'actual' ? 'Ahora' : undefined,
      esBajada ? 'bajas aquí' : undefined,
      parada.stopName,
    ].filter(Boolean);
    const texto = partes.join(', ');
    return { parada, estado, esBajada, texto: texto[0].toUpperCase() + texto.slice(1) };
  });
}
