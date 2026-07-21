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
  /** Sentido de la línea (1 o 2) al que corresponde ese destino. */
  dir: number;
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
