import * as Notifications from 'expo-notifications';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Notificaciones LOCALES (las lanza la propia app, no hay servidor).
 *
 * Se usan para dos cosas:
 *  - "Vigilar parada": avisar cuando un autobús está a punto de llegar, mientras
 *    la app está abierta (iOS no permite sondear en segundo plano de forma fiable
 *    con la frecuencia que exigiría un aviso "llega en 2 minutos").
 *  - Avisos de incidencias de las líneas favoritas, al abrir la app.
 *
 * Además de la notificación se hace un anuncio de VoiceOver, que llega al
 * instante aunque la app esté en primer plano.
 */

// Con la app en primer plano, iOS por defecto no muestra la notificación.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permisoPedido = false;

/** Pide permiso de notificaciones (una vez). Devuelve si están concedidas. */
export async function asegurarPermisoNotificaciones(): Promise<boolean> {
  try {
    const actual = await Notifications.getPermissionsAsync();
    if (actual.granted) {
      return true;
    }
    if (permisoPedido && !actual.canAskAgain) {
      return false;
    }
    permisoPedido = true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.granted;
  } catch {
    return false;
  }
}

/** Lanza una notificación local inmediata y la anuncia por VoiceOver. */
export async function avisar(titulo: string, cuerpo: string): Promise<void> {
  AccessibilityInfo.announceForAccessibility(`${titulo}. ${cuerpo}`);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: cuerpo,
        sound: true,
        interruptionLevel: Platform.OS === 'ios' ? 'timeSensitive' : undefined,
      },
      trigger: null,
    });
  } catch {
    // si falla la notificación, al menos queda el anuncio de VoiceOver
  }
}
