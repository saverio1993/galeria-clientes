# Galería de selección de fotos

Web estática para mostrar fotos a clientes. Ellos pueden:
- Ver la galería en pantalla completa (móvil / desktop)
- Marcar entre 3 y 5 fotos favoritas con un toque
- Escribir su nombre y enviarte la selección por **correo** (un `mailto:` se abre en su app de correo)

No necesita backend. Solo GitHub Pages (gratis).

---

## 1 · Pre-requisitos

- **Python 3.10+** (ya lo tienes en Windows: `py -3`)
- **rawpy** y **Pillow** (para convertir `.ARW` de Sony)
  ```powershell
  py -3 -m pip install rawpy Pillow
  ```
- **Git** (ya lo tienes)
- Una cuenta en **GitHub** (ya la tienes)

---

## 2 · Configuración rápida

### 2.1 Edita tu información

Abre **`config.js`** y rellena:

```js
window.GALLERY_CONFIG = {
  brandName:       'Galería de Saverio',     // ← tu nombre comercial
  introTitle:      'Elige tus favoritas',
  receiverEmail:   'tu-correo@ejemplo.com',  // ← tu correo real
  minSelections:   3,
  maxSelections:   5,
  subjectPrefix:   'Selección de fotos',
  galleryNote:     '...',
};
```

### 2.2 Coloca tus fotos originales

Copia tus fotos en **`images-origen/`**. Acepta:

- `.ARW` (Sony RAW) ✅
- `.CR2`, `.CR3`, `.NEF`, `.DNG`, `.RAF`, `.ORF` ✅
- `.JPG`, `.JPEG`, `.PNG`, `.WEBP`, `.TIF` ✅

> **Tip:** la carpeta `images-origen/` no se sube al repo (está en `.gitignore`). Solo las JPGs finales viven en `images/`.

### 2.3 Convierte las fotos a JPG web

```powershell
py -3 scripts/convertir.py
```

El script:
1. Convierte los `.ARW` con `rawpy` (balance de blancos de cámara)
2. Re-codifica los `.JPG`/`.PNG` ya existentes
3. Escala a un ancho máx. de 2400px (cambia con `--max-width`)
4. Optimiza cada JPG (progressive, calidad 88)
5. Genera `images/manifest.json` con la lista

Salida esperada:
```
[INFO] 24 imágenes encontradas en ...\images-origen
[OK] 24 convertidas | 0 fallidas | manifest.json con 24 entradas
```

### 2.4 Previsualiza localmente

Abre `index.html` directamente en el navegador, **o** sirve la carpeta con un servidor estático:

```powershell
py -3 -m http.server 8000
# luego visita http://localhost:8000
```

> ⚠️ `fetch('images/manifest.json')` no funciona con `file://` en algunos navegadores. Usa el servidor estático si ves "0 fotos".

### 2.5 (Opcional) Genera imágenes demo

Si quieres ver la galería funcionando antes de tener fotos reales:

```powershell
py -3 scripts/demo-imgs.py
```

Crea 8 imágenes placeholder. Cuando ejecutes `scripts/convertir.py` con tus ARW/JPG, estas se borran automáticamente.

---

## 3 · Publicar en GitHub Pages

### 3.1 Crear el repositorio

Ve a <https://github.com/new> y crea un repo:

- Nombre sugerido: **`galeria-clientes`** (o el que quieras)
- Visibilidad: **Public** (GitHub Pages gratis requiere repo público)
- ❌ NO marques "Add README" / ".gitignore" / "license"

### 3.2 Subir el código

```powershell
cd galeria-fotos
git init
git add .
git commit -m "galería inicial"
git branch -M main
git remote add origin https://github.com/saverio1993/galeria-clientes.git
git push -u origin main
```

### 3.3 Activar GitHub Pages

1. Ve a tu repo → **Settings** → **Pages**
2. En **Source**, elige **Deploy from a branch**
3. Branch: **`main`**, carpeta: **`/(root)`**
4. Click **Save**
5. Espera 1-2 minutos. Tu galería estará en:

   ```
   https://saverio1993.github.io/galeria-clientes/
   ```

---

## 4 · Flujo de trabajo cada vez que agregas fotos

```powershell
# 1. Arrastra los nuevos ARW/JPG a images-origen/
# 2. Regenera las JPGs
py -3 scripts/convertir.py
# 3. Sube los cambios
git add images/
git commit -m "nuevas fotos: sesión 2026-06-24"
git push
# 4. GitHub Pages se actualiza en ~30 segundos
```

---

## 5 · ¿Cómo recibes la selección del cliente?

1. El cliente abre el link de tu galería
2. Marca 3-5 fotos con el corazón
3. Toca **"Enviar mis favoritas"**
4. Aparece un mini-formulario pidiendo su nombre
5. Toca **"Enviar por correo"** → se abre su aplicación de correo (Gmail, Outlook, Apple Mail…)
6. El correo ya viene **relleno** con:

   - **Asunto:** `Selección de fotos — María (4)`
   - **Cuerpo:** la lista numerada de fotos + la URL de la galería + la fecha

7. El cliente solo tiene que darle **Enviar**

> El correo llega a la dirección que pusiste en `config.js → receiverEmail`.

---

## 6 · Personalización

### Cambiar el look

Todo el estilo está en `assets/style.css`. Variables principales (al inicio del archivo):

```css
--bg:        #0a0a0a;   /* fondo */
--fg:        #fafafa;   /* texto */
--accent:    #f97316;   /* color de marca (botón "Enviar") */
--like:      #ef4444;   /* corazón de favorito */
```

### Cambiar min/max de selección

En `config.js`:
```js
minSelections: 3,
maxSelections: 5,
```

### Agregar marca de agua (opcional)

Para evitar que descarguen las fotos y las usen sin permiso, puedes activar la marca de agua. Edita `scripts/convertir.py` y agrega al final de `convert_in_place`:

```python
from PIL import ImageDraw
draw = ImageDraw.Draw(image)
text = "© Saverio · Vista previa"
draw.text((image.width - 380, image.height - 60), text, fill=(255, 255, 255))
```

(Pillow no soporta alpha en texto RGB; convierte la imagen a RGBA temporalmente si necesitas transparencia.)

---

## 7 · Estructura del proyecto

```
galeria-fotos/
├── index.html              ← página principal
├── config.js               ← tu config (correo, marca, etc.)
├── assets/
│   ├── style.css           ← todo el estilo
│   └── app.js              ← lógica (galería, selección, mailto)
├── images-origen/          ← (NO se sube) aquí van los ARW/JPG originales
├── images/                 ← JPGs optimizadas + manifest.json (SÍ se sube)
└── scripts/
    └── convertir.py        ← ARW/RAW → JPG
```

---

## 8 · Problemas comunes

**"Veo 0 fotos en la galería"**
- Asegúrate de haber corrido `py -3 scripts/convertir.py` y de que existe `images/manifest.json`.
- Si abriste `index.html` con doble-click, usa `py -3 -m http.server` (la política CORS bloquea `fetch` en `file://`).

**"El cliente no tiene app de correo configurada"**
- El `mailto:` solo abre si hay un cliente configurado. Alternativa: pegar un link de Google Forms en `config.js → receiverEmail` y enviar la selección al formulario. (Si quieres, te lo armo.)

**"Quiero más de 5 / menos de 3"**
- Cambia `minSelections` y `maxSelections` en `config.js`.

**"Las fotos son muy pesadas"**
- `py -3 scripts/convertir.py --quality 80 --max-width 1800`

**"Quiero una contraseña para que solo mis clientes vean la galería"**
- GitHub Pages no soporta password nativo. Opciones gratuitas: Cloudflare Access (gratis hasta 50 usuarios), o compartir el link solo con quien quieras verlo. Dime y te armo la opción con Cloudflare.

---

Hecho con ❤ para Saverio.
