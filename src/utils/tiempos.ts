import { Tiempo } from '../types';

/** Texto para VoiceOver de un tiempo de paso concreto. */
export function spokenTiempo(t: Tiempo): string {
  const cuando =
    t.minutos !== undefined
      ? t.minutos <= 0
        ? 'llegando'
        : `en ${t.minutos} ${t.minutos === 1 ? 'minuto' : 'minutos'}`
      : t.tiempoText;
  const destino = t.destino ? ` hacia ${t.destino}` : '';
  return `Línea ${t.linea}${destino}, ${cuando}${t.distanciaText ? `, a ${t.distanciaText}` : ''}`;
}

/** Resumen hablado de todos los tiempos de una parada. */
export function summarizeTiempos(times: Tiempo[]): string {
  if (times.length === 0) {
    return 'Sin próximos pasos ahora mismo';
  }
  return times.map(spokenTiempo).join('. ');
}
