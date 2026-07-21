import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useParadaActions } from '../hooks/useParadaActions';
import { theme } from '../theme';
import { Parada } from '../types';

interface Props {
  parada: Parada;
  onOpen: () => void;
  distanceText?: string;
  isLast?: boolean;
}

/**
 * Fila de parada usada en Inicio (favoritas y cercanas). Es un botón normal:
 * doble toque abre la parada, y las acciones del rotor consultan el tiempo en vivo
 * de cada línea o gestionan el favorito (ver useParadaActions).
 */
export default function ParadaRow({ parada, onOpen, distanceText, isLast = false }: Props) {
  const { accessibilityActions, onAccessibilityAction, fav } = useParadaActions(parada, onOpen);

  return (
    <Pressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        `${parada.stopName}. Parada ${parada.stopCode}.` +
        (distanceText ? ` A ${distanceText}.` : '') +
        (fav ? ' En favoritos.' : '')
      }
      accessibilityHint="Toca dos veces para abrir. En el rotor de acciones tienes el tiempo de cada línea."
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <View style={styles.main}>
        <Text style={styles.name}>
          {parada.stopName}
          {fav ? ' ★' : ''}
        </Text>
        <Text style={styles.meta}>
          Parada {parada.stopCode}
          {distanceText ? ` · ${distanceText}` : ''}
        </Text>
        {parada.lineasPaso ? (
          <Text style={styles.lineas} numberOfLines={1}>
            {parada.lineasPaso}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  main: { gap: 2 },
  name: { color: theme.textStrong, fontSize: 17, fontWeight: '600' },
  meta: { color: theme.textMuted, fontSize: 13 },
  lineas: { color: theme.text, fontSize: 13, marginTop: 2 },
});
