import { AccessibilityInfo } from 'react-native';
import { getTiempos } from '../services/emt';
import { Parada } from '../types';
import { spokenTiempo } from './tiempos';

/**
 * Núcleo de una etiqueta de línea para comparar.
 *
 * OJO: no se quitan los ceros a la izquierda porque son significativos: "001" y
 * "1" son líneas distintas en la EMT (igual que "002" y "2").
 */
export function lineaCore(label: string): string {
  return String(label ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

/** Nombre legible de una línea (p.ej. "5" -> "Línea 5"). */
export function prettyLinea(core: string): string {
  return `Línea ${core}`;
}

/** Las líneas nocturnas ("Búho") de la EMT se etiquetan N1, N2... N27. */
export function esLineaNocturna(lin: string): boolean {
  return /^N\d/.test(lin);
}

/** Lista de líneas que pasan por una parada, deduplicadas y limitadas. */
export function parseLineasPaso(lineasPaso: string | undefined, max = 12): string[] {
  if (!lineasPaso) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of lineasPaso.split(',')) {
    const core = lineaCore(raw);
    if (!core || seen.has(core)) {
      continue;
    }
    seen.add(core);
    result.push(core);
    if (result.length >= max) {
      break;
    }
  }
  return result;
}

/**
 * Consulta la API en el momento y anuncia por VoiceOver el tiempo de paso de una
 * línea concreta en una parada. Es lo que dispara cada acción de rotor por línea.
 */
export async function announceTiempoLinea(parada: Parada, core: string): Promise<void> {
  const nombre = prettyLinea(core);
  AccessibilityInfo.announceForAccessibility(`Consultando ${nombre} en ${parada.stopName}`);
  try {
    const times = await getTiempos(parada.stopCode);
    const match = times.filter((t) => lineaCore(t.linea) === core);
    if (match.length === 0) {
      AccessibilityInfo.announceForAccessibility(`${nombre}: sin paso próximo ahora mismo`);
      return;
    }
    AccessibilityInfo.announceForAccessibility(match.map(spokenTiempo).join('. '));
  } catch {
    AccessibilityInfo.announceForAccessibility(`No se pudo consultar ${nombre}`);
  }
}
