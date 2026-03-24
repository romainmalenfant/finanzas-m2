// ── Documentos ────────────────────────────────────────────
// Sección de búsqueda y previsualización de archivos en Storage

var _docsResults = [];
var _docsSearchTimer = null;

function docsInit() {
  var el = document.getElementById('docs-search');
  if (el) el.focus();
}

// ── Búsqueda ──────────────────────────────────────────────
function docsOnInput() {
  clearTimeout(_docsSearchTimer);
  _docsSearchTimer = setTimeout(docsBuscar, 380);
}

async function docsBuscar() {
  var q       = (document.getElementById('docs-search')     || {}).value || '';
  var año     = (document.getElementById('docs-year')       || {}).value || '';
  var tipo    = (document.getElementById('docs-tipo')       || {}).value || '';
  var archivo = (document.getElementById('docs-archivo')    || {}).value || '';

  q = q.trim();

  // Necesita al menos un criterio para evitar traer todo
  if (!q && !año && !tipo && !archivo) {
    docsRender([]);
    document.getElementById('docs-empty').style.display = 'block';
    document.getElementById('docs-empty').textContent   = 'Busca por empresa, folio, UUID o aplica un filtro.';
    return;
  }

  document.getElementById('docs-empty').style.display  = 'none';
  document.getElementById('docs-spinner').style.display = 'inline';

  try {
    var rows = await _docsFetch(q, año, tipo, archivo);
    _docsResults = rows;
    docsRender(rows);
  } catch(e) {
    showError('Error buscando documentos: ' + e.message);
  } finally {
    document.getElementById('docs-spinner').style.display = 'none';
  }
}

async function _docsFetch(q, año, tipo, archivo) {
  function base() {
    var qb = sb.from('facturas')
      .select('id,uuid_sat,emisor_nombre,receptor_nombre,numero_factura,total,fecha,tipo,estatus,conciliado,xml_path,pdf_path')
      .or('xml_path.not.is.null,pdf_path.not.is.null');
    if (año)     qb = qb.eq('year', parseInt(año));
    if (tipo)    qb = qb.eq('tipo', tipo);
    if (archivo === 'xml') qb = qb.not('xml_path', 'is', null);
    if (archivo === 'pdf') qb = qb.not('pdf_path', 'is', null);
    return qb.order('fecha', { ascending: false }).limit(50);
  }

  var rows = [];
  var seen = {};
  function merge(arr) {
    (arr || []).forEach(function(r) { if (!seen[r.id]) { rows.push(r); seen[r.id] = true; } });
  }

  if (q) {
    // 1. Búsqueda por texto (solo columnas text — no UUID)
    var textRows = await base().or(
      'emisor_nombre.ilike.%' + q + '%' +
      ',receptor_nombre.ilike.%' + q + '%' +
      ',numero_factura.ilike.%' + q + '%'
    );
    merge(textRows.data || []);

    // 2. UUID exact match — solo si luce como UUID completo
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
      try {
        var uuidRow = await base().eq('id', q.toLowerCase());
        merge(uuidRow.data || []);
      } catch(e) { /* silenciar */ }
    }

    // 3. Monto — solo si el input es numérico
    var numQ = parseFloat(q.replace(/[$,\s]/g, ''));
    if (/^[$\d,.\s]+$/.test(q) && !isNaN(numQ) && numQ > 0) {
      try {
        var montoRows = await base().gte('total', numQ * 0.995).lte('total', numQ * 1.005);
        merge(montoRows.data || []);
      } catch(e) { /* silenciar */ }
    }
  } else {
    // Sin texto libre: query simple con filtros duros
    var plain = await base();
    merge(plain.data || []);
  }

  return rows;
}

// ── Render ────────────────────────────────────────────────
function docsRender(rows) {
  var wrap = document.getElementById('docs-results');
  if (!rows.length) {
    wrap.innerHTML = '';
    document.getElementById('docs-empty').style.display = 'block';
    document.getElementById('docs-empty').textContent   = 'Sin resultados.';
    return;
  }
  document.getElementById('docs-empty').style.display = 'none';

  var html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:.04em;">' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Empresa</th>' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Folio</th>' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Fecha</th>' +
    '<th style="text-align:right;padding:6px 8px;font-weight:500;">Total</th>' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Tipo</th>' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Estatus</th>' +
    '<th style="text-align:left;padding:6px 8px;font-weight:500;">Conciliado</th>' +
    '<th style="text-align:center;padding:6px 8px;font-weight:500;">Archivos</th>' +
    '</tr></thead><tbody>';

  rows.forEach(function(r) {
    var empresa = r.tipo === 'emitida'
      ? (r.receptor_nombre || r.emisor_nombre || '—')
      : (r.emisor_nombre   || r.receptor_nombre || '—');
    var folio = r.numero_factura || '—';
    var fecha = r.fecha ? r.fecha.split('T')[0] : '—';
    var total = r.total != null ? '$' + parseFloat(r.total).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

    var tipoLabel = r.tipo === 'emitida'
      ? '<span style="color:#34d399;font-size:11px;font-weight:600;">Emitida</span>'
      : '<span style="color:#f87171;font-size:11px;font-weight:600;">Recibida</span>';

    var cancelada = r.estatus === 'cancelada';
    var estatusLabel = cancelada
      ? '<span style="color:#f87171;font-size:11px;font-weight:600;">Cancelada</span>'
      : '<span style="color:#34d399;font-size:11px;">Vigente</span>';

    var conciliadoLabel = r.conciliado
      ? '<span style="color:#34d399;font-size:13px;" title="Conciliada">✓</span>'
      : '<span style="color:#f59e0b;font-size:11px;">Pendiente</span>';

    var uuid = r.uuid_sat || r.id || '';
    var copyBtn = uuid
      ? '<button onclick="docsCopiarUUID(\''+uuid+'\',this)" title="Copiar UUID" style="background:none;border:none;cursor:pointer;color:var(--text-3,#aaa);font-size:12px;padding:0 4px;opacity:.5;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=.5">⧉</button>'
      : '';

    var archivos = '';
    if (r.xml_path) archivos += '<button class="btn-sm" style="padding:3px 8px;font-size:11px;" onclick="docsAbrir(\''+r.xml_path+'\',\'xml\')">XML</button> ';
    if (r.pdf_path) archivos += '<button class="btn-sm" style="padding:3px 8px;font-size:11px;" onclick="docsAbrir(\''+r.pdf_path+'\',\'pdf\')">PDF</button>';

    var acento = r.tipo === 'emitida' ? '#34d399' : '#f59e0b';
    var rowStyle = 'background:#fff;border-bottom:1px solid var(--border);cursor:default;' + (cancelada ? 'opacity:.55;' : '');
    html += '<tr style="'+rowStyle+'" onmouseenter="this.style.background=\'#f5f4f0\'" onmouseleave="this.style.background=\'#fff\'">' +
      '<td style="padding:10px 8px;border-left:3px solid '+acento+';color:var(--text-1);' + (cancelada ? 'text-decoration:line-through;' : '') + '">'+_docsEsc(empresa)+'</td>' +
      '<td style="padding:8px 8px;color:var(--text-2);">'+_docsEsc(folio)+copyBtn+'</td>' +
      '<td style="padding:8px 8px;color:var(--text-3);">'+fecha+'</td>' +
      '<td style="padding:8px 8px;text-align:right;color:var(--text-1);">'+total+'</td>' +
      '<td style="padding:8px 8px;">'+tipoLabel+'</td>' +
      '<td style="padding:8px 8px;">'+estatusLabel+'</td>' +
      '<td style="padding:8px 8px;">'+conciliadoLabel+'</td>' +
      '<td style="padding:8px 8px;text-align:center;">'+archivos+'</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ── Preview / descarga ─────────────────────────────────────
async function docsAbrir(path, ext) {
  try {
    var url = await DB.storage.signedUrl(path);
    if (ext === 'pdf') {
      docsPreviewPDF(url, path);
    } else {
      window.open(url, '_blank');
    }
  } catch(e) {
    showError('No se pudo abrir el archivo: ' + e.message);
  }
}

function docsPreviewPDF(url, path) {
  var modal = document.getElementById('docs-preview-modal');
  var frame = document.getElementById('docs-preview-frame');
  var title = document.getElementById('docs-preview-title');

  title.textContent = path.split('/').pop();
  frame.src = url;
  modal.style.display = 'flex';
}

function docsPreviewClose() {
  var modal = document.getElementById('docs-preview-modal');
  var frame = document.getElementById('docs-preview-frame');
  modal.style.display = 'none';
  frame.src = '';
}

// ── Upload / Drag & Drop ──────────────────────────────────
function docsHandleFiles(files) {
  if (!files || !files.length) return;
  var arr = Array.from(files);

  var xmls = arr.filter(function(f){ return f.name.toLowerCase().endsWith('.xml'); });
  var pdfs = arr.filter(function(f){ return f.name.toLowerCase().endsWith('.pdf'); });
  var otros = arr.filter(function(f){
    var n = f.name.toLowerCase();
    return !n.endsWith('.xml') && !n.endsWith('.pdf');
  });

  if (otros.length) {
    showError('Formato no soportado: ' + otros.map(function(f){ return f.name; }).join(', ') + '. Solo se aceptan XML y PDF.');
  }
  if (pdfs.length) {
    showError('Los PDFs se adjuntan desde el detalle de cada factura.');
  }
  if (xmls.length) {
    // Reusar el flujo de importarXMLsCFDI pasando los files directamente
    var fakeInput = { files: xmls, value: '' };
    importarXMLsCFDI(fakeInput);
  }
}

var _docsDragTimeout = null;

function _docsDragReset() {
  clearTimeout(_docsDragTimeout);
  _docsDragTimeout = null;
  var overlay = document.getElementById('docs-drop-overlay');
  if (overlay) overlay.style.display = 'none';
}

function docsDragOver(e) {
  e.preventDefault();
  // Mostrar overlay y resetear timeout — cuando dragover deja de dispararse
  // (ESC, salir de ventana, cancelar) el timeout apaga el overlay automáticamente
  clearTimeout(_docsDragTimeout);
  _docsDragTimeout = setTimeout(_docsDragReset, 200);
  var overlay = document.getElementById('docs-drop-overlay');
  if (overlay && overlay.style.display !== 'flex') overlay.style.display = 'flex';
}

function docsDragLeave(e) {
  // Solo apagar si el mouse salió del tab completo (relatedTarget fuera del tab)
  var tab = document.getElementById('tab-documentos');
  if (tab && e.relatedTarget && tab.contains(e.relatedTarget)) return;
  _docsDragReset();
}

function docsDrop(e) {
  e.preventDefault();
  _docsDragReset();
  docsHandleFiles(e.dataTransfer.files);
}

// ESC cancela el overlay
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') _docsDragReset();
});

// Drag que sale de la ventana del browser
document.addEventListener('dragleave', function(e) {
  if (!e.relatedTarget) _docsDragReset();
});

// ── Helpers ───────────────────────────────────────────────
function _docsEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function docsCopiarUUID(uuid, btn) {
  navigator.clipboard.writeText(uuid).then(function() {
    var orig = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = '#34d399';
    btn.style.opacity = '1';
    setTimeout(function() {
      btn.textContent = orig;
      btn.style.color = '';
      btn.style.opacity = '.5';
    }, 1500);
  });
}
