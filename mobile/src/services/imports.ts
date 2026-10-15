import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { validateBook } from '../domain/book';
import { folderFor, getServerSettings, LibraryEntry, listEntries, localId, saveEntry, writeBook } from '../storage/library';
import { api, ApiError } from './api';

type Job = { id: string; status: 'queued' | 'processing' | 'ready' | 'failed'; error?: string };

export async function importPdf(): Promise<void> {
  const settings = await getServerSettings();
  if (!settings.url || !settings.token) throw new Error('Primero configurá tu servidor en Ajustes.');
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return;
  const file = result.assets[0];
  if (file.size && file.size > 50 * 1024 * 1024) throw new Error('El límite de importación es 50 MB.');
  const id = localId();
  await FS.makeDirectoryAsync(folderFor(id), { intermediates: true });
  const original = `${folderFor(id)}original.pdf`;
  await FS.copyAsync({ from: file.uri, to: original });
  await FS.deleteAsync(file.uri, { idempotent: true });
  const entry: LibraryEntry = { id, title: file.name.replace(/\.pdf$/i, ''), original, status: 'uploading', progress: 0, createdAt: Date.now(), serverUrl: settings.url };
  await saveEntry(entry);
  await uploadEntry(entry);
}

export async function uploadEntry(entry: LibraryEntry) {
  const settings = await getServerSettings();
  if (!entry.original) throw new Error('No se encuentra el PDF original. Volvé a importarlo.');
  const updated: LibraryEntry = { ...entry, status: 'uploading', error: undefined, serverUrl: settings.url };
  await saveEntry(updated);
  try {
    const form = new FormData();
    form.append('file', { uri: entry.original, name: `${entry.title}.pdf`, type: 'application/pdf' } as unknown as Blob);
    const job = await api<Job>(settings, '/jobs', { method: 'POST', body: form });
    await saveEntry({ ...updated, status: 'queued', jobId: job.id });
  } catch (error) {
    await saveEntry({ ...updated, status: 'failed', error: error instanceof Error ? error.message : 'No se pudo cargar el PDF.' });
    throw error;
  }
}

export async function syncImports() {
  const settings = await getServerSettings();
  const entries = (await listEntries()).filter(e => ['queued', 'processing', 'downloading'].includes(e.status) && e.jobId);
  for (const entry of entries) {
    if (entry.serverUrl !== settings.url) continue;
    try {
      const job = await api<Job>(settings, `/jobs/${entry.jobId}`);
      if (job.status === 'failed') { await saveEntry({ ...entry, status: 'failed', error: job.error }); continue; }
      if (job.status !== 'ready') { await saveEntry({ ...entry, status: job.status, error: undefined }); continue; }
      await saveEntry({ ...entry, status: 'downloading', error: undefined });
      const book = validateBook(await api(settings, `/jobs/${entry.jobId}/manifest`));
      const directory = `${folderFor(entry.id)}assets/`;
      await FS.makeDirectoryAsync(directory, { intermediates: true });
      for (const asset of book.assets) {
        const downloaded = await FS.downloadAsync(`${settings.url}/jobs/${entry.jobId}/assets/${asset}`, `${directory}${asset}`, {
          headers: { Authorization: `Bearer ${settings.token}` },
        });
        if (downloaded.status !== 200) throw new Error(`No se pudo descargar ${asset}.`);
      }
      await writeBook(book, entry.id);
      await saveEntry({ ...entry, status: 'ready', error: undefined });
    } catch (error) {
      // Keep pending jobs resumable across connectivity losses. Retry from the library.
      await saveEntry({ ...entry, status: error instanceof ApiError && error.status === 404 ? 'failed' : entry.status,
        error: error instanceof Error ? error.message : 'No se pudo contactar al servidor.' });
    }
  }
}
