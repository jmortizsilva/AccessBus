import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ParadaRow from '../components/ParadaRow';
import { BuscarStackParamList } from '../navigation/types';
import { buscarRutaAB, ResultadoRutaAB } from '../services/rutaAB';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';
import { OpcionRuta } from '../utils/rutaAB';
import { Linea, Parada } from '../types';

type Nav = NativeStackNavigationProp<BuscarStackParamList, 'RutaABResultado'>;
type Ruta = RouteProp<BuscarStackParamList, 'RutaABResultado'>;

/** Nombre + número de parada, igual que en la cabecera de la pantalla de parada. */
function conParada(parada: Parada): string {
  return `${parada.stopName} (parada ${parada.stopCode})`;
}

/**
 * "línea 26" o, si hay alternativas que paran en los mismos dos puntos,
 * "líneas 26 o 32" / "líneas 26, 32 o N26".
 */
function textoLineas(lin: string, alternativas?: string[]): string {
  if (!alternativas || alternativas.length === 0) {
    return `línea ${lin}`;
  }
  const todas = [lin, ...alternativas];
  const ultima = todas[todas.length - 1];
  return `líneas ${todas.slice(0, -1).join(', ')} o ${ultima}`;
}

function etiquetaOpcion(opcion: OpcionRuta): string {
  if (opcion.tipo === 'directo') {
    const totalAndando = formatDistance(opcion.metrosOrigen + opcion.metrosDestino);
    return (
      `${capitaliza(textoLineas(opcion.lin, opcion.lineasAlternativas))}, hacia ${opcion.destino}. ` +
      `Sube en ${conParada(opcion.origen)}. Baja en ${conParada(opcion.bajada)}. ` +
      `${opcion.paradasEnBus} paradas en el bus. ${totalAndando} andando en total.`
    );
  }
  const totalAndando = formatDistance(
    opcion.metrosOrigen + opcion.metrosTransbordo + opcion.metrosDestino,
  );
  return (
    `${capitaliza(textoLineas(opcion.primero.lin, opcion.primero.lineasAlternativas))} desde ${conParada(opcion.primero.origen)} ` +
    `hasta ${conParada(opcion.primero.bajada)}, ${opcion.primero.paradasEnBus} paradas. ` +
    `Cambia andando ${formatDistance(opcion.metrosTransbordo)} hasta ${conParada(opcion.segundo.subida)} ` +
    `y coge ${textoLineas(opcion.segundo.lin, opcion.segundo.lineasAlternativas)} hasta ` +
    `${conParada(opcion.segundo.bajada)}, ${opcion.segundo.paradasEnBus} paradas más. ` +
    `${totalAndando} andando en total.`
  );
}

function capitaliza(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function RutaABResultadoScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Ruta>();
  const { origen, destino } = route.params;
  const { lineas, loadingLineas, refreshLineas } = useApp();

  // La búsqueda recuerda con qué líneas se hizo: "buscando" se deduce (no es de las
  // líneas actuales) en vez de ponerlo a mano desde el efecto, que lo prohíbe
  // react-hooks/set-state-in-effect.
  const [busqueda, setBusqueda] = useState<{
    lineas: Linea[];
    resultado?: ResultadoRutaAB;
    error: string;
  }>();
  const buscando = busqueda?.lineas !== lineas;
  const resultado = busqueda?.resultado;
  const error = buscando ? '' : busqueda.error;

  useEffect(() => {
    void refreshLineas();
  }, [refreshLineas]);

  useEffect(() => {
    if (lineas.length === 0) {
      return;
    }
    let activo = true;
    buscarRutaAB(origen, destino, lineas)
      .then((r) => activo && setBusqueda({ lineas, resultado: r, error: '' }))
      .catch(
        (err) =>
          activo &&
          setBusqueda((previa) => ({
            lineas,
            resultado: previa?.resultado,
            error: String((err as Error).message ?? err),
          })),
      );
    return () => {
      activo = false;
    };
  }, [origen, destino, lineas]);

  const abrirLinea = (lin: string, dir: 1 | 2) => {
    const linea = lineas.find((l) => l.lin === lin);
    if (linea) {
      navigation.navigate('LineaParadas', { linea, sentido: dir });
    }
  };

  const cargando = buscando || (loadingLineas && lineas.length === 0);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="Resultado de la búsqueda de ruta">
      <Text style={styles.header} accessibilityRole="header">
        {origen.etiqueta} → {destino.etiqueta}
      </Text>

      {cargando && (
        <ActivityIndicator color={theme.primary} accessibilityLabel="Buscando opciones de ruta" />
      )}
      {!cargando && error ? <Text style={styles.note}>Error: {error}</Text> : null}

      {!cargando && !error && resultado && resultado.opciones.length > 0 && (
        <View style={styles.card}>
          {resultado.opciones.map((opcion, i) => (
            <OpcionRow
              key={i}
              opcion={opcion}
              isLast={i === resultado.opciones.length - 1}
              onOpen={abrirLinea}
            />
          ))}
        </View>
      )}

      {!cargando && !error && resultado && resultado.opciones.length === 0 && (
        <>
          <Text style={styles.note}>
            No se ha encontrado ninguna línea directa ni con un transbordo entre esos dos puntos.
            Estas son las paradas más cercanas a cada extremo, para que explores manualmente.
          </Text>
          {resultado.candidatosOrigen.length > 0 && (
            <>
              <Text style={styles.sectionHeader} accessibilityRole="header">
                Cerca de {origen.etiqueta}
              </Text>
              <View style={styles.card}>
                {resultado.candidatosOrigen.map(({ parada, metros }, i) => (
                  <ParadaRow
                    key={parada.stopCode}
                    parada={parada}
                    distanceText={formatDistance(metros)}
                    isLast={i === resultado.candidatosOrigen.length - 1}
                    onOpen={() => navigation.navigate('Parada', { parada })}
                  />
                ))}
              </View>
            </>
          )}
          {resultado.candidatosDestino.length > 0 && (
            <>
              <Text style={styles.sectionHeader} accessibilityRole="header">
                Cerca de {destino.etiqueta}
              </Text>
              <View style={styles.card}>
                {resultado.candidatosDestino.map(({ parada, metros }, i) => (
                  <ParadaRow
                    key={parada.stopCode}
                    parada={parada}
                    distanceText={formatDistance(metros)}
                    isLast={i === resultado.candidatosDestino.length - 1}
                    onOpen={() => navigation.navigate('Parada', { parada })}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function OpcionRow({
  opcion,
  isLast,
  onOpen,
}: {
  opcion: OpcionRuta;
  isLast: boolean;
  onOpen: (lin: string, dir: 1 | 2) => void;
}) {
  if (opcion.tipo === 'directo') {
    return (
      <Pressable
        style={[styles.row, !isLast && styles.divider]}
        onPress={() => onOpen(opcion.lin, opcion.dir)}
        accessibilityRole="button"
        accessibilityLabel={etiquetaOpcion(opcion)}
        accessibilityHint="Toca dos veces para ver el recorrido completo de la línea">
        <View style={styles.badgesFila}>
          <Text style={styles.badge}>Línea {opcion.lin}</Text>
          {opcion.lineasAlternativas?.map((lin) => (
            <Text key={lin} style={styles.badgeAlt}>
              o {lin}
            </Text>
          ))}
          <Text style={styles.meta}>{opcion.paradasEnBus} paradas</Text>
        </View>
        <Text style={styles.filaTexto}>Sube en {conParada(opcion.origen)}</Text>
        <Text style={styles.filaTexto}>Baja en {conParada(opcion.bajada)}</Text>
        <Text style={styles.meta}>
          {formatDistance(opcion.metrosOrigen + opcion.metrosDestino)} andando en total
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={() => onOpen(opcion.primero.lin, opcion.primero.dir)}
      accessibilityRole="button"
      accessibilityLabel={etiquetaOpcion(opcion)}
      accessibilityHint="Toca dos veces para ver el recorrido de la primera línea">
      <View style={styles.badgesFila}>
        <Text style={styles.badge}>Línea {opcion.primero.lin}</Text>
        {opcion.primero.lineasAlternativas?.map((lin) => (
          <Text key={lin} style={styles.badgeAlt}>
            o {lin}
          </Text>
        ))}
        <Text style={styles.meta}>→</Text>
        <Text style={styles.badge}>Línea {opcion.segundo.lin}</Text>
        {opcion.segundo.lineasAlternativas?.map((lin) => (
          <Text key={lin} style={styles.badgeAlt}>
            o {lin}
          </Text>
        ))}
      </View>
      <Text style={styles.filaTexto}>Sube en {conParada(opcion.primero.origen)}</Text>
      <Text style={styles.filaTexto}>Baja en {conParada(opcion.primero.bajada)}</Text>
      <Text style={styles.meta}>
        🚶 {formatDistance(opcion.metrosTransbordo)} hasta {conParada(opcion.segundo.subida)}
      </Text>
      <Text style={styles.filaTexto}>Baja en {conParada(opcion.segundo.bajada)}</Text>
      <Text style={styles.meta}>
        {opcion.primero.paradasEnBus + opcion.segundo.paradasEnBus} paradas en total ·{' '}
        {formatDistance(opcion.metrosOrigen + opcion.metrosTransbordo + opcion.metrosDestino)}{' '}
        andando
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  header: { color: theme.textStrong, fontSize: 20, fontWeight: '700' },
  sectionHeader: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  row: { paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  badgesFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    color: '#ffffff',
    backgroundColor: theme.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeAlt: {
    color: theme.textStrong,
    fontSize: 13,
    fontWeight: '700',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  filaTexto: { color: theme.text, fontSize: 15 },
  meta: { color: theme.textMuted, fontSize: 13 },
});
