// ── Facturas module ───────────────────────────────────────
var allFacturas = [];
var facturasTipo = 'emitidas'; // emitidas | recibidas | conciliadas | complementos
var facturasYearFilter = new Date().getFullYear();

// ── Load ─────────────────────────────────────────────────

// ── Antigüedad de cartera (pestaña Facturas) ─────────────
async function loadCarteraFacturas(){
  try{
    var hoy = new Date();
    var {data:pendientes} = await sb.from('facturas')
      .select('id,receptor_nombre,numero_factura,fecha,fecha_vencimiento,total,monto_pagado,efecto_sat')
      .eq('tipo','emitida').eq('conciliado',false).neq('estatus','cancelada')
      .or('efecto_sat.eq.Ingreso,efecto_sat.is.null')
      .order('fecha',{ascending:true}).limit(200);
    pendientes = pendientes||[];
    var el = document.getElementById('cartera-list-fact');
    var ct = document.getElementById('cartera-count-fact');
    if(!el) return;
    if(!pendientes.length){
      if(ct) ct.textContent = 'Sin pendientes';
      el.innerHTML = '<div class="empty-state">No hay facturas pendientes de cobro ✓</div>';
      return;
    }
    var totalPend = pendientes.reduce(function(a,f){
      return a+((parseFloat(f.total)||0)-(parseFloat(f.monto_pagado)||0));
    },0);
    if(ct) ct.textContent = pendientes.length+' pendiente'+(pendientes.length!==1?'s':'')+' · '+fmt(totalPend);

    // Clasificar por días para vencer
    var grupos = {vencida:[],semana:[],mes:[],futuro:[]};
    pendientes.forEach(function(f){
      var fechaRef = f.fecha_vencimiento
        ? new Date(f.fecha_vencimiento+'T12:00')
        : new Date(new Date(f.fecha+'T12:00').getTime()+30*864e5);
      var dias = Math.floor((fechaRef - hoy)/864e5);
      var pend = (parseFloat(f.total)||0)-(parseFloat(f.monto_pagado)||0);
      var item = {f:f, dias:dias, pend:pend};
      if(dias < 0)        grupos.vencida.push(item);
      else if(dias <= 7)  grupos.semana.push(item);
      else if(dias <= 30) grupos.mes.push(item);
      else                grupos.futuro.push(item);
    });

    var bandas = [
      {key:'vencida', label:'Vencidas',         color:'#991b1b', bg:'#fee2e2'},
      {key:'semana',  label:'Vencen esta semana',color:'#92400e', bg:'#fef3c7'},
      {key:'mes',     label:'Vencen este mes',   color:'#854d0e', bg:'#fefce8'},
      {key:'futuro',  label:'Más de 30 días',    color:'#166534', bg:'#f0fdf4'}
    ];
    var html = '<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
      '<th>Cliente</th><th>Folio</th><th>Emisión</th><th>Vencimiento</th>'+
      '<th>Días</th><th style="text-align:right;">Pendiente</th></tr></thead><tbody>';
    bandas.forEach(function(b){
      var items = grupos[b.key]; if(!items.length) return;
      var sub = items.reduce(function(a,i){return a+i.pend;},0);
      html += '<tr><td colspan="6" style="background:'+b.bg+';color:'+b.color+';font-weight:600;font-size:11px;padding:6px 12px;">'+
        b.label+' · '+items.length+' factura'+(items.length!==1?'s':'')+' · '+fmt(sub)+'</td></tr>';
      items.forEach(function(i){
        var diasLabel = i.dias<0 ? Math.abs(i.dias)+'d vencida' : i.dias===0 ? 'Hoy' : i.dias+'d';
        var fechaVenc = i.f.fecha_vencimiento ? fmtDate(i.f.fecha_vencimiento) : '—';
        html += '<tr onclick="verDetalleFactura(\''+i.f.id+'\')" style="cursor:pointer;">'+
          '<td><div style="font-size:12px;font-weight:500;">'+esc((i.f.receptor_nombre||'—').slice(0,35))+'</div></td>'+
          '<td class="muted">'+esc(i.f.numero_factura||'—')+'</td>'+
          '<td class="muted">'+fmtDate(i.f.fecha)+'</td>'+
          '<td class="muted">'+fechaVenc+'</td>'+
          '<td class="muted" style="color:'+b.color+';">'+diasLabel+'</td>'+
          '<td class="monto" style="color:'+b.color+';">'+fmt(i.pend)+'</td>'+
        '</tr>';
      });
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }catch(e){console.error('Cartera:',e);}
}

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
    loadCarteraFacturas();
  }catch(e){
    console.error('loadFacturas:',e);
    document.getElementById('fact-list').innerHTML='<div class="empty-state">Error cargando facturas</div>';
  }
}

// ── KPIs ─────────────────────────────────────────────────
function renderFacturasKPIs(){
  var emitidas = allFacturas.filter(function(f){var ef=(f.efecto_sat||'Ingreso').toLowerCase();return f.tipo==='emitida'&&f.estatus==='vigente'&&!f.sin_factura&&ef!=='nómina'&&ef!=='nomina'&&ef!=='pago'&&ef!=='egreso';});
  var ventasDirectas = allFacturas.filter(function(f){return f.tipo==='emitida'&&f.sin_factura;});
  var recibidas = allFacturas.filter(function(f){var ef=(f.efecto_sat||'Ingreso').toLowerCase();return f.tipo==='recibida'&&f.estatus==='vigente'&&ef!=='pago'&&ef!=='egreso'&&ef!=='nómina'&&ef!=='nomina';});
  var cobrar = emitidas.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
  // Complementos pendientes = emitidas PPD Ingreso sin conciliar y no canceladas
  var ppd = allFacturas.filter(function(f){
    return f.tipo==='emitida' && (f.efecto_sat||'Ingreso')==='Ingreso' && f.metodo_pago==='PPD' && !f.conciliado && f.estatus!=='cancelada';
  });
  // FEAT-01: totales monetarios de recibidas y ventas directas
  var totalRecibidas = recibidas.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
  var totalVentasDirectas = ventasDirectas.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);

  document.getElementById('fact-k-emitidas').textContent = emitidas.length;
  document.getElementById('fact-k-recibidas').textContent = recibidas.length;
  document.getElementById('fact-k-cobrar').textContent = fmt(cobrar);
  document.getElementById('fact-k-ppd').textContent = ppd.length;
  // FEAT-01: inyectar montos si los IDs existen en el HTML
  var elRecMonto = document.getElementById('fact-k-recibidas-monto');
  if(elRecMonto) elRecMonto.textContent = fmt(totalRecibidas);
  var elVdMonto = document.getElementById('fact-k-vd-monto');
  if(elVdMonto) elVdMonto.textContent = fmt(totalVentasDirectas);

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
  // Mostrar filtro de estatus solo en emitidas y recibidas
  var filtroEl = document.getElementById('fact-estatus-filter');
  if(filtroEl){
    filtroEl.style.display = (tipo==='emitidas'||tipo==='recibidas'||tipo==='cxc'||tipo==='cxp') ? 'inline-block' : 'none';
    filtroEl.value = ''; // reset al cambiar tab
  }
  filtrarFacturas(document.getElementById('fact-search').value||'');
}

// ── Filter & render ───────────────────────────────────────
function filtrarFacturas(q){
  var ql = (q||'').toLowerCase();
  var estatusFiltro = (document.getElementById('fact-estatus-filter')||{}).value||'';

  var filtered = allFacturas.filter(function(f){
    // Tab filter
    if(facturasTipo==='emitidas'){
      if(f.tipo!=='emitida'||f.sin_factura) return false;
      // Estatus filter dentro de emitidas
      if(estatusFiltro==='pagada')    return f.conciliado || f.estatus==='pagada';
      if(estatusFiltro==='cancelada') return f.estatus==='cancelada';
      if(estatusFiltro==='emitida')   return !f.conciliado && f.estatus!=='cancelada';
      return true; // "Todas"
    }
    if(facturasTipo==='directas')    return f.tipo==='emitida'&&f.sin_factura;
    if(facturasTipo==='recibidas'){
      if(f.tipo!=='recibida') return false;
      if(estatusFiltro==='pagada')    return f.conciliado || f.estatus==='pagada';
      if(estatusFiltro==='cancelada') return f.estatus==='cancelada';
      if(estatusFiltro==='emitida')   return !f.conciliado && f.estatus!=='cancelada';
      return true;
    }
    if(facturasTipo==='complementos') return f.tipo==='emitida'&&f.complemento_requerido&&!f.conciliado;
    if(facturasTipo==='cxc') return f.tipo==='emitida'&&!f.conciliado&&f.estatus!=='cancelada';
    if(facturasTipo==='cxp') return f.tipo==='recibida'&&!f.conciliado&&f.estatus!=='cancelada';
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
  var esEmitida = f.tipo === 'emitida';

  // Nombre contraparte
  var nombre = esEmitida
    ? (f.receptor_nombre||f.receptor_rfc||'—')
    : (f.emisor_nombre||f.emisor_rfc||'—');

  // Estatus con labels correctos por tipo
  var estBg, estColor, estLabel;
  if(f.conciliado || f.estatus==='pagada'){
    estBg='#dbeafe'; estColor='#1d4ed8'; estLabel='Pagada';
  } else if(f.estatus==='cancelada'){
    estBg='#fee2e2'; estColor='#dc2626'; estLabel='Cancelada';
  } else {
    // Vigente sin pagar
    estBg='#dcfce7'; estColor='#16a34a';
    estLabel = esEmitida ? 'Emitida' : 'Recibida';
  }

  var metodoBg    = f.metodo_pago==='PPD' ? '#fef3c7' : '#f1f5f9';
  var metodoColor = f.metodo_pago==='PPD' ? '#d97706' : '#64748b';

  // Fecha vencimiento — condiciones_pago del cliente si existe
  var fechaVenc = f.fecha_vencimiento ? fmtDate(f.fecha_vencimiento) : '—';
  // Semáforo de vencimiento
  var diasVenc = f.fecha_vencimiento
    ? Math.floor((new Date(f.fecha_vencimiento+'T12:00') - hoy) / 864e5)
    : null;
  var vencColor = diasVenc === null ? 'var(--text-3)'
    : diasVenc < 0  ? '#dc2626'
    : diasVenc <= 7 ? '#d97706'
    : '#16a34a';

  // Proyecto — mostrar numero_pedido si está en memoria, si no mostrar id corto
  var proyTexto = '—';
  if(f.proyecto_id){
    var proy = (allProyectos||[]).find(function(p){ return p.id === f.proyecto_id; });
    proyTexto = proy ? (proy.nombre_pedido||proy.id.slice(0,8)) : f.proyecto_id.slice(0,8);
  }

  var tr = document.createElement('tr');
  tr.style.cursor = 'pointer';
  tr.addEventListener('click', function(){ verDetalleFactura(f.id); });

  // Col 1: nombre contraparte
  var nameCell = document.createElement('td');
  var nameDiv = document.createElement('div');
  nameDiv.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-1);';
  nameDiv.textContent = nombre.slice(0,35);
  nameCell.appendChild(nameDiv);
  if(f.concepto){
    var concDiv = document.createElement('div');
    concDiv.style.cssText = 'font-size:10px;color:var(--text-3);';
    concDiv.textContent = f.concepto.slice(0,35);
    nameCell.appendChild(concDiv);
  }
  tr.appendChild(nameCell);

  // Col 2: folio interno
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

  // Col 3: fecha emisión
  var fechaCell = document.createElement('td');
  fechaCell.className = 'muted';
  fechaCell.textContent = fmtDate(f.fecha||'');
  tr.appendChild(fechaCell);

  // Col 4: fecha vencimiento (solo emitidas, no directas)
  if(!f.sin_factura){
    var vencCell = document.createElement('td');
    vencCell.className = 'muted';
    vencCell.style.color = vencColor;
    vencCell.textContent = fechaVenc;
    tr.appendChild(vencCell);
  }

  // Col 5: método pago
  var metCell = document.createElement('td');
  var metBadge = document.createElement('span');
  metBadge.style.cssText = 'padding:2px 7px;border-radius:5px;font-size:11px;font-weight:500;background:'+metodoBg+';color:'+metodoColor+';';
  metBadge.textContent = f.metodo_pago||'PUE';
  metCell.appendChild(metBadge);
  tr.appendChild(metCell);

  // Col 6: proyecto
  var projCell = document.createElement('td');
  projCell.className = 'muted';
  projCell.style.cssText = 'font-size:11px;color:var(--brand-red);';
  projCell.textContent = proyTexto;
  tr.appendChild(projCell);

  // Col 7: total
  var montoCell = document.createElement('td');
  montoCell.className = 'monto';
  montoCell.style.color = esEmitida ? '#16a34a' : '#dc2626';
  montoCell.textContent = fmt(parseFloat(f.total)||0);
  tr.appendChild(montoCell);

  // Col 8: estatus
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
  var isRecibida = facturasTipo==='recibidas'||facturasTipo==='complementos'||facturasTipo==='cxp';
  var isDirecta  = facturasTipo==='directas';
  var table = document.createElement('table');
  table.className = 'sat-table';
  var thead = document.createElement('thead');
  var thVenc = isDirecta ? '' : '<th>Vencimiento</th>';
  thead.innerHTML = '<tr><th>'+(isRecibida?'Proveedor':'Cliente')+'</th>'
    + '<th>Folio</th><th>Emisión</th>'+thVenc+'<th>Método</th><th>Proyecto</th>'
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
  // Fecha vencimiento: usar guardada o estimar desde condiciones del cliente/proveedor
  var fechaVencVal = f.fecha_vencimiento || '';
  var fechaVencDisplay = f.fecha_vencimiento ? fmtDate(f.fecha_vencimiento) : '—';
  if(!fechaVencVal && f.fecha){
    var _dias=30;
    if(f.tipo==='emitida'&&f.cliente_id){var _c=(clientes||[]).find(function(c){return c.id===f.cliente_id;});if(_c&&DIAS_CONDICIONES[_c.condiciones_pago]!=null)_dias=DIAS_CONDICIONES[_c.condiciones_pago];}
    else if(f.tipo==='recibida'&&f.proveedor_id){var _p=(proveedores||[]).find(function(p){return p.id===f.proveedor_id;});if(_p&&DIAS_CONDICIONES[_p.condiciones_pago]!=null)_dias=DIAS_CONDICIONES[_p.condiciones_pago];}
    var _fb=new Date(f.fecha+'T12:00');_fb.setDate(_fb.getDate()+_dias);
    fechaVencVal=_fb.toISOString().split('T')[0];
    fechaVencDisplay=fmtDate(fechaVencVal)+' (est.)';
  }
  // Días para vencer (negativo = ya venció)
  var diasVenc = fechaVencVal
    ? Math.floor((new Date(fechaVencVal+'T12:00') - hoy) / 864e5)
    : null;
  var semColor = diasVenc === null ? 'var(--text-3)'
    : diasVenc < 0  ? '#dc2626'
    : diasVenc <= 7 ? '#d97706'
    : '#16a34a';
  var diasLabel = diasVenc === null ? '—'
    : diasVenc < 0  ? Math.abs(diasVenc)+'d vencida'
    : diasVenc === 0 ? 'Hoy'
    : diasVenc+'d para vencer';

  // IVA: usar valor guardado, o calcular desde subtotal, o estimar del total
  var totalNum = parseFloat(f.total)||0;
  var subtotalNum = parseFloat(f.subtotal)||0;
  var ivaCalc = (parseFloat(f.iva)||0) > 0 ? parseFloat(f.iva)
    : subtotalNum > 0 ? totalNum - subtotalNum
    : totalNum * 16/116;

  var esSAT = f.origen==='sat';
  var uuidStr = f.uuid_sat||'';

  var body =
    '<div class="detail-section"><div class="detail-kpi-grid">'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Total</div><div class="detail-kpi-value '+(f.tipo==='emitida'?'c-green':'c-red')+'">'+fmt(totalNum)+'</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">IVA</div><div class="detail-kpi-value" style="color:var(--text-2);">'+fmt(ivaCalc)+'</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Vencimiento</div><div class="detail-kpi-value" style="color:'+semColor+';">'+diasLabel+'</div></div>'+
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
    // UUID con botón copiar
    (uuidStr?'<div class="detail-field" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
      '<div class="detail-field-label" style="min-width:40px;">UUID</div>'+
      '<div class="detail-field-value" style="font-size:10px;font-family:monospace;flex:1;word-break:break-all;">'+esc(uuidStr)+'</div>'+
      '<button class="btn-sm" onclick="_copiarUUID(\''+uuidStr.replace(/'/g,"\\'")+'\')" style="padding:2px 10px;font-size:11px;">Copiar</button>'+
    '</div>':'')+
    // Vencimiento editable
    '<div class="detail-field" style="margin-top:8px;display:flex;align-items:center;gap:8px;">'+
      '<div class="detail-field-label" style="min-width:80px;">Vencimiento</div>'+
      '<input type="date" id="det-venc-input" value="'+fechaVencVal+'" style="border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:12px;background:var(--bg-card);">'+
      '<button class="btn-sm" onclick="_guardarVencimiento(\''+f.id+'\',document.getElementById(\'det-venc-input\').value)" style="padding:2px 10px;font-size:11px;">Guardar</button>'+
    '</div>'+
    '</div>'+
    '<div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'+
      (!f.conciliado&&f.estatus!=='cancelada'?'<button class="btn-sm" onclick="editarFactura(\''+f.id+'\')">Editar'+(esSAT?' (campos limitados)':'')+'</button>':'')+
      '<button class="btn-sm" style="color:#dc2626;border-color:#dc2626;" onclick="cancelarFactura(\''+f.id+'\')">Cancelar factura</button>'+
      (esSAT?'<span style="font-size:11px;color:var(--text-3);margin-left:4px;">Origen SAT · UUID, fechas y montos bloqueados</span>':'')+
    '</div>';

  abrirDetail(nombre,'Factura '+(f.tipo==='emitida'?'emitida':'recibida'),ini,body, function(){cerrarDetail();editarFactura(f.id);});
}

function _copiarUUID(u){
  navigator.clipboard.writeText(u).then(function(){showStatus('UUID copiado al portapapeles');});
}

async function _guardarVencimiento(id,fecha){
  if(!fecha){showError('Selecciona una fecha');return;}
  try{
    await sb.from('facturas').update({fecha_vencimiento:fecha}).eq('id',id);
    // Actualizar en memoria
    var idx=allFacturas.findIndex(function(x){return x.id===id;});
    if(idx>=0) allFacturas[idx].fecha_vencimiento=fecha;
    showStatus('Vencimiento guardado');
  }catch(e){showError('Error: '+e.message);}
}

// marcarFacturaPagada eliminado — conciliación solo vía SAT & Banco (ver sat.js)

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

// ── Fecha vencimiento — calculada desde condiciones del cliente/proveedor ──
var DIAS_CONDICIONES = {inmediato:0,'15':15,'30':30,'45':45,'60':60,'90':90};

function calcularVencimientoFact(){
  var fechaEl  = document.getElementById('fact-fecha');
  var vencEl   = document.getElementById('fact-vencimiento');
  if(!fechaEl || !vencEl || !fechaEl.value) return;
  // Si el usuario ya puso una fecha manual, no pisar
  if(vencEl.dataset.manual === 'true') return;
  var tipo     = document.getElementById('fact-tipo').value;
  var clienteId = document.getElementById('fact-cliente-id').value;
  var provId    = document.getElementById('fact-prov-id').value;
  var dias = 30; // default
  if(tipo === 'emitida' && clienteId){
    var cli = (clientes||[]).find(function(c){ return c.id === clienteId; });
    if(cli && cli.condiciones_pago != null)
      dias = DIAS_CONDICIONES[cli.condiciones_pago] != null ? DIAS_CONDICIONES[cli.condiciones_pago] : 30;
  } else if(tipo === 'recibida' && provId){
    var prov = (proveedores||[]).find(function(p){ return p.id === provId; });
    if(prov && prov.condiciones_pago != null)
      dias = DIAS_CONDICIONES[prov.condiciones_pago] != null ? DIAS_CONDICIONES[prov.condiciones_pago] : 30;
  }
  var fechaBase = new Date(fechaEl.value + 'T12:00');
  fechaBase.setDate(fechaBase.getDate() + dias);
  vencEl.value = fechaBase.toISOString().split('T')[0];
}

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
  var _fuuid=document.getElementById('fact-uuid'); if(_fuuid) _fuuid.value='';
  var _fvenc=document.getElementById('fact-vencimiento'); if(_fvenc){_fvenc.value='';_fvenc.dataset.manual='false';}
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
  var _fuuid2=document.getElementById('fact-uuid'); if(_fuuid2) _fuuid2.value=f.uuid_sat||'';
  var _fvenc2=document.getElementById('fact-vencimiento'); if(_fvenc2){_fvenc2.value=f.fecha_vencimiento||'';_fvenc2.dataset.manual=f.fecha_vencimiento?'true':'false';}
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

  // Bloquear campos si viene del SAT
  var isSAT = f.origen==='sat';
  var satLockIds = ['fact-tipo','fact-fecha','fact-uuid','fact-subtotal','fact-iva','fact-total',
                    'fact-cliente-search','fact-prov-search','fact-numero','fact-con-sat','fact-sin-sat'];
  satLockIds.forEach(function(elId){
    var el=document.getElementById(elId);
    if(!el)return;
    el.readOnly = isSAT;
    el.style.background    = isSAT ? 'var(--bg-card-2)' : '';
    el.style.cursor        = isSAT ? 'not-allowed'      : '';
    el.style.pointerEvents = isSAT ? 'none'             : '';
    el.style.opacity       = isSAT ? '0.6'              : '';
  });
  // Mostrar aviso SAT
  var satMsg=document.getElementById('fact-sat-lock-msg');
  if(!satMsg){
    satMsg=document.createElement('div');
    satMsg.id='fact-sat-lock-msg';
    satMsg.style.cssText='font-size:11px;color:var(--text-3);padding:4px 8px;background:var(--bg-card-2);border-radius:6px;margin-bottom:8px;';
    var modal=document.getElementById('fact-modal');
    var form=modal&&modal.querySelector('form');
    if(form) form.insertBefore(satMsg,form.firstChild);
  }
  satMsg.textContent = isSAT ? '🔒 Factura SAT · Solo puedes editar: método de pago, concepto, proyecto y notas.' : '';
  satMsg.style.display = isSAT ? 'block' : 'none';
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
// Prepara los proyectos recientes del cliente en memoria (sin mostrar el dropdown).
// Se llama al seleccionar cliente. El dropdown solo aparece en onFocusProyectoFact().
function precargarProyectosFact(){
  var clienteId = document.getElementById('fact-cliente-id').value;
  var projHid   = document.getElementById('fact-proj-id');
  // No pisar si el usuario ya eligió un proyecto
  if(projHid && projHid.value) return;
  var pool = (allProyectos||[]);
  var clienteProjs = clienteId
    ? pool.filter(function(p){ return p.cliente_id===clienteId; })
    : [];
  // Guardar los recientes en el elemento para usarlos en onFocusProyectoFact
  var projDd = document.getElementById('fact-proj-dd');
  if(projDd) projDd._recentProjs = clienteProjs
    .slice().sort(function(a,b){ return (b.created_at||'') > (a.created_at||'') ? 1 : -1; })
    .slice(0, 5);
  // NO mostrar el dropdown aquí — esperar a que el usuario haga foco en el campo
}

// Muestra proyectos recientes al hacer focus en el campo de proyecto.
// Solo se dispara si el campo está vacío y hay proyectos pre-cargados.
function onFocusProyectoFact(){
  var projInp = document.getElementById('fact-proj-search');
  var projHid = document.getElementById('fact-proj-id');
  var projDd  = document.getElementById('fact-proj-dd');
  if(!projInp || !projDd) return;
  // No mostrar si ya hay un proyecto seleccionado o si el usuario está escribiendo
  if(projHid && projHid.value) return;
  if(projInp.value.trim()) return;
  var recent = projDd._recentProjs || [];
  if(!recent.length) return;
  // Renderizar dropdown de recientes
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
    nameEl.textContent = p.nombre_pedido||p.nombre||p.titulo||p.id;
    if(p.nombre_cliente){
      var subEl = document.createElement('div');
      subEl.style.cssText = 'font-size:10px;color:var(--text-3);margin-top:1px;';
      subEl.textContent = p.nombre_cliente;
      item.appendChild(subEl);
    }
    item.appendChild(nameEl);
    item.addEventListener('mousedown', function(){
      if(projInp) projInp.value = p.nombre_pedido||p.nombre||p.titulo||'';
      if(projHid) projHid.value = p.id;
      projDd.style.display = 'none';
      actualizarBtnClear('fact-proj-id','fact-proj-clear');
    });
    frag.appendChild(item);
  });
  projDd.appendChild(frag);
  projDd.style.display = 'block';
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
    function(){ setTimeout(precargarProyectosFact, 50); setTimeout(calcularVencimientoFact, 60); });
  makeAutocomplete('fact-prov-search','fact-prov-id','fact-prov-dd',
    function(){return proveedores.map(function(p){return {id:p.id,label:p.nombre,sub:p.rfc||''};});},
    function(){ setTimeout(calcularVencimientoFact, 60); });
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

  var uuid = document.getElementById('fact-uuid')&&document.getElementById('fact-uuid').value.trim()||'';
  if(!fecha){showError('La fecha es obligatoria');return;}
  if(!total){showError('El total es obligatorio');return;}
  if(!uuid){showError('El UUID SAT es obligatorio');return;}
  if(!/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(uuid)){
    showError('UUID inválido. Formato esperado: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');return;
  }
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
    uuid_sat:uuid,
    numero_factura:document.getElementById('fact-numero').value.trim()||null,
    subtotal:parseFloat(document.getElementById('fact-subtotal').value)||0,
    iva:parseFloat(document.getElementById('fact-iva').value)||0,
    total:total,
    metodo_pago:metodoPago,
    fecha_vencimiento:(document.getElementById('fact-vencimiento')&&document.getElementById('fact-vencimiento').value)||null,
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
