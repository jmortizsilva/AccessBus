export interface Linea {
  /** Código interno de la línea en la API (p.ej. "005"). */
  id: string;
  /** Etiqueta pública que ve el usuario (p.ej. "5", "N1", "C2"). */
  lin: string;
  nombre: string;
  /** Cabeceras del recorrido (p.ej. "PLAZA CRISTO REY - PROSPERIDAD"). */
  descripcion: string;
  colorFondo: string;
  colorTexto: string;
}

export interface Parada {
  /** Número de parada (idStop de EMT); es lo que se guarda como favorito. */
  stopCode: string;
  stopName: string;
  lat?: number;
  lon?: number;
  /** Etiquetas de líneas que pasan, separadas por coma (p.ej. "5, 14, 27"). */
  lineasPaso?: string;
  /** Solo al listar por línea. */
  sentido?: 1 | 2;
  ordenSentido?: number;
}

/** Un punto geográfico con etiqueta legible, para el planificador de rutas. */
export interface PuntoGeo {
  lat: number;
  lon: number;
  /** Texto a mostrar/anunciar: nombre de parada, dirección o "Mi ubicación". */
  etiqueta: string;
}

export interface Tiempo {
  /** Etiqueta pública de la línea que llega (p.ej. "5", "N1"). */
  linea: string;
  tiempoText: string;
  minutos?: number;
  distanciaText: string;
  distanciaM?: number;
  destino?: string;
}
