import * as SQLite from 'expo-sqlite';
import * as FS from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Anchor, Book, Highlight, ReaderSettings, defaultReaderSettings, validateBook } from '../domain/book';
import { demoBook } from '../domain/demo';
import { validateServerUrl } from '../domain/server';

export type LibraryEntry = {
  id: string; title: string; status: 'uploading' | 'queued' | 'processing' | 'downloading' | 'ready' | 'failed';
  createdAt: number; jobId?: string; serverUrl?: string; error?: string; original?: string;
  anchor?: Anchor; progress: number; sourcePage?: number;
};
export type SavedAnswer = { id: string; bookId: string; action: string; text: string; answer: string; createdAt: number };
export type ServerSettings = { url: string; token: string };
let database: Promise<SQLite.SQLiteDatabase> | undefined;
const root = `${FS.documentDirectory}folio/`;
export const folderFor = (id: string) => `${root}${id}/`;
export const localId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function db() {
  database ??= (async () => {
    const connection = await SQLite.openDatabaseAsync('folio.db');
    await connection.execAsync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS highlights(id TEXT PRIMARY KEY, book_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answers(id TEXT PRIMARY KEY, book_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, data TEXT NOT NULL);`);
    return connection;
  })();
  return database;
}

export async function initLibrary() {
  const connection = await db();
  await FS.makeDirectoryAsync(root, { intermediates: true });
  const initialized = await connection.getFirstAsync('SELECT key FROM settings WHERE key=?', 'initialized');
  if (!initialized) {
    await writeBook(demoBook);
    await saveEntry({ id: demoBook.id, title: demoBook.title, status: 'ready', progress: 0, createdAt: Date.now() });
    await connection.runAsync('INSERT OR REPLACE INTO settings VALUES (?, ?)', 'initialized', 'true');
  }
  for (const entry of await listEntries()) {
    if (entry.status === 'uploading') await saveEntry({ ...entry, status: 'failed', error: 'La carga se interrumpió. Tocá Reintentar.' });
  }
}

export async function listEntries(): Promise<LibraryEntry[]> {
  const rows = await (await db()).getAllAsync<{ data: string }>('SELECT data FROM books');
  return rows.map(r => JSON.parse(r.data) as LibraryEntry).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getEntry(id: string): Promise<LibraryEntry | undefined> {
  const row = await (await db()).getFirstAsync<{ data: string }>('SELECT data FROM books WHERE id=?', id);
  return row ? JSON.parse(row.data) : undefined;
}

export async function saveEntry(entry: LibraryEntry) {
  await (await db()).runAsync('INSERT OR REPLACE INTO books VALUES (?, ?)', entry.id, JSON.stringify(entry));
}

export async function savePosition(id: string, anchor: Anchor, progress: number, sourcePage: number) {
  const entry = await getEntry(id);
  if (entry) await saveEntry({ ...entry, anchor, progress, sourcePage });
}

export async function writeBook(book: Book, localId = book.id) {
  await FS.makeDirectoryAsync(folderFor(localId), { intermediates: true });
  await FS.writeAsStringAsync(`${folderFor(localId)}manifest.json`, JSON.stringify(book));
}

export async function readBook(id: string) {
  return validateBook(JSON.parse(await FS.readAsStringAsync(`${folderFor(id)}manifest.json`)));
}

export async function saveHighlight(highlight: Highlight) {
  await (await db()).runAsync('INSERT OR REPLACE INTO highlights VALUES (?, ?, ?)', highlight.id, highlight.bookId, JSON.stringify(highlight));
}

export async function getHighlights(id: string): Promise<Highlight[]> {
  const rows = await (await db()).getAllAsync<{ data: string }>('SELECT data FROM highlights WHERE book_id=? ORDER BY rowid', id);
  return rows.map(r => JSON.parse(r.data));
}

export async function deleteHighlight(id: string) {
  await (await db()).runAsync('DELETE FROM highlights WHERE id=?', id);
}

export async function saveAnswer(answer: SavedAnswer) {
  await (await db()).runAsync('INSERT INTO answers VALUES (?, ?, ?)', answer.id, answer.bookId, JSON.stringify(answer));
}

export async function getAnswers(bookId: string): Promise<SavedAnswer[]> {
  const rows = await (await db()).getAllAsync<{ data: string }>('SELECT data FROM answers WHERE book_id=? ORDER BY rowid DESC', bookId);
  return rows.map(r => JSON.parse(r.data));
}

export async function deleteEntry(id: string) {
  const connection = await db();
  await connection.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync('DELETE FROM books WHERE id=?', id);
    await tx.runAsync('DELETE FROM highlights WHERE book_id=?', id);
    await tx.runAsync('DELETE FROM answers WHERE book_id=?', id);
  });
  await FS.deleteAsync(folderFor(id), { idempotent: true });
}

export async function getReaderSettings(): Promise<ReaderSettings> {
  const row = await (await db()).getFirstAsync<{ data: string }>('SELECT data FROM settings WHERE key=?', 'reader');
  return row ? { ...defaultReaderSettings, ...JSON.parse(row.data) } : defaultReaderSettings;
}

export async function saveReaderSettings(settings: ReaderSettings) {
  await (await db()).runAsync('INSERT OR REPLACE INTO settings VALUES (?, ?)', 'reader', JSON.stringify(settings));
}

export async function getServerSettings(): Promise<ServerSettings> {
  const row = await (await db()).getFirstAsync<{ data: string }>('SELECT data FROM settings WHERE key=?', 'server');
  return { url: row?.data ?? '', token: await SecureStore.getItemAsync('folio-server-token') ?? '' };
}

export async function saveServerSettings(settings: ServerSettings) {
  const url = validateServerUrl(settings.url);
  if (!settings.token.trim()) throw new Error('Ingresá el API_TOKEN del servidor, no la clave de Grok.');
  await SecureStore.setItemAsync('folio-server-token', settings.token.trim());
  await (await db()).runAsync('INSERT OR REPLACE INTO settings VALUES (?, ?)', 'server', url);
}
