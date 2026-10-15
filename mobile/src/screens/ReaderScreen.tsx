import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal, ScrollView, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Anchor, Book, Highlight, ReaderSettings, Selection } from '../domain/book';
import { ReaderHandle, ReaderMessage, ReaderView } from '../reader/ReaderView';
import { Action, requestAssistance } from '../services/api';
import { deleteHighlight, getAnswers, getHighlights, getReaderSettings, getServerSettings, LibraryEntry, localId, readBook, saveAnswer, SavedAnswer, saveHighlight, savePosition, saveReaderSettings } from '../storage/library';
import { Button } from '../ui/Button';
import { ink, ui } from '../ui/theme';

const actions: Record<Action, string> = { define: 'Definición', explain: 'Explicación', summarize: 'Resumen' };

export function ReaderScreen({ entry, onBack }: { entry: LibraryEntry; onBack: () => void }) {
  const [book, setBook] = useState<Book>(); const [settings, setSettings] = useState<ReaderSettings>();
  const [highlights, setHighlights] = useState<Highlight[]>([]); const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null); const [panel, setPanel] = useState<'settings' | 'notes' | 'answer' | null>(null);
  const [error, setError] = useState(''); const [answer, setAnswer] = useState(''); const [busy, setBusy] = useState(false);
  const [sourcePage, setSourcePage] = useState(entry.sourcePage ?? 1); const reader = useRef<ReaderHandle>(null);
  const latestPosition = useRef<{ anchor: Anchor; progress: number; sourcePage: number } | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const leaving = useRef(false);

  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    clearTimeout(saveTimer.current);
    try {
      const p = latestPosition.current;
      if (p) await savePosition(entry.id, p.anchor, p.progress, p.sourcePage);
      onBack();
    } catch { Alert.alert('No se pudo guardar la posición', 'Volvé a intentar salir del libro.'); }
    finally { leaving.current = false; }
  }, [entry.id, onBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { void leave(); return true; });
    return () => subscription.remove();
  }, [leave]);

  useEffect(() => {
    alive.current = true;
    Promise.all([readBook(entry.id), getReaderSettings(), getHighlights(entry.id), getAnswers(entry.id)])
      .then(([b, s, h, a]) => { if (alive.current) { setBook(b); setSettings(s); setHighlights(h); setAnswers(a); } })
      .catch(e => setError(String(e)));
    return () => { alive.current = false; clearTimeout(saveTimer.current); const p = latestPosition.current; if (p) void savePosition(entry.id, p.anchor, p.progress, p.sourcePage).catch(() => {}); };
  }, [entry.id]);

  async function changeSettings(next: ReaderSettings) {
    setSettings(next);
    try { await saveReaderSettings(next); } catch { Alert.alert('No se pudo guardar', 'Los ajustes se aplicaron pero no se pudieron guardar.'); }
  }

  async function highlight() {
    if (!selection) return;
    const h: Highlight = { ...selection, id: localId(), bookId: entry.id, createdAt: Date.now() };
    try { await saveHighlight(h); setHighlights(previous => [...previous, h]); reader.current?.command('clearSelection'); setSelection(null); }
    catch { Alert.alert('No se pudo guardar el subrayado'); }
  }

  async function ask(action: Action, text?: string) {
    const quote = text ?? selection?.quote;
    if (!quote || busy) return;
    setBusy(true); setAnswer(''); setError(''); setPanel('answer');
    try {
      const result = await requestAssistance(await getServerSettings(), action, quote,
        book?.blocks.find(b => b.id === selection?.start.blockId)?.text ?? '');
      const saved: SavedAnswer = { id: localId(), bookId: entry.id, action, text: quote, answer: result.answer, createdAt: Date.now() };
      await saveAnswer(saved);
      if (alive.current) { setAnswer(result.answer); setAnswers(previous => [saved, ...previous]); }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'No se pudo consultar Grok.'); }
    finally { if (alive.current) setBusy(false); }
  }

  function message(message: ReaderMessage) {
    if (message.type === 'selection') setSelection(message.selection);
    if (message.type === 'section') void ask('summarize', message.text);
    if (message.type === 'position') {
      setSourcePage(message.sourcePage); latestPosition.current = message;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void savePosition(entry.id, message.anchor, message.progress, message.sourcePage).catch(() => Alert.alert('No se pudo guardar la posición de lectura.')); }, 400);
    }
  }

  const dark = settings?.theme === 'night';
  return <View style={[ui.screen, dark && { backgroundColor: '#202621' }]}>
    <View style={[ui.spread, { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }]}><Button label="← Volver" quiet onPress={leave} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[ui.small, dark && { color: '#e3e8dc' }]}>{entry.title}</Text><Text style={[ui.small, { fontSize: 10 }]}>PDF ORIGINAL · PÁG. {sourcePage}</Text></View><Button label="Aa" quiet onPress={() => setPanel('settings')} /><Button label="Marcas" quiet onPress={() => setPanel('notes')} /></View>
    {book && settings ? <ReaderView ref={reader} book={book} localId={entry.id} highlights={highlights} settings={settings} anchor={entry.anchor} onMessage={message} /> : <View style={[ui.screen, { justifyContent: 'center', padding: 24 }]}>{error ? <Text style={ui.error}>{error}</Text> : <ActivityIndicator color={ink.binding} />}</View>}
    {selection ? <View style={{ padding: 12, backgroundColor: ink.sheet, gap: 8 }}><Text numberOfLines={2} style={ui.small}>“{selection.quote}”</Text><ScrollView horizontal contentContainerStyle={{ gap: 8 }}><Button label="Subrayar" onPress={highlight} /><Button label="Definir" quiet disabled={busy} onPress={() => ask('define')} /><Button label="Explicar" quiet disabled={busy} onPress={() => ask('explain')} /><Button label="Resumir" quiet disabled={busy} onPress={() => ask('summarize')} /><Button label="Cerrar" quiet onPress={() => { reader.current?.command('clearSelection'); setSelection(null); }} /></ScrollView></View> : null}
    <View style={[ui.spread, { paddingHorizontal: 16, paddingVertical: 8 }]}><Button label="←" accessibilityLabel="Página anterior" quiet onPress={() => reader.current?.command('previous')} /><Button label="Resumir sección" quiet disabled={busy || !book} onPress={() => reader.current?.command('section')} /><Button label="→" accessibilityLabel="Página siguiente" quiet onPress={() => reader.current?.command('next')} /></View>
    <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
      <View style={{ flex: 1, backgroundColor: '#14211866', justifyContent: 'flex-end' }}><View style={{ backgroundColor: ink.paper, maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 }}>
        <View style={[ui.spread, { padding: 20 }]}><Text style={{ fontFamily: 'serif', fontSize: 24, color: ink.text }}>{panel === 'settings' ? 'A tu manera' : panel === 'notes' ? 'Tu cuaderno' : 'Asistente de lectura'}</Text><Button label="Cerrar" quiet onPress={() => setPanel(null)} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, gap: 20, paddingBottom: 24 }}>
          {panel === 'settings' && settings ? <>
            <View><Text style={ui.label}>Tamaño de letra · {settings.fontSize}</Text><View style={ui.row}><Button label="A −" quiet disabled={settings.fontSize <= 14} onPress={() => changeSettings({ ...settings, fontSize: settings.fontSize - 2 })} /><Button label="A ＋" quiet disabled={settings.fontSize >= 32} onPress={() => changeSettings({ ...settings, fontSize: settings.fontSize + 2 })} /></View></View>
            <View><Text style={ui.label}>Espacio entre líneas</Text><View style={[ui.row, { flexWrap: 'wrap' }]}>{[1.4, 1.75, 2].map(value => <Button key={value} label={String(value)} quiet={settings.lineHeight !== value} onPress={() => changeSettings({ ...settings, lineHeight: value })} />)}</View></View>
            <View><Text style={ui.label}>Páginas por pantalla</Text><View style={[ui.row, { flexWrap: 'wrap' }]}>{(['auto', 'one', 'two'] as const).map((value, i) => <Button key={value} label={['Auto', 'Una', 'Dos'][i]!} quiet={settings.columns !== value} onPress={() => changeSettings({ ...settings, columns: value })} />)}</View></View>
            <View><Text style={ui.label}>Papel</Text><View style={[ui.row, { flexWrap: 'wrap' }]}>{(['paper', 'sepia', 'night'] as const).map((value, i) => <Button key={value} label={['Claro', 'Sepia', 'Noche'][i]!} quiet={settings.theme !== value} onPress={() => changeSettings({ ...settings, theme: value })} />)}</View></View>
            {entry.original ? <Button label="Compartir / abrir PDF original" quiet onPress={() => { void Sharing.shareAsync(entry.original!, { mimeType: 'application/pdf' }).catch(e => Alert.alert('No se pudo abrir', String(e))); }} /> : null}
            {book?.warnings.map((w, i) => <Text key={i} style={ui.error}>{w}</Text>)}
            <Text style={ui.small}>La animación desplaza las páginas. No simula el curvado físico del papel. En una pantalla pequeña, dos páginas pueden resultar estrechas.</Text>
          </> : null}
          {panel === 'notes' ? <>
            <Text style={ui.eyebrow}>SUBRAYADOS · {highlights.length}</Text>
            {!highlights.length ? <Text style={ui.subtitle}>Mantené presionado el texto para seleccionar tu primera frase.</Text> : null}
            {highlights.map(h => <View key={h.id} style={{ borderLeftWidth: 3, borderLeftColor: ink.highlight, paddingLeft: 16, gap: 8 }}><Text style={[ui.body, { fontFamily: 'serif' }]}>{h.quote}</Text><View style={ui.row}><Button label="Ir al texto" quiet onPress={() => { setPanel(null); reader.current?.command('jump', h.start); }} /><Button label="Quitar" quiet onPress={() => { void deleteHighlight(h.id).then(() => setHighlights(previous => previous.filter(x => x.id !== h.id))).catch(() => Alert.alert('No se pudo quitar la marca.')); }} /></View></View>)}
            <View style={ui.divider} /><Text style={ui.eyebrow}>RESPUESTAS GUARDADAS · {answers.length}</Text>
            {answers.map(a => <View key={a.id} style={{ gap: 8 }}><Text style={ui.label}>{actions[a.action as Action] ?? a.action} · IA</Text><Text numberOfLines={3} style={ui.small}>“{a.text}”</Text><Text selectable style={ui.body}>{a.answer}</Text><View style={ui.divider} /></View>)}
          </> : null}
          {panel === 'answer' ? <>{busy ? <View style={{ paddingVertical: 32, gap: 16 }}><ActivityIndicator color={ink.binding} /><Text style={[ui.subtitle, { textAlign: 'center' }]}>Grok está leyendo el fragmento…</Text></View> : null}{error ? <Text style={ui.error}>{error}</Text> : null}{answer ? <><Text selectable style={ui.body}>{answer}</Text><Text style={ui.small}>Generado por IA · guardado en tu cuaderno para consulta offline.</Text></> : null}</> : null}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}
