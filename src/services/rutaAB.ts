import { CandidatoParada, paradasCercanas } from '../data/red';
import { Linea, Parada, PuntoGeo } from '../types';
import {
  agruparPorParadas,
  combinacionesDirectas,
  construirTramoConTransbordo,
  lineasActivasAhora,
  lineasCandidatas,
  OpcionRuta,
  ordenarOpciones,
  validarTramoDirecto,
} from '../utils/rutaAB';
import { getStopsLinea } from './emt';

export interface ResultadoRutaAB {
  /** Opciones ya ordenadas: menos transbordos primero, luego menos distancia a pie. */
  opciones: OpcionRuta[];
  candidatosOrigen: CandidatoParada[];
  candidatosDestino: CandidatoParada[];
}

// Radios crecientes: si no hay ninguna parada cerca, se amplía antes de rendirse.
const RADIOS_M = [800, 1500, 3000];
// Bastantes candidatos por lado: con solo los más próximos se pierden líneas
// útiles cuando hay varias paradas de otras líneas todavía más cerca.
const LIMITE_CANDIDATOS = 20;
const TOPE_LINEAS_TRANSBORDO = 10;
const LIMITE_OPCIONES = 8;

function candidatosEnRadiosCrecientes(punto: PuntoGeo): CandidatoParada[] {
  for (const radio of RADIOS_M) {
    const candidatos = paradasCercanas(punto.lat, punto.lon, radio, LIMITE_CANDIDATOS);
    if (candidatos.length > 0) {
      return candidatos;
    }
  }
  return [];
}

/**
 * Busca rutas EMT entre dos puntos: líneas directas y, si hacen falta más
 * opciones, combinaciones con un transbordo. No hay ningún endpoint EMT de
 * itinerarios, así que se cruzan localmente los candidatos de origen/destino
 * (offline, `paradasCercanas` + `lineasDeParada`) y solo se pide a la API la
 * secuencia real de las líneas candidatas (`getStopsLinea`), cacheada por
 * (línea, sentido) para no repetir peticiones dentro de una misma búsqueda.
 */
export async function buscarRutaAB(
  origen: PuntoGeo,
  destino: PuntoGeo,
  lineas: Linea[],
): Promise<ResultadoRutaAB> {
  const idByLabel: Record<string, string> = Object.fromEntries(lineas.map((l) => [l.lin, l.id]));
  const candidatosOrigen = candidatosEnRadiosCrecientes(origen);
  const candidatosDestino = candidatosEnRadiosCrecientes(destino);
  // Las líneas nocturnas ("Búho") no circulan de día ni las diurnas de
  // madrugada: mezclarlas sin distinguir proponía rutas con líneas que en ese
  // momento no pasan.
  const ahora = new Date();

  const cacheSecuencias = new Map<string, Promise<Parada[]>>();
  const secuenciaDe = (lin: string, dir: 1 | 2): Promise<Parada[]> => {
    const clave = `${lin}:${dir}`;
    let promesa = cacheSecuencias.get(clave);
    if (!promesa) {
      const lineId = idByLabel[lin];
      promesa = lineId ? getStopsLinea(lineId, dir) : Promise.resolve([]);
      cacheSecuencias.set(clave, promesa);
    }
    return promesa;
  };

  const opciones: OpcionRuta[] = [];

  const directasActivas = lineasActivasAhora(
    combinacionesDirectas(candidatosOrigen, candidatosDestino),
    ahora,
  );
  for (const candidato of directasActivas) {
    const secuencia = await secuenciaDe(candidato.lin, candidato.dir);
    const tramo = validarTramoDirecto(candidato, secuencia);
    if (tramo) {
      opciones.push(tramo);
    }
  }

  // El transbordo es más caro (líneas x líneas peticiones): solo si con las
  // directas no hay suficientes opciones para elegir.
  if (opciones.length < LIMITE_OPCIONES) {
    const lineasOrigen = lineasActivasAhora(
      lineasCandidatas(candidatosOrigen, TOPE_LINEAS_TRANSBORDO),
      ahora,
    );
    const lineasDestino = lineasActivasAhora(
      lineasCandidatas(candidatosDestino, TOPE_LINEAS_TRANSBORDO),
      ahora,
    );
    for (const lo of lineasOrigen) {
      for (const ld of lineasDestino) {
        if (lo.lin === ld.lin) {
          continue;
        }
        const [secuenciaPrimero, secuenciaSegundo] = await Promise.all([
          secuenciaDe(lo.lin, lo.dir),
          secuenciaDe(ld.lin, ld.dir),
        ]);
        const tramo = construirTramoConTransbordo(
          {
            primero: { lin: lo.lin, dir: lo.dir, origen: lo.parada },
            segundo: { lin: ld.lin, dir: ld.dir, destino: ld.parada },
          },
          secuenciaPrimero,
          secuenciaSegundo,
        );
        if (tramo) {
          opciones.push(tramo);
        }
      }
    }
  }

  return {
    opciones: ordenarOpciones(agruparPorParadas(opciones)).slice(0, LIMITE_OPCIONES),
    candidatosOrigen,
    candidatosDestino,
  };
}
