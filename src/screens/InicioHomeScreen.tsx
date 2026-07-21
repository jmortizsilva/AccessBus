import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ParadaRow from '../components/ParadaRow';
import { InicioStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';

type Nav = NativeStackNavigationProp<InicioStackParamList, 'InicioHome'>;

export default function InicioHomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    favorites,
    currentLocation,
    searchRadiusM,
    nearby,
    loadingLocation,
    loadingNearby,
    refreshLocation,
    message,
  } = useApp();

  // La ubicación se actualiza automáticamente al entrar en Inicio (silenciosa).
  useFocusEffect(
    useCallback(() => {
      void refreshLocation({ silent: true });
    }, [refreshLocation])
  );

  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Pantalla Inicio">
      <Text style={styles.title} accessibilityRole="header">
        Inicio
      </Text>

      <Pressable
        style={styles.buttonPrimary}
        onPress={() => void refreshLocation()}
        accessibilityRole="button"
        accessibilityLabel="Actualizar mi ubicación"
        accessibilityHint="Usa el GPS para buscar las paradas más cercanas"
      >
        <Text style={styles.buttonText}>📍 Actualizar ubicación</Text>
      </Pressable>
      {(loadingLocation || loadingNearby) && (
        <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando" />
      )}

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Paradas favoritas
      </Text>
      {favorites.length === 0 ? (
        <Text style={styles.note}>
          Aún no tienes favoritos. Añádelos desde una parada (buscándola en Líneas o entre las cercanas).
        </Text>
      ) : (
        <View style={styles.card}>
          {favorites.map((parada, i) => (
            <ParadaRow
              key={parada.stopCode}
              parada={parada}
              onOpen={() => navigation.navigate('Parada', { parada })}
              isLast={i === favorites.length - 1}
            />
          ))}
        </View>
      )}

      <Text style={styles.sectionHeader} accessibilityRole="header">
        Paradas cercanas
      </Text>
      {!currentLocation ? (
        <Text style={styles.note}>Pulsa "Actualizar ubicación" para ver las paradas a tu alrededor.</Text>
      ) : nearby.length === 0 && !loadingNearby ? (
        <Text style={styles.note}>
          No hay paradas en un radio de {formatDistance(searchRadiusM)}. Puedes ampliarlo en Ajustes.
        </Text>
      ) : (
        <View style={styles.card}>
          {nearby.map(({ parada, meters }, i) => (
            <ParadaRow
              key={parada.stopCode}
              parada={parada}
              onOpen={() => navigation.navigate('Parada', { parada })}
              distanceText={formatDistance(meters)}
              isLast={i === nearby.length - 1}
            />
          ))}
        </View>
      )}

      {message ? <Text style={styles.statusNote}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  title: { color: theme.textStrong, fontSize: 34, fontWeight: '700' },
  buttonPrimary: {
    borderRadius: 12,
    backgroundColor: theme.primaryDark,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  sectionHeader: { color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
  statusNote: { color: theme.textMuted, fontSize: 13, marginTop: 8 },
});
