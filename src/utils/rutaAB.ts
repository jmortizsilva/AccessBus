import { CandidatoParada, Enlace, lineasDeParada } from '../data/red';
import { Parada } from '../types';
import { haversineMeters } from './distance';
import { esLineaNocturna } from './lineas';
import { compararLineas } from './ordenLineas';

/** Consulta de qué líneas pasan por una parada; inyectable para poder testear
 *  con datos fabricados a mano sin depender de la red real. */
type ObtenerEnlaces = (stopCode: string) => Enlace[];

/**
 * Planificador de rutas propio, solo con datos EMT: no hay ningún endpoint de
 * itinerarios en la API oficial, así que se buscan líneas directas y, si no
 * las hay, combinaciones con un único transbordo, usando el índice offline de
 * `red.ts` para no disparar decenas de llamadas por cada búsqueda.
 */

export interface TramoDirecto {
  tipo: 'directo';
  lin: string;
  /** Otras líneas que hacen exactamente el mismo tramo (misma subida y bajada). */
  lineasAlternativas?: string[];
  dir: 1 | 2;
  /** Cabecera final del recorrido, tal cual la da la API. */
  destino: string;
  origen: Parada;
  bajada: Parada;
  paradasEnBus: number;
  metrosOrigen: number;
  metrosDestino: number;
}

export interface TramoConTransbordo {
  tipo: 'transbordo';
  primero: {
    lin: string;
    lineasAlternativas?: string[];
    dir: 1 | 2;
    origen: Parada;
    bajada: Parada;
    paradasEnBus: number;
  };
  segundo: {
    lin: string;
    lineasAlternativas?: string[];
    dir: 1 | 2;
    subida: Parada;
    bajada: Parada;
    paradasEnBus: number;
  };
  metrosOrigen: number;
  /** Distancia a pie entre donde se baja de la primera línea y donde se sube a la segunda. */
  metrosTransbordo: number;
  metrosDestino: number;
}

export type OpcionRuta = TramoDirecto | TramoConTransbordo;

export interface CandidatoDirecto {
  lin: string;
  dir: 1 | 2;
  origen: CandidatoParada;
  destino: CandidatoParada;
}

/**
 * Cruza, sin llamadas API, qué líneas pasan a la vez por un candidato de
 * origen y uno de destino (según el índice offline `lineasDeParada`).
 * Coincidir en (lin, dir) no basta para saber que el origen va antes que el
 * destino en el recorrido; eso lo confirma después `validarTramoDirecto` con
 * la secuencia real de paradas.
 */
export function combinacionesDirectas(
  origenes: CandidatoParada[],
  destinos: CandidatoParada[],
  obtenerEnlaces: ObtenerEnlaces = lineasDeParada,
): CandidatoDirecto[] {
  const vistos = new Set<string>();
  const resultado: CandidatoDirecto[] = [];
  for (const o of origenes) {
    const clavesOrigen = new Set(obtenerEnlaces(o.parada.stopCode).map((e) => `${e.lin}:${e.dir}`));
    if (clavesOrigen.size === 0) {
      continue;
    }
    for (const d of destinos) {
      for (const e of obtenerEnlaces(d.parada.stopCode)) {
        const clave = `${e.lin}:${e.dir}`;
        if (!clavesOrigen.has(clave)) {
          continue;
        }
        const dedupeKey = `${clave}:${o.parada.stopCode}:${d.parada.stopCode}`;
        if (vistos.has(dedupeKey)) {
          continue;
        }
        vistos.add(dedupeKey);
        resultado.push({ lin: e.lin, dir: e.dir as 1 | 2, origen: o, destino: d });
      }
    }
  }
  return resultado;
}

/** Confirma con la secuencia real de la línea que el origen va antes que el destino. */
export function validarTramoDirecto(
  candidato: CandidatoDirecto,
  secuencia: Parada[],
): TramoDirecto | undefined {
  const iOrigen = secuencia.findIndex((p) => p.stopCode === candidato.origen.parada.stopCode);
  const iDestino = secuencia.findIndex((p) => p.stopCode === candidato.destino.parada.stopCode);
  if (iOrigen === -1 || iDestino === -1 || iOrigen >= iDestino) {
    return undefined;
  }
  return {
    tipo: 'directo',
    lin: candidato.lin,
    dir: candidato.dir,
    destino: secuencia[secuencia.length - 1]?.stopName ?? '',
    origen: candidato.origen.parada,
    bajada: candidato.destino.parada,
    paradasEnBus: iDestino - iOrigen,
    metrosOrigen: candidato.origen.metros,
    metrosDestino: candidato.destino.metros,
  };
}

export interface LineaCandidata {
  lin: string;
  dir: 1 | 2;
  parada: CandidatoParada;
}

/**
 * Líneas que pasan por alguno de los candidatos, quedándose con la parada más
 * cercana de cada (línea, sentido) y acotando el resultado a `tope` para no
 * disparar una llamada API por cada línea de la ciudad.
 */
export function lineasCandidatas(
  candidatos: CandidatoParada[],
  tope = 10,
  obtenerEnlaces: ObtenerEnlaces = lineasDeParada,
): LineaCandidata[] {
  const porClave = new Map<string, LineaCandidata>();
  for (const c of candidatos) {
    for (const e of obtenerEnlaces(c.parada.stopCode)) {
      const clave = `${e.lin}:${e.dir}`;
      const actual = porClave.get(clave);
      if (!actual || c.metros < actual.parada.metros) {
        porClave.set(clave, { lin: e.lin, dir: e.dir as 1 | 2, parada: c });
      }
    }
  }
  return [...porClave.values()].sort((a, b) => a.parada.metros - b.parada.metros).slice(0, tope);
}

/** Cuánto se está dispuesto a andar entre la parada de bajada y la de subida de un transbordo. */
export const UMBRAL_TRANSBORDO_M = 250;

export interface ParTransbordo {
  /** Parada donde se baja de la primera línea. */
  bajada: Parada;
  /** Parada donde se sube a la segunda línea. */
  subida: Parada;
  /** Distancia a pie entre ambas (0 si es literalmente la misma parada). */
  metros: number;
}

/**
 * Primer transbordo posible entre dos secuencias ya recortadas: `desdeOrigen`
 * debe empezar en la parada de subida (o después) y `hastaDestino` debe
 * terminar en la de bajada (o antes).
 *
 * NO exige la misma parada exacta: en Madrid casi ningún transbordo real es
 * así (dos líneas que se cruzan suelen tener paradas distintas a un puñado de
 * metros, a cada lado de la calle o del cruce). Se acepta cualquier pareja a
 * `UMBRAL_TRANSBORDO_M` o menos, priorizando el transbordo más temprano según
 * el orden de `desdeOrigen` y, dentro de esa parada, el más cercano a pie.
 */
export function buscarTransbordo(
  desdeOrigen: Parada[],
  hastaDestino: Parada[],
  umbralM: number = UMBRAL_TRANSBORDO_M,
): ParTransbordo | undefined {
  for (const bajada of desdeOrigen) {
    let mejor: ParTransbordo | undefined;
    for (const subida of hastaDestino) {
      // La coincidencia exacta no necesita coordenadas: es la mejor posible.
      if (bajada.stopCode === subida.stopCode) {
        return { bajada, subida, metros: 0 };
      }
      if (
        bajada.lat === undefined ||
        bajada.lon === undefined ||
        subida.lat === undefined ||
        subida.lon === undefined
      ) {
        continue;
      }
      const metros = haversineMeters(bajada.lat, bajada.lon, subida.lat, subida.lon);
      if (metros <= umbralM && (!mejor || metros < mejor.metros)) {
        mejor = { bajada, subida, metros };
      }
    }
    if (mejor) {
      return mejor;
    }
  }
  return undefined;
}

export interface CandidatoTransbordo {
  primero: { lin: string; dir: 1 | 2; origen: CandidatoParada };
  segundo: { lin: string; dir: 1 | 2; destino: CandidatoParada };
}

/**
 * Construye el tramo con transbordo a partir de las secuencias COMPLETAS (con
 * `ordenSentido`) de ambas líneas: recorta internamente desde el origen en la
 * primera línea y hasta el destino en la segunda, y busca el primer punto en
 * común entre ambos recortes.
 */
export function construirTramoConTransbordo(
  candidato: CandidatoTransbordo,
  secuenciaPrimero: Parada[],
  secuenciaSegundo: Parada[],
): TramoConTransbordo | undefined {
  const iOrigen = secuenciaPrimero.findIndex(
    (p) => p.stopCode === candidato.primero.origen.parada.stopCode,
  );
  const iDestino = secuenciaSegundo.findIndex(
    (p) => p.stopCode === candidato.segundo.destino.parada.stopCode,
  );
  if (iOrigen === -1 || iDestino === -1) {
    return undefined;
  }

  const tramoPrimero = secuenciaPrimero.slice(iOrigen);
  const tramoSegundo = secuenciaSegundo.slice(0, iDestino + 1);
  const transbordo = buscarTransbordo(tramoPrimero, tramoSegundo);
  if (!transbordo) {
    return undefined;
  }

  const iBajada = tramoPrimero.findIndex((p) => p.stopCode === transbordo.bajada.stopCode);
  const iSubida = tramoSegundo.findIndex((p) => p.stopCode === transbordo.subida.stopCode);

  return {
    tipo: 'transbordo',
    primero: {
      lin: candidato.primero.lin,
      dir: candidato.primero.dir,
      origen: candidato.primero.origen.parada,
      bajada: transbordo.bajada,
      paradasEnBus: iBajada,
    },
    segundo: {
      lin: candidato.segundo.lin,
      dir: candidato.segundo.dir,
      subida: transbordo.subida,
      bajada: candidato.segundo.destino.parada,
      paradasEnBus: tramoSegundo.length - 1 - iSubida,
    },
    metrosOrigen: candidato.primero.origen.metros,
    metrosTransbordo: transbordo.metros,
    metrosDestino: candidato.segundo.destino.metros,
  };
}

/**
 * Horario aproximado del servicio nocturno ("Búho") de la EMT: 23:55 a 06:00.
 * No hay ningún endpoint que diga qué líneas operan ahora mismo, así que se
 * usa esta franja fija en vez de mezclar líneas nocturnas con las diurnas sin
 * avisar de que unas y otras no circulan al mismo tiempo.
 */
export function esHorarioNocturno(fecha: Date): boolean {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  return minutos >= 23 * 60 + 55 || minutos < 6 * 60;
}

/** Se queda solo con las líneas activas ahora: nocturnas de madrugada, diurnas el resto del día. */
export function lineasActivasAhora<T extends { lin: string }>(items: T[], ahora: Date): T[] {
  const nocturno = esHorarioNocturno(ahora);
  return items.filter((item) => esLineaNocturna(item.lin) === nocturno);
}

function agregarAlternativa(
  actuales: string[] | undefined,
  principal: string,
  nueva: string,
): string[] | undefined {
  if (nueva === principal) {
    return actuales;
  }
  const set = new Set(actuales ?? []);
  set.add(nueva);
  return [...set].sort(compararLineas);
}

function claveParadasDirecto(o: TramoDirecto): string {
  return `${o.origen.stopCode}:${o.bajada.stopCode}`;
}

function claveParadasTransbordo(o: TramoConTransbordo): string {
  return `${o.primero.origen.stopCode}:${o.primero.bajada.stopCode}:${o.segundo.subida.stopCode}:${o.segundo.bajada.stopCode}`;
}

/**
 * Junta opciones que usan exactamente las mismas paradas (de subida, bajada y
 * transbordo): es la misma caminata y el mismo trayecto, solo cambia qué
 * autobús concreto coger en cada tramo (p.ej. las líneas 26 y 32 paran en los
 * mismos dos puntos). Las líneas adicionales quedan en `lineasAlternativas`.
 */
export function agruparPorParadas(opciones: OpcionRuta[]): OpcionRuta[] {
  const directos = new Map<string, TramoDirecto>();
  const transbordos = new Map<string, TramoConTransbordo>();
  const orden: OpcionRuta[] = [];

  for (const o of opciones) {
    if (o.tipo === 'directo') {
      const clave = claveParadasDirecto(o);
      const existente = directos.get(clave);
      if (existente) {
        existente.lineasAlternativas = agregarAlternativa(
          existente.lineasAlternativas,
          existente.lin,
          o.lin,
        );
      } else {
        const copia: TramoDirecto = { ...o };
        directos.set(clave, copia);
        orden.push(copia);
      }
    } else {
      const clave = claveParadasTransbordo(o);
      const existente = transbordos.get(clave);
      if (existente) {
        existente.primero.lineasAlternativas = agregarAlternativa(
          existente.primero.lineasAlternativas,
          existente.primero.lin,
          o.primero.lin,
        );
        existente.segundo.lineasAlternativas = agregarAlternativa(
          existente.segundo.lineasAlternativas,
          existente.segundo.lin,
          o.segundo.lin,
        );
      } else {
        const copia: TramoConTransbordo = {
          ...o,
          primero: { ...o.primero },
          segundo: { ...o.segundo },
        };
        transbordos.set(clave, copia);
        orden.push(copia);
      }
    }
  }
  return orden;
}

function metrosAndando(opcion: OpcionRuta): number {
  return opcion.tipo === 'directo'
    ? opcion.metrosOrigen + opcion.metrosDestino
    : opcion.metrosOrigen + opcion.metrosTransbordo + opcion.metrosDestino;
}

/** Menos transbordos primero; a igualdad, menos distancia total a pie. */
export function ordenarOpciones(opciones: OpcionRuta[]): OpcionRuta[] {
  return [...opciones].sort((a, b) => {
    const transbordosA = a.tipo === 'directo' ? 0 : 1;
    const transbordosB = b.tipo === 'directo' ? 0 : 1;
    if (transbordosA !== transbordosB) {
      return transbordosA - transbordosB;
    }
    return metrosAndando(a) - metrosAndando(b);
  });
}
