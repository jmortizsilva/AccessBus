import { compararLineas, ordenarLineas } from './ordenLineas';

const orden = (labels: string[]) => [...labels].sort(compararLineas);

describe('compararLineas', () => {
  it('ordena las numéricas por valor, no alfabéticamente', () => {
    expect(orden(['10', '2', '1', '100', '21'])).toEqual(['1', '2', '10', '21', '100']);
  });

  it('pone las numéricas antes que las de letras', () => {
    expect(orden(['C1', '5', 'N2', '27'])).toEqual(['5', '27', 'C1', 'N2']);
  });

  it('agrupa cada familia y la ordena por su número', () => {
    expect(orden(['N10', 'N2', 'N1', 'N26'])).toEqual(['N1', 'N2', 'N10', 'N26']);
    expect(orden(['SE7', 'SE2', 'SE702', 'SE3'])).toEqual(['SE2', 'SE3', 'SE7', 'SE702']);
  });

  it('la etiqueta sin número va antes que la que lo lleva (E antes que E1)', () => {
    expect(orden(['E5', 'E', 'E1'])).toEqual(['E', 'E1', 'E5']);
  });

  it('mantiene distintas "001" y "1" y las ordena de forma estable', () => {
    const r = orden(['1', '001']);
    expect(r).toContain('001');
    expect(r).toContain('1');
    // "001" y "1" son líneas distintas; el desempate deja "001" antes que "1".
    expect(r.indexOf('001')).toBeLessThan(r.indexOf('1'));
  });

  it('orden realista de una muestra variada', () => {
    const muestra = ['N1', '10', 'C1', '1', 'E1', '2', 'SE712', '100', 'C03', 'N10'];
    expect(orden(muestra)).toEqual([
      '1',
      '2',
      '10',
      '100',
      'C1',
      'C03',
      'E1',
      'N1',
      'N10',
      'SE712',
    ]);
  });
});

describe('ordenarLineas', () => {
  it('no muta el array original y ordena por la etiqueta `lin`', () => {
    const original = [{ lin: '10' }, { lin: '2' }, { lin: 'C1' }, { lin: '1' }];
    const copia = [...original];
    const ordenado = ordenarLineas(original);
    expect(ordenado.map((l) => l.lin)).toEqual(['1', '2', '10', 'C1']);
    expect(original).toEqual(copia); // intacto
  });
});
