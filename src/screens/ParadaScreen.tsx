import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, getLlegadas } from '../services/emt';
import { asegurarPermisoNotificaciones, avisar } from '../services/notificaciones';
import { lineasDeParada, sentidoDeLinea } from '../data/red';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { Linea, Parada, Tiempo } from '../types';
import { parseLineasPaso } from '../utils/lineas';
import { spokenTiempo } from '../utils/tiempos';

type ParadaParams = { Parada: { parada: Parada } };
type Nav = NativeStackNavigationProp<{
  Parada: { parada: Parada };
  LineaParadas: { linea: Linea; sentido?: 1 | 2 };
}>;

const AUTO_REFRESH_MS = 30_000;
const VIGILANCIA_MS = 20_000;

export default function ParadaScreen() {
  const route = useRoute<RouteProp<ParadaParams, 'Parada'>>();
  const navigation = useNavigation<Nav>();
  const { isFavorite, addFavorite, removeFavorite, umbralMin, lineas } = useApp();

  const [parada, setParada] = useState<Parada>(route.params.parada);
  const [times, setTimes] = useState<Tiempo[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vigilando, setVigilando] = useState(false);
  const mounted = useRef(true);
  // Líneas ya avisadas en esta sesión de vigilancia, para no repetir el aviso
  // en cada refresco mientras el autobús sigue por debajo del umbral.
  const avisadas = useRef<Set<string>>(new Set());
  const vigilandoRef = useRef(false);
  vigilandoRef.current = vigilando;

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
        const {
          tiempos,
          avisos: nuevos,
          info,
        } = await getLlegadas(parada.stopCode, {
          avisos: true,
          info: true,
        });
        if (!mounted.current) {
          return;
        }
        setTimes(tiempos);
        setAvisos(nuevos);
        setError('');

        // Vigilancia: avisa cuando una línea baja del umbral configurado.
        if (vigilandoRef.current) {
          for (const t of tiempos) {
            if (t.minutos === undefined || t.minutos > umbralMin) {
              avisadas.current.delete(t.linea);
              continue;
            }
            if (avisadas.current.has(t.linea)) {
              continue;
            }
            avisadas.current.add(t.linea);
            void avisar(
              `Línea ${t.linea} llegando`,
              `${parada.stopName}: ${t.minutos <= 0 ? 'está en la parada' : `llega en ${t.minutos} min`}` +
                (t.destino ? `, hacia ${t.destino}` : ''),
            );
          }
        }
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
    [parada.stopCode, parada.stopName, umbralMin],
  );

  // Mientras se vigila conviene refrescar más a menudo.
  useEffect(() => {
    mounted.current = true;
    void load(false);
    const timer = setInterval(() => void load(true), vigilando ? VIGILANCIA_MS : AUTO_REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load, vigilando]);

  const fav = isFavorite(parada.stopCode);
  // Preferimos el índice precalculado, que además dice hacia dónde va cada línea.
  const delIndice = lineasDeParada(parada.stopCode);
  const lineasParada: { lin: string; destino?: string }[] =
    delIndice.length > 0
      ? delIndice
      : parseLineasPaso(parada.lineasPaso, 40).map((lin) => ({ lin }));

  // Líneas que pasan por la parada pero que ahora mismo no tienen paso próximo.
  // Se muestran bajo los tiempos (misma sección) para no duplicar el listado:
  // así se sabe qué líneas pasan y se puede abrir su recorrido, sin repetir.
  const conTiempo = new Set(times.map((t) => t.linea));
  const sinTiempo = lineasParada.filter((l) => !conTiempo.has(l.lin));

  // Abre el recorrido de una línea (por su etiqueta) en el sentido correcto.
  const abrirLinea = (lin: string) => {
    const linea = lineas.find((l) => l.lin === lin);
    if (linea) {
      navigation.navigate('LineaParadas', {
        linea,
        sentido: sentidoDeLinea(parada.stopCode, lin),
      });
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      accessibilityLabel={`Parada ${parada.stopName}`}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {parada.stopName} (parada {parada.stopCode})
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void load(false)}
          accessibilityRole="button"
          accessibilityLabel="Actualizar tiempos">
          <Text style={styles.secondaryText}>Actualizar</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, fav && styles.favActive]}
          onPress={() => (fav ? removeFavorite(parada.stopCode) : addFavorite(parada))}
          accessibilityRole="button"
          accessibilityLabel={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
          <Text style={styles.secondaryText}>{fav ? '★ En favoritos' : '☆ Favorito'}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.vigilarButton, vigilando && styles.vigilarActivo]}
        onPress={async () => {
          if (!vigilando && !(await asegurarPermisoNotificaciones())) {
            return;
          }
          avisadas.current.clear();
          setVigilando((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: vigilando }}
        accessibilityLabel={vigilando ? 'Dejar de vigilar esta parada' : 'Vigilar esta parada'}
        accessibilityHint={
          vigilando
            ? 'Se te está avisando cuando un autobús llega'
            : `Te avisará cuando un autobús esté a ${umbralMin} minutos o menos, con la app abierta`
        }>
        <Text style={styles.vigilarText}>
          {vigilando ? `🔔 Vigilando (aviso a ${umbralMin} min)` : '🔕 Vigilar esta parada'}
        </Text>
      </Pressable>
      {vigilando ? (
        <Text style={styles.note}>
          Mantén la app abierta. Te avisaré en cuanto una línea esté a {umbralMin} minutos o menos.
        </Text>
      ) : null}

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
            accessibilityLabel="Reintentar">
            <Text style={styles.secondaryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && times.length === 0 ? (
        <Text style={styles.note}>No hay autobuses próximos ahora mismo.</Text>
      ) : null}

      {times.map((t, index) => {
        // Al pulsar se abre el recorrido de esa línea, para seguir el viaje.
        const abrible = lineas.some((l) => l.lin === t.linea);
        return (
          <Pressable
            key={`${t.linea}-${index}`}
            style={styles.timeRow}
            onPress={abrible ? () => abrirLinea(t.linea) : undefined}
            disabled={!abrible}
            accessibilityRole={abrible ? 'button' : undefined}
            accessible
            accessibilityLabel={spokenTiempo(t)}
            accessibilityHint={
              abrible ? 'Toca dos veces para ver el recorrido de esta línea' : undefined
            }>
            <View style={styles.timeLeft}>
              <Text style={styles.timeLinea}>Línea {t.linea}</Text>
              {t.destino ? <Text style={styles.timeDest}>{t.destino}</Text> : null}
            </View>
            <View style={styles.timeRight}>
              <Text style={styles.timeMin}>{t.tiempoText || '—'}</Text>
              <Text style={styles.timeDist}>{t.distanciaText}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Líneas que también pasan por la parada pero sin paso próximo ahora.
          Van en la misma sección para no duplicar el listado de líneas. */}
      {sinTiempo.map((l, index) => {
        const abrible = lineas.some((x) => x.lin === l.lin);
        return (
          <Pressable
            key={`sin-${l.lin}-${index}`}
            style={styles.timeRow}
            onPress={abrible ? () => abrirLinea(l.lin) : undefined}
            disabled={!abrible}
            accessibilityRole={abrible ? 'button' : undefined}
            accessible
            accessibilityLabel={`Línea ${l.lin}${l.destino ? `, hacia ${l.destino}` : ''}. Sin paso próximo.`}
            accessibilityHint={
              abrible ? 'Toca dos veces para ver el recorrido de esta línea' : undefined
            }>
            <View style={styles.timeLeft}>
              <Text style={styles.timeLinea}>Línea {l.lin}</Text>
              {l.destino ? <Text style={styles.timeDest}>hacia {l.destino}</Text> : null}
            </View>
            <View style={styles.timeRight}>
              <Text style={styles.timeSin}>Sin próximos</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Los avisos van al final: primero lo útil (autobuses y líneas). */}
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
              accessibilityLabel={`Aviso: ${a.titulo}${a.descripcion ? `. ${a.descripcion}` : ''}`}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  header: { paddingTop: 8, gap: 4 },
  title: { color: theme.textStrong, fontSize: 26, fontWeight: '700' },
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
  vigilarButton: {
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  vigilarActivo: { backgroundColor: theme.primaryDark, borderColor: theme.primary },
  vigilarText: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
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
  timeSin: { color: theme.textMuted, fontSize: 15 },
});
