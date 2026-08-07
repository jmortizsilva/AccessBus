import { useCallback, useMemo } from 'react';
import { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';
import { Enlace, lineasDeParada } from '../data/red';
import { useApp } from '../state/AppContext';
import { Parada } from '../types';
import { announceTiempoLinea, parseLineasPaso, prettyLinea } from '../utils/lineas';

/**
 * Acciones de rotor de VoiceOver unificadas para una fila de parada (favoritas,
 * cercanas y paradas de una línea). Convención:
 *  - "Activar" (acción por defecto de VoiceOver) → abre la parada (via onPress).
 *  - Una acción por cada línea, indicando su destino ("Línea 5 hacia Chamartín")
 *    → consulta y anuncia su tiempo en vivo.
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

    // Una acción por línea, con su destino. Preferimos el índice precalculado
    // (da hacia dónde va cada línea); si la parada no estuviera en él, caemos a
    // las etiquetas de la API, sin destino.
    const enlaces = lineasDeParada(parada.stopCode);
    const porLinea =
      enlaces.length > 0
        ? destinosPorLinea(enlaces)
        : lineas.map((lin) => ({ lin, destinos: [] as string[] }));

    porLinea.forEach(({ lin, destinos }) => {
      const hacia = destinos.length > 0 ? ` hacia ${destinos.join(' o ')}` : '';
      const name = `${prettyLinea(lin)}${hacia}`;
      actions.push({ name, label: name });
      map.set(name, () => void announceTiempoLinea(parada, lin));
    });

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

/**
 * Agrupa los enlaces por línea, conservando el orden de aparición y los destinos
 * únicos. Una línea puede pasar en los dos sentidos por la misma parada; en ese
 * caso se juntan sus destinos ("hacia A o B").
 */
function destinosPorLinea(enlaces: Enlace[]): { lin: string; destinos: string[] }[] {
  const orden: string[] = [];
  const mapa = new Map<string, string[]>();
  for (const { lin, destino } of enlaces) {
    let destinos = mapa.get(lin);
    if (!destinos) {
      destinos = [];
      mapa.set(lin, destinos);
      orden.push(lin);
    }
    if (destino && !destinos.includes(destino)) {
      destinos.push(destino);
    }
  }
  return orden.map((lin) => ({ lin, destinos: mapa.get(lin) ?? [] }));
}
