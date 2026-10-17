import type { ViajeActivo } from '../services/seguimientoViaje';
import { MARGEN_TRAS_FIN_MS, resumenViaje, tramoViaje, viajeVigente } from './viaje';

function viaje(cambios: Partial<ViajeActivo> = {}): ViajeActivo {
  return {
    lin: '27',
    dir: 1,
    destinoNombre: 'Cibeles',
    secuencia: ['Castellana', 'Bilbao', 'Alonso Martínez', 'Colón', 'Cibeles', 'Atocha'].map(
      (stopName, i) => ({ stopCode: String(i), stopName }),
    ),
    indiceOrigen: 1,
    indiceDestino: 4,
    indiceActual: 2,
    nivelAvisado: null,
    iniciadoEn: 0,
    ultimaActividadEn: 0,
    estado: 'activo',
    ...cambios,
  };
}

describe('viajeVigente', () => {
  it('un viaje activo se muestra siempre', () => {
    expect(viajeVigente(viaje(), 10 * MARGEN_TRAS_FIN_MS)).toBe(true);
  });

  it('un viaje terminado se muestra durante el margen y después no', () => {
    const v = viaje({ estado: 'llegado', finalizadoEn: 1000 });
    expect(viajeVigente(v, 1000 + MARGEN_TRAS_FIN_MS - 1)).toBe(true);
    expect(viajeVigente(v, 1000 + MARGEN_TRAS_FIN_MS)).toBe(false);
  });

  it('un registro antiguo sin hora de fin caduca contando desde la última actividad', () => {
    const v = viaje({ estado: 'timeout', ultimaActividadEn: 0 });
    expect(viajeVigente(v, MARGEN_TRAS_FIN_MS)).toBe(false);
  });
});

describe('resumenViaje', () => {
  it('concuerda el plural de las paradas que quedan', () => {
    expect(resumenViaje(viaje())).toBe('Línea 27, bajas en Cibeles. Quedan 2 paradas.');
    expect(resumenViaje(viaje({ indiceActual: 3 }))).toBe(
      'Línea 27, bajas en Cibeles. Queda 1 parada.',
    );
  });

  it('dice la llegada', () => {
    expect(resumenViaje(viaje({ estado: 'llegado' }))).toBe('Línea 27. Has llegado a Cibeles.');
  });
});

describe('tramoViaje', () => {
  it('va de la subida a la bajada, con la acción delante del nombre', () => {
    expect(tramoViaje(viaje()).map((p) => p.texto)).toEqual([
      'Pasada, Bilbao',
      'Ahora, Alonso Martínez',
      'Colón',
      'Bajas aquí, Cibeles',
    ]);
  });

  it('al llegar marca la parada de bajada como la actual', () => {
    const tramo = tramoViaje(viaje({ estado: 'llegado', indiceActual: 3 }));
    expect(tramo.map((p) => p.texto)).toEqual([
      'Pasada, Bilbao',
      'Pasada, Alonso Martínez',
      'Pasada, Colón',
      'Ahora, bajas aquí, Cibeles',
    ]);
  });
});
