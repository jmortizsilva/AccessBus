import { useCallback, useMemo } from 'react';
import { AccessibilityActionEvent, AccessibilityActionInfo, AccessibilityInfo } from 'react-native';
import { lineasDeParada } from '../data/red';
import { useApp } from '../state/AppContext';
import { Parada } from '../types';
import { announceTiempoLinea, parseLineasPaso, prettyLinea } from '../utils/lineas';

/**
 * Acciones de rotor de VoiceOver unificadas para una fila de parada (favoritas,
 * cercanas y paradas de una línea). Convención:
 *  - "Activar" (acción por defecto de VoiceOver) → abre la parada (via onPress).
 *  - Una acción por cada línea → consulta y anuncia su tiempo en vivo.
 *  - Una acción para añadir/quitar de favoritos.
 *
 * Importante: en iOS, VoiceOver anuncia el `name` de la acción, no el `label`.
 * Por eso el texto legible se pone en el propio `name` y despachamos por ese texto.
 */
export function useParadaActions(parada: Parada, onOpen: () => void) {
  const { isFavorite, addFavorite, removeFavorite } = useApp();
  const fav = isFavorite(parada.stopCode);
  const lineas = useMemo(() => parseLineasPaso(parada.lineasPaso), [parada.lineasPaso]);

  const { accessibilityActions, handlers } = useMemo(() => {
    const actions: AccessibilityActionInfo[] = [];
    const map = new Map<string, () => void>();

    lineas.forEach((core) => {
      const name = prettyLinea(core);
      actions.push({ name, label: name });
      map.set(name, () => void announceTiempoLinea(parada, core));
    });

    // Lectura completa de las correspondencias: en paradas con muchas líneas
    // (Cibeles tiene 20) la etiqueta se resume, así que esta acción permite
    // escucharlas todas con su destino sin entrar en la parada.
    const enlaces = lineasDeParada(parada.stopCode);
    if (enlaces.length > 0) {
      const nombre = `Líneas de la parada (${enlaces.length})`;
      actions.push({ name: nombre, label: nombre });
      map.set(nombre, () => {
        const texto = enlaces.map((e) => `${prettyLinea(e.lin)} hacia ${e.destino}`).join('. ');
        AccessibilityInfo.announceForAccessibility(`${parada.stopName}. ${texto}`);
      });
    }

    const favName = fav ? 'Quitar de favoritos' : 'Añadir a favoritos';
    actions.push({ name: favName, label: favName });
    map.set(favName, () => {
      if (fav) {
        void removeFavorite(parada.stopCode);
      } else {
        void addFavorite(parada);
      }
    });

    return { accessibilityActions: actions, handlers: map };
  }, [lineas, fav, parada, addFavorite, removeFavorite]);

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'activate') {
        onOpen();
        return;
      }
      handlers.get(name)?.();
    },
    [handlers, onOpen],
  );

  return { accessibilityActions, onAccessibilityAction, fav, lineas };
}
