import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';

/** Cuánto tiempo se ve el aviso antes de desvanecerse. */
const VISIBLE_MS = 2600;

/**
 * Aviso transitorio (toast) global que confirma una acción por TRES canales a la
 * vez, cada uno para un tipo de usuario:
 *  - Visual: una tarjeta que aparece arriba y se desvanece sola (para quien ve).
 *  - Voz: se anuncia por VoiceOver (para quien usa lector de pantalla).
 *  - Táctil: una pequeña vibración del Taptic Engine (éxito o aviso).
 *
 * Sustituye al texto fijo que antes quedaba clavado al fondo de la pantalla, justo
 * antes de la barra de pestañas, donde VoiceOver lo encontraba y no desaparecía.
 *
 * Se oculta del árbol de accesibilidad (`accessibilityElementsHidden`) porque su
 * contenido ya se anuncia a mano: si no, VoiceOver lo leería otra vez al pasar.
 */
export default function Aviso() {
  const { aviso, descartarAviso } = useApp();
  const insets = useSafeAreaInsets();
  const opacidad = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);

  useEffect(() => {
    if (!aviso) {
      return;
    }
    setVisible({ texto: aviso.texto, tipo: aviso.tipo });

    // Vibración y voz en cuanto llega el aviso.
    void Haptics.notificationAsync(
      aviso.tipo === 'error'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    ).catch(() => {
      // el hardware puede no soportarlo (simulador); no es crítico
    });
    AccessibilityInfo.announceForAccessibility(aviso.texto);

    // Aparece y, tras un momento, se desvanece y se limpia.
    Animated.timing(opacidad, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacidad, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => {
        setVisible(null);
        descartarAviso();
      });
    }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [aviso, opacidad, descartarAviso]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.contenedor,
        visible.tipo === 'error' ? styles.error : styles.exito,
        { top: insets.top + 8, opacity: opacidad },
      ]}>
      <Text style={[styles.texto, visible.tipo === 'error' && styles.textoError]} numberOfLines={3}>
        {visible.texto}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    // Sombra para que se despegue del contenido de detrás.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
  },
  exito: { backgroundColor: theme.primaryDark },
  error: { backgroundColor: theme.danger },
  texto: { color: theme.textStrong, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  textoError: { color: theme.dangerText },
});
