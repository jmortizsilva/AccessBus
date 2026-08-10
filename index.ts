import { registerRootComponent } from 'expo';

// Registra la tarea de seguimiento de parada ANTES de montar App: si iOS
// relanza el JS en segundo plano para entregar una ubicación, no monta ningún
// componente, así que defineTask tiene que ejecutarse igualmente aquí arriba.
import './src/services/tareaSeguimiento';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
