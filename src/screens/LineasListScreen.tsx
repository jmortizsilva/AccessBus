import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CampoBusqueda from '../components/CampoBusqueda';
import { LineasStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { hexColor, theme } from '../theme';
import { Linea } from '../types';
import { ordenarLineas } from '../utils/ordenLineas';
import { normalizeText } from '../utils/text';

type Nav = NativeStackNavigationProp<LineasStackParamList, 'LineasList'>;

export default function LineasListScreen() {
  const navigation = useNavigation<Nav>();
  const { lineas, loadingLineas, refreshLineas } = useApp();
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refreshLineas(false);
    }, [refreshLineas]),
  );

  // Orden lógico SIEMPRE en pantalla: la caché puede traer el orden viejo de la
  // API (se guarda 7 días), así que reordenamos aquí, no solo al descargar.
  const ordenadas = useMemo(() => ordenarLineas(lineas), [lineas]);

  // Filtro por número de línea o por destino (son 236 líneas).
  const filtradas = useMemo(() => {
    const q = normalizeText(query);
    if (!q) {
      return ordenadas;
    }
    return ordenadas.filter(
      (l) => normalizeText(l.lin).includes(q) || normalizeText(l.descripcion).includes(q),
    );
  }, [ordenadas, query]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      accessibilityLabel="Pantalla Líneas"
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Líneas
      </Text>

      <CampoBusqueda
        onChangeText={setQuery}
        placeholder="Filtrar por número o destino"
        accessibilityLabel="Filtrar líneas"
        accessibilityHint="Escribe el número de una línea o parte de su destino"
      />

      {loadingLineas && lineas.length === 0 && (
        <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando líneas" />
      )}
      {!loadingLineas && lineas.length === 0 && (
        <Text style={styles.note}>No se han podido cargar las líneas. Comprueba tu conexión.</Text>
      )}

      {lineas.length > 0 && (
        <Text style={styles.count} accessibilityLabel={`${filtradas.length} líneas`}>
          {filtradas.length} {filtradas.length === 1 ? 'línea' : 'líneas'}
        </Text>
      )}

      {filtradas.length === 0 && lineas.length > 0 ? (
        <Text style={styles.note}>Ninguna línea coincide con «{query.trim()}».</Text>
      ) : null}

      {filtradas.length > 0 && (
        <View style={styles.card}>
          {filtradas.map((linea, i) => (
            <LineaRow
              key={`${linea.id}-${linea.lin}`}
              linea={linea}
              isLast={i === filtradas.length - 1}
              onPress={() => navigation.navigate('LineaParadas', { linea })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function LineaRow({
  linea,
  isLast,
  onPress,
}: {
  linea: Linea;
  isLast: boolean;
  onPress: () => void;
}) {
  const bg = hexColor(linea.colorFondo, theme.primaryDark);
  const fg = hexColor(linea.colorTexto, '#ffffff');
  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Línea ${linea.lin}. ${linea.descripcion}`}
      accessibilityHint="Toca dos veces para ver sus paradas">
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
  count: { color: theme.textMuted, fontSize: 13 },
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
    minWidth: 52,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 17, fontWeight: '800' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  rowDesc: { color: theme.textMuted, fontSize: 14 },
});
