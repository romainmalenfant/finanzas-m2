// ── Facturas module ───────────────────────────────────────
var allFacturas = [];
var facturasTipo = 'emitidas'; // emitidas | recibidas | conciliadas | complementos
var facturasYearFilter = new Date().getFullYear();

// ── Load ─────────────────────────────────────────────────
async function loadFacturas(){
  // U2 — skeleton mientras carga
  var listEl=document.getElementById('fact-list');
  if(listEl)listEl.innerHTML=[1,2,3,4,5].map(function(){return '<div class="sk-card"><div class="sk-avatar skeleton"></div><div class="sk-card-body"><div class="sk-line skeleton"></div><div class="sk-line-sm skeleton"></div></div></div>';}).join("");
  try{
    var yearSel = document.getElementById('fact-year-filter');
    if(yearSel && !yearSel.options.length){
      var yr = new Date().getFullYear();
      for(var y=yr;y>=yr-3;y--){
        var o=document.createElement('option');
        o.value=y; o.textContent=y;
        if(y===yr)o.selected=true;
        yearSel.appendChild(o);
      }
    }
    facturasYearFilter = parseInt((yearSel&&yearSel.value)||new Date().getFullYear());

    var {data,error} = await sb.from('facturas').select('*').eq('year',facturasYearFilter).order('fecha',{ascending:false});
    if(error)throw error;
    allFacturas = data||[];
    renderFacturasKPIs();
    renderSemaforo();
    filtrarFacturas(document.getElementById('fact-search')&&document.getElementById('fact-search').value||'');
  }catch(e){
    console.error('loadFacturas:',e);
    document.getElementById('fact-list').innerHTML='<div class="empty-state">Error cargando facturas</div>';
  }
}

// ── KPIs ─────────────────────────────────────────────────
function renderFacturasKPIs(){
  var emitidas = allFacturas.filter(function(f){return f.tipo==='emitida'&&f.estatus==='vigente'&&!f.sin_factura;});
  var ventasDirectas = allFacturas.filter(function(f){return f.tipo==='emitida'&&f.sin_factura;});
  var recibidas = allFacturas.filter(function(f){return f.tipo==='recibida'&&f.estatus==='vigente';});
  var cobrar = emitidas.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
  var ppd = allFacturas.filter(function(f){return f.complemento_requerido&&!f.conciliado;});

  document.getElementById('fact-k-emitidas').textContent = emitidas.length;
  document.getElementById('fact-k-recibidas').textContent = recibidas.length;
  document.getElementById('fact-k-cobrar').textContent = fmt(cobrar);
  document.getElementById('fact-k-ppd').textContent = ppd.length;

  // Badge sidebar
  var badge = document.getElementById('badge-facturas');
  if(badge){
    var urgentes = allFacturas.filter(function(f){
      if(f.conciliado||f.estatus!=='vigente')return false;
      var dias = Math.floor((new Date()-new Date(f.fecha))/(864e5));
      return dias>30;
    }).length;
    badge.style.display = urgentes?'flex':'none';
    badge.textContent = urgentes>9?'9+':urgentes;
  }
}

// ── Semáforo ─────────────────────────────────────────────
function renderSemaforo(){
  var hoy = new Date();
  var pendientes = allFacturas.filter(function(f){
    return f.tipo==='emitida' && f.estatus==='vigente' && !f.conciliado;
  });
  var b = [{monto:0,n:0},{monto:0,n:0},{monto:0,n:0}];
  pendientes.forEach(function(f){
    var dias = Math.floor((hoy-new Date(f.fecha||hoy))/(864e5));
    var idx = dias<=30?0:dias<=60?1:2;
    b[idx].monto += parseFloat(f.total)||0;
    b[idx].n++;
  });
  ['0','1','2'].forEach(function(i){
    document.getElementById('fact-s'+i).textContent = fmt(b[i].monto);
    document.getElementById('fact-s'+i+'-n').textContent = b[i].n+' factura'+(b[i].n!==1?'s':'');
  });
}

// ── Tipo toggle ───────────────────────────────────────────
function setFacturaTipo(tipo, btn){
  facturasTipo = tipo;
  document.querySelectorAll('#fact-tipo-toggle button').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  filtrarFacturas(document.getElementById('fact-search').value||'');
}

// ── Filter & render ───────────────────────────────────────
function filtrarFacturas(q){
  var ql = (q||'').toLowerCase();
  var filtered = allFacturas.filter(function(f){
    // Tipo filter
    if(facturasTipo==='emitidas')   return f.tipo==='emitida'&&f.estatus==='vigente'&&!f.conciliado&&!f.sin_factura;
    if(facturasTipo==='directas')    return f.tipo==='emitida'&&f.sin_factura;
    if(facturasTipo==='recibidas')  return f.tipo==='recibida'&&f.estatus==='vigente'&&!f.conciliado;
    if(facturasTipo==='conciliadas')return f.conciliado||f.estatus==='pagada';
    if(facturasTipo==='complementos')return f.complemento_requerido&&!f.conciliado;
    return true;
  }).filter(function(f){
    if(!ql)return true;
    return (f.numero_factura||'').toLowerCase().includes(ql)||
           (f.receptor_nombre||'').toLowerCase().includes(ql)||
           (f.emisor_nombre||'').toLowerCase().includes(ql)||
           (f.concepto||'').toLowerCase().includes(ql)||
           (f.receptor_rfc||'').toLowerCase().includes(ql)||
           (f.emisor_rfc||'').toLowerCase().includes(ql);
  });

  var ct = document.getElementById('fact-count');
  if(ct) ct.textContent = filtered.length+' factura'+(filtered.length!==1?'s':'');

  renderFacturasList(filtered);
}

// -- T6: Pure render functions --

/**
 * Builds a single <tr> row for the facturas table.
 * Pure: no side effects, returns HTMLElement.
 */
function renderFacturaRow(f, hoy){
  var dias = f.fecha ? Math.floor((hoy-new Date(f.fecha))/(864e5)) : 0;
  var semColor = dias>60?'#dc2626':dias>30?'#d97706':'#16a34a';
  var nombre = f.tipo==='emitida'
    ? (f.receptor_nombre||f.receptor_rfc||'—')
    : (f.emisor_nombre||f.emisor_rfc||'—');

  // Estatus badge
  var estBg,estColor,estLabel;
  if(f.conciliado){    estBg='#fee2e2'; estColor='var(--brand-red)'; estLabel='Pagada'; }
  else if(f.estatus==='cancelada'){ estBg='#fee2e2'; estColor='#dc2626'; estLabel='Cancelada'; }
  else {               estBg='#dcfce7'; estColor='#16a34a'; estLabel='Vigente'; }

  var metodoBg    = f.metodo_pago==='PPD' ? '#fef3c7' : '#f1f5f9';
  var metodoColor = f.metodo_pago==='PPD' ? '#d97706' : '#64748b';

  var tr = document.createElement('tr');
  tr.style.cursor = 'pointer';
  tr.addEventListener('click', function(){ verDetalleFactura(f.id); });

  function td(content){
    var cell = document.createElement('td');
    if(typeof content === 'string') cell.innerHTML = content;
    else cell.appendChild(content);
    return cell;
  }

  // Col 1: nombre + concepto
  var nameDiv = document.createElement('div');
  nameDiv.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-1);';
  nameDiv.textContent = nombre.slice(0,35);
  var nameCell = document.createElement('td');
  nameCell.appendChild(nameDiv);
  if(f.concepto){
    var concDiv = document.createElement('div');
    concDiv.style.cssText = 'font-size:10px;color:var(--text-3);';
    concDiv.textContent = f.concepto.slice(0,35);
    nameCell.appendChild(concDiv);
  }
  tr.appendChild(nameCell);

  // Col 2: folio
  var folioCell = document.createElement('td');
  folioCell.className = 'muted';
  if(f.sin_factura){
    var vtaBadge = document.createElement('span');
    vtaBadge.style.cssText = 'padding:1px 6px;border-radius:4px;font-size:10px;background:#fef3c7;color:#d97706;';
    vtaBadge.textContent = 'VTA';
    folioCell.appendChild(vtaBadge);
    folioCell.appendChild(document.createTextNode(' '+(f.numero_vta||'—')));
  } else {
    folioCell.textContent = f.numero_factura||'—';
  }
  tr.appendChild(folioCell);

  // Col 3: fecha + semáforo
  var fechaCell = document.createElement('td');
  fechaCell.className = 'muted';
  fechaCell.textContent = fmtDate(f.fecha||'');
  if(f.fecha && dias>0){
    var diasSpan = document.createElement('span');
    diasSpan.style.cssText = 'color:'+semColor+';font-size:10px;';
    diasSpan.textContent = ' '+dias+'d';
    fechaCell.appendChild(diasSpan);
  }
  tr.appendChild(fechaCell);

  // Col 4: método pago
  var metCell = document.createElement('td');
  var metBadge = document.createElement('span');
  metBadge.style.cssText = 'padding:2px 7px;border-radius:5px;font-size:11px;font-weight:500;background:'+metodoBg+';color:'+metodoColor+';';
  metBadge.textContent = f.metodo_pago||'PUE';
  metCell.appendChild(metBadge);
  tr.appendChild(metCell);

  // Col 5: proyecto
  var projCell = document.createElement('td');
  projCell.className = 'muted';
  projCell.style.fontSize = '11px';
  if(f.proyecto_id){
    var projSpan = document.createElement('span');
    projSpan.style.color = 'var(--brand-red)';
    projSpan.textContent = 'Vinculado';
    projCell.appendChild(projSpan);
  } else {
    projCell.textContent = '—';
  }
  tr.appendChild(projCell);

  // Col 6: total
  var montoCell = document.createElement('td');
  montoCell.className = 'monto';
  montoCell.style.color = f.tipo==='emitida'?'#16a34a':'#dc2626';
  montoCell.textContent = fmt(parseFloat(f.total)||0);
  tr.appendChild(montoCell);

  // Col 7: estatus
  var estCell = document.createElement('td');
  var estBadge = document.createElement('span');
  estBadge.style.cssText = 'padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;background:'+estBg+';color:'+estColor+';';
  estBadge.textContent = estLabel;
  estCell.appendChild(estBadge);
  tr.appendChild(estCell);

  return tr;
}

/**
 * Builds a single fact-item row for the invoice form.
 * Pure: returns HTMLElement.
 */
function renderFactItemRow(item){
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';

  var descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.placeholder = 'Descripción del concepto';
  descInput.value = item.desc;
  descInput.style.cssText = 'flex:1;padding:7px 10px;font-size:13px;';
  descInput.addEventListener('change', function(){
    var found = _factItems.find(function(x){return x.id===item.id;});
    if(found){ found.desc = this.value; updateFactConcepto(); }
  });

  var montoInput = document.createElement('input');
  montoInput.type = 'number';
  montoInput.placeholder = '$0';
  montoInput.value = item.monto||'';
  montoInput.min = '0';
  montoInput.style.cssText = 'width:110px;padding:7px 10px;font-size:13px;';
  montoInput.setAttribute('inputmode','decimal');
  montoInput.addEventListener('change', function(){
    var found = _factItems.find(function(x){return x.id===item.id;});
    if(found){ found.monto = parseFloat(this.value)||0; recalcFactTotales(); }
  });

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-3);font-size:18px;line-height:1;padding:0 4px;';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', function(){ removeFactItem(item.id); });

  row.appendChild(descInput);
  row.appendChild(montoInput);
  row.appendChild(removeBtn);
  return row;
}

function renderFacturasList(list){
  var el = document.getElementById('fact-list');
  el.innerHTML = '';
  if(!list.length){
    var ctaLabels = {
      emitidas:'+ Nueva factura emitida',
      recibidas:'+ Nueva factura recibida',
      directas:'+ Registrar venta directa',
    };
    var wrap = document.createElement('div');
    wrap.className = 'empty-state-cta';
    var icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = '🧾';
    var msg = document.createElement('div');
    msg.className = 'empty-state-msg';
    msg.textContent = 'Sin facturas en esta categoría';
    wrap.appendChild(icon);
    wrap.appendChild(msg);
    if(facturasTipo==='emitidas'||facturasTipo==='recibidas'||facturasTipo==='directas'){
      var btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = ctaLabels[facturasTipo]||'+ Nueva factura';
      btn.addEventListener('click', abrirNuevaFactura);
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
    return;
  }
  var isRecibida = facturasTipo==='recibidas'||facturasTipo==='complementos';
  var table = document.createElement('table');
  table.className = 'sat-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>'+(isRecibida?'Proveedor':'Cliente')+'</th>'
    + '<th>Folio</th><th>Fecha</th><th>Método</th><th>Proyecto</th>'
    + '<th style="text-align:right;">Total</th><th>Estatus</th></tr>';
  var tbody = document.createElement('tbody');
  var hoy = new Date();
  var frag = document.createDocumentFragment();
  list.forEach(function(f){ frag.appendChild(renderFacturaRow(f, hoy)); });
  tbody.appendChild(frag);
  table.appendChild(thead);
  table.appendChild(tbody);
  el.appendChild(table);
}

// ── Detalle factura ───────────────────────────────────────
async function verDetalleFactura(id){
  var f = allFacturas.find(function(x){return x.id===id;});
  if(!f){
    var {data}=await sb.from('facturas').select('*').eq('id',id).maybeSingle();
    if(!data)return;
    f=data;
  }
  var nombre = f.tipo==='emitida'?(f.receptor_nombre||f.receptor_rfc||'—'):(f.emisor_nombre||f.emisor_rfc||'—');
  var ini = nombre.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase()||'F';
  var hoy = new Date();
  var dias = f.fecha?Math.floor((hoy-new Date(f.fecha))/(864e5)):0;
  var semColor = dias>60?'#dc2626':dias>30?'#d97706':'#16a34a';

  var body =
    '<div class="detail-section"><div class="detail-kpi-grid">'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Total</div><div class="detail-kpi-value '+(f.tipo==='emitida'?'c-green':'c-red')+'">'+fmt(parseFloat(f.total)||0)+'</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">IVA</div><div class="detail-kpi-value" style="color:var(--text-2);">'+fmt(parseFloat(f.iva)||0)+'</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Días</div><div class="detail-kpi-value" style="color:'+semColor+';">'+dias+'d</div></div>'+
    '</div></div>'+
    '<div class="detail-section"><div class="detail-section-title">Datos</div><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Tipo</div><div class="detail-field-value">'+(f.tipo==='emitida'?'Emitida':'Recibida')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Fecha</div><div class="detail-field-value">'+fmtDateFull(f.fecha||'')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Folio</div><div class="detail-field-value">'+(f.numero_factura||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Método pago</div><div class="detail-field-value" style="color:'+(f.metodo_pago==='PPD'?'#d97706':'var(--text-2)')+';">'+(f.metodo_pago||'PUE')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">RFC</div><div class="detail-field-value" style="font-size:11px;">'+(f.tipo==='emitida'?(f.receptor_rfc||'—'):(f.emisor_rfc||'—'))+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Estatus</div><div class="detail-field-value" style="color:'+(f.conciliado?'#1d4ed8':f.estatus==='cancelada'?'#dc2626':'#16a34a')+';">'+(f.conciliado?'Pagada':f.estatus==='cancelada'?'Cancelada':'Vigente')+'</div></div>'+
    '</div>'+
    (f.concepto?'<div class="detail-field" style="margin-top:8px;"><div class="detail-field-label">Concepto</div><div class="detail-field-value">'+esc(f.concepto)+'</div></div>':'')+
    (f.notas?'<div class="detail-field" style="margin-top:8px;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(f.notas)+'</div></div>':'')+
    '</div>'+
    '<div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap;">'+
      (!f.conciliado&&f.estatus!=='cancelada'?'<button class="btn-primary" style="background:#16a34a;" onclick="marcarFacturaPagada(\''+f.id+'\')">✓ Marcar pagada</button>':'')+
      (!f.conciliado&&f.estatus!=='cancelada'?'<button class="btn-sm" onclick="editarFactura(\''+f.id+'\')">Editar</button>':'')+
      '<button class="btn-sm" style="color:#dc2626;border-color:#dc2626;" onclick="cancelarFactura(\''+f.id+'\')">Cancelar</button>'+
    '</div>';

  abrirDetail(nombre,'Factura '+(f.tipo==='emitida'?'emitida':'recibida'),ini,body, function(){cerrarDetail();editarFactura(f.id);});
}

// ── Marcar pagada ─────────────────────────────────────────
async function marcarFacturaPagada(id){
  try{
    await sb.from('facturas').update({conciliado:true,estatus:'pagada',fecha_pago:new Date().toISOString().split('T')[0]}).eq('id',id);
    showStatus('✓ Factura marcada como pagada');
    cerrarDetail();
    loadFacturas();
  }catch(e){showError('Error: '+e.message);}
}

// ── Cancelar factura ──────────────────────────────────────
async function cancelarFactura(id){
  if(!confirm('¿Cancelar esta factura?'))return;
  try{
    await sb.from('facturas').update({estatus:'cancelada'}).eq('id',id);
    showStatus('Factura cancelada');
    cerrarDetail();
    loadFacturas();
  }catch(e){showError('Error: '+e.message);}
}

// ── Nueva / Editar factura ────────────────────────────────
function abrirNuevaFactura(){
  document.getElementById('fact-id-edit').value='';
  document.getElementById('fact-modal-title').textContent='Nueva factura';
  document.getElementById('fact-tipo').value='emitida';
  document.getElementById('fact-metodo-pago').value='PUE';
  document.getElementById('fact-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('fact-numero').value='';
  document.getElementById('fact-subtotal').value='';
  document.getElementById('fact-iva').value='';
  document.getElementById('fact-total').value='';
  document.getElementById('fact-concepto').value='';
  document.getElementById('fact-notas').value='';
  document.getElementById('fact-cliente-id').value='';
  document.getElementById('fact-cliente-search').value='';
  document.getElementById('fact-prov-id').value='';
  document.getElementById('fact-prov-search').value='';
  document.getElementById('fact-proj-id').value='';
  document.getElementById('fact-proj-search').value='';
  var _ftm=document.getElementById('fact-total-manual'); if(_ftm) _ftm.value='';
  var _fci=document.getElementById('fact-con-iva'); if(_fci) _fci.checked=true;
  _factItems=[]; _factItemId=0;
  _factEsSinSat = false;
  renderFactItems();
  onFactTipoChange('emitida');
  setFactConSat(true); // default: con factura SAT
  initFactACs();
  document.getElementById('fact-modal').style.display='flex';
}

async function editarFactura(id){
  var f = allFacturas.find(function(x){return x.id===id;});
  if(!f){
    var {data}=await sb.from('facturas').select('*').eq('id',id).maybeSingle();
    if(!data)return;
    f=data;
  }
  document.getElementById('fact-id-edit').value=f.id;
  document.getElementById('fact-modal-title').textContent='Editar factura';
  document.getElementById('fact-tipo').value=f.tipo||'emitida';
  document.getElementById('fact-metodo-pago').value=f.metodo_pago||'PUE';
  document.getElementById('fact-fecha').value=f.fecha||'';
  document.getElementById('fact-numero').value=f.numero_factura||'';
  document.getElementById('fact-subtotal').value=f.subtotal||'';
  document.getElementById('fact-iva').value=f.iva||'';
  document.getElementById('fact-total').value=f.total||'';
  document.getElementById('fact-concepto').value=f.concepto||'';
  document.getElementById('fact-notas').value=f.notas||'';
  _factEsSinSat = !!f.sin_factura;
  onFactTipoChange(f.tipo||'emitida');
  setFactConSat(!f.sin_factura);
  initFactACs();
  // Pre-fill autocompletes
  // Show clear button if project is set
  setTimeout(function(){ actualizarBtnClear('fact-proj-id','fact-proj-clear'); }, 50);
  if(f.tipo==='emitida'&&f.receptor_nombre){
    document.getElementById('fact-cliente-search').value=f.receptor_nombre;
    document.getElementById('fact-cliente-id').value=f.cliente_id||'';
  }
  if(f.tipo==='recibida'&&f.emisor_nombre){
    document.getElementById('fact-prov-search').value=f.emisor_nombre;
    document.getElementById('fact-prov-id').value=f.proveedor_id||'';
  }
  cerrarDetail();
  document.getElementById('fact-modal').style.display='flex';
}

// ── Con/sin factura SAT toggle ─────────────────────────
var _factEsSinSat = false; // false = con factura SAT, true = venta directa
var _ivaDebounce  = null;  // debounce timer for subtotal input

function setFactConSat(conSat){
  _factEsSinSat = !conSat;
  var btnCon    = document.getElementById('fact-con-sat');
  var btnSin    = document.getElementById('fact-sin-sat');
  var subLabel  = document.getElementById('fact-subtotal-label');
  var ivaInput  = document.getElementById('fact-iva');
  var totInput  = document.getElementById('fact-total');

  if(btnCon) btnCon.classList.toggle('active', conSat);
  if(btnSin) btnSin.classList.toggle('active', !conSat);

  // Labels
  if(subLabel) subLabel.textContent = conSat ? 'Subtotal (sin IVA)' : 'Monto';

  // IVA & Total: locked visually via CSS only.
  // NEVER use el.readOnly — Chrome ignores JS .value assignments on readOnly inputs.
  function lockField(el, lock){
    if(!el) return;
    // Visual lock: style only, no readOnly attribute
    el.setAttribute('tabindex', lock ? '-1' : '0');
    el.style.background     = lock ? 'var(--bg-card-2)' : '';
    el.style.cursor         = lock ? 'not-allowed'      : '';
    el.style.pointerEvents  = lock ? 'none'             : '';
    // Remove readOnly so JS .value = ... always works
    el.readOnly = false;
  }
  lockField(ivaInput, true);   // IVA always locked
  lockField(totInput, true);   // Total always locked (auto-calculated)

  // Recalc from current subtotal
  var subInput = document.getElementById('fact-subtotal');
  if(subInput && subInput.value) calcFactIva();
  else {
    if(ivaInput) ivaInput.value = '';
    if(totInput) totInput.value = '';
  }
}

function onFactTipoChange(tipo){
  document.getElementById('fact-campo-cliente').style.display=tipo==='emitida'?'block':'none';
  document.getElementById('fact-campo-proveedor').style.display=tipo==='recibida'?'block':'none';
  // Show con/sin SAT toggle only for emitidas
  var toggleEl = document.getElementById('fact-toggle-tipo');
  if(toggleEl) toggleEl.style.display = tipo==='emitida' ? 'block' : 'none';
  // For recibidas, reset to con-factura mode (always has factura)
  if(tipo==='recibida') setFactConSat(true);
  // Clear the other field
  if(tipo==='emitida'){document.getElementById('fact-prov-search').value='';document.getElementById('fact-prov-id').value='';}
  else{document.getElementById('fact-cliente-search').value='';document.getElementById('fact-cliente-id').value='';}
}

// ── Fact items management ─────────────────────────────────
var _factItems = [];
var _factItemId = 0;

function addFactItem(desc, monto){
  var id = ++_factItemId;
  _factItems.push({id:id, desc:desc||'', monto:monto||0});
  renderFactItems();
}

function removeFactItem(id){
  _factItems = _factItems.filter(function(i){return i.id!==id;});
  renderFactItems();
}

function renderFactItems(){
  var el = document.getElementById('fact-items-list');
  if(!el) return; // element may not exist in this context
  el.innerHTML = '';
  if(!_factItems.length){
    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:12px;color:var(--text-3);padding:8px 0;';
    msg.textContent = 'Sin conceptos — agrega una línea o usa el total directo abajo.';
    el.appendChild(msg);
    recalcFactTotales();
    return;
  }
  var frag = document.createDocumentFragment();
  _factItems.forEach(function(item){ frag.appendChild(renderFactItemRow(item)); });
  el.appendChild(frag);
  recalcFactTotales();
}

function updateFactConcepto(){
  var concepto = _factItems.map(function(i){return i.desc;}).filter(Boolean).join(', ');
  document.getElementById('fact-concepto').value = concepto;
}

function recalcFactTotales(){
  // If manual total is set, use that
  var _ftm2=document.getElementById('fact-total-manual');
  var _fci2=document.getElementById('fact-con-iva');
  var manualTotal = _ftm2 ? (parseFloat(_ftm2.value)||0) : 0;
  var conIva = _fci2 ? _fci2.checked : true;

  var sub, iva, total;

  if(manualTotal>0){
    total = manualTotal;
    if(conIva){
      sub = Math.round(total/1.16*100)/100;
      iva = Math.round(total-sub*100)/100;
    } else {
      sub = total;
      iva = Math.round(sub*0.16*100)/100;
      total = Math.round((sub+iva)*100)/100;
    }
  } else if(_factItems.length){
    // Sum from items
    sub = Math.round(_factItems.reduce(function(a,i){return a+(i.monto||0);},0)*100)/100;
    iva = Math.round(sub*0.16*100)/100;
    total = Math.round((sub+iva)*100)/100;
  } else {
    sub=0; iva=0; total=0;
  }

  // Optional display elements (may not exist in this modal)
  var sdEl = document.getElementById('fact-subtotal-display');
  var idEl = document.getElementById('fact-iva-display');
  var tdEl = document.getElementById('fact-total-display');
  if(sdEl) sdEl.textContent = fmt(sub);
  if(idEl) idEl.textContent = fmt(iva);
  if(tdEl) tdEl.textContent = fmt(total);
  // Store in input fields — use calcFactIva for the auto-calc path
  var subInp = document.getElementById('fact-subtotal');
  var ivaInp = document.getElementById('fact-iva');
  var totInp = document.getElementById('fact-total');
  if(manualTotal > 0 || _factItems.length){
    if(subInp) subInp.value = sub;
    if(ivaInp) ivaInp.value = iva;
    if(totInp) totInp.value = total;
  } else {
    // No items, no manual total: delegate to calcFactIva (reads fact-subtotal directly)
    calcFactIva();
  }
  updateFactConcepto();
}

function onFactTotalManual(val){
  // When manual total changes, clear items monto to avoid conflict
  recalcFactTotales();
}

function calcFactIva(){
  var sub = parseFloat(document.getElementById('fact-subtotal').value)||0;
  var ivaEl  = document.getElementById('fact-iva');
  var totEl  = document.getElementById('fact-total');
  if(_factEsSinSat){
    // Venta directa: sin IVA, total = monto capturado
    if(ivaEl){ ivaEl.value = sub ? '0.00' : ''; ivaEl.placeholder = 'Sin IVA'; }
    if(totEl){ totEl.value = sub ? sub.toFixed(2) : ''; totEl.placeholder = 'Auto'; }
  } else {
    // Con factura SAT: IVA 16% automático
    var iva   = Math.round(sub * 0.16 * 100) / 100;
    var total = Math.round((sub + iva)  * 100) / 100;
    if(ivaEl){ ivaEl.value = sub ? iva.toFixed(2)   : ''; ivaEl.placeholder = 'Auto 16%'; }
    if(totEl){ totEl.value = sub ? total.toFixed(2) : ''; totEl.placeholder = 'Auto'; }
  }
}

/**
 * Pre-populates the project dropdown with recent projects
 * from the selected client. Non-restrictive: user can still
 * type to search all projects.
 */
function precargarProyectosFact(){
  var clienteId = document.getElementById('fact-cliente-id').value;
  var projInp   = document.getElementById('fact-proj-search');
  var projHid   = document.getElementById('fact-proj-id');
  var projDd    = document.getElementById('fact-proj-dd');
  if(!projInp || !projDd) return;
  // Don't overwrite if user already selected a project
  if(projHid && projHid.value) return;
  var pool = (allProyectos||[]);
  var clienteProjs = clienteId
    ? pool.filter(function(p){ return p.cliente_id===clienteId; })
    : [];
  // Recent first (last 5)
  var recent = clienteProjs
    .slice().sort(function(a,b){ return (b.created_at||'') > (a.created_at||'') ? 1 : -1; })
    .slice(0, 5);
  if(!recent.length) return;
  // Render a pre-populated dropdown (closes on select)
  projDd.innerHTML = '';
  var hint = document.createElement('div');
  hint.style.cssText = 'padding:6px 12px;font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;';
  hint.textContent = 'Proyectos recientes';
  projDd.appendChild(hint);
  var frag = document.createDocumentFragment();
  recent.forEach(function(p){
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:13px;';
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:500;color:var(--text-1);';
    nameEl.textContent = p.nombre||p.titulo||p.id;
    item.appendChild(nameEl);
    item.addEventListener('mousedown', function(){
      if(projInp) projInp.value = p.nombre||p.titulo||'';
      if(projHid) projHid.value = p.id;
      projDd.style.display = 'none';
      actualizarBtnClear('fact-proj-id','fact-proj-clear');
    });
    frag.appendChild(item);
  });
  projDd.appendChild(frag);
  projDd.style.display = 'block';
  // Auto-hide when clicking outside
  setTimeout(function(){
    document.addEventListener('mousedown', function _hideProj(e){
      if(!projDd.contains(e.target) && e.target !== projInp){
        projDd.style.display = 'none';
        document.removeEventListener('mousedown', _hideProj);
      }
    });
  }, 100);
}

// Debounced version — fires 700ms after user stops typing in subtotal
function calcFactIvaDebounced(){
  clearTimeout(_ivaDebounce);
  _ivaDebounce = setTimeout(calcFactIva, 700);
}

function initFactACs(){
  if(!clientes.length)loadClientes();
  if(!proveedores.length)loadProveedores();
  if(!allProyectos.length)loadProyectos();

  // When client is selected, pre-populate project dropdown
  var cliHid = document.getElementById('fact-cliente-id');
  if(cliHid && !cliHid._projListener){
    cliHid._projListener = true;
    cliHid.addEventListener('change', precargarProyectosFact);
  }
  // Also hook into the search input blur
  var cliInp = document.getElementById('fact-cliente-search');
  if(cliInp && !cliInp._projListener){
    cliInp._projListener = true;
    cliInp.addEventListener('change', precargarProyectosFact);
  }

  makeAutocomplete('fact-cliente-search','fact-cliente-id','fact-cliente-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},
    function(){ setTimeout(precargarProyectosFact, 50); });
  makeAutocomplete('fact-prov-search','fact-prov-id','fact-prov-dd',
    function(){return proveedores.map(function(p){return {id:p.id,label:p.nombre,sub:p.rfc||''};});},null);
  makeAutocomplete('fact-proj-search','fact-proj-id','fact-proj-dd',
    function(){return allProyectos.map(function(p){return {id:p.id,label:p.nombre_pedido||p.id,sub:p.nombre_cliente||''};});},null);
}

// ── Guardar ───────────────────────────────────────────────
async function guardarFactura(){
  var id=document.getElementById('fact-id-edit').value;
  var tipo=document.getElementById('fact-tipo').value;
  var fecha=document.getElementById('fact-fecha').value;
  var total=parseFloat(document.getElementById('fact-total').value)||0;
  var clienteId=document.getElementById('fact-cliente-id').value||null;
  var provId=document.getElementById('fact-prov-id').value||null;
  var projId=document.getElementById('fact-proj-id').value||null;
  var metodoPago=document.getElementById('fact-metodo-pago').value;

  if(!fecha){showError('La fecha es obligatoria');return;}
  if(!total){showError('El total es obligatorio');return;}
  if(tipo==='emitida'&&!clienteId){showError('Selecciona un cliente de la lista');return;}
  if(tipo==='recibida'&&!provId){showError('Selecciona un proveedor de la lista');return;}

  var cli=tipo==='emitida'?clientes.find(function(c){return c.id===clienteId;}):null;
  // Fallback: if cli not in local array, use the search field text
  var cliNombre = cli ? cli.nombre : (tipo==='emitida'&&document.getElementById('fact-cliente-search').value.trim()||null);
  var cliRfc    = cli ? cli.rfc    : null;
  var prov=tipo==='recibida'?proveedores.find(function(p){return p.id===provId;}):null;
  var fechaD=new Date(fecha+'T12:00');

  var row={
    tipo:tipo,
    fecha:fecha,
    numero_factura:document.getElementById('fact-numero').value.trim()||null,
    subtotal:parseFloat(document.getElementById('fact-subtotal').value)||0,
    iva:parseFloat(document.getElementById('fact-iva').value)||0,
    total:total,
    metodo_pago:metodoPago,
    concepto:((_factItems||[]).map(function(i){return i.desc;}).filter(Boolean).join(', '))||document.getElementById('fact-concepto').value.trim()||null,
    notas:document.getElementById('fact-notas').value.trim()||null,
    cliente_id:clienteId,
    proveedor_id:provId,
    proyecto_id:projId||null,
    receptor_nombre:cliNombre,
    receptor_rfc:cliRfc,
    emisor_nombre:prov?prov.nombre:null,
    emisor_rfc:prov?prov.rfc:null,
    sin_factura: _factEsSinSat,
    estatus:'vigente',
    conciliado:false,
    complemento_requerido:metodoPago==='PPD',
    origen:'manual',
    year:fechaD.getFullYear(),
    month:fechaD.getMonth()+1
  };

  try{
    var btn=document.getElementById('btn-save-fact');
    btn.disabled=true;btn.textContent='Guardando...';
    if(id){
      var {error}=await sb.from('facturas').update(row).eq('id',id);
      if(error)throw error;
      showStatus('✓ Factura actualizada');
    }else{
      var {error}=await sb.from('facturas').insert([row]);
      if(error)throw error;
      showStatus('✓ Factura creada');
    }
    document.getElementById('fact-modal').style.display='none';
    loadFacturas();
  }catch(e){showError('Error: '+e.message);}
  finally{
    var btn=document.getElementById('btn-save-fact');
    btn.disabled=false;btn.textContent='Guardar';
  }
}
