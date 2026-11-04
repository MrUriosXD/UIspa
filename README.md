# UIspa

Extensión para Chrome que da a [Hispashare](https://www.hispashare.org) un diseño más limpio y moderno, facilita copiar los enlaces ed2k y, si quieres, te dice qué tienes ya en tu servidor Plex o Jellyfin.

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

**Plex o Jellyfin (opcional)**
- En cada ficha marca qué episodios o películas tienes ya en tu servidor Plex, en Jellyfin o en los dos a la vez (una marca por servidor, en su color).
- Distingue qué versión tienes comparando el tamaño exacto de tus archivos:
  - **✓ En Plex** / **✓ En Jellyfin**: tienes exactamente ese archivo.
  - **≈ En Plex (1080p)**: lo tienes en la misma calidad, en otro archivo.
  - **En Plex en 4K**: lo tienes en otra calidad.
  - **Falta**: no lo tienes.
- Busca cada título por su código de IMDb y, si no, por título y año.

## Instalación

1. Descarga este repositorio: botón **Code → Download ZIP**, y descomprímelo.
2. Abre `chrome://extensions`.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y elige la carpeta descomprimida, la que contiene `manifest.json`.

Chrome carga la extensión desde esa carpeta, así que no la borres ni la muevas. Para actualizar, sustituye los archivos por los nuevos y pulsa ↻ en `chrome://extensions`.

Funciona en Chrome 116 o posterior y en otros navegadores basados en Chromium (Edge, Brave, Opera, Vivaldi).

## Conectar con Plex o Jellyfin

1. En Hispashare abre **Más → ⚙ Ajustes de la extensión**, o clic derecho en el icono de UIspa → **Opciones**.
2. Elige la pestaña **Plex** o **Jellyfin** (puedes configurar los dos; un punto verde indica los conectados) y escribe la dirección de tu servidor, por ejemplo `http://192.168.1.50:32400` (Plex) o `http://192.168.1.50:8096` (Jellyfin).
3. Pega la credencial:
   - **Plex:** tu token. En Plex Web abre cualquier película o episodio → **⋯ → Obtener información → Ver XML** y copia lo que va después de `X-Plex-Token=` en la dirección.
   - **Jellyfin:** una clave de API. Con una cuenta de administrador ve a **Panel de control → Claves de API**, pulsa **+** y copia la clave.
4. Pulsa **Guardar**. Chrome te pedirá permiso para acceder solo a esa dirección.

## Privacidad

- UIspa no recoge ni envía datos a ningún servidor propio ni de terceros.
- Solo se comunica con Hispashare, para obtener los enlaces que ya ofrece la web, y con tu servidor Plex o Jellyfin si lo configuras.
- La dirección y la credencial del servidor se guardan únicamente en tu navegador. Las consultas salen de la extensión, no de la página, así que la web nunca las ve. Del servidor solo se usan el tamaño y la resolución de los archivos, nunca sus rutas.

## Permisos

| Permiso | Para qué |
|---|---|
| Acceso a `hispashare.org` / `hispashare.com` | Aplicar el rediseño y añadir los botones |
| `clipboardWrite`, `offscreen` | Copiar enlaces al portapapeles, también desde atajos y menús |
| `contextMenus` | Opciones del menú del botón derecho |
| `storage` | Guardar la configuración del servidor |
| Acceso opcional a la dirección de tu servidor | Solo se pide si configuras Plex o Jellyfin, y únicamente para esa dirección |

## Estructura

| Archivo | Función |
|---|---|
| `manifest.json` | Definición de la extensión (Manifest V3) |
| `theme-early.js`, `theme.js`, `theme.css` | Rediseño de la web |
| `content.js`, `content.css` | Botones de copiar y avisos |
| `media.js` | Marcas de Plex o Jellyfin en las fichas |
| `background.js` | Segundo plano: atajos y menús |
| `media-bg.js`, `plex-bg.js`, `jellyfin-bg.js` | Consultas al servidor multimedia |
| `offscreen.html`, `offscreen.js` | Copia al portapapeles desde segundo plano |
| `options.html`, `options.js`, `options.css` | Página de ajustes |

## Limitaciones

- Depende del HTML de Hispashare: si la web cambia su estructura, el rediseño o los botones pueden dejar de funcionar.
- La coincidencia exacta con el servidor se basa en el tamaño que muestra la web, redondeado a dos decimales. Si renombras o recomprimes un archivo, aparecerá como «≈» u «otra calidad».

## Licencia

[MIT](LICENSE): puedes usar, modificar y redistribuir el código citando la autoría.
