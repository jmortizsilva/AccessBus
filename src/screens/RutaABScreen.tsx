import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CampoBusqueda from '../components/CampoBusqueda';
import { buscarParadas } from '../data/red';
import { BuscarStackParamList } from '../navigation/types';
import { geocodificarDireccion } from '../services/direcciones';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Parada, PuntoGeo } from '../types';

type Nav = NativeStackNavigationProp<BuscarStackParamList, 'RutaAB'>;

const MIN_LETRAS = 2;
const MAX_RESULTADOS_PARADA = 8;

export default function RutaABScreen() {
  const navigation = useNavigation<Nav>();
  const { currentLocation } = useApp();
  const [origen, setOrigen] = useState<PuntoGeo | undefined>();
  const [destino, setDestino] = useState<PuntoGeo | undefined>();

  const puedeBuscar = Boolean(origen && destino);
  const miUbicacion: PuntoGeo | undefined = currentLocation
    ? {
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        etiqueta: currentLocation.name ?? 'Mi ubicación actual',
      }
    : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Planificar ruta">
      <Text style={styles.intro}>
        Busca por nombre de parada, de calle o una dirección completa. Solo se muestran opciones con
        autobuses EMT.
      </Text>

      <SelectorPunto
        titulo="Origen"
        punto={origen}
        onSeleccionar={setOrigen}
        onLimpiar={() => setOrigen(undefined)}
        miUbicacion={miUbicacion}
      />

      <SelectorPunto
        titulo="Destino"
        punto={destino}
        onSeleccionar={setDestino}
        onLimpiar={() => setDestino(undefined)}
      />

      <Pressable
        style={[styles.buttonPrimary, !puedeBuscar && styles.buttonDisabled]}
        disabled={!puedeBuscar}
        onPress={() => {
          if (origen && destino) {
            navigation.navigate('RutaABResultado', { origen, destino });
          }
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !puedeBuscar }}
        accessibilityLabel="Buscar ruta"
        accessibilityHint={
          puedeBuscar
            ? 'Busca líneas de EMT entre el origen y el destino'
            : 'Elige primero el origen y el destino'
        }>
        <Text style={styles.buttonText}>Buscar ruta</Text>
      </Pressable>
    </ScrollView>
  );
}

interface SelectorPuntoProps {
  titulo: string;
  punto: PuntoGeo | undefined;
  onSeleccionar: (punto: PuntoGeo) => void;
  onLimpiar: () => void;
  miUbicacion?: PuntoGeo;
}

/** Buscador de un punto (origen o destino): paradas EMT offline o una dirección geocodificada. */
function SelectorPunto({
  titulo,
  punto,
  onSeleccionar,
  onLimpiar,
  miUbicacion,
}: SelectorPuntoProps) {
  const [query, setQuery] = useState('');
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [errorDireccion, setErrorDireccion] = useState('');

  const q = query.trim();
  const resultadosParada = useMemo(
    () => (q.length < MIN_LETRAS ? [] : buscarParadas(q, MAX_RESULTADOS_PARADA)),
    [q],
  );

  const elegirParada = (parada: Parada) => {
    if (parada.lat === undefined || parada.lon === undefined) {
      return;
    }
    onSeleccionar({ lat: parada.lat, lon: parada.lon, etiqueta: parada.stopName });
    setQuery('');
  };

  const buscarDireccion = async () => {
    setBuscandoDireccion(true);
    setErrorDireccion('');
    try {
      const [resultado] = await geocodificarDireccion(q);
      if (resultado) {
        onSeleccionar(resultado);
        setQuery('');
      } else {
        setErrorDireccion('No se ha encontrado esa dirección.');
      }
    } catch (error) {
      setErrorDireccion(
        `No se ha podido buscar la dirección: ${String((error as Error).message ?? error)}`,
      );
    } finally {
      setBuscandoDireccion(false);
    }
  };

  if (punto) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {titulo}
        </Text>
        <View style={styles.filaSeleccion}>
          <Text style={styles.puntoTexto} numberOfLines={2}>
            {punto.etiqueta}
          </Text>
          <Pressable
            style={styles.limpiarButton}
            onPress={onLimpiar}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar ${titulo.toLowerCase()}`}
            accessibilityHint="Vuelve a buscar este punto">
            <Text style={styles.limpiarText}>Cambiar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader} accessibilityRole="header">
        {titulo}
      </Text>
      <CampoBusqueda
        onChangeText={setQuery}
        placeholder="Nombre de parada, calle o dirección"
        accessibilityLabel={`Buscar ${titulo.toLowerCase()}`}
        accessibilityHint="Escribe el nombre de una parada, una calle o una dirección completa"
      />

      {miUbicacion && (
        <Pressable
          style={styles.miUbicacionButton}
          onPress={() => onSeleccionar(miUbicacion)}
          accessibilityRole="button"
          accessibilityLabel={`Usar mi ubicación actual como ${titulo.toLowerCase()}`}>
          <Text style={styles.miUbicacionText}>📍 Mi ubicación actual</Text>
        </Pressable>
      )}

      {q.length >= MIN_LETRAS && resultadosParada.length > 0 && (
        <View style={styles.listaResultados}>
          {resultadosParada.map((parada) => (
            <Pressable
              key={parada.stopCode}
              style={styles.resultadoRow}
              onPress={() => elegirParada(parada)}
              accessibilityRole="button"
              accessibilityLabel={`${parada.stopName}, parada ${parada.stopCode}`}
              accessibilityHint="Toca dos veces para elegir esta parada">
              <Text style={styles.resultadoTitulo}>{parada.stopName}</Text>
              <Text style={styles.resultadoMeta}>Parada {parada.stopCode}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {q.length >= MIN_LETRAS && (
        <Pressable
          style={styles.buscarDireccionButton}
          onPress={() => void buscarDireccion()}
          disabled={buscandoDireccion}
          accessibilityRole="button"
          accessibilityLabel={`Buscar «${q}» como dirección`}
          accessibilityHint="Úsalo si no es el nombre de una parada, sino una dirección completa">
          <Text style={styles.buscarDireccionText}>
            {buscandoDireccion ? 'Buscando dirección…' : `🔍 Buscar «${q}» como dirección`}
          </Text>
        </Pressable>
      )}
      {buscandoDireccion && (
        <ActivityIndicator color={theme.primary} accessibilityLabel="Buscando dirección" />
      )}
      {errorDireccion ? <Text style={styles.note}>{errorDireccion}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  intro: { color: theme.textMuted, fontSize: 15 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 14, gap: 10 },
  sectionHeader: { color: theme.textStrong, fontSize: 17, fontWeight: '700' },
  filaSeleccion: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puntoTexto: { flex: 1, color: theme.text, fontSize: 16 },
  limpiarButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  limpiarText: { color: theme.primary, fontSize: 16, fontWeight: '600' },
  miUbicacionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.cardAlt,
  },
  miUbicacionText: { color: theme.textStrong, fontSize: 15, fontWeight: '600' },
  listaResultados: { borderRadius: 10, overflow: 'hidden', backgroundColor: theme.cardAlt },
  resultadoRow: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  resultadoTitulo: { color: theme.textStrong, fontSize: 15, fontWeight: '600' },
  resultadoMeta: { color: theme.textMuted, fontSize: 12 },
  buscarDireccionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  buscarDireccionText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  note: { color: theme.textMuted, fontSize: 13 },
  buttonPrimary: {
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
});
