import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { getServerSettings, saveServerSettings } from '../storage/library';
import { Button } from '../ui/Button';
import { ink, ui } from '../ui/theme';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState(''); const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getServerSettings().then(s => { setUrl(s.url); setToken(s.token); }).catch(e => setError(String(e))).finally(() => setLoading(false)); }, []);
  async function save() {
    setSaving(true); setError('');
    try { await saveServerSettings({ url, token }); Alert.alert('Configuración guardada', 'Ya podés importar PDFs y consultar Grok.'); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }
  return <ScrollView style={ui.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.section, { maxWidth: 650, width: '100%', alignSelf: 'center' }]}>
    <View style={ui.row}><Button label="← Biblioteca" quiet onPress={onBack} /></View>
    <View><Text style={ui.eyebrow}>CONEXIONES</Text><Text style={ui.title}>Tu taller de lectura</Text><Text style={ui.subtitle}>La conversión y la IA viven en tu servidor. Tus libros y anotaciones, en este dispositivo.</Text></View>
    <View><Text style={ui.label}>URL del backend</Text><TextInput accessibilityLabel="URL del backend" editable={!loading} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://tu-api.up.railway.app" placeholderTextColor={ink.faint} value={url} onChangeText={setUrl} style={ui.input} /></View>
    <View><Text style={ui.label}>Token de acceso al servidor</Text><TextInput accessibilityLabel="Token del servidor" editable={!loading} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="El valor de API_TOKEN en Railway" placeholderTextColor={ink.faint} value={token} onChangeText={setToken} style={ui.input} /><Text style={ui.subtitle}>Este token se guarda en SecureStore. La clave XAI_API_KEY se configura únicamente en Railway.</Text></View>
    {error ? <Text style={ui.error}>{error}</Text> : null}
    <Button label="Guardar conexión" disabled={loading || !url || !token} busy={saving} onPress={save} />
    <View style={ui.divider} />
    <Text style={ui.label}>Hecho para Expo Go</Text><Text style={ui.body}>No necesitás compilar una app nativa. Abrí el proyecto con Expo Go actualizado y escaneá el QR de Metro.</Text>
    <Text style={ui.label}>Qué requiere conexión</Text><Text style={ui.body}>Importar y convertir PDFs, consultar definiciones y pedir resúmenes. Los libros descargados, subrayados y respuestas guardadas funcionan sin conexión.</Text>
    <Text style={ui.label}>Tu PDF sigue siendo tu referencia</Text><Text style={ui.body}>La conversión puede interpretar mal columnas o tablas. Conservamos el archivo original para que puedas contrastarlo con la lectura adaptable.</Text>
  </ScrollView>;
}
