import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InicioHomeScreen from '../screens/InicioHomeScreen';
import LineaParadasScreen from '../screens/LineaParadasScreen';
import ParadaScreen from '../screens/ParadaScreen';
import { theme } from '../theme';
import { InicioStackParamList } from './types';

const Stack = createNativeStackNavigator<InicioStackParamList>();

export default function InicioStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textStrong,
        headerTitleStyle: { color: theme.textStrong },
        contentStyle: { backgroundColor: theme.bg },
        headerBackTitle: 'Atrás',
      }}
    >
      <Stack.Screen name="InicioHome" component={InicioHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Parada" component={ParadaScreen} options={{ title: '' }} />
      <Stack.Screen name="LineaParadas" component={LineaParadasScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
