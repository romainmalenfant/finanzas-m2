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
    backBtn.style.display='block';
    backBtn.textContent='← '+_detailStack[_detailStack.length-1].titulo;
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
    var {data:cd}=await sb.from('clientes').select('*').eq('id',id).maybeSingle();
    if(!cd)return;
    c=cd;
  }
  var ini=(c.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  abrirDetail(c.nombre,c.rfc||'',ini,'<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarCliente(id);});
  try{
    var año=new Date().getFullYear(); var hoy=new Date();
    // Run queries sequentially to avoid or() issues
    var {data:mv1}=await sb.from('movimientos_v2').select('categoria,tipo,monto,fecha,descripcion,contraparte').eq('year',año).eq('cliente_id',id).order('fecha',{ascending:false}).limit(20);
    var mv2data=[];
    if(c.rfc){
      var {data:mv2}=await sb.from('movimientos_v2').select('categoria,tipo,monto,fecha,descripcion,contraparte').eq('year',año).eq('rfc_contraparte',c.rfc).order('fecha',{ascending:false}).limit(20);
      mv2data=mv2||[];
    }
    var seen={}; var mvmts=[];
    (mv1||[]).concat(mv2data).forEach(function(m){if(!m||!m.monto)return;var k=(m.fecha||'')+(m.monto||'')+(m.descripcion||'');if(!seen[k]){seen[k]=true;mvmts.push(m);}});

    var {data:cx1raw}=await sb.from('facturas').select('total,fecha,concepto,numero_factura').eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente').eq('cliente_id',id);
    var cx1=(cx1raw||[]).map(function(f){return {monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});
    var cx2data=[];
    if(c.rfc){
      var {data:cx2raw}=await sb.from('facturas').select('total,fecha,concepto,numero_factura').eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente').eq('receptor_rfc',c.rfc);
      cx2data=(cx2raw||[]).map(function(f){return {monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});
    }
    var seenC={}; var cxcFacturas=[];
    (cx1||[]).concat(cx2data).forEach(function(m){if(!m||!m.monto)return;var k=(m.fecha||'')+(m.monto||'');if(!seenC[k]){seenC[k]=true;cxcFacturas.push(m);}}); 

    var {data:projs}=await sb.from('proyectos').select('*').ilike('nombre_cliente','%'+c.nombre+'%').eq('year',año);
    var {data:conts}=await sb.from('contactos').select('*').eq('cliente_id',id).order('nombre');

    var ventas=mvmts.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
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
        '</div>'+
      '</div>'+
      (cxcFacturas.length?'<div class="detail-section"><div class="detail-section-title">Facturas por cobrar ('+cxcFacturas.length+')</div>'+
        cxcFacturas.sort(function(a,b){return a.fecha>b.fecha?1:-1;}).map(function(f){
          var dias=f.fecha?Math.floor((hoy-new Date(f.fecha))/(864e5)):0;
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:var(--text-1);">'+(f.numero_factura||f.descripcion||'Sin desc.').slice(0,40)+'</div>'+
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
      '</div>'+
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
    var {data:pd}=await sb.from('proveedores').select('*').eq('id',id).maybeSingle();
    if(!pd)return;
    p=pd;
  }
  var ini=(p.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  abrirDetail(p.nombre,p.rfc||'',ini,'<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarProveedor(id);});
  try{
    var año=new Date().getFullYear(); var hoy=new Date();
    var {data:mv1}=await sb.from('movimientos_v2').select('tipo,monto,fecha,descripcion').eq('year',año).ilike('contraparte','%'+p.nombre+'%').order('fecha',{ascending:false}).limit(20);
    var mv2data=[];
    if(p.rfc){
      var {data:mv2}=await sb.from('movimientos_v2').select('tipo,monto,fecha,descripcion').eq('year',año).eq('rfc_contraparte',p.rfc).order('fecha',{ascending:false}).limit(20);
      mv2data=mv2||[];
    }
    var seen={}; var mvmts=[];
    (mv1||[]).concat(mv2data).forEach(function(m){if(!m||!m.monto)return;var k=(m.fecha||'')+(m.monto||'');if(!seen[k]){seen[k]=true;mvmts.push(m);}});

    var {data:cx1raw}=await sb.from('facturas').select('total,fecha,concepto,numero_factura').eq('tipo','recibida').eq('conciliado',false).eq('estatus','vigente').eq('proveedor_id',String(id));
    var cx1=(cx1raw||[]).map(function(f){return {monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});
    var cx2data=[];
    if(p.rfc){
      var {data:cx2raw}=await sb.from('facturas').select('total,fecha,concepto,numero_factura').eq('tipo','recibida').eq('conciliado',false).eq('estatus','vigente').eq('emisor_rfc',p.rfc);
      cx2data=(cx2raw||[]).map(function(f){return {monto:f.total,fecha:f.fecha,descripcion:f.concepto,numero_factura:f.numero_factura};});
    }
    var seenC={}; var cxp=[];
    (cx1||[]).concat(cx2data).forEach(function(m){if(!m||!m.monto)return;var k=(m.fecha||'')+(m.monto||'');if(!seenC[k]){seenC[k]=true;cxp.push(m);}});

    var totalCompras=mvmts.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
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
        '<div class="detail-field"><div class="detail-field-label">CLABE</div><div class="detail-field-value">'+(p.clabe||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Límite crédito</div><div class="detail-field-value">'+(p.limite_credito?fmt(p.limite_credito):'—')+'</div></div>'+
      '</div>'+
      (p.notas?'<div class="detail-field" style="margin-top:8px;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(p.notas)+'</div></div>':'')+
      (cxp.length?'<div class="detail-section"><div class="detail-section-title">Facturas por pagar</div>'+
        cxp.sort(function(a,b){return a.fecha>b.fecha?1:-1;}).map(function(f){
          var dias=Math.floor((hoy-new Date(f.fecha))/(864e5));
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          var fdesc=(f.numero_factura||f.descripcion||'').replace(/undefined|null/g,'').trim()||'Sin desc.';
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:var(--text-1);">'+esc(fdesc.slice(0,40))+'</div>'+
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
    var {data}=await sb.from('contactos').select('*,clientes(nombre)').eq('id',id).maybeSingle();
    if(!data)return;
    c=data;
  }
  var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
  var ini=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
  var empresa=c.clientes&&c.clientes.nombre?c.clientes.nombre:'Sin empresa';
  var body=
    '<div class="detail-section"><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Cargo</div><div class="detail-field-value">'+(c.cargo||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Empresa</div>'+
      (c.cliente_id?
        '<div class="detail-field-value" style="color:#3B82F6;cursor:pointer;" onclick="verDetalleEmpresa(\''+c.cliente_id+'\')">' + esc(empresa) + '</div>'
        :'<div class="detail-field-value">'+esc(empresa)+'</div>')+
      '</div>'+
      '<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">'+(c.email?'<a href="mailto:'+esc(c.email)+'" style="color:#60a5fa;">'+esc(c.email)+'</a>':'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">'+(c.telefono||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Estatus</div><div class="detail-field-value" style="color:'+(c.activo!==false?'#34d399':'#f87171')+'">'+(c.activo!==false?'Activo':'Inactivo')+'</div></div>'+
      (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value">'+esc(c.notas)+'</div></div>':'')+''+
    '</div></div>';
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
      '<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">'+(e.email?'<a href="mailto:'+esc(e.email)+'" style="color:#60a5fa;">'+esc(e.email)+'</a>':'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">'+(e.telefono||'—')+'</div></div>'+
    '</div></div>'+
    '<div class="detail-section"><div class="detail-section-title">Fiscal y bancario</div><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">RFC</div><div class="detail-field-value">'+(e.rfc||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">IMSS / NSS</div><div class="detail-field-value">'+(e.imss||'—')+'</div></div>'+
      '<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">CLABE bancaria</div><div class="detail-field-value">'+(e.clabe||'—')+'</div></div>'+
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
      var {data:empData}=await sb.from('clientes').select('*').ilike('nombre','%'+p.nombre_cliente+'%').limit(1).maybeSingle();
      if(empData) empresa=empData;
    }
    var contactoClave=null;
    if(p.contacto_id){
      var {data:ct}=await sb.from('contactos').select('*').eq('id',p.contacto_id).maybeSingle();
      contactoClave=ct;
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
      // Contacto clave
      '<div class="detail-section">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
          '<div class="detail-section-title" style="margin-bottom:0;">Contacto clave</div>'+
        '</div>'+
        (contactoClave?
          '<div class="detail-list-item">'+
            '<div><div style="font-size:13px;font-weight:500;color:var(--text-1);">'+(contactoClave.nombre||'')+(contactoClave.apellido?' '+contactoClave.apellido:'')+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+(contactoClave.cargo||'')+(contactoClave.email?' · '+contactoClave.email:'')+'</div></div>'+
            (contactoClave.telefono?'<span style="font-size:11px;color:var(--text-3);">'+esc(contactoClave.telefono)+'</span>':'')+
          '</div>':
          '<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin contacto clave asignado</div>')+
      '</div>'+
      // Entregas
      (ents.length?'<div class="detail-section"><div class="detail-section-title">Historial de entregas</div>'+
        ents.map(function(e){
          return '<div class="detail-list-item">'+
            '<div><div style="font-size:12px;color:var(--text-1);">'+fmtDateFull(e.fecha)+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+(e.notas||'')+'</div></div>'+
            '<span style="font-weight:600;color:#34d399;">'+e.piezas+' pzs</span>'+
          '</div>';
        }).join('')+'</div>':'');
    _setDetailBody(body);

    // Load and render SAT invoices linked to this project
    await renderFacturasProyecto(id, p.cliente_id||null, p.nombre_cliente||null);
  }catch(e){console.error('Detalle proyecto:',e);document.getElementById('detail-body').innerHTML='<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>';}
}

async function renderFacturasProyecto(proyId, clienteId, nombreCliente){
  try{
    // Get invoices linked to this project OR to this client (sat_emitida)
    var queries = [];
    var {data:byProj} = await sb.from('movimientos_v2')
      .select('id,fecha,contraparte,rfc_contraparte,monto,numero_factura,conciliado,cliente_id,proyecto_id')
      .eq('origen','sat_emitida')
      .eq('proyecto_id', proyId)
      .limit(50);
    queries = byProj||[];

    // Also get unlinked invoices for this client (to allow linking)
    var unlinked = [];
    if(clienteId){
      var {data:byClient} = await sb.from('movimientos_v2')
        .select('id,fecha,contraparte,rfc_contraparte,monto,numero_factura,conciliado,cliente_id,proyecto_id')
        .eq('origen','sat_emitida')
        .eq('cliente_id', clienteId)
        .is('proyecto_id', null)
        .limit(50);
      unlinked = byClient||[];
    }

    var linkedIds = new Set(queries.map(function(f){return f.id;}));
    var totalFacturado = queries.reduce(function(a,f){return a+(parseFloat(f.monto)||0);},0);

    var html = '<div class="detail-section">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Facturas SAT vinculadas</div>'+
        '<span style="font-size:12px;color:#34d399;font-weight:600;">'+fmt(totalFacturado)+'</span>'+
      '</div>';

    if(queries.length){
      html += queries.map(function(f){
        return '<div class="detail-list-item">'+
          '<div>'+
            '<div style="font-size:12px;color:var(--text-1);">'+(f.numero_factura||f.id.slice(0,12))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(f.fecha)+(f.conciliado?' · <span style="color:#34d399;">Cobrada</span>':' · <span style="color:#fbbf24;">Pendiente</span>')+'</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<span style="font-weight:600;color:#34d399;">'+fmt(parseFloat(f.monto)||0)+'</span>'+
            '<button class="btn-sm" style="color:#f87171;font-size:10px;padding:2px 8px;" onclick="desvincularFacturaProyecto(\''+f.id+'\',\''+proyId+'\')" title="Desvincular">×</button>'+
          '</div>'+
        '</div>';
      }).join('');
    } else {
      html += '<div style="color:var(--text-4);font-size:12px;padding:4px 0;">Sin facturas vinculadas</div>';
    }

    // Unlinked invoices for this client — show button to link
    if(unlinked.length){
      html += '<div style="margin-top:10px;">'+
        '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px;">Facturas de '+esc(nombreCliente||'este cliente')+' sin proyecto:</div>'+
        unlinked.map(function(f){
          return '<div class="detail-list-item" style="opacity:.75;">'+
            '<div>'+
              '<div style="font-size:12px;color:var(--text-2);">'+(f.numero_factura||f.id.slice(0,12))+'</div>'+
              '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(f.fecha)+'</div>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;">'+
              '<span style="font-size:12px;color:var(--text-2);">'+fmt(parseFloat(f.monto)||0)+'</span>'+
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
    await sb.from('movimientos_v2').update({proyecto_id: proyId}).eq('id', facturaId);
    showStatus('✓ Factura vinculada al proyecto');
    verDetalleProyecto(proyId);
  }catch(e){showError('Error: '+e.message);}
}

async function desvincularFacturaProyecto(facturaId, proyId){
  try{
    await sb.from('movimientos_v2').update({proyecto_id: null}).eq('id', facturaId);
    showStatus('Factura desvinculada');
    verDetalleProyecto(proyId);
  }catch(e){showError('Error: '+e.message);}
}

// cerrarDetail defined above with stack reset

