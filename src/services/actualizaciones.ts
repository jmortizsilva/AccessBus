import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert, AppState } from 'react-native';

/**
 * Actualizaciones por aire (OTA) con expo-updates.
 *
 * `runtimeVersion` es FIJO (a mano en app.json), no huella: en Windows la huella
 * deriva y el update se ignora en silencio (ver GUIA-ENTORNO-IOS). El precio es
 * que la regla pasa a ser manual: si se toca algo nativo (subir de SDK, añadir un
 * módulo, cambiar permisos) hay que subir ese número y recompilar; por aire solo
 * va JavaScript.
 *
 * El flujo está pensado para ser accesible (probado el patrón en otras apps): no
 * descargar en silencio, sino preguntar con un Alert y anunciar por voz cada paso.
 */

/**
 * Novedades de ESTA versión del bundle. Vive en el bundle a propósito: tras
 * `reloadAsync()` corre el bundle nuevo, así que esta constante ya es la suya.
 * Hay que actualizarla en CADA `eas update`: es lo que lee el usuario.
 */
export const NOVEDADES = [
  'Buscar paradas por nombre, ahora completo y sin conexión.',
  'En cada parada, los próximos autobuses y las líneas que pasan van juntos.',
  'Las líneas aparecen en orden lógico, y el buscador tiene botón Cancelar.',
  'En el rotor de una parada, cada línea dice hacia dónde va.',
  'Al abrir una línea, sus horarios se despliegan solo si los pides.',
  'Al confirmar una acción: un aviso breve, con voz y una pequeña vibración.',
  'Con VoiceOver, la barra de pestañas solo dice "seleccionada" en la pestaña activa.',
];

const CLAVE_ULTIMO_ID = 'actualizaciones.ultimoUpdateId';

// Solo `queue`: es la palanca que funciona en todas las versiones de RN. Desde la
// 0.86 el nativo también reenvía `priority` (iOS 17+), pero aquí no se usa todavía
// (ver GUIA-ACCESIBILIDAD-RN). Con `inmediato` (queue:false) el anuncio se lee ya,
// saltando la cola, que es lo más parecido a "no lo pierdas".
function anunciar(mensaje: string, inmediato = false): void {
  AccessibilityInfo.announceForAccessibilityWithOptions(mensaje, { queue: !inmediato });
}

/**
 * Comprueba si hay actualización y, si la hay, pregunta antes de descargar y
 * reiniciar. Con `manual=true` avisa también cuando NO hay nada (para el botón
 * "Buscar actualizaciones"). En desarrollo, expo-updates no está activo.
 */
export async function comprobarActualizacion(manual = false): Promise<void> {
  if (!Updates.isEnabled) {
    if (manual) {
      Alert.alert('Actualizaciones', 'No están disponibles en esta versión de desarrollo.');
    }
    return;
  }
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) {
      if (manual) {
        anunciar('No hay actualizaciones. Ya tienes la última versión.', true);
        Alert.alert('Todo al día', 'Ya tienes la última versión.');
      }
      return;
    }
    Alert.alert(
      'Nueva versión disponible',
      'La app se reiniciará para instalarla. ¿Instalar ahora?',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Instalar',
          onPress: async () => {
            try {
              anunciar('Descargando la actualización…', true);
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            } catch {
              anunciar('No se pudo actualizar.', true);
              Alert.alert('No se pudo actualizar', 'Inténtalo de nuevo más tarde.');
            }
          },
        },
      ],
    );
  } catch {
    if (manual) {
      Alert.alert('No se pudo comprobar', 'Inténtalo de nuevo más tarde.');
    }
  }
}

/**
 * Tras actualizar, muestra las novedades UNA vez. Compara el updateId actual con
 * el último guardado; en la primera instalación solo memoriza, sin avisar.
 */
async function mostrarNovedadesSiCambio(): Promise<void> {
  if (!Updates.isEnabled) {
    return;
  }
  try {
    const actual = Updates.updateId ?? 'embedded';
    const guardado = await AsyncStorage.getItem(CLAVE_ULTIMO_ID);
    if (guardado === null) {
      await AsyncStorage.setItem(CLAVE_ULTIMO_ID, actual);
      return;
    }
    if (guardado !== actual) {
      await AsyncStorage.setItem(CLAVE_ULTIMO_ID, actual);
      Alert.alert('Novedades', NOVEDADES.map((n) => `• ${n}`).join('\n'));
    }
  } catch {
    // no crítico
  }
}

/**
 * Engancha la comprobación al ciclo de vida: al abrir y cada vez que la app
 * vuelve a primer plano (el disparador fiable del diálogo). Un flag evita que
 * dos comprobaciones se solapen.
 */
export function useActualizaciones(): void {
  const comprobando = useRef(false);

  useEffect(() => {
    const comprobar = async (manual = false) => {
      if (comprobando.current) {
        return;
      }
      comprobando.current = true;
      try {
        await comprobarActualizacion(manual);
      } finally {
        comprobando.current = false;
      }
    };

    void mostrarNovedadesSiCambio().then(() => comprobar());

    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        void comprobar();
      }
    });
    return () => sub.remove();
  }, []);
}
