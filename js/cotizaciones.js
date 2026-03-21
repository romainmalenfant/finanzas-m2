// ── Cotizaciones ──────────────────────────────────────────
var cotizaciones = [], allCotizaciones = [];
var cotView = 'lista'; // 'lista' | 'kanban'
var cotYearFilter = new Date().getFullYear();
var cotHistorialOpen = false;
var cotItemsTemp = []; // items in current form
var cotEditId = null;

// ── Load & Render ─────────────────────────────────────────
async function loadCotizaciones(){
  try{
    var {data,error} = await sb.from('cotizaciones')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(500);
    if(error)throw error;
    cotizaciones = data||[]; allCotizaciones = cotizaciones;
    // Init year filter
    var yearSel = document.getElementById('cot-year-filter');
    if(yearSel && yearSel.options.length===0){
      var años = [...new Set(cotizaciones.map(function(c){return new Date(c.fecha||c.created_at).getFullYear();}))];
      var currentYear = new Date().getFullYear();
      if(!años.includes(currentYear)) años.push(currentYear);
      años.sort(function(a,b){return b-a;});
      años.forEach(function(y){
        var o=document.createElement('option');
        o.value=y; o.textContent=y;
        if(y===cotYearFilter)o.selected=true;
        yearSel.appendChild(o);
      });
    }
    renderCotizacionesKPIs();
    filtrarCotizaciones('');
  }catch(e){console.error('Cotizaciones:',e); showError('Error cargando cotizaciones');}
}

function renderCotizacionesKPIs(){
  var total = cotizaciones.length;
  var abiertas = cotizaciones.filter(function(c){return c.estatus==='borrador'||c.estatus==='enviada';}).length;
  var cerradas = cotizaciones.filter(function(c){return c.estatus==='cerrada';}).length;
  var perdidas = cotizaciones.filter(function(c){return c.estatus==='perdida';}).length;
  var pipeline = cotizaciones.filter(function(c){return c.estatus==='borrador'||c.estatus==='enviada';})
    .reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
  var el = function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('cot-k-total', total);
  el('cot-k-abiertas', abiertas);
  el('cot-k-cerradas', cerradas);
  el('cot-k-perdidas', perdidas);
  el('cot-k-pipeline', fmt(pipeline));
}

function filtrarCotizaciones(q){
  var ql = (q||'').toLowerCase();
  var filtroEstatus = document.getElementById('cot-estatus-filter');
  var estatus = filtroEstatus ? filtroEstatus.value : '';
  var hoy = new Date();
  var hace90 = new Date(hoy); hace90.setDate(hace90.getDate()-90);

  var filtered = allCotizaciones.filter(function(c){
    // Year filter
    var d = new Date(c.fecha||c.created_at);
    if(d.getFullYear() !== cotYearFilter) return false;
    if(estatus && c.estatus !== estatus) return false;
    if(!ql) return true;
    return (c.numero||'').toLowerCase().includes(ql) ||
           (c.cliente_nombre||'').toLowerCase().includes(ql);
  });

  // Split: activas = borrador/enviada/en_negociacion OR cerradas/perdidas <90 días
  var activas = filtered.filter(function(c){
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion') return true;
    var d = new Date(c.fecha||c.created_at);
    return d >= hace90;
  });
  var historial = filtered.filter(function(c){
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion') return false;
    var d = new Date(c.fecha||c.created_at);
    return d < hace90;
  });

  renderCotizacionesList(activas, historial);
}

var EST_LABELS = {borrador:'Borrador', enviada:'Enviada', en_negociacion:'En negociación', cerrada:'Cerrada ✓', perdida:'Perdida'};
var EST_COLORS = {borrador:'#64748b', enviada:'#60a5fa', en_negociacion:'#a78bfa', cerrada:'#34d399', perdida:'#f87171'};

// -- T6: Pure render functions --

function renderCotizacionCard(c, variant){
  // variant: 'active' | 'historial'
  var color = EST_COLORS[c.estatus]||'#475569';
  var label = EST_LABELS[c.estatus]||c.estatus;

  var card = document.createElement('div');
  card.className = 'proj-card';
  card.style.cursor = 'pointer';
  if(variant==='historial') card.style.opacity = '0.7';
  card.addEventListener('click', function(){ verDetalleCotizacion(c.id); });

  var hdr = document.createElement('div');
  hdr.className = 'proj-hdr';
  hdr.style.cursor = 'pointer';

  var titleDiv = document.createElement('div');
  titleDiv.className = 'proj-title';
  var nombre = document.createElement('div');
  nombre.className = 'proj-nombre';
  nombre.textContent = c.numero||'COT';
  var cliente = document.createElement('div');
  cliente.className = 'proj-cliente';
  if(variant==='active'){
    cliente.textContent = (c.cliente_nombre||'Sin cliente') + ' · Vigencia: '+(c.vigencia_dias||15)+' días';
  } else {
    cliente.textContent = c.cliente_nombre||'';
  }
  titleDiv.appendChild(nombre);
  titleDiv.appendChild(cliente);

  var right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:12px;';

  var totalEl = document.createElement('div');
  totalEl.style.cssText = variant==='active'
    ? 'font-size:16px;font-weight:700;color:var(--text-1);'
    : 'font-size:15px;font-weight:600;color:var(--text-2);';
  totalEl.textContent = fmt(c.total||0);

  var badge = document.createElement('span');
  badge.style.cssText = 'padding:'+(variant==='active'?'3px 10px':'2px 8px')+';border-radius:5px;font-size:11px;font-weight:600;background:'+color+'22;color:'+color+';';
  badge.textContent = label;

  right.appendChild(totalEl);
  right.appendChild(badge);

  if(variant==='active'){
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-sm';
    editBtn.style.flexShrink = '0';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', function(e){ e.stopPropagation(); editarCotizacion(c.id); });
    right.appendChild(editBtn);
  }

  hdr.appendChild(titleDiv);
  hdr.appendChild(right);
  card.appendChild(hdr);

  if(variant==='active'){
    var meta = document.createElement('div');
    meta.style.cssText = 'padding:8px 1.25rem;display:flex;gap:16px;font-size:11px;color:var(--text-3);';
    var fechaSpan = document.createElement('span');
    fechaSpan.textContent = 'Fecha: '+fmtDate(c.fecha);
    meta.appendChild(fechaSpan);
    if(c.notas){
      var notasSpan = document.createElement('span');
      notasSpan.textContent = c.notas.slice(0,60);
      meta.appendChild(notasSpan);
    }
    card.appendChild(meta);
  }
  return card;
}

function renderKanbanCard(c, col, hoy){
  var color = EST_COLORS[col.key]||'#475569';
  var dias = Math.floor((hoy - new Date(c.created_at||c.fecha)) / 864e5);
  var colIdx = KANBAN_COLS.findIndex(function(k){return k.key===col.key;});
  var prevCol = colIdx > 0 ? KANBAN_COLS[colIdx-1] : null;
  var nextCol = colIdx < KANBAN_COLS.length-1 ? KANBAN_COLS[colIdx+1] : null;

  var card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.addEventListener('click', function(){ verDetalleCotizacion(c.id); });
  card.addEventListener('dragstart', function(e){ kanbanDragStart(e, c.id); });

  // Header row
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;';
  var numSpan = document.createElement('span');
  numSpan.style.cssText = 'font-size:11px;font-weight:600;color:'+color+';';
  numSpan.textContent = c.numero||'COT';
  var diasSpan = document.createElement('span');
  diasSpan.style.cssText = 'font-size:10px;color:var(--text-3);';
  diasSpan.textContent = dias+'d';
  hdrRow.appendChild(numSpan);
  hdrRow.appendChild(diasSpan);

  // Cliente
  var cliDiv = document.createElement('div');
  cliDiv.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  cliDiv.textContent = c.cliente_nombre||'Sin cliente';

  // Total
  var totalDiv = document.createElement('div');
  totalDiv.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-1);';
  totalDiv.textContent = fmt(c.total||0);

  card.appendChild(hdrRow);
  card.appendChild(cliDiv);
  card.appendChild(totalDiv);

  // Notas
  if(c.notas){
    var notasDiv = document.createElement('div');
    notasDiv.style.cssText = 'font-size:10px;color:var(--text-3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    notasDiv.textContent = c.notas;
    card.appendChild(notasDiv);
  }

  // Move buttons (touch support)
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:space-between;gap:4px;margin-top:8px;';
  btnRow.addEventListener('click', function(e){ e.stopPropagation(); });

  function makeNavBtn(targetCol, label, align){
    var btn = document.createElement('button');
    btn.className = 'btn-sm';
    btn.style.cssText = 'font-size:10px;padding:2px 6px;flex:1;'+(align==='right'?'text-align:right;':'');
    btn.title = 'Mover a '+targetCol.label;
    btn.textContent = align==='right' ? targetCol.label+' →' : '← '+targetCol.label;
    btn.addEventListener('click', function(e){ kanbanMoveCard(e, c.id, col.key, targetCol.key); });
    return btn;
  }
  if(prevCol) btnRow.appendChild(makeNavBtn(prevCol, prevCol.label, 'left'));
  else { var sp=document.createElement('span'); sp.style.flex='1'; btnRow.appendChild(sp); }
  if(nextCol) btnRow.appendChild(makeNavBtn(nextCol, nextCol.label, 'right'));
  else { var sp2=document.createElement('span'); sp2.style.flex='1'; btnRow.appendChild(sp2); }
  card.appendChild(btnRow);

  return card;
}

function renderCotItemRow(item){
  var tid = item._tempId||item.id;
  var isMaq = item.tipo==='maquinado';
  var isSvc = item.tipo==='servicio';

  var wrap = document.createElement('div');
  wrap.id = 'cot-item-'+tid;
  wrap.style.cssText = 'background:var(--bg-card-2);border-radius:8px;padding:12px;margin-bottom:8px;border:0.5px solid var(--border);';

  // Header: type label + delete button
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  var typeLabel = document.createElement('span');
  typeLabel.style.cssText = 'font-size:10px;font-weight:600;color:var(--brand-red);text-transform:uppercase;';
  typeLabel.textContent = isMaq?'🔩 Maquinado':isSvc?'⚙️ Servicio':'📦 Producto';
  var delBtn = document.createElement('button');
  delBtn.style.cssText = 'background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', function(){ eliminarCotItem(tid); });
  hdr.appendChild(typeLabel);
  hdr.appendChild(delBtn);
  wrap.appendChild(hdr);

  // Helper to create a form-group with label + input
  function makeField(labelText, inputEl, flex){
    var fg = document.createElement('div');
    fg.className = 'form-group';
    if(flex) fg.style.flex = flex;
    var lbl = document.createElement('label');
    lbl.textContent = labelText;
    fg.appendChild(lbl);
    fg.appendChild(inputEl);
    return fg;
  }

  function textInput(val, placeholder, field){
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = val; inp.placeholder = placeholder;
    inp.addEventListener('input', function(){ updateCotItem(tid, field, this.value); });
    return inp;
  }
  function numInput(val, field, step){
    var inp = document.createElement('input');
    inp.type = 'number'; inp.value = val; inp.min = '0';
    inp.step = step||'0.01'; inp.setAttribute('inputmode','decimal');
    inp.addEventListener('input', function(){ updateCotItem(tid, field, parseFloat(this.value)||0); });
    return inp;
  }

  // Row 1: descripcion + material (if maquinado)
  var row1 = document.createElement('div');
  row1.className = 'form-row';
  var descPlaceholder = isMaq?'Nombre de pieza':isSvc?'Tipo de servicio':'Descripción';
  row1.appendChild(makeField('Descripción *', textInput(item.descripcion||'', descPlaceholder, 'descripcion'), '2'));
  if(isMaq) row1.appendChild(makeField('Material', textInput(item.material||'', 'Acero, aluminio...', 'material')));
  wrap.appendChild(row1);

  // Row 2: cantidad, unidad, precio, subtotal
  var row2 = document.createElement('div');
  row2.className = 'form-row';
  row2.appendChild(makeField(isSvc?'Horas':'Cantidad', numInput(item.cantidad||1, 'cantidad')));
  row2.appendChild(makeField('Unidad', textInput(item.unidad||'pzas', '', 'unidad')));
  row2.appendChild(makeField('Precio unitario ($)', numInput(item.precio_unitario||0, 'precio_unitario')));
  var subDisplay = document.createElement('div');
  subDisplay.id = 'sub-'+tid;
  subDisplay.style.cssText = 'padding:8px 10px;background:var(--bg-card);border-radius:8px;font-size:14px;font-weight:600;color:#34d399;';
  subDisplay.textContent = fmt((item.cantidad||0)*(item.precio_unitario||0));
  row2.appendChild(makeField('Subtotal', subDisplay));
  wrap.appendChild(row2);

  // Row 3: notas
  var row3 = document.createElement('div');
  row3.className = 'form-group';
  var notasLbl = document.createElement('label');
  notasLbl.textContent = 'Notas del item';
  row3.appendChild(notasLbl);
  row3.appendChild(textInput(item.notas||'', 'Especificaciones adicionales...', 'notas'));
  wrap.appendChild(row3);

  return wrap;
}

function renderCotizacionesList(list, historial){
  var wrap = document.getElementById('cot-lista-wrap');
  if(!wrap) return;
  var el = document.getElementById('cotizaciones-list');
  if(!el){
    wrap.innerHTML = '<div id="cotizaciones-list"></div>';
    el = wrap.querySelector('#cotizaciones-list');
  }
  var ct = document.getElementById('cot-count');
  var total = list.length + (historial?historial.length:0);
  if(ct) ct.textContent = total + ' cotizaci' + (total===1?'ón':'ones');
  el.innerHTML = '';
  if(!list.length && !(historial&&historial.length)){
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Sin cotizaciones para '+cotYearFilter+'.';
    el.appendChild(empty);
    renderHistorialCotizaciones(wrap, []);
    return;
  }
  var frag = document.createDocumentFragment();
  list.forEach(function(c){ frag.appendChild(renderCotizacionCard(c, 'active')); });
  el.appendChild(frag);
  renderHistorialCotizaciones(wrap, historial||[]);
}


// ── Cliente select ────────────────────────────────────────
function poblarClientesCot(clienteIdActual){
  var inp = document.getElementById('cot-cliente-search');
  var hid = document.getElementById('cot-cliente-id');
  if(!inp) return;
  var c = clientes.find(function(x){return x.id===clienteIdActual;});
  inp.value = c?c.nombre:'';
  if(hid) hid.value = clienteIdActual||'';
  makeAutocomplete('cot-cliente-search','cot-cliente-id','cot-cliente-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},
    function(){ precargarContactosCot(); setTimeout(precargarProyectosCot, 30); }
  );
  if(!allProyectos.length) loadProyectos();
  makeAutocomplete('cot-proj-search','cot-proj-id','cot-proj-dd',
    function(){return (allProyectos||[]).map(function(p){return {id:p.id,label:p.nombre||p.titulo||'',sub:p.cliente_nombre||''};});},
    null
  );
}

// ── Form ──────────────────────────────────────────────────
function renderHistorialCotizaciones(wrap, list){
  var existing = document.getElementById('cot-historial-section');
  if(existing) existing.remove();
  if(!wrap || !list.length) return;

  var section = document.createElement('div');
  section.id = 'cot-historial-section';
  section.style.marginTop = '20px';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;cursor:pointer;user-select:none;';

  var hdrLabel = document.createElement('span');
  hdrLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-3);';
  hdrLabel.textContent = '📦 Historial archivado (>90 días) — '+list.length+' cotizaci'+(list.length===1?'ón':'ones');
  var arrow = document.createElement('span');
  arrow.id = 'hst-arrow';
  arrow.style.cssText = 'font-size:10px;color:var(--text-3);';
  arrow.textContent = cotHistorialOpen ? '▲' : '▼';
  hdr.appendChild(hdrLabel);
  hdr.appendChild(arrow);

  var body = document.createElement('div');
  body.id = 'cot-historial-body';
  body.style.display = cotHistorialOpen ? 'block' : 'none';
  body.style.marginTop = '8px';

  var frag = document.createDocumentFragment();
  list.forEach(function(c){ frag.appendChild(renderCotizacionCard(c, 'historial')); });
  body.appendChild(frag);

  hdr.addEventListener('click', function(){
    cotHistorialOpen = !cotHistorialOpen;
    body.style.display = cotHistorialOpen ? 'block' : 'none';
    var ar = document.getElementById('hst-arrow');
    if(ar) ar.textContent = cotHistorialOpen ? '▲' : '▼';
  });

  section.appendChild(hdr);
  section.appendChild(body);
  wrap.appendChild(section);
}

function abrirNuevaCotizacion(){
  cotEditId = null;
  cotItemsTemp = [];
  document.getElementById('cot-id-edit').value = '';
  document.getElementById('cot-modal-title').textContent = 'Nueva cotización';
  poblarClientesCot(null);
  var _ct=document.getElementById('cot-titulo'); if(_ct) _ct.value='';
  document.getElementById('cot-cliente-id').value = '';
  document.getElementById('cot-cliente-search').value = '';
  document.getElementById('cot-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cot-vigencia').value = '15';
  document.getElementById('cot-notas').value = '';
  // Limpiar contacto completamente al abrir nueva cotización
  var _ci = document.getElementById('cot-contacto-id');
  var _cs = document.getElementById('cot-contacto-search');
  var _cd = document.getElementById('cot-contacto-dd');
  if(_ci) _ci.value = '';
  if(_cs) _cs.value = '';
  if(_cd) { _cd.innerHTML = ''; _cd.style.display = 'none'; }
  renderCotItemsForm();
  recalcCotTotal();
  // BUG-04: z-index explícito para superar el detail panel (z-index:500)
  var _cotM = document.getElementById('cot-modal');
  _cotM.style.zIndex = '700';
  _cotM.style.display = 'flex';
  if(!clientes.length) loadClientes();
}

function editarCotizacion(id){
  var c = cotizaciones.find(function(x){return x.id===id;});
  if(!c) return;
  cotEditId = id;
  document.getElementById('cot-id-edit').value = id;
  document.getElementById('cot-modal-title').textContent = 'Editar cotización';
  if(!clientes.length) loadClientes().then(function(){poblarClientesCot(c.cliente_id||null);});
  else poblarClientesCot(c.cliente_id||null);
  var _ct2=document.getElementById('cot-titulo'); if(_ct2) _ct2.value=c.titulo||'';
  document.getElementById('cot-cliente-id').value = c.cliente_id||'';
  document.getElementById('cot-cliente-search').value = c.cliente_nombre||'';
  // Pre-fill proyecto if set
  var projId = c.proyecto_id||'';
  var projInp2 = document.getElementById('cot-proj-search');
  var projHid2 = document.getElementById('cot-proj-id');
  if(projId && projHid2){
    projHid2.value = projId;
    var proy = (allProyectos||[]).find(function(x){return x.id===projId;});
    if(proy && projInp2) projInp2.value = proy.nombre||proy.titulo||'';
  } else {
    if(projHid2) projHid2.value = '';
    if(projInp2) projInp2.value = '';
    if(c.cliente_id) setTimeout(precargarProyectosCot, 80);
  }
  // Pre-fill contact if set
  var contId = c.contacto_id||'';
  if(contId && document.getElementById('cot-contacto-id')){
    document.getElementById('cot-contacto-id').value = contId;
    var cont = (contactos||[]).find(function(x){return x.id===contId;});
    if(cont && document.getElementById('cot-contacto-search')){
      var cNombre = (cont.nombre||'')+(cont.apellido?' '+cont.apellido:'');
      document.getElementById('cot-contacto-search').value = cNombre;
    }
    setTimeout(function(){ actualizarBtnClear('cot-contacto-id','cot-contacto-clear'); }, 50);
  } else {
    if(document.getElementById('cot-contacto-id')) document.getElementById('cot-contacto-id').value='';
    if(document.getElementById('cot-contacto-search')) document.getElementById('cot-contacto-search').value='';
    // Pre-populate with client's contacts
    if(c.cliente_id) setTimeout(precargarContactosCot, 50);
  }
  document.getElementById('cot-fecha').value = c.fecha||'';
  document.getElementById('cot-vigencia').value = c.vigencia_dias||15;
  document.getElementById('cot-notas').value = c.notas||'';
  // Load items
  sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden').then(function(res){
    cotItemsTemp = res.data||[];
    renderCotItemsForm();
    recalcCotTotal();
  });
  // BUG-04: z-index explícito para superar el detail panel (z-index:500)
  var _cotM2 = document.getElementById('cot-modal');
  _cotM2.style.zIndex = '700';
  _cotM2.style.display = 'flex';
}

function cerrarCotModal(){
  // Reset contacto
  var inp = document.getElementById('cot-contacto-search');
  var hid = document.getElementById('cot-contacto-id');
  var dd  = document.getElementById('cot-contacto-dd');
  if(inp) inp.value = '';
  if(hid) hid.value = '';
  if(dd)  { dd.innerHTML=''; dd.style.display='none'; }
  // Reset proyecto
  var pi = document.getElementById('cot-proj-search');
  var ph = document.getElementById('cot-proj-id');
  var pd = document.getElementById('cot-proj-dd');
  if(pi) pi.value = '';
  if(ph) ph.value = '';
  if(pd) { pd.innerHTML=''; pd.style.display='none'; }

  document.getElementById('cot-modal').style.display = 'none';
}

// ── Items ─────────────────────────────────────────────────
function agregarCotItem(tipo){
  cotItemsTemp.push({
    _tempId: Date.now(),
    tipo: tipo||'producto',
    descripcion: '',
    material: '',
    cantidad: 1,
    unidad: tipo==='servicio'?'hrs':'pzas',
    precio_unitario: 0,
    subtotal: 0,
    notas: ''
  });
  renderCotItemsForm();
}

function eliminarCotItem(tempId){
  cotItemsTemp = cotItemsTemp.filter(function(i){return String(i._tempId||i.id)!==String(tempId);});
  renderCotItemsForm();
  recalcCotTotal();
}

function renderCotItemsForm(){
  var el = document.getElementById('cot-items-list');
  el.innerHTML = '';
  if(!cotItemsTemp.length){
    var msg = document.createElement('div');
    msg.style.cssText = 'color:var(--text-3);font-size:12px;padding:12px 0;text-align:center;';
    msg.textContent = 'Sin items. Agrega uno abajo.';
    el.appendChild(msg);
    return;
  }
  var frag = document.createDocumentFragment();
  cotItemsTemp.forEach(function(item){ frag.appendChild(renderCotItemRow(item)); });
  el.appendChild(frag);
}

function updateCotItem(tempId, field, value){
  var item = cotItemsTemp.find(function(i){return String(i._tempId||i.id)===String(tempId);});
  if(!item) return;
  item[field] = value;
  item.subtotal = (parseFloat(item.cantidad)||0)*(parseFloat(item.precio_unitario)||0);
  // Update subtotal display directly
  var subEl = document.getElementById('sub-'+tempId);
  if(subEl) subEl.textContent = fmt(item.subtotal);
  recalcCotTotal();
}

function recalcCotTotal(){
  var subtotal = cotItemsTemp.reduce(function(a,i){return a+(parseFloat(i.subtotal)||0);},0);
  var iva = subtotal * 0.16;
  var total = subtotal + iva;
  var el = function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('cot-subtotal', fmt(subtotal));
  el('cot-iva', fmt(iva));
  el('cot-total', fmt(total));
}

// ── Cliente autocomplete in cot form ─────────────────────
function buscarClienteCot(q){
  var dd = document.getElementById('cot-cliente-dropdown');
  if(!q.trim()){dd.style.display='none';return;}
  var ql = q.toLowerCase();
  var matches = clientes.filter(function(c){
    return (c.nombre||'').toLowerCase().includes(ql)||(c.rfc||'').toLowerCase().includes(ql);
  }).slice(0,6);
  if(!matches.length){dd.style.display='none';return;}
  dd.style.display = 'block';
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  matches.forEach(function(c){
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border);color:var(--text-1);';
    var nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = '500';
    nameSpan.textContent = c.nombre;
    item.appendChild(nameSpan);
    if(c.rfc){
      var rfcSpan = document.createElement('span');
      rfcSpan.style.cssText = 'color:var(--text-3);font-size:11px;margin-left:6px;';
      rfcSpan.textContent = c.rfc;
      item.appendChild(rfcSpan);
    }
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    item.addEventListener('mousedown', function(){ selClienteCot(c.id, c.nombre); });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

function selClienteCot(id, nombre){
  document.getElementById('cot-cliente-id').value = id;
  document.getElementById('cot-cliente-search').value = nombre;
  document.getElementById('cot-cliente-selected').textContent = '✓ '+nombre;
  document.getElementById('cot-cliente-selected').style.display = 'block';
  document.getElementById('cot-cliente-dropdown').style.display = 'none';
}

document.addEventListener('click',function(e){
  // Cerrar dropdown de cliente
  var ddCli=document.getElementById('cot-cliente-dropdown');
  if(ddCli&&!ddCli.contains(e.target)&&e.target.id!=='cot-cliente-search') ddCli.style.display='none';
  // Cerrar dropdown de contacto al hacer clic fuera
  var ddCont=document.getElementById('cot-contacto-dd');
  if(ddCont&&ddCont.style.display!=='none'){
    var inp=document.getElementById('cot-contacto-search');
    if(!ddCont.contains(e.target)&&e.target!==inp) ddCont.style.display='none';
  }
});

// ── Guardar ───────────────────────────────────────────────
// ── Contactos vinculados al cliente en cotización ────────

/**
 * Pre-populates the contact dropdown with contacts
 * belonging to the currently selected client.
 * Called when client changes.
 */
function precargarContactosCot(){
  // Called on client change — reset contact field and reload dropdown
  var inp = document.getElementById('cot-contacto-search');
  var hid = document.getElementById('cot-contacto-id');
  if(inp) inp.value = '';
  if(hid) hid.value = '';
  actualizarBtnClear && actualizarBtnClear('cot-contacto-id','cot-contacto-clear');
  mostrarContactosCot();
}

function mostrarContactosCot(){
  // Called on focus — show contacts for selected client without resetting the field
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-contacto-dd');
  if(!dd) return;
  var pool = clienteId
    ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
    : [];
  if(!pool.length){
    dd.style.display = 'none';
    return;
  }
  _renderContactoCotDD(pool.slice(0,10), dd);
  dd.style.display = 'block';
}

/**
 * Filters contacts for the cotizacion contact search input.
 * Falls back to all contacts if no client is selected.
 */
function buscarContactoCot(q){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-contacto-dd');
  if(!dd) return;
  var ql = (q||'').toLowerCase().trim();
  if(!ql){ mostrarContactosCot(); return; }
  // Pool: contacts from selected client only
  var pool = clienteId
    ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
    : (contactos||[]);
  var matches = pool.filter(function(c){
    var nombre = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
    return nombre.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
  }).slice(0,10);
  if(!matches.length){ dd.style.display = 'none'; return; }
  _renderContactoCotDD(matches, dd);
  dd.style.display = 'block';
}

function _renderContactoCotDD(list, dd){
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  list.forEach(function(c){
    var nombre = (c.nombre||'') + (c.apellido ? ' '+c.apellido : '');
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:13px;';
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:500;color:var(--text-1);';
    nameEl.textContent = nombre;
    var subEl = document.createElement('div');
    subEl.style.cssText = 'font-size:10px;color:var(--text-3);';
    subEl.textContent = (c.cargo||'') + (c.email ? ' · '+c.email : '');
    item.appendChild(nameEl);
    item.appendChild(subEl);
    item.addEventListener('mousedown', function(){
      document.getElementById('cot-contacto-search').value = nombre;
      document.getElementById('cot-contacto-id').value = c.id;
      dd.style.display = 'none';
      actualizarBtnClear('cot-contacto-id','cot-contacto-clear');
    });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

async function guardarCotizacion(){
  var clienteId  = document.getElementById('cot-cliente-id').value||null;
  var contactoId = (document.getElementById('cot-contacto-id')||{}).value||null;
  var proyectoId = (document.getElementById('cot-proj-id')||{}).value||null;
  var sel = document.getElementById('cot-cliente-sel');
  var tituloVal = (document.getElementById('cot-titulo')||{}).value||'';
  var clienteNombre = clienteId && clientes.find(function(c){return c.id===clienteId;}) ?
    clientes.find(function(c){return c.id===clienteId;}).nombre :
    document.getElementById('cot-cliente-search').value.trim();
  if(!clienteId){showError('Selecciona un cliente de la lista.'); if(sel)sel.focus(); return;}
  if(!clienteNombre){showError('Selecciona un cliente de la lista.'); return;}
  if(!cotItemsTemp.length){showError('Agrega al menos un item.'); return;}

  var subtotal = cotItemsTemp.reduce(function(a,i){return a+(parseFloat(i.subtotal)||0);},0);
  var iva = subtotal*0.16;
  var total = subtotal+iva;
  var fecha = document.getElementById('cot-fecha').value;
  var año = new Date(fecha+'T12:00').getFullYear();

  try{
    var btn = document.getElementById('btn-save-cot');
    btn.disabled=true; btn.textContent='Guardando...';

    var cotData = {
      titulo:      tituloVal||null,
      cliente_id:  clienteId,
      contacto_id: contactoId,
      proyecto_id: proyectoId,
      cliente_nombre: clienteNombre,
      fecha: fecha,
      vigencia_dias: parseInt(document.getElementById('cot-vigencia').value)||15,
      notas: document.getElementById('cot-notas').value.trim()||null,
      subtotal: subtotal,
      iva: iva,
      total: total,
      estatus: cotEditId ? undefined : 'borrador'
    };

    var savedCot;
    if(cotEditId){
      var {data,error} = await sb.from('cotizaciones').update(cotData).eq('id',cotEditId).select().single();
      if(error)throw error;
      savedCot = data;
    } else {
      // Generate numero: COT-YYYY-XXX
      var {count} = await sb.from('cotizaciones').select('*',{count:'exact',head:true}).ilike('numero','COT-'+año+'-%');
      var num = 'COT-'+año+'-'+String((count||0)+1).padStart(3,'0');
      cotData.numero = num;
      var {data,error} = await sb.from('cotizaciones').insert([cotData]).select().single();
      if(error)throw error;
      savedCot = data;
    }

    // Upsert items
    if(cotEditId){
      await sb.from('cotizacion_items').delete().eq('cotizacion_id',cotEditId);
    }
    var items = cotItemsTemp.map(function(item,idx){
      return {
        cotizacion_id: savedCot.id,
        tipo: item.tipo,
        descripcion: item.descripcion,
        material: item.material||null,
        cantidad: parseFloat(item.cantidad)||1,
        unidad: item.unidad||'pzas',
        precio_unitario: parseFloat(item.precio_unitario)||0,
        subtotal: parseFloat(item.subtotal)||0,
        notas: item.notas||null,
        orden: idx
      };
    });
    var {error:ie} = await sb.from('cotizacion_items').insert(items);
    if(ie)throw ie;

    cerrarCotModal();
    await loadCotizaciones();
    showStatus('✓ Cotización guardada');
    verDetalleCotizacion(savedCot.id);
  }catch(e){
    console.error('guardarCotizacion:',e);
    showError('Error: '+e.message);
  }finally{
    var btn=document.getElementById('btn-save-cot');
    if(btn){btn.disabled=false;btn.textContent='Guardar';}
  }
}

// ── Cambiar estatus ───────────────────────────────────────
async function cambiarEstatusCot(id, estatus){
  try{
    var {error} = await sb.from('cotizaciones').update({estatus:estatus}).eq('id',id);
    if(error)throw error;
    if(estatus==='cerrada'){
      await convertirACotizacionCerrada(id);
    } else {
      await loadCotizaciones();
      if(cotView==='kanban') renderKanban();
      cerrarDetail();
      showStatus('✓ Cotización actualizada');
    }
  }catch(e){showError('Error: '+e.message);}
}

async function marcarPerdida(id){
  var motivo = prompt('Motivo de pérdida (opcional):') || '';
  try{
    await sb.from('cotizaciones').update({estatus:'perdida', motivo_perdida:motivo}).eq('id',id);
    loadCotizaciones();
    cerrarDetail();
    showStatus('Cotización marcada como perdida');
  }catch(e){showError('Error: '+e.message);}
}

// ── Cerrar cotización → crear proyecto ───────────────────
async function convertirACotizacionCerrada(cotId){
  var cot = cotizaciones.find(function(c){return c.id===cotId;}) ||
    (await sb.from('cotizaciones').select('*').eq('id',cotId).single()).data;
  if(!cot) return;

  // Load items
  var {data:items} = await sb.from('cotizacion_items').select('*').eq('cotizacion_id',cotId).order('orden');
  items = items||[];

  // Classify items
  var maquinados = items.filter(function(i){return i.tipo==='maquinado';});
  var servicios  = items.filter(function(i){return i.tipo==='servicio';});
  var productos  = items.filter(function(i){return i.tipo==='producto';});
  var totalPiezas = maquinados.reduce(function(a,i){return a+(parseFloat(i.cantidad)||0);},0);

  // Build description from all items
  var allDescs = items.map(function(i){return i.descripcion;}).filter(Boolean);
  var tipoPieza = allDescs.slice(0,2).join(', ')+(allDescs.length>2?' y más':'');

  // Build unidad from dominant type
  var unidad = maquinados.length ? (maquinados[0].unidad||'pzas') :
               servicios.length  ? (servicios[0].unidad||'hrs') : 'servicios';

  // Build items summary HTML
  var summaryHTML = items.length ?
    '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Items de la cotización</div>'+
    items.map(function(i){
      var badge = i.tipo==='maquinado'?'🔧':i.tipo==='servicio'?'⚙️':'📦';
      return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px solid var(--border-light);">'+
        '<span>'+badge+' '+esc(i.descripcion||'')+(i.material?' <span style="color:var(--text-3);">('+esc(i.material)+')</span>':'')+'</span>'+
        '<span style="color:var(--text-2);">'+fmt(parseFloat(i.subtotal)||0)+'</span>'+
      '</div>';
    }).join('') : '<span style="color:var(--text-3);">Sin items</span>';

  // Show/hide piezas row based on whether there are maquinados
  var piezasRow = document.getElementById('conv-piezas-row');
  if(piezasRow) piezasRow.style.display = maquinados.length ? 'flex' : 'none';

  // Show confirmation modal
  cerrarDetail();
  document.getElementById('conv-cot-id').value = cotId;
  document.getElementById('conv-cliente').textContent = cot.cliente_nombre||'';
  document.getElementById('conv-monto').textContent = fmt(cot.total||0);
  document.getElementById('conv-pedido').value = (cot.numero||'COT-').replace('COT-','PED-');
  document.getElementById('conv-tipo-pieza').value = tipoPieza;
  document.getElementById('conv-piezas').value = Math.round(totalPiezas)||0;
  document.getElementById('conv-unidad').value = unidad;
  document.getElementById('conv-items-summary').innerHTML = summaryHTML;
  document.getElementById('conv-fecha-entrega').value = '';
  var fechaMin = new Date(); fechaMin.setDate(fechaMin.getDate()+7);
  document.getElementById('conv-fecha-entrega').min = fechaMin.toISOString().split('T')[0];
  document.getElementById('conv-modal').style.display = 'flex';
}

async function confirmarConversion(){
  var cotId = document.getElementById('conv-cot-id').value;
  var cot = cotizaciones.find(function(c){return c.id===cotId;});
  if(!cot) return;

  var nombrePedido = document.getElementById('conv-pedido').value.trim();
  var tipoPieza = document.getElementById('conv-tipo-pieza').value.trim();
  var convUnidad = (document.getElementById('conv-unidad')||{}).value||'pzas';
  var totalPiezas = parseInt(document.getElementById('conv-piezas').value)||0;
  var fechaEntrega = document.getElementById('conv-fecha-entrega').value;

  if(!nombrePedido||!fechaEntrega){showError('Completa el nombre del pedido y fecha de entrega.');return;}

  try{
    var btn = document.getElementById('btn-confirmar-conv');
    btn.disabled=true; btn.textContent='Creando proyecto...';

    var año = new Date().getFullYear();
    var proyData = {
      nombre_cliente: cot.cliente_nombre,
      cliente_id: cot.cliente_id||null,
      nombre_pedido: nombrePedido,
      tipo_pieza: tipoPieza||null,
      total_piezas: totalPiezas,
      monto_total: cot.total,
      fecha_pedido: new Date().toISOString().split('T')[0],
      fecha_entrega: fechaEntrega,
      year: año,
      cotizacion_id: cotId,
      activo: true
    };

    var {data:proj,error:pe} = await sb.from('proyectos').insert([proyData]).select().single();
    if(pe)throw pe;

    // Link cotizacion to proyecto
    await sb.from('cotizaciones').update({proyecto_id:proj.id, estatus:'cerrada'}).eq('id',cotId);

    document.getElementById('conv-modal').style.display='none';
    cerrarDetail();
    loadCotizaciones();
    showStatus('✓ Proyecto creado: '+nombrePedido);
    setTimeout(function(){
      switchTab('proyectos', document.getElementById('sb-proyectos'));
      setTimeout(function(){verDetalleProyecto(proj.id);},600);
    },400);
  }catch(e){
    showError('Error: '+e.message);
  }finally{
    var btn=document.getElementById('btn-confirmar-conv');
    if(btn){btn.disabled=false;btn.textContent='Crear proyecto';}
  }
}

// ── Detalle cotización ────────────────────────────────────
async function verDetalleCotizacion(id){
  var c = cotizaciones.find(function(x){return x.id===id;});
  if(!c) return;

  var ini = (c.numero||'COT').slice(0,3).toUpperCase();
  var color = EST_COLORS[c.estatus]||'#475569';
  var label = EST_LABELS[c.estatus]||c.estatus;

  abrirDetail(c.numero||'Cotización', c.cliente_nombre, ini,
    '<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',
    function(){editarCotizacion(id);}
  );

  try{
    var {data:items} = await sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden');
    items = items||[];

    var acciones = '';
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion'){
      acciones =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
          (c.estatus==='borrador'?'<button class="btn-primary" onclick="cambiarEstatusCot(\''+id+'\',\'enviada\')">Marcar enviada</button>':'')+
          (c.estatus==='enviada'?'<button class="btn-sm" onclick="cambiarEstatusCot(\''+id+'\',\'en_negociacion\')" style="color:#a78bfa;border-color:#a78bfa;">💬 En negociación</button>':'')+
          '<button class="btn-primary" style="background:#34d399;color:#0b0e17;" onclick="cambiarEstatusCot(\''+id+'\',\'cerrada\')">✓ Cerrar (ganada)</button>'+
          '<button class="btn-sm" style="color:#f87171;" onclick="marcarPerdida(\''+id+'\')">Marcar perdida</button>'+
          '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        '</div>';
    } else if(c.estatus==='cerrada'){
      acciones = '<div style="display:flex;gap:8px;">'+
        '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        (c.proyecto_id?'<button class="btn-sm" onclick="cerrarDetail();switchTab(\'proyectos\',document.getElementById(\'sb-proyectos\'));setTimeout(function(){verDetalleProyecto(\''+c.proyecto_id+'\');},600);">Ver proyecto →</button>':'')+
      '</div>';
    } else {
      acciones = '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>';
    }

    var itemsHTML = items.map(function(item){
      var isMaq=item.tipo==='maquinado', isSvc=item.tipo==='servicio';
      return '<tr>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-1);">'+
          '<div style="font-weight:500;">'+esc(item.descripcion||'')+'</div>'+
          (item.material?'<div style="font-size:11px;color:var(--text-3);">Material: '+esc(item.material)+'</div>':'')+
          (item.notas?'<div style="font-size:11px;color:var(--text-3);">'+esc(item.notas)+'</div>':'')+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-2);text-align:center;">'+
          '<span style="font-size:10px;background:'+(isMaq?'#1a2035':isSvc?'#0d1f3c':'#12172a')+';color:'+(isMaq?'#60a5fa':isSvc?'#a78bfa':'#94a3b8')+';padding:2px 6px;border-radius:4px;">'+
          (isMaq?'Maquinado':isSvc?'Servicio':'Producto')+'</span>'+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-1);text-align:right;">'+(item.cantidad||0)+' '+(item.unidad||'')+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-2);text-align:right;">'+fmt(item.precio_unitario||0)+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:#34d399;font-weight:600;text-align:right;">'+fmt(item.subtotal||0)+'</td>'+
      '</tr>';
    }).join('');

    var body =
      // Status & actions
      '<div class="detail-section" style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span style="padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;background:'+color+'22;color:'+color+';">'+label+'</span>'+
        acciones+
      '</div>'+
      // KPIs
      '<div class="detail-section"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Subtotal</div><div class="detail-kpi-value" style="font-size:16px;color:var(--text-1);">'+fmt(c.subtotal||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">IVA (16%)</div><div class="detail-kpi-value" style="font-size:16px;color:var(--text-2);">'+fmt(c.iva||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Total</div><div class="detail-kpi-value c-green">'+fmt(c.total||0)+'</div></div>'+
      '</div></div>'+
      // Info
      '<div class="detail-section"><div class="detail-grid">'+
        '<div class="detail-field"><div class="detail-field-label">Fecha</div><div class="detail-field-value">'+fmtDateFull(c.fecha)+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Vigencia</div><div class="detail-field-value">'+(c.vigencia_dias||15)+' días</div></div>'+
        (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(c.notas)+'</div></div>':'')+
      '</div></div>'+
      // Items table
      '<div class="detail-section">'+
        '<div class="detail-section-title">Items ('+items.length+')</div>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
          '<thead><tr>'+
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Descripción</th>'+
            '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Tipo</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Cant.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">P.U.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Subtotal</th>'+
          '</tr></thead>'+
          '<tbody>'+itemsHTML+'</tbody>'+
        '</table></div>'+
      '</div>';

    // Contacto vinculado a esta cotización específicamente
    var contactoHTML = '';
    if(c.contacto_id){
      var {data:cotCont}=await sb.from('contactos').select('*').eq('id',c.contacto_id).maybeSingle();
      if(cotCont){
        var ctNombre=(cotCont.nombre||'')+(cotCont.apellido?' '+cotCont.apellido:'');
        contactoHTML=
          '<div class="detail-section">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
            '<div class="detail-section-title" style="margin-bottom:0;">Contacto vinculado</div>'+
            '<button class="btn-sm" style="font-size:11px;color:var(--text-3);" '+
              'onclick="quitarContactoCot(\''+id+'\')" title="Quitar contacto de esta cotización">× Quitar</button>'+
          '</div>'+
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+cotCont.id+'\')">'+ 
            '<div>'+
              '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(ctNombre)+'</div>'+
              '<div style="font-size:11px;color:var(--text-3);">'+(cotCont.cargo||'')+(cotCont.email?' · '+cotCont.email:'')+'</div>'+
              (cotCont.telefono?'<div style="font-size:11px;color:var(--text-3);">'+esc(cotCont.telefono)+'</div>':'')+
            '</div>'+
            '<span style="font-size:11px;color:var(--text-3);">→</span>'+
          '</div>'+
          '</div>';
      }
    } else if(c.cliente_id){
      // No contact linked yet — offer to set one from this company's contacts
      contactoHTML=
        '<div class="detail-section">'+
        '<div class="detail-section-title">Contacto vinculado</div>'+
        '<div style="color:var(--text-4);font-size:12px;padding:4px 0 10px;">Sin contacto vinculado a esta cotización</div>'+
        '<button class="btn-sm" style="font-size:11px;" '+
          'onclick="vincularContactoCot(\''+id+'\',\''+c.cliente_id+'\')">+ Vincular contacto</button>'+
        '</div>';
    }
    body += contactoHTML;
    document.getElementById('detail-body').innerHTML = body;
  }catch(e){
    console.error('Detalle cotizacion:',e);
    document.getElementById('detail-body').innerHTML = '<div style="padding:16px;color:#f87171;">Error: '+esc(String(e.message||e))+'</div>';
  }
}


// ── Vincular contacto a cotización desde detalle ─────────
function vincularContactoCot(cotId, clienteId){
  var uid = 'cot_' + cotId;
  var secId = 'vinc-cont-sec-' + uid;
  var existing = document.getElementById(secId);
  if(existing){ existing.remove(); return; }

  var sec = document.createElement('div');
  sec.id = secId;
  sec.style.cssText = 'padding:10px 0 4px;position:relative;';

  var inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Buscar contacto de esta empresa...';
  inp.autocomplete = 'off';
  inp.style.cssText = 'width:100%;padding:7px 10px;font-size:12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-1);box-sizing:border-box;';

  var dd = document.createElement('div');
  dd.style.cssText = 'background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;z-index:600;max-height:200px;overflow-y:auto;margin-top:4px;box-shadow:0 4px 16px var(--shadow);display:none;';

  function renderDD(matches){
    dd.innerHTML = '';
    if(!matches.length){ dd.style.display='none'; return; }
    dd.style.display = 'block';
    matches.forEach(function(c){
      var nombre = (c.nombre||'') + (c.apellido ? ' '+c.apellido : '');
      var yaAsignado = (c.cliente_id && c.cliente_id !== clienteId) || c.proveedor_id;
      var item = document.createElement('div');
      item.style.cssText = 'padding:9px 12px;border-bottom:0.5px solid var(--border-light);font-size:12px;' +
        (yaAsignado ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;');
      item.innerHTML =
        '<div style="font-weight:500;color:var(--text-1);">' + esc(nombre) + '</div>' +
        '<div style="font-size:10px;color:var(--text-3);">' + esc(c.cargo||'') +
          (c.email ? ' · '+esc(c.email) : '') +
          (yaAsignado ? ' · <span style="color:#f87171;">Ya tiene empresa</span>' : '') +
        '</div>';
      if(!yaAsignado){
        item.addEventListener('mousedown', function(){
          seleccionarContactoCot(cotId, c.id, nombre);
        });
      }
      dd.appendChild(item);
    });
  }

  function getPool(q){
    var ql = (q||'').toLowerCase().trim();
    var pool = clienteId
      ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
      : (contactos||[]);
    if(!pool.length) pool = contactos||[];
    return ql
      ? pool.filter(function(c){
          var n = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
          return n.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
        }).slice(0,8)
      : pool.slice(0,8);
  }

  inp.addEventListener('focus', function(){ renderDD(getPool('')); });
  inp.addEventListener('input', function(){ renderDD(getPool(this.value)); });
  inp.addEventListener('blur', function(){ setTimeout(function(){ dd.style.display='none'; }, 150); });

  sec.appendChild(inp);
  sec.appendChild(dd);

  var detailBody = document.getElementById('detail-body');
  if(detailBody){
    var sections = detailBody.querySelectorAll('.detail-section');
    var last = sections[sections.length-1];
    if(last) last.appendChild(sec);
    else detailBody.appendChild(sec);
    setTimeout(function(){ inp.focus(); }, 50);
  }
}

async function seleccionarContactoCot(cotId, contactoId, nombre){
  try{
    await sb.from('cotizaciones').update({ contacto_id: contactoId }).eq('id', cotId);
    showStatus('✓ Contacto vinculado: ' + nombre);
    verDetalleCotizacion(cotId);
  }catch(e){ showError('Error: ' + e.message); }
}

// ── Empresa config (editar aquí) ─────────────────────────
var EMPRESA_CONFIG = {
  nombre:    'Grupo M2',
  slogan:    'Maquinados Industriales',
  direcciones: [
    'Cam, Carr. Pie de Gallo Km 0.10 L3, 76220 Santa Rosa Jáuregui, Querétaro',
    'Priv. Chairel 100 A, 89359, Tampico, Tamaulipas'
  ],
  web:       'www.grupom2.com.mx',
  tel:       '+52 56 5035 8701',
  email:     'contacto@grupom2.com.mx',
  banco:     'BBVA · CLABE: 012680001205003565 · Cuenta: 0120500356',
  legal:     'Precios en MXN + IVA. Vigencia según cotización. Pedido sujeto a confirmación por escrito. ' +
             'No incluye maniobras de carga/descarga salvo acuerdo. Pagos anticipados no son reembolsables.',
  logo:      null,
  firma_nombre: 'Ing. [Nombre]',
  firma_cargo:  'Director General'
};

// ── PDF ───────────────────────────────────────────────────
async function generarPDFCotizacion(id){
  var c = cotizaciones.find(function(x){return x.id===id;});
  if(!c){showError('Cotización no encontrada');return;}

  var {data:items} = await sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden');
  items = items||[];

  // Get contacto vinculado a esta cotización
  var contactoNombre = '';
  if(c.contacto_id){
    try{
      var {data:ctPdf} = await sb.from('contactos').select('nombre,apellido,cargo').eq('id',c.contacto_id).maybeSingle();
      if(ctPdf){
        contactoNombre = (ctPdf.nombre||'')+(ctPdf.apellido?' '+ctPdf.apellido:'')+(ctPdf.cargo?' · '+ctPdf.cargo:'');
      }
    }catch(e){}
  }

  try{
    var doc = new jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'letter'});
    var pw = doc.internal.pageSize.getWidth();  // 279
    var ph = doc.internal.pageSize.getHeight(); // 216

    // ── Paleta Grupo M2 (manual de identidad) ────────────
    var C = {
      white:   [255,255,255],
      bgPage:  [252,252,252],     // blanco casi puro
      accent:  [232,25,44],       // rojo M2 #E8192C
      accentL: [254,226,226],     // rojo pastel muy suave
      accentD: [139,0,0],         // rojo oscuro/vino #8B0000
      gray1:   [245,245,245],     // gris muy claro
      gray2:   [176,176,176],     // gris medio #B0B0B0
      gray3:   [107,107,107],     // gris oscuro #6B6B6B
      text:    [51,51,51],        // carbon #333333
      carbon:  [28,28,28],        // casi negro para header
      silver:  [200,200,200],     // plateado metálico
    };

    // Fondo blanco / muy suave
    doc.setFillColor(...C.bgPage);
    doc.rect(0,0,pw,ph,'F');

    // ── Header: franja de acento izquierda + datos empresa ─
    doc.setFillColor(...C.accent);
    doc.rect(0,0,8,ph,'F'); // barra lateral azul

    // Bloque header
    doc.setFillColor(...C.accentL);
    doc.roundedRect(12, 8, pw-22, 30, 3, 3, 'F');

    // Logo
    try{
      var imgEl = document.querySelector('.sidebar-logo img');
      if(imgEl && imgEl.src) doc.addImage(imgEl.src,'PNG',16,10,20,20);
    }catch(e){}

    // Nombre y slogan
    doc.setTextColor(...C.accentD);
    doc.setFontSize(17); doc.setFont('helvetica','bold');
    doc.text(EMPRESA_CONFIG.nombre, 40, 20);
    doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    doc.setTextColor(...C.gray3);
    doc.text(EMPRESA_CONFIG.slogan, 40, 27);
    doc.text(EMPRESA_CONFIG.web+' · '+EMPRESA_CONFIG.tel, 40, 33);

    // Número cotización (derecha del header)
    doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.setTextColor(...C.accent);
    doc.text(c.numero||'COTIZACIÓN', pw-14, 20, {align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(...C.gray3);
    doc.text('Fecha: '+fmtDateFull(c.fecha), pw-14, 27, {align:'right'});
    doc.text('Vigencia: '+(c.vigencia_dias||15)+' días', pw-14, 33, {align:'right'});

    var y = 46;

    // ── Cliente ───────────────────────────────────────────
    doc.setFillColor(...C.gray1);
    doc.roundedRect(12, y, 120, contactoNombre?20:14, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(...C.accent);
    doc.text('DIRIGIDO A', 16, y+5);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(...C.text);
    doc.text(c.cliente_nombre||'', 16, y+11);
    if(contactoNombre){
      doc.setFontSize(8.5); doc.setFont('helvetica','normal');
      doc.setTextColor(...C.gray3);
      doc.text('Atn. '+contactoNombre, 16, y+17);
    }

    // ── Título / objeto general ──────────────────────────
    if(c.titulo){
      var tituloY = contactoNombre ? y+22 : y+16;
      doc.setFontSize(9); doc.setFont('helvetica','bolditalic');
      doc.setTextColor(...C.accentD);
      doc.text(c.titulo, 16, tituloY);
      y += 8;
    }

    // ── Notas (si existen, al lado del cliente) ───────────
    if(c.notas){
      doc.setFillColor(...C.gray1);
      doc.roundedRect(136, y, pw-148, contactoNombre?20:14, 2, 2, 'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.accent);
      doc.text('NOTAS', 140, y+5);
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
      var notasInline = doc.splitTextToSize(c.notas, pw-160);
      doc.text(notasInline.slice(0,2), 140, y+11);
    }

    // ── Items table ───────────────────────────────────────
    y = contactoNombre ? 72 : 66;

    var tableData = items.map(function(item){
      return [
        {content:(item.descripcion||'')+(item.material?' · '+item.material:'')+(item.notas?' · '+item.notas:''), styles:{fontSize:8.5, textColor:C.text}},
        item.tipo==='maquinado'?'Maquinado':item.tipo==='servicio'?'Servicio':'Producto',
        (item.cantidad||0)+' '+(item.unidad||'pza'),
        fmt(item.precio_unitario||0),
        {content:fmt(item.subtotal||0), styles:{fontStyle:'bold', textColor:C.accentD}}
      ];
    });

    doc.autoTable({
      head:[['Descripción','Tipo','Cant.','P. Unitario','Subtotal']],
      body: tableData,
      startY: y,
      margin:{left:12, right:12},
      styles:{fontSize:8.5, cellPadding:3.5, lineColor:C.gray1, lineWidth:0.3, textColor:C.text},
      headStyles:{fillColor:C.accent, textColor:C.white, fontStyle:'bold', fontSize:8},
      alternateRowStyles:{fillColor:C.gray1},
      bodyStyles:{fillColor:C.white},
      columnStyles:{
        0:{cellWidth:'auto'},
        1:{cellWidth:26, halign:'center'},
        2:{cellWidth:24, halign:'center'},
        3:{cellWidth:30, halign:'right'},
        4:{cellWidth:33, halign:'right'}
      }
    });

    var finalY = doc.lastAutoTable.finalY + 6;

    // ── Totals ────────────────────────────────────────────
    var tx = pw - 14;
    doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    doc.setTextColor(...C.gray3);
    doc.text('Subtotal:', tx-38, finalY);
    doc.setTextColor(...C.text); doc.text(fmt(c.subtotal||0), tx, finalY, {align:'right'});
    finalY += 5.5;
    doc.setTextColor(...C.gray3); doc.text('IVA (16%):', tx-38, finalY);
    doc.setTextColor(...C.text); doc.text(fmt(c.iva||0), tx, finalY, {align:'right'});
    finalY += 6;
    doc.setFillColor(...C.accentL);
    // Calcular ancho exacto del contenido TOTAL: + monto
    var totalLabel = 'TOTAL:';
    var totalMonto = fmt(c.total||0);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    var labelW = doc.getTextWidth(totalLabel);
    var montoW = doc.getTextWidth(totalMonto);
    var rectW = labelW + montoW + 14; // padding 7px cada lado
    var rectX = tx - montoW - labelW - 14;
    doc.roundedRect(rectX, finalY-5, rectW, 11, 2, 2, 'F');
    doc.setTextColor(...C.accentD);
    doc.text(totalLabel, rectX+7, finalY+3);
    doc.text(totalMonto, tx, finalY+3, {align:'right'});

    // ── Condiciones de pago (si existen) ─────────────────
    if(c.condiciones_pago){
      finalY += 12;
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.accent);
      doc.text('CONDICIONES DE PAGO:', 12, finalY);
      doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3); doc.setFontSize(8);
      doc.text(c.condiciones_pago, 12, finalY+5);
      finalY += 5;
    }

    // ── Firma ─────────────────────────────────────────────
    var firmaX = pw - 80;
    var firmaY = Math.min(finalY + 14, ph - 50);
    doc.setDrawColor(...C.gray2);
    doc.setLineWidth(0.4);
    doc.line(firmaX, firmaY, firmaX+60, firmaY);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...C.text);
    doc.text(EMPRESA_CONFIG.firma_nombre, firmaX+30, firmaY+5, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3); doc.setFontSize(7.5);
    doc.text(EMPRESA_CONFIG.firma_cargo, firmaX+30, firmaY+10, {align:'center'});

    // ── Footer ────────────────────────────────────────────
    var footerH = 22;
    var footerY = ph - footerH;
    doc.setFillColor(...C.accentL);
    doc.rect(0, footerY, pw, footerH, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, footerY, 8, footerH, 'F');

    // Addresses (left col)
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
    EMPRESA_CONFIG.direcciones.forEach(function(dir, i){
      doc.text(dir, 12, footerY+6+(i*5));
    });

    // Contact info (center)
    doc.setTextColor(...C.accentD);
    doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    doc.text(EMPRESA_CONFIG.web, pw/2, footerY+6, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
    doc.text(EMPRESA_CONFIG.tel+'   |   '+EMPRESA_CONFIG.email, pw/2, footerY+11, {align:'center'});
    doc.text(EMPRESA_CONFIG.banco, pw/2, footerY+16, {align:'center'});

    // Legal (right col)
    doc.setFontSize(6); doc.setTextColor(...C.gray2);
    var legalLines = doc.splitTextToSize(EMPRESA_CONFIG.legal, 70);
    doc.text(legalLines, pw-14, footerY+5, {align:'right'});

    doc.save((c.numero||'cotizacion')+'.pdf');
    showStatus('✓ PDF generado');
  }catch(e){
    console.error('PDF error:',e);
    showError('Error generando PDF: '+e.message);
  }
}

// ── View toggle ───────────────────────────────────────────
function toggleCotView(view){
  cotView = view;
  document.getElementById('btn-view-lista').classList.toggle('active', view==='lista');
  document.getElementById('btn-view-kanban').classList.toggle('active', view==='kanban');
  document.getElementById('cot-lista-wrap').style.display = view==='lista'?'block':'none';
  document.getElementById('cot-kanban-wrap').style.display = view==='kanban'?'block':'none';
  if(view==='kanban') renderKanban();
}

// ── Kanban ────────────────────────────────────────────────
var KANBAN_COLS = [
  {key:'borrador',     label:'Borrador',         icon:'📝'},
  {key:'enviada',      label:'Enviada',           icon:'📤'},
  {key:'en_negociacion',label:'En negociación',   icon:'💬'},
  {key:'cerrada',      label:'Cerrada ✓',         icon:'✅', limit90:true},
  {key:'perdida',      label:'Perdida',           icon:'❌', limit90:true}
];

// ── U6: Kanban touch/mobile support ──────────────────────
// Mueve una card entre columnas — funciona en touch Y desktop
async function kanbanMoveCard(e, cotId, fromEstatus, toEstatus){
  e.stopPropagation();
  if(fromEstatus===toEstatus) return;
  if(toEstatus==='cerrada'){
    await cambiarEstatusCot(cotId,'cerrada');
    return;
  }
  try{
    await sb.from('cotizaciones').update({estatus:toEstatus}).eq('id',cotId);
    showStatus('✓ Movida a '+EST_LABELS[toEstatus]);
    await loadCotizaciones();
    if(cotView==='kanban') renderKanban();
  }catch(err){showError('Error: '+err.message);}
}

function renderKanban(){
  var el = document.getElementById('cot-kanban-wrap');
  var hoy = new Date();
  var hace90 = new Date(hoy); hace90.setDate(hace90.getDate()-90);

  var board = document.createElement('div');
  board.className = 'kanban-board';

  KANBAN_COLS.forEach(function(col){
    var cards = allCotizaciones.filter(function(c){
      if(c.estatus !== col.key) return false;
      if(col.limit90){
        var d = new Date(c.created_at||c.fecha);
        if(d < hace90) return false;
      }
      return true;
    });
    var total = cards.reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
    var color = EST_COLORS[col.key]||'#475569';

    // Column container
    var colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.addEventListener('dragover', function(e){ e.preventDefault(); });
    colEl.addEventListener('drop', function(e){ kanbanDrop(e, col.key); });

    // Column header
    var colHdr = document.createElement('div');
    colHdr.className = 'kanban-col-hdr';
    colHdr.style.borderTop = '3px solid '+color;

    var colTitle = document.createElement('span');
    colTitle.textContent = col.icon+' '+col.label;

    var colMeta = document.createElement('div');
    colMeta.style.cssText = 'display:flex;gap:8px;align-items:center;';
    var colTotal = document.createElement('span');
    colTotal.style.cssText = 'font-size:10px;color:var(--text-3);';
    colTotal.textContent = fmt(total);
    var colCount = document.createElement('span');
    colCount.style.cssText = 'font-size:10px;background:'+color+'22;color:'+color+';padding:2px 7px;border-radius:10px;';
    colCount.textContent = cards.length;
    colMeta.appendChild(colTotal);
    colMeta.appendChild(colCount);
    colHdr.appendChild(colTitle);
    colHdr.appendChild(colMeta);

    // Cards container
    var cardsEl = document.createElement('div');
    cardsEl.className = 'kanban-cards';
    cardsEl.id = 'kcol-'+col.key;

    if(cards.length){
      var frag = document.createDocumentFragment();
      cards.forEach(function(c){ frag.appendChild(renderKanbanCard(c, col, hoy)); });
      cardsEl.appendChild(frag);
    } else {
      var empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-4);font-size:11px;text-align:center;padding:16px 0;';
      empty.textContent = 'Sin cotizaciones';
      cardsEl.appendChild(empty);
    }

    colEl.appendChild(colHdr);
    colEl.appendChild(cardsEl);
    board.appendChild(colEl);
  });

  el.innerHTML = '';
  el.appendChild(board);
}

// ── Drag & drop ───────────────────────────────────────────
var _dragId = null;
function kanbanDragStart(e, id){ _dragId = id; e.dataTransfer.effectAllowed='move'; }

async function kanbanDrop(e, newEstatus){
  e.preventDefault();
  if(!_dragId) return;
  var cot = allCotizaciones.find(function(c){return c.id===_dragId;});
  if(!cot || cot.estatus===newEstatus){ _dragId=null; return; }

  // Special handling for cerrada — triggers project creation
  if(newEstatus==='cerrada'){
    _dragId=null;
    await cambiarEstatusCot(cot.id,'cerrada');
    return;
  }
  try{
    await sb.from('cotizaciones').update({estatus:newEstatus}).eq('id',cot.id);
    showStatus('✓ Movida a '+EST_LABELS[newEstatus]);
    // Reload from DB to ensure sync
    await loadCotizaciones();
    if(cotView==='kanban') renderKanban();
  }catch(err){ showError('Error: '+err.message); }
  _dragId=null;
}

// ESC closes cotizacion modal
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    var m=document.getElementById('cot-modal');
    if(m&&m.style.display==='block'){cerrarCotModal();return;}
    var m2=document.getElementById('conv-modal');
    if(m2&&m2.style.display==='block'){m2.style.display='none';return;}
  }
});
