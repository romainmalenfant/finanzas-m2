// ── Detail navigation stack ──────────────────────────────
var _detailStack = []; // [{titulo, subtitulo, iniciales, bodyHTML, editFn}]

function abrirDetail(titulo, subtitulo, iniciales, bodyHTML, editFn){
  // If modal is not open, this is a fresh navigation — reset stack
  var modal = document.getElementById('detail-modal');
  if(!modal || modal.style.display!=='flex') _detailStack=[];
  _renderDetail({titulo:titulo, subtitulo:subtitulo, iniciales:iniciales, bodyHTML:bodyHTML, editFn:editFn});
  document.getElementById('detail-modal').style.display='flex';
}

function _renderDetail(entry){
  document.getElementById('detail-title').textContent=entry.titulo;
  document.getElementById('detail-subtitle').textContent=entry.subtitulo||'';
  document.getElementById('detail-avatar').textContent=entry.iniciales||'?';
  document.getElementById('detail-body').innerHTML=entry.bodyHTML;
  var eb=document.getElementById('detail-edit-btn');
  if(entry.editFn){eb.style.display='block';eb.onclick=entry.editFn;}
  else eb.style.display='none';
  _updateDetailNav();
}

function _pushDetail(){
  // Only push if modal is already open — otherwise it's a fresh navigation
  var modal = document.getElementById('detail-modal');
  if(!modal || modal.style.display!=='flex') return;
  var currentTitle = document.getElementById('detail-title').textContent;
  if(!currentTitle || currentTitle==='—') return;
  _detailStack.push({
    titulo:currentTitle,
    subtitulo:document.getElementById('detail-subtitle').textContent,
    iniciales:document.getElementById('detail-avatar').textContent,
    bodyHTML:document.getElementById('detail-body').innerHTML,
    editFn:document.getElementById('detail-edit-btn').onclick||null
  });
  _updateDetailNav();
}

function _updateDetailNav(){
  var backBtn = document.getElementById('detail-back-btn');
  var bc = document.getElementById('detail-breadcrumb');
  var bcInner = document.getElementById('detail-breadcrumb-inner');

  if(_detailStack.length>0){
    backBtn.style.display='none'; // breadcrumb handles navigation
    // Breadcrumb
    bc.style.display='block';
    bcInner.innerHTML = _detailStack.map(function(entry, i){
      return '<span style="color:#3B82F6;cursor:pointer;font-size:11px;" onclick="detailGoToIndex('+i+')">'+esc(entry.titulo)+'</span>'+
        (i<_detailStack.length-1?'<span style="color:var(--text-4);font-size:11px;margin:0 2px;">›</span>':'');
    }).join('')+
    '<span style="color:var(--text-4);font-size:11px;margin:0 2px;">›</span>'+
    '<span style="font-size:11px;color:var(--text-2);">'+esc(document.getElementById('detail-title').textContent)+'</span>';
  } else {
    backBtn.style.display='none';
    bc.style.display='none';
  }
}

function detailGoBack(){
  if(!_detailStack.length)return;
  var prev = _detailStack.pop();
  _renderDetail(prev);
}

function detailGoToIndex(idx){
  // Pop stack back to idx, render that entry
  var entry = _detailStack[idx];
  _detailStack = _detailStack.slice(0, idx);
  _renderDetail(entry);
}


function _setDetailBody(html){
  document.getElementById('detail-body').innerHTML = html;
  _updateDetailNav();
}
function cerrarDetail(){
  _detailStack=[];
  document.getElementById('detail-modal').style.display='none';
  document.getElementById('detail-back-btn').style.display='none';
  document.getElementById('detail-breadcrumb').style.display='none';
}

// ── Empresa detail ────────────────────────────────────────
async function verDetalleEmpresa(id){
  _pushDetail();
  // Ensure clientes loaded
  if(!clientes.length) await loadClientes();
  var c=clientes.find(function(x){return String(x.id)===String(id);});
  if(!c){
    // Try fetching directly
    c=await DB.clientes.get(id);
    if(!c)return;
  }
  var ini=(c.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  abrirDetail(c.nombre,c.rfc||'',ini,'<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarCliente(id);});
  try{
    var año=new Date().getFullYear(); var hoy=new Date();
    // Run queries sequentially to avoid or() issues
    var mvmts = await DB.movimientos.porClienteId(id, c.rfc, año);

    var cxcRaw = await DB.facturas.cxcByCliente(id, c.rfc);
    var cxcFacturas = cxcRaw.map(function(f){return {id:f.id,monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});

    var projs = await DB.proyectos.byCliente(c.nombre, año);
    var conts = await DB.contactos.byCliente(id);

    var ventasRows = await DB.facturas.ytdByCliente(id, c.rfc, año);
    var ventas=ventasRows.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var cxcTotal=cxcFacturas.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var condLabels={'inmediato':'Pago inmediato','15':'15 días','30':'30 días','45':'45 días','60':'60 días','90':'90 días'};

    var body=
      '<div class="detail-section">'+
        '<div class="detail-kpi-grid">'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Ventas YTD</div><div class="detail-kpi-value c-green">'+fmt(ventas)+'</div></div>'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Por cobrar</div><div class="detail-kpi-value c-amber">'+fmt(cxcTotal)+'</div></div>'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Proyectos activos</div><div class="detail-kpi-value c-blue">'+( projs||[]).length+'</div></div>'+
        '</div>'+
      '</div>'+
      '<div class="detail-section"><div class="detail-section-title">Datos generales</div>'+
        '<div class="detail-grid">'+
          '<div class="detail-field"><div class="detail-field-label">RFC</div><div class="detail-field-value">'+(c.rfc||'—')+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Ciudad</div><div class="detail-field-value">'+(c.ciudad||'—')+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Condiciones de pago</div><div class="detail-field-value">'+(condLabels[c.condiciones_pago]||'—')+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Estatus</div><div class="detail-field-value" style="color:'+(c.activo!==false?'#34d399':'#f87171')+'">'+(c.activo!==false?'Activa':'Inactiva')+'</div></div>'+
          (c.web?'<div class="detail-field" style="grid-column:1/-1;"><div class="detail-field-label">P\u00e1gina Web</div><div class="detail-field-value"><a href="'+(c.web.startsWith('http')?'':'https://')+esc(c.web)+'" target="_blank" style="color:#3B82F6;">'+esc(c.web)+'</a></div></div>':'')+
        '</div>'+
      '</div>'+
      (cxcFacturas.length?'<div class="detail-section"><div class="detail-section-title">Facturas por cobrar ('+cxcFacturas.length+')</div>'+
        cxcFacturas.sort(function(a,b){return a.fecha>b.fecha?1:-1;}).map(function(f){
          var dias=f.fecha?Math.floor((hoy-new Date(f.fecha))/(864e5)):0;
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleFactura(\''+f.id+'\')"><div><div style="font-size:12px;color:var(--text-1);">'+(f.numero_factura||f.descripcion||'Sin desc.').slice(0,40)+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDateFull(f.fecha)+(f.fecha?' · <span style="color:'+color+';">'+dias+'d</span>':'')+'</div></div>'+
            '<span style="font-weight:600;color:#fbbf24;">'+fmt(parseFloat(f.monto)||0)+'</span></div>';
        }).join('')+'</div>':'')  +
      ((projs||[]).length?'<div class="detail-section"><div class="detail-section-title">Proyectos '+año+'</div>'+
        projs.map(function(p){
          return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleProyecto(\''+p.id+'\')">'+
            '<div><div style="font-size:12px;color:#60a5fa;">'+esc(p.nombre_pedido)+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">Entrega: '+fmtDateFull(p.fecha_entrega)+'</div></div>'+
            '<span style="font-weight:600;color:var(--text-2);">'+fmt(p.monto_total||0)+'</span></div>';
        }).join('')+'</div>':'') +
      '<div class="detail-section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Contactos</div>'+
        '<button class="btn-sm" onclick="abrirNuevoContactoConVinculo(\'empresa\',\''+id+'\',\''+esc(c.nombre)+'\')" style="font-size:11px;">+ Nuevo</button>'+
      '</div>'+
      renderBuscarContactoHTML('empresa',id,c.nombre)+
      ((conts||[]).length?(conts).map(function(ct){
        var nombre=(ct.nombre||'')+(ct.apellido?' '+ct.apellido:'');
        return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+ct.id+'\')">'+
          '<div><div style="font-size:12px;font-weight:500;color:#3B82F6;">'+esc(nombre)+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+(ct.cargo||'')+(ct.email?' · '+ct.email:'')+'</div></div>'+
          '<span style="font-size:11px;color:var(--text-3);">→</span></div>';
      }).join(''):'<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin contactos</div>')+
      '</div>'+
      (mvmts.length?'<div class="detail-section"><div class="detail-section-title">Últimos movimientos '+año+'</div>'+
        mvmts.slice(0,6).map(function(m){
          var desc=(['undefined','null',''].indexOf(String(m.descripcion||''))>=0)?null:m.descripcion;
          if(!desc)desc=(['undefined','null',''].indexOf(String(m.contraparte||''))>=0)?null:m.contraparte;
          if(!desc)return '';
          var cat=CAT_LABELS[m.categoria]||m.categoria||'';
          var col=CAT_COLORS[m.categoria]||'var(--text-3)';
          return '<div class="detail-list-item"><div>'+
            '<div style="font-size:12px;color:var(--text-1);">'+esc(desc.slice(0,40))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(m.fecha||'')+(m.fecha&&cat?' · '+cat:'')+'</div>'+
            '</div><span style="font-weight:600;color:'+col+';">'+(m.tipo==='egreso'?'−':'+')+fmt(parseFloat(m.monto)||0)+'</span></div>';
        }).filter(Boolean).join('')+'</div>':'');
    _setDetailBody(body);
  }catch(e){
    console.error('Detalle empresa:',e);
    _setDetailBody('<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>');
  }
}

async function verDetalleProveedor(id){
  _pushDetail();
  if(!proveedores.length) await loadProveedores();
  var p=proveedores.find(function(x){return String(x.id)===String(id);});
  if(!p){
    p=await DB.proveedores.get(id);
    if(!p)return;
  }
  var ini=(p.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  abrirDetail(p.nombre,p.rfc||'',ini,'<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarProveedor(id);});
  try{
    var año=new Date().getFullYear(); var hoy=new Date();
    var mvmts = await DB.movimientos.porCliente(p.nombre, p.rfc, año);

    var cxpRaw = await DB.facturas.cxpByProveedor(id, p.rfc);
    var cxp = cxpRaw.map(function(f){return {id:f.id,monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});

    var comprasRows = await DB.facturas.ytdByProveedor(id, p.rfc, año);
    var totalCompras=comprasRows.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var cxpTotal=cxp.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);

    var body=
      '<div class="detail-section"><div class="detail-kpi-grid">'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Compras YTD</div><div class="detail-kpi-value c-red">'+fmt(totalCompras)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Por pagar</div><div class="detail-kpi-value c-amber">'+fmt(cxpTotal)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Facturas pendientes</div><div class="detail-kpi-value c-blue">'+cxp.length+'</div></div>'+
      '</div></div>'+
      '<div class="detail-section"><div class="detail-section-title">Datos</div><div class="detail-grid">'+
        '<div class="detail-field"><div class="detail-field-label">RFC</div><div class="detail-field-value">'+(p.rfc||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Ciudad</div><div class="detail-field-value">'+(p.ciudad||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Tipo</div><div class="detail-field-value">'+(p.tipo?p.tipo.charAt(0).toUpperCase()+p.tipo.slice(1):'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Condiciones</div><div class="detail-field-value">'+(p.condiciones_pago||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Categoría</div><div class="detail-field-value">'+(p.categoria?p.categoria.charAt(0).toUpperCase()+p.categoria.slice(1):'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Calificación</div><div class="detail-field-value">'+(p.calificacion?'⭐'.repeat(p.calificacion):'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">CLABE</div><div class="detail-field-value">'+(p.clabe||'—')+(p.clabe?copyBtn(p.clabe):'')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">L\u00edmite cr\u00e9dito</div><div class="detail-field-value">'+(p.limite_credito?fmt(p.limite_credito):'—')+'</div></div>'+
        (p.web?'<div class="detail-field" style="grid-column:1/-1;"><div class="detail-field-label">P\u00e1gina Web</div><div class="detail-field-value"><a href="'+(p.web.startsWith('http')?'':'https://')+esc(p.web)+'" target="_blank" style="color:#3B82F6;">'+esc(p.web)+'</a></div></div>':'')+
      '</div>'+
      (p.notas?'<div class="detail-field" style="margin-top:8px;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(p.notas)+'</div></div>':'')+
      (cxp.length?'<div class="detail-section"><div class="detail-section-title">Facturas por pagar</div>'+
        cxp.sort(function(a,b){return a.fecha>b.fecha?1:-1;}).map(function(f){
          var dias=Math.floor((hoy-new Date(f.fecha))/(864e5));
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          var fdesc=(f.numero_factura||f.descripcion||'').replace(/undefined|null/g,'').trim()||'Sin desc.';
          return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleFactura(\''+f.id+'\')"><div><div style="font-size:12px;color:var(--text-1);">'+esc(fdesc.slice(0,40))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDateFull(f.fecha||'')+(f.fecha?' · <span style="color:'+color+';">'+dias+'d</span>':'')+'</div></div>'+
            '<span style="font-weight:600;color:#f87171;">'+fmt(parseFloat(f.monto)||0)+'</span></div>';
        }).join('')+'</div>':'')+
      (mvmts.length?'<div class="detail-section"><div class="detail-section-title">Últimos movimientos</div>'+
        mvmts.slice(0,6).map(function(m){
          var desc=(['undefined','null',''].indexOf(String(m.descripcion||''))>=0)?null:m.descripcion;
          if(!desc)desc=(['undefined','null',''].indexOf(String(m.contraparte||''))>=0)?null:m.contraparte;
          if(!desc)return '';
          return '<div class="detail-list-item"><div>'+
            '<div style="font-size:12px;color:var(--text-1);">'+esc(desc.slice(0,40))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(m.fecha||'')+'</div></div>'+
            '<span style="font-weight:600;color:#f87171;">'+fmt(parseFloat(m.monto)||0)+'</span></div>';
        }).join('')+'</div>':'');
    // Contactos del proveedor
    var contsP=await DB.contactos.byProveedor(id);
    body+=
      '<div class="detail-section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Contactos</div>'+
        '<button class="btn-sm" onclick="abrirNuevoContactoConVinculo(\'proveedor\',\''+id+'\',\''+esc(p.nombre)+'\')" style="font-size:11px;">+ Nuevo</button>'+
      '</div>'+
      renderBuscarContactoHTML('proveedor',id,p.nombre)+
      ((contsP||[]).length?(contsP).map(function(ct){
        var nombre=(ct.nombre||'')+(ct.apellido?' '+ct.apellido:'');
        return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+ct.id+'\')">'+ 
          '<div><div style="font-size:12px;font-weight:500;color:#3B82F6;">'+esc(nombre)+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+(ct.cargo||'')+(ct.email?' · '+ct.email:'')+'</div></div>'+
          '<span style="font-size:11px;color:var(--text-3);">→</span></div>';
      }).join(''):'<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin contactos</div>')+
      '</div>';
    _setDetailBody(body);
  }catch(e){
    console.error('Detalle proveedor:',e);
    _setDetailBody('<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>');
  }
}

async function verDetalleContacto(id){
  _pushDetail();
  var c=contactos.find(function(x){return x.id===id;});
  if(!c){
    c=await DB.contactos.get(id);
    if(!c)return;
  }
  var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
  var ini=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
  var esProveedor = !c.cliente_id && !!c.proveedor_id;
  var empresa = c.clientes&&c.clientes.nombre
    ? c.clientes.nombre
    : (c.proveedores&&c.proveedores.nombre ? c.proveedores.nombre : 'Sin empresa');
  var body=
    '<div class="detail-section"><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Cargo</div><div class="detail-field-value">'+(c.cargo||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">'+(esProveedor?'Proveedor':'Empresa')+'</div>'+
      (c.cliente_id?
        '<div class="detail-field-value" style="color:#3B82F6;cursor:pointer;" onclick="verDetalleEmpresa(\''+c.cliente_id+'\')">' + esc(empresa) + '</div>'
      : c.proveedor_id
        ? '<div class="detail-field-value" style="color:#f87171;cursor:pointer;" onclick="verDetalleProveedor(\''+c.proveedor_id+'\')">' + esc(empresa) + '</div>'
        : '<div class="detail-field-value">'+esc(empresa)+'</div>')+
      '</div>'+
      '<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">'+(c.email?'<a href="mailto:'+esc(c.email)+'" style="color:#60a5fa;">'+esc(c.email)+'</a>'+copyBtn(c.email):'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Tel\u00e9fono</div><div class="detail-field-value">'+(c.telefono||'—')+(c.telefono?copyBtn(c.telefono):'')+'</div></div>'+
      (c.telefono2?'<div class="detail-field"><div class="detail-field-label">Tel\u00e9fono 2</div><div class="detail-field-value">'+esc(c.telefono2)+copyBtn(c.telefono2)+'</div></div>':'')+
      '<div class="detail-field"><div class="detail-field-label">Estatus</div><div class="detail-field-value" style="color:'+(c.activo!==false?'#34d399':'#f87171')+'">'+(c.activo!==false?'Activo':'Inactivo')+'</div></div>'+
      (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value">'+esc(c.notas)+'</div></div>':'')+''+
    '</div></div>';
  // Botón asociar empresa/proveedor si no tiene ninguno
  body += '<div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap;">'+
    '<button class="btn-sm" onclick="cerrarDetail();editarContacto(\''+id+'\')" style="font-size:11px;">'+
    ((!c.cliente_id&&!c.proveedor_id)?'🔗 Asociar empresa / proveedor':'✏️ Editar contacto')+
    '</button>'+
  '</div>';
  abrirDetail(nombre,empresa+' · '+(c.cargo||''),ini,body,function(){cerrarDetail();editarContacto(id);});
}

// ── Empleado detail ───────────────────────────────────────
async function verDetalleEmpleado(id){
  var e=empleados.find(function(x){return String(x.id)===String(id);});
  if(!e)return;
  var nombre=(e.nombre||'')+(e.apellido?' '+e.apellido:'');
  var ini=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
  var sc=e.estatus==='Activo'?'#34d399':e.estatus==='Inactivo'?'#fbbf24':'#f87171';
  var body=
    '<div class="detail-section"><div class="detail-kpi-grid">'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Salario mensual</div><div class="detail-kpi-value c-green">'+(e.salario_mensual?fmt(e.salario_mensual):'—')+'</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Vacaciones</div><div class="detail-kpi-value c-blue">'+(e.dias_vacaciones||0)+' días</div></div>'+
      '<div class="detail-kpi"><div class="detail-kpi-label">Estatus</div><div class="detail-kpi-value" style="font-size:13px;color:'+sc+';">'+(e.estatus||'Activo')+'</div></div>'+
    '</div></div>'+
    '<div class="detail-section"><div class="detail-section-title">Datos generales</div><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Cargo</div><div class="detail-field-value">'+(e.cargo||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Área</div><div class="detail-field-value">'+(e.area||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Tipo contrato</div><div class="detail-field-value">'+(e.tipo_contrato||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Fecha ingreso</div><div class="detail-field-value">'+(e.fecha_ingreso?fmtDateFull(e.fecha_ingreso):'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">'+(e.email?'<a href="mailto:'+esc(e.email)+'" style="color:#60a5fa;">'+esc(e.email)+'</a>'+copyBtn(e.email):'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">'+(e.telefono||'—')+(e.telefono?copyBtn(e.telefono):'')+'</div></div>'+
    '</div></div>'+
    '<div class="detail-section"><div class="detail-section-title">Fiscal y bancario</div><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">RFC</div><div class="detail-field-value">'+(e.rfc||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">IMSS / NSS</div><div class="detail-field-value">'+(e.imss||'—')+'</div></div>'+
      '<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">CLABE bancaria</div><div class="detail-field-value">'+(e.clabe||'—')+(e.clabe?copyBtn(e.clabe):'')+'</div></div>'+
    '</div></div>'+
    '<div class="detail-section"><div class="detail-section-title">Documentos</div>'+
      '<div style="display:flex;gap:12px;flex-wrap:wrap;">'+
        '<span style="padding:4px 12px;border-radius:6px;font-size:12px;background:'+(e.tiene_contrato?'#0d2a1422':'#2a0d0d22')+';color:'+(e.tiene_contrato?'#34d399':'#f87171')+';">'+(e.tiene_contrato?'✓':'✗')+' Contrato firmado</span>'+
        '<span style="padding:4px 12px;border-radius:6px;font-size:12px;background:'+(e.imss_activo?'#0d2a1422':'#2a0d0d22')+';color:'+(e.imss_activo?'#34d399':'#f87171')+';">'+(e.imss_activo?'✓':'✗')+' IMSS activo</span>'+
      '</div>'+
    '</div>'+
    ((e.contacto_emergencia_nombre||e.contacto_emergencia_tel)?
      '<div class="detail-section"><div class="detail-section-title">Contacto de emergencia</div><div class="detail-grid">'+
        '<div class="detail-field"><div class="detail-field-label">Nombre</div><div class="detail-field-value">'+(e.contacto_emergencia_nombre||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">'+(e.contacto_emergencia_tel||'—')+'</div></div>'+
      '</div></div>':'')+
    (e.notas?'<div class="detail-section"><div class="detail-section-title">Notas</div><div style="color:var(--text-2);font-size:13px;line-height:1.6;">'+esc(e.notas)+'</div></div>':'');
  abrirDetail(nombre,e.cargo||(e.area||''),ini,body,function(){cerrarDetail();editarEmpleado(id);});
}

// ── Proyecto detail ───────────────────────────────────────
async function verDetalleProyecto(id){
  _pushDetail();
  var p=proyectos.find(function(x){return x.id===id;});
  if(!p)return;
  var ini=(p.nombre_pedido||'?').slice(0,2).toUpperCase();
  abrirDetail(p.nombre_pedido,p.nombre_cliente,ini,'<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarProyecto(id);});
  try{
    var ents=entregasByProyecto[id]||[];
    var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
    var est=estadoProyecto(p,entregadas);
    var lbl=est.lbl||est;
    var color=lbl==='Completado'?'#34d399':lbl==='Atrasado'?'#f87171':'#60a5fa';
    var pct=p.total_piezas>0?Math.round(entregadas/p.total_piezas*100):0;

    // Fetch contacto clave and empresa
    var empresa = (p.cliente_id ? clientes.find(function(c){return c.id===p.cliente_id;}) : null) ||
                  clientes.find(function(c){return c.nombre===p.nombre_cliente;});
    if(!empresa && p.nombre_cliente){
      empresa=await DB.clientes.byNombre(p.nombre_cliente);
    }
    var contactoClave=null;
    if(p.contacto_id){
      contactoClave=await DB.contactos.get(p.contacto_id);
    }
    var usuarioCliente=null;
    if(p.usuario_cliente_id){
      usuarioCliente=await DB.contactos.get(p.usuario_cliente_id);
    }

    var body=
      '<div class="detail-section">'+
        '<div class="detail-kpi-grid">'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Monto total</div><div class="detail-kpi-value c-green">'+fmt(p.monto_total||0)+'</div></div>'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Avance</div><div class="detail-kpi-value" style="color:'+color+';">'+pct+'%</div></div>'+
          '<div class="detail-kpi"><div class="detail-kpi-label">Estado</div><div class="detail-kpi-value" style="font-size:14px;color:'+color+';">'+lbl+'</div></div>'+
        '</div>'+
        '<div style="margin-top:10px;background:var(--bg-card-2);border-radius:6px;height:6px;overflow:hidden;">'+
          '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:6px;"></div>'+
        '</div>'+
      '</div>'+
      '<div class="detail-section"><div class="detail-section-title">Datos del proyecto</div>'+
        '<div class="detail-grid">'+
          '<div class="detail-field"><div class="detail-field-label">Tipo de pieza</div><div class="detail-field-value">'+(p.tipo_pieza||'—')+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Total piezas</div><div class="detail-field-value">'+entregadas+' / '+(p.total_piezas||0)+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Fecha pedido</div><div class="detail-field-value">'+fmtDateFull(p.fecha_pedido)+'</div></div>'+
          '<div class="detail-field"><div class="detail-field-label">Fecha entrega</div><div class="detail-field-value">'+fmtDateFull(p.fecha_entrega)+'</div></div>'+
        '</div>'+
        (p.notas?'<div style="margin-top:8px;" class="detail-field"><div class="detail-field-label">Notas</div><div class="detail-field-value">'+esc(p.notas)+'</div></div>':'')+
      '</div>'+
      // Empresa vinculada
      '<div class="detail-section"><div class="detail-section-title">Empresa</div>'+
        (empresa?
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleEmpresa(\''+empresa.id+'\')">' +
            '<div><div style="font-size:13px;font-weight:500;color:#3B82F6;">'+esc(empresa.nombre)+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+(empresa.rfc||'')+'</div></div>'+
            '<span style="font-size:11px;color:var(--text-3);">→</span>'+
          '</div>':
          '<div style="color:var(--text-4);font-size:12px;padding:8px 0;">'+esc(p.nombre_cliente)+'</div>')+
      '</div>'+
      // Contactos del cliente
      '<div class="detail-section"><div class="detail-section-title">Contactos del cliente</div>'+
        '<div class="detail-grid">'+
          // Contacto de compras
          '<div class="detail-field">'+
            '<div class="detail-field-label">Contacto de compras</div>'+
            (contactoClave?
              '<div class="detail-field-value">'+esc((contactoClave.nombre||'')+(contactoClave.apellido?' '+contactoClave.apellido:''))+'</div>'+
              '<div style="font-size:10px;color:var(--text-3);margin-top:2px;">'+(contactoClave.cargo||'')+(contactoClave.email?' · '+contactoClave.email:'')+'</div>':
              '<div class="detail-field-value" style="color:var(--text-4);">—</div>')+
          '</div>'+
          // Usuario
          '<div class="detail-field">'+
            '<div class="detail-field-label">Usuario (solicitante)</div>'+
            (usuarioCliente?
              '<div class="detail-field-value">'+esc((usuarioCliente.nombre||'')+(usuarioCliente.apellido?' '+usuarioCliente.apellido:''))+'</div>'+
              '<div style="font-size:10px;color:var(--text-3);margin-top:2px;">'+(usuarioCliente.cargo||'')+(usuarioCliente.email?' · '+usuarioCliente.email:'')+'</div>':
              '<div class="detail-field-value" style="color:var(--text-4);">—</div>')+
          '</div>'+
        '</div>'+
        (empresa?'<div style="margin-top:8px;">'+renderBuscarContactoHTML('empresa',empresa.id,empresa.nombre||'')+'</div>':'')+
      '</div>'+
      // Entregas
      '<div class="detail-section">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
          '<div class="detail-section-title" style="margin-bottom:0;">Entregas parciales</div>'+
          '<button class="btn-sm" style="font-size:11px;background:#E8F5E9;color:#2E7D32;border-color:#A5D6A7;" onclick="abrirEntrega(\''+id+'\')">+ Registrar entrega</button>'+
        '</div>'+
        (ents.length
          ? ents.map(function(e){
              return '<div class="detail-list-item">'+
                '<div>'+
                  '<div style="font-size:12px;color:var(--text-1);">'+fmtDateFull(e.fecha)+'</div>'+
                  '<div style="font-size:10px;color:var(--text-3);">'+(e.notas||'')+(e.factura_numero?' · Factura: '+esc(e.factura_numero):'')+'</div>'+
                '</div>'+
                '<div style="text-align:right;">'+
                  '<div style="font-weight:600;color:#34d399;">'+e.piezas+' pzs</div>'+
                  (e.factura_monto?'<div style="font-size:10px;color:var(--text-3);">'+fmt(parseFloat(e.factura_monto)||0)+'</div>':'')+
                '</div>'+
              '</div>';
            }).join('')
          : '<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin entregas registradas</div>')+
      '</div>';
    // F3: Cotizaciones vinculadas a este proyecto/cliente
    var cots=await DB.cotizaciones.byCliente(p.cliente_id, p.nombre_cliente);
    var EST_COLORS_LOCAL={borrador:'#64748b',enviada:'#60a5fa',en_negociacion:'#a78bfa',cerrada:'#34d399',perdida:'#f87171'};
    var EST_LABELS_LOCAL={borrador:'Borrador',enviada:'Enviada',en_negociacion:'En negociación',cerrada:'Cerrada ✓',perdida:'Perdida'};
    body+=
      '<div class="detail-section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Cotizaciones</div>'+
      '</div>'+
      ((cots||[]).length
        ?(cots).map(function(cot){
            var ec=EST_COLORS_LOCAL[cot.estatus]||'#64748b';
            var el=EST_LABELS_LOCAL[cot.estatus]||cot.estatus;
            var vLabel=(cot.version&&cot.version>1)?' <span style="font-size:9px;color:var(--text-3);">v'+cot.version+'</span>':'';
            // Botón PDF — ver si ya existe o generar
            var pdfBtn='';
            if(cot.pdf_path){
              pdfBtn='<button onclick="event.stopPropagation();docsAbrir(\''+cot.pdf_path+'\',\'pdf\')" style="display:inline-flex;align-items:center;gap:3px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;color:#dc2626;cursor:pointer;white-space:nowrap;" title="Ver PDF de cotización">📄 PDF</button>';
            } else if(cot.estatus==='cerrada'){
              pdfBtn='<button onclick="event.stopPropagation();generarPDFCotizacion(\''+cot.id+'\')" style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:3px 8px;font-size:11px;color:#64748b;cursor:pointer;white-space:nowrap;" title="Generar PDF">↓ PDF</button>';
            }
            return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleCotizacion(\''+cot.id+'\')">'+
              '<div style="flex:1;min-width:0;">'+
                '<div style="display:flex;align-items:center;gap:6px;">'+
                  '<span style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc(cot.numero||'COT')+'</span>'+vLabel+
                  '<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:'+ec+'22;color:'+ec+';">'+esc(el)+'</span>'+
                '</div>'+
                '<div style="font-size:10px;color:var(--text-3);margin-top:2px;">'+fmtDateFull(cot.fecha)+
                  (cot.numero_requisicion?' · <span style="font-family:monospace;color:var(--text-2);">REQ: '+esc(cot.numero_requisicion)+'</span>':'')+
                  (cot.usuario_cliente_id?(function(){ var u=(contactos||[]).find(function(x){return x.id===cot.usuario_cliente_id;}); return u?' · <span style="color:var(--text-3);">'+esc((u.nombre||'')+(u.apellido?' '+u.apellido:''))+'</span>':''; })():'')+
                '</div>'+
              '</div>'+
              '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'+
                '<span style="font-weight:600;color:var(--text-1);">'+fmt(cot.total||0)+'</span>'+
                pdfBtn+
              '</div>'+
            '</div>';
          }).join('')
        :'<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin cotizaciones vinculadas</div>')+
      '</div>';

    _setDetailBody(body);

    // Load and render SAT invoices linked to this project
    await renderFacturasProyecto(id, p.cliente_id||null, p.nombre_cliente||null);
  }catch(e){console.error('Detalle proyecto:',e);document.getElementById('detail-body').innerHTML='<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>';}
}

async function renderFacturasProyecto(proyId, clienteId, nombreCliente){
  try{
    // Consultar tabla facturas (vinculadas por proyecto_id)
    var linked = await DB.facturas.porProyecto(proyId);

    // Facturas del cliente sin proyecto (para permitir vincular)
    var unlinked = [];
    if(clienteId){
      unlinked = await DB.facturas.porClienteSinProyecto(clienteId);
    }

    var totalFacturado = linked.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);

    var html = '<div class="detail-section">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Facturas vinculadas</div>'+
        '<span style="font-size:12px;color:#34d399;font-weight:600;">'+(linked.length?fmt(totalFacturado):'')+'</span>'+
      '</div>';

    if(linked.length){
      html += linked.map(function(f){
        var nombre = f.tipo==='emitida' ? (f.receptor_nombre||'') : (f.emisor_nombre||'');
        return '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleFactura(\''+f.id+'\')">'+
          '<div>'+
            '<div style="font-size:12px;color:var(--text-1);">'+(f.numero_factura||f.id.slice(0,12))+
              (nombre?' <span style="font-size:10px;color:var(--text-3);">· '+esc(nombre.slice(0,30))+'</span>':'')+
            '</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(f.fecha)+
              (f.conciliado?' · <span style="color:#34d399;">Cobrada</span>':' · <span style="color:#fbbf24;">Pendiente</span>')+
            '</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<span style="font-weight:600;color:#34d399;">'+fmt(parseFloat(f.total)||0)+'</span>'+
            '<button class="btn-sm" style="color:#f87171;font-size:10px;padding:2px 8px;" onclick="desvincularFacturaProyecto(\''+f.id+'\',\''+proyId+'\')" title="Desvincular">×</button>'+
          '</div>'+
        '</div>';
      }).join('');
    } else {
      html += '<div style="color:var(--text-4);font-size:12px;padding:4px 0;">Sin facturas vinculadas</div>';
    }

    // Facturas del cliente sin proyecto — botón vincular
    if(unlinked.length){
      html += '<div style="margin-top:10px;">'+
        '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px;">Emitidas a '+esc(nombreCliente||'este cliente')+' sin proyecto:</div>'+
        unlinked.map(function(f){
          return '<div class="detail-list-item" style="opacity:.75;">'+
            '<div>'+
              '<div style="font-size:12px;color:var(--text-2);">'+(f.numero_factura||f.id.slice(0,12))+'</div>'+
              '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(f.fecha)+'</div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;">'+
              '<span style="font-size:12px;color:var(--text-2);">'+fmt(parseFloat(f.total)||0)+'</span>'+
              '<button class="btn-sm" style="font-size:10px;padding:2px 8px;" onclick="vincularFacturaProyecto(\''+f.id+'\',\''+proyId+'\')" >+ Vincular</button>'+
            '</div>'+
          '</div>';
        }).join('')+
      '</div>';
    }

    html += '</div>';
    var body = document.getElementById('detail-body');
    if(body) body.innerHTML += html;
  }catch(e){console.warn('Facturas proyecto:',e);}
}

async function vincularFacturaProyecto(facturaId, proyId){
  try{
    await DB.facturas.linkProyecto(facturaId, proyId);
    showStatus('✓ Factura vinculada al proyecto');
    verDetalleProyecto(proyId);
  }catch(e){showError('Error: '+e.message);}
}

async function desvincularFacturaProyecto(facturaId, proyId){
  try{
    await DB.facturas.linkProyecto(facturaId, null);
    showStatus('Factura desvinculada');
    verDetalleProyecto(proyId);
  }catch(e){showError('Error: '+e.message);}
}

// cerrarDetail defined above with stack reset

