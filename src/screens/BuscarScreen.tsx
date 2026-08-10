import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CampoBusqueda from '../components/CampoBusqueda';
import ParadaRow from '../components/ParadaRow';
import { buscarParadas, paradaDelIndice } from '../data/red';
import { BuscarStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Nav = NativeStackNavigationProp<BuscarStackParamList, 'BuscarHome'>;

/** A partir de cuántas letras empezamos a buscar por nombre. */
const MIN_LETRAS = 2;
const MAX_RESULTADOS = 40;

export default function BuscarScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');

  const q = query.trim();
  const esNumero = /^\d+$/.test(q);
  // Si el número está en el índice, ya sabemos su nombre (mejor que "Parada 3990").
  const paradaPorNumero = esNumero ? paradaDelIndice(q) : undefined;

  // Búsqueda local (offline, instantánea): el índice de red trae los nombres de
  // todas las paradas, así que no hace falta ninguna petición ni esperar.
  const resultados = useMemo(
    () => (esNumero || q.length < MIN_LETRAS ? [] : buscarParadas(q, MAX_RESULTADOS)),
    [q, esNumero],
  );
  const buscando = !esNumero && q.length >= MIN_LETRAS;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="Pantalla Buscar paradas"
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Buscar
      </Text>

      <Pressable
        style={styles.buttonPrimary}
        onPress={() => navigation.navigate('RutaAB')}
        accessibilityRole="button"
        accessibilityLabel="Planificar ruta"
        accessibilityHint="Busca líneas de EMT entre un origen y un destino">
        <Text style={styles.buttonText}>🧭 Planificar ruta</Text>
      </Pressable>

      <CampoBusqueda
        onChangeText={setQuery}
        placeholder="Nombre de parada o de calle, o número de parada"
        accessibilityLabel="Buscar parada"
        accessibilityHint="Escribe el nombre de una parada o calle, o el número exacto de una parada"
      />

      {/* Número de parada: acceso directo, sin necesidad de buscar. */}
      {esNumero && (
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('Parada', {
                parada: paradaPorNumero ?? { stopCode: q, stopName: `Parada ${q}` },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={
              paradaPorNumero
                ? `Consultar ${paradaPorNumero.stopName}, parada ${q}`
                : `Consultar parada número ${q}`
            }
            accessibilityHint="Toca dos veces para ver sus tiempos de paso">
            <Text style={styles.rowTitle}>
              {paradaPorNumero ? paradaPorNumero.stopName : `Ir a la parada ${q}`}
            </Text>
            <Text style={styles.rowDesc}>
              {paradaPorNumero ? `Parada ${q} · ver tiempos` : 'Ver tiempos de paso en tiempo real'}
            </Text>
          </Pressable>
        </View>
      )}

      {buscando && (
        <>
          <Text
            style={styles.sectionHeader}
            accessibilityRole="header"
            accessibilityLiveRegion="polite">
            {resultados.length === 0
              ? 'Sin resultados'
              : `${resultados.length} ${resultados.length === 1 ? 'parada' : 'paradas'}`}
          </Text>
          {resultados.length === 0 ? (
            <Text style={styles.note}>
              No se ha encontrado ninguna parada con «{q}». Prueba con otro nombre o con el número
              de parada.
            </Text>
          ) : (
            <View style={styles.card}>
              {resultados.map((parada, i) => (
                <ParadaRow
                  key={parada.stopCode}
                  parada={parada}
                  onOpen={() => navigation.navigate('Parada', { parada })}
                  isLast={i === resultados.length - 1}
                />
              ))}
            </View>
          )}
        </>
      )}

      {!esNumero && q.length < MIN_LETRAS && (
        <Text style={styles.note}>
          Escribe el nombre de una parada o calle (por ejemplo, «Vía Lusitana» o «Gran Vía»), o el
          número exacto de una parada.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  title: { color: theme.textStrong, fontSize: 34, fontWeight: '700' },
  sectionHeader: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  row: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  rowTitle: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  rowDesc: { color: theme.textMuted, fontSize: 14 },
  buttonPrimary: {
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
});
