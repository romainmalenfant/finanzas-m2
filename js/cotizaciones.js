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
      .order('created_at',{ascending:false});
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

function renderCotizacionesList(list, historial){
  var wrap = document.getElementById('cot-lista-wrap');
  if(!wrap) return;
  var el = document.getElementById('cotizaciones-list');
  if(!el){
    wrap.innerHTML='<div id="cotizaciones-list"></div>';
    el=wrap.querySelector('#cotizaciones-list');
  }
  var ct = document.getElementById('cot-count');
  var total = list.length + (historial?historial.length:0);
  if(ct) ct.textContent = total + ' cotizaci' + (total===1?'ón':'ones');
  if(!list.length && !(historial&&historial.length)){
    el.innerHTML = '<div class="empty-state">Sin cotizaciones para '+cotYearFilter+'.</div>';
    // Render empty historial section
    renderHistorialCotizaciones(wrap, []);
    return;
  }
  el.innerHTML = list.map(function(c){
    var color = EST_COLORS[c.estatus]||'#475569';
    var label = EST_LABELS[c.estatus]||c.estatus;
    return '<div class="proj-card" style="cursor:pointer;" onclick="verDetalleCotizacion(\''+c.id+'\')">'+
      '<div class="proj-hdr" style="cursor:pointer;">'+
        '<div class="proj-title">'+
          '<div class="proj-nombre">'+(c.numero||'COT')+'</div>'+
          '<div class="proj-cliente">'+(c.cliente_nombre||'Sin cliente')+
            ' · Vigencia: '+(c.vigencia_dias||15)+' días</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:12px;">'+
          '<div style="font-size:16px;font-weight:700;color:var(--text-1);">'+fmt(c.total||0)+'</div>'+
          '<span style="padding:3px 10px;border-radius:5px;font-size:11px;font-weight:600;background:'+color+'22;color:'+color+';">'+label+'</span>'+
          '<button class="btn-sm" onclick="event.stopPropagation();editarCotizacion(\''+c.id+'\')" style="flex-shrink:0;">Editar</button>'+
        '</div>'+
      '</div>'+
      '<div style="padding:8px 1.25rem;display:flex;gap:16px;font-size:11px;color:var(--text-3);">'+
        '<span>Fecha: '+fmtDate(c.fecha)+'</span>'+
        (c.notas?'<span>'+esc(c.notas.slice(0,60))+'</span>':'')+
      '</div>'+
    '</div>';
  }).join('');
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

  // Header toggle
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;cursor:pointer;user-select:none;';
  hdr.innerHTML = '<span style="font-size:12px;font-weight:600;color:var(--text-3);">📦 Historial archivado (>90 días) — '+list.length+' cotizaci'+(list.length===1?'ón':'ones')+'</span>'+
    '<span id="hst-arrow" style="font-size:10px;color:var(--text-3);">'+(cotHistorialOpen?'▲':'▼')+'</span>';

  // Body
  var body = document.createElement('div');
  body.id = 'cot-historial-body';
  body.style.display = cotHistorialOpen ? 'block' : 'none';
  body.style.marginTop = '8px';
  body.innerHTML = list.map(function(c){
    var color = EST_COLORS[c.estatus]||'#475569';
    var label = EST_LABELS[c.estatus]||c.estatus;
    return '<div class="proj-card" style="cursor:pointer;opacity:.7;" onclick="verDetalleCotizacion(\''+c.id+'\')">'+
      '<div class="proj-hdr">'+
        '<div class="proj-title">'+
          '<div class="proj-nombre">'+esc(c.numero||'COT')+'</div>'+
          '<div class="proj-cliente">'+esc(c.cliente_nombre||'')+'</div>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:12px;">'+
          '<span style="font-size:15px;font-weight:600;color:var(--text-2);">'+fmt(c.total||0)+'</span>'+
          '<span style="padding:2px 8px;border-radius:5px;font-size:11px;background:'+color+'22;color:'+color+';">'+label+'</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  hdr.addEventListener('click', function(){
    cotHistorialOpen = !cotHistorialOpen;
    body.style.display = cotHistorialOpen ? 'block' : 'none';
    var arrow = document.getElementById('hst-arrow');
    if(arrow) arrow.textContent = cotHistorialOpen ? '▲' : '▼';
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
  document.getElementById('cot-cliente-id').value = '';
  document.getElementById('cot-cliente-search').value = '';
  document.getElementById('cot-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cot-vigencia').value = '15';
  document.getElementById('cot-notas').value = '';
  renderCotItemsForm();
  recalcCotTotal();
  document.getElementById('cot-modal').style.display = 'flex';
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
  document.getElementById('cot-cliente-id').value = c.cliente_id||'';
  document.getElementById('cot-cliente-search').value = c.cliente_nombre||'';
  document.getElementById('cot-fecha').value = c.fecha||'';
  document.getElementById('cot-vigencia').value = c.vigencia_dias||15;
  document.getElementById('cot-notas').value = c.notas||'';
  // Load items
  sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden').then(function(res){
    cotItemsTemp = res.data||[];
    renderCotItemsForm();
    recalcCotTotal();
  });
  document.getElementById('cot-modal').style.display = 'flex';
}

function cerrarCotModal(){
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
  if(!cotItemsTemp.length){
    el.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:12px 0;text-align:center;">Sin items. Agrega uno abajo.</div>';
    return;
  }
  el.innerHTML = cotItemsTemp.map(function(item){
    var tid = item._tempId||item.id;
    var isMaq = item.tipo==='maquinado';
    var isSvc = item.tipo==='servicio';
    return '<div style="background:var(--bg-card-2);border-radius:8px;padding:12px;margin-bottom:8px;border:0.5px solid var(--border);" id="cot-item-'+tid+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
        '<span style="font-size:10px;font-weight:600;color:#60a5fa;text-transform:uppercase;">'+
          (isMaq?'🔩 Maquinado':isSvc?'⚙️ Servicio':'📦 Producto')+
        '</span>'+
        '<button onclick="eliminarCotItem(\''+tid+'\')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;">×</button>'+
      '</div>'+
      '<div class="form-row">'+
        '<div class="form-group" style="flex:2;">'+
          '<label>Descripción *</label>'+
          '<input type="text" value="'+esc(item.descripcion||'')+'" oninput="updateCotItem(\''+tid+'\',\'descripcion\',this.value)" placeholder="'+(isMaq?'Nombre de pieza':isSvc?'Tipo de servicio':'Descripción')+'">'+
        '</div>'+
        (isMaq?'<div class="form-group"><label>Material</label><input type="text" value="'+esc(item.material||'')+'" oninput="updateCotItem(\''+tid+'\',\'material\',this.value)" placeholder="Acero, aluminio..."></div>':'')+
      '</div>'+
      '<div class="form-row">'+
        '<div class="form-group">'+
          '<label>'+(isSvc?'Horas':'Cantidad')+'</label>'+
          '<input type="number" value="'+(item.cantidad||1)+'" min="0.01" step="0.01" oninput="updateCotItem(\''+tid+'\',\'cantidad\',parseFloat(this.value)||0)">'+
        '</div>'+
        '<div class="form-group">'+
          '<label>Unidad</label>'+
          '<input type="text" value="'+esc(item.unidad||'pzas')+'" oninput="updateCotItem(\''+tid+'\',\'unidad\',this.value)">'+
        '</div>'+
        '<div class="form-group">'+
          '<label>Precio unitario ($)</label>'+
          '<input type="number" value="'+(item.precio_unitario||0)+'" min="0" step="0.01" oninput="updateCotItem(\''+tid+'\',\'precio_unitario\',parseFloat(this.value)||0)">'+
        '</div>'+
        '<div class="form-group">'+
          '<label>Subtotal</label>'+
          '<div id="sub-'+tid+'" style="padding:8px 10px;background:var(--bg-card);border-radius:8px;font-size:14px;font-weight:600;color:#34d399;">'+fmt((item.cantidad||0)*(item.precio_unitario||0))+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="form-group">'+
        '<label>Notas del item</label>'+
        '<input type="text" value="'+esc(item.notas||'')+'" oninput="updateCotItem(\''+tid+'\',\'notas\',this.value)" placeholder="Especificaciones adicionales...">'+
      '</div>'+
    '</div>';
  }).join('');
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
  dd.style.display='block';
  dd.innerHTML = matches.map(function(c){
    return '<div style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border);color:var(--text-1);" '+
      'onmousedown="selClienteCot(\''+c.id+'\',\''+esc(c.nombre)+'\')" '+
      'onmouseover="this.style.background=\'#1a2035\'" onmouseout="this.style.background=\'\'">'+
      '<span style="font-weight:500;">'+esc(c.nombre)+'</span>'+
      (c.rfc?'<span style="color:var(--text-3);font-size:11px;margin-left:6px;">'+esc(c.rfc)+'</span>':'')+
    '</div>';
  }).join('');
}

function selClienteCot(id, nombre){
  document.getElementById('cot-cliente-id').value = id;
  document.getElementById('cot-cliente-search').value = nombre;
  document.getElementById('cot-cliente-selected').textContent = '✓ '+nombre;
  document.getElementById('cot-cliente-selected').style.display = 'block';
  document.getElementById('cot-cliente-dropdown').style.display = 'none';
}

document.addEventListener('click',function(e){
  var dd=document.getElementById('cot-cliente-dropdown');
  if(dd&&!dd.contains(e.target)&&e.target.id!=='cot-cliente-search') dd.style.display='none';
});

// ── Guardar ───────────────────────────────────────────────
async function guardarCotizacion(){
  var clienteId = document.getElementById('cot-cliente-id').value||null;
  var sel = document.getElementById('cot-cliente-sel');
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
      cliente_id: clienteId,
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
    function(){cerrarDetail();editarCotizacion(id);}
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

    document.getElementById('detail-body').innerHTML = body;
  }catch(e){
    console.error('Detalle cotizacion:',e);
    document.getElementById('detail-body').innerHTML = '<div style="padding:16px;color:#f87171;">Error: '+esc(String(e.message||e))+'</div>';
  }
}

// ── Empresa config (editar aquí) ─────────────────────────
var EMPRESA_CONFIG = {
  nombre:    'Grupo M2',
  slogan:    'Maquinado Industrial de Precisión',
  direcciones: [
    'Querétaro: Blvd. Bernardo Quintana 123, Col. Centro, C.P. 76000',
    'Tampico: Av. Hidalgo 456, Col. Industrial, C.P. 89000'
  ],
  web:       'www.grupom2.mx',
  tel:       '+52 442 000 0000',
  email:     'contacto@grupom2.mx',
  banco:     'BBVA · CLABE: 012345678901234567 · Cuenta: 1234567890',
  legal:     'Precios en MXN + IVA. Vigencia según cotización. Pedido sujeto a confirmación por escrito. ' +
             'No incluye maniobras de carga/descarga salvo acuerdo. Pagos anticipados no son reembolsables.',
  logo:      null // se carga automáticamente desde el DOM
};

// ── PDF ───────────────────────────────────────────────────
async function generarPDFCotizacion(id){
  var c = cotizaciones.find(function(x){return x.id===id;});
  if(!c){showError('Cotización no encontrada');return;}

  var {data:items} = await sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden');
  items = items||[];

  // Get contacto of empresa
  var contactoNombre = '';
  if(c.cliente_id){
    try{
      var {data:conts} = await sb.from('contactos').select('nombre,apellido,cargo').eq('cliente_id',c.cliente_id).limit(1);
      if(conts&&conts[0]){
        var ct = conts[0];
        contactoNombre = (ct.nombre||'')+(ct.apellido?' '+ct.apellido:'')+(ct.cargo?' · '+ct.cargo:'');
      }
    }catch(e){}
  }

  try{
    var doc = new jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'letter'});
    var pw = doc.internal.pageSize.getWidth();  // 279
    var ph = doc.internal.pageSize.getHeight(); // 216

    // ── Header bar ───────────────────────────────────────
    doc.setFillColor(11,14,23);
    doc.rect(0,0,pw,38,'F');

    // Logo from DOM
    try{
      var imgEl = document.querySelector('.sidebar-logo img');
      if(imgEl && imgEl.src){
        doc.addImage(imgEl.src,'PNG',10,5,22,22);
      }
    }catch(e){}

    // Company name
    doc.setTextColor(255,255,255);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(EMPRESA_CONFIG.nombre, 38, 17);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(148,163,184);
    doc.text(EMPRESA_CONFIG.slogan, 38, 24);

    // Cotizacion number & date (right)
    doc.setTextColor(255,255,255);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(c.numero||'COTIZACIÓN', pw-12, 16, {align:'right'});
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(148,163,184);
    doc.text('Fecha: '+fmtDateFull(c.fecha), pw-12, 22, {align:'right'});
    doc.text('Vigencia: '+(c.vigencia_dias||15)+' días a partir de esta fecha', pw-12, 28, {align:'right'});

    var y = 48;

    // ── Client & contact info ─────────────────────────────
    doc.setFillColor(18,23,42);
    doc.roundedRect(10, y-4, 120, contactoNombre?22:16, 2, 2, 'F');
    doc.setTextColor(71,85,105);
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('DIRIGIDO A', 14, y+2);
    doc.setTextColor(226,232,240);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(c.cliente_nombre||'', 14, y+9);
    if(contactoNombre){
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.setTextColor(148,163,184);
      doc.text('Atención: '+contactoNombre, 14, y+16);
    }

    // ── Items table ───────────────────────────────────────
    y = contactoNombre ? 76 : 70;

    var tableData = items.map(function(item){
      return [
        {content: (item.descripcion||'')+(item.material?' Material: '+item.material:'')+(item.notas?' '+item.notas:''), styles:{fontSize:9}},
        item.tipo==='maquinado'?'Maquinado':item.tipo==='servicio'?'Servicio':'Producto',
        (item.cantidad||0)+' '+(item.unidad||''),
        fmt(item.precio_unitario||0),
        {content: fmt(item.subtotal||0), styles:{fontStyle:'bold', textColor:[52,211,153]}}
      ];
    });

    doc.autoTable({
      head:[['Descripción','Tipo','Cantidad','P. Unitario','Subtotal']],
      body: tableData,
      startY: y,
      margin:{left:10, right:10},
      styles:{fontSize:9, cellPadding:3, lineColor:[26,32,53], lineWidth:0.3},
      headStyles:{fillColor:[11,14,23], textColor:[148,163,184], fontStyle:'bold', fontSize:8},
      alternateRowStyles:{fillColor:[15,20,32]},
      bodyStyles:{fillColor:[18,23,42], textColor:[203,213,225]},
      columnStyles:{
        0:{cellWidth:'auto'},
        1:{cellWidth:28, halign:'center'},
        2:{cellWidth:28, halign:'center'},
        3:{cellWidth:30, halign:'right'},
        4:{cellWidth:35, halign:'right'}
      }
    });

    var finalY = doc.lastAutoTable.finalY + 6;

    // ── Totals (right side) ───────────────────────────────
    var tx = pw - 10;
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(100,116,139);
    doc.text('Subtotal:', tx - 35, finalY); doc.setTextColor(203,213,225); doc.text(fmt(c.subtotal||0), tx, finalY, {align:'right'});
    finalY += 6;
    doc.setTextColor(100,116,139);
    doc.text('IVA (16%):', tx - 35, finalY); doc.setTextColor(203,213,225); doc.text(fmt(c.iva||0), tx, finalY, {align:'right'});
    finalY += 7;
    doc.setFillColor(11,14,23);
    doc.roundedRect(tx-70, finalY-5, 70, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(52,211,153);
    doc.text('TOTAL:', tx - 35, finalY+2);
    doc.text(fmt(c.total||0), tx, finalY+2, {align:'right'});

    // ── Notes ─────────────────────────────────────────────
    if(c.notas){
      finalY += 14;
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139);
      doc.text('NOTAS:', 10, finalY);
      doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
      var notasLines = doc.splitTextToSize(c.notas, 160);
      doc.text(notasLines, 10, finalY+5);
      finalY += 5 + notasLines.length*4;
    }

    // ── Footer ────────────────────────────────────────────
    var footerY = ph - 30;
    doc.setFillColor(11,14,23);
    doc.rect(0, footerY, pw, 30, 'F');

    // Addresses
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    EMPRESA_CONFIG.direcciones.forEach(function(dir, i){
      doc.text('📍 '+dir, 10, footerY+7+(i*5));
    });

    // Contact info (center)
    var cx = pw/2;
    doc.setTextColor(148,163,184);
    doc.text('🌐 '+EMPRESA_CONFIG.web, cx, footerY+7, {align:'center'});
    doc.text('📞 '+EMPRESA_CONFIG.tel+'   ✉ '+EMPRESA_CONFIG.email, cx, footerY+12, {align:'center'});
    doc.text('🏦 '+EMPRESA_CONFIG.banco, cx, footerY+17, {align:'center'});

    // Legal
    doc.setTextColor(71,85,105); doc.setFontSize(6.5);
    var legalLines = doc.splitTextToSize(EMPRESA_CONFIG.legal, pw-20);
    doc.text(legalLines, pw/2, footerY+23, {align:'center'});

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

function renderKanban(){
  var el = document.getElementById('cot-kanban-wrap');
  var hoy = new Date();
  var hace90 = new Date(hoy); hace90.setDate(hace90.getDate()-90);

  var cols = KANBAN_COLS.map(function(col){
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

    var cardsHTML = cards.map(function(c){
      var dias = Math.floor((hoy - new Date(c.created_at||c.fecha)) / 864e5);
      return '<div class="kanban-card" onclick="verDetalleCotizacion(\''+c.id+'\')" draggable="true" '+
        'ondragstart="kanbanDragStart(event,\''+c.id+'\')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">'+
          '<span style="font-size:11px;font-weight:600;color:'+color+';">'+esc(c.numero||'COT')+'</span>'+
          '<span style="font-size:10px;color:var(--text-3);">'+dias+'d</span>'+
        '</div>'+
        '<div style="font-size:12px;font-weight:500;color:var(--text-1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.cliente_nombre||'Sin cliente')+'</div>'+
        '<div style="font-size:13px;font-weight:700;color:var(--text-1);">'+fmt(c.total||0)+'</div>'+
        (c.notas?'<div style="font-size:10px;color:var(--text-3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.notas)+'</div>':'')+
      '</div>';
    }).join('');

    return '<div class="kanban-col" ondragover="event.preventDefault()" ondrop="kanbanDrop(event,\''+col.key+'\')">'+
      '<div class="kanban-col-hdr" style="border-top:3px solid '+color+';">'+
        '<span>'+col.icon+' '+col.label+'</span>'+
        '<div style="display:flex;gap:8px;align-items:center;">'+
          '<span style="font-size:10px;color:var(--text-3);">'+fmt(total)+'</span>'+
          '<span style="font-size:10px;background:'+color+'22;color:'+color+';padding:2px 7px;border-radius:10px;">'+cards.length+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="kanban-cards" id="kcol-'+col.key+'">'+
        (cardsHTML||'<div style="color:var(--text-4);font-size:11px;text-align:center;padding:16px 0;">Sin cotizaciones</div>')+
      '</div>'+
    '</div>';
  }).join('');

  el.innerHTML = '<div class="kanban-board">'+cols+'</div>';
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
