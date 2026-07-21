import red from './red.json';

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
  /** Última parada de ese sentido (p.ej. "Embajadores"). */
  destino: string;
}

const rutas: Enlace[] = red.rutas;
const paradas: Record<string, number[]> = red.paradas;

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
