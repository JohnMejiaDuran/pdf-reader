# Folio

Lector de PDFs convertidos a texto adaptable para **Android con Expo Go**. Biblioteca, PDFs originales, subrayados y respuestas guardadas viven en el dispositivo. La conversión usa Docling en un backend Python y las consultas de IA usan la API de Grok.

## Probar ahora en Expo Go

Requisitos: Node 22.13+ (verificado con Node 24), Expo Go actualizado para SDK 57 y teléfono/PC en la misma red.

```powershell
cd C:\pdf-reader\mobile
npm install
npm start
```

Escaneá el QR con **Expo Go** en Android. No hace falta Android Studio, `expo prebuild`, EAS ni compilar un APK. El primer inicio incorpora un libro de demostración para probar paginación, tipografía, subrayados y cuaderno sin servidor. El demo no simula una conversión ni respuestas de IA.

Si la red bloquea Metro, probá `npx expo start --go --tunnel` (puede pedir instalar el soporte de túnel). La documentación actual y npm indicaron SDK 57 al crear este proyecto; una versión antigua de Expo Go puede requerir actualización. Las versiones exactas están en `mobile/package-lock.json`.

## Funciones implementadas

- Importar PDF desde el selector de Android, conservar el original y mostrar estado de conversión.
- Reanudar consulta/descarga de trabajos pendientes al volver a abrir la app; reintentar cargas fallidas.
- Texto adaptable por columnas, vista una/dos páginas/automática (dos desde 840 puntos de ancho), cambio de letra, interlineado y papel/sepia/noche.
- Cambio de página por botones o gesto horizontal rápido; transición horizontal animada. **No es una animación física de papel curvado.** La selección de texto tiene prioridad sobre el gesto.
- Imágenes y tablas intercaladas; tablas anchas con desplazamiento horizontal. La fidelidad depende de la extracción y del documento.
- Subrayados persistidos como bloque + offset de texto, cuaderno para ir a la marca y quitarla.
- Definir, explicar y resumir selección; resumir desde la posición actual hasta el siguiente encabezado (máximo 24.000 caracteres). Las respuestas se guardan automáticamente.
- Biblioteca local, búsqueda por título, retomar lectura y eliminación con confirmación.
- Compartir/abrir el PDF original mediante el selector de Android.

## Backend local

Python 3.11 recomendado. La instalación de Docling/PyTorch y la primera descarga de modelos pueden tardar y ocupar varios GB.

```powershell
cd C:\pdf-reader\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[conversion,test]"
```

Creá `backend/.env` a partir de `.env.example` y completá:

```dotenv
API_TOKEN=un-token-personal-largo-y-aleatorio
XAI_API_KEY=tu-clave-de-xai
XAI_MODEL=el-id-exacto-del-modelo-habilitado-en-tu-cuenta
DATA_DIR=./data
```

La clave xAI **nunca** va en la app ni en una variable `EXPO_PUBLIC_*`. Podés omitir XAI_API_KEY/XAI_MODEL para probar conversiones; el asistente devolverá un error explícito hasta configurarlos. No hay un modelo ni precios asumidos: usá un ID habilitado en tu cuenta de API.

```powershell
.\.venv\Scripts\python -m uvicorn folio.api:app_factory --factory --host 0.0.0.0 --port 8000 --workers 1
```

En **Ajustes** de la app ingresá `http://192.168.x.x:8000` (IP local de tu PC, no `localhost`) y el valor de `API_TOKEN`. La red/firewall debe permitir el puerto 8000. El acceso HTTP local también está sujeto a la política de red de la versión de Expo Go; para una conexión estable usá la URL HTTPS de Railway.

## Railway

El proyecto está preparado para desplegar; no se crearon recursos ni se desplegó automáticamente.

1. Subí este proyecto a tu repositorio o desplegá la carpeta `backend` con Railway CLI.
2. Si conectás el monorepo desde GitHub, configurá **Root Directory: `/backend`**. Dockerfile y `railway.toml` están allí.
3. Creá un **volumen montado en `/data`**. La cola SQLite y archivos dependen de ese volumen; no uses almacenamiento efímero para ellos.
4. Configurá `API_TOKEN`, `XAI_API_KEY`, `XAI_MODEL`, `DATA_DIR=/data`, `HF_HOME=/data/models/huggingface`. El Dockerfile ya define las dos últimas rutas.
5. **Una réplica y un solo worker Uvicorn**. Esta implementación tiene un conversor serial y no es una cola distribuida. No actives suspensión del servicio mientras esperás que convierta trabajos.
6. Generá un dominio HTTPS y ponelo en Ajustes de la app junto al API_TOKEN.

El backend usa CPU. El consumo de RAM y el tiempo de conversión dependen de páginas, OCR y modelos; medí con tus PDFs antes de fijar un límite de memoria o costo. `/health` comprueba HTTP, no precarga ni comprueba modelos/Grok. La primera conversión descarga modelos.

Los trabajos listos/fallidos expiran tras 24 horas y se limpian periódicamente. La app descarga todos los recursos antes de marcar el libro disponible offline. El original local no se borra al expirar el trabajo. Ante un trabajo expirado, reintentá la importación desde la biblioteca.

### Endpoints

Salvo `/health`, todos requieren `Authorization: Bearer <API_TOKEN>`.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Salud HTTP |
| POST | `/jobs` | Multipart `file`, PDF hasta 50 MB |
| GET | `/jobs/{id}` | Estado persistente |
| GET | `/jobs/{id}/manifest` | Contenido estructurado, una vez listo |
| GET | `/jobs/{id}/assets/{name}` | Ilustraciones PNG del manifest |
| POST | `/assist` | `{action: define/explain/summarize, text, context}` |

El servidor limita a tres conversiones pendientes y 500 páginas por PDF. La API usa token personal compartido, adecuada para este prototipo de un usuario; no implementa cuentas o aislamiento multiusuario.

## Verificación sin builds

```powershell
cd C:\pdf-reader\mobile
npm run typecheck
npm test
npx expo install --check

cd C:\pdf-reader\backend
.\.venv\Scripts\python -m pytest -q
```

Prueba real de Docling, con descarga de modelos y sin gastar API de xAI:

```powershell
$env:RUN_DOCLING="1"
.\.venv\Scripts\python -m pytest tests/test_docling_integration.py -v -s
```

Preview del **motor de lectura solamente**, no de la app nativa:

```powershell
cd C:\pdf-reader\mobile
npm run reader:preview
```

Abrí `http://127.0.0.1:8765`. Los controles de prueba se exponen en `window.folio` (`next()`, `previous()`, `jump(anchor)`, `settings(settings)`). No hace falta generar un bundle.

## Límites que hay que comprobar en Android

- No se ejecutó la app en un teléfono físico durante esta sesión. Verificar selector de archivos, WebView con recursos locales, selección con manijas, persistencia tras cerrar Expo Go y volver en modo avión.
- Las pruebas automatizadas de PDFs reales cubren texto, una ilustración raster y una tabla en muestras pequeñas; no certifican todos los escaneados, fórmulas, figuras o tablas complejas.
- El lector arma un documento HTML por libro. Libros muy extensos pueden consumir memoria en WebView; no hay carga por capítulos todavía.
- Las definiciones son generadas por IA, no resultados de un diccionario. Respuestas limitadas al contexto enviado; no se promete un resumen íntegro de un libro grande.
- Sin sincronización ni copia de seguridad: borrar los datos de Expo Go puede borrar la biblioteca.

## Estructura

```text
mobile/        Expo Go, SQLite, filesystem, lector WebView y pantallas
backend/       FastAPI, cola SQLite, conversión Docling y proxy Grok
docs/          diseño, plan y registro de comprobaciones
```
