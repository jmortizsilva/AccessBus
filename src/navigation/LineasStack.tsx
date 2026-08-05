import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LineaParadasScreen from '../screens/LineaParadasScreen';
import LineasListScreen from '../screens/LineasListScreen';
import ParadaScreen from '../screens/ParadaScreen';
import { theme } from '../theme';
import { LineasStackParamList } from './types';

const Stack = createNativeStackNavigator<LineasStackParamList>();

export default function LineasStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.textStrong,
        headerTitleStyle: { color: theme.textStrong },
        contentStyle: { backgroundColor: theme.bg },
        headerBackTitle: 'Atrás',
      }}>
      <Stack.Screen
        name="LineasList"
        component={LineasListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="LineaParadas" component={LineaParadasScreen} options={{ title: '' }} />
      <Stack.Screen name="Parada" component={ParadaScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
