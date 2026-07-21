import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BuscarScreen from '../screens/BuscarScreen';
import ParadaScreen from '../screens/ParadaScreen';
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
      }}
    >
      <Stack.Screen name="BuscarHome" component={BuscarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Parada" component={ParadaScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
