// ── Facturas module ───────────────────────────────────────
var allFacturas = [];
var facturasTipo = 'emitidas'; // emitidas | recibidas | conciliadas | complementos
var facturasYearFilter = new Date().getFullYear();

// ── Load ─────────────────────────────────────────────────
async function loadFacturas(){
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

function renderFacturasList(list){
  var el = document.getElementById('fact-list');
  if(!list.length){
    el.innerHTML='<div class="empty-state">Sin facturas en esta categoría</div>';
    return;
  }
  var hoy = new Date();
  el.innerHTML = '<table class="sat-table"><thead><tr>'+
    '<th>'+(facturasTipo==='recibidas'||facturasTipo==='complementos'?'Proveedor':'Cliente')+'</th>'+
    '<th>Folio</th><th>Fecha</th><th>Método</th><th>Proyecto</th><th style="text-align:right;">Total</th><th>Estatus</th>'+
    '</tr></thead><tbody>'+
    list.map(function(f){
      var dias = f.fecha?Math.floor((hoy-new Date(f.fecha))/(864e5)):0;
      var semColor = dias>60?'#dc2626':dias>30?'#d97706':'#16a34a';
      var nombre = f.tipo==='emitida'?(f.receptor_nombre||f.receptor_rfc||'—'):(f.emisor_nombre||f.emisor_rfc||'—');
      var estBg = f.conciliado?'#dbeafe':f.estatus==='cancelada'?'#fee2e2':'#dcfce7';
      var estColor = f.conciliado?'#1d4ed8':f.estatus==='cancelada'?'#dc2626':'#16a34a';
      var estLabel = f.conciliado?'Pagada':f.estatus==='cancelada'?'Cancelada':'Vigente';
      var metodoBg = f.metodo_pago==='PPD'?'#fef3c7':'#f1f5f9';
      var metodoColor = f.metodo_pago==='PPD'?'#d97706':'#64748b';
      return '<tr style="cursor:pointer;" onclick="verDetalleFactura(\''+f.id+'\')">'+
        '<td><div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc(nombre.slice(0,35))+'</div>'+
          (f.concepto?'<div style="font-size:10px;color:var(--text-3);">'+esc(f.concepto.slice(0,35))+'</div>':'')+
        '</td>'+
        '<td class="muted">'+(f.sin_factura?'<span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#fef3c7;color:#d97706;">VTA</span> '+(f.numero_vta||'—'):(f.numero_factura||'—'))+'</td>'+
        '<td class="muted">'+fmtDate(f.fecha||'')+(f.fecha&&dias>0?' <span style="color:'+semColor+';font-size:10px;">'+dias+'d</span>':'')+'</td>'+
        '<td><span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:500;background:'+metodoBg+';color:'+metodoColor+';">'+(f.metodo_pago||'PUE')+'</span></td>'+
        '<td class="muted" style="font-size:11px;">'+(f.proyecto_id?'<span style="color:#3B82F6;">Vinculado</span>':'—')+'</td>'+
        '<td class="monto" style="color:'+(f.tipo==='emitida'?'#16a34a':'#dc2626')+';">'+fmt(parseFloat(f.total)||0)+'</td>'+
        '<td><span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;background:'+estBg+';color:'+estColor+';">'+estLabel+'</span></td>'+
      '</tr>';
    }).join('')+
    '</tbody></table>';
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
  onFactTipoChange('emitida');
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
  onFactTipoChange(f.tipo||'emitida');
  initFactACs();
  // Pre-fill autocompletes
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

function onFactTipoChange(tipo){
  document.getElementById('fact-campo-cliente').style.display=tipo==='emitida'?'block':'none';
  document.getElementById('fact-campo-proveedor').style.display=tipo==='recibida'?'block':'none';
}

function calcFactIva(){
  var sub=parseFloat(document.getElementById('fact-subtotal').value)||0;
  var iva=Math.round(sub*0.16*100)/100;
  document.getElementById('fact-iva').value=iva||'';
  document.getElementById('fact-total').value=Math.round((sub+iva)*100)/100||'';
}

function initFactACs(){
  if(!clientes.length)loadClientes();
  if(!proveedores.length)loadProveedores();
  if(!allProyectos.length)loadProyectos();

  makeAutocomplete('fact-cliente-search','fact-cliente-id','fact-cliente-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},null);
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
    concepto:document.getElementById('fact-concepto').value.trim()||null,
    notas:document.getElementById('fact-notas').value.trim()||null,
    cliente_id:clienteId,
    proveedor_id:provId,
    proyecto_id:projId||null,
    receptor_nombre:cli?cli.nombre:null,
    receptor_rfc:cli?cli.rfc:null,
    emisor_nombre:prov?prov.nombre:null,
    emisor_rfc:prov?prov.rfc:null,
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

