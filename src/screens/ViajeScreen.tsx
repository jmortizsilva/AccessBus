import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InicioStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { resumenViaje, tramoViaje } from '../utils/viaje';

/** Cada cuánto se relee el viaje: la posición la escribe la tarea de ubicación en AsyncStorage. */
const RELEER_MS = 5000;

type Nav = NativeStackNavigationProp<InicioStackParamList, 'Viaje'>;

export default function ViajeScreen() {
  const navigation = useNavigation<Nav>();
  const { viajeActivo, refrescarViaje, cancelarViaje } = useApp();
  const resumenRef = useRef<View>(null);

  // La lista cambia sin anunciarse: quien quiera saber por dónde va, la consulta.
  useFocusEffect(
    useCallback(() => {
      void refrescarViaje();
      const t = setInterval(() => void refrescarViaje(), RELEER_MS);
      return () => clearInterval(t);
    }, [refrescarViaje]),
  );

  // Foco al resumen cuando termina la animación de entrada: antes, iOS lo pisa
  // con el primer elemento de la pantalla nueva.
  useEffect(
    () =>
      navigation.addListener('transitionEnd', (e) => {
        if (!e.data.closing && resumenRef.current) {
          AccessibilityInfo.sendAccessibilityEvent(resumenRef.current, 'focus');
        }
      }),
    [navigation],
  );

  const terminar = async () => {
    await cancelarViaje();
    navigation.goBack();
  };

  if (!viajeActivo) {
    return (
      <View style={styles.screen}>
        <View ref={resumenRef} style={styles.content} accessible>
          <Text style={styles.resumen}>No hay ningún viaje en curso.</Text>
        </View>
      </View>
    );
  }

  const activo = viajeActivo.estado === 'activo';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View ref={resumenRef} accessible accessibilityLabel={resumenViaje(viajeActivo)}>
        <Text style={styles.resumen}>{resumenViaje(viajeActivo)}</Text>
      </View>

      <View style={styles.card}>
        {tramoViaje(viajeActivo).map((p) => (
          <Text
            key={p.parada.stopCode}
            style={[
              styles.parada,
              p.estado === 'pasada' && styles.paradaPasada,
              p.estado === 'actual' && styles.paradaActual,
            ]}>
            {p.texto}
          </Text>
        ))}
      </View>

      <Pressable
        style={styles.boton}
        onPress={() => void terminar()}
        accessibilityRole="button"
        accessibilityLabel={activo ? 'Cancelar aviso' : 'Descartar aviso'}>
        <Text style={styles.botonTexto}>{activo ? 'Cancelar aviso' : 'Descartar aviso'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 16 },
  resumen: { color: theme.textStrong, fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: theme.card, borderRadius: 16, paddingVertical: 4 },
  parada: {
    color: theme.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  paradaPasada: { color: theme.textMuted },
  paradaActual: { color: theme.primary, fontWeight: '700' },
  boton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: theme.card,
  },
  botonTexto: { color: theme.primary, fontSize: 16, fontWeight: '700' },
});
