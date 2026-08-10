import red from './red.json';
import { Parada } from '../types';
import { normalizeText } from '../utils/text';
import { haversineMeters } from '../utils/distance';

/**
 * Índice de correspondencias de toda la red, precalculado con
 * `node scripts/build-red.mjs` y empaquetado con la app (~105 KB).
 *
 * Permite saber, para cualquier parada, qué líneas pasan y **hacia dónde van**,
 * sin gastar ninguna petición en tiempo de ejecución. La API no da ese dato en
 * el listado de paradas de una línea: solo se puede deducir recorriendo cada
 * línea y sentido, que es justo lo que hace el script.
 */
export interface Enlace {
  /** Etiqueta pública de la línea (p.ej. "116", "E1", "001"). */
  lin: string;
  /** Sentido de la línea (1 o 2) al que corresponde ese destino. */
  dir: number;
  /** Última parada de ese sentido (p.ej. "Embajadores"). */
  destino: string;
}

const rutas: Enlace[] = red.rutas;
const paradas: Record<string, number[]> = red.paradas;

/** Cada parada del directorio: [código, nombre, lat, lon]. */
type ParadaDir = [string, string, number, number];
const directorio: ParadaDir[] = (red.directorio ?? []) as ParadaDir[];

// Índice con el nombre normalizado, precalculado una vez, para poder buscar
// por nombre en cada tecla sin recalcular acentos ni mayúsculas.
const directorioNorm = directorio.map(([code, nombre, lat, lon]) => ({
  code,
  nombre,
  lat,
  lon,
  norm: normalizeText(nombre),
}));
const porCodigo = new Map(directorioNorm.map((d) => [d.code, d]));

/** Etiquetas de líneas que pasan por una parada, según el índice ("5, 14, 27"). */
function lineasPasoDeParada(stopCode: string): string | undefined {
  const vistas = new Set<string>();
  for (const e of lineasDeParada(stopCode)) {
    vistas.add(e.lin);
  }
  return vistas.size > 0 ? [...vistas].join(', ') : undefined;
}

/** Datos de una parada (nombre, coordenadas, líneas) desde el índice local. */
export function paradaDelIndice(stopCode: string): Parada | undefined {
  const d = porCodigo.get(String(stopCode));
  if (!d) {
    return undefined;
  }
  return {
    stopCode: d.code,
    stopName: d.nombre,
    lat: d.lat,
    lon: d.lon,
    lineasPaso: lineasPasoDeParada(d.code),
  };
}

/**
 * Busca paradas por nombre en el índice local (offline, instantáneo).
 *
 * La API de EMT no tiene búsqueda por nombre —solo por cercanía a una calle, que
 * devuelve paradas de calles vecinas y se deja fuera las de la misma calle que
 * quedan lejos del punto geolocalizado—. El directorio precalculado resuelve esto
 * sin gastar ninguna petición. Cada palabra del texto debe aparecer en el nombre,
 * y se priorizan los nombres que empiezan por lo escrito.
 */
export function buscarParadas(texto: string, limite = 40): Parada[] {
  const q = normalizeText(texto);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }
  const encontradas = directorioNorm.filter((d) => tokens.every((t) => d.norm.includes(t)));
  encontradas.sort((a, b) => {
    const aEmpieza = a.norm.startsWith(q) ? 0 : 1;
    const bEmpieza = b.norm.startsWith(q) ? 0 : 1;
    if (aEmpieza !== bEmpieza) {
      return aEmpieza - bEmpieza;
    }
    if (a.norm.length !== b.norm.length) {
      return a.norm.length - b.norm.length;
    }
    return a.norm.localeCompare(b.norm);
  });
  return encontradas.slice(0, limite).map((d) => ({
    stopCode: d.code,
    stopName: d.nombre,
    lat: d.lat,
    lon: d.lon,
    lineasPaso: lineasPasoDeParada(d.code),
  }));
}

export interface CandidatoParada {
  parada: Parada;
  metros: number;
}

/**
 * Paradas dentro de un radio de una coordenada, en orden de distancia,
 * calculado sobre el directorio offline (sin llamadas API). Es el punto de
 * partida del planificador de rutas: sirve tanto para el origen como para el
 * destino, dado que ambos pueden ser una dirección geocodificada.
 */
export function paradasCercanas(
  lat: number,
  lon: number,
  radioMaxM: number,
  limite = 6,
): CandidatoParada[] {
  return directorioNorm
    .map((d) => ({ d, metros: haversineMeters(lat, lon, d.lat, d.lon) }))
    .filter(({ metros }) => metros <= radioMaxM)
    .sort((a, b) => a.metros - b.metros)
    .slice(0, limite)
    .map(({ d, metros }) => ({ parada: paradaDelIndice(d.code)!, metros }));
}

/** Fecha en que se generó el índice (para saber si conviene regenerarlo). */
export const redGenerada: string = red.generado;

/** Líneas que pasan por una parada, con su destino. */
export function lineasDeParada(stopCode: string): Enlace[] {
  return (paradas[String(stopCode)] ?? []).map((i) => rutas[i]).filter(Boolean);
}

/**
 * Correspondencias de una parada: las líneas que pasan salvo la que se excluya
 * (normalmente, la línea que se está consultando).
 */
export function enlacesDeParada(stopCode: string, excluirLinea?: string): Enlace[] {
  return lineasDeParada(stopCode).filter((e) => !excluirLinea || e.lin !== excluirLinea);
}

/**
 * Sentido (1 o 2) en el que una línea pasa por una parada. Sirve para abrir
 * directamente el recorrido correcto al pulsar un tiempo de llegada, sin tener
 * que adivinarlo comparando el nombre del destino (que no siempre coincide:
 * la API dice "VIRGEN CORTIJO" y la parada final se llama "Virgen del Cortijo").
 */
export function sentidoDeLinea(stopCode: string, lin: string): 1 | 2 | undefined {
  const coincidencias = lineasDeParada(stopCode).filter((e) => e.lin === lin);
  if (coincidencias.length !== 1) {
    // Si la línea pasa en ambos sentidos por la misma parada no hay una
    // respuesta única; que decida la pantalla (empieza por el sentido 1).
    return undefined;
  }
  return coincidencias[0].dir === 2 ? 2 : 1;
}
