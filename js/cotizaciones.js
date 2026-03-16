// ── Cotizaciones ──────────────────────────────────────────
var cotizaciones = [], allCotizaciones = [];
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
  var filtered = allCotizaciones.filter(function(c){
    if(estatus && c.estatus !== estatus) return false;
    if(!ql) return true;
    return (c.numero||'').toLowerCase().includes(ql) ||
           (c.cliente_nombre||'').toLowerCase().includes(ql);
  });
  renderCotizacionesList(filtered);
}

var EST_LABELS = {borrador:'Borrador', enviada:'Enviada', cerrada:'Cerrada ✓', perdida:'Perdida'};
var EST_COLORS = {borrador:'#475569', enviada:'#60a5fa', cerrada:'#34d399', perdida:'#f87171'};

function renderCotizacionesList(list){
  var el = document.getElementById('cotizaciones-list');
  var ct = document.getElementById('cot-count');
  if(ct) ct.textContent = list.length + ' cotizaci' + (list.length===1?'ón':'ones');
  if(!list.length){
    el.innerHTML = '<div class="empty-state">Sin cotizaciones. Crea la primera con el botón de arriba.</div>';
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
          '<div style="font-size:16px;font-weight:700;color:#e2e8f0;">'+fmt(c.total||0)+'</div>'+
          '<span style="padding:3px 10px;border-radius:5px;font-size:11px;font-weight:600;background:'+color+'22;color:'+color+';">'+label+'</span>'+
          '<button class="btn-sm" onclick="event.stopPropagation();editarCotizacion(\''+c.id+'\')" style="flex-shrink:0;">Editar</button>'+
        '</div>'+
      '</div>'+
      '<div style="padding:8px 1.25rem;display:flex;gap:16px;font-size:11px;color:#475569;">'+
        '<span>Fecha: '+fmtDate(c.fecha)+'</span>'+
        (c.notas?'<span>'+esc(c.notas.slice(0,60))+'</span>':'')+
      '</div>'+
    '</div>';
  }).join('');
}

// ── Form ──────────────────────────────────────────────────
function abrirNuevaCotizacion(){
  cotEditId = null;
  cotItemsTemp = [];
  document.getElementById('cot-id-edit').value = '';
  document.getElementById('cot-modal-title').textContent = 'Nueva cotización';
  document.getElementById('cot-cliente-search').value = '';
  document.getElementById('cot-cliente-id').value = '';
  document.getElementById('cot-cliente-selected').style.display = 'none';
  document.getElementById('cot-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cot-vigencia').value = '15';
  document.getElementById('cot-notas').value = '';
  renderCotItemsForm();
  recalcCotTotal();
  document.getElementById('cot-modal').style.display = 'block';
  if(!clientes.length) loadClientes();
}

function editarCotizacion(id){
  var c = cotizaciones.find(function(x){return x.id===id;});
  if(!c) return;
  cotEditId = id;
  document.getElementById('cot-id-edit').value = id;
  document.getElementById('cot-modal-title').textContent = 'Editar cotización';
  document.getElementById('cot-cliente-search').value = c.cliente_nombre||'';
  document.getElementById('cot-cliente-id').value = c.cliente_id||'';
  if(c.cliente_nombre){
    document.getElementById('cot-cliente-selected').textContent = '✓ '+c.cliente_nombre;
    document.getElementById('cot-cliente-selected').style.display = 'block';
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
  document.getElementById('cot-modal').style.display = 'block';
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
  cotItemsTemp = cotItemsTemp.filter(function(i){return (i._tempId||i.id) != tempId;});
  renderCotItemsForm();
  recalcCotTotal();
}

function renderCotItemsForm(){
  var el = document.getElementById('cot-items-list');
  if(!cotItemsTemp.length){
    el.innerHTML = '<div style="color:#475569;font-size:12px;padding:12px 0;text-align:center;">Sin items. Agrega uno abajo.</div>';
    return;
  }
  el.innerHTML = cotItemsTemp.map(function(item){
    var tid = item._tempId||item.id;
    var isMaq = item.tipo==='maquinado';
    var isSvc = item.tipo==='servicio';
    return '<div style="background:#12172a;border-radius:8px;padding:12px;margin-bottom:8px;border:0.5px solid #1a2035;" id="cot-item-'+tid+'">'+
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
          '<div id="sub-'+tid+'" style="padding:8px 10px;background:#0b0e17;border-radius:8px;font-size:14px;font-weight:600;color:#34d399;">'+fmt((item.cantidad||0)*(item.precio_unitario||0))+'</div>'+
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
  var item = cotItemsTemp.find(function(i){return (i._tempId||i.id)==tempId;});
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
    return '<div style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid #1a2035;color:#e2e8f0;" '+
      'onmousedown="selClienteCot(\''+c.id+'\',\''+esc(c.nombre)+'\')" '+
      'onmouseover="this.style.background=\'#1a2035\'" onmouseout="this.style.background=\'\'">'+
      '<span style="font-weight:500;">'+esc(c.nombre)+'</span>'+
      (c.rfc?'<span style="color:#475569;font-size:11px;margin-left:6px;">'+esc(c.rfc)+'</span>':'')+
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
  var clienteNombre = document.getElementById('cot-cliente-search').value.trim();
  if(!clienteNombre){showError('Selecciona o escribe un cliente.'); return;}
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
    loadCotizaciones();
    showStatus('✓ Cotización guardada');
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
      loadCotizaciones();
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

  // Build project name from items
  var piezas = items.filter(function(i){return i.tipo==='maquinado';});
  var totalPiezas = piezas.reduce(function(a,i){return a+(parseFloat(i.cantidad)||0);},0);
  var tipoPieza = piezas.length?piezas[0].descripcion:'';

  // Show confirmation modal
  document.getElementById('conv-cot-id').value = cotId;
  document.getElementById('conv-cliente').textContent = cot.cliente_nombre||'';
  document.getElementById('conv-monto').textContent = fmt(cot.total||0);
  document.getElementById('conv-pedido').value = cot.numero||'';
  document.getElementById('conv-tipo-pieza').value = tipoPieza;
  document.getElementById('conv-piezas').value = Math.round(totalPiezas)||0;
  document.getElementById('conv-fecha-entrega').value = '';
  var fechaMin = new Date(); fechaMin.setDate(fechaMin.getDate()+7);
  document.getElementById('conv-fecha-entrega').min = fechaMin.toISOString().split('T')[0];
  document.getElementById('conv-modal').style.display = 'block';
}

async function confirmarConversion(){
  var cotId = document.getElementById('conv-cot-id').value;
  var cot = cotizaciones.find(function(c){return c.id===cotId;});
  if(!cot) return;

  var nombrePedido = document.getElementById('conv-pedido').value.trim();
  var tipoPieza = document.getElementById('conv-tipo-pieza').value.trim();
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
      cotizacion_id: cotId
    };

    var {data:proj,error:pe} = await sb.from('proyectos').insert([proyData]).select().single();
    if(pe)throw pe;

    // Link cotizacion to proyecto
    await sb.from('cotizaciones').update({proyecto_id:proj.id, estatus:'cerrada'}).eq('id',cotId);

    document.getElementById('conv-modal').style.display='none';
    cerrarDetail();
    loadCotizaciones();
    showStatus('✓ Proyecto creado: '+nombrePedido);

    // Offer to go to project
    setTimeout(function(){
      if(confirm('¿Ver el proyecto creado?')){
        switchTab('proyectos', document.getElementById('sb-proyectos'));
      }
    },500);
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
    '<div style="padding:16px;color:#475569;font-size:12px;">Cargando...</div>',
    function(){cerrarDetail();editarCotizacion(id);}
  );

  try{
    var {data:items} = await sb.from('cotizacion_items').select('*').eq('cotizacion_id',id).order('orden');
    items = items||[];

    var acciones = '';
    if(c.estatus==='borrador'||c.estatus==='enviada'){
      acciones =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
          (c.estatus==='borrador'?'<button class="btn-primary" onclick="cambiarEstatusCot(\''+id+'\',\'enviada\')">Marcar enviada</button>':'')+
          '<button class="btn-primary" style="background:#34d399;color:#0b0e17;" onclick="cambiarEstatusCot(\''+id+'\',\'cerrada\')">✓ Cerrar (ganada)</button>'+
          '<button class="btn-sm" style="color:#f87171;" onclick="marcarPerdida(\''+id+'\')">Marcar perdida</button>'+
          '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        '</div>';
    } else if(c.estatus==='cerrada'){
      acciones = '<div style="display:flex;gap:8px;">'+
        '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        (c.proyecto_id?'<button class="btn-sm" onclick="cerrarDetail();switchTab(\'proyectos\',document.getElementById(\'sb-proyectos\'))">Ver proyecto →</button>':'')+
      '</div>';
    } else {
      acciones = '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>';
    }

    var itemsHTML = items.map(function(item){
      var isMaq=item.tipo==='maquinado', isSvc=item.tipo==='servicio';
      return '<tr>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid #1a2035;color:#e2e8f0;">'+
          '<div style="font-weight:500;">'+esc(item.descripcion||'')+'</div>'+
          (item.material?'<div style="font-size:11px;color:#475569;">Material: '+esc(item.material)+'</div>':'')+
          (item.notas?'<div style="font-size:11px;color:#475569;">'+esc(item.notas)+'</div>':'')+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid #1a2035;color:#94a3b8;text-align:center;">'+
          '<span style="font-size:10px;background:'+(isMaq?'#1a2035':isSvc?'#0d1f3c':'#12172a')+';color:'+(isMaq?'#60a5fa':isSvc?'#a78bfa':'#94a3b8')+';padding:2px 6px;border-radius:4px;">'+
          (isMaq?'Maquinado':isSvc?'Servicio':'Producto')+'</span>'+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid #1a2035;color:#e2e8f0;text-align:right;">'+(item.cantidad||0)+' '+(item.unidad||'')+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid #1a2035;color:#94a3b8;text-align:right;">'+fmt(item.precio_unitario||0)+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid #1a2035;color:#34d399;font-weight:600;text-align:right;">'+fmt(item.subtotal||0)+'</td>'+
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
        '<div class="detail-kpi"><div class="detail-kpi-label">Subtotal</div><div class="detail-kpi-value" style="font-size:16px;color:#e2e8f0;">'+fmt(c.subtotal||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">IVA (16%)</div><div class="detail-kpi-value" style="font-size:16px;color:#94a3b8;">'+fmt(c.iva||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Total</div><div class="detail-kpi-value c-green">'+fmt(c.total||0)+'</div></div>'+
      '</div></div>'+
      // Info
      '<div class="detail-section"><div class="detail-grid">'+
        '<div class="detail-field"><div class="detail-field-label">Fecha</div><div class="detail-field-value">'+fmtDateFull(c.fecha)+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Vigencia</div><div class="detail-field-value">'+(c.vigencia_dias||15)+' días</div></div>'+
        (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:#94a3b8;">'+esc(c.notas)+'</div></div>':'')+
      '</div></div>'+
      // Items table
      '<div class="detail-section">'+
        '<div class="detail-section-title">Items ('+items.length+')</div>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
          '<thead><tr>'+
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;border-bottom:0.5px solid #1a2035;">Descripción</th>'+
            '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;border-bottom:0.5px solid #1a2035;">Tipo</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;border-bottom:0.5px solid #1a2035;">Cant.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;border-bottom:0.5px solid #1a2035;">P.U.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;border-bottom:0.5px solid #1a2035;">Subtotal</th>'+
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
