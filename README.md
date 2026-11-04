# UIspa

Extensión para **Chrome** y **Firefox** que da a [Hispashare](https://www.hispashare.org) un diseño más limpio y moderno, facilita copiar los enlaces ed2k y, si quieres, te dice qué tienes ya en tu servidor Plex o Jellyfin.

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

## Privacidad

- UIspa no recoge ni envía datos a ningún servidor propio ni de terceros. En Firefox lo declara así en su instalación (`data_collection_permissions: none`).
- Solo se comunica con Hispashare, para obtener los enlaces que ya ofrece la web, y con tu servidor Plex o Jellyfin si lo configuras.
- La dirección y la credencial del servidor se guardan únicamente en tu navegador. Las consultas salen de la extensión, no de la página, así que la web nunca las ve. Del servidor solo se usan el tamaño y la resolución de los archivos, nunca sus rutas.

## Permisos

| Permiso | Para qué |
|---|---|
| Acceso a `hispashare.org` / `hispashare.com` | Aplicar el rediseño y añadir los botones |
| `clipboardWrite` (y `offscreen` en Chrome) | Copiar enlaces al portapapeles, también desde atajos y menús |
| `contextMenus` | Opciones del menú del botón derecho |
| `storage` | Guardar la configuración del servidor |
| Acceso opcional a la dirección de tu servidor | Solo se pide si configuras Plex o Jellyfin, y únicamente para esa dirección |

## Estructura

```
chrome/        Extensión para Chrome (Manifest V3)
firefox/       Extensión para Firefox (Manifest V2, firmada por Mozilla)
updates.json   Aviso de actualizaciones para Firefox
```

Las dos versiones comparten el mismo código; solo cambian el manifiesto y el segundo plano:

| Archivo | Función |
|---|---|
| `manifest.json` | Definición de la extensión |
| `theme-early.js`, `theme.js`, `theme.css` | Rediseño de la web |
| `content.js`, `content.css` | Botones de copiar y avisos |
| `media.js` | Marcas de Plex o Jellyfin en las fichas |
| `background.js` | Segundo plano: atajos y menús |
| `media-bg.js`, `plex-bg.js`, `jellyfin-bg.js` | Consultas al servidor multimedia |
| `offscreen.html`, `offscreen.js` | Solo Chrome: copia al portapapeles desde segundo plano |
| `options.html`, `options.js`, `options.css` | Página de ajustes |

## Limitaciones

- Depende del HTML de Hispashare: si la web cambia su estructura, el rediseño o los botones pueden dejar de funcionar.
- La coincidencia exacta con el servidor se basa en el tamaño que muestra la web, redondeado a dos decimales. Si renombras o recomprimes un archivo, aparecerá como «≈» u «otra calidad».

## Novedades

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

El código común (rediseño, botones y marcas) es idéntico en las dos carpetas: si cambias algo, cópialo a ambas.

### Publicar una versión nueva

1. Sube el número de versión en `chrome/manifest.json` y `firefox/manifest.json`.
2. Empaqueta Firefox: comprime el **contenido** de `firefox/` (no la carpeta) en un `.xpi`. Súbelo a firmar en [addons.mozilla.org](https://addons.mozilla.org/developers/) → UIspa → **Upload a New Version**, y descarga el firmado.
3. Empaqueta Chrome: comprime la carpeta `chrome/` renombrada a `UIspa` como `UIspa-chrome.zip`.
4. Crea una Release con la etiqueta `vX.Y.Z` y adjunta `UIspa-chrome.zip` y el firmado renombrado a `UIspa-firefox.xpi`.
5. Añade la versión a `updates.json`, con el enlace a esa Release. Hasta que no lo hagas, Firefox no la instalará automáticamente.

## Licencia

[MIT](LICENSE): puedes usar, modificar y redistribuir el código citando la autoría.
