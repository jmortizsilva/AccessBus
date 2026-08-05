import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { comprobarActualizacion } from '../services/actualizaciones';
import { DEFAULT_RADIUS, RADIUS_OPTIONS, UMBRAL_OPTIONS, useApp } from '../state/AppContext';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';

export default function AjustesScreen() {
  const {
    searchRadiusM,
    setSearchRadiusM,
    notificacionesActivas,
    setNotificacionesActivas,
    umbralMin,
    setUmbralMin,
    favoriteLineas,
  } = useApp();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Pantalla Ajustes">
      <Text style={styles.title} accessibilityRole="header">
        Ajustes
      </Text>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Radio de búsqueda de paradas cercanas
      </Text>
      <Text style={styles.note}>Distancia máxima para mostrar paradas cercanas en Inicio.</Text>

      <View style={styles.card}>
        {RADIUS_OPTIONS.map((meters, i) => {
          const selected = meters === searchRadiusM;
          return (
            <Pressable
              key={meters}
              style={[
                styles.row,
                i < RADIUS_OPTIONS.length - 1 && styles.divider,
                selected && styles.rowSelected,
              ]}
              onPress={() => void setSearchRadiusM(meters)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatDistance(meters)}${
                meters === DEFAULT_RADIUS ? ', valor por defecto' : ''
              }`}
              accessibilityHint="Toca dos veces para usar este radio de búsqueda">
              <Text style={styles.rowText}>{formatDistance(meters)}</Text>
              <Text style={styles.check}>{selected ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Notificaciones
      </Text>
      <View style={styles.card}>
        <Pressable
          style={[styles.row, styles.divider, notificacionesActivas && styles.rowSelected]}
          onPress={() => void setNotificacionesActivas(!notificacionesActivas)}
          accessibilityRole="switch"
          accessibilityState={{ checked: notificacionesActivas }}
          accessibilityLabel="Avisos de las líneas que sigo"
          accessibilityHint="Te avisa cuando hay una incidencia en una línea que sigues">
          <Text style={styles.rowText}>Avisos de líneas seguidas</Text>
          <Text style={styles.check}>{notificacionesActivas ? 'Sí' : 'No'}</Text>
        </Pressable>
        <View
          style={styles.row}
          accessible
          accessibilityLabel={
            favoriteLineas.length === 0
              ? 'No sigues ninguna línea. Puedes seguirlas desde la pantalla de cada línea.'
              : `Líneas seguidas: ${favoriteLineas.join(', ')}`
          }>
          <Text style={styles.rowText}>Líneas seguidas</Text>
          <Text style={styles.value}>
            {favoriteLineas.length === 0 ? 'ninguna' : favoriteLineas.join(', ')}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Aviso de llegada
      </Text>
      <Text style={styles.note}>
        Al vigilar una parada, se te avisa cuando un autobús está a esta antelación.
      </Text>
      <View style={styles.card}>
        {UMBRAL_OPTIONS.map((min, i) => {
          const selected = min === umbralMin;
          return (
            <Pressable
              key={min}
              style={[
                styles.row,
                i < UMBRAL_OPTIONS.length - 1 && styles.divider,
                selected && styles.rowSelected,
              ]}
              onPress={() => void setUmbralMin(min)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${min} minutos`}
              accessibilityHint="Toca dos veces para usar esta antelación">
              <Text style={styles.rowText}>{min} minutos</Text>
              <Text style={styles.check}>{selected ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Acerca de
      </Text>
      <View style={styles.card}>
        <View
          style={[styles.row, styles.divider]}
          accessible
          accessibilityLabel={`Versión de la app ${version}`}>
          <Text style={styles.rowText}>Versión</Text>
          <Text style={styles.value}>{version}</Text>
        </View>
        <Pressable
          style={styles.row}
          onPress={() => void comprobarActualizacion(true)}
          accessibilityRole="button"
          accessibilityLabel="Buscar actualizaciones"
          accessibilityHint="Comprueba si hay una versión nueva y, si la hay, pregunta antes de instalarla">
          <Text style={styles.rowText}>Buscar actualizaciones</Text>
          <Text style={styles.value}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        AccessBus · Datos de EMT Madrid (MobilityLabs). Los tiempos de paso son en tiempo real.
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
