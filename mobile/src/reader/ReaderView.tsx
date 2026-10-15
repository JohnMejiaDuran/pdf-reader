import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import * as FS from 'expo-file-system/legacy';
import { Anchor, Book, Highlight, ReaderSettings, Selection } from '../domain/book';
import { folderFor } from '../storage/library';
import { createReaderHtml, scriptJson } from './html';
import { ink, ui } from '../ui/theme';

export type ReaderMessage = { type: 'ready' } | { type: 'selection'; selection: Selection | null }
  | { type: 'position'; anchor: Anchor; progress: number; sourcePage: number; page: number; total: number }
  | { type: 'section'; text: string };
export type ReaderHandle = { command: (name: 'next' | 'previous' | 'jump' | 'section' | 'clearSelection', value?: unknown) => void };

export const ReaderView = forwardRef<ReaderHandle, {
  book: Book; localId: string; highlights: Highlight[]; settings: ReaderSettings; anchor?: Anchor; onMessage: (message: ReaderMessage) => void;
}>(function ReaderView({ book, localId, highlights, settings, anchor, onMessage }, ref) {
  const webview = useRef<WebView>(null); const [uri, setUri] = useState(''); const [error, setError] = useState(''); const [ready, setReady] = useState(false);
  const initial = useRef({ book, highlights, settings, anchor, localId });
  useImperativeHandle(ref, () => ({ command: (name, value) => webview.current?.injectJavaScript(`window.folio?.${name}(${value === undefined ? '' : scriptJson(value)});true;`) }), []);
  useEffect(() => {
    let canceled = false;
    const snapshot = initial.current;
    const folder = folderFor(snapshot.localId);
    const assets = Object.fromEntries(snapshot.book.assets.map(name => [name, `${folder}assets/${name}`]));
    FS.writeAsStringAsync(`${folder}reader.html`, createReaderHtml(snapshot.book, snapshot.highlights, snapshot.settings, snapshot.anchor, assets))
      .then(() => { if (!canceled) setUri(`${folder}reader.html`); }).catch(e => { if (!canceled) setError(String(e)); });
    return () => { canceled = true; };
  }, []);
  useEffect(() => { if (ready) webview.current?.injectJavaScript(`window.folio.settings(${scriptJson(settings)});true;`); }, [ready, settings]);
  useEffect(() => { if (ready) webview.current?.injectJavaScript(`window.folio.highlights(${scriptJson(highlights)});true;`); }, [ready, highlights]);
  if (error) return <View style={ui.section}><Text style={ui.error}>{error}</Text></View>;
  if (!uri) return <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={ink.binding} /></View>;
  return <WebView ref={webview} source={{ uri }} style={{ flex: 1, backgroundColor: ink.paper }}
    originWhitelist={['file://*']} allowFileAccess allowFileAccessFromFileURLs allowUniversalAccessFromFileURLs={false}
    javaScriptEnabled domStorageEnabled={false} mixedContentMode="never" scrollEnabled={false}
    onShouldStartLoadWithRequest={request => request.url === uri || request.url === 'about:blank'}
    onError={event => setError(event.nativeEvent.description)}
    onMessage={event => {
      try { const message = JSON.parse(event.nativeEvent.data) as ReaderMessage; if (message.type === 'ready') setReady(true); onMessage(message); }
      catch { setError('No se pudo interpretar el mensaje del lector.'); }
    }} />;
});
