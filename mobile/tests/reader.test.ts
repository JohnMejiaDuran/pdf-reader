import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBook, selectionText, resolveColumns } from '../src/domain/book';
import { createReaderHtml } from '../src/reader/html';

const book = {
  version: 1, id: 'test', title: 'Botánica', assets: [], warnings: [], blocks: [
    { id: 'a', kind: 'paragraph', text: 'Las hojas verdes', sourcePage: 1 },
    { id: 'b', kind: 'paragraph', text: 'reciben luz solar.', sourcePage: 2 },
  ],
};

test('multi-block selection uses stable text offsets, not screen pages', () => {
  const validated = validateBook(book);
  assert.equal(selectionText(validated, { blockId: 'a', offset: 10 }, { blockId: 'b', offset: 7 }), 'verdes\nreciben');
  assert.throws(() => selectionText(validated, { blockId: 'a', offset: 100 }, { blockId: 'b', offset: 7 }));
});

test('rejects traversal, remote resources and duplicate block IDs', () => {
  assert.throws(() => validateBook({ ...book, assets: ['../secret.png'] }));
  assert.throws(() => validateBook({ ...book, assets: ['https://example.org/x.png'] }));
  assert.throws(() => validateBook({ ...book, blocks: [book.blocks[0], book.blocks[0]] }));
});

test('automatic columns depend on width and allow manual override', () => {
  assert.equal(resolveColumns('auto', 390), 1);
  assert.equal(resolveColumns('auto', 1024), 2);
  assert.equal(resolveColumns('two', 390), 2);
});

test('PDF text is escaped, script payloads cannot break out of embedded JSON', () => {
  const malicious = validateBook({ ...book, title: '</script><script>alert(1)</script>', blocks: [
    { ...book.blocks[0], text: '<img src=x onerror=alert(1)>' },
  ] });
  const html = createReaderHtml(malicious, [], { fontSize: 20, lineHeight: 1.7, theme: 'paper', columns: 'auto' });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('Content-Security-Policy'));
});
