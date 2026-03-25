// ── Documentos ────────────────────────────────────────────
// Sección de búsqueda y previsualización de archivos en Storage

var _docsResults = [];
var _docsSearchTimer = null;
var _docsPage = 1;
var _docsPageSize = 10;

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
  _docsPage = 1; // reset a primera página en cada nueva búsqueda
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
    return qb.order('fecha', { ascending: false }).limit(500);
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

  // ── Tabla documentos (PDFs huérfanos + complementos) ───
  var orphans = [];
  try {
    // PDFs sin vincular
    var oqb = sb.from('documentos').select('*').is('factura_id', null).order('created_at', { ascending: false }).limit(500);
    if (q) oqb = oqb.ilike('nombre', '%' + q + '%');
    var oRes = await oqb;
    orphans = (oRes.data || []).map(function(d){ return Object.assign({}, d, { _orphan: true }); });

    // Complementos y cancelaciones (tienen factura_id o tipo especial)
    var cqb = sb.from('documentos').select('*').in('tipo', ['complemento','cancelacion']).order('created_at', { ascending: false }).limit(500);
    if (q) cqb = cqb.ilike('nombre', '%' + q + '%');
    var cRes = await cqb;
    var seenIds = new Set(orphans.map(function(o){ return o.id; }));
    (cRes.data || []).forEach(function(d){
      if (seenIds.has(d.id)) return;
      orphans.push(Object.assign({}, d, { _complemento: d.tipo === 'complemento', _cancelacion: d.tipo === 'cancelacion' }));
      seenIds.add(d.id);
    });
  } catch(e) { /* silenciar */ }

  return rows.concat(orphans);
}

// ── Paginación ────────────────────────────────────────────
function docsGoPage(n) {
  var totalPages = Math.ceil(_docsResults.length / _docsPageSize);
  if (n < 1 || n > totalPages) return;
  _docsPage = n;
  docsRender(_docsResults);
}

function docsSetPageSize(n) {
  _docsPageSize = n;
  _docsPage = 1;
  docsRender(_docsResults);
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

  // ── Paginación: slicear filas de la página actual ──────
  var total = rows.length;
  var totalPages = Math.max(1, Math.ceil(total / _docsPageSize));
  if (_docsPage > totalPages) _docsPage = totalPages;
  var start = (_docsPage - 1) * _docsPageSize;
  var end   = Math.min(start + _docsPageSize, total);
  var pageRows = rows.slice(start, end);

  var html = '<div style="display:flex;flex-direction:column;gap:8px;">';

  pageRows.forEach(function(r) {

    // ── Tarjeta huérfana ──────────────────────────────────
    if (r._orphan) {
      var fecha = r.created_at ? r.created_at.slice(0,10) : '—';
      html +=
        '<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-left:3px solid #94a3b8;border-radius:8px;padding:12px 16px;opacity:.8;">' +
          '<div style="width:36px;height:44px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📄</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:500;color:var(--text-2);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_docsEsc(r.nombre)+'</div>' +
            '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+fecha+' · <span style="color:#94a3b8;">Sin vincular</span></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button class="btn-sm" style="font-size:11px;" onclick="docsAbrir(\''+r.path+'\',\'pdf\')">Ver PDF</button>' +
            '<button class="btn-sm" style="font-size:11px;" onclick="docsVincularAbrir(\''+r.id+'\',\''+r.path+'\',\''+_docsEsc(r.nombre)+'\')">Vincular</button>' +
          '</div>' +
        '</div>';
      return;
    }

    // ── Tarjeta cancelación ───────────────────────────────
    if (r._cancelacion) {
      var fecha = r.created_at ? r.created_at.slice(0,10) : '—';
      html +=
        '<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-left:3px solid #f87171;border-radius:8px;padding:12px 16px;">' +
          '<div style="width:36px;height:44px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🚫</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:500;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_docsEsc(r.nombre)+'</div>' +
            '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+fecha+' · <span style="color:#f87171;font-weight:600;">Acuse de cancelación</span></div>' +
          '</div>' +
        '</div>';
      return;
    }

    // ── Tarjeta complemento de pago ───────────────────────
    if (r._complemento) {
      var fecha = r.created_at ? r.created_at.slice(0,10) : '—';
      html +=
        '<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-left:3px solid #60a5fa;border-radius:8px;padding:12px 16px;">' +
          '<div style="width:36px;height:44px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💳</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:500;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_docsEsc(r.nombre)+'</div>' +
            '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+fecha+' · <span style="color:#60a5fa;font-weight:600;">Complemento de pago</span></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button class="btn-sm" style="font-size:11px;" onclick="docsAbrir(\''+r.path+'\',\'xml\')">Ver XML</button>' +
            (r.pdf_path ? '<button class="btn-sm" style="font-size:11px;" onclick="docsAbrir(\''+r.pdf_path+'\',\'pdf\')">Ver PDF</button>' : '') +
          '</div>' +
        '</div>';
      return;
    }

    // ── Tarjeta factura ───────────────────────────────────
    var empresa = r.tipo === 'emitida'
      ? (r.receptor_nombre || r.emisor_nombre || '—')
      : (r.emisor_nombre   || r.receptor_nombre || '—');
    var folio   = r.numero_factura || '—';
    var fecha   = r.fecha ? r.fecha.slice(0,10) : '—';
    var total   = r.total != null ? '$' + parseFloat(r.total).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

    var cancelada  = r.estatus === 'cancelada';
    var acento     = cancelada ? '#f87171' : r.tipo === 'emitida' ? '#34d399' : '#f59e0b';
    var tipoTxt    = r.tipo === 'emitida' ? 'Emitida' : 'Recibida';
    var tipoColor  = r.tipo === 'emitida' ? '#34d399' : '#f59e0b';

    var uuid    = r.uuid_sat || r.id || '';
    var copyBtn = uuid
      ? '<button onclick="docsCopiarUUID(\''+uuid+'\',this)" title="Copiar UUID" style="background:none;border:none;cursor:pointer;color:#b0aaa0;font-size:13px;padding:0 2px;line-height:1;" onmouseenter="this.style.color=\'#666\'" onmouseleave="this.style.color=\'#b0aaa0\'">⧉</button>'
      : '';

    // Ícono compuesto según archivos disponibles
    var hasXML = !!r.xml_path, hasPDF = !!r.pdf_path;
    var iconBg  = cancelada ? '#fee2e2' : r.tipo === 'emitida' ? '#d1fae5' : '#fef3c7';
    var iconTxt = cancelada ? '🚫' : hasPDF ? '📄' : '📋';

    var fileBtns = '';
    if (hasXML) fileBtns += '<button onclick="docsAbrir(\''+r.xml_path+'\',\'xml\')" style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;letter-spacing:.02em;" onmouseenter="this.style.background=\'#e2e8f0\'" onmouseleave="this.style.background=\'#f1f5f9\'">XML</button> ';
    if (hasPDF) fileBtns  += '<button onclick="docsAbrir(\''+r.pdf_path+'\',\'pdf\')" style="display:inline-flex;align-items:center;gap:3px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;color:#dc2626;cursor:pointer;letter-spacing:.02em;" onmouseenter="this.style.background=\'#fecaca\'" onmouseleave="this.style.background=\'#fef2f2\'">PDF</button>';

    var concilBadge = r.conciliado
      ? '<span style="font-size:11px;color:#34d399;font-weight:600;">✓ Conciliada</span>'
      : '<span style="font-size:11px;color:#f59e0b;">Pendiente</span>';

    html +=
      '<div style="display:flex;align-items:stretch;background:#fff;border:1px solid var(--border);border-left:3px solid '+acento+';border-radius:8px;overflow:hidden;' + (cancelada ? 'opacity:.55;' : '') + '">' +
        // Ícono
        '<div style="width:52px;background:'+iconBg+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;border-right:1px solid var(--border);">'+iconTxt+'</div>' +
        // Contenido
        '<div style="flex:1;min-width:0;padding:10px 14px;display:flex;align-items:center;gap:16px;">' +
          // Empresa + folio
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (cancelada ? 'text-decoration:line-through;' : '') + '">'+_docsEsc(empresa)+'</div>' +
            '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+_docsEsc(folio)+' · '+fecha+copyBtn+'</div>' +
          '</div>' +
          // Total
          '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--text-1);">'+total+'</div>' +
            '<div style="font-size:10px;color:'+tipoColor+';font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:1px;">'+tipoTxt+'</div>' +
          '</div>' +
          // Badges estatus
          '<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">' +
            concilBadge +
          '</div>' +
          // Botones archivo
          '<div style="flex-shrink:0;">'+fileBtns+'</div>' +
        '</div>' +
      '</div>';
  });

  html += '</div>';

  // ── Footer de paginación ──────────────────────────────
  var btnBase = 'padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--text-2);font-size:12px;cursor:pointer;';
  var pager =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);gap:8px;flex-wrap:wrap;">' +
      // Izq: selector de tamaño de página
      '<div style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-3);">Ver&nbsp;' +
        [10,20,50].map(function(n){
          var act = n === _docsPageSize;
          return '<button onclick="docsSetPageSize('+n+')" style="padding:2px 8px;border-radius:4px;border:1px solid '+(act?'var(--text-2)':'var(--border)')+';background:'+(act?'var(--text-1)':'none')+';color:'+(act?'#fff':'var(--text-2)')+';font-size:12px;cursor:pointer;font-weight:'+(act?'600':'400')+';">'+n+'</button>';
        }).join('') +
      '</div>' +
      // Centro: rango
      '<div style="font-size:12px;color:var(--text-3);">' + (start+1) + '–' + end + ' de ' + total + '</div>' +
      // Der: anterior / siguiente
      '<div style="display:flex;gap:6px;">' +
        '<button onclick="docsGoPage('+(_docsPage-1)+')" '+(_docsPage<=1?'disabled':'')+' style="'+btnBase+(_docsPage<=1?'opacity:.35;cursor:default;':'')+'">← Ant.</button>' +
        '<button onclick="docsGoPage('+(_docsPage+1)+')" '+(_docsPage>=totalPages?'disabled':'')+' style="'+btnBase+(_docsPage>=totalPages?'opacity:.35;cursor:default;':'')+'">Sig. →</button>' +
      '</div>' +
    '</div>';

  wrap.innerHTML = html + pager;
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
