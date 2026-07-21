import { Linea, Parada } from '../types';

export type TabParamList = {
  Inicio: undefined;
  Lineas: undefined;
  Buscar: undefined;
  Ajustes: undefined;
};

/**
 * Las tres pestañas con listas de paradas pueden abrir el detalle de una parada
 * y, desde ahí, el recorrido de una línea. Por eso las tres registran las mismas
 * pantallas: así el botón atrás devuelve siempre al sitio del que se vino.
 */
export type InicioStackParamList = {
  InicioHome: undefined;
  Parada: { parada: Parada };
  LineaParadas: { linea: Linea; sentido?: 1 | 2 };
};

export type LineasStackParamList = {
  LineasList: undefined;
  LineaParadas: { linea: Linea; sentido?: 1 | 2 };
  Parada: { parada: Parada };
};

export type BuscarStackParamList = {
  BuscarHome: undefined;
  Parada: { parada: Parada };
  LineaParadas: { linea: Linea; sentido?: 1 | 2 };
};
