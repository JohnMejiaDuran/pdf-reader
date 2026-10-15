import type { ServerSettings } from '../storage/library';

export type Action = 'define' | 'explain' | 'summarize';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(settings: ServerSettings, path: string, options: RequestInit = {}): Promise<T> {
  if (!settings.url || !settings.token) throw new Error('Configurá la URL y el token del servidor en Ajustes.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path === '/jobs' ? 120000 : 100000);
  try {
    const response = await fetch(`${settings.url}${path}`, {
      ...options, signal: controller.signal,
      headers: { Authorization: `Bearer ${settings.token}`, ...options.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: unknown };
      throw new ApiError(typeof body.detail === 'string' ? body.detail : `El servidor respondió ${response.status}.`, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('La conexión tardó demasiado. Podés volver a intentarlo.');
    throw error;
  } finally { clearTimeout(timer); }
}

export const requestAssistance = (settings: ServerSettings, action: Action, text: string, context = '') =>
  api<{ answer: string; model: string }>(settings, '/assist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, text: text.slice(0, 24000), context: context.slice(0, 4000) }),
  });
