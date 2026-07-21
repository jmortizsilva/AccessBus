import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useParadaActions } from '../hooks/useParadaActions';
import { LineasStackParamList } from '../navigation/types';
import { getHorariosLinea, getStopsLinea, HorarioLinea } from '../services/emt';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Parada } from '../types';

type Nav = NativeStackNavigationProp<LineasStackParamList, 'LineaParadas'>;

export default function LineaParadasScreen() {
  const route = useRoute<RouteProp<LineasStackParamList, 'LineaParadas'>>();
  const navigation = useNavigation<Nav>();
  const { linea } = route.params;
  const { lineas, diaServicio } = useApp();
  const [horarios, setHorarios] = useState<HorarioLinea[]>([]);

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

  // Horarios y frecuencias de la línea (el endpoint espera la etiqueta, no el id).
  useEffect(() => {
    let active = true;
    getHorariosLinea(linea.lin)
      .then((h) => active && setHorarios(h))
      .catch(() => {
        // no crítico
      });
    return () => {
      active = false;
    };
  }, [linea.lin]);

  // Muestra primero el horario del tipo de día de hoy, si lo sabemos.
  const horarioHoy = horarios.find((h) => h.dayType === diaServicio?.dayType);
  const horariosOrdenados = horarioHoy
    ? [horarioHoy, ...horarios.filter((h) => h !== horarioHoy)]
    : horarios;

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

      {horariosOrdenados.length > 0 && (
        <View style={styles.horarioBox}>
          <Text style={styles.horarioHeader} accessibilityRole="header">
            Horarios y frecuencias
          </Text>
          {horariosOrdenados.map((h) => (
            <View key={h.dayType} style={styles.horarioDia}>
              <Text style={styles.horarioDiaTitulo}>
                {h.etiqueta}
                {h.dayType === diaServicio?.dayType ? ' (hoy)' : ''}
              </Text>
              {([1, 2] as const).map((s) => {
                const f = s === 1 ? h.sentido1 : h.sentido2;
                if (!f) {
                  return null;
                }
                const detalle =
                  f.texto ??
                  `De ${f.inicio} a ${f.fin}` +
                    (f.frecMin ? ` · cada ${f.frecMin}-${f.frecMax} min` : '');
                return (
                  <Text
                    key={s}
                    style={styles.horarioTexto}
                    accessibilityLabel={`${h.etiqueta}, sentido ${s}: ${detalle}`}
                  >
                    Sentido {s}: {detalle}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      )}

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
  horarioBox: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  horarioHeader: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  horarioDia: { gap: 2 },
  horarioDiaTitulo: { color: theme.primary, fontSize: 14, fontWeight: '700' },
  horarioTexto: { color: theme.text, fontSize: 14, lineHeight: 19 },
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
