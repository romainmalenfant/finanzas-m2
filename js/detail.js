// ── Detail views ─────────────────────────────────────────
function abrirDetail(titulo, subtitulo, iniciales, bodyHTML, editFn){
  document.getElementById('detail-title').textContent=titulo;
  document.getElementById('detail-subtitle').textContent=subtitulo||'';
  document.getElementById('detail-avatar').textContent=iniciales||'?';
  document.getElementById('detail-body').innerHTML=bodyHTML;
  var eb=document.getElementById('detail-edit-btn');
  if(editFn){eb.style.display='block';eb.onclick=editFn;}
  else eb.style.display='none';
  document.getElementById('detail-modal').style.display='block';
}

// ── Empresa detail ────────────────────────────────────────
async function verDetalleEmpresa(id){
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
  abrirDetail(c.nombre,c.rfc||'',ini,'<div style="padding:16px;color:#475569;font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarCliente(id);});
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
    [(mv1||[])].concat(mv2data).forEach(function(m){var k=m.fecha+m.monto+m.descripcion;if(!seen[k]){seen[k]=true;mvmts.push(m);}});

    var {data:cx1}=await sb.from('movimientos_v2').select('monto,fecha,descripcion,numero_factura').eq('origen','sat_emitida').eq('conciliado',false).eq('cliente_id',id);
    var cx2data=[];
    if(c.rfc){
      var {data:cx2}=await sb.from('movimientos_v2').select('monto,fecha,descripcion,numero_factura').eq('origen','sat_emitida').eq('conciliado',false).eq('rfc_contraparte',c.rfc);
      cx2data=cx2||[];
    }
    var seenC={}; var cxcFacturas=[];
    [(cx1||[])].concat(cx2data).forEach(function(m){var k=m.fecha+m.monto;if(!seenC[k]){seenC[k]=true;cxcFacturas.push(m);}});

    var {data:projs}=await sb.from('proyectos').select('*').ilike('nombre_cliente','%'+c.nombre+'%').eq('year',año);
    var {data:conts}=await sb.from('contactos').select('*').eq('cliente_id',id).order('nombre');

    var ventas=mvmts.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
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
          var dias=Math.floor((hoy-new Date(f.fecha))/(864e5));
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:#e2e8f0;">'+(f.numero_factura||f.descripcion||'Sin desc.').slice(0,40)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+fmtDateFull(f.fecha)+' · <span style="color:'+color+';">'+dias+'d</span></div></div>'+
            '<span style="font-weight:600;color:#fbbf24;">'+fmt(parseFloat(f.monto)||0)+'</span></div>';
        }).join('')+'</div>':'')  +
      ((projs||[]).length?'<div class="detail-section"><div class="detail-section-title">Proyectos '+año+'</div>'+
        projs.map(function(p){
          return '<div class="detail-list-item" style="cursor:pointer;" onclick="cerrarDetail();setTimeout(function(){verDetalleProyecto(\''+p.id+'\');},100)">'+
            '<div><div style="font-size:12px;color:#60a5fa;">'+esc(p.nombre_pedido)+'</div>'+
            '<div style="font-size:10px;color:#475569;">Entrega: '+fmtDateFull(p.fecha_entrega)+'</div></div>'+
            '<span style="font-weight:600;color:#94a3b8;">'+fmt(p.monto_total||0)+'</span></div>';
        }).join('')+'</div>':'') +
      '<div class="detail-section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
        '<div class="detail-section-title" style="margin-bottom:0;">Contactos</div>'+
      '</div>'+
      ((conts||[]).length?(conts).map(function(ct){
        var nombre=(ct.nombre||'')+(ct.apellido?' '+ct.apellido:'');
        return '<div class="detail-list-item"><div><div style="font-size:12px;color:#e2e8f0;">'+esc(nombre)+'</div>'+
          '<div style="font-size:10px;color:#475569;">'+(ct.cargo||'')+(ct.email?' · '+ct.email:'')+'</div></div>'+
          (ct.telefono?'<span style="font-size:11px;color:#475569;">'+esc(ct.telefono)+'</span>':'')+'</div>';
      }).join(''):'<div style="color:#334155;font-size:12px;padding:8px 0;">Sin contactos</div>')+
      '</div>'+
      (mvmts.length?'<div class="detail-section"><div class="detail-section-title">Últimos movimientos '+año+'</div>'+
        mvmts.slice(0,6).map(function(m){
          var col=CAT_COLORS[m.categoria]||'#475569';
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:#e2e8f0;">'+(m.descripcion||m.contraparte||'').slice(0,40)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+fmtDate(m.fecha)+' · '+(CAT_LABELS[m.categoria]||m.categoria)+'</div></div>'+
            '<span style="font-weight:600;color:'+col+';">'+(m.tipo==='egreso'?'−':'+')+fmt(m.monto)+'</span></div>';
        }).join('')+'</div>':'');
    document.getElementById('detail-body').innerHTML=body;
  }catch(e){
    console.error('Detalle empresa:',e);
    document.getElementById('detail-body').innerHTML='<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>';
  }
}

async function verDetalleProveedor(id){
  if(!proveedores.length) await loadProveedores();
  var p=proveedores.find(function(x){return String(x.id)===String(id);});
  if(!p){
    var {data:pd}=await sb.from('proveedores').select('*').eq('id',id).maybeSingle();
    if(!pd)return;
    p=pd;
  }
  var ini=(p.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
  abrirDetail(p.nombre,p.rfc||'',ini,'<div style="padding:16px;color:#475569;font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarProveedor(id);});
  try{
    var año=new Date().getFullYear(); var hoy=new Date();
    var {data:mv1}=await sb.from('movimientos_v2').select('tipo,monto,fecha,descripcion').eq('year',año).ilike('contraparte','%'+p.nombre+'%').order('fecha',{ascending:false}).limit(20);
    var mv2data=[];
    if(p.rfc){
      var {data:mv2}=await sb.from('movimientos_v2').select('tipo,monto,fecha,descripcion').eq('year',año).eq('rfc_contraparte',p.rfc).order('fecha',{ascending:false}).limit(20);
      mv2data=mv2||[];
    }
    var seen={}; var mvmts=[];
    [(mv1||[])].concat(mv2data).forEach(function(m){var k=m.fecha+m.monto;if(!seen[k]){seen[k]=true;mvmts.push(m);}});

    var {data:cx1}=await sb.from('movimientos_v2').select('monto,fecha,descripcion,numero_factura').eq('origen','sat_recibida').eq('conciliado',false).ilike('contraparte','%'+p.nombre+'%');
    var cx2data=[];
    if(p.rfc){
      var {data:cx2}=await sb.from('movimientos_v2').select('monto,fecha,descripcion,numero_factura').eq('origen','sat_recibida').eq('conciliado',false).eq('rfc_contraparte',p.rfc);
      cx2data=cx2||[];
    }
    var seenC={}; var cxp=[];
    [(cx1||[])].concat(cx2data).forEach(function(m){var k=m.fecha+m.monto;if(!seenC[k]){seenC[k]=true;cxp.push(m);}});

    var totalCompras=mvmts.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+Number(m.monto);},0);
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
        '<div class="detail-field"><div class="detail-field-label">Tipo</div><div class="detail-field-value">'+(p.tipo||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Condiciones</div><div class="detail-field-value">'+(p.condiciones_pago||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Categoría</div><div class="detail-field-value">'+(p.categoria||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Calificación</div><div class="detail-field-value">'+(p.calificacion?'⭐'.repeat(p.calificacion):'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">CLABE</div><div class="detail-field-value">'+(p.clabe||'—')+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Límite crédito</div><div class="detail-field-value">'+(p.limite_credito?fmt(p.limite_credito):'—')+'</div></div>'+
      '</div>'+
      (p.notas?'<div class="detail-field" style="margin-top:8px;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:#94a3b8;">'+esc(p.notas)+'</div></div>':'')+
      (cxp.length?'<div class="detail-section"><div class="detail-section-title">Facturas por pagar</div>'+
        cxp.sort(function(a,b){return a.fecha>b.fecha?1:-1;}).map(function(f){
          var dias=Math.floor((hoy-new Date(f.fecha))/(864e5));
          var color=dias>60?'#f87171':dias>30?'#fbbf24':'#34d399';
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:#e2e8f0;">'+(f.numero_factura||f.descripcion||'Sin desc.').slice(0,40)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+fmtDateFull(f.fecha)+' · <span style="color:'+color+';">'+dias+'d</span></div></div>'+
            '<span style="font-weight:600;color:#f87171;">'+fmt(f.monto)+'</span></div>';
        }).join('')+'</div>':'')+
      (mvmts.length?'<div class="detail-section"><div class="detail-section-title">Últimos movimientos</div>'+
        mvmts.slice(0,6).map(function(m){
          return '<div class="detail-list-item"><div><div style="font-size:12px;color:#e2e8f0;">'+(m.descripcion||'').slice(0,40)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+fmtDate(m.fecha)+'</div></div>'+
            '<span style="font-weight:600;color:#f87171;">'+fmt(m.monto)+'</span></div>';
        }).join('')+'</div>':'');
    document.getElementById('detail-body').innerHTML=body;
  }catch(e){
    console.error('Detalle proveedor:',e);
    document.getElementById('detail-body').innerHTML='<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>';
  }
}

async function verDetalleContacto(id){
  var c=contactos.find(function(x){return x.id===id;});
  if(!c)return;
  var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
  var ini=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
  var empresa=c.clientes&&c.clientes.nombre?c.clientes.nombre:'Sin empresa';
  var body=
    '<div class="detail-section"><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Cargo</div><div class="detail-field-value">'+(c.cargo||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Empresa</div><div class="detail-field-value" style="color:#60a5fa;cursor:pointer;" onclick="'+
        (c.cliente_id?'document.getElementById(\'detail-modal\').style.display=\'none\';setTimeout(function(){verDetalleEmpresa(\''+c.cliente_id+'\');},100)':'')
      +'">'+esc(empresa)+'</div></div>'+
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
  var body=
    '<div class="detail-section"><div class="detail-grid">'+
      '<div class="detail-field"><div class="detail-field-label">Cargo</div><div class="detail-field-value">'+(e.cargo||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Área</div><div class="detail-field-value">'+(e.area||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Salario mensual</div><div class="detail-field-value c-green">'+(e.salario_mensual?fmt(e.salario_mensual):'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Fecha ingreso</div><div class="detail-field-value">'+(e.fecha_ingreso?fmtDateFull(e.fecha_ingreso):'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value">'+(e.email?'<a href="mailto:'+esc(e.email)+'" style="color:#60a5fa;">'+esc(e.email)+'</a>':'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Teléfono</div><div class="detail-field-value">'+(e.telefono||'—')+'</div></div>'+
      '<div class="detail-field"><div class="detail-field-label">Estatus</div><div class="detail-field-value" style="color:'+(e.estatus==='Activo'?'#34d399':e.estatus==='Inactivo'?'#fbbf24':'#f87171')+';">'+(e.estatus||'Activo')+'</div></div>'+
    '</div></div>';
  abrirDetail(nombre,e.cargo||(e.area||''),ini,body,function(){cerrarDetail();editarEmpleado(id);});
}

// ── Proyecto detail ───────────────────────────────────────
async function verDetalleProyecto(id){
  var p=proyectos.find(function(x){return x.id===id;});
  if(!p)return;
  var ini=(p.nombre_pedido||'?').slice(0,2).toUpperCase();
  abrirDetail(p.nombre_pedido,p.nombre_cliente,ini,'<div style="padding:16px;color:#475569;font-size:12px;">Cargando...</div>',function(){cerrarDetail();editarProyecto(id);});
  try{
    var ents=entregasByProyecto[id]||[];
    var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
    var est=estadoProyecto(p,entregadas);
    var lbl=est.lbl||est;
    var color=lbl==='Completado'?'#34d399':lbl==='Atrasado'?'#f87171':'#60a5fa';
    var pct=p.total_piezas>0?Math.round(entregadas/p.total_piezas*100):0;

    // Fetch contacto clave and empresa
    var empresa=clientes.find(function(c){return c.nombre===p.nombre_cliente;});
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
        '<div style="margin-top:10px;background:#12172a;border-radius:6px;height:6px;overflow:hidden;">'+
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
          '<div class="detail-list-item" style="cursor:pointer;" onclick="document.getElementById(\'detail-modal\').style.display=\'none\';setTimeout(function(){verDetalleEmpresa(\''+empresa.id+'\');},100)">'+
            '<div><div style="font-size:13px;font-weight:500;color:#60a5fa;">'+esc(empresa.nombre)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+(empresa.rfc||'')+'</div></div>'+
            '<span style="font-size:11px;color:#475569;">Ver detalle →</span>'+
          '</div>':
          '<div style="color:#334155;font-size:12px;padding:8px 0;">'+esc(p.nombre_cliente)+'</div>')+
      '</div>'+
      // Contacto clave
      '<div class="detail-section">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
          '<div class="detail-section-title" style="margin-bottom:0;">Contacto clave</div>'+
        '</div>'+
        (contactoClave?
          '<div class="detail-list-item">'+
            '<div><div style="font-size:13px;font-weight:500;color:#e2e8f0;">'+(contactoClave.nombre||'')+(contactoClave.apellido?' '+contactoClave.apellido:'')+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+(contactoClave.cargo||'')+(contactoClave.email?' · '+contactoClave.email:'')+'</div></div>'+
            (contactoClave.telefono?'<span style="font-size:11px;color:#475569;">'+esc(contactoClave.telefono)+'</span>':'')+
          '</div>':
          '<div style="color:#334155;font-size:12px;padding:8px 0;">Sin contacto clave asignado</div>')+
      '</div>'+
      // Entregas
      (ents.length?'<div class="detail-section"><div class="detail-section-title">Historial de entregas</div>'+
        ents.map(function(e){
          return '<div class="detail-list-item">'+
            '<div><div style="font-size:12px;color:#e2e8f0;">'+fmtDateFull(e.fecha)+'</div>'+
            '<div style="font-size:10px;color:#475569;">'+(e.notas||'')+'</div></div>'+
            '<span style="font-weight:600;color:#34d399;">'+e.piezas+' pzs</span>'+
          '</div>';
        }).join('')+'</div>':'');
    document.getElementById('detail-body').innerHTML=body;
  }catch(e){console.error('Detalle proyecto:',e);document.getElementById('detail-body').innerHTML='<div style="padding:16px;color:#f87171;font-size:12px;">Error: '+esc(String(e.message||e))+'</div>';}
}

function cerrarDetail(){document.getElementById('detail-modal').style.display='none';}

