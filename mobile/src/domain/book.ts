export type Anchor = { blockId: string; offset: number };
export type Selection = { start: Anchor; end: Anchor; quote: string };
export type Highlight = Selection & { id: string; bookId: string; createdAt: number };
export type Cell = { row: number; col: number; rowSpan: number; colSpan: number; text: string; header: boolean };
export type Block = {
  id: string; kind: 'heading' | 'paragraph' | 'image' | 'table'; text: string;
  sourcePage: number; asset?: string; caption?: string; cells?: Cell[]; rows?: number;
};
export type Book = { version: 1; id: string; title: string; blocks: Block[]; assets: string[]; warnings: string[] };
export type ReaderSettings = { fontSize: number; lineHeight: number; theme: 'paper' | 'sepia' | 'night'; columns: 'auto' | 'one' | 'two' };
export const defaultReaderSettings: ReaderSettings = { fontSize: 20, lineHeight: 1.75, theme: 'paper', columns: 'auto' };

export function validateBook(value: unknown): Book {
  const b = value as Book;
  if (!b || b.version !== 1 || !/^[\w-]+$/.test(b.id) || typeof b.title !== 'string'
    || !Array.isArray(b.blocks) || b.blocks.length === 0 || !Array.isArray(b.assets) || !Array.isArray(b.warnings)) {
    throw new Error('El paquete de lectura no es válido.');
  }
  if (b.assets.some(a => typeof a !== 'string' || !/^[\w-]+\.png$/.test(a))) throw new Error('Recurso no permitido.');
  const ids = new Set<string>();
  for (const block of b.blocks) {
    if (!block || !/^[\w-]+$/.test(block.id) || ids.has(block.id) || typeof block.text !== 'string'
      || !['heading', 'paragraph', 'image', 'table'].includes(block.kind)
      || !Number.isInteger(block.sourcePage) || block.sourcePage < 1) throw new Error('Bloque de lectura no válido.');
    ids.add(block.id);
    if (block.kind === 'image' && (!block.asset || !b.assets.includes(block.asset))) throw new Error('Falta una ilustración.');
    if (block.kind === 'table' && (!Array.isArray(block.cells) || !Number.isInteger(block.rows) || block.rows! < 1
      || block.cells.some(c => !Number.isInteger(c.row) || c.row < 0 || c.row >= block.rows!
        || !Number.isInteger(c.col) || c.col < 0 || !Number.isInteger(c.rowSpan) || c.rowSpan < 1
        || !Number.isInteger(c.colSpan) || c.colSpan < 1 || typeof c.text !== 'string'))) throw new Error('Tabla no válida.');
  }
  return b;
}

export function selectionText(book: Book, start: Anchor, end: Anchor): string {
  const first = book.blocks.findIndex(b => b.id === start.blockId);
  const last = book.blocks.findIndex(b => b.id === end.blockId);
  if (first < 0 || last < first || start.offset < 0 || end.offset < 0
    || start.offset > book.blocks[first]!.text.length || end.offset > book.blocks[last]!.text.length
    || (first === last && start.offset > end.offset)) throw new Error('Selección inválida.');
  return book.blocks.slice(first, last + 1).map((b, i, blocks) =>
    b.text.slice(i === 0 ? start.offset : 0, i === blocks.length - 1 ? end.offset : undefined)).join('\n');
}

export function resolveColumns(mode: ReaderSettings['columns'], width: number): 1 | 2 {
  return mode === 'two' || (mode === 'auto' && width >= 840) ? 2 : 1;
}
