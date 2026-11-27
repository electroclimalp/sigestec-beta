# SIGESTEC · v0.5.65 · Cambio 71

## Cambio 71 — Generador local de temas desde logotipo

- Se incorpora carga local de logotipos PNG, JPG, WEBP y SVG.
- El archivo se procesa en el navegador mediante FileReader, Image y Canvas; no se envía a servicios externos.
- Se limita el tamaño de entrada a 8 MB y se normaliza la imagen a un lienzo de hasta 512 px.
- Se genera una paleta de marca con color dominante, color de contraste, superficie clara y tono profundo.
- Se agrega el tema «Mi marca» al selector cuando existe una paleta generada.
- La paleta puede previsualizarse y aplicarse mediante el flujo existente Aplicar / Cancelar / Restablecer.
- La preferencia se guarda en el registro existente settings/appearance, sin migración de IndexedDB.
- Se conservan los nueve temas prediseñados, estilos de botones, relieves y módulos funcionales.

## Alcance y limitaciones
- El análisis cromático es heurístico y local; no es un servicio de diseño ni garantiza que toda combinación generada cumpla WCAG. La aplicación utiliza texto claro/oscuro automático para el botón principal.
- El logotipo se conserva junto a la paleta generada para habilitar su uso posterior en documentos.
- La aplicación de la identidad del logotipo a las plantillas de impresión/PDF queda como integración siguiente; este cambio incorpora el motor de extracción y el tema de interfaz, no modifica todavía los formatos documentales.
- No se modifican módulos funcionales, cálculos, catálogos, materiales, presupuestos ni registros existentes.
- No se modifica el esquema de IndexedDB.

## Verificaciones
- Validación de sintaxis de módulos ES: corregida y repetida en Cambio 72.
- Integridad ZIP de Cambio 71: verificada al empaquetar.
- Prueba visual real en navegador: pendiente de validación del usuario.
- Caché Service Worker de Cambio 71: sigestec-shell-v78 (reemplazada por v79 en Cambio 72).

# SIGESTEC · v0.5.66 · Cambio 72

## Cambio 72 — Corrección de arranque y caché

- Se corrige la expresión regular de validación MIME del logotipo en `src/app.js`. La versión anterior contenía barras invertidas duplicadas que provocaban un `SyntaxError` y detenían la ejecución completa de la aplicación.
- Se limita la interceptación y el almacenamiento del Service Worker a solicitudes HTTP/HTTPS del mismo origen. Así se evitan intentos de guardar recursos `chrome-extension://` u otros orígenes ajenos a SIGESTEC.
- Se incrementa la versión de caché a `sigestec-shell-v79` para forzar la actualización de los recursos de la aplicación.
- No se modifican datos, esquema IndexedDB, módulos funcionales, cálculos, catálogos ni plantillas.

## Verificaciones del Cambio 72
- Sintaxis de todos los módulos JavaScript de `src/` validada en modo módulo ES.
- Sintaxis de `sw.js` validada.
- Integridad del ZIP validada después del empaquetado.
- No se realizó prueba de ejecución en un navegador real; la validación final de arranque queda pendiente de la instalación del usuario.
