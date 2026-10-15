import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { deleteEntry, initLibrary, LibraryEntry, listEntries } from './src/storage/library';
import { importPdf, syncImports, uploadEntry } from './src/services/imports';
import { ink, ui } from './src/ui/theme';

export default function App() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [screen, setScreen] = useState<'library' | 'settings'>('library');
  const [reading, setReading] = useState<LibraryEntry>(); const [importing, setImporting] = useState(false);
  const syncing = useRef(false);
  const reload = useCallback(async () => { setEntries(await listEntries()); }, []);
  const back = useCallback(() => { setReading(undefined); setScreen('library'); void reload().catch(e => setError(String(e))); }, [reload]);

  useEffect(() => { initLibrary().then(reload).catch(e => setError(String(e))).finally(() => setLoading(false)); }, [reload]);
  useEffect(() => {
    if (loading || error) return;
    let disposed = false;
    async function poll() {
      if (syncing.current || AppState.currentState !== 'active') return;
      syncing.current = true;
      try {
        const before = await listEntries();
        if (before.some(e => ['queued', 'processing', 'downloading'].includes(e.status))) {
          await syncImports();
          if (!disposed) await reload();
        }
      } catch (e) { if (!disposed) setError(String(e)); }
      finally { syncing.current = false; }
    }
    void poll(); const timer = setInterval(poll, 4000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void poll(); });
    return () => { disposed = true; clearInterval(timer); subscription.remove(); };
  }, [loading, error, reload]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (reading) return false; if (screen !== 'library') { back(); return true; } return false; });
    return () => subscription.remove();
  }, [reading, screen, back]);

  async function importBook() {
    setImporting(true);
    try { await importPdf(); }
    catch (e) { Alert.alert('No se pudo importar', e instanceof Error ? e.message : String(e)); }
    finally { setImporting(false); await reload(); }
  }
  return <SafeAreaProvider><SafeAreaView style={ui.screen} edges={['top', 'bottom']}><StatusBar style="auto" />
    {loading ? <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={ink.binding} /></View>
      : error ? <View style={ui.section}><Text style={ui.error}>{error}</Text></View>
      : reading ? <ReaderScreen key={reading.id} entry={reading} onBack={back} />
      : screen === 'settings' ? <SettingsScreen onBack={back} />
      : <LibraryScreen entries={entries} importing={importing} onImport={importBook} onOpen={setReading} onSettings={() => setScreen('settings')}
        onRetry={entry => { void uploadEntry(entry).then(reload).catch(e => { Alert.alert('No se pudo reintentar', String(e)); void reload(); }); }}
        onDelete={entry => { void deleteEntry(entry.id).then(reload).catch(e => Alert.alert('No se pudo eliminar', String(e))); }} />}
  </SafeAreaView></SafeAreaProvider>;
}
