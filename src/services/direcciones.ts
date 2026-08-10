import * as Location from 'expo-location';

export interface ResultadoDireccion {
  /** Texto legible para mostrar/anunciar (calle y número, o el texto tecleado). */
  etiqueta: string;
  lat: number;
  lon: number;
}

/**
 * Geocodifica una dirección de texto a coordenadas con el geocodificador
 * nativo de Apple (CLGeocoder, vía expo-location): sin API key ni coste.
 *
 * `Location.geocodeAsync` solo devuelve coordenadas, sin texto; para una
 * etiqueta legible se hace un `reverseGeocodeAsync` del mejor resultado, con
 * el propio texto tecleado como respaldo si ese segundo paso falla.
 */
export async function geocodificarDireccion(texto: string): Promise<ResultadoDireccion[]> {
  const query = texto.trim();
  if (!query) {
    return [];
  }
  const resultados = await Location.geocodeAsync(query);
  const primero = resultados[0];
  if (!primero) {
    return [];
  }
  let etiqueta = query;
  try {
    const inverso = await Location.reverseGeocodeAsync({
      latitude: primero.latitude,
      longitude: primero.longitude,
    });
    const lugar = inverso[0];
    const calle = [lugar?.street, lugar?.streetNumber].filter(Boolean).join(', ');
    etiqueta = calle || lugar?.name || query;
  } catch {
    // Sin conexión o sin resultado inverso: nos quedamos con el texto tecleado.
  }
  return [{ etiqueta, lat: primero.latitude, lon: primero.longitude }];
}
