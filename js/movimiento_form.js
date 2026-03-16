// ── Formulario estructurado de movimiento ─────────────────
function abrirFormMovimiento(tipo){
  tipoMovActual=tipo;
  etiquetaSeleccionada='';
  metodoPagoSeleccionado='';
  document.querySelectorAll('.etiq-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('#metodo-btns .etiq-btn').forEach(function(b){b.classList.remove('active');});

  var titles={venta:'Registrar venta',cobranza:'Registrar cobranza',gasto:'Registrar gasto'};
  document.getElementById('form-mvmt-title').textContent=titles[tipo]||'Registrar';

  // Mostrar/ocultar campos según tipo
  document.getElementById('campo-cliente').style.display=(tipo==='venta'||tipo==='cobranza')?'block':'none';
  document.getElementById('campo-proveedor').style.display=tipo==='gasto'?'block':'none';
  document.getElementById('campo-facturas-pendientes').style.display='none'; // se activa al elegir cliente en cobranza
  // campo-num-factura-cobr removed — replaced by searchable dropdown
  document.getElementById('campo-concepto').style.display=tipo!=='cobranza'?'block':'none';
  document.getElementById('campo-factura-mvmt').style.display=tipo==='venta'?'block':'none';
  document.getElementById('campo-metodo-pago').style.display=(tipo==='gasto'||tipo==='cobranza')?'block':'none';
  document.getElementById('campo-etiqueta').style.display=tipo==='gasto'?'block':'none';
  document.getElementById('campo-tc').style.display='none';

  // Reset campos
  document.getElementById('mvmt-monto').value='';
  document.getElementById('mvmt-concepto').value='';
  document.getElementById('mvmt-factura').value='';
  document.getElementById('factura-search-input').value='';
  var fsel=document.getElementById('factura-seleccionada');if(fsel)fsel.style.display='none';
  document.getElementById('mvmt-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('mvmt-moneda').value='MXN';
  document.getElementById('mvmt-tc').value='';
  limpiarCliente();
  limpiarProveedor();

  document.getElementById('form-mvmt-modal').style.display='flex';
  if(!clientes.length)loadClientes();
  if(!proveedores.length)loadProveedores();
}

function cerrarFormMovimiento(){
  document.getElementById('form-mvmt-modal').style.display='none';
}

// Búsqueda de cliente
function buscarCliente(q){
  var dd=document.getElementById('cliente-dropdown');
  if(!q.trim()){dd.style.display='none';return;}
  var ql=q.toLowerCase();
  var matches=clientes.filter(function(c){
    return c.nombre.toLowerCase().includes(ql)||(c.rfc&&c.rfc.toLowerCase().includes(ql));
  }).slice(0,6);
  if(!matches.length){
    dd.style.display='block';
    dd.innerHTML='<div style="padding:10px 12px;font-size:13px;color:#475569;">Sin resultados — <button onclick="abrirNuevoCliente(true)" class="btn-sm" style="display:inline;">+ crear empresa</button></div>';
    return;
  }
  dd.style.display='block';
  dd.innerHTML=matches.map(function(c){
    return '<div style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid #1a2035;color:#e2e8f0;" '+
      'onmousedown="seleccionarCliente('+JSON.stringify(c).replace(/"/g,'&quot;')+')" '+
      'onmouseover="this.style.background=\'#1a2035\'" onmouseout="this.style.background=\'\'">'+
      '<span style="font-weight:500;">'+esc(c.nombre)+'</span>'+
      (c.rfc?'<span style="color:#475569;font-size:11px;margin-left:6px;">'+esc(c.rfc)+'</span>':'')+
    '</div>';
  }).join('');
}

function seleccionarCliente(c){
  document.getElementById('mvmt-cliente-id').value=c.id;
  document.getElementById('mvmt-cliente-search').value='';
  document.getElementById('cliente-dropdown').style.display='none';
  var sel=document.getElementById('cliente-seleccionado');
  sel.style.display='flex';
  document.getElementById('cliente-sel-nombre').textContent=c.nombre+(c.ciudad?' · '+c.ciudad:'');
  // Si es cobranza, cargar facturas pendientes
  if(tipoMovActual==='cobranza')cargarFacturasPendientes(c.id);
}

function limpiarCliente(){
  document.getElementById('mvmt-cliente-id').value='';
  document.getElementById('mvmt-cliente-search').value='';
  document.getElementById('cliente-dropdown').style.display='none';
  document.getElementById('cliente-seleccionado').style.display='none';
}


function selMetodo(btn,metodo){
  metodoPagoSeleccionado=metodo;
  document.querySelectorAll('#metodo-btns .etiq-btn').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');
}

function toggleTipoCambio(moneda){
  document.getElementById('campo-tc').style.display=moneda==='USD'?'block':'none';
  document.getElementById('form-mvmt-title').textContent=
    document.getElementById('form-mvmt-title').textContent.replace(/ \(USD\)/,'').replace(/ \(MXN\)/,'') +
    (moneda==='USD'?' (USD)':'');
}

// Búsqueda de proveedor en formulario
function buscarProveedor(q){
  var dd=document.getElementById('prov-dropdown');
  if(!q.trim()){dd.style.display='none';return;}
  var ql=q.toLowerCase();
  var matches=proveedores.filter(function(p){
    return p.nombre.toLowerCase().includes(ql)||(p.rfc&&p.rfc.toLowerCase().includes(ql));
  }).slice(0,6);
  if(!matches.length){
    dd.style.display='block';
    dd.innerHTML='<div style="padding:10px 12px;font-size:13px;color:#888780;">Sin resultados — <button onclick="abrirNuevoProveedor()" class="btn-sm" style="display:inline;">+ crear proveedor</button></div>';
    return;
  }
  dd.style.display='block';
  dd.innerHTML=matches.map(function(p){
    return '<div style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid #1a2035;color:#e2e8f0;" '+
      'onmousedown="seleccionarProveedor('+JSON.stringify(p).replace(/"/g,'&quot;')+')" '+
      'onmouseover="this.style.background=\'#1a2035\'" onmouseout="this.style.background=\'\'">'+
      '<span style="font-weight:500;">'+esc(p.nombre)+'</span>'+
      (p.rfc?'<span style="color:#475569;font-size:11px;margin-left:6px;">'+esc(p.rfc)+'</span>':'')+
    '</div>';
  }).join('');
}

function seleccionarProveedor(p){
  document.getElementById('mvmt-prov-id').value=p.id;
  document.getElementById('mvmt-prov-search').value='';
  document.getElementById('prov-dropdown').style.display='none';
  var sel=document.getElementById('prov-seleccionado');
  sel.style.display='flex';
  document.getElementById('prov-sel-nombre').textContent=p.nombre+(p.ciudad?' · '+p.ciudad:'');
}

function limpiarProveedor(){
  document.getElementById('mvmt-prov-id').value='';
  document.getElementById('mvmt-prov-search').value='';
  document.getElementById('prov-dropdown').style.display='none';
  document.getElementById('prov-seleccionado').style.display='none';
}

// Facturas pendientes del cliente seleccionado (para cobranza)
var facturasPendientesCache=[];

async function cargarFacturasPendientes(clienteId){
  // Reset
  document.getElementById('factura-search-input').value='';
  document.getElementById('mvmt-factura-sel').value='';
  document.getElementById('factura-seleccionada').style.display='none';
  document.getElementById('facturas-dropdown').style.display='none';
  document.getElementById('campo-facturas-pendientes').style.display='none';
  facturasPendientesCache=[];
  if(!clienteId||tipoMovActual!=='cobranza')return;
  try{
    var {data}=await sb.from('movimientos_v2')
      .select('id,descripcion,monto,fecha,moneda,numero_factura,tipo_cambio,contraparte,rfc_contraparte')
      .eq('origen','sat_emitida').eq('conciliado',false)
      .eq('cliente_id',clienteId);
    var cliente=clientes.find(function(c){return c.id===clienteId;});
    if(cliente&&cliente.rfc){
      var {data:d2}=await sb.from('movimientos_v2')
        .select('id,descripcion,monto,fecha,moneda,numero_factura,tipo_cambio,contraparte,rfc_contraparte')
        .eq('origen','sat_emitida').eq('conciliado',false)
        .eq('rfc_contraparte',cliente.rfc);
      data=(data||[]).concat(d2||[]);
      var seen={}; data=data.filter(function(r){if(seen[r.id])return false;seen[r.id]=true;return true;});
    }
    if(data&&data.length){
      // Sort by folio then date
      data.sort(function(a,b){
        var fa=a.numero_factura||''; var fb=b.numero_factura||'';
        if(fa&&fb)return fa.localeCompare(fb);
        return new Date(b.fecha)-new Date(a.fecha);
      });
      facturasPendientesCache=data;
      document.getElementById('campo-facturas-pendientes').style.display='block';
      renderDropdownFacturas(data);
    }
  }catch(e){console.error('Facturas pendientes:',e);}
}

function renderDropdownFacturas(list){
  var dd=document.getElementById('facturas-dropdown');
  if(!list.length){
    dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:#475569;">Sin facturas pendientes</div>';
    return;
  }
  dd.innerHTML=list.map(function(f){
    var folio=f.numero_factura?'<span style="font-weight:600;color:#60a5fa;">'+esc(f.numero_factura)+'</span> · ':'';
    var desc=(f.descripcion||f.contraparte||'').slice(0,40);
    var monto='<span style="color:#34d399;float:right;">'+fmt(parseFloat(f.monto)||0)+'</span>';
    return '<div onclick="elegirFactura(\''+f.id+'\')" data-id="'+f.id+'" '+
      'style="padding:9px 12px;cursor:pointer;border-bottom:0.5px solid #1a2035;font-size:12px;color:#e2e8f0;" '+
      'onmouseover="this.style.background=\'#1a2035\'" onmouseout="this.style.background=\'\'">'+ 
      '<div>'+folio+esc(desc)+monto+'</div>'+
      '<div style="font-size:10px;color:#475569;margin-top:2px;">'+fmtDate(f.fecha)+'</div>'+
    '</div>';
  }).join('');
}

function filtrarFacturasPendientes(q){
  var dd=document.getElementById('facturas-dropdown');
  dd.style.display='block';
  if(!q){renderDropdownFacturas(facturasPendientesCache);return;}
  var ql=q.toLowerCase();
  var filtered=facturasPendientesCache.filter(function(f){
    return (f.numero_factura||'').toLowerCase().includes(ql)||
           (f.descripcion||'').toLowerCase().includes(ql)||
           String(f.monto).includes(ql)||
           (f.contraparte||'').toLowerCase().includes(ql);
  });
  renderDropdownFacturas(filtered);
}

function mostrarDropdownFacturas(){
  var dd=document.getElementById('facturas-dropdown');
  dd.style.display='block';
  renderDropdownFacturas(facturasPendientesCache);
}

function elegirFactura(id){
  var f=facturasPendientesCache.find(function(x){return x.id===id;});
  if(!f)return;
  document.getElementById('mvmt-factura-sel').value=id;
  document.getElementById('facturas-dropdown').style.display='none';
  var folio=f.numero_factura?f.numero_factura+' · ':'';
  var desc=(f.descripcion||f.contraparte||'').slice(0,40);
  var sel=document.getElementById('factura-seleccionada');
  sel.textContent='✓ '+folio+desc+' · '+fmt(parseFloat(f.monto)||0);
  sel.style.display='block';
  document.getElementById('factura-search-input').value=folio+(f.descripcion||'').slice(0,30);
  // Autocompletar monto
  document.getElementById('mvmt-monto').value=f.monto;
  if(f.moneda&&f.moneda!=='MXN'){
    document.getElementById('mvmt-moneda').value=f.moneda;
    toggleTipoCambio(f.moneda);
    if(f.tipo_cambio)document.getElementById('mvmt-tc').value=f.tipo_cambio;
  }
}

// Close dropdown on click outside
document.addEventListener('click',function(e){
  var dd=document.getElementById('facturas-dropdown');
  if(dd&&!dd.contains(e.target)&&e.target.id!=='factura-search-input')dd.style.display='none';
});

async function guardarFormMovimiento(){
  var userName=getUserName();
  if(!userName){
    var n=prompt('¿Cuál es tu nombre?');
    if(!n||!n.trim())return;
    saveName(n.trim());
    document.getElementById('user-name-input').value=n.trim();
    userName=n.trim();
  }

  var monto=parseFloat(document.getElementById('mvmt-monto').value)||0;
  if(!monto){alert('El monto es obligatorio.');return;}

  var moneda=document.getElementById('mvmt-moneda').value||'MXN';
  var tc=parseFloat(document.getElementById('mvmt-tc').value)||1;
  var montoMXN=moneda==='USD'?Math.round(monto*tc*100)/100:monto;

  if(tipoMovActual==='venta'&&!document.getElementById('mvmt-cliente-id').value){
    alert('Selecciona un cliente.');return;
  }
  if(tipoMovActual!=='cobranza'&&!document.getElementById('mvmt-concepto').value.trim()){
    alert('El concepto es obligatorio.');return;
  }

  var clienteId=document.getElementById('mvmt-cliente-id').value;
  var provId=document.getElementById('mvmt-prov-id').value;
  var cliente=clienteId?clientes.find(function(c){return c.id===clienteId;}):null;
  var prov=provId?proveedores.find(function(p){return p.id===provId;}):null;
  var concepto=document.getElementById('mvmt-concepto').value.trim();
  var factura=document.getElementById('mvmt-factura').value.trim();
  var facturaVinculadaId=document.getElementById('mvmt-factura-sel').value||null;
  var fecha=document.getElementById('mvmt-fecha').value||new Date().toISOString().split('T')[0];
  var fechaBase=new Date(fecha+'T12:00');
  var contraparte=cliente?cliente.nombre:(prov?prov.nombre:'');

  var descripcion='';
  if(tipoMovActual==='venta')descripcion='Venta'+(concepto?' · '+concepto:'')+(cliente?' → '+cliente.nombre:'');
  else if(tipoMovActual==='cobranza')descripcion='Cobranza'+(cliente?' de '+cliente.nombre:'');
  else if(tipoMovActual==='gasto')descripcion=concepto+(prov?' — '+prov.nombre:'');

  var mv={
    id:Date.now().toString()+Math.random().toString(36).slice(2,7),
    fecha:fecha, descripcion:descripcion, contraparte:contraparte,
    monto:montoMXN,
    tipo:(tipoMovActual==='cobranza'||tipoMovActual==='venta')?'ingreso':'egreso',
    categoria:tipoMovActual, origen:'manual',
    moneda:moneda, tipo_cambio:moneda==='USD'?tc:1,
    cliente_id:clienteId||null, proveedor_id:provId||null,
    factura_vinculada_id:facturaVinculadaId||null,
    numero_factura:(document.getElementById('mvmt-factura').value.trim())||null,
    metodo_pago:metodoPagoSeleccionado||null,
    etiqueta:(tipoMovActual==='gasto'&&etiquetaSeleccionada)?etiquetaSeleccionada:null,
    year:fechaBase.getFullYear(), month:fechaBase.getMonth()+1, usuario:userName
  };

  var dup=findDuplicate(montoMXN,fecha,tipoMovActual);
  if(dup){
    var ok=confirm('⚠️ Posible duplicado:\n"'+dup.descripcion.slice(0,60)+'"\n$'+Math.round(dup.monto).toLocaleString('es-MX')+' · '+fmtDate(dup.fecha)+'\n\n¿Es diferente?');
    if(!ok)return;
  }

  var btn=document.getElementById('btn-save-mvmt');
  btn.disabled=true; btn.textContent='Guardando...';
  try{
    await insertMovement(mv);
    if(facturaVinculadaId&&tipoMovActual==='cobranza'){
      await sb.from('movimientos_v2').update({conciliado:true,movimiento_relacionado_id:mv.id}).eq('id',facturaVinculadaId);
    }
    cerrarFormMovimiento();
    etiquetaSeleccionada=''; metodoPagoSeleccionado='';
    var resumen=fmt(montoMXN)+(moneda==='USD'?' (USD '+monto+' × '+tc+')':'');
    showStatus('✓ '+CAT_LABELS[tipoMovActual]+' · '+resumen);
    await loadMovements();
  }catch(e){
    showError('Error al guardar: '+e.message);
  }finally{
    btn.disabled=false; btn.textContent='Guardar';
  }
}



// ── deleteMovement ───────────────────────────────────────
async function deleteMovement(id, usuario){
  var me=getUserName();
  if(usuario&&me&&usuario!==me){
    if(!confirm('Este movimiento fue registrado por "'+usuario+'". ¿Seguro que lo quieres eliminar?'))return;
  }
  try{await deleteRow(id);await loadMovements();}
  catch(e){showError('No se pudo eliminar: '+e.message);}
}

// ── Etiqueta helpers ─────────────────────────────────────
