import { Book } from './book';

const paragraphs = [
  'Leer es una conversación que atraviesa el tiempo. Una página puede abrir una pregunta, acompañar una idea o cambiar la forma en que miramos algo cotidiano. Este pequeño libro es un lugar para probar tu nueva biblioteca.',
  'Mantené presionada una palabra y extendé la selección. Podés guardar un subrayado, pedir una definición o explorar el sentido de un fragmento. Tus marcas quedan en el dispositivo: no dependen del número de pantalla.',
  'El texto se acomoda a vos. Cuando cambiás el tamaño de la letra, las páginas vuelven a organizarse. Una ilustración sigue junto a su explicación, aunque ahora ocupe otra pantalla. Esa es la diferencia entre una página fija y una lectura adaptable.',
  'Una biblioteca personal no necesita ser enorme. A veces alcanza con un libro que queremos volver a leer, una tabla que nos ayuda a estudiar y unas pocas frases que no queremos olvidar. El valor está en las conexiones que hacemos mientras leemos.',
];
export const demoBook: Book = {
  version: 1, id: 'folio-welcome', title: 'El arte de leer despacio', assets: [], warnings: [],
  blocks: [
    { id: 'title', kind: 'heading', text: 'El arte de leer despacio', sourcePage: 1 },
    ...Array.from({ length: 16 }, (_, i) => ({ id: `paragraph-${i}`, kind: 'paragraph' as const, text: paragraphs[i % paragraphs.length]!, sourcePage: Math.floor(i / 3) + 1 })),
    { id: 'table', kind: 'table', text: 'Modo\nPara qué sirve\nUna página\nLeer en el celular\nDos páginas\nLeer en tablet horizontal', sourcePage: 6, rows: 3, cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1, text: 'Modo', header: true },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1, text: 'Para qué sirve', header: true },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1, text: 'Una página', header: false },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1, text: 'Leer en el celular', header: false },
      { row: 2, col: 0, rowSpan: 1, colSpan: 1, text: 'Dos páginas', header: false },
      { row: 2, col: 1, rowSpan: 1, colSpan: 1, text: 'Leer en tablet horizontal', header: false },
    ] },
    { id: 'end', kind: 'paragraph', text: 'Este es un libro de demostración, no el resultado de convertir un PDF. Configurá tu servidor en Ajustes para importar tus propios documentos y activar Grok.', sourcePage: 7 },
  ],
};
