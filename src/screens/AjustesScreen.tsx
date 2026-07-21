import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { DEFAULT_RADIUS, RADIUS_OPTIONS, useApp } from '../state/AppContext';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';

export default function AjustesScreen() {
  const { searchRadiusM, setSearchRadiusM } = useApp();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Pantalla Ajustes">
      <Text style={styles.title} accessibilityRole="header">
        Ajustes
      </Text>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Radio de búsqueda de paradas cercanas
      </Text>
      <Text style={styles.note}>
        Distancia máxima para mostrar paradas cercanas en Inicio.
      </Text>

      <View style={styles.card}>
        {RADIUS_OPTIONS.map((meters, i) => {
          const selected = meters === searchRadiusM;
          return (
            <Pressable
              key={meters}
              style={[styles.row, i < RADIUS_OPTIONS.length - 1 && styles.divider, selected && styles.rowSelected]}
              onPress={() => void setSearchRadiusM(meters)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatDistance(meters)}${
                meters === DEFAULT_RADIUS ? ', valor por defecto' : ''
              }`}
              accessibilityHint="Toca dos veces para usar este radio de búsqueda"
            >
              <Text style={styles.rowText}>{formatDistance(meters)}</Text>
              <Text style={styles.check}>{selected ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Acerca de
      </Text>
      <View style={styles.card}>
        <View style={styles.row} accessible accessibilityLabel={`Versión de la app ${version}`}>
          <Text style={styles.rowText}>Versión</Text>
          <Text style={styles.value}>{version}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        BusMadrid · Datos de EMT Madrid (MobilityLabs). Los tiempos de paso son en
        tiempo real.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  title: { color: theme.textStrong, fontSize: 34, fontWeight: '700' },
  sectionHeader: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 10 },
  note: { color: theme.textMuted, fontSize: 14 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  row: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowSelected: { backgroundColor: theme.primaryDark },
  rowText: { color: theme.textStrong, fontSize: 17 },
  check: { color: theme.primary, fontSize: 18, fontWeight: '800' },
  value: { color: theme.textMuted, fontSize: 17 },
  footer: { color: theme.textMuted, fontSize: 13, marginTop: 12, lineHeight: 18 },
});
