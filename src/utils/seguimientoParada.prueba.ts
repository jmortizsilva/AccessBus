import { Parada } from '../types';
import { calcularNivelAviso, localizarParadaMasCercana } from './seguimientoParada';

// Paradas en línea recta, separadas ~111 m cada una (0.001º de latitud).
function secuencia(n: number): Parada[] {
  return Array.from({ length: n }, (_, i) => ({
    stopCode: String(i),
    stopName: `Parada ${i}`,
    lat: i * 0.001,
    lon: 0,
  }));
}

describe('localizarParadaMasCercana', () => {
  it('encuentra la parada exacta cuando el punto coincide con ella', () => {
    const s = secuencia(5);
    const resultado = localizarParadaMasCercana({ lat: s[2].lat!, lon: 0 }, s, 0);
    expect(resultado?.indice).toBe(2);
    expect(resultado?.distanciaM).toBeLessThan(1);
  });

  it('no retrocede nunca antes del índice mínimo, aunque una parada anterior esté más cerca', () => {
    const s = secuencia(5);
    // El punto está justo en la parada 1, pero el mínimo ya es 3.
    const resultado = localizarParadaMasCercana({ lat: s[1].lat!, lon: 0 }, s, 3);
    expect(resultado?.indice).toBeGreaterThanOrEqual(3);
  });

  it('respeta la ventana: no encuentra paradas más allá de ella', () => {
    const s = secuencia(20);
    // La parada más cercana real (18) queda fuera de una ventana de 5 desde el índice 0.
    const resultado = localizarParadaMasCercana({ lat: s[18].lat!, lon: 0 }, s, 0, 5);
    expect(resultado).toBeDefined();
    expect(resultado!.indice).toBeLessThan(5);
  });

  it('ignora las paradas sin coordenadas', () => {
    const s = secuencia(3);
    s[0] = { ...s[0], lat: undefined, lon: undefined };
    const resultado = localizarParadaMasCercana({ lat: s[0]!.lat ?? 0, lon: 0 }, s, 0);
    expect(resultado?.indice).not.toBe(0);
  });

  it('devuelve undefined si la secuencia ya se agotó desde el índice mínimo', () => {
    const s = secuencia(3);
    expect(localizarParadaMasCercana({ lat: 0, lon: 0 }, s, 3)).toBeUndefined();
  });
});

describe('calcularNivelAviso', () => {
  it('no avisa si faltan más de dos paradas', () => {
    expect(calcularNivelAviso(0, 5)).toBeUndefined();
    expect(calcularNivelAviso(0, 3)).toBeUndefined();
  });

  it('avisa "dos_paradas" cuando quedan exactamente dos', () => {
    expect(calcularNivelAviso(3, 5)).toBe('dos_paradas');
  });

  it('avisa "una_parada" cuando queda exactamente una', () => {
    expect(calcularNivelAviso(4, 5)).toBe('una_parada');
  });

  it('avisa "llegando" cuando el índice actual es el de la parada de bajada', () => {
    expect(calcularNivelAviso(5, 5)).toBe('llegando');
  });

  it('avisa "pasada" si el índice actual ya superó el de bajada', () => {
    expect(calcularNivelAviso(6, 5)).toBe('pasada');
  });
});
