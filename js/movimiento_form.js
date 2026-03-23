// ── Formulario estructurado de movimiento ─────────────────
// ── Venta factura toggle ─────────────────────────────────
// [T7] _requiereFactura → M2State alias en config.js
var _editMovId = null;

function setRequiereFactura(val){
  _requiereFactura = val;
  document.getElementById('btn-con-factura').classList.toggle('active', val);
  document.getElementById('btn-sin-factura').classList.toggle('active', !val);
  document.getElementById('campos-con-factura').style.display = val?'block':'none';
  document.getElementById('campos-sin-factura').style.display = val?'none':'block';
  // Si sin factura → auto-set cliente a Público General
  if(!val){
    var pg = clientes.find(function(c){return c.id==='cli_publico_general';});
    if(pg){
      document.getElementById('mvmt-cliente-id').value = pg.id;
      document.getElementById('mvmt-cliente-search').value = pg.nombre;
      document.getElementById('cliente-seleccionado').style.display='flex';
      document.getElementById('cliente-sel-nombre').textContent=pg.nombre;
    }
  }
}

function abrirFormMovimiento(tipo){
  _editMovId = null;
  tipoMovActual=tipo;
  etiquetaSeleccionada='';
  metodoPagoSeleccionado='';
  // Reset edit-only UI
  var lockEl=document.getElementById('mvmt-tipo-lock'); if(lockEl) lockEl.style.display='none';
  var delBtn=document.getElementById('btn-cancelar-pago'); if(delBtn) delBtn.style.display='none';
  var saveBtn=document.getElementById('btn-save-mvmt'); if(saveBtn) saveBtn.textContent='Guardar';
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

  // Reset factura toggle for venta
  if(tipo==='venta'){
    _requiereFactura=true;
    setTimeout(function(){
      var bcf=document.getElementById('btn-con-factura');
      var bsf=document.getElementById('btn-sin-factura');
      if(bcf)bcf.classList.add('active');
      if(bsf)bsf.classList.remove('active');
      var ccf=document.getElementById('campos-con-factura');
      var csf=document.getElementById('campos-sin-factura');
      if(ccf)ccf.style.display='block';
      if(csf)csf.style.display='none';
    },0);
  }
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
    dd.innerHTML='<div class="ac-item"><span class="ac-item-name" style="color:var(--text-3);">Sin resultados</span><span class="ac-item-sub"><button onclick="abrirNuevoCliente(true)" class="btn-sm">+ crear empresa</button></span></div>';
    return;
  }
  dd.style.display='block';
  dd.innerHTML=matches.map(function(c){
    return '<div class="ac-item" onmousedown="seleccionarCliente('+JSON.stringify(c).replace(/"/g,'&quot;')+')">' +
      '<span class="ac-item-name">'+esc(c.nombre)+'</span>'+
      (c.rfc?'<span class="ac-item-sub">'+esc(c.rfc)+'</span>':'')+
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
    return '<div class="ac-item" onmousedown="seleccionarProveedor('+JSON.stringify(p).replace(/"/g,'&quot;')+')">' +
      '<span class="ac-item-name">'+esc(p.nombre)+'</span>'+
      (p.rfc?'<span class="ac-item-sub">'+esc(p.rfc)+'</span>':'')+
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
// [T7] facturasPendientesCache → M2State alias en config.js

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
    // ── Editar movimiento existente ───────────────────────
    if(_editMovId){
      var updObj={
        fecha:fecha, descripcion:descripcion, contraparte:contraparte,
        monto:montoMXN, cliente_id:clienteId||null, proveedor_id:provId||null,
        moneda:moneda, tipo_cambio:moneda==='USD'?tc:1,
        metodo_pago:metodoPagoSeleccionado||null,
        etiqueta:(tipoMovActual==='gasto'&&etiquetaSeleccionada)?etiquetaSeleccionada:null,
        year:fechaBase.getFullYear(), month:fechaBase.getMonth()+1
      };
      var {error:ue}=await sb.from('movimientos_v2').update(updObj).eq('id',_editMovId);
      if(ue) throw ue;
      cerrarFormMovimiento();
      showStatus('Movimiento actualizado');
      await loadMovements();
      return;
    }
    if(tipoMovActual==='venta'){
      // P1-a: venta → escribe en facturas, no en movimientos_v2
      var sinFact=!_requiereFactura;
      var fechaD=new Date(fecha+'T12:00');
      var subTotal, ivaAmt;
      if(sinFact){
        subTotal=montoMXN; ivaAmt=0;
      } else {
        subTotal=Math.round(montoMXN/1.16*100)/100;
        ivaAmt=Math.round((montoMXN-subTotal)*100)/100;
      }
      var numeroVta=null;
      if(sinFact){
        var {count}=await sb.from('facturas').select('*',{count:'exact',head:true})
          .ilike('numero_vta','VTA-'+fechaD.getFullYear()+'-%');
        numeroVta='VTA-'+fechaD.getFullYear()+'-'+String((count||0)+1).padStart(3,'0');
      }
      var factRow={
        tipo:'emitida', fecha:fecha,
        numero_factura:sinFact?null:(factura||null),
        numero_vta:numeroVta,
        subtotal:subTotal, iva:ivaAmt, total:montoMXN,
        metodo_pago:metodoPagoSeleccionado||'PUE',
        concepto:concepto||null,
        cliente_id:clienteId||null,
        receptor_nombre:cliente?cliente.nombre:null,
        receptor_rfc:cliente?cliente.rfc:null,
        sin_factura:sinFact,
        estatus:'vigente',
        conciliado:sinFact, // venta directa: cobrada inmediata
        complemento_requerido:!sinFact&&metodoPagoSeleccionado==='PPD',
        origen:'manual',
        year:fechaD.getFullYear(), month:fechaD.getMonth()+1
      };
      var {error:fe}=await sb.from('facturas').insert([factRow]);
      if(fe)throw fe;
    } else {
      // Cobranza y gasto siguen en movimientos_v2
      await insertMovement(mv);
      if(facturaVinculadaId&&tipoMovActual==='cobranza'){
        await sb.from('movimientos_v2').update({conciliado:true,movimiento_relacionado_id:mv.id}).eq('id',facturaVinculadaId);
      }
    }
    cerrarFormMovimiento();
    etiquetaSeleccionada=''; metodoPagoSeleccionado='';
    var resumen=fmt(montoMXN)+(moneda==='USD'?' (USD '+monto+' × '+tc+')':'');
    showStatus('✓ '+CAT_LABELS[tipoMovActual]+' · '+resumen);
    await loadMovements();
    // Ofrecer conciliación con factura si no ya se vinculó
    if(tipoMovActual!=='venta' && !facturaVinculadaId){
      _ofrecerConciliacionManual(mv.id, montoMXN, tipoMovActual==='cobranza');
    }
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

// ── Editar / eliminar movimiento manual ──────────────────
function editarMovimiento(id){
  var m = movements.find(function(x){return x.id===id;});
  if(!m) return;
  var tipo = (m.tipo==='ingreso'||m.categoria==='cobranza') ? 'cobranza' : 'gasto';
  abrirFormMovimiento(tipo);
  _editMovId = id;
  document.getElementById('form-mvmt-title').textContent = tipo==='cobranza' ? 'Editar cobranza' : 'Editar gasto';
  var saveBtn=document.getElementById('btn-save-mvmt'); if(saveBtn) saveBtn.textContent='Guardar cambios';
  var lockEl=document.getElementById('mvmt-tipo-lock'); if(lockEl) lockEl.style.display='block';
  var lockLbl=document.getElementById('mvmt-tipo-lock-label'); if(lockLbl) lockLbl.textContent=tipo==='cobranza'?'Cobranza':'Gasto';
  var delBtn=document.getElementById('btn-cancelar-pago'); if(delBtn) delBtn.style.display='inline-flex';
  setTimeout(function(){
    document.getElementById('mvmt-monto').value = m.monto||'';
    document.getElementById('mvmt-concepto').value = m.descripcion||'';
    document.getElementById('mvmt-fecha').value = m.fecha||'';
    if(m.moneda) document.getElementById('mvmt-moneda').value = m.moneda;
    if(m.moneda==='USD'&&m.tipo_cambio){ document.getElementById('mvmt-tc').value=m.tipo_cambio; toggleTipoCambio('USD'); }
    if(m.metodo_pago){
      metodoPagoSeleccionado=m.metodo_pago;
      document.querySelectorAll('#metodo-btns .etiq-btn').forEach(function(b){ b.classList.toggle('active',b.textContent===m.metodo_pago); });
    }
    if(m.etiqueta){
      etiquetaSeleccionada=m.etiqueta;
      document.querySelectorAll('.etiq-btn').forEach(function(b){ if(b.textContent===m.etiqueta) b.classList.add('active'); });
    }
    if(tipo==='cobranza'&&m.cliente_id){
      var cli=clientes.find(function(c){return c.id===m.cliente_id;});
      if(cli){
        document.getElementById('mvmt-cliente-id').value=cli.id;
        document.getElementById('cliente-seleccionado').style.display='flex';
        document.getElementById('cliente-sel-nombre').textContent=cli.nombre;
      }
    }
    if(tipo==='gasto'&&m.proveedor_id){
      var prov2=proveedores.find(function(p){return p.id===m.proveedor_id;});
      if(prov2){
        document.getElementById('mvmt-prov-id').value=prov2.id;
        document.getElementById('prov-seleccionado').style.display='flex';
        document.getElementById('prov-sel-nombre').textContent=prov2.nombre;
      }
    }
  }, 30);
}

async function cancelarPagoManual(){
  if(!_editMovId) return;
  if(!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;
  var id=_editMovId;
  cerrarFormMovimiento();
  try{
    await deleteRow(id);
    showStatus('Movimiento eliminado');
    await loadMovements();
  }catch(e){ showError('No se pudo eliminar: '+e.message); }
}

// ── Conciliación rápida post-guardado ────────────────────
var _concManualMovId = null;
var _concManualFactId = null;

async function _ofrecerConciliacionManual(movId, monto, esIngreso){
  _concManualMovId = movId;
  _concManualFactId = null;
  try{
    // Buscar facturas sin conciliar con monto similar (±10%)
    var tipo = esIngreso ? 'emitida' : 'recibida';
    var min = Math.round(monto*0.90*100)/100;
    var max = Math.round(monto*1.10*100)/100;
    var {data:facts} = await sb.from('facturas')
      .select('id,receptor_nombre,emisor_nombre,numero_factura,fecha,total,metodo_pago,concepto')
      .eq('tipo',tipo).eq('conciliado',false).neq('estatus','cancelada')
      .gte('total',min).lte('total',max)
      .order('fecha',{ascending:false}).limit(10);
    if(!facts||!facts.length) return; // sin candidatos, no mostrar
    var modal = document.getElementById('modal-conc-manual');
    var titleEl = document.getElementById('conc-manual-title');
    var descEl = document.getElementById('conc-manual-desc');
    var listEl = document.getElementById('conc-manual-list');
    titleEl.textContent = esIngreso ? '¿Conciliar cobranza con factura?' : '¿Conciliar gasto con factura?';
    descEl.textContent = 'Se registró un '+(esIngreso?'cobro':'pago')+' de '+fmt(monto)+'. Facturas compatibles:';
    listEl.innerHTML = facts.map(function(f){
      var nombre = esIngreso ? (f.receptor_nombre||'—') : (f.emisor_nombre||'—');
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg-input);">'+
        '<input type="radio" name="conc-manual-fact" value="'+f.id+'" style="margin-top:3px;" onchange="_concManualFactId=\''+f.id+'\'">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc(nombre.slice(0,40))+'</div>'+
          '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+esc(f.numero_factura||'—')+(f.concepto?' · '+esc(f.concepto.slice(0,30)):'')+'</div>'+
        '</div>'+
        '<div style="text-align:right;white-space:nowrap;">'+
          '<div style="font-size:12px;font-weight:600;color:#16a34a;">'+fmt(parseFloat(f.total)||0)+'</div>'+
          '<div style="font-size:11px;color:var(--text-3);">'+fmtDate(f.fecha)+'</div>'+
        '</div>'+
      '</label>';
    }).join('');
    modal.style.display = 'flex';
  }catch(e){console.error('_ofrecerConciliacionManual:',e);}
}

async function _confirmarConcManual(){
  if(!_concManualFactId){showError('Selecciona una factura');return;}
  var btn = document.getElementById('conc-manual-btn');
  btn.disabled=true; btn.textContent='Guardando...';
  try{
    await Promise.all([
      sb.from('movimientos_v2').update({conciliado:true,factura_id:_concManualFactId}).eq('id',_concManualMovId),
      sb.from('facturas').update({conciliado:true}).eq('id',_concManualFactId)
    ]);
    document.getElementById('modal-conc-manual').style.display='none';
    showStatus('Conciliado correctamente');
    if(typeof loadFacturas==='function') loadFacturas();
  }catch(e){
    showError('Error al conciliar: '+e.message);
  }finally{
    btn.disabled=false; btn.textContent='Conciliar';
  }
}

// ── Etiqueta helpers ─────────────────────────────────────
