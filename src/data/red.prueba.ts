import { buscarParadas, paradaDelIndice } from './red';
import { normalizeText } from '../utils/text';

describe('buscarParadas', () => {
  it('no busca sin texto (el mínimo de letras lo aplica la pantalla)', () => {
    expect(buscarParadas('')).toEqual([]);
    expect(buscarParadas('   ')).toEqual([]);
  });

  it('encuentra las paradas de Vía Lusitana que la API geográfica dejaba fuera', () => {
    // Regresión del bug real: "Vía Lusitana" no devolvía 3990 ni 3991.
    const codigos = buscarParadas('Vía Lusitana').map((p) => p.stopCode);
    expect(codigos).toContain('3990');
    expect(codigos).toContain('3991');
  });

  it('es insensible a acentos y mayúsculas', () => {
    const conAcento = buscarParadas('Vía Lusitana').map((p) => p.stopCode);
    const sinAcento = buscarParadas('via lusitana').map((p) => p.stopCode);
    expect(sinAcento).toEqual(conAcento);
  });

  it('cada palabra del texto aparece en el nombre de todos los resultados', () => {
    const texto = 'via lusitana';
    const tokens = normalizeText(texto).split(/\s+/);
    for (const p of buscarParadas(texto)) {
      const nombre = normalizeText(p.stopName);
      for (const t of tokens) {
        expect(nombre).toContain(t);
      }
    }
  });

  it('prioriza los nombres que empiezan por lo escrito', () => {
    const q = normalizeText('via lusitana');
    const nombres = buscarParadas('via lusitana').map((p) => normalizeText(p.stopName));
    // El primer resultado empieza por el texto; ninguno que empiece por él puede
    // quedar por detrás de otro que solo lo contenga.
    expect(nombres[0].startsWith(q)).toBe(true);
    const ultimoQueEmpieza = nombres.map((n) => n.startsWith(q)).lastIndexOf(true);
    const primeroQueNoEmpieza = nombres.map((n) => n.startsWith(q)).indexOf(false);
    if (primeroQueNoEmpieza !== -1) {
      expect(ultimoQueEmpieza).toBeLessThan(primeroQueNoEmpieza);
    }
  });

  it('respeta el límite de resultados', () => {
    expect(buscarParadas('a', 5).length).toBeLessThanOrEqual(5);
    // "a" con dos letras no busca; usamos algo con dos letras y muchos hits.
    expect(buscarParadas('de', 3).length).toBeLessThanOrEqual(3);
  });

  it('las paradas encontradas traen las líneas que pasan', () => {
    const [primera] = buscarParadas('Vía Lusitana');
    expect(primera).toBeDefined();
    expect(typeof primera.lineasPaso).toBe('string');
    expect(primera.lineasPaso!.length).toBeGreaterThan(0);
  });
});

describe('paradaDelIndice', () => {
  it('devuelve el nombre real de una parada conocida', () => {
    const p = paradaDelIndice('3990');
    expect(p?.stopName).toMatch(/Lusitana/i);
  });

  it('devuelve undefined si la parada no está en el índice', () => {
    expect(paradaDelIndice('0')).toBeUndefined();
  });
});
