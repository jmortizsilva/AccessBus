import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  /** Se llama con el texto en cada cambio y con '' al cancelar. */
  onChangeText: (texto: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  autoFocus?: boolean;
}

/**
 * Campo de búsqueda con botón "Cancelar" accesible que borra y cierra el teclado.
 *
 * Patrón probado en EasyWeather: sin un "Cancelar" explícito, con el teclado
 * abierto no hay forma fiable de cerrarlo con VoiceOver (el gesto atrás no lo
 * oculta), ni de llegar a las pestañas (el teclado las tapa). El botón va en la
 * misma fila y DESPUÉS del campo, para que el orden de VoiceOver sea campo → cancelar.
 *
 * El campo va NO controlado (sin `value`) para evitar que el texto se duplique al
 * dictar con la arquitectura nueva de RN; se limpia por `ref` al cancelar.
 */
export default function CampoBusqueda({
  onChangeText,
  placeholder,
  accessibilityLabel,
  accessibilityHint,
  autoFocus,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [enfocado, setEnfocado] = useState(false);
  const [tieneTexto, setTieneTexto] = useState(false);

  // "Cancelar" solo tiene sentido si hay algo que cancelar: foco (teclado abierto)
  // o texto escrito. Tras cancelar (sin foco y vacío) desaparece.
  const mostrarCancelar = enfocado || tieneTexto;

  const cambiar = (texto: string) => {
    setTieneTexto(texto.length > 0);
    onChangeText(texto);
  };

  const cancelar = () => {
    inputRef.current?.clear();
    setTieneTexto(false);
    onChangeText('');
    Keyboard.dismiss();
  };

  return (
    <View style={styles.fila}>
      <TextInput
        ref={inputRef}
        onChangeText={cambiar}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={styles.input}
        // Tecla "Buscar" en el teclado; al pulsarla se cierra y quedan los resultados.
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />
      {mostrarCancelar && (
        <Pressable
          style={styles.cancelar}
          onPress={cancelar}
          accessibilityRole="button"
          accessibilityLabel="Cancelar búsqueda"
          accessibilityHint="Borra el texto y cierra el teclado">
          <Text style={styles.cancelarText}>Cancelar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    fontSize: 17,
    color: theme.textStrong,
    backgroundColor: theme.card,
  },
  cancelar: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  cancelarText: { color: theme.primary, fontSize: 17, fontWeight: '600' },
});
