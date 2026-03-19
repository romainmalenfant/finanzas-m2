// ── Global search Cmd+K ───────────────────────────────────
var kbarSelectedIdx=-1;
var kbarItems=[];

function abrirKBar(){
  document.getElementById('kbar-overlay').style.display='flex';
  var inp=document.getElementById('kbar-input');
  inp.value='';
  inp.focus();
  kbarSelectedIdx=-1;
  buscarKBar('');
}

function cerrarKBar(){
  document.getElementById('kbar-overlay').style.display='none';
}

function navegarKBar(e){
  if(e.key==='Escape'){cerrarKBar();return;}
  var items=document.querySelectorAll('.kbar-item');
  if(e.key==='ArrowDown'){
    e.preventDefault();
    kbarSelectedIdx=Math.min(kbarSelectedIdx+1,items.length-1);
    items.forEach(function(el,i){el.classList.toggle('selected',i===kbarSelectedIdx);});
    if(items[kbarSelectedIdx])items[kbarSelectedIdx].scrollIntoView({block:'nearest'});
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    kbarSelectedIdx=Math.max(kbarSelectedIdx-1,0);
    items.forEach(function(el,i){el.classList.toggle('selected',i===kbarSelectedIdx);});
    if(items[kbarSelectedIdx])items[kbarSelectedIdx].scrollIntoView({block:'nearest'});
  }else if(e.key==='Enter'){
    if(items[kbarSelectedIdx])items[kbarSelectedIdx].click();
  }
}

function kbarGoTo(tab,extraFn){
  cerrarKBar();
  switchTab(tab,document.getElementById('sb-'+tab));
  if(extraFn)setTimeout(extraFn,150);
}

function buscarKBar(q){
  var res=document.getElementById('kbar-results');
  var ql=q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  kbarSelectedIdx=-1;

  // Sin query — mostrar acciones rápidas
  if(!ql.trim()){
    res.innerHTML=
      '<div class="kbar-section">Navegación rápida</div>'+
      APP_MODULES.map(function(m){
        return '<div class="kbar-item" onclick="kbarGoTo(\''+m.id+'\')">'+
          '<div class="kbar-item-icon" style="background:#12172a;">'+m.icon+'</div>'+
          '<div class="kbar-item-main"><div class="kbar-item-name">'+m.label+'</div></div>'+
        '</div>';
      }).join('')+
      '<div class="kbar-section" style="margin-top:4px;">Acciones</div>'+
      '<div class="kbar-item" onclick="cerrarKBar();abrirFormMovimiento(\'venta\')">'+
        '<div class="kbar-item-icon" style="background:#0d2a14;">📋</div>'+
        '<div class="kbar-item-main"><div class="kbar-item-name">Registrar venta</div></div>'+
      '</div>'+
      '<div class="kbar-item" onclick="cerrarKBar();abrirFormMovimiento(\'cobranza\')">'+
        '<div class="kbar-item-icon" style="background:#0d1f3c;">💰</div>'+
        '<div class="kbar-item-main"><div class="kbar-item-name">Registrar cobranza</div></div>'+
      '</div>'+
      '<div class="kbar-item" onclick="cerrarKBar();abrirFormMovimiento(\'gasto\')">'+
        '<div class="kbar-item-icon" style="background:#2a0d0d;">🧾</div>'+
        '<div class="kbar-item-main"><div class="kbar-item-name">Registrar gasto</div></div>'+
      '</div>';
    return;
  }

  var sections=[];

  // Empresas (clientes)
  var cliMatch=(clientes||[]).filter(function(c){
    return (c.nombre||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(ql)||
           (c.rfc||'').toLowerCase().includes(ql)||
           (c.ciudad||'').toLowerCase().includes(ql);
  }).slice(0,4);
  if(cliMatch.length){
    sections.push('<div class="kbar-section">Empresas</div>'+
      cliMatch.map(function(c){
        var ini=(c.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
        return '<div class="kbar-item" onclick="cerrarKBar();verDetalleEmpresa(\''+c.id+'\')">'+
          '<div class="kbar-item-icon" style="background:#12172a;color:#60a5fa;font-size:11px;font-weight:600;">'+esc(ini)+'</div>'+
          '<div class="kbar-item-main">'+
            '<div class="kbar-item-name">'+esc(c.nombre)+'</div>'+
            '<div class="kbar-item-sub">'+(c.rfc||'')+(c.ciudad?' · '+c.ciudad:'')+'</div>'+
          '</div>'+
          '<span class="kbar-item-badge">Empresa</span>'+
        '</div>';
      }).join(''));
  }

  // Proyectos
  var projMatch=(proyectos||[]).filter(function(p){
    return (p.nombre_cliente||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(ql)||
           (p.nombre_pedido||'').toLowerCase().includes(ql)||
           (p.tipo_pieza||'').toLowerCase().includes(ql);
  }).slice(0,4);
  if(projMatch.length){
    sections.push('<div class="kbar-section">Proyectos</div>'+
      projMatch.map(function(p){
        var ents=typeof entregasByProyecto!=='undefined'?(entregasByProyecto[p.id]||[]):[];
        var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
        var est=estadoProyecto(p,entregadas);
        var lbl=est.lbl||est;
        var color=lbl==='Completado'?'#34d399':lbl==='Atrasado'?'#f87171':'#60a5fa';
        return '<div class="kbar-item" onclick="cerrarKBar();verDetalleProyecto(\''+p.id+'\')" >'+
          '<div class="kbar-item-icon" style="background:#12172a;">📋</div>'+
          '<div class="kbar-item-main">'+
            '<div class="kbar-item-name">'+esc(p.nombre_pedido)+'</div>'+
            '<div class="kbar-item-sub">'+esc(p.nombre_cliente)+' · '+fmt(p.monto_total||0)+'</div>'+
          '</div>'+
          '<span class="kbar-item-badge" style="color:'+color+';">'+lbl+'</span>'+
        '</div>';
      }).join(''));
  }

  // Movimientos
  var mvMatch=(movements||[]).filter(function(m){
    return (m.descripcion||'').toLowerCase().includes(ql)||
           (m.contraparte||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(ql);
  }).slice(0,4);
  if(mvMatch.length){
    sections.push('<div class="kbar-section">Movimientos del mes</div>'+
      mvMatch.map(function(m){
        var col=CAT_COLORS[m.categoria]||'#475569';
        return '<div class="kbar-item" onclick="kbarGoTo(\'finanzas\')">'+
          '<div class="kbar-item-icon" style="background:#12172a;">'+
            '<div style="width:8px;height:8px;border-radius:50%;background:'+col+';"></div>'+
          '</div>'+
          '<div class="kbar-item-main">'+
            '<div class="kbar-item-name">'+esc((m.contraparte||m.descripcion||'').slice(0,45))+'</div>'+
            '<div class="kbar-item-sub">'+fmtDate(m.fecha)+' · '+(CAT_LABELS[m.categoria]||m.categoria)+'</div>'+
          '</div>'+
          '<span class="kbar-item-badge" style="color:'+col+';">'+(m.tipo==='egreso'?'−':'+')+fmt(parseFloat(m.monto)||0)+'</span>'+
        '</div>';
      }).join(''));
  }

  // Contactos
  var contMatch=(contactos||[]).filter(function(c){
    return (c.nombre||'').toLowerCase().includes(ql)||
           (c.apellido||'').toLowerCase().includes(ql)||
           (c.cargo||'').toLowerCase().includes(ql)||
           (c.email||'').toLowerCase().includes(ql);
  }).slice(0,3);
  if(contMatch.length){
    sections.push('<div class="kbar-section">Contactos</div>'+
      contMatch.map(function(c){
        var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
        return '<div class="kbar-item" onclick="cerrarKBar();verDetalleContacto(\''+c.id+'\')">'+
          '<div class="kbar-item-icon" style="background:#12172a;color:#60a5fa;font-size:11px;font-weight:600;">'+
            esc(nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?')+
          '</div>'+
          '<div class="kbar-item-main">'+
            '<div class="kbar-item-name">'+esc(nombre)+'</div>'+
            '<div class="kbar-item-sub">'+(c.cargo||'')+(c.clientes&&c.clientes.nombre?' · '+c.clientes.nombre:'')+'</div>'+
          '</div>'+
          '<span class="kbar-item-badge">Contacto</span>'+
        '</div>';
      }).join(''));
  }

  if(!sections.length){
    res.innerHTML='<div class="kbar-empty">Sin resultados para "'+esc(q)+'"</div>';
  }else{
    res.innerHTML=sections.join('');
  }

  // Cotizaciones
  var cotMatch=(cotizaciones||[]).filter(function(c){
    return (c.numero||'').toLowerCase().includes(ql)||
           (c.cliente_nombre||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(ql);
  }).slice(0,4);
  if(cotMatch.length){
    var EST_C={borrador:'#475569',enviada:'#60a5fa',cerrada:'#34d399',perdida:'#f87171'};
    sections.push('<div class="kbar-section">Cotizaciones</div>'+
      cotMatch.map(function(c){
        var color=EST_C[c.estatus]||'#475569';
        return '<div class="kbar-item" onclick="cerrarKBar();verDetalleCotizacion(\''+c.id+'\')">'+
          '<div class="kbar-item-icon" style="background:#12172a;color:'+color+';font-size:11px;font-weight:600;">COT</div>'+
          '<div class="kbar-item-main">'+
            '<div class="kbar-item-name">'+esc(c.numero||'')+'</div>'+
            '<div class="kbar-item-sub">'+esc(c.cliente_nombre||'')+ ' · '+fmt(c.total||0)+'</div>'+
          '</div>'+
          '<span class="kbar-item-badge" style="color:'+color+';">'+(c.estatus||'')+'</span>'+
        '</div>';
      }).join(''));
    res.innerHTML=sections.join('');
  }
}

// Keyboard shortcut
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&e.key==='f'){
    e.preventDefault();
    var overlay=document.getElementById('kbar-overlay');
    if(overlay.style.display==='flex')cerrarKBar();
    else abrirKBar();
  }
  if(e.key==='Escape'){
    // Close kbar first
    var kb=document.getElementById('kbar-overlay');
    if(kb&&kb.style.display==='flex'){cerrarKBar();return;}
    // Close detail modal
    var dm=document.getElementById('detail-modal');
    if(dm&&dm.style.display==='flex'){dm.style.display='none';return;}
    // Close any open modal (flex = open)
    var modals=['cot-modal','conv-modal','form-mvmt-modal','proj-modal',
                'cliente-modal','prov-modal','contacto-modal','empleado-modal',
                'entrega-modal','sat-preview-modal','fact-modal'];
    for(var i=0;i<modals.length;i++){
      var m=document.getElementById(modals[i]);
      if(m&&m.style.display==='flex'){m.style.display='none';return;}
    }
  }
});

