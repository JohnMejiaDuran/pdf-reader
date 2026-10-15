import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, requestAssistance } from '../src/services/api';
import { validateServerUrl } from '../src/domain/server';

test('plaintext development URLs require a complete private host identity', () => {
  for (const url of ['http://localhost.attacker.example', 'http://192.168.attacker.example', 'http://10.example.org', 'http://8.8.8.8', 'https://user:password@example.org']) {
    assert.throws(() => validateServerUrl(url), url);
  }
  assert.equal(validateServerUrl('http://192.168.1.8:8000/'), 'http://192.168.1.8:8000');
  assert.equal(validateServerUrl('http://localhost:8000'), 'http://localhost:8000');
  assert.equal(validateServerUrl('https://folio.up.railway.app'), 'https://folio.up.railway.app');
});

test('rejects absent configuration before contacting a server', async () => {
  await assert.rejects(api({ url: '', token: '' }, '/jobs'), /Configurá/);
});

test('keeps structured expiry errors so the import can be retried', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ detail: 'El trabajo expiró.' }), { status: 404 }));
  await assert.rejects(api({ url: 'https://example.org', token: 'personal' }, '/jobs/expired'), e => e instanceof ApiError && e.status === 404);
});

test('sends only selected context and personal server token, with bounded input', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const headers = options.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer personal-token');
    const body = JSON.parse(options.body as string);
    assert.equal(body.text.length, 24000);
    assert.equal(body.context.length, 4000);
    assert.equal(body.action, 'summarize');
    return new Response(JSON.stringify({ answer: 'Resumen', model: 'configured' }));
  });
  const response = await requestAssistance({ url: 'https://example.org', token: 'personal-token' }, 'summarize', 'a'.repeat(25000), 'b'.repeat(5000));
  assert.equal(response.answer, 'Resumen');
});
