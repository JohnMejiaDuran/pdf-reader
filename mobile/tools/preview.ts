import { createServer } from 'node:http';
import { createReaderHtml } from '../src/reader/html';
import { Book, defaultReaderSettings, Highlight } from '../src/domain/book';
import { demoBook } from '../src/domain/demo';

const mark: Highlight = { id: 'preview', bookId: demoBook.id, createdAt: 0, start: { blockId: 'paragraph-0', offset: 0 }, end: { blockId: 'paragraph-0', offset: 42 }, quote: demoBook.blocks[1]!.text.slice(0, 42) };
const html = createReaderHtml(demoBook, [mark], defaultReaderSettings);
const imageBook: Book = { version: 1, id: 'image-book', title: 'Image-only regression fixture', warnings: [],
  assets: ['picture.png'], blocks: [1, 2, 3].map(n => ({ id: `picture-${n}`, kind: 'image', text: '', caption: '', asset: 'picture.png', sourcePage: n })) };
const picture = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1000"><rect width="400" height="1000" fill="#345445"/><circle cx="200" cy="400" r="120" fill="#c5d6ad"/></svg>').toString('base64')}`;
createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(request.url === '/images' ? createReaderHtml(imageBook, [], defaultReaderSettings, undefined, { 'picture.png': picture }) : html);
}).listen(8765, '127.0.0.1', () => console.log('Reader-only preview: http://127.0.0.1:8765 (not the native app).'));
