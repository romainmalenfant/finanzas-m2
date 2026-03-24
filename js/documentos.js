// ── Documentos ────────────────────────────────────────────
// Sección de búsqueda y previsualización de archivos en Storage

var _docsResults = [];
var _docsSearchTimer = null;

function docsInit() {
  var el = document.getElementById('docs-search');
  if (el) el.focus();
  docsCargarHuerfanos();
  docsBuscar(); // cargar recientes por defecto
}

// ── Huérfanos ──────────────────────────────────────────────
var _docsHuerfanos = [];

async function docsCargarHuerfanos() {
  var badge = document.getElementById('docs-huerfanos-badge');
  try {
    var rows = await DB.documentos.huerfanos();
    _docsHuerfanos = rows || [];
    if (badge) {
      badge.textContent = _docsHuerfanos.length || '';
      badge.style.display = _docsHuerfanos.length ? 'inline-flex' : 'none';
    }
  } catch(e) { console.warn('huerfanos:', e.message); }
}

async function docsToggleHuerfanos() {
  var panel = document.getElementById('docs-huerfanos-panel');
  if (!panel) return;
  var visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) {
    await docsCargarHuerfanos();
    docsRenderHuerfanos();
  }
}

function docsRenderHuerfanos() {
  var wrap = document.getElementById('docs-huerfanos-list');
  if (!wrap) return;
  if (!_docsHuerfanos.length) {
    wrap.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:12px 0;">Sin documentos huérfanos.</div>';
    return;
  }
  wrap.innerHTML = _docsHuerfanos.map(function(d) {
    var fecha = d.created_at ? d.created_at.slice(0,10) : '—';
    return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;color:var(--text-1);font-weight:500;">'+_docsEsc(d.nombre)+'</div>' +
        '<div style="font-size:11px;color:var(--text-3);">'+fecha+'</div>' +
      '</div>' +
      '<button class="btn-sm" style="font-size:11px;white-space:nowrap;" onclick="docsVincularAbrir(\''+d.id+'\',\''+d.path+'\',\''+_docsEsc(d.nombre)+'\')">Vincular factura</button>' +
    '</div>';
  }).join('');
}

// ── Modal vincular huérfano ────────────────────────────────
var _docsVincularDoc = null;

function docsVincularAbrir(docId, path, nombre) {
  _docsVincularDoc = { id: docId, path: path, nombre: nombre };
  document.getElementById('docs-vincular-nombre').textContent = nombre;
  document.getElementById('docs-vincular-search').value = '';
  document.getElementById('docs-vincular-results').innerHTML = '';
  document.getElementById('docs-vincular-modal').style.display = 'flex';
}

function docsVincularCerrar() {
  document.getElementById('docs-vincular-modal').style.display = 'none';
  _docsVincularDoc = null;
}

var _docsVincularTimer = null;
async function docsVincularBuscar() {
  clearTimeout(_docsVincularTimer);
  _docsVincularTimer = setTimeout(async function() {
    var q = (document.getElementById('docs-vincular-search') || {}).value || '';
    if (q.trim().length < 2) return;
    var wrap = document.getElementById('docs-vincular-results');
    wrap.innerHTML = '<div style="color:var(--text-3);font-size:12px;">Buscando…</div>';
    try {
      var isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.trim());
      var qb = sb.from('facturas')
        .select('id,emisor_nombre,receptor_nombre,numero_factura,total,fecha,tipo')
        .order('fecha', { ascending: false }).limit(10);
      var res = isUUID
        ? await qb.eq('id', q.trim().toLowerCase())
        : await qb.or('emisor_nombre.ilike.%'+q+'%,receptor_nombre.ilike.%'+q+'%,numero_factura.ilike.%'+q+'%,filename_original.ilike.%'+q+'%');
      var rows = res.data || [];
      if (!rows.length) { wrap.innerHTML = '<div style="color:var(--text-3);font-size:12px;">Sin resultados.</div>'; return; }
      wrap.innerHTML = rows.map(function(r) {
        var empresa = r.tipo === 'emitida' ? (r.receptor_nombre||r.emisor_nombre||'—') : (r.emisor_nombre||r.receptor_nombre||'—');
        var total = r.total != null ? '$'+parseFloat(r.total).toLocaleString('es-MX',{minimumFractionDigits:2}) : '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;border:1px solid var(--border);margin-bottom:4px;" ' +
          'onmouseenter="this.style.background=\'var(--bg-card-2)\'" onmouseleave="this.style.background=\'\'" ' +
          'onclick="docsVincularConfirmar(\''+r.id+'\')">' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:500;">'+_docsEsc(empresa)+'</div>' +
            '<div style="font-size:11px;color:var(--text-3);">'+(r.numero_factura||'—')+' · '+(r.fecha||'—')+'</div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:600;">'+total+'</div>' +
        '</div>';
      }).join('');
    } catch(e) { wrap.innerHTML = '<div style="color:#f87171;font-size:12px;">'+e.message+'</div>'; }
  }, 350);
}

async function docsVincularConfirmar(facturaId) {
  if (!_docsVincularDoc) return;
  try {
    await DB.documentos.vincular(_docsVincularDoc.id, facturaId, _docsVincularDoc.path);
    docsVincularCerrar();
    showStatus('✓ PDF vinculado a la factura');
    await docsCargarHuerfanos();
    docsRenderHuerfanos();
    docsBuscar(); // refrescar tabla principal
  } catch(e) {
    showError('Error al vincular: ' + e.message);
  }
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

  // Sin criterios: mostrar recientes (límite 50)
  if (!q && !año && !tipo && !archivo) {
    document.getElementById('docs-empty').style.display  = 'none';
    document.getElementById('docs-spinner').style.display = 'inline';
    try {
      var recentRows = await _docsFetch('', '', '', '');
      _docsResults = recentRows;
      docsRender(recentRows);
    } catch(e) { showError('Error cargando documentos: ' + e.message); }
    finally { document.getElementById('docs-spinner').style.display = 'none'; }
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
    return qb.order('fecha', { ascending: false }).limit(10);
  }

  var rows = [];
  var seen = {};
  function merge(arr) {
    (arr || []).forEach(function(r) { if (!seen[r.id]) { rows.push(r); seen[r.id] = true; } });
  }

  if (q) {
    // 1. Búsqueda por texto + filename_original
    var textRows = await base().or(
      'emisor_nombre.ilike.%' + q + '%' +
      ',receptor_nombre.ilike.%' + q + '%' +
      ',numero_factura.ilike.%' + q + '%' +
      ',filename_original.ilike.%' + q + '%'
    );
    merge(textRows.data || []);

    // 2. UUID exact match — completo o parcial desde el inicio
    if (/^[0-9a-f\-]{8,}$/i.test(q.trim())) {
      try {
        var uuidQ = q.trim().toLowerCase();
        var uuidRes = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidQ)
          ? await base().eq('id', uuidQ)
          : await base().ilike('id::text', uuidQ + '%');
        merge((uuidRes.data || []));
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

  // ── Tabla documentos (PDFs huérfanos) ──────────────────
  var orphans = [];
  try {
    var oqb = sb.from('documentos').select('*').is('factura_id', null).order('created_at', { ascending: false }).limit(10);
    if (q) oqb = oqb.ilike('nombre', '%' + q + '%');
    var oRes = await oqb;
    orphans = (oRes.data || []).map(function(d){ return Object.assign({}, d, { _orphan: true }); });
  } catch(e) { /* silenciar */ }

  return rows.concat(orphans);
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
    var rowStyle = 'background:#fff;border-bottom:1px solid var(--border);cursor:default;';

    // ── Fila huérfana (tabla documentos) ──────────────────
    if (r._orphan) {
      var fecha = r.created_at ? r.created_at.slice(0,10) : '—';
      html += '<tr style="'+rowStyle+'opacity:.75;" onmouseenter="this.style.background=\'#f5f4f0\'" onmouseleave="this.style.background=\'#fff\'">' +
        '<td style="padding:10px 8px;border-left:3px solid #94a3b8;color:var(--text-2);font-style:italic;" colspan="3">'+_docsEsc(r.nombre)+'</td>' +
        '<td style="padding:8px 8px;color:var(--text-3);">'+fecha+'</td>' +
        '<td colspan="3"><span style="color:#94a3b8;font-size:11px;">Sin vincular</span></td>' +
        '<td style="padding:8px 8px;text-align:center;">' +
          '<button class="btn-sm" style="padding:3px 8px;font-size:11px;" onclick="docsAbrir(\''+r.path+'\',\'pdf\')">PDF</button> ' +
          '<button class="btn-sm" style="padding:3px 8px;font-size:11px;" onclick="docsVincularAbrir(\''+r.id+'\',\''+r.path+'\',\''+_docsEsc(r.nombre)+'\')">Vincular</button>' +
        '</td>' +
      '</tr>';
      return;
    }

    // ── Fila factura ───────────────────────────────────────
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
    rowStyle += (cancelada ? 'opacity:.55;' : '');
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
  // Pasar todos los archivos al flujo unificado — importarXMLsCFDI separa por extensión internamente
  var fakeInput = { files: Array.from(files), value: '' };
  importarXMLsCFDI(fakeInput);
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
