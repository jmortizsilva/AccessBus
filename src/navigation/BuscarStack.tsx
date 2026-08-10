import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BuscarScreen from '../screens/BuscarScreen';
import LineaParadasScreen from '../screens/LineaParadasScreen';
import ParadaScreen from '../screens/ParadaScreen';
import RutaABScreen from '../screens/RutaABScreen';
import RutaABResultadoScreen from '../screens/RutaABResultadoScreen';
import { theme } from '../theme';
import { BuscarStackParamList } from './types';

const Stack = createNativeStackNavigator<BuscarStackParamList>();

export default function BuscarStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textStrong,
        headerTitleStyle: { color: theme.textStrong },
        contentStyle: { backgroundColor: theme.bg },
        headerBackTitle: 'Atrás',
      }}>
      <Stack.Screen name="BuscarHome" component={BuscarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RutaAB" component={RutaABScreen} options={{ title: 'Planificar ruta' }} />
      <Stack.Screen
        name="RutaABResultado"
        component={RutaABResultadoScreen}
        options={{ title: 'Opciones de ruta' }}
      />
      <Stack.Screen name="Parada" component={ParadaScreen} options={{ title: '' }} />
      <Stack.Screen name="LineaParadas" component={LineaParadasScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
