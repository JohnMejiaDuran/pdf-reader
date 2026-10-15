import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ink } from './theme';

export function Button({ label, onPress, quiet = false, disabled = false, busy = false, accessibilityLabel }: {
  label: string; onPress: () => void; quiet?: boolean; disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, quiet && styles.quiet, (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={quiet ? ink.binding : ink.white} /> : <Text style={[styles.label, quiet && styles.quietLabel]}>{label}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, backgroundColor: ink.binding, alignItems: 'center', justifyContent: 'center' },
  quiet: { backgroundColor: ink.sheet }, label: { color: ink.white, fontSize: 14, fontWeight: '600' },
  quietLabel: { color: ink.binding }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
