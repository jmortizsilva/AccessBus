import { DarkTheme, NavigationContainer } from '@react-navigation/native';
// Pestañas nativas de React Navigation, servidas por react-native-screens. Sustituyen a
// react-native-bottom-tabs, que en iOS 26/27 dejaba a VoiceOver diciendo "seleccionada" en
// todas las pestañas ya visitadas cuando llevan icono: reasignaba las imágenes de cada
// UITabBarItem en cada pasada de layout (callstack/react-native-bottom-tabs#590).
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Aviso from './src/components/Aviso';
import BuscarStack from './src/navigation/BuscarStack';
import InicioStack from './src/navigation/InicioStack';
import LineasStack from './src/navigation/LineasStack';
import { TabParamList } from './src/navigation/types';
import AjustesScreen from './src/screens/AjustesScreen';
import { useActualizaciones } from './src/services/actualizaciones';
import { AppProvider } from './src/state/AppContext';
import { theme } from './src/theme';

const Tab = createNativeBottomTabNavigator<TabParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg,
    card: theme.card,
    border: theme.border,
    primary: theme.primary,
    text: theme.text,
  },
};

export default function App() {
  useActualizaciones();
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={navigationTheme}>
          <Tab.Navigator
            screenOptions={{
              // El fondo solo se aplica hasta iOS 18; en 26 y 27 manda el cristal del sistema.
              tabBarStyle: { backgroundColor: theme.card },
              tabBarActiveTintColor: theme.primary,
              tabBarInactiveTintColor: theme.textMuted,
            }}>
            <Tab.Screen
              name="Inicio"
              component={InicioStack}
              options={{
                tabBarLabel: 'Inicio',
                tabBarIcon: { type: 'sfSymbol', name: 'star.fill' },
              }}
            />
            <Tab.Screen
              name="Lineas"
              component={LineasStack}
              options={{
                tabBarLabel: 'Líneas',
                tabBarIcon: { type: 'sfSymbol', name: 'bus.fill' },
              }}
            />
            <Tab.Screen
              name="Buscar"
              component={BuscarStack}
              options={{
                // El elemento de sistema trae la lupa y, en iOS 26 y posteriores, coloca la
                // pestaña aparte, junto a la barra. La etiqueta propia sustituye a la del
                // sistema, que saldría según el idioma del dispositivo.
                tabBarSystemItem: 'search',
                tabBarLabel: 'Buscar',
              }}
            />
            <Tab.Screen
              name="Ajustes"
              component={AjustesScreen}
              options={{
                tabBarLabel: 'Ajustes',
                tabBarIcon: { type: 'sfSymbol', name: 'gearshape.fill' },
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <Aviso />
      </AppProvider>
    </SafeAreaProvider>
  );
}
