import { Linea, Parada } from '../types';

export type TabParamList = {
  Inicio: undefined;
  Lineas: undefined;
  Buscar: undefined;
  Ajustes: undefined;
};

export type BuscarStackParamList = {
  BuscarHome: undefined;
  Parada: { parada: Parada };
};

export type InicioStackParamList = {
  InicioHome: undefined;
  Parada: { parada: Parada };
};

export type LineasStackParamList = {
  LineasList: undefined;
  LineaParadas: { linea: Linea };
  Parada: { parada: Parada };
};
