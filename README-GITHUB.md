# SIGESTEC — Paquete GitHub Pages · Cambio 11

Este paquete contiene la versión de desarrollo Cambio 11 preparada para publicarse como beta en GitHub Pages.

## Publicación
1. Hacé una copia de seguridad del repositorio actual antes de reemplazar archivos.
2. Descomprimí este paquete.
3. Subí **el contenido completo de esta carpeta** a la raíz del mismo repositorio GitHub que ya aloja SIGESTEC (no subas la carpeta contenedora como un nivel adicional).
4. Conservá el mismo repositorio y la misma URL de GitHub Pages.
5. Esperá a que GitHub Pages termine de publicar.

## Actualización de la PWA
- Se incrementó el nombre de caché del service worker y se incluyó `src/srt.js` en los recursos precargados.
- En esta primera migración desde la beta anterior, el service worker nuevo se activa automáticamente; la instalación existente toma los archivos nuevos al volver a abrirla. La versión que ya estaba abierta puede necesitar una recarga o volver a abrirse una vez.
- En las próximas actualizaciones, la versión nueva mostrará un aviso «Hay una actualización de SIGESTEC» con el botón **Actualizar**.
- Al pulsarlo, la aplicación activa la nueva versión y recarga la página.
- Si el usuario cierra el aviso, la versión nueva se ofrecerá nuevamente al abrir la aplicación o cuando el navegador vuelva a comprobar actualizaciones.

## Datos
- La base local IndexedDB se conserva al actualizar siempre que se mantenga el mismo origen (misma URL, protocolo y dominio) y no se borren los datos del navegador.
- Los datos de `localhost` y GitHub Pages son independientes.
- La aplicación sigue siendo local/offline-first; no sincroniza datos entre dispositivos.

## Prueba local
Desde esta carpeta, ejecutar:

```powershell
py -m http.server 8000
```

Abrir `http://localhost:8000`.

## Alcance de verificación
Se verificaron la sintaxis de los módulos JavaScript, las rutas de recursos del service worker y la integridad del paquete. La publicación en GitHub y la actualización real de una instalación existente deben comprobarse después de subirlo.
