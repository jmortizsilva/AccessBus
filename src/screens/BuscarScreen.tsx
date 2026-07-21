import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ParadaRow from '../components/ParadaRow';
import { BuscarStackParamList } from '../navigation/types';
import { getStopsAroundStreet, NearbyResult } from '../services/emt';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';

type Nav = NativeStackNavigationProp<BuscarStackParamList, 'BuscarHome'>;

const RADIO_CALLE = 250;

export default function BuscarScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<NearbyResult[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const q = query.trim();
  const esNumero = /^\d+$/.test(q);

  const buscar = useCallback(async () => {
    if (q.length < 3 || esNumero) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await getStopsAroundStreet(q, RADIO_CALLE);
      setResultados(r);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      setResultados(undefined);
    } finally {
      setLoading(false);
    }
  }, [q, esNumero]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="Pantalla Buscar paradas"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Buscar
      </Text>

      <TextInput
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setResultados(undefined);
          setError('');
        }}
        onSubmitEditing={() => void buscar()}
        placeholder="Nombre de calle o número de parada"
        placeholderTextColor={theme.textMuted}
        style={styles.input}
        returnKeyType="search"
        accessibilityLabel="Buscar parada"
        accessibilityHint="Escribe el nombre de una calle, o el número exacto de una parada"
        autoCorrect={false}
      />

      {/* Número de parada: acceso directo, sin necesidad de buscar. */}
      {esNumero && (
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('Parada', { parada: { stopCode: q, stopName: `Parada ${q}` } })
            }
            accessibilityRole="button"
            accessibilityLabel={`Consultar parada número ${q}`}
            accessibilityHint="Toca dos veces para ver sus tiempos de paso"
          >
            <Text style={styles.rowTitle}>Ir a la parada {q}</Text>
            <Text style={styles.rowDesc}>Ver tiempos de paso en tiempo real</Text>
          </Pressable>
        </View>
      )}

      {!esNumero && q.length >= 3 && (
        <Pressable
          style={styles.buttonPrimary}
          onPress={() => void buscar()}
          accessibilityRole="button"
          accessibilityLabel={`Buscar paradas en ${q}`}
        >
          <Text style={styles.buttonText}>Buscar paradas en "{q}"</Text>
        </Pressable>
      )}

      {loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Buscando paradas" />}
      {error ? <Text style={styles.note}>No se pudo buscar: {error}</Text> : null}

      {resultados !== undefined && !loading && (
        <>
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {resultados.length === 0
              ? 'Sin resultados'
              : `${resultados.length} ${resultados.length === 1 ? 'parada' : 'paradas'}`}
          </Text>
          {resultados.length === 0 ? (
            <Text style={styles.note}>
              No se han encontrado paradas cerca de "{q}". Prueba con otro nombre de calle.
            </Text>
          ) : (
            <View style={styles.card}>
              {resultados.map(({ parada, meters }, i) => (
                <ParadaRow
                  key={parada.stopCode}
                  parada={parada}
                  onOpen={() => navigation.navigate('Parada', { parada })}
                  distanceText={formatDistance(meters)}
                  isLast={i === resultados.length - 1}
                />
              ))}
            </View>
          )}
        </>
      )}

      {resultados === undefined && !loading && q.length < 3 && (
        <Text style={styles.note}>
          Escribe el nombre de una calle (por ejemplo, "Gran Vía") y pulsa Buscar, o el número
          exacto de una parada.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  title: { color: theme.textStrong, fontSize: 34, fontWeight: '700' },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    fontSize: 17,
    color: theme.textStrong,
    backgroundColor: theme.card,
  },
  buttonPrimary: {
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  sectionHeader: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  row: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  rowTitle: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  rowDesc: { color: theme.textMuted, fontSize: 14 },
});
