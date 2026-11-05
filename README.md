# UIspa

Extensión para **Chrome**, **Firefox** y **Safari** (experimental) que da a [Hispashare](https://www.hispashare.org) un diseño más limpio y moderno, facilita copiar los enlaces ed2k o enviarlos a Synology Download Station y, si quieres, te dice qué tienes ya en tu servidor Plex o Jellyfin.

> Proyecto no oficial. No tiene relación con Hispashare: solo cambia cómo se ve la web en tu navegador y no aloja ni distribuye ningún contenido.

## Qué hace

**Rediseño**
- Tema oscuro con una barra superior compacta: buscador, géneros, «Popular» y tu cuenta.
- Portada y búsquedas en cuadrícula de carátulas grandes, con nota, tipo, año y géneros. Al pasar el ratón se ve la sinopsis.
- Ficha de cada título con la carátula grande, notas de IMDb y usuarios, ficha técnica, sinopsis y reparto.
- Paginación compacta, diseño adaptable a pantallas pequeñas y texto ampliado.
- Botón ◐ para volver al diseño original cuando quieras.

**Copiar enlaces**
- Botón 📋 junto a cada capítulo o archivo.
- «Copiar seleccionados» y «Copiar todos» en cada versión de una serie; «Copiar enlace» en las películas.
- Botón «Copiar» en la ventana de enlaces de la propia web.
- Atajos: `Alt+Shift+C` copia todos los enlaces de la página y `Alt+Shift+S` los capítulos marcados. También desde el menú del botón derecho o el icono de la barra.
- Los atajos se pueden cambiar en `chrome://extensions/shortcuts` (Chrome) o en `about:addons` → rueda dentada ⚙ → **Gestionar atajos de teclado de extensiones** (Firefox).

**Enviar a Synology Download Station (opcional)**
- Botón 📥 junto a cada capítulo o archivo, y «📥 Al NAS (seleccionados / todos)» en cada versión.
- Al enviar eliges la carpeta del NAS: aparece la carpeta por defecto y las últimas que hayas usado.

**Plex o Jellyfin (opcional)**
- En cada ficha marca qué episodios o películas tienes ya en tu servidor Plex, en Jellyfin o en los dos a la vez (una marca por servidor, en su color).
- Distingue qué versión tienes comparando el tamaño exacto de tus archivos:
  - **✓ En Plex** / **✓ En Jellyfin**: tienes exactamente ese archivo.
  - **≈ En Plex (1080p)**: lo tienes en la misma calidad, en otro archivo.
  - **En Plex en 4K**: lo tienes en otra calidad.
  - **Falta**: no lo tienes.
- Busca cada título por su código de IMDb y, si no, por título y año.

## Instalación

Descarga la última versión desde **[Releases](https://github.com/ahhhv/UIspa/releases/latest)**.

### Firefox

1. Descarga `UIspa-firefox.xpi`.
2. Arrástralo a una ventana de Firefox, o abre `about:addons` → rueda dentada ⚙ → **Instalar complemento desde archivo** y elígelo.
3. Pulsa **Añadir**.

La extensión está firmada por Mozilla y **se actualiza sola** cuando se publica una versión nueva. Requiere Firefox 140 o posterior.

### Chrome y navegadores basados en Chromium

1. Descarga `UIspa-chrome.zip` y descomprímelo. Obtendrás una carpeta `UIspa`.
2. Abre `chrome://extensions`.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y elige la carpeta `UIspa`, la que contiene `manifest.json`.

Chrome carga la extensión desde esa carpeta, así que no la borres ni la muevas. Para actualizar, descarga la nueva versión, sustituye el contenido de la carpeta y pulsa ↻ en `chrome://extensions`. Funciona en Chrome 116 o posterior, Edge, Brave, Opera y Vivaldi.

> **¿Tenías la versión 1.x de Chrome?** Antes la extensión estaba en la raíz del repositorio y ahora está en la carpeta `chrome/`. Quita la antigua en `chrome://extensions` y carga la nueva como se indica arriba. Tendrás que volver a configurar Plex o Jellyfin.

### Safari (experimental)

Safari solo permite instalar de forma permanente extensiones firmadas con una cuenta de pago de Apple, así que esta versión se compila en tu propio Mac. Necesitas macOS con **Xcode** (gratis en la App Store) y tu Apple ID.

1. Descarga el repositorio (**Code → Download ZIP**) y descomprímelo.
2. En Terminal, dentro de esa carpeta:
   ```
   ./build-safari.sh
   open xcode/UIspa/UIspa.xcodeproj
   ```
3. En Xcode, en **Signing & Capabilities** de los dos targets (**UIspa** y **UIspa Extension**), elige el mismo **Team** (tu Apple ID, *Personal Team*) y el mismo **Signing Certificate**.
4. Elige el esquema **UIspa** y **My Mac**, y pulsa ▶. Se abrirá una ventanita de UIspa: ciérrala.
5. En Safari:
   - **Ajustes → Avanzado** → marca **Mostrar funciones para desarrolladores web**.
   - **Ajustes → Desarrollador** → marca **Permitir extensiones sin firmar**.
   - **Ajustes → Extensiones** → activa **UIspa**.
   - Abre Hispashare, pulsa el icono **UI** de la barra y elige **Permitir siempre en este sitio web**. Recarga la página.

«Permitir extensiones sin firmar» se desactiva cada vez que cierras Safari: si UIspa desaparece, vuelve a marcarlo.

Limitaciones en Safari: los botones de copiar funcionan igual que en los otros navegadores, pero los atajos de teclado y el menú del botón derecho pueden no copiar.

## Conectar con Plex o Jellyfin

1. Abre los ajustes de UIspa de cualquiera de estas formas:
   - En Hispashare, menú **Más → ⚙ Ajustes de la extensión**.
   - **Chrome:** clic derecho en el icono de UIspa → **Opciones**.
   - **Firefox:** `about:addons` → UIspa → pestaña **Opciones**.
2. Elige la pestaña **Plex** o **Jellyfin** (puedes configurar los dos; un punto verde indica los conectados) y escribe la dirección de tu servidor, por ejemplo `http://192.168.1.50:32400` (Plex) o `http://192.168.1.50:8096` (Jellyfin).
3. Pega la credencial:
   - **Plex:** tu token. En Plex Web abre cualquier película o episodio → **⋯ → Obtener información → Ver XML** y copia lo que va después de `X-Plex-Token=` en la dirección.
   - **Jellyfin:** una clave de API. Con una cuenta de administrador ve a **Panel de control → Claves de API**, pulsa **+** y copia la clave.
4. Pulsa **Guardar**. El navegador te pedirá permiso para acceder solo a esa dirección.

En Safari, abre los ajustes desde el menú **Más** de Hispashare o en **Safari → Ajustes → Extensiones → UIspa → Ajustes**.

## Enviar a Synology Download Station

Requiere DSM 7 con Download Station.

1. **En el NAS:**
   - Crea un usuario solo para esto (**Panel de control → Usuario y grupo**). En los permisos de aplicaciones marca **Permitir** solo en Download Station y **Denegar** en todo lo demás.
   - Dale **lectura/escritura** en las carpetas donde quieras guardar las descargas.
   - No le actives la verificación en dos pasos.
   - En Download Station, con tu administrador: **⚙ Configuración → General → Habilitar descargas eMule**.
2. **En UIspa:** en los ajustes, sección **Descargas en el NAS (Synology)**:
   - **Dirección:** por ejemplo `http://192.168.1.10:5000`. Con HTTPS solo funciona si el NAS tiene un certificado válido; el autofirmado de fábrica lo rechaza el navegador.
   - **Usuario y contraseña** del usuario que has creado.
   - **Carpeta por defecto:** opcional, por ejemplo `docker/data`.
3. Pulsa **Guardar** y recarga Hispashare: aparecerán los botones 📥.

## Privacidad

- UIspa no recoge ni envía datos a ningún servidor propio ni de terceros. En Firefox lo declara así en su instalación (`data_collection_permissions: none`).
- Solo se comunica con Hispashare, para obtener los enlaces que ya ofrece la web, y con tu servidor Plex o Jellyfin y tu NAS Synology si los configuras.
- Las direcciones, credenciales y contraseñas se guardan únicamente en tu navegador; la contraseña del NAS viaja en el cuerpo de la petición, nunca en la dirección. Las consultas salen de la extensión, no de la página, así que la web nunca las ve. Del servidor solo se usan el tamaño y la resolución de los archivos, nunca sus rutas.

## Permisos

| Permiso | Para qué |
|---|---|
| Acceso a `hispashare.org` / `hispashare.com` | Aplicar el rediseño y añadir los botones |
| `clipboardWrite` (y `offscreen` en Chrome) | Copiar enlaces al portapapeles, también desde atajos y menús |
| `contextMenus` | Opciones del menú del botón derecho |
| `storage` | Guardar la configuración de los servidores |
| Acceso opcional a la dirección de tu servidor o NAS | Solo se pide si configuras Plex, Jellyfin o Synology, y únicamente para esa dirección |

## Estructura

```
chrome/           Extensión para Chrome (Manifest V3)
firefox/          Extensión para Firefox (Manifest V2, firmada por Mozilla)
safari/           Extensión para Safari (experimental)
build-safari.sh   Genera el proyecto de Xcode de la versión de Safari
updates.json      Aviso de actualizaciones para Firefox
```

Las tres versiones comparten el mismo código; solo cambian el manifiesto y el segundo plano:

| Archivo | Función |
|---|---|
| `manifest.json` | Definición de la extensión |
| `theme-early.js`, `theme.js`, `theme.css` | Rediseño de la web |
| `content.js`, `content.css` | Botones de copiar y avisos |
| `media.js` | Marcas de Plex o Jellyfin en las fichas |
| `background.js` | Segundo plano: atajos y menús |
| `media-bg.js`, `plex-bg.js`, `jellyfin-bg.js` | Consultas al servidor multimedia |
| `synology-bg.js` | Envío de enlaces a Download Station |
| `offscreen.html`, `offscreen.js` | Solo Chrome: copia al portapapeles desde segundo plano |
| `options.html`, `options.js`, `options.css` | Página de ajustes |

## Limitaciones

- Depende del HTML de Hispashare: si la web cambia su estructura, el rediseño o los botones pueden dejar de funcionar.
- La coincidencia exacta con el servidor se basa en el tamaño que muestra la web, redondeado a dos decimales. Si renombras o recomprimes un archivo, aparecerá como «≈» u «otra calidad».

## Novedades

**2.1.0**
- Envío de enlaces a Synology Download Station, eligiendo la carpeta en cada envío.
- Si hay dos copias de UIspa instaladas a la vez, ya no se estorban: solo trabaja una.
- El permiso para acceder a tu servidor se pide sin puerto (necesario en Safari).

**Safari (experimental)**
- Nueva versión para Safari que se compila en tu Mac con Xcode (`build-safari.sh`).

**2.0.0**
- Primera versión pública para Firefox, firmada por Mozilla y con actualizaciones automáticas.
- Chrome y Firefox en el mismo repositorio (`chrome/` y `firefox/`).
- Plex y Jellyfin a la vez, con una marca por servidor.

**1.x** (solo Chrome)
- Rediseño de Hispashare y botones para copiar enlaces ed2k.
- Integración con Plex y Jellyfin, distinguiendo qué versión tienes.
- Soporte para fichas de películas.

## Desarrollo

Para probar cambios sin empaquetar:

- **Chrome:** `chrome://extensions` → **Modo de desarrollador** → **Cargar descomprimida** → carpeta `chrome/`. Tras cada cambio, pulsa ↻.
- **Firefox:** `about:debugging` → **Este Firefox** → **Cargar complemento temporal** → archivo `firefox/manifest.json`. Se quita al cerrar Firefox.

El código común (rediseño, botones y marcas) es idéntico en las tres carpetas: si cambias algo, cópialo a todas.

- **Safari:** con Safari 26 o posterior puedes probar sin Xcode en **Ajustes → Desarrollador → Añadir extensión temporal** → carpeta `safari/`. Se quita al cerrar Safari.

### Publicar una versión nueva

1. Sube el número de versión en `chrome/manifest.json` y `firefox/manifest.json`.
2. Empaqueta Firefox: comprime el **contenido** de `firefox/` (no la carpeta) en un `.xpi`. Súbelo a firmar en [addons.mozilla.org](https://addons.mozilla.org/developers/) → UIspa → **Upload a New Version**, y descarga el firmado.
3. Empaqueta Chrome: comprime la carpeta `chrome/` renombrada a `UIspa` como `UIspa-chrome.zip`.
4. Crea una Release con la etiqueta `X.Y.Z` (sin «v», por ejemplo `2.1.0`) y adjunta `UIspa-chrome.zip` y el firmado renombrado a `UIspa-firefox.xpi`.
5. Añade la versión a `updates.json`, con el enlace a esa Release. Hasta que no lo hagas, Firefox no la instalará automáticamente.

## Licencia

[MIT](LICENSE): puedes usar, modificar y redistribuir el código citando la autoría.
