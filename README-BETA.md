# SIGESTEC — Beta 0.1

Copia independiente de Gestión Técnica v0.5.6 preparada para una primera publicación web mediante GitHub Pages.

## Importante sobre los datos
- La aplicación guarda los datos en IndexedDB del navegador y dispositivo donde se utiliza.
- La beta publicada tendrá una base de datos independiente de `localhost:8000`.
- Los datos no se sincronizan entre dispositivos ni se envían a un servidor.
- No cargar información sensible ni datos reales de clientes durante esta beta.

## Publicación
Subir el contenido de esta carpeta a la raíz de un repositorio GitHub y habilitar GitHub Pages desde la rama principal (`main`), carpeta `/ (root)`. GitHub Pages proporciona HTTPS.

El `manifest.webmanifest`, los iconos y el service worker usan rutas relativas para admitir la publicación en la URL de proyecto de GitHub Pages.

## Alcance de la prueba
La beta permite probar la interfaz publicada, la instalación PWA en Android y el comportamiento offline luego de la primera carga. La sincronización entre dispositivos no está implementada.
