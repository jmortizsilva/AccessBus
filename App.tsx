import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
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
            tabBarStyle={{ backgroundColor: theme.card }}
            tabBarActiveTintColor={theme.primary}
            tabBarInactiveTintColor={theme.textMuted}>
            <Tab.Screen
              name="Inicio"
              component={InicioStack}
              options={{
                tabBarLabel: 'Inicio',
                tabBarIcon: () => ({ sfSymbol: 'star.fill' }),
              }}
            />
            <Tab.Screen
              name="Lineas"
              component={LineasStack}
              options={{
                tabBarLabel: 'Líneas',
                tabBarIcon: () => ({ sfSymbol: 'bus.fill' }),
              }}
            />
            <Tab.Screen
              name="Buscar"
              component={BuscarStack}
              options={{
                tabBarLabel: 'Buscar',
                tabBarIcon: () => ({ sfSymbol: 'magnifyingglass' }),
                role: 'search',
              }}
            />
            <Tab.Screen
              name="Ajustes"
              component={AjustesScreen}
              options={{
                tabBarLabel: 'Ajustes',
                tabBarIcon: () => ({ sfSymbol: 'gearshape.fill' }),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <Aviso />
      </AppProvider>
    </SafeAreaProvider>
  );
}
