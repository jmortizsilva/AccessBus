import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useParadaActions } from '../hooks/useParadaActions';
import { LineasStackParamList } from '../navigation/types';
import { getStopsLinea } from '../services/emt';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Parada } from '../types';

type Nav = NativeStackNavigationProp<LineasStackParamList, 'LineaParadas'>;

export default function LineaParadasScreen() {
  const route = useRoute<RouteProp<LineasStackParamList, 'LineaParadas'>>();
  const navigation = useNavigation<Nav>();
  const { linea } = route.params;
  const { lineas } = useApp();

  // Las paradas traen IDs internos de línea; este mapa los traduce a etiquetas
  // públicas para que las acciones de rotor puedan consultar cada línea.
  const labelById = useMemo(
    () => Object.fromEntries(lineas.map((l) => [l.id, l.lin])),
    [lineas]
  );

  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentido, setSentido] = useState<1 | 2>(1);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Línea ${linea.lin}` });
  }, [navigation, linea.lin]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getStopsLinea(linea.id, sentido, labelById)
      .then((data) => active && setParadas(data))
      .catch((err) => active && setError(String((err as Error).message ?? err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [linea.id, sentido, labelById]);

  const destino = paradas.length > 0 ? paradas[paradas.length - 1].stopName : undefined;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      accessibilityLabel={`Paradas de la línea ${linea.lin}`}
    >
      <Text style={styles.header} accessibilityRole="header">
        {linea.descripcion || `Línea ${linea.lin}`}
      </Text>

      <Pressable
        style={styles.sentidoButton}
        onPress={() => setSentido((s) => (s === 1 ? 2 : 1))}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar sentido. Ahora: sentido ${sentido}${destino ? `, hacia ${destino}` : ''}`}
        accessibilityHint="Toca dos veces para ver el otro sentido"
      >
        <Text style={styles.sentidoText}>
          🔁 Sentido {sentido}
          {destino ? ` · hacia ${destino}` : ''}
        </Text>
      </Pressable>

      {loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando paradas" />}
      {!loading && error ? <Text style={styles.note}>Error: {error}</Text> : null}
      {!loading && !error && paradas.length === 0 ? (
        <Text style={styles.note}>Esta línea no tiene paradas disponibles en este sentido.</Text>
      ) : null}

      {paradas.length > 0 && (
        <View style={styles.card}>
          {paradas.map((parada, i) => (
            <LineaParadaRow
              key={`${parada.stopCode}-${i}`}
              parada={parada}
              order={i + 1}
              isLast={i === paradas.length - 1}
              onOpen={() => navigation.navigate('Parada', { parada })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function LineaParadaRow({
  parada,
  order,
  isLast,
  onOpen,
}: {
  parada: Parada;
  order: number;
  isLast: boolean;
  onOpen: () => void;
}) {
  const { accessibilityActions, onAccessibilityAction, fav } = useParadaActions(parada, onOpen);
  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${parada.stopName}.${fav ? ' En favoritos.' : ''}`}
      accessibilityHint="Toca dos veces para abrir. En el rotor de acciones tienes el tiempo de cada línea."
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <View style={styles.orderBadge} importantForAccessibility="no">
        <Text style={styles.orderText}>{order}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {parada.stopName}
          {fav ? ' ★' : ''}
        </Text>
        <Text style={styles.rowMeta}>Parada {parada.stopCode}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  header: { color: theme.textStrong, fontSize: 22, fontWeight: '700' },
  sentidoButton: {
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sentidoText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  row: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: { color: theme.textMuted, fontSize: 14, fontWeight: '700' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  rowMeta: { color: theme.textMuted, fontSize: 13 },
});
