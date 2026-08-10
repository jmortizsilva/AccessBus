import { Enlace, CandidatoParada } from '../data/red';
import { Parada } from '../types';
import {
  buscarTransbordo,
  combinacionesDirectas,
  construirTramoConTransbordo,
  lineasCandidatas,
  ordenarOpciones,
  validarTramoDirecto,
  OpcionRuta,
} from './rutaAB';

function parada(stopCode: string): Parada {
  return { stopCode, stopName: `Parada ${stopCode}` };
}

function candidato(stopCode: string, metros: number): CandidatoParada {
  return { parada: parada(stopCode), metros };
}

describe('combinacionesDirectas', () => {
  const enlaces: Record<string, Enlace[]> = {
    origenA: [
      { lin: '5', dir: 1, destino: 'Norte' },
      { lin: '27', dir: 1, destino: 'Sur' },
    ],
    destinoB: [{ lin: '5', dir: 1, destino: 'Norte' }],
    destinoC: [{ lin: '5', dir: 2, destino: 'Centro' }],
  };
  const obtenerEnlaces = (stopCode: string) => enlaces[stopCode] ?? [];

  it('encuentra la línea que pasa por origen y destino en el mismo sentido', () => {
    const resultado = combinacionesDirectas(
      [candidato('origenA', 100)],
      [candidato('destinoB', 200)],
      obtenerEnlaces,
    );
    expect(resultado).toEqual([
      { lin: '5', dir: 1, origen: candidato('origenA', 100), destino: candidato('destinoB', 200) },
    ]);
  });

  it('no empareja si el sentido es distinto, aunque la línea coincida', () => {
    const resultado = combinacionesDirectas(
      [candidato('origenA', 100)],
      [candidato('destinoC', 200)],
      obtenerEnlaces,
    );
    expect(resultado).toEqual([]);
  });

  it('devuelve vacío si el origen no tiene líneas en el índice', () => {
    const resultado = combinacionesDirectas(
      [candidato('sinDatos', 50)],
      [candidato('destinoB', 200)],
      obtenerEnlaces,
    );
    expect(resultado).toEqual([]);
  });
});

describe('validarTramoDirecto', () => {
  const secuencia = [parada('A'), parada('B'), parada('C'), parada('D')];
  const candidato_ = {
    lin: '5',
    dir: 1 as const,
    origen: candidato('B', 100),
    destino: candidato('D', 50),
  };

  it('valida y cuenta las paradas cuando el origen va antes que el destino', () => {
    const tramo = validarTramoDirecto(candidato_, secuencia);
    expect(tramo).toEqual({
      tipo: 'directo',
      lin: '5',
      dir: 1,
      destino: 'Parada D',
      origen: parada('B'),
      bajada: parada('D'),
      paradasEnBus: 2,
      metrosOrigen: 100,
      metrosDestino: 50,
    });
  });

  it('descarta el tramo si el destino va antes que el origen en la secuencia real', () => {
    const invertido = { ...candidato_, origen: candidato('D', 50), destino: candidato('B', 100) };
    expect(validarTramoDirecto(invertido, secuencia)).toBeUndefined();
  });

  it('descarta el tramo si alguna parada no está en la secuencia', () => {
    const candidatoFuera = { ...candidato_, origen: candidato('Z', 100) };
    expect(validarTramoDirecto(candidatoFuera, secuencia)).toBeUndefined();
  });
});

describe('lineasCandidatas', () => {
  const enlaces: Record<string, Enlace[]> = {
    p1: [{ lin: '5', dir: 1, destino: 'Norte' }],
    p2: [
      { lin: '5', dir: 1, destino: 'Norte' },
      { lin: '27', dir: 2, destino: 'Sur' },
    ],
  };
  const obtenerEnlaces = (stopCode: string) => enlaces[stopCode] ?? [];

  it('se queda con la parada más cercana cuando varias comparten (línea, sentido)', () => {
    const resultado = lineasCandidatas(
      [candidato('p1', 300), candidato('p2', 50)],
      10,
      obtenerEnlaces,
    );
    const linea5 = resultado.find((r) => r.lin === '5' && r.dir === 1);
    expect(linea5?.parada.parada.stopCode).toBe('p2');
    expect(linea5?.parada.metros).toBe(50);
  });

  it('ordena por distancia y respeta el tope', () => {
    const resultado = lineasCandidatas(
      [candidato('p1', 300), candidato('p2', 50)],
      1,
      obtenerEnlaces,
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0].lin).toBe('5');
  });
});

// Coordenadas auxiliares: 0.001º de latitud son ~111 m.
function paradaEn(stopCode: string, lat: number, lon = 0): Parada {
  return { stopCode, stopName: `Parada ${stopCode}`, lat, lon };
}

describe('buscarTransbordo', () => {
  it('devuelve la primera parada común (misma parada, 0 metros) según el orden de la primera secuencia', () => {
    const desdeOrigen = [parada('X'), parada('Y'), parada('Z')];
    const hastaDestino = [parada('W'), parada('Y'), parada('Z')];
    expect(buscarTransbordo(desdeOrigen, hastaDestino)).toEqual({
      bajada: parada('Y'),
      subida: parada('Y'),
      metros: 0,
    });
  });

  it('acepta un transbordo entre paradas distintas si están dentro del umbral (caso real: líneas que se cruzan)', () => {
    // A 111 m de diferencia: dentro de los 250 m por defecto.
    const desdeOrigen = [paradaEn('E1-parada', 0)];
    const hastaDestino = [paradaEn('L6-parada', 0.001)];
    const resultado = buscarTransbordo(desdeOrigen, hastaDestino);
    expect(resultado?.bajada.stopCode).toBe('E1-parada');
    expect(resultado?.subida.stopCode).toBe('L6-parada');
    expect(resultado?.metros).toBeGreaterThan(0);
    expect(resultado?.metros).toBeLessThanOrEqual(250);
  });

  it('descarta un transbordo si la parada más cercana está por encima del umbral', () => {
    // ~1110 m de diferencia: muy por encima del umbral por defecto.
    const desdeOrigen = [paradaEn('E1-parada', 0)];
    const hastaDestino = [paradaEn('L6-parada', 0.01)];
    expect(buscarTransbordo(desdeOrigen, hastaDestino)).toBeUndefined();
  });

  it('respeta un umbral personalizado', () => {
    const desdeOrigen = [paradaEn('A', 0)];
    const hastaDestino = [paradaEn('B', 0.001)]; // ~111 m
    expect(buscarTransbordo(desdeOrigen, hastaDestino, 50)).toBeUndefined();
    expect(buscarTransbordo(desdeOrigen, hastaDestino, 200)?.subida.stopCode).toBe('B');
  });

  it('devuelve undefined si no hay ninguna parada en común ni dentro del umbral', () => {
    expect(buscarTransbordo([parada('X')], [parada('Y')])).toBeUndefined();
  });
});

describe('construirTramoConTransbordo', () => {
  const candidato_ = {
    primero: { lin: '5', dir: 1 as const, origen: candidato('A', 80) },
    segundo: { lin: '27', dir: 2 as const, destino: candidato('E', 40) },
  };
  // Línea 5: A(subida) -> B -> TX -> C
  const secuenciaPrimero = [parada('Z'), parada('A'), parada('B'), parada('TX'), parada('C')];
  // Línea 27: D -> TX -> E(bajada) -> F
  const secuenciaSegundo = [parada('D'), parada('TX'), parada('E'), parada('F')];

  it('encuentra el transbordo (misma parada) y cuenta las paradas de cada tramo', () => {
    const tramo = construirTramoConTransbordo(candidato_, secuenciaPrimero, secuenciaSegundo);
    expect(tramo).toEqual({
      tipo: 'transbordo',
      primero: {
        lin: '5',
        dir: 1,
        origen: parada('A'),
        bajada: parada('TX'), // A -> B -> TX
        paradasEnBus: 2,
      },
      segundo: {
        lin: '27',
        dir: 2,
        subida: parada('TX'),
        bajada: parada('E'), // TX -> E
        paradasEnBus: 1,
      },
      metrosOrigen: 80,
      metrosTransbordo: 0,
      metrosDestino: 40,
    });
  });

  it('encuentra el transbordo cuando las dos líneas paran cerca pero no en el mismo código (caso real de Madrid)', () => {
    // Línea 5: A(subida) -> B -> TXA(baja aquí). Línea 27: D -> TXB(sube aquí, ~111m de TXA) -> E(bajada) -> F.
    const primeroConParadaCercana = [
      parada('Z'),
      parada('A'),
      parada('B'),
      { stopCode: 'TXA', stopName: 'Parada TXA', lat: 0, lon: 0 },
    ];
    const segundoConParadaCercana = [
      parada('D'),
      { stopCode: 'TXB', stopName: 'Parada TXB', lat: 0.001, lon: 0 },
      parada('E'),
      parada('F'),
    ];
    const tramo = construirTramoConTransbordo(
      candidato_,
      primeroConParadaCercana,
      segundoConParadaCercana,
    );
    expect(tramo?.primero.bajada.stopCode).toBe('TXA');
    expect(tramo?.segundo.subida.stopCode).toBe('TXB');
    expect(tramo?.metrosTransbordo).toBeGreaterThan(0);
    expect(tramo?.metrosTransbordo).toBeLessThanOrEqual(250);
  });

  it('devuelve undefined si no hay ningún punto en común ni cercano entre las dos líneas', () => {
    const sinComun = [parada('D'), parada('E'), parada('F')];
    expect(construirTramoConTransbordo(candidato_, secuenciaPrimero, sinComun)).toBeUndefined();
  });

  it('devuelve undefined si el origen o el destino no están en su secuencia', () => {
    const otroOrigen = {
      ...candidato_,
      primero: { ...candidato_.primero, origen: candidato('NoEsta', 0) },
    };
    expect(
      construirTramoConTransbordo(otroOrigen, secuenciaPrimero, secuenciaSegundo),
    ).toBeUndefined();
  });
});

describe('ordenarOpciones', () => {
  const directo: OpcionRuta = {
    tipo: 'directo',
    lin: '5',
    dir: 1,
    destino: 'Norte',
    origen: parada('A'),
    bajada: parada('B'),
    paradasEnBus: 3,
    metrosOrigen: 900,
    metrosDestino: 900,
  };
  const transbordoCorto: OpcionRuta = {
    tipo: 'transbordo',
    primero: { lin: '5', dir: 1, origen: parada('A'), bajada: parada('T'), paradasEnBus: 1 },
    segundo: { lin: '27', dir: 1, subida: parada('T'), bajada: parada('B'), paradasEnBus: 1 },
    metrosOrigen: 10,
    metrosTransbordo: 0,
    metrosDestino: 10,
  };
  const directoLejos: OpcionRuta = { ...directo, metrosOrigen: 50, metrosDestino: 50 };

  it('prioriza siempre menos transbordos, aunque haya que andar más', () => {
    const ordenado = ordenarOpciones([transbordoCorto, directo]);
    expect(ordenado[0].tipo).toBe('directo');
  });

  it('a igualdad de transbordos, ordena por menor distancia total a pie', () => {
    const ordenado = ordenarOpciones([directo, directoLejos]);
    expect(ordenado[0]).toBe(directoLejos);
  });

  it('no muta el array original', () => {
    const original = [transbordoCorto, directo];
    const copia = [...original];
    ordenarOpciones(original);
    expect(original).toEqual(copia);
  });
});
