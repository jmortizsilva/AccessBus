export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Extrae el primer número entero de un texto (p.ej. "9 Minutos." -> 9, "2710m" -> 2710). */
export function firstInt(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return toNumber(value);
  }
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}
