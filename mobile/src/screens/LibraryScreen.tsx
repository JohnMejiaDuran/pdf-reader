import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { LibraryEntry } from '../storage/library';
import { Button } from '../ui/Button';
import { ink, ui } from '../ui/theme';

const statusText: Record<LibraryEntry['status'], string> = {
  ready: 'Disponible sin conexión', uploading: 'Enviando PDF…', queued: 'En cola de conversión',
  processing: 'Reconstruyendo el documento…', downloading: 'Guardando para leer sin conexión…', failed: 'Importación interrumpida',
};

export function LibraryScreen({ entries, importing, onImport, onOpen, onSettings, onRetry, onDelete }: {
  entries: LibraryEntry[]; importing: boolean; onImport: () => void; onOpen: (entry: LibraryEntry) => void;
  onSettings: () => void; onRetry: (entry: LibraryEntry) => void; onDelete: (entry: LibraryEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const current = entries.find(e => e.status === 'ready' && e.anchor);
  const filtered = entries.filter(e => e.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <View style={ui.screen}>
    <FlatList data={filtered} keyExtractor={item => item.id} contentContainerStyle={styles.list}
      ListHeaderComponent={<View>
        <View style={[ui.spread, styles.brand]}><Text style={styles.wordmark}>folio<Text style={{ color: ink.binding }}>.</Text></Text><Button label="Ajustes" quiet onPress={onSettings} /></View>
        <Text style={ui.eyebrow}>TU ESPACIO DE LECTURA</Text>
        <Text style={ui.title}>Un libro. Otra mirada.</Text>
        <Text style={ui.subtitle}>Tus documentos, con espacio para pensar.</Text>
        {current && !query ? <Pressable accessibilityRole="button" accessibilityLabel={`Continuar ${current.title}`} onPress={() => onOpen(current)} style={styles.continue}>
          <View style={styles.bookSpine} /><View style={{ flex: 1 }}><Text style={styles.continueLabel}>SEGUIR LEYENDO</Text><Text style={styles.continueTitle}>{current.title}</Text><Text style={ui.small}>PDF · página original {current.sourcePage ?? 1}</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.round(current.progress * 100)}%` }]} /></View></View><Text style={styles.arrow}>→</Text>
        </Pressable> : null}
        <View style={[ui.spread, { marginTop: 28, marginBottom: 16 }]}><Text style={styles.sectionTitle}>Mi biblioteca <Text style={styles.count}>{entries.length}</Text></Text><Button label="＋ Agregar PDF" busy={importing} onPress={onImport} /></View>
        <TextInput accessibilityLabel="Buscar en la biblioteca" placeholder="Buscar por título" placeholderTextColor={ink.faint} value={query} onChangeText={setQuery} style={[ui.input, { marginBottom: 12 }]} />
      </View>}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.sectionTitle}>{query ? 'No encontramos ese título' : 'Tu próximo libro empieza acá'}</Text><Text style={ui.subtitle}>{query ? 'Probá con otra palabra.' : 'Agregá un PDF para convertirlo en una lectura a tu medida.'}</Text></View>}
      renderItem={({ item, index }) => <View style={styles.bookRow}>
        <Pressable accessibilityRole="button" disabled={item.status !== 'ready'} onPress={() => onOpen(item)} style={styles.bookMain}>
          <View style={[styles.cover, index % 2 === 1 && { backgroundColor: '#7d7259' }]}><View style={styles.coverRule} /><Text style={styles.coverLetter}>{item.title.slice(0, 1).toUpperCase()}</Text><Text style={styles.coverFoot}>FOLIO / PDF</Text></View>
          <View style={{ flex: 1, gap: 6 }}><Text style={styles.bookTitle}>{item.title}</Text><Text style={ui.small}>{item.id === 'folio-welcome' ? 'LIBRO DE DEMOSTRACIÓN' : statusText[item.status]}</Text>{item.error ? <Text style={ui.error}>{item.error}</Text> : null}{item.status === 'ready' ? <Text style={styles.readLink}>{item.anchor ? 'Retomar lectura' : 'Abrir libro'} →</Text> : null}</View>
        </Pressable>
        {item.status === 'failed' ? <Button label="Reintentar" quiet onPress={() => onRetry(item)} /> : null}
        {['ready', 'failed'].includes(item.status) ? <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${item.title}`} style={styles.delete} onPress={() => Alert.alert('Eliminar de la biblioteca', 'Se borrarán el libro, sus subrayados y respuestas de este dispositivo.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(item) }])}><Text style={ui.small}>Eliminar</Text></Pressable> : null}
      </View>}
      ListFooterComponent={<Text style={styles.footer}>LECTURA LOCAL · TUS MARCAS QUEDAN CON VOS</Text>} />
  </View>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingBottom: 32, maxWidth: 900, width: '100%', alignSelf: 'center' },
  brand: { paddingTop: 16, paddingBottom: 32 }, wordmark: { fontFamily: 'serif', fontSize: 38, letterSpacing: -2, color: ink.text },
  continue: { marginTop: 24, padding: 20, backgroundColor: ink.sheet, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  bookSpine: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: ink.binding },
  continueLabel: { fontSize: 10, letterSpacing: 1.5, color: ink.binding, fontWeight: '700' },
  continueTitle: { fontFamily: 'serif', fontSize: 23, color: ink.text, marginTop: 8, marginBottom: 8 },
  arrow: { fontSize: 28, color: ink.binding }, track: { height: 3, backgroundColor: ink.rule, marginTop: 16 }, fill: { height: 3, backgroundColor: ink.binding },
  sectionTitle: { fontFamily: 'serif', fontSize: 23, color: ink.text }, count: { fontFamily: 'sans-serif', fontSize: 14, color: ink.muted },
  bookRow: { borderBottomWidth: 1, borderBottomColor: ink.rule, paddingVertical: 20, gap: 8 },
  bookMain: { flexDirection: 'row', gap: 20, alignItems: 'center', minHeight: 116 },
  cover: { width: 76, height: 112, backgroundColor: ink.binding, borderRadius: 3, padding: 12, justifyContent: 'space-between' },
  coverRule: { height: 1, backgroundColor: '#ffffff55' }, coverLetter: { fontFamily: 'serif', color: ink.white, fontSize: 40 }, coverFoot: { fontSize: 7, letterSpacing: 1, color: '#ffffffaa' },
  bookTitle: { fontFamily: 'serif', color: ink.text, fontSize: 21, lineHeight: 27 }, readLink: { color: ink.binding, fontSize: 13, fontWeight: '600', marginTop: 4 },
  delete: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 12 },
  empty: { paddingVertical: 40 }, footer: { fontSize: 9, color: ink.faint, letterSpacing: 1.5, textAlign: 'center', marginTop: 32 },
});
