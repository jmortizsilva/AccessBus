import * as TaskManager from 'expo-task-manager';
import { LocationObject } from 'expo-location';
import { procesarUbicacion, TASK_SEGUIMIENTO } from './seguimientoViaje';

/**
 * `defineTask` debe ejecutarse en el ámbito global del módulo (importado desde
 * `index.ts` antes de `registerRootComponent`), no dentro de un componente: si
 * iOS relanza el JS en segundo plano para entregar una ubicación, no monta `App`,
 * así que la tarea tiene que quedar registrada igualmente.
 */
TaskManager.defineTask(TASK_SEGUIMIENTO, async ({ data, error }) => {
  if (error) {
    return;
  }
  const { locations } = (data ?? {}) as { locations?: LocationObject[] };
  const ultima = locations?.[locations.length - 1];
  if (ultima) {
    await procesarUbicacion({ lat: ultima.coords.latitude, lon: ultima.coords.longitude });
  }
});
