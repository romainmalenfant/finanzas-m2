
// ÔöÇÔöÇ Cliente select ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
  if(!(typeof allProyectos !== 'undefined' && allProyectos && allProyectos.length)) loadProyectos();
  makeAutocomplete('cot-proj-search','cot-proj-id','cot-proj-dd',
    function(){return (allProyectos||[]).map(function(p){return {id:p.id,label:p.nombre||p.titulo||'',sub:p.cliente_nombre||''};});},
    null
  );
}

// ÔöÇÔöÇ Form ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
  hdrLabel.textContent = '­ƒôª Historial archivado (>90 d├¡as) ÔÇö '+list.length+' cotizaci'+(list.length===1?'├│n':'ones');
  var arrow = document.createElement('span');
  arrow.id = 'hst-arrow';
  arrow.style.cssText = 'font-size:10px;color:var(--text-3);';
  arrow.textContent = cotHistorialOpen ? 'Ôû▓' : 'Ôû╝';
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
    if(ar) ar.textContent = cotHistorialOpen ? 'Ôû▓' : 'Ôû╝';
  });

  section.appendChild(hdr);
  section.appendChild(body);
  wrap.appendChild(section);
}

function renderCondicionesCot(selectedIds) {
  var list = document.getElementById('cot-condiciones-list');
  if (!list) return;
  var sel = selectedIds || COT_CONDICIONES_DEFAULT;
  list.innerHTML = COT_CONDICIONES.map(function (c) {
    var checked = sel.indexOf(c.id) !== -1;
    return '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:5px 8px;border-radius:6px;background:var(--bg-card-2);border:0.5px solid var(--border);">' +
      '<input type="checkbox" data-cond-id="' + c.id + '" ' + (checked ? 'checked' : '') + ' style="margin-top:2px;accent-color:#E8192C;flex-shrink:0;">' +
      '<span style="font-size:11px;color:var(--text-2);line-height:1.4;">' + c.texto + '</span>' +
      '</label>';
  }).join('');
}

function getCondicionesSeleccionadas() {
  var checks = document.querySelectorAll('#cot-condiciones-list input[type=checkbox]');
  var selected = [];
  checks.forEach(function (ch) {
    if (ch.checked) selected.push(parseInt(ch.getAttribute('data-cond-id')));
  });
  return selected;
}

function abrirNuevaCotizacion(){
  try{ _abrirNuevaCotizacion(); }catch(e){ console.error('abrirNuevaCotizacion:',e); showError('Error: '+e.message); }
}
function _abrirNuevaCotizacion(){
  cotEditId = null;
  cotItemsTemp = [];
  document.getElementById('cot-id-edit').value = '';
  document.getElementById('cot-modal-title').textContent = 'Nueva cotizaci├│n';
  poblarClientesCot(null);
  var _ct=document.getElementById('cot-titulo'); if(_ct) _ct.value='';
  document.getElementById('cot-cliente-id').value = '';
  document.getElementById('cot-cliente-search').value = '';
  document.getElementById('cot-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cot-vigencia').value = '15';
  document.getElementById('cot-notas').value = '';
  var _cr=document.getElementById('cot-requisicion'); if(_cr) _cr.value='';
  // Limpiar contacto completamente al abrir nueva cotizaci├│n
  var _ci = document.getElementById('cot-contacto-id');
  var _cs = document.getElementById('cot-contacto-search');
  var _cd = document.getElementById('cot-contacto-dd');
  if(_ci) _ci.value = '';
  if(_cs) _cs.value = '';
  if(_cd) { _cd.innerHTML = ''; _cd.style.display = 'none'; }
  renderCotItemsForm();
  recalcCotTotal();
  renderCondicionesCot(COT_CONDICIONES_DEFAULT);
  var btnNV = document.getElementById('btn-nueva-version-cot');
  if (btnNV) btnNV.style.display = 'none';
  cotVersionFlag = false;
  // BUG-04: z-index expl├¡cito para superar el detail panel (z-index:500)
  var _cotM = document.getElementById('cot-modal');
  _cotM.style.zIndex = '700';
  _cotM.style.display = 'flex';
  if(!clientes.length) loadClientes();
}

async function editarCotizacion(id){
  var c;
  try{
    c = cotizaciones.find(function(x){return x.id===id;});
    if(!c) c = await DB.cotizaciones.get(id);
  }catch(e){ showError('Error cargando cotizaci├│n: '+e.message); return; }
  if(!c){ showError('Cotizaci├│n no encontrada'); return; }
  cotEditId = id;
  document.getElementById('cot-id-edit').value = id;
  document.getElementById('cot-modal-title').textContent = 'Editar cotizaci├│n';
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
  var _cr2=document.getElementById('cot-requisicion'); if(_cr2) _cr2.value=c.numero_requisicion||'';
  // Pre-fill usuario_cliente
  var usuId = c.usuario_cliente_id||'';
  if(usuId && document.getElementById('cot-usuario-id')){
    document.getElementById('cot-usuario-id').value = usuId;
    var usu = (contactos||[]).find(function(x){return x.id===usuId;});
    if(usu && document.getElementById('cot-usuario-search'))
      document.getElementById('cot-usuario-search').value = (usu.nombre||'')+(usu.apellido?' '+usu.apellido:'');
    setTimeout(function(){ actualizarBtnClear('cot-usuario-id','cot-usuario-clear'); }, 50);
  } else {
    if(document.getElementById('cot-usuario-id')) document.getElementById('cot-usuario-id').value='';
    if(document.getElementById('cot-usuario-search')) document.getElementById('cot-usuario-search').value='';
  }
  // Load items
  DB.cotizacionItems.byCotizacion(id).then(function(items){
    cotItemsTemp = items||[];
    renderCotItemsForm();
    recalcCotTotal();
  });
  var vNum = c.version || 1;
  var btnNV = document.getElementById('btn-nueva-version-cot');
  if (btnNV) {
    btnNV.style.display = 'block';
    btnNV.textContent = '+ Nueva v' + (vNum + 1);
  }
  cotVersionFlag = false;
  var condSel = (c.condiciones && Array.isArray(c.condiciones)) ? c.condiciones : COT_CONDICIONES_DEFAULT;
  renderCondicionesCot(condSel);
  // BUG-04: z-index expl├¡cito para superar el detail panel (z-index:500)
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

  cotVersionFlag = false;
  var btnNVClose = document.getElementById('btn-nueva-version-cot');
  if (btnNVClose) btnNVClose.style.display = 'none';
  document.getElementById('cot-modal').style.display = 'none';
}

// ÔöÇÔöÇ Items ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

// ÔöÇÔöÇ Cliente autocomplete in cot form ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
  document.getElementById('cot-cliente-selected').textContent = 'Ô£ô '+nombre;
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

// ÔöÇÔöÇ Guardar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// ÔöÇÔöÇ Contactos vinculados al cliente en cotizaci├│n ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

/**
 * Pre-populates the contact dropdown with contacts
 * belonging to the currently selected client.
 * Called when client changes.
 */
function precargarContactosCot(){
  // Called on client change ÔÇö reset contact field and reload dropdown
  var inp = document.getElementById('cot-contacto-search');
  var hid = document.getElementById('cot-contacto-id');
  if(inp) inp.value = '';
  if(hid) hid.value = '';
  actualizarBtnClear && actualizarBtnClear('cot-contacto-id','cot-contacto-clear');
  mostrarContactosCot();
}

function mostrarContactosCot(){
  // Called on focus ÔÇö show contacts for selected client without resetting the field
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
    subEl.textContent = (c.cargo||'') + (c.email ? ' ┬À '+c.email : '');
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

function mostrarUsuariosCot(){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-usuario-dd');
  if(!dd) return;
  var pool = clienteId ? (contactos||[]).filter(function(c){ return c.cliente_id===clienteId; }) : [];
  if(!pool.length){ dd.style.display='none'; return; }
  _renderUsuarioCotDD(pool.slice(0,10), dd);
  dd.style.display = 'block';
}

function buscarUsuarioCot(q){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-usuario-dd');
  if(!dd) return;
  var ql = (q||'').toLowerCase().trim();
  if(!ql){ mostrarUsuariosCot(); return; }
  var pool = clienteId ? (contactos||[]).filter(function(c){ return c.cliente_id===clienteId; }) : (contactos||[]);
  var matches = pool.filter(function(c){
    var nombre = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
    return nombre.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
  }).slice(0,10);
  if(!matches.length){ dd.style.display='none'; return; }
  _renderUsuarioCotDD(matches, dd);
  dd.style.display = 'block';
}

function _renderUsuarioCotDD(list, dd){
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  list.forEach(function(c){
    var nombre = (c.nombre||'')+(c.apellido?' '+c.apellido:'');
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:13px;';
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:500;color:var(--text-1);';
    nameEl.textContent = nombre;
    var subEl = document.createElement('div');
    subEl.style.cssText = 'font-size:10px;color:var(--text-3);';
    subEl.textContent = (c.cargo||'')+(c.email?' ┬À '+c.email:'');
    item.appendChild(nameEl);
    item.appendChild(subEl);
    item.addEventListener('mousedown', function(){
      document.getElementById('cot-usuario-search').value = nombre;
      document.getElementById('cot-usuario-id').value = c.id;
      dd.style.display = 'none';
      actualizarBtnClear('cot-usuario-id','cot-usuario-clear');
    });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

async function guardarCotizacion(){
  var clienteId  = document.getElementById('cot-cliente-id').value||null;
  var contactoId = (document.getElementById('cot-contacto-id')||{}).value||null;
  var usuarioClienteId = (document.getElementById('cot-usuario-id')||{}).value||null;
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
  var a├▒o = new Date(fecha+'T12:00').getFullYear();

  try{
    var btn = document.getElementById('btn-save-cot');
    btn.disabled=true; btn.textContent='Guardando...';

    var cotData = {
      condiciones: getCondicionesSeleccionadas(),
      titulo:      tituloVal||null,
      cliente_id:  clienteId,
      contacto_id: contactoId,
      usuario_cliente_id: usuarioClienteId,
      proyecto_id: proyectoId,
      cliente_nombre: clienteNombre,
      fecha: fecha,
      vigencia_dias: parseInt(document.getElementById('cot-vigencia').value)||15,
      numero_requisicion: (document.getElementById('cot-requisicion')||{}).value.trim()||null,
      notas: document.getElementById('cot-notas').value.trim()||null,
      subtotal: subtotal,
      iva: iva,
      total: total,
      estatus: cotEditId ? undefined : 'borrador'
    };

    var savedCot;
    if(cotEditId && cotVersionFlag) {
      // Create new version
      var cBase = cotizaciones.find(function(x){return x.id===cotEditId;}) || (await DB.cotizaciones.get(cotEditId));
      var baseId = cBase.cotizacion_base_id || cBase.id;
      cotData.cotizacion_base_id = baseId;
      cotData.version = (cBase.version || 1) + 1;
      cotData.numero = cBase.numero;
      cotData.estatus = 'borrador';
      savedCot = await DB.cotizaciones.save(cotData);
      cotVersionFlag = false;
    } else if(cotEditId) {
      cotData.id = cotEditId;
      savedCot = await DB.cotizaciones.save(cotData);
    } else {
      var count = await DB.cotizaciones.countPeriodo('COT-'+a├▒o+'-');
      cotData.numero = 'COT-'+a├▒o+'-'+String(count+1).padStart(3,'0');
      savedCot = await DB.cotizaciones.save(cotData);
    }

    // Upsert items
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
    await DB.cotizacionItems.replace(cotEditId||savedCot.id, items);

    cerrarCotModal();
    await loadCotizaciones();
    showStatus('Ô£ô Cotizaci├│n guardada');
    verDetalleCotizacion(savedCot.id);
  }catch(e){
    console.error('guardarCotizacion:',e);
    showError('Error: '+e.message);
  }finally{
    cotVersionFlag = false;
    var btn=document.getElementById('btn-save-cot');
    if(btn){btn.disabled=false;btn.textContent='Guardar';}
  }
}

// ÔöÇÔöÇ Cambiar estatus ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function cambiarEstatusCot(id, estatus){
  try{
    if(estatus === 'cerrada'){
      // Check for multiple versions
      var cot = (allCotizaciones||[]).find(function(c){return c.id===id;});
      if(!cot) cot = await DB.cotizaciones.get(id);
      var baseId = cot.cotizacion_base_id || cot.id;
      var versiones = await DB.cotizaciones.versionesByBase(baseId);
      if(versiones && versiones.length > 1){
        mostrarPickerVersiones(versiones, id);
        return;
      }
      await _cerrarCotizacion(id);
    } else {
      var extra = {};
      if(estatus==='perdida') extra.fecha_cierre = new Date().toISOString().split('T')[0];
      await DB.cotizaciones.updateEstatus(id, estatus, extra);
      await loadCotizaciones();
      if(cotView==='kanban') renderKanban();
      cerrarDetail();
      showStatus('Ô£ô Cotizaci├│n actualizada');
    }
  }catch(e){showError('Error: '+e.message);}
}

async function _cerrarCotizacion(id){
  try{
    var extra = { fecha_cierre: new Date().toISOString().split('T')[0] };
    await DB.cotizaciones.updateEstatus(id, 'cerrada', extra);
    await convertirACotizacionCerrada(id);
  }catch(e){showError('Error: '+e.message);}
}

var _versionPickerSelectedId = null;

function mostrarPickerVersiones(versiones, currentId){
  var sorted = versiones.slice().sort(function(a,b){ return (b.version||1)-(a.version||1); });
  var last4 = sorted.slice(0,4);
  var fmt2 = function(n){ return n!=null ? '$'+parseFloat(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) : 'ÔÇö'; };
  var fmtEst = function(e){ return {borrador:'Borrador',enviada:'Enviada',en_negociacion:'En negociaci├│n',cerrada:'Cerrada',perdida:'Perdida'}[e]||e; };

  var existing = document.getElementById('version-picker-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'version-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:950;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML =
    '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:14px;width:100%;max-width:440px;padding:24px;box-shadow:0 8px 40px var(--shadow);">'+
      '<div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">┬┐Qu├® versi├│n se aprob├│?</div>'+
      '<div style="font-size:12px;color:var(--text-3);margin-bottom:18px;">'+(last4[0]&&last4[0].numero||'')+' ┬À Elige la versi├│n ganadora</div>'+
      '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">'+
        last4.map(function(v,i){
          var isLatest = i===0;
          return '<div onclick="versionPickerSelect(\''+v.id+'\')" id="vpick-'+v.id+'" style="padding:12px 14px;border-radius:8px;border:1.5px solid '+(isLatest?'#E8192C':'var(--border)')+';cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:'+(isLatest?'rgba(232,25,44,.07)':'var(--bg-card-2)')+';transition:all .15s;">'+
            '<div>'+
              '<span style="font-size:13px;font-weight:700;color:'+(isLatest?'#E8192C':'var(--text-1)')+';">v'+(v.version||1)+'</span>'+
              (isLatest ? '<span style="font-size:10px;color:#E8192C;margin-left:6px;">m├ís reciente</span>' : '')+
              '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+(v.fecha||'')+(v.estatus?' ┬À '+fmtEst(v.estatus):'')+'</div>'+
            '</div>'+
            '<span style="font-size:13px;font-weight:700;color:var(--text-1);">'+fmt2(v.total)+'</span>'+
          '</div>';
        }).join('')+
      '</div>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end;">'+
        '<button onclick="document.getElementById(\'version-picker-overlay\').remove()" style="padding:8px 18px;border:.5px solid var(--border);border-radius:8px;background:none;color:var(--text-2);cursor:pointer;font-size:13px;">Cancelar</button>'+
        '<button id="btn-vpick-ok" onclick="versionPickerConfirm()" style="padding:8px 22px;border-radius:8px;background:#E8192C;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Aprobar versi├│n</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);
  // default: latest
  _versionPickerSelectedId = last4[0] && last4[0].id;
  versionPickerSelect(_versionPickerSelectedId);
}

function versionPickerSelect(id){
  _versionPickerSelectedId = id;
  document.querySelectorAll('[id^="vpick-"]').forEach(function(el){
    var vid = el.id.replace('vpick-','');
    var sel = vid === id;
    el.style.borderColor = sel ? '#E8192C' : 'var(--border)';
    el.style.background   = sel ? 'rgba(232,25,44,.07)' : 'var(--bg-card-2)';
  });
}

async function versionPickerConfirm(){
  if(!_versionPickerSelectedId) return;
  var overlay = document.getElementById('version-picker-overlay');
  if(overlay) overlay.remove();
  await _cerrarCotizacion(_versionPickerSelectedId);
}

var _perdidaId = null;
var PERDIDA_MOTIVOS = [
  'Precio muy alto',
  'Se fue con la competencia',
  'Proyecto cancelado por cliente',
  'Sin respuesta / cliente desapareci├│',
  'Fuera de presupuesto',
  'Tiempos de entrega',
  'Otro'
];

function marcarPerdida(id){
  _perdidaId = id;
  var cot = (allCotizaciones||[]).find(function(c){return c.id===id;});
  var overlay = document.getElementById('perdida-modal-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'perdida-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:14px;width:100%;max-width:420px;padding:24px;box-shadow:0 8px 40px var(--shadow);">'+
        '<div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Marcar como perdida</div>'+
        '<div id="perdida-modal-sub" style="font-size:12px;color:var(--text-3);margin-bottom:18px;"></div>'+
        '<label style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Motivo</label>'+
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px;">'+
          PERDIDA_MOTIVOS.map(function(m){
            return '<button onclick="perdidaSelMotivo(this,\''+m+'\')" style="font-size:11px;padding:4px 10px;border:.5px solid var(--border);border-radius:20px;background:none;color:var(--text-2);cursor:pointer;transition:all .12s;">'+m+'</button>';
          }).join('')+
        '</div>'+
        '<label style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Notas adicionales <span style="font-weight:400;">(opcional)</span></label>'+
        '<textarea id="perdida-modal-notas" rows="2" placeholder="Detalles..." style="width:100%;margin-top:6px;padding:8px 10px;border:.5px solid var(--border);border-radius:8px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>'+
        '<div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">'+
          '<button onclick="cerrarModalPerdida()" style="padding:8px 18px;border:.5px solid var(--border);border-radius:8px;background:none;color:var(--text-2);cursor:pointer;font-size:13px;">Cancelar</button>'+
          '<button onclick="confirmarPerdida()" style="padding:8px 20px;border-radius:8px;background:#f87171;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Confirmar p├®rdida</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
  }
  var sub = document.getElementById('perdida-modal-sub');
  if(sub) sub.textContent = cot ? (cot.numero||'')+' ┬À '+(cot.cliente_nombre||'') : '';
  // Reset state
  var notas = document.getElementById('perdida-modal-notas');
  if(notas) notas.value = '';
  overlay.querySelectorAll('button[data-sel]').forEach(function(b){ b.removeAttribute('data-sel'); b.style.cssText='font-size:11px;padding:4px 10px;border:.5px solid var(--border);border-radius:20px;background:none;color:var(--text-2);cursor:pointer;transition:all .12s;'; });
  overlay.style.display = 'flex';
}

function perdidaSelMotivo(btn, motivo){
  var overlay = document.getElementById('perdida-modal-overlay');
  if(!overlay) return;
  overlay.querySelectorAll('button[data-sel]').forEach(function(b){ b.removeAttribute('data-sel'); b.style.background='none'; b.style.color='var(--text-2)'; b.style.borderColor='var(--border)'; });
  btn.setAttribute('data-sel','1');
  btn.style.background = '#f87171'; btn.style.color = '#fff'; btn.style.borderColor = '#f87171';
}

function cerrarModalPerdida(){
  var overlay = document.getElementById('perdida-modal-overlay');
  if(overlay) overlay.style.display = 'none';
  _perdidaId = null;
}

async function confirmarPerdida(){
  if(!_perdidaId) return;
  var overlay = document.getElementById('perdida-modal-overlay');
  var selBtn = overlay ? overlay.querySelector('button[data-sel]') : null;
  var motivo = selBtn ? selBtn.textContent : '';
  var notas = ((document.getElementById('perdida-modal-notas')||{}).value||'').trim();
  var motivoFinal = motivo + (notas ? (motivo ? ' ÔÇö ' : '') + notas : '');
  var id = _perdidaId;
  cerrarModalPerdida();
  try{
    await DB.cotizaciones.updateEstatus(id,'perdida',{motivo_perdida:motivoFinal||null,fecha_cierre:new Date().toISOString().split('T')[0]});
    loadCotizaciones();
    cerrarDetail();
    showStatus('Cotizaci├│n marcada como perdida');
  }catch(e){showError('Error: '+e.message);}
}

// ÔöÇÔöÇ Cerrar cotizaci├│n ÔåÆ crear proyecto ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function convertirACotizacionCerrada(cotId){
  var cot = cotizaciones.find(function(c){return c.id===cotId;}) ||
    await DB.cotizaciones.get(cotId);
  if(!cot) return;

  var items = await DB.cotizacionItems.byCotizacion(cotId);

  // Classify items
  var maquinados = items.filter(function(i){return i.tipo==='maquinado';});
  var servicios  = items.filter(function(i){return i.tipo==='servicio';});
  var productos  = items.filter(function(i){return i.tipo==='producto';});
  var totalPiezas = maquinados.reduce(function(a,i){return a+(parseFloat(i.cantidad)||0);},0);

  // Build description from all items
  var allDescs = items.map(function(i){return i.descripcion;}).filter(Boolean);
  var tipoPieza = allDescs.slice(0,2).join(', ')+(allDescs.length>2?' y m├ís':'');

  // Build unidad from dominant type
  var unidad = maquinados.length ? (maquinados[0].unidad||'pzas') :
               servicios.length  ? (servicios[0].unidad||'hrs') : 'servicios';

  // Build items summary HTML
  var summaryHTML = items.length ?
    '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Items de la cotizaci├│n</div>'+
    items.map(function(i){
      var badge = i.tipo==='maquinado'?'­ƒöº':i.tipo==='servicio'?'ÔÜÖ´©Å':'­ƒôª';
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

    var a├▒o = new Date().getFullYear();
    var proyData = {
      nombre_cliente: cot.cliente_nombre,
      cliente_id: cot.cliente_id||null,
      nombre_pedido: nombrePedido,
      tipo_pieza: tipoPieza||null,
      total_piezas: totalPiezas,
      monto_total: cot.total,
      fecha_pedido: new Date().toISOString().split('T')[0],
      fecha_entrega: fechaEntrega,
      year: a├▒o,
      cotizacion_id: cotId,
      activo: true
    };

    var proj = await DB.proyectos.save(proyData);

    // Link cotizacion to proyecto
    await DB.cotizaciones.linkProyecto(cotId, proj.id);

    document.getElementById('conv-modal').style.display='none';
    cerrarDetail();
    loadCotizaciones();
    showStatus('Ô£ô Proyecto creado: '+nombrePedido);
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

// ÔöÇÔöÇ Detalle cotizaci├│n ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function verDetalleCotizacion(id){
  // Siempre re-fetch para tener fecha_cierre y numero_requisicion actualizados
  var cFresh = await DB.cotizaciones.get(id);
  var c = cFresh || cotizaciones.find(function(x){return x.id===id;});
  if(!c) return;

  var ini = (c.numero||'COT').slice(0,3).toUpperCase();
  var color = EST_COLORS[c.estatus]||'#475569';
  var label = EST_LABELS[c.estatus]||c.estatus;

  abrirDetail(c.numero||'Cotizaci├│n', c.cliente_nombre, ini,
    '<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',
    function(){editarCotizacion(id);}
  );

  try{
    var items = await DB.cotizacionItems.byCotizacion(id);

    var acciones = '';
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion'){
      acciones =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
          (c.estatus==='borrador'?'<button class="btn-primary" onclick="cambiarEstatusCot(\''+id+'\',\'enviada\')">Marcar enviada</button>':'')+
          (c.estatus==='enviada'?'<button class="btn-sm" onclick="cambiarEstatusCot(\''+id+'\',\'en_negociacion\')" style="color:#a78bfa;border-color:#a78bfa;">­ƒÆ¼ En negociaci├│n</button>':'')+
          '<button class="btn-primary" style="background:#34d399;color:#0b0e17;" onclick="cambiarEstatusCot(\''+id+'\',\'cerrada\')">Ô£ô Cerrar (ganada)</button>'+
          '<button class="btn-sm" style="color:#f87171;" onclick="marcarPerdida(\''+id+'\')">Marcar perdida</button>'+
          '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">­ƒôä PDF</button>'+
        '</div>';
    } else if(c.estatus==='cerrada'){
      acciones = '<div style="display:flex;gap:8px;">'+
        '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">­ƒôä PDF</button>'+
        (c.proyecto_id?'<button class="btn-sm" onclick="cerrarDetail();switchTab(\'proyectos\',document.getElementById(\'sb-proyectos\'));setTimeout(function(){verDetalleProyecto(\''+c.proyecto_id+'\');},600);">Ver proyecto ÔåÆ</button>':'')+
      '</div>';
    } else {
      acciones = '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">­ƒôä PDF</button>';
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
        '<div class="detail-field"><div class="detail-field-label">Vigencia</div><div class="detail-field-value">'+(c.vigencia_dias||15)+' d├¡as</div></div>'+
        (c.numero_requisicion?'<div class="detail-field"><div class="detail-field-label">No. Requisici├│n</div><div class="detail-field-value" style="font-family:monospace;">'+esc(c.numero_requisicion)+'</div></div>':'')+
        (c.fecha_cierre?'<div class="detail-field"><div class="detail-field-label">Fecha cierre</div><div class="detail-field-value">'+fmtDateFull(c.fecha_cierre)+'</div></div>':'')+
        (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(c.notas)+'</div></div>':'')+
      '</div></div>'+
      // Items table
      '<div class="detail-section">'+
        '<div class="detail-section-title">Items ('+items.length+')</div>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
          '<thead><tr>'+
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Descripci├│n</th>'+
            '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Tipo</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Cant.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">P.U.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Subtotal</th>'+
          '</tr></thead>'+
          '<tbody>'+itemsHTML+'</tbody>'+
        '</table></div>'+
      '</div>';

    // Contacto vinculado a esta cotizaci├│n espec├¡ficamente
    var contactoHTML = '';
    if(c.contacto_id){
      var cotCont=await DB.contactos.get(c.contacto_id);
      if(cotCont){
        var ctNombre=(cotCont.nombre||'')+(cotCont.apellido?' '+cotCont.apellido:'');
        contactoHTML=
          '<div class="detail-section">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
            '<div class="detail-section-title" style="margin-bottom:0;">Contacto vinculado</div>'+
            '<button class="btn-sm" style="font-size:11px;color:var(--text-3);" '+
              'onclick="quitarContactoCot(\''+id+'\')" title="Quitar contacto de esta cotizaci├│n">├ù Quitar</button>'+
          '</div>'+
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+cotCont.id+'\')">'+ 
            '<div>'+
              '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(ctNombre)+'</div>'+
              '<div style="font-size:11px;color:var(--text-3);">'+(cotCont.cargo||'')+(cotCont.email?' ┬À '+cotCont.email:'')+'</div>'+
              (cotCont.telefono?'<div style="font-size:11px;color:var(--text-3);">'+esc(cotCont.telefono)+'</div>':'')+
            '</div>'+
            '<span style="font-size:11px;color:var(--text-3);">ÔåÆ</span>'+
          '</div>'+
          '</div>';
      }
    } else if(c.cliente_id){
      // No contact linked yet ÔÇö offer to set one from this company's contacts
      contactoHTML=
        '<div class="detail-section">'+
        '<div class="detail-section-title">Contacto vinculado</div>'+
        '<div style="color:var(--text-4);font-size:12px;padding:4px 0 10px;">Sin contacto vinculado a esta cotizaci├│n</div>'+
        '<button class="btn-sm" style="font-size:11px;" '+
          'onclick="vincularContactoCot(\''+id+'\',\''+c.cliente_id+'\')">+ Vincular contacto</button>'+
        '</div>';
    }
    body += contactoHTML;

    // Usuario del cliente vinculado
    if(c.usuario_cliente_id){
      var cotUsu=await DB.contactos.get(c.usuario_cliente_id);
      if(cotUsu){
        var usuNombre=(cotUsu.nombre||'')+(cotUsu.apellido?' '+cotUsu.apellido:'');
        body+=
          '<div class="detail-section">'+
          '<div class="detail-section-title">Usuario (solicitante)</div>'+
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+cotUsu.id+'\')">'+
            '<div>'+
              '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(usuNombre)+'</div>'+
              '<div style="font-size:11px;color:var(--text-3);">'+(cotUsu.cargo||'')+(cotUsu.email?' ┬À '+cotUsu.email:'')+'</div>'+
            '</div>'+
            '<span style="font-size:11px;color:var(--text-3);">ÔåÆ</span>'+
          '</div>'+
          '</div>';
      }
    }

    document.getElementById('detail-body').innerHTML = body;
  }catch(e){
    console.error('Detalle cotizacion:',e);
    document.getElementById('detail-body').innerHTML = '<div style="padding:16px;color:#f87171;">Error: '+esc(String(e.message||e))+'</div>';
  }
}


// ÔöÇÔöÇ Vincular contacto a cotizaci├│n desde detalle ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
          (c.email ? ' ┬À '+esc(c.email) : '') +
          (yaAsignado ? ' ┬À <span style="color:#f87171;">Ya tiene empresa</span>' : '') +
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
    await DB.cotizaciones.linkContact(cotId, contactoId);
    showStatus('Ô£ô Contacto vinculado: ' + nombre);
    verDetalleCotizacion(cotId);
  }catch(e){ showError('Error: ' + e.message); }
}

