import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ParadaRow from '../components/ParadaRow';
import { InicioStackParamList } from '../navigation/types';
import { ViajeActivo } from '../services/seguimientoViaje';
import { useApp } from '../state/AppContext';
import { theme } from '../theme';
import { formatDistance } from '../utils/distance';

function textoViaje(viaje: ViajeActivo): string {
  switch (viaje.estado) {
    case 'activo': {
      const restantes = viaje.indiceDestino - viaje.indiceActual;
      return `🔔 Línea ${viaje.lin} · bajas en ${viaje.destinoNombre} · quedan ${Math.max(0, restantes)} paradas`;
    }
    case 'llegado':
      return `✅ Has llegado a ${viaje.destinoNombre}`;
    case 'timeout':
      return `⏸️ Seguimiento detenido: llevabas mucho tiempo sin avanzar hacia ${viaje.destinoNombre}`;
  }
}

type Nav = NativeStackNavigationProp<InicioStackParamList, 'InicioHome'>;

export default function InicioHomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    favorites,
    currentLocation,
    diaServicio,
    searchRadiusM,
    nearby,
    loadingLocation,
    loadingNearby,
    refreshLocation,
    viajeActivo,
    refrescarViaje,
    cancelarViaje,
  } = useApp();

  // La ubicación y el viaje activo se actualizan al entrar en Inicio: el viaje
  // lo escribe la tarea en segundo plano directamente en AsyncStorage, así que
  // el estado de React necesita releerlo para no quedarse desactualizado.
  useFocusEffect(
    useCallback(() => {
      void refreshLocation({ silent: true });
      void refrescarViaje();
    }, [refreshLocation, refrescarViaje]),
  );

  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Pantalla Inicio">
      <Text style={styles.title} accessibilityRole="header">
        Inicio
      </Text>

      {diaServicio ? (
        <View
          style={[styles.diaBanner, diaServicio.huelga && styles.diaBannerHuelga]}
          accessible
          accessibilityLabel={
            `Servicio de hoy: ${diaServicio.etiqueta}.` +
            (diaServicio.huelga ? ' Atención: hay huelga convocada.' : '')
          }>
          <Text style={styles.diaText}>🗓️ Servicio de hoy: {diaServicio.etiqueta}</Text>
          {diaServicio.huelga ? <Text style={styles.diaHuelga}>⚠️ Huelga convocada</Text> : null}
        </View>
      ) : null}

      {viajeActivo ? (
        <View
          style={[styles.viajeBanner, viajeActivo.estado !== 'activo' && styles.viajeBannerFin]}
          accessible
          accessibilityLabel={textoViaje(viajeActivo)}>
          <Text style={styles.viajeTexto}>{textoViaje(viajeActivo)}</Text>
          <Pressable
            style={styles.viajeBoton}
            onPress={() => void cancelarViaje()}
            accessibilityRole="button"
            accessibilityLabel={
              viajeActivo.estado === 'activo' ? 'Cancelar aviso de parada' : 'Descartar aviso'
            }>
            <Text style={styles.viajeBotonTexto}>
              {viajeActivo.estado === 'activo' ? 'Cancelar' : 'Vale'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={styles.buttonPrimary}
        onPress={() => void refreshLocation()}
        accessibilityRole="button"
        accessibilityLabel="Actualizar mi ubicación"
        accessibilityHint="Usa el GPS para buscar las paradas más cercanas">
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
          Aún no tienes favoritos. Añádelos desde una parada (buscándola en Líneas o entre las
          cercanas).
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
        <Text style={styles.note}>
          Pulsa «Actualizar ubicación» para ver las paradas a tu alrededor.
        </Text>
      ) : nearby.length === 0 && !loadingNearby ? (
        <Text style={styles.note}>
          No hay paradas en un radio de {formatDistance(searchRadiusM)}. Puedes ampliarlo en
          Ajustes.
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
  diaBanner: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
  },
  diaBannerHuelga: { borderLeftColor: '#e0a33e' },
  diaText: { color: theme.textStrong, fontSize: 16, fontWeight: '700' },
  diaHuelga: { color: '#e0a33e', fontSize: 14, fontWeight: '700' },
  viajeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  viajeBannerFin: { borderLeftColor: '#e0a33e' },
  viajeTexto: { flex: 1, color: theme.textStrong, fontSize: 15, fontWeight: '600' },
  viajeBoton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  viajeBotonTexto: { color: theme.primary, fontSize: 15, fontWeight: '700' },
  sectionHeader: { color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  note: { color: theme.textMuted, fontSize: 15 },
});
