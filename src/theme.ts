// Paleta única de la app (azul EMT sobre fondo oscuro). Centralizada para que
// pantallas y componentes compartan los mismos colores y sea fácil ajustar el tema.
export const theme = {
  bg: '#0b1626',
  card: '#12223a',
  cardAlt: '#0a1524',
  border: '#24405f',
  primary: '#4aa3ff',
  primaryDark: '#1c5aa0',
  text: '#e9f1fb',
  textStrong: '#f5f9ff',
  textMuted: '#a7bcd6',
  danger: '#7a2a38',
  dangerText: '#ffe8ed',
};

// Normaliza un color hex de la API ("2D8659" o "#2D8659") a "#RRGGBB".
export function hexColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const clean = value.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean}` : fallback;
}
