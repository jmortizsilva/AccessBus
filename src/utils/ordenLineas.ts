/**
 * Orden lógico (natural) de las etiquetas de línea de la EMT.
 *
 * La API las devuelve en un `order` propio poco intuitivo, y un desempate
 * alfabético daba el clásico "1, 10, 100, 11, 2…". Este orden pone las líneas
 * numéricas primero, en orden numérico REAL, y luego cada familia de letras
 * (C, E, N/búho, SE, T…) agrupada y también por su número: C1, C2, C03; N1, N2…
 * N26; SE2, SE3… Los números van antes que las letras.
 *
 * OJO: los ceros a la izquierda son significativos ("001" y "1" son líneas
 * distintas en la EMT), así que solo se usan para desempatar, nunca para
 * fusionarlas.
 */

type Token = string | number;

/** Trocea "SE704" -> ["SE", 704], "C03" -> ["C", 3], "001" -> [1]. */
function trocear(label: string): Token[] {
  const tokens: Token[] = [];
  const re = /\d+|\D+/g; // rachas de dígitos o de no-dígitos, alternas
  let m: RegExpExecArray | null;
  while ((m = re.exec(label)) !== null) {
    const chunk = m[0];
    tokens.push(/^\d/.test(chunk) ? Number(chunk) : chunk.toUpperCase());
  }
  return tokens;
}

/** Compara dos etiquetas de línea en orden natural. */
export function compararLineas(a: string, b: string): number {
  const ta = trocear(a);
  const tb = trocear(b);
  const n = Math.min(ta.length, tb.length);
  for (let i = 0; i < n; i++) {
    const x = ta[i];
    const y = tb[i];
    const xNum = typeof x === 'number';
    const yNum = typeof y === 'number';
    if (xNum && yNum) {
      if (x !== y) {
        return (x as number) - (y as number);
      }
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1; // los números van antes que las letras
    } else if (x !== y) {
      return (x as string) < (y as string) ? -1 : 1;
    }
  }
  // Mismo prefijo común: la etiqueta más corta primero ("E" antes que "E1"); y
  // para casos como "001" vs "1", un desempate estable por la cadena original.
  return ta.length - tb.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** Devuelve una copia ordenada de las líneas por su etiqueta, en orden lógico. */
export function ordenarLineas<T extends { lin: string }>(lineas: readonly T[]): T[] {
  return [...lineas].sort((a, b) => compararLineas(a.lin, b.lin));
}
