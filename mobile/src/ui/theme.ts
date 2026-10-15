import { StyleSheet } from 'react-native';
export const ink = {
  paper: '#f8f5ee', sheet: '#eeeee4', text: '#282c28', muted: '#70776c', faint: '#93998c',
  binding: '#345445', rule: '#daddd0', highlight: '#f3d77c', danger: '#a13e36', white: '#fffdf7',
};
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.paper },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  eyebrow: { color: ink.binding, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { fontFamily: 'serif', fontSize: 34, lineHeight: 42, color: ink.text, marginTop: 8 },
  subtitle: { color: ink.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  body: { fontSize: 16, color: ink.text, lineHeight: 25 },
  small: { fontSize: 12, color: ink.muted, lineHeight: 18 },
  section: { padding: 24, gap: 16 },
  input: { backgroundColor: ink.sheet, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, color: ink.text, fontSize: 16, minHeight: 48 },
  label: { fontSize: 13, fontWeight: '600', color: ink.text, marginBottom: 8 },
  divider: { height: 1, backgroundColor: ink.rule },
  error: { color: ink.danger, fontSize: 14, lineHeight: 21 },
});
