import { esLineaNocturna } from './lineas';

describe('esLineaNocturna', () => {
  it('reconoce las líneas búho (N seguida de número)', () => {
    expect(esLineaNocturna('N1')).toBe(true);
    expect(esLineaNocturna('N26')).toBe(true);
    expect(esLineaNocturna('N27')).toBe(true);
  });

  it('no confunde líneas diurnas que empiezan por N con letra de otra familia', () => {
    expect(esLineaNocturna('27')).toBe(false);
    expect(esLineaNocturna('N')).toBe(false); // sin número, no es un búho real
    expect(esLineaNocturna('E1')).toBe(false);
  });
});
