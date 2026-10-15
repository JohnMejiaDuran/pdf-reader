# Registro de verificación — 2026-10-15

## Entorno
- Windows, Node 24.15.0, Python 3.11.9.
- Expo estable verificado en npm/docs: 57.0.30, React Native 0.86.3, React 19.2.3; versiones ajustadas por `expo install --fix`.
- Solo módulos incluidos en Expo Go. `expo-doctor`: 21/21 comprobaciones aprobadas. `expo install --check`: dependencias compatibles.
- Sin builds de APK, Docker ni bundles de producción. Sin commits ni despliegues.

## Pruebas
- `mobile`: `npm run typecheck`, `npm test` (8 pruebas de dominio/API).
- `backend`: 15 pruebas de contratos de conversión, autenticación previa a lectura del cuerpo, límites de upload incluyendo chunked con interrupción del consumo, cola recuperable, expiración, Grok y errores sin filtrar secretos.
- Integración Docling ejecutada explícitamente con modelos reales: PDF textual y PDF con ilustración raster + tabla. Ambos aprobados. Se comprobó extracción de PNG y contenido de tabla.
- Navegador Chromium, motor HTML real: 390×760 y 1024×768. Ocho comprobaciones: resumen desde offset visible, restauración al cambiar fuente, selección entre párrafos, pintura multi-bloque de subrayados, dos columnas automáticas, override manual, posición en página de solo imagen y restauración de esa posición.
- Se inspeccionaron capturas del lector en teléfono y tablet. El preview NO sustituye la app nativa.

## Revisión y correcciones
- Se verificó que FastAPI parseaba multipart antes de dependencias. Agregado middleware ASGI que autentica antes de leer el cuerpo y limita bytes antes del spool, incluso sin Content-Length.
- Se corrigió medición de anclas durante una transición CSS activa, que podía saltar una página al cambiar tamaño de letra.
- Se agregaron anclas geométricas para páginas sin texto (imágenes).
- Se corrigió resumen de sección para comenzar en el offset visible, no al principio del párrafo.
- Se reemplazó regex de prefijos HTTP por validación de identidad completa de localhost/IP privada.
- La salida del lector espera el guardado de posición antes de recargar la biblioteca, incluidos botones físicos de Android.

## Pendientes explícitos
- Abrir en teléfono Android con Expo Go: selector de documentos, carga multipart nativa, manijas de selección, imágenes locales y modo avión tras reinicio.
- Configurar Railway real: volumen /data, una réplica, variables y dominio HTTPS. No se ha desplegado.
- Configurar XAI_API_KEY y XAI_MODEL, y probar una consulta real; las pruebas de contrato no gastaron API.
- Verificar fidelidad con documentos propios complejos. Los ejemplos de integración no garantizan cualquier PDF.
- `npm audit` informa advisories transitivos del tooling de Expo/Metro (23 al instalar); sus propuestas automáticas incluyen downgrades incompatibles de SDK. No se aplicó `audit fix --force`. Reevaluar al actualizar Expo.
- Advertencias de deprecación de terceros en Python (Starlette/AnyIO, Docling/Pydantic) no causaron fallos de pruebas.

## Memoria
Las llamadas a Engram fallaron por resolución ambigua de proyecto desde C:\ (asphalts/blog). El diseño, decisiones, plan y este registro se conservaron en el propio proyecto.
