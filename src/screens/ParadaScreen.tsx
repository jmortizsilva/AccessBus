import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, getLlegadas, getStopsAroundStop, NearbyResult } from '../services/emt';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Parada, Tiempo } from '../types';
import { formatDistance } from '../utils/distance';
import { parseLineasPaso, prettyLinea } from '../utils/lineas';
import { spokenTiempo } from '../utils/tiempos';

type ParadaParams = { Parada: { parada: Parada } };
type Nav = NativeStackNavigationProp<{ Parada: { parada: Parada } }>;

const AUTO_REFRESH_MS = 30_000;
const CERCANAS_RADIO = 300;

export default function ParadaScreen() {
  const route = useRoute<RouteProp<ParadaParams, 'Parada'>>();
  const navigation = useNavigation<Nav>();
  const { isFavorite, addFavorite, removeFavorite } = useApp();

  const [parada, setParada] = useState<Parada>(route.params.parada);
  const [times, setTimes] = useState<Tiempo[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cercanas, setCercanas] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        // Una sola llamada trae tiempos, avisos y los datos de la parada.
        const { tiempos, avisos: nuevos, info } = await getLlegadas(parada.stopCode, {
          avisos: true,
          info: true,
        });
        if (!mounted.current) {
          return;
        }
        setTimes(tiempos);
        setAvisos(nuevos);
        setError('');
        if (info) {
          setParada((prev) => ({
            ...prev,
            stopName: info.stopName ?? prev.stopName,
            lineasPaso: info.lineasPaso ?? prev.lineasPaso,
          }));
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

  // Otras paradas alrededor de esta (para caminar a una alternativa).
  useEffect(() => {
    let active = true;
    getStopsAroundStop(parada.stopCode, CERCANAS_RADIO)
      .then((r) => active && setCercanas(r.slice(0, 8)))
      .catch(() => {
        // no crítico
      });
    return () => {
      active = false;
    };
  }, [parada.stopCode]);

  const fav = isFavorite(parada.stopCode);
  const lineasParada = parseLineasPaso(parada.lineasPaso, 40);

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

      {avisos.length > 0 && (
        <View style={styles.avisoBox}>
          <Text style={styles.avisoHeader} accessibilityRole="header">
            ⚠️ Avisos ({avisos.length})
          </Text>
          {avisos.map((a, i) => (
            <View
              key={i}
              style={styles.avisoItem}
              accessible
              accessibilityLabel={`Aviso: ${a.titulo}${a.descripcion ? `. ${a.descripcion}` : ''}`}
            >
              <Text style={styles.avisoTitulo}>{a.titulo}</Text>
              {a.descripcion ? (
                <Text style={styles.avisoTexto} numberOfLines={6}>
                  {a.descripcion}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

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

      {lineasParada.length > 0 && (
        <>
          <Text style={styles.sectionHeader} accessibilityRole="header">
            Líneas en esta parada
          </Text>
          <View
            style={styles.chips}
            accessible
            accessibilityLabel={`Líneas que pasan por esta parada: ${lineasParada
              .map(prettyLinea)
              .join(', ')}`}
          >
            {lineasParada.map((core) => (
              <View key={core} style={styles.chip}>
                <Text style={styles.chipText}>{core}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {cercanas.length > 0 && (
        <>
          <Text style={styles.sectionHeader} accessibilityRole="header">
            Otras paradas cerca
          </Text>
          <View style={styles.card}>
            {cercanas.map(({ parada: p, meters }, i) => (
              <Pressable
                key={p.stopCode}
                style={[styles.nearRow, i < cercanas.length - 1 && styles.divider]}
                onPress={() => navigation.push('Parada', { parada: p })}
                accessibilityRole="button"
                accessibilityLabel={`${p.stopName}, a ${formatDistance(meters)}. Parada ${p.stopCode}.`}
                accessibilityHint="Toca dos veces para ver sus tiempos"
              >
                <View style={styles.nearText}>
                  <Text style={styles.nearName}>{p.stopName}</Text>
                  <Text style={styles.nearMeta}>
                    {formatDistance(meters)}
                    {p.lineasPaso ? ` · ${p.lineasPaso}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
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
  avisoBox: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e0a33e',
    padding: 12,
    gap: 8,
  },
  avisoHeader: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  avisoItem: { gap: 2 },
  avisoTitulo: { color: theme.textStrong, fontSize: 15, fontWeight: '600' },
  avisoTexto: { color: theme.textMuted, fontSize: 13, lineHeight: 18 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: theme.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  chipText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  nearRow: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  nearText: { gap: 2 },
  nearName: { color: theme.textStrong, fontSize: 16, fontWeight: '600' },
  nearMeta: { color: theme.textMuted, fontSize: 13 },
});
