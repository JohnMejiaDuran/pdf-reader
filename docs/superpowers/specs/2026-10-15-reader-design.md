# Folio — diseño aprobado

## Alcance
Android (celulares y tablets), React Native y Expo. Biblioteca sin cuentas, local al dispositivo. Conversión de PDF en Railway y asistencia con API de xAI/Grok. El usuario aprobó la arquitectura y pidió implementarla desde cero en este directorio.

## Contrato de lectura
El PDF se transforma en bloques ordenados: título, párrafo, imagen, tabla y pie de figura. Cada bloque conserva una referencia estable y página del PDF original. Las imágenes se descargan antes de registrar un libro como disponible offline. Se conserva el PDF original localmente.

Texto adaptable, tamaño e interlineado ajustables, papel/sepia/noche, modo una/dos páginas/automático. Automático usa dos páginas a partir de 840 puntos de ancho. Una doble página forzada en un teléfono puede ser estrecha. El paso de página usa desplazamiento horizontal animado, no una simulación física de papel curvado. La selección de texto tiene prioridad sobre el gesto de pasar página. Las tablas anchas permiten desplazamiento horizontal.

Los subrayados guardan inicio y fin como bloque + offset UTF-16 y texto exacto, no número de pantalla. La posición de lectura usa el mismo tipo de ancla y sobrevive a cambios tipográficos. Una reconversión genera un libro distinto, sin migración automática de anotaciones.

## App
Expo SDK 57 (versión estable verificada en npm y docs), compatible con Expo Go actual: requisito explícito del usuario durante implementación. TypeScript, SQLite para metadatos, subrayados, respuestas y ajustes; filesystem privado para paquetes, recursos y PDFs; WebView para el motor de texto paginado. Solo módulos incluidos en Expo Go, sin development builds ni prebuild. Un libro de demostración permite probar sin servidor ni clave. La configuración del servidor y su token se ingresan en la app; token en SecureStore, nunca clave xAI.

## Backend
FastAPI con endpoints autenticados por token personal del servidor. SQLite y archivos en volumen /data. Cola durable de trabajos en SQLite, un conversor por proceso, recuperación tras reinicio, límites de tamaño y páginas. El proceso usa un thread de trabajo para no bloquear HTTP. Un solo proceso/réplica en esta primera versión. Docling se carga solamente al convertir, con extracción de imágenes, tablas y OCR. El cliente consulta progreso y descarga manifest y recursos. Los trabajos expiran después de 24 horas; limpieza periódica. Estado de error explícito; no se declara éxito si no hay contenido.

Grok define, explica y resume fragmentos (máximo 24.000 caracteres). Respuestas guardadas localmente. Sin clave/modelo configurados, el endpoint devuelve error de configuración; nunca simula una respuesta. Clave solo en Railway. No se envía automáticamente el libro completo a xAI.

## Fidelidad y comprobación
La reconstrucción es aproximada. Tablas y documentos escaneados requieren inspección humana; el original se conserva para consulta externa. Las pruebas de contrato usan documentos estructurados y un PDF pequeño. Una prueba de integración real de Docling se ejecuta de forma explícita porque descarga modelos y consume recursos. Android requiere verificación en dispositivo; las pruebas del motor web no sustituyen esa verificación.

## Dirección visual
Biblioteca de estudio tranquila: papel marfil, tinta carbón, verde encuadernación, sepia y amarillo subrayador. El libro actual domina; sin métricas ficticias. Tipografía serif en lectura, sans del sistema en controles. Espaciado base 4, controles de al menos 44 puntos. Firma: lomo de libro, marca de lectura y referencia persistente al PDF original. Se evita cuadrícula de dashboard, acentos neón y controles flotantes sobre el texto.

## Exclusiones
Sin sincronización, cuentas, tienda, pagos ni publicación en Play Store. El despliegue real requiere confirmación y credenciales de Railway/xAI; se entrega configuración reproducible, sin inventar recursos ni claves.
