import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getStopDetail, getTiempos } from '../services/emt';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Parada, Tiempo } from '../types';
import { spokenTiempo } from '../utils/tiempos';

type ParadaParams = { Parada: { parada: Parada } };

const AUTO_REFRESH_MS = 30_000;

export default function ParadaScreen() {
  const route = useRoute<RouteProp<ParadaParams, 'Parada'>>();
  const navigation = useNavigation();
  const { isFavorite, addFavorite, removeFavorite } = useApp();

  // El detalle puede llegar completo (desde cercanas) o solo con el número (búsqueda);
  // en ese caso lo enriquecemos con el nombre y las líneas reales.
  const [parada, setParada] = useState<Parada>(route.params.parada);
  const [times, setTimes] = useState<Tiempo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  // Enriquecer nombre/líneas si faltan.
  useEffect(() => {
    if (parada.lat !== undefined && parada.lineasPaso) {
      return;
    }
    let active = true;
    getStopDetail(parada.stopCode)
      .then((detail) => {
        if (active && detail) {
          setParada((prev) => ({ ...prev, ...detail }));
        }
      })
      .catch(() => {
        // no crítico
      });
    return () => {
      active = false;
    };
  }, [parada.stopCode, parada.lat, parada.lineasPaso]);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const data = await getTiempos(parada.stopCode);
        if (mounted.current) {
          setTimes(data);
          setError('');
        }
      } catch (err) {
        if (mounted.current && !silent) {
          setError(String((err as Error).message ?? err));
        }
      } finally {
        if (mounted.current && !silent) {
          setLoading(false);
        }
      }
    },
    [parada.stopCode]
  );

  useEffect(() => {
    mounted.current = true;
    void load(false);
    const timer = setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const fav = isFavorite(parada.stopCode);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      accessibilityLabel={`Parada ${parada.stopName}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {parada.stopName}
        </Text>
        <Text style={styles.code}>Parada {parada.stopCode}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void load(false)}
          accessibilityRole="button"
          accessibilityLabel="Actualizar tiempos"
        >
          <Text style={styles.secondaryText}>Actualizar</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, fav && styles.favActive]}
          onPress={() => (fav ? removeFavorite(parada.stopCode) : addFavorite(parada))}
          accessibilityRole="button"
          accessibilityLabel={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Text style={styles.secondaryText}>{fav ? '★ En favoritos' : '☆ Favorito'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Próximos autobuses
      </Text>

      {loading && <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando tiempos" />}

      {!loading && error ? (
        <View style={styles.errorBox} accessible accessibilityLabel={`Error: ${error}`}>
          <Text style={styles.note}>No se pudieron cargar los tiempos.</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void load(false)}
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <Text style={styles.secondaryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && times.length === 0 ? (
        <Text style={styles.note}>No hay autobuses próximos ahora mismo.</Text>
      ) : null}

      {times.map((t, index) => (
        <View
          key={`${t.linea}-${index}`}
          style={styles.timeRow}
          accessible
          accessibilityLabel={spokenTiempo(t)}
        >
          <View style={styles.timeLeft}>
            <Text style={styles.timeLinea}>Línea {t.linea}</Text>
            {t.destino ? <Text style={styles.timeDest}>{t.destino}</Text> : null}
          </View>
          <View style={styles.timeRight}>
            <Text style={styles.timeMin}>{t.tiempoText || '—'}</Text>
            <Text style={styles.timeDist}>{t.distanciaText}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  header: { paddingTop: 8, gap: 4 },
  title: { color: theme.textStrong, fontSize: 26, fontWeight: '700' },
  code: { color: theme.textMuted, fontSize: 15 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.card,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  favActive: { backgroundColor: theme.primaryDark, borderColor: theme.primary },
  secondaryText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  sectionHeader: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 6 },
  note: { color: theme.textMuted, fontSize: 15, paddingVertical: 8 },
  errorBox: { gap: 10 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  timeLeft: { flexShrink: 1 },
  timeLinea: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  timeDest: { color: theme.textMuted, fontSize: 13 },
  timeRight: { alignItems: 'flex-end' },
  timeMin: { color: theme.primary, fontSize: 17, fontWeight: '700' },
  timeDist: { color: theme.textMuted, fontSize: 13 },
});
