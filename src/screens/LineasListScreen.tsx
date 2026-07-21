import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { LineasStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { hexColor, theme } from '../theme';
import { Linea } from '../types';

type Nav = NativeStackNavigationProp<LineasStackParamList, 'LineasList'>;

export default function LineasListScreen() {
  const navigation = useNavigation<Nav>();
  const { lineas, loadingLineas, refreshLineas } = useApp();
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refreshLineas(false);
    }, [refreshLineas])
  );

  const q = query.trim();
  // La API de EMT no busca paradas por nombre; sí por número de parada exacto.
  const isCode = /^\d+$/.test(q);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="Pantalla Líneas"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Líneas
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Número de parada"
        placeholderTextColor={theme.textMuted}
        style={styles.input}
        keyboardType="number-pad"
        accessibilityLabel="Buscar parada por número"
        accessibilityHint="Escribe el número de una parada para consultarla"
      />

      {q.length > 0 && !isCode && (
        <Text style={styles.note}>Escribe el número exacto de la parada.</Text>
      )}

      {isCode && (
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('Parada', {
                parada: { stopCode: q, stopName: `Parada ${q}` },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Consultar parada ${q}`}
            accessibilityHint="Toca dos veces para ver sus tiempos de paso"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Consultar parada {q}</Text>
              <Text style={styles.rowDesc}>Ver tiempos de paso en tiempo real</Text>
            </View>
          </Pressable>
        </View>
      )}

      {q.length === 0 && (
        <>
          {loadingLineas && lineas.length === 0 && (
            <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando líneas" />
          )}
          {!loadingLineas && lineas.length === 0 && (
            <Text style={styles.note}>
              Aún no hay líneas. Se cargarán al conectar con la API de EMT (requiere credenciales).
            </Text>
          )}
          {lineas.length > 0 && (
            <View style={styles.card}>
              {lineas.map((linea, i) => (
                <LineaRow
                  key={linea.id}
                  linea={linea}
                  isLast={i === lineas.length - 1}
                  onPress={() => navigation.navigate('LineaParadas', { linea })}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function LineaRow({ linea, isLast, onPress }: { linea: Linea; isLast: boolean; onPress: () => void }) {
  const bg = hexColor(linea.colorFondo, theme.primaryDark);
  const fg = hexColor(linea.colorTexto, '#ffffff');
  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Línea ${linea.lin}. ${linea.descripcion}`}
      accessibilityHint="Toca dos veces para ver sus paradas"
    >
      <View style={[styles.badge, { backgroundColor: bg }]} importantForAccessibility="no">
        <Text style={[styles.badgeText, { color: fg }]}>{linea.lin}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Línea {linea.lin}</Text>
        <Text style={styles.rowDesc} numberOfLines={2}>
          {linea.descripcion}
        </Text>
      </View>
    </Pressable>
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
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  row: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  badge: {
    minWidth: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 18, fontWeight: '800' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  rowDesc: { color: theme.textMuted, fontSize: 14 },
});
