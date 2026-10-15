import { Anchor, Block, Book, Highlight, ReaderSettings } from '../domain/book';
import { readerRuntime } from './runtime';

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function renderBlock(block: Block, assets: Record<string, string>): string {
  const attributes = `id="${escapeHtml(block.id)}" data-block data-page="${block.sourcePage}"`;
  if (block.kind === 'image') return `<figure ${attributes}><img src="${escapeHtml(assets[block.asset!] ?? '')}" alt="${escapeHtml(block.caption ?? 'Ilustración del documento')}"><figcaption>${escapeHtml(block.caption ?? '')}</figcaption></figure>`;
  if (block.kind === 'table') {
    const cells = block.cells ?? [];
    return `<div class="table-wrap" ${attributes}><table>${Array.from({ length: block.rows ?? 0 }, (_, row) => `<tr>${cells.filter(c => c.row === row).map(c => {
      const tag = c.header ? 'th' : 'td';
      return `<${tag} rowspan="${c.rowSpan}" colspan="${c.colSpan}">${escapeHtml(c.text)}${cells.indexOf(c) < cells.length - 1 ? '\n' : ''}</${tag}>`;
    }).join('')}</tr>`).join('')}</table></div>`;
  }
  const tag = block.kind === 'heading' ? 'h2' : 'p';
  return `<${tag} ${attributes}>${escapeHtml(block.text)}</${tag}>`;
}

export function createReaderHtml(book: Book, highlights: Highlight[], settings: ReaderSettings, anchor?: Anchor, assets: Record<string, string> = {}): string {
  return `<!doctype html><html lang="es" data-theme="${settings.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(book.title)}</title><style>
:root{--paper:#f8f5ee;--ink:#282c28;--quiet:#767b70;--rule:#dadbd0;--mark:#f3d77c}
:root[data-theme=sepia]{--paper:#eee2ca;--ink:#45392b;--quiet:#82735b;--rule:#d1c4ab}
:root[data-theme=night]{--paper:#202621;--ink:#e3e8dc;--quiet:#a6b09f;--rule:#455142;--mark:#7b651f}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--paper);color:var(--ink)}
#viewport{position:absolute;inset:24px 28px 42px;overflow:hidden;touch-action:pan-y}
#book{height:100%;width:100%;column-gap:40px;column-fill:auto;font-family:Georgia,'Noto Serif',serif;overflow:visible;will-change:transform;orphans:2;widows:2}
p{margin:0 0 1em;text-align:start;overflow-wrap:break-word}h2{font-size:1.6em;line-height:1.2;margin:0 0 .9em;break-after:avoid;font-weight:500;letter-spacing:-.03em}
figure{margin:12px 0 24px;break-inside:avoid}img{display:block;max-width:100%;max-height:55vh;object-fit:contain;margin:auto}figcaption{font:13px/1.5 sans-serif;color:var(--quiet);margin-top:8px}
.table-wrap{max-width:100%;overflow-x:auto;break-inside:avoid;margin:16px 0 24px}table{border-collapse:collapse;font:14px/1.5 sans-serif;min-width:100%}td,th{padding:10px 12px;border-bottom:1px solid var(--rule);min-width:100px;text-align:left}th{font-weight:600}mark{background:var(--mark);color:inherit;border-radius:2px}
#position{position:absolute;bottom:12px;left:0;right:0;text-align:center;color:var(--quiet);font:12px/1.4 sans-serif;font-variant-numeric:tabular-nums;user-select:none}
@media(min-width:840px){#viewport{inset:32px 48px 48px}}
</style></head><body><div id="viewport"><article id="book">${book.blocks.map(b => renderBlock(b, assets)).join('')}</article></div><div id="position" aria-live="polite"></div>
<script id="reader-data" type="application/json">${scriptJson({ book, highlights, settings, anchor })}</script><script>${readerRuntime}</script></body></html>`;
}
