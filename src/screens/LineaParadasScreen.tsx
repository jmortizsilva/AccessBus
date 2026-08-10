import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useParadaActions } from '../hooks/useParadaActions';
import { LineasStackParamList } from '../navigation/types';
import { getHorariosLinea, getStopsLinea, HorarioLinea } from '../services/emt';
import { iniciarViaje } from '../services/seguimientoViaje';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { enlacesDeParada } from '../data/red';
import { Parada } from '../types';
import { haversineMeters } from '../utils/distance';
import { parseLineasPaso } from '../utils/lineas';

type Nav = NativeStackNavigationProp<LineasStackParamList, 'LineaParadas'>;

export default function LineaParadasScreen() {
  const route = useRoute<RouteProp<LineasStackParamList, 'LineaParadas'>>();
  const navigation = useNavigation<Nav>();
  const { linea, sentido: sentidoPedido } = route.params;
  const {
    lineas,
    diaServicio,
    isFavoriteLinea,
    toggleFavoriteLinea,
    currentLocation,
    viajeActivo,
    refrescarViaje,
    cancelarViaje,
  } = useApp();
  const [seleccionandoBajada, setSeleccionandoBajada] = useState(false);
  const [horarios, setHorarios] = useState<HorarioLinea[]>([]);
  // Los horarios ocupan mucho; se muestran plegados tras un botón.
  const [mostrarHorarios, setMostrarHorarios] = useState(false);

  // Las paradas traen IDs internos de línea; este mapa los traduce a etiquetas
  // públicas para que las acciones de rotor puedan consultar cada línea.
  const labelById = useMemo(() => Object.fromEntries(lineas.map((l) => [l.id, l.lin])), [lineas]);

  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentido, setSentido] = useState<1 | 2>(sentidoPedido ?? 1);

  // Cabecera unificada dentro de la pantalla; la barra de navegación se deja sin
  // título para no repetir "Línea E1" dos veces.
  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const tituloLinea = `Línea ${linea.lin}${linea.descripcion ? ` - ${linea.descripcion}` : ''}`;

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

  // Correspondencias de cada parada, con el sentido real ("hacia Embajadores"),
  // desde el índice de red precalculado. Si una parada no estuviera en el índice
  // (red modificada desde que se generó), se cae a las líneas que dio la API.
  const enlacesDe = useCallback(
    (parada: Parada): Enlace[] => {
      const delIndice = enlacesDeParada(parada.stopCode, linea.lin);
      if (delIndice.length > 0) {
        return delIndice;
      }
      return parseLineasPaso(parada.lineasPaso, 40)
        .filter((lin) => lin !== linea.lin)
        .map((lin) => ({ lin }));
    },
    [linea.lin],
  );

  const destino = paradas.length > 0 ? paradas[paradas.length - 1].stopName : undefined;

  const viajeDeEstaLinea =
    viajeActivo?.estado === 'activo' &&
    viajeActivo.lin === linea.lin &&
    viajeActivo.dir === sentido;

  // La parada de subida no se pregunta: se toma la más cercana a la ubicación
  // actual dentro del propio recorrido, que es donde el usuario está de verdad.
  const elegirBajada = useCallback(
    async (bajada: Parada) => {
      setSeleccionandoBajada(false);
      if (!currentLocation) {
        Alert.alert(
          'Ubicación necesaria',
          'Necesito tu ubicación actual para saber desde qué parada empiezas. Actualízala en Inicio e inténtalo de nuevo.',
        );
        return;
      }
      let origen = paradas[0];
      let mejorDistancia = Infinity;
      for (const p of paradas) {
        if (p.lat === undefined || p.lon === undefined) {
          continue;
        }
        const d = haversineMeters(currentLocation.lat, currentLocation.lon, p.lat, p.lon);
        if (d < mejorDistancia) {
          mejorDistancia = d;
          origen = p;
        }
      }
      const resultado = await iniciarViaje({
        linea,
        dir: sentido,
        secuencia: paradas,
        origen,
        bajada,
      });
      if (resultado.ok) {
        await refrescarViaje();
        Alert.alert('Aviso activado', `Te avisaré cuando te acerques a ${bajada.stopName}.`);
      } else {
        Alert.alert('No se ha podido activar el aviso', resultado.motivo ?? 'Inténtalo de nuevo.');
      }
    },
    [currentLocation, paradas, linea, sentido, refrescarViaje],
  );

  const handleAvisarPress = () => {
    if (seleccionandoBajada) {
      setSeleccionandoBajada(false);
      return;
    }
    if (viajeDeEstaLinea) {
      Alert.alert(
        'Aviso de parada activo',
        `Te avisaré cuando te acerques a ${viajeActivo!.destinoNombre}.`,
        [
          { text: 'Seguir avisando', style: 'cancel' },
          { text: 'Cancelar aviso', style: 'destructive', onPress: () => void cancelarViaje() },
        ],
      );
      return;
    }
    if (viajeActivo?.estado === 'activo') {
      Alert.alert(
        'Ya hay un viaje en curso',
        `Estás siguiendo la línea ${viajeActivo.lin} hasta ${viajeActivo.destinoNombre}. ¿Sustituirlo por esta línea?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sustituir', onPress: () => setSeleccionandoBajada(true) },
        ],
      );
      return;
    }
    setSeleccionandoBajada(true);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      accessibilityLabel={`Paradas de la línea ${linea.lin}`}>
      <Text style={styles.header} accessibilityRole="header">
        {tituloLinea}
      </Text>

      <Pressable
        style={[styles.seguirButton, isFavoriteLinea(linea.lin) && styles.seguirActivo]}
        onPress={() => void toggleFavoriteLinea(linea.lin)}
        accessibilityRole="button"
        accessibilityState={{ selected: isFavoriteLinea(linea.lin) }}
        accessibilityLabel={
          isFavoriteLinea(linea.lin)
            ? `Dejar de seguir la línea ${linea.lin}`
            : `Seguir la línea ${linea.lin}`
        }
        accessibilityHint="Las líneas seguidas te avisan de sus incidencias">
        <Text style={styles.seguirText}>
          {isFavoriteLinea(linea.lin) ? '🔔 Siguiendo esta línea' : '🔕 Seguir esta línea'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.avisarButton,
          (seleccionandoBajada || viajeDeEstaLinea) && styles.avisarActivo,
        ]}
        onPress={handleAvisarPress}
        accessibilityRole="button"
        accessibilityState={{ selected: seleccionandoBajada || viajeDeEstaLinea }}
        accessibilityLabel={
          seleccionandoBajada
            ? 'Cancelar selección de parada de bajada'
            : viajeDeEstaLinea
              ? 'Aviso de parada de bajada activo'
              : 'Avisarme al bajar'
        }
        accessibilityHint={
          seleccionandoBajada
            ? 'Toca una parada de la lista para elegir dónde bajarte'
            : viajeDeEstaLinea
              ? 'Toca dos veces para cancelar el aviso'
              : 'Elige en qué parada quieres que te avisemos, incluso con la app en segundo plano'
        }>
        <Text style={styles.avisarText}>
          {seleccionandoBajada
            ? '❌ Elige una parada de la lista'
            : viajeDeEstaLinea
              ? '🔔 Avisando al bajar'
              : '🔔 Avisarme al bajar'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.sentidoButton}
        onPress={() => setSentido((s) => (s === 1 ? 2 : 1))}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar sentido. Ahora: sentido ${sentido}${destino ? `, hacia ${destino}` : ''}`}
        accessibilityHint="Toca dos veces para ver el otro sentido">
        <Text style={styles.sentidoText}>
          🔁 Sentido {sentido}
          {destino ? ` · hacia ${destino}` : ''}
        </Text>
      </Pressable>

      {horariosOrdenados.length > 0 && (
        <View style={styles.horarioBox}>
          {/*
            El estado va en accessibilityValue (español, controlado por nosotros), NO
            en accessibilityState.expanded: en RN 0.81 Fabric ese estado añade el literal
            "expanded" en inglés (RCTViewComponentView.mm usa RCTLocalizedString con una
            clave que ni siquiera está traducida en es.lproj) y además no existe el caso
            "collapsed". Así VoiceOver anuncia "Contraído"/"Expandido" en ambos estados.
          */}
          <Pressable
            style={styles.horarioToggle}
            onPress={() => setMostrarHorarios((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Horarios y frecuencias"
            accessibilityValue={{ text: mostrarHorarios ? 'Expandido' : 'Contraído' }}
            accessibilityHint={
              mostrarHorarios ? 'Toca dos veces para contraer' : 'Toca dos veces para expandir'
            }>
            <Text style={styles.horarioHeader}>Horarios y frecuencias</Text>
            <Text style={styles.horarioChevron}>{mostrarHorarios ? '▲' : '▼'}</Text>
          </Pressable>
          {mostrarHorarios &&
            horariosOrdenados.map((h) => (
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
                      accessibilityLabel={`${h.etiqueta}, sentido ${s}: ${detalle}`}>
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
              enlaces={enlacesDe(parada)}
              modoSeleccion={seleccionandoBajada}
              onOpen={() =>
                seleccionandoBajada
                  ? void elegirBajada(parada)
                  : navigation.navigate('Parada', { parada })
              }
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

interface Enlace {
  lin: string;
  destino?: string;
}

/** Cuántos enlaces se detallan con su destino antes de resumir el resto. */
const ENLACES_DETALLADOS = 5;

/** Texto hablado de las correspondencias, evitando que sea interminable. */
function hablarEnlaces(enlaces: Enlace[]): string {
  if (enlaces.length === 0) {
    return '';
  }
  const detallados = enlaces
    .slice(0, ENLACES_DETALLADOS)
    .map((e) => `línea ${e.lin}${e.destino ? ` hacia ${e.destino}` : ''}`)
    .join('; ');
  const resto = enlaces.slice(ENLACES_DETALLADOS);
  const cola = resto.length > 0 ? `; y ${resto.length} líneas más` : '';
  return ` Enlace con ${detallados}${cola}.`;
}

function LineaParadaRow({
  parada,
  order,
  isLast,
  enlaces,
  onOpen,
  modoSeleccion,
}: {
  parada: Parada;
  order: number;
  isLast: boolean;
  enlaces: Enlace[];
  onOpen: () => void;
  modoSeleccion?: boolean;
}) {
  const { accessibilityActions, onAccessibilityAction, fav } = useParadaActions(parada, onOpen);
  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${parada.stopName}.${hablarEnlaces(enlaces)}${fav ? ' En favoritos.' : ''}`}
      accessibilityHint={
        modoSeleccion
          ? 'Toca dos veces para avisarte cuando bajes aquí'
          : 'Toca dos veces para abrir. En el rotor de acciones tienes el tiempo de cada línea.'
      }
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}>
      <View style={styles.orderBadge} importantForAccessibility="no">
        <Text style={styles.orderText}>{order}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {parada.stopName}
          {fav ? ' ★' : ''}
        </Text>
        <Text style={styles.rowMeta}>Parada {parada.stopCode}</Text>
        {enlaces.length > 0 ? (
          <Text style={styles.enlaces} numberOfLines={2}>
            Enlaces: {enlaces.map((e) => e.lin).join(', ')}
          </Text>
        ) : null}
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
  seguirButton: {
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  seguirActivo: { backgroundColor: theme.primaryDark, borderColor: theme.primary },
  seguirText: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  avisarButton: {
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avisarActivo: { backgroundColor: theme.primaryDark, borderColor: theme.primary },
  avisarText: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  horarioBox: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  horarioToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  horarioHeader: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  horarioChevron: { color: theme.textMuted, fontSize: 14 },
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
  enlaces: { color: theme.text, fontSize: 13, marginTop: 2 },
});
