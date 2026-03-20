// ── Proyectos UI ─────────────────────────────────────────
function estadoProyecto(p, entregadas){
  if(p.total_piezas>0&&entregadas>=p.total_piezas)return{cls:'st-completo',lbl:'Completado'};
  if(p.fecha_entrega&&new Date(p.fecha_entrega+'T12:00')<new Date()&&entregadas<p.total_piezas)return{cls:'st-atrasado',lbl:'Atrasado'};
  return{cls:'st-proceso',lbl:'En proceso'};
}

function renderProyectos(){
  var el=document.getElementById('proyectos-list');
  var ct=document.getElementById('proj-count');
  ct.textContent=proyectos.length+' proyecto'+(proyectos.length!==1?'s':'');
  if(!proyectos.length){el.innerHTML='<div class="empty-state">Sin proyectos. Crea el primero con el botón de arriba.</div>';return;}
  el.innerHTML=proyectos.map(function(p){
    var entregas=entregasByProyecto[p.id]||[];
    var total=Number(p.total_piezas)||0;
    var entregadas=entregas.reduce(function(a,e){return a+(parseFloat(e.piezas)||0);},0);
    var faltantes=Math.max(0,total-entregadas);
    var pct=total>0?Math.round((entregadas/total)*100):0;
    var monto=(parseFloat(p.monto_total)||0)||0;
    var montoEntregado=entregas.reduce(function(a,e){return a+Number(e.factura_monto||0);},0);
    var est=estadoProyecto(p,entregadas);

    // Tabla de entregas
    // Add detail click to proj header
    var entregasHTML='';
    if(entregas.length){
      entregasHTML='<div style="margin-top:12px;">'+
        '<div style="font-size:11px;font-weight:500;color:#888780;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Historial de entregas</div>'+
        '<div style="border:.5px solid #d3d1c7;border-radius:8px;overflow:hidden;">'+
        entregas.map(function(e,i){
          return '<div style="display:grid;grid-template-columns:80px 60px 90px 1fr;gap:8px;align-items:center;padding:8px 10px;font-size:12px;'+(i>0?'border-top:.5px solid #eeecea;':'')+' background:'+(i%2?'#F9F8F5':'#fff')+'">'+
            '<span style="color:#73726c;">'+fmtDate(e.fecha)+'</span>'+
            '<span style="font-weight:500;">'+e.piezas+' pz</span>'+
            '<span style="color:#185FA5;font-weight:500;">'+(e.factura_numero?esc(e.factura_numero):'-')+'</span>'+
            '<span style="color:#3B6D11;font-weight:500;text-align:right;">'+(e.factura_monto?fmt(parseFloat(e.factura_monto)||0):'-')+'</span>'+
          '</div>';
        }).join('')+
        '</div>'+
        '<div style="display:flex;justify-content:flex-end;font-size:11px;color:#73726c;margin-top:4px;">'+
          'Facturado: <b style="margin-left:4px;color:#3B6D11;">'+fmt(montoEntregado)+'</b>'+
          (monto?' &nbsp;/&nbsp; Pendiente: <b style="margin-left:4px;color:#854F0B;">'+fmt(monto-montoEntregado)+'</b>':'')+
        '</div>'+
      '</div>';
    }

    return '<div class="proj-card">'+
      '<div class="proj-hdr" style="cursor:pointer;" onclick="verDetalleProyecto(\''+p.id+'\')">'+
        '<div class="proj-title">'+
          '<div class="proj-nombre">'+esc(p.nombre_pedido)+'</div>'+
          '<div class="proj-cliente">'+esc(p.nombre_cliente)+(p.tipo_pieza?' · '+esc(p.tipo_pieza):'')+'</div>'+
        '</div>'+
        '<span class="proj-status '+est.cls+'">'+est.lbl+'</span>'+
        '<div class="proj-piezas">'+
          '<div class="proj-piezas-num">'+entregadas+'<span style="font-size:12px;font-weight:400;color:#888780;">/'+total+'</span></div>'+
          '<div class="proj-piezas-lbl">piezas</div>'+
        '</div>'+
      '</div>'+
      '<div class="proj-body" id="proj-body-'+p.id+'" style="display:none;">'+
        '<div class="proj-progress"><div class="proj-progress-bar" style="width:'+pct+'%"></div></div>'+
        '<div style="font-size:11px;color:#73726c;text-align:right;margin-bottom:10px;">'+pct+'% entregado · '+faltantes+' pieza'+(faltantes!==1?'s':'')+' pendiente'+(faltantes!==1?'s':'')+'</div>'+
        '<div class="proj-meta-grid">'+
          '<div class="proj-meta-item"><b>Monto total</b>'+fmt(monto)+'</div>'+
          '<div class="proj-meta-item"><b>Fecha pedido</b>'+(p.fecha_pedido?fmtDate(p.fecha_pedido):'-')+'</div>'+
          '<div class="proj-meta-item"><b>Entrega final</b>'+(p.fecha_entrega?fmtDate(p.fecha_entrega):'-')+'</div>'+
          (p.notas?'<div class="proj-meta-item" style="grid-column:1/-1"><b>Notas</b>'+esc(p.notas)+'</div>':'')+
        '</div>'+
        entregasHTML+
        '<div class="proj-actions">'+
          '<button class="btn-sm" onclick="abrirEntrega(\''+p.id+'\')">+ Registrar entrega</button>'+
          '<button class="btn-sm" onclick="editarProyecto(\''+p.id+'\')">Editar</button>'+
          '<button class="btn-sm" style="color:#A32D2D;border-color:#E24B4A;" onclick="eliminarProyecto(\''+p.id+'\')">Eliminar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function toggleProj(id){
  var body=document.getElementById('proj-body-'+id);
  if(body)body.style.display=body.style.display==='none'?'block':'none';
}

// ── abrirNuevoProyecto — populate cliente dropdown ────────
function poblarClientesEnProyecto(valorActual){
  var inp=document.getElementById('proj-cliente-search');
  var hid=document.getElementById('proj-cliente-sel');
  if(!inp)return;
  // Find nombre for current value
  var c=clientes.find(function(x){return x.nombre===valorActual||x.id===valorActual;});
  inp.value=c?c.nombre:(valorActual||'');
  if(hid) hid.value=c?c.id:'';
  document.getElementById('proj-cliente').value=valorActual||'';
  makeAutocomplete('proj-cliente-search','proj-cliente-sel','proj-cliente-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},
    function(item){
      document.getElementById('proj-cliente').value=item.label;
      // Repoblar contactos filtrados por empresa seleccionada
      poblarContactosEnProyecto('', item.id);
    }
  );
}

function poblarContactosEnProyecto(valorActual, clienteId){
  var sel=document.getElementById('proj-contacto-sel');
  if(!sel)return;
  sel.innerHTML='<option value="">— Sin contacto clave —</option>';
  // Filter by company if provided, else show all
  var pool = clienteId
    ? (contactos||[]).filter(function(c){ return c.cliente_id===clienteId; })
    : (contactos||[]);
  if(!pool.length && clienteId) pool = contactos||[]; // fallback si no hay contactos de esa empresa
  pool.forEach(function(c){
    var o=document.createElement('option');
    o.value=c.id;
    var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
    o.textContent=nombre+(c.clientes&&c.clientes.nombre?' ('+c.clientes.nombre+')':'');
    if(c.id===valorActual)o.selected=true;
    sel.appendChild(o);
  });
}

function abrirNuevoProyecto(){
  if(!clientes.length)loadClientes();
  document.getElementById('proj-id').value='';
  document.getElementById('proj-modal-title').textContent='Nuevo proyecto';
  ['pedido','tipo-pieza','notas'].forEach(function(f){document.getElementById('proj-'+f).value='';});
  ['total-piezas','monto'].forEach(function(f){document.getElementById('proj-'+f).value='';});
  document.getElementById('proj-fecha-pedido').value=new Date().toISOString().split('T')[0];
  document.getElementById('proj-fecha-entrega').value='';
  poblarClientesEnProyecto('');
  poblarContactosEnProyecto('');
  document.getElementById('proj-modal').style.display='flex';
}

function editarProyecto(id){
  var p=proyectos.find(function(x){return x.id===id;});
  if(!p)return;
  document.getElementById('proj-id').value=p.id;
  document.getElementById('proj-modal-title').textContent='Editar proyecto';
  poblarClientesEnProyecto(p.nombre_cliente||'');
  poblarContactosEnProyecto(p.contacto_id||'', p.cliente_id||'');
  document.getElementById('proj-pedido').value=p.nombre_pedido||'';
  document.getElementById('proj-tipo-pieza').value=p.tipo_pieza||'';
  document.getElementById('proj-total-piezas').value=p.total_piezas||0;
  document.getElementById('proj-fecha-pedido').value=p.fecha_pedido||'';
  document.getElementById('proj-fecha-entrega').value=p.fecha_entrega||'';
  document.getElementById('proj-monto').value=p.monto_total||0;
  document.getElementById('proj-notas').value=p.notas||'';
  document.getElementById('proj-modal').style.display='flex';
  // Show and load invoices section
  document.getElementById('proj-facturas-section').style.display='block';
  cargarFacturasEnModal(id, p.cliente_id||null, p.nombre_cliente||null);
}

function abrirNuevoProyecto(){
  document.getElementById('proj-id').value='';
  document.getElementById('proj-modal-title').textContent='Nuevo proyecto';
  poblarClientesEnProyecto('');
  poblarContactosEnProyecto('');
  document.getElementById('proj-pedido').value='';
  document.getElementById('proj-tipo-pieza').value='';
  document.getElementById('proj-total-piezas').value=0;
  document.getElementById('proj-fecha-pedido').value=new Date().toISOString().split('T')[0];
  document.getElementById('proj-fecha-entrega').value='';
  document.getElementById('proj-monto').value=0;
  document.getElementById('proj-notas').value='';
  document.getElementById('proj-facturas-section').style.display='none';
  document.getElementById('proj-modal').style.display='flex';
}

async function cargarFacturasEnModal(proyId, clienteId, nombreCliente){
  var linkedEl = document.getElementById('proj-facturas-linked');
  var availWrap = document.getElementById('proj-facturas-available-wrap');
  var availEl = document.getElementById('proj-facturas-available');
  if(!linkedEl) return;
  linkedEl.innerHTML = '<div style="font-size:11px;color:var(--text-3);">Cargando...</div>';
  try{
    // Linked invoices
    var {data:linked} = await sb.from('movimientos_v2')
      .select('id,fecha,monto,numero_factura,conciliado')
      .eq('origen','sat_emitida')
      .eq('proyecto_id', proyId);
    linked = linked||[];

    if(linked.length){
      linkedEl.innerHTML = linked.map(function(f){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg-card-2);border-radius:6px;margin-bottom:4px;font-size:12px;">'+
          '<div>'+
            '<span style="color:var(--text-1);">'+(f.numero_factura||f.id.slice(0,12))+'</span>'+
            '<span style="color:var(--text-3);margin-left:8px;">'+fmtDate(f.fecha)+'</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:8px;">'+
            '<span style="color:#34d399;font-weight:600;">'+fmt(parseFloat(f.monto)||0)+'</span>'+
            '<button class="btn-sm" style="color:#f87171;font-size:10px;padding:1px 7px;" '+
              'onclick="desvincularFactModalProyecto(\''+f.id+'\',\''+proyId+'\')">×</button>'+
          '</div>'+
        '</div>';
      }).join('');
    } else {
      linkedEl.innerHTML = '<div style="font-size:11px;color:var(--text-4);padding:4px 0;">Sin facturas vinculadas</div>';
    }

    // Available unlinked invoices for this client
    if(clienteId){
      var {data:avail} = await sb.from('movimientos_v2')
        .select('id,fecha,monto,numero_factura,contraparte')
        .eq('origen','sat_emitida')
        .eq('cliente_id', clienteId)
        .is('proyecto_id', null);
      avail = avail||[];
      if(avail.length){
        availWrap.style.display = 'block';
        availEl.innerHTML = avail.map(function(f){
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg-card);border-radius:6px;margin-bottom:4px;font-size:12px;opacity:.8;">'+
            '<div>'+
              '<span style="color:var(--text-2);">'+(f.numero_factura||f.id.slice(0,12))+'</span>'+
              '<span style="color:var(--text-3);margin-left:8px;">'+fmtDate(f.fecha)+'</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;">'+
              '<span style="color:var(--text-2);">'+fmt(parseFloat(f.monto)||0)+'</span>'+
              '<button class="btn-sm" style="font-size:10px;padding:1px 7px;" '+
                'onclick="vincularFactModalProyecto(\''+f.id+'\',\''+proyId+'\',\''+clienteId+'\',\''+esc(nombreCliente||'')+'\')">+ Vincular</button>'+
            '</div>'+
          '</div>';
        }).join('');
      } else {
        availWrap.style.display = 'none';
      }
    }
  }catch(e){ linkedEl.innerHTML='<div style="font-size:11px;color:#f87171;">Error cargando facturas</div>'; }
}

async function vincularFactModalProyecto(factId, proyId, clienteId, nombreCliente){
  try{
    await sb.from('movimientos_v2').update({proyecto_id:proyId}).eq('id',factId);
    showStatus('✓ Factura vinculada');
    cargarFacturasEnModal(proyId, clienteId, nombreCliente);
  }catch(e){showError('Error: '+e.message);}
}

async function desvincularFactModalProyecto(factId, proyId){
  var p = proyectos.find(function(x){return x.id===proyId;});
  try{
    await sb.from('movimientos_v2').update({proyecto_id:null}).eq('id',factId);
    showStatus('Factura desvinculada');
    cargarFacturasEnModal(proyId, p&&p.cliente_id||null, p&&p.nombre_cliente||null);
  }catch(e){showError('Error: '+e.message);}
}

function cerrarProyecto(){document.getElementById('proj-modal').style.display='none';}

async function guardarProyecto(){
  var cliente=document.getElementById('proj-cliente').value.trim()||document.getElementById('proj-cliente-search').value.trim();
  var pedido=document.getElementById('proj-pedido').value.trim();
  if(!cliente||!pedido){alert('Cliente y nombre de pedido son obligatorios.');return;}
  var btn=document.getElementById('btn-save-proj');
  btn.disabled=true; btn.textContent='Guardando...';
  var id=document.getElementById('proj-id').value||Date.now().toString()+Math.random().toString(36).slice(2,5);
  var fechaPedido=document.getElementById('proj-fecha-pedido').value||null;
  var proyYear=fechaPedido?parseInt(fechaPedido.split('-')[0]):new Date().getFullYear();
  var proj={
    id:id,
    nombre_cliente:cliente,
    nombre_pedido:pedido,
    tipo_pieza:document.getElementById('proj-tipo-pieza').value.trim(),
    total_piezas:parseInt(document.getElementById('proj-total-piezas').value)||0,
    fecha_pedido:fechaPedido,
    fecha_entrega:document.getElementById('proj-fecha-entrega').value||null,
    monto_total:parseFloat(document.getElementById('proj-monto').value)||0,
    notas:document.getElementById('proj-notas').value.trim(),
    contacto_id:document.getElementById('proj-contacto-sel').value||null,
    year:proyYear
  };
  try{
    await upsertProyecto(proj);
    cerrarProyecto();
    await loadProyectos();
    showStatus('✓ Proyecto guardado');
  }catch(e){showError('Error al guardar proyecto: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Guardar proyecto';}
}

async function eliminarProyecto(id){
  var p=proyectos.find(function(x){return x.id===id;});
  if(!confirm('¿Eliminar el proyecto "'+(p?p.nombre_pedido:id)+'"? Esta acción no se puede deshacer.'))return;
  try{await deleteProyecto(id);await loadProyectos();}
  catch(e){showError('No se pudo eliminar: '+e.message);}
}

// ── Entrega de piezas ────────────────────────────────────
function abrirEntrega(id){
  var p=proyectos.find(function(x){return x.id===id;});
  if(!p)return;
  var entregas=entregasByProyecto[p.id]||[];
  var yaEntregadas=entregas.reduce(function(a,e){return a+(parseFloat(e.piezas)||0);},0);
  var faltantes=Math.max(0,(p.total_piezas||0)-yaEntregadas);
  document.getElementById('entrega-proj-id').value=id;
  document.getElementById('entrega-info').textContent=p.nombre_cliente+' · '+p.nombre_pedido+' · Faltan '+faltantes+' pieza'+(faltantes!==1?'s':'');
  document.getElementById('entrega-cantidad').value='';
  document.getElementById('entrega-factura').value='';
  document.getElementById('entrega-monto').value='';
  document.getElementById('entrega-notas').value='';
  document.getElementById('entrega-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('entrega-modal').style.display='flex';
}

function cerrarEntrega(){document.getElementById('entrega-modal').style.display='none';}

async function confirmarEntrega(){
  var id=document.getElementById('entrega-proj-id').value;
  var cant=parseInt(document.getElementById('entrega-cantidad').value)||0;
  var factura=document.getElementById('entrega-factura').value.trim();
  var monto=parseFloat(document.getElementById('entrega-monto').value)||0;
  var notas=document.getElementById('entrega-notas').value.trim();
  var fecha=document.getElementById('entrega-fecha').value;
  if(!cant||cant<1){alert('Ingresa un número válido de piezas.');return;}
  try{
    await insertEntrega({
      id:Date.now().toString()+Math.random().toString(36).slice(2,5),
      proyecto_id:id,
      fecha:fecha||new Date().toISOString().split('T')[0],
      piezas:cant,
      factura_numero:factura||null,
      factura_monto:monto||null,
      notas:notas||null
    });
    cerrarEntrega();
    await loadProyectos();
    showStatus('✓ Entrega registrada: '+cant+' pieza'+(cant!==1?'s':'')+(factura?' · Factura '+factura:'')+(monto?' · '+fmt(monto):''));
  }catch(e){showError('Error al registrar entrega: '+e.message);}
}

// ── Proyectos KPIs + filtros ──────────────────────────────
function initProjYearFilter(){
  var sel=document.getElementById('proj-year-filter');
  if(sel.options.length>0)return;
  var año=new Date().getFullYear();
  for(var y=año;y>=año-4;y--){
    var o=document.createElement('option');
    o.value=y; o.textContent=y;
    if(y===año)o.selected=true;
    sel.appendChild(o);
  }
  var oAll=document.createElement('option');
  oAll.value=''; oAll.textContent='Todos los años';
  sel.insertBefore(oAll,sel.firstChild);
}

// ── Proyectos override con filtros ────────────────────────
async function loadProyectos(){
  initProjYearFilter();
  var año=document.getElementById('proj-year-filter').value;
  var status=document.getElementById('proj-status-filter').value;
  try{
    var q=sb.from('proyectos').select('*').order('fecha_entrega',{ascending:true});
    var {data,error}=await q;
    if(error)throw error;
    // Apply year filter client-side (null-year projects show under current year)
    var all=(data||[]).filter(function(p){
      if(!año)return true;
      return !p.year||String(p.year)===String(año);
    });
    var {data:entregas}=await sb.from('entregas').select('*').in('proyecto_id',all.map(function(p){return p.id;}));
    entregasByProyecto={};
    (entregas||[]).forEach(function(e){if(!entregasByProyecto[e.proyecto_id])entregasByProyecto[e.proyecto_id]=[];entregasByProyecto[e.proyecto_id].push(e);});

    // KPIs (use all without status filter for counts)
    var abiertos=0,completos=0,atrasados=0,montoEnCurso=0;
    all.forEach(function(p){
      var ents=entregasByProyecto[p.id]||[];
      var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
      var est=estadoProyecto(p,entregadas);
      var lbl=est.lbl||est;
      if(lbl==='Completado')completos++;
      else if(lbl==='Atrasado')atrasados++;
      else abiertos++;
      if(lbl==='En proceso')montoEnCurso+=Number(p.monto_total||0);
    });
    document.getElementById('proj-k-abiertos').textContent=abiertos;
    document.getElementById('proj-k-completos').textContent=completos;
    document.getElementById('proj-k-atrasados').textContent=atrasados;
    document.getElementById('proj-k-monto').textContent=fmt(montoEnCurso);

    // Apply status filter for list
    var filtered=status?all.filter(function(p){
      var ents=entregasByProyecto[p.id]||[];
      var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
      var est=estadoProyecto(p,entregadas);
      return (est.lbl||est)===status;
    }):all;
    document.getElementById('proj-count').textContent=filtered.length+' proyecto'+(filtered.length!==1?'s':'');
    proyectos=filtered; allProyectos=filtered;
    renderProyectos();
    updateBadges();
  }catch(e){console.error('Proyectos:',e);}
}

