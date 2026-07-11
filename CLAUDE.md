# ERP Grupo M2 — Base de conocimiento Claude

> **Regla de oro**: Si algo se tuvo que iterar más de 2 veces, queda documentado aquí.

---

## Assets relacionados

| Tipo | Recurso | Cómo acceder |
|---|---|---|
| Workspace | `C:\Users\romai\Documents\WorkSpace\1-ERP-Grupo-M2` | — |
| Supabase | `iycqlbvywwogcfftciil` (Finanzas Grupo M2) | MCP tools `supabase_finanzasm2__*` |
| Vercel | proyecto `finanzas-m2` (team romainmalenfant) | MCP tools `vercel_personal__*`, prj id `prj_1jj8Q19eQG6zNgLOl0wprPmSF0X6` |
| Email asociado | `rm@grupom2.com.mx` | MCP tools `pop3_grupom2__*` |
| Repo | `github.com/romainmalenfant/finanzas-m2` branch `main` | — |
| Dominio prod | `finanzas-m2.vercel.app` | — |

---

## Arquitectura del proyecto

- **Stack**: Vanilla JS (no framework, no build tool), Supabase JS v2, Vercel deploy
- **Repo**: `github.com/romainmalenfant/finanzas-m2` → branch `main`
- **Worktree activo**: `.claude/worktrees/pedantic-black` (branch `claude/pedantic-black`)
- **Push a producción**: `git push origin claude/pedantic-black:main`
- **URL producción**: `https://finanzas-m2.vercel.app`
- **Supabase project**: `iycqlbvywwogcfftciil.supabase.co`
- **Storage bucket**: `facturas` (PDFs de cotizaciones y facturas)
- **Vercel tarda**: ~15–20s en deployar tras push

### Por qué vanilla JS sin build tool
Todo es un único `index.html` que carga scripts en orden. No hay bundler, no hay módulos ES, no hay tree-shaking. Las funciones son **globales** (`window.xxx`). Esto es intencional para mantener simplicidad — cambiar a Vite es backlog pero no urgente.

---

## Estructura de archivos JS (orden de carga importa)

```
js/config.js         — SUPABASE_URL, SUPABASE_KEY, sb client, APP_MODULES
js/db.js             — objeto DB con helpers por tabla
js/utils.js          — fmt(), esc(), fmtDate(), makeAutocomplete(), showStatus(), showError()
js/nav.js            — switchTab(), sidebar navigation, tab state
js/search.js         — KBar (Cmd/Ctrl+F), ESC handler global (único handler centralizado)
js/tabs.js           — tab switching helpers
js/auth.js           — login/logout con Supabase auth
js/dashboard.js      — KPIs del dashboard
js/movimientos.js    — Flujo de caja, movimientos
js/movimiento_form.js — Formulario de movimiento (modal)
js/facturas.js       — Facturas emitidas/recibidas/complementos SAT
js/documentos.js     — Documentos vinculados a facturas (paginación 10/20/50)
js/sat.js            — Conciliación SAT & Banco
js/empresas.js       — Clientes/empresas
js/contactos.js      — Contactos
js/proveedores.js    — Proveedores
js/empleados.js      — Empleados
js/proyectos.js      — Proyectos, entregas, kanban proyectos
js/detail.js         — Panel de detalle lateral (shared por todos los módulos)
js/reportes.js       — Reportes
js/cot-list.js       — Cotizaciones: vars globales, KPIs, insights, lista, kanban
js/cot-form.js       — Cotizaciones: form crear/editar, estatus, versiones, detalle
js/cot-pdf.js        — Cotizaciones: EMPRESA_CONFIG + generarPDFCotizacion()
```

**Regla**: si un archivo B llama funciones de A, A debe cargarse antes en index.html.

---

## API — DB helpers (js/db.js)

```javascript
// Cotizaciones
DB.cotizaciones.list()                        // todas las cotizaciones (order by fecha desc)
DB.cotizaciones.get(id)                       // una por id (con items join)
DB.cotizaciones.save(data)                    // upsert
DB.cotizaciones.updateEstatus(id, estatus)    // solo estatus
DB.cotizaciones.savePdfPath(id, pdfPath)      // guarda path del PDF generado
DB.cotizaciones.linkContact(cotId, contactId) // vincula contacto
DB.cotizaciones.countPeriodo(prefix)          // count para generar número (ej: 'COT-2026-')
DB.cotizaciones.byCliente(clienteId, nombre)  // cotizaciones de un cliente (select: id,numero,version,estatus,total,fecha,cliente_nombre,numero_requisicion,fecha_cierre,usuario_cliente_id,pdf_path,cotizacion_base_id)

// Items
DB.cotizacionItems.byCotizacion(id)           // items de una cotización
DB.cotizacionItems.saveBulk(cotId, items)     // reemplaza todos los items

// Proyectos
DB.proyectos.list()
DB.proyectos.get(id)
DB.proyectos.save(data)

// Contactos
DB.contactos.get(id)
DB.contactos.list()

// Storage (bucket 'facturas')
DB.storage.signedUrl(path)                    // URL firmada para abrir archivo
// Upload directo:
sb.storage.from('facturas').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
```

---

## API — UI helpers globales

### Panel de detalle lateral (`detail.js`)
```javascript
// Abre el panel derecho con contenido dinámico
abrirDetail(titulo, subtitulo, initials, bodyHTML)
// initials: 2-3 letras para el avatar (ej: 'COT', 'EM')
// bodyHTML: string HTML completo del cuerpo

cerrarDetail()   // cierra y limpia el panel
```
**Patrón estándar** para cualquier módulo:
```javascript
async function verDetalleXxx(id) {
  var data = await DB.xxx.get(id);
  var bodyHTML = '<div class="detail-section">...' + construirHTML(data) + '...</div>';
  abrirDetail(data.nombre, data.subtitulo, 'XX', bodyHTML);
}
```

### KBar / búsqueda global (`search.js`)
```javascript
abrirKBar()   // abre el modal de búsqueda (Cmd+F / Ctrl+F)
cerrarKBar()  // cierra
kbarGoTo('tab-id')  // navega a una sección
```

### Autocomplete (`utils.js`)
```javascript
makeAutocomplete(
  inputId,      // id del input de texto
  hiddenId,     // id del input hidden (guarda el id seleccionado)
  dropdownId,   // id del div dropdown
  sourcesFn,    // function() → array de {id, label, sub}
  onSelectFn    // callback opcional al seleccionar
)
actualizarBtnClear(hiddenId, btnClearId)  // muestra/oculta botón X
```

### Formatters (`utils.js`)
```javascript
fmt(n)         // → '$1,234.56' (moneda MXN)
esc(s)         // → HTML escape (evita XSS en innerHTML)
fmtDate(d)     // → '24 mar 2026' (fecha corta en español)
showStatus(msg)  // toast verde bottom-right, auto-desaparece
showError(msg)   // toast rojo bottom-right
```

### Abrir PDF desde Storage
```javascript
docsAbrir(path, 'pdf')   // abre en nueva pestaña via signed URL
// path es relativo al bucket 'facturas', ej: 'cotizaciones/uuid.pdf'
```

---

## Base de datos — tablas y columnas clave

| Tabla | Columnas importantes |
|---|---|
| `cotizaciones` | `id, numero, version, cotizacion_base_id, estatus, total, subtotal, iva, fecha, fecha_cierre, cliente_id, cliente_nombre, proyecto_id, contacto_id, usuario_cliente_id, pdf_path, condiciones(jsonb), numero_requisicion, vigencia_dias, titulo, notas` |
| `cotizacion_items` | `id, cotizacion_id, tipo(maquinado/servicio/producto), descripcion, material, cantidad, unidad, precio_unitario, subtotal, notas` |
| `proyectos` | `id, nombre_pedido, nombre_cliente, tipo_pieza, monto_total, year, estatus, fecha_entrega, ...` |
| `documentos` | `id, nombre, path, tipo, factura_id, pdf_path` |
| `facturas` | `id, numero, tipo(emitida/recibida/complemento), total, fecha, cliente_nombre, uuid, ...` |
| `clientes` | `id, nombre, rfc, ciudad, ...` |
| `contactos` | `id, nombre, apellido, cargo, email, cliente_id, clientes(join)` |
| `movimientos` | `id, tipo(ingreso/egreso/cobranza/gasto), monto, fecha, descripcion, contraparte, categoria` |

### Estatus de cotizaciones (flujo)
```
borrador → enviada → en_negociacion → cerrada ✓ (ganada, crea proyecto)
                                    → perdida ✗ (requiere motivo)
```

### Número de cotización
```javascript
// Formato: COT-YYYY-NNN
// Generado en guardarCotizacion():
var año = new Date(fecha + 'T12:00').getFullYear();
var count = await DB.cotizaciones.countPeriodo('COT-' + año + '-');
cotData.numero = 'COT-' + año + '-' + String(count + 1).padStart(3, '0');
```

### Versiones de cotización
```javascript
// cotizacion_base_id apunta al id de la cotizacion original (v1)
// version: 1, 2, 3...
// Cuando se aprueba una versión, las demás se marcan perdida
```

---

## PDF de cotizaciones (`cot-pdf.js`)

- **Librería**: jsPDF 2.5.1 + autoTable 3.8.2 (CDN en index.html)
- **Namespace**: `new jspdf.jsPDF(...)` (minúscula)
- **Formato**: landscape letter (279×216mm)
- **Logo**: PNG base64 embebido en variable `logoDataUrl` (120×120px)
  - `doc.addImage(logoDataUrl, 'PNG', x, y, w, h)` — siempre `'PNG'`
  - Envuelto en try/catch para no romper si falla
- **Flujo**: generar → upload a storage → guardar `pdf_path` en BD → `doc.save(fileName)`

### Paleta de marca para PDF (RGB)
```javascript
C.red:    [232, 25, 44]    // #E8192C — brand red
C.carbon: [51, 51, 51]     // #333333 — header y footer
C.dark2:  [80, 80, 80]     // tabla headers
C.gray1:  [245, 244, 242]  // filas alternas
C.gray2:  [210, 210, 210]  // texto secundario sobre fondo oscuro
C.gray3:  [170, 170, 170]  // texto terciario
C.text:   [26, 26, 26]     // #1a1a1a texto principal
C.white:  [255, 255, 255]
C.bgPage: [248, 248, 246]  // fondo de página
```

### EMPRESA_CONFIG (editable en cot-pdf.js)
```javascript
var EMPRESA_CONFIG = {
  nombre, slogan, direcciones[], web, tel, email, banco, legal,
  logo: null,          // no usar — se usa logoDataUrl directamente
  firma_nombre, firma_cargo
}
```

---

## CSS — Design tokens (variables CSS)

```css
/* Texto */
--text-1       /* primario */
--text-2       /* secundario */
--text-3       /* labels, subtítulos */
--text-4       /* muy tenue */

/* Fondos */
--bg-main      /* fondo de la app */
--bg-card      /* tarjetas */
--bg-card-2    /* tarjetas secundarias */
--bg-input     /* inputs */

/* Otros */
--border       /* bordes */
--shadow       /* sombras */

/* Marca */
--brand-red: #E8192C
--brand-gray: #6B6B6B
--brand-carbon: #333333
```

---

## Patrones de código recurrentes

### Modal sobre detail panel
```javascript
// detail panel: z-index 500
// modales cotización: z-index 700
// modales standard: z-index 300 (valor en HTML)
var modal = document.getElementById('cot-modal');
modal.style.zIndex = '700';
modal.style.display = 'flex';
```

### ESC handler centralizado (`search.js`)
Un solo `document.addEventListener('keydown', ...)` maneja todo:
1. KBar si está abierto
2. Detail modal si está abierto
3. Version picker overlay
4. Cualquier modal con `display === 'flex'` (lista explícita)

**No agregar ESC handlers nuevos en otros archivos** — extender la lista en `search.js`.

### Botón dentro de item clickeable
```javascript
// Siempre usar stopPropagation para evitar abrir el detalle del padre
'<button onclick="event.stopPropagation(); miFuncion(\'' + id + '\')" ...>'
```

### Paginación client-side
```javascript
// Patrón de documentos.js: fetch todo (limit 500), paginar en cliente
var _page = 1, _pageSize = 10;
function render(rows) {
  var start = (_page - 1) * _pageSize;
  var pageRows = rows.slice(start, start + _pageSize);
  // render pageRows...
  // append footer con controles 10|20|50 y botones Ant/Sig
}
```

### Cargar datos al cambiar de tab
Cada módulo tiene su `loadXxx()` que se llama desde `switchTab()` en `nav.js`.
Los arrays globales (`cotizaciones`, `allCotizaciones`, `proyectos`, etc.) se populan ahí.

---

## Variables globales del ERP

```javascript
// Datos en memoria
cotizaciones          // array activo (puede ser filtrado)
allCotizaciones       // copia completa sin filtrar
allProyectos          // proyectos cargados
clientes              // empresas/clientes
contactos             // contactos
movimientos / movements  // movimientos del mes
proyectos             // proyectos

// Config cotizaciones
EMPRESA_CONFIG        // datos de la empresa para PDFs
COT_CONDICIONES       // array 7 condiciones {id, texto}
COT_CONDICIONES_DEFAULT  // [1, 2, 3]
KANBAN_COLS           // columnas del kanban
EST_LABELS            // {borrador:'Borrador', enviada:'Enviada', ...}
EST_COLORS            // {borrador:'#64748b', cerrada:'#34d399', ...}

// Estado UI
cotView               // 'lista' | 'kanban'
cotYearFilter         // año activo (número)
cotHistorialOpen      // bool — sección historial expandida
cotEditId             // id de la cotización en edición (null = nueva)
cotItemsTemp          // items del formulario en edición
cotVersionFlag        // true = guardar como nueva versión
```

---

## Deuda técnica y backlog

| Item | Prioridad | Notas |
|---|---|---|
| Buzón de notificaciones (CxC vencidas) | Media | Idea: panel lateral o badge con lista, usuario no convencido del diseño propuesto |
| Vite / build tool | Baja | Beneficio real pero rompe workflow simple actual |
| `precargarProyectosCot` | Ninguna | Función llamada pero **nunca implementada**. En `setTimeout()` → falla silenciosamente. No bloquea nada. |
| Reportes IVA | Baja | Descartado por ahora |
| PDFs de cotización en Documentos | Descartado | No tiene sentido: Documentos es para facturas/complementos externos. PDFs de cot ya son accesibles desde lista, detalle y Proyectos. Meter cotizaciones requeriría cambiar schema (cotizacion_id). Si en el futuro se quiere "expediente por cliente" sería el momento. |

---

## Lecciones aprendidas — errores y soluciones

### 🔴 [3+ iteraciones] Encoding UTF-8 con PowerShell en Windows
**Problema**: PowerShell interpreta la salida de `git show` usando la codepage CP437 del sistema. Los bytes UTF-8 de `ñ` (`C3 B1`) se convierten en caracteres box-drawing (`├▒` → `E2 94 9C E2 96 92`). Los identifiers JS como `var años` se corrompen → `SyntaxError: Invalid or unexpected token` → **todo el archivo deja de ejecutarse**.

**Afecta**: cualquier operación de escritura de archivos JS que pase por PowerShell con `Get-Content`, `Set-Content`, o `Out-File`.

**Regla**: siempre usar **Python** para leer/escribir/dividir archivos JS:
```python
# Leer y escribir preservando UTF-8 exacto
with open('input.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
with open('output.js', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(lines[start:end])

# Extraer desde git primero
# git show <hash>:js/archivo.js > temp.js  (bash, preserva bytes)
# luego Python lee temp.js con encoding='utf-8'
```
**Diagnóstico rápido**: `python3 -c "open('file.js','rb').read().find(b'\xc3\xb1')"` — si no encuentra `ñ` donde debería, está corrupto.

---

### 🔴 [2+ iteraciones] PDF logo: formato debe ser `'PNG'` no `'JPEG'`
jsPDF 2.5.1 tiene bugs con ciertos archivos JPEG. El logo de Grupo M2 debe embeberse como PNG base64 y pasarse como `'PNG'` en `doc.addImage()`. Si aparece cuadro rojo sin imagen, es este problema.
```javascript
// ✅ Correcto
doc.addImage(logoDataUrl, 'PNG', x, y, w, h)

// ❌ Incorrecto — puede fallar silenciosamente con ciertos JPEGs
doc.addImage(logoDataUrl, 'JPEG', x, y, w, h)
```
Siempre envolver en `try/catch` para que no rompa todo el PDF si el logo falla.

---

### 🔴 [2+ iteraciones] SyntaxError bloquea todo un archivo JS
Un error de sintaxis en cualquier parte de un archivo JS hace que **ninguna función de ese archivo** esté disponible. Síntoma típico: módulo completo no responde, botones no hacen nada, sin feedback al usuario.

**Diagnóstico siempre primero**:
```javascript
// MCP Chrome → read_console_messages con onlyErrors: true
// Buscar: "SyntaxError", "is not defined", "Unexpected token"
```
Antes de investigar lógica de negocio, verificar consola del browser.

---

### 🟡 ESC handler: `display === 'flex'` no `'block'`
Todos los modales del ERP abren con `display: 'flex'`. El handler de ESC en `search.js` verifica `=== 'flex'`. Si se agrega un modal nuevo que abre con `display: 'block'`, el ESC no lo cerrará.

**Solución**: agregar el nuevo modal a la lista explícita en `search.js`:
```javascript
var modals = ['cot-modal','conv-modal','form-mvmt-modal','proj-modal',
              'cliente-modal', /* agregar aquí */ ];
for(var i=0;i<modals.length;i++){
  var m = document.getElementById(modals[i]);
  if(m && m.style.display==='flex'){ m.style.display='none'; return; }
}
```

---

### 🟡 `git show` extrae con encoding correcto — PowerShell no
```bash
# ✅ Correcto: bash redirect preserva bytes UTF-8
git show <hash>:js/archivo.js > archivo_temp.js

# ❌ Incorrecto: PowerShell re-codifica
$content = git show <hash>:js/archivo.js  # bytes corruptos
```
Para verificar si un archivo está bien codificado:
```bash
python3 -c "
data = open('js/archivo.js','rb').read()
print('BOM:', data[:3])         # NO debería ser b'\\xef\\xbb\\xbf' (BOM UTF-8)
print('Tiene ñ:', b'\\xc3\\xb1' in data)
"
```

---

### 🟢 Unicode escapes para caracteres especiales en strings JS
Para evitar que encoding issues rompan caracteres especiales en producción, usar literales `\uXXXX` en lugar de los caracteres directamente. Son ASCII puro — inmunes a cualquier problema de codepage o cache del browser.

```javascript
// ❌ Frágil — puede corromperse con PowerShell o quedar cacheado
showStatus('✓ Guardado');
doc.text('• item', x, y);

// ✅ Robusto — ASCII puro en el .js
showStatus('\u2713 Guardado');    // ✓
doc.text('\u2022 item', x, y);   // •
```

| Carácter | Escape | Uso |
|---|---|---|
| ✓ | `\u2713` | Notificaciones de éxito |
| • | `\u2022` | Bullets en PDF |
| — | `\u2014` | Em dash (separadores, fallbacks) |
| · | `\u00b7` | Separador (BBVA · CLABE) |
| ¿ | `\u00bf` | Apertura pregunta |

**Aplicado en**: `cot-pdf.js` — `showStatus`, bullets de condiciones, em dashes en totales y footer.

---

### 🟢 Logo en PDF: resolución mínima recomendada
Para que el logo no se vea pixelado en un PDF carta (letter) landscape:
- El logo ocupa `headerH-2 = 36mm` en el PDF
- A 300 DPI necesita: `36mm / 25.4 * 300 ≈ 425px` mínimo
- Archivo actual: `LOGO M2-02.png` 887×887px RGBA → **626 DPI** ✓
- Siempre usar **PNG con transparencia** (RGBA) — se ve bien sobre cualquier fondo de color
- Formato en `doc.addImage()`: siempre `'PNG'`, nunca `'JPEG'` (jsPDF 2.5.1 tiene bugs con JPEG)

---

### 🟢 Deploy workflow completo
```bash
cd "C:\Users\romai\Documents\1 - ERP Grupo M2\.claude\worktrees\pedantic-black"

# Ver qué cambió
git diff --stat

# Commit (con co-author)
git add js/archivo.js
git commit -m "fix: descripción clara del cambio"

# Push → autodeploy en Vercel (~15-20s)
git push origin claude/pedantic-black:main

# Verificar en browser (hard refresh para evitar cache)
# Ctrl+Shift+R en Chrome
```

---

### 🟢 Inspección de archivos en git history
```bash
# Ver archivo en commit específico
git show <hash>:js/cotizaciones.js | head -50

# Lista de commits con archivos cambiados
git log --oneline -10

# Qué cambió en un commit
git show <hash> --stat

# Extraer archivo completo a temp (preserva UTF-8)
git show <hash>:js/archivo.js > temp.js
```

---

## Pre-commit hook — bloquea SyntaxErrors antes de commitear

Existe un hook en `.githooks/pre-commit` que corre `node --check` sobre cada
`.js` en staging y **bloquea el commit** si hay un error de sintaxis. Esto
ataca directamente el error #1 documentado arriba (un SyntaxError en
cualquier parte de un archivo tumba todo ese módulo en silencio en el
browser, sin aviso).

**Cada clon nuevo del repo debe activarlo una vez** (es config local de git,
no se versiona):
```bash
git config core.hooksPath .githooks
```

Si un commit se bloquea, el hook imprime el archivo y la línea exacta del
error — corrígelo y vuelve a commitear.

---

## Testing en producción

No hay suite de tests. El flujo de QA es:

1. **Consola del browser primero** — `onlyErrors: true` con MCP Chrome
2. **Test funcional** con `mcp__Claude_in_Chrome__javascript_tool`:
   ```javascript
   // Verificar que funciones existen
   typeof abrirNuevaCotizacion  // 'function' si está bien cargado
   // Llamar directamente
   abrirNuevaCotizacion()
   ```
3. **Screenshot** con `mcp__Claude_in_Chrome__computer` para verificar UI
4. **Vercel** — si hay error de deploy, revisar logs en dashboard Vercel

---

## Estructura de `index.html`

Cada sección tiene:
- `<section id="tab-XXX">` — contenedor del módulo
- `<button id="sb-XXX">` — botón en sidebar
- `switchTab('XXX', element)` — para navegar programáticamente

El KBar navega con `kbarGoTo('XXX')`.

Los modales están al final del body, fuera de las sections, para z-index correcto.
