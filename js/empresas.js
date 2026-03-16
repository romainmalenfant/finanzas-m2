// ── Clientes DB ──────────────────────────────────────────
async function loadClientes(){
  try{
    var {data,error}=await sb.from('clientes').select('*').order('nombre',{ascending:true});
    if(error)throw error;
    clientes=data||[];
    renderClientes();
  }catch(e){console.error('Clientes error:',e);}
}

async function upsertCliente(c){
  var {error}=await sb.from('clientes').upsert([c]);
  if(error)throw error;
}

async function deleteCliente(id){
  var {error}=await sb.from('clientes').delete().eq('id',id);
  if(error)throw error;
}



async function upsertProyecto(proj){
  var {error}=await sb.from('proyectos').upsert([proj]);
  if(error)throw error;
}

async function deleteProyecto(id){
  var {error}=await sb.from('proyectos').delete().eq('id',id);
  if(error)throw error;
  await sb.from('entregas').delete().eq('proyecto_id',id);
}

async function insertEntrega(entrega){
  var {error}=await sb.from('entregas').insert([entrega]);
  if(error)throw error;
}

// ── Clientes UI ──────────────────────────────────────────
var clienteModalFromForm=false;

function renderClientes(){
  var el=document.getElementById('clientes-list');
  var ct=document.getElementById('clientes-count');
  if(!el)return;
  ct.textContent=clientes.length+' empresa'+(clientes.length!==1?'s':'');
  if(!clientes.length){el.innerHTML='<div class="empty-state">Sin empresas registradas.</div>';return;}
  var condLabels={'inmediato':'Pago inmediato','15':'Crédito 15d','30':'Crédito 30d','45':'Crédito 45d','60':'Crédito 60d','90':'Crédito 90d'};
  el.innerHTML=clientes.map(function(c){
    var initials=(c.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleEmpresa(\''+esc(c.id)+'\')" >'+
      '<div class="cliente-avatar">'+esc(initials)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(c.nombre)+'</div>'+
        '<div class="cliente-meta">'+
          (c.rfc?'RFC: '+esc(c.rfc)+' · ':'')+
          (c.ciudad?esc(c.ciudad)+' · ':'')+
          (condLabels[c.condiciones_pago]||'Crédito 30d')+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="event.stopPropagation();editarCliente(\''+esc(c.id)+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function abrirNuevoCliente(fromForm){
  clienteModalFromForm=fromForm;
  document.getElementById('cliente-id-edit').value='';
  document.getElementById('cliente-modal-title').textContent='Nueva empresa';
  document.getElementById('cliente-nombre').value='';
  document.getElementById('cliente-rfc').value='';
  document.getElementById('cliente-ciudad').value='';
  document.getElementById('cliente-pago').value='30';
  document.getElementById('cliente-modal').style.display='flex';
}

function editarCliente(id){
  var c=clientes.find(function(x){return x.id===id;});
  if(!c)return;
  clienteModalFromForm=false;
  document.getElementById('cliente-id-edit').value=c.id;
  document.getElementById('cliente-modal-title').textContent='Editar cliente';
  document.getElementById('cliente-nombre').value=c.nombre||'';
  document.getElementById('cliente-rfc').value=c.rfc||'';
  document.getElementById('cliente-ciudad').value=c.ciudad||'';
  document.getElementById('cliente-pago').value=c.condiciones_pago||'30';
  document.getElementById('cliente-modal').style.display='flex';
}

function cerrarModalCliente(){
  document.getElementById('cliente-modal').style.display='none';
}

async function guardarCliente(){
  var nombre=document.getElementById('cliente-nombre').value.trim();
  if(!nombre){alert('El nombre del cliente es obligatorio.');return;}
  var btn=document.getElementById('btn-save-cliente');
  btn.disabled=true; btn.textContent='Guardando...';
  var id=document.getElementById('cliente-id-edit').value||Date.now().toString()+Math.random().toString(36).slice(2,5);
  var c={
    id:id, nombre:nombre,
    rfc:document.getElementById('cliente-rfc').value.trim().toUpperCase()||null,
    ciudad:document.getElementById('cliente-ciudad').value.trim()||null,
    condiciones_pago:document.getElementById('cliente-pago').value,
    activo:document.getElementById('cliente-activo').checked
  };
  try{
    await upsertCliente(c);
    clientes=clientes.filter(function(x){return x.id!==id;});
    clientes.push(c);
    clientes.sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
    cerrarModalCliente();
    cacheInvalidate('clientes');
    await loadClientes(true);
    if(clienteModalFromForm){ seleccionarCliente(c); }
    showStatus('✓ Cliente guardado');
  }catch(e){showError('Error al guardar cliente: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Guardar cliente';}
}

async function eliminarCliente(id){
  var c=clientes.find(function(x){return x.id===id;});
  if(!confirm('¿Eliminar cliente "'+(c?c.nombre:id)+'"?'))return;
  try{await deleteCliente(id);clientes=clientes.filter(function(x){return x.id!==id;});renderClientes();}
  catch(e){showError('No se pudo eliminar: '+e.message);}
}

// ── Clientes KPIs ─────────────────────────────────────────
async function loadClientesKPIs(){
  try{
    var año=new Date().getFullYear();
    var hace90=new Date(); hace90.setDate(hace90.getDate()-90);
    var f90=hace90.toISOString().split('T')[0];

    // Activos en últimos 90 días — usar rfc_contraparte (SAT no siempre tiene cliente_id)
    var {data:activos}=await sb.from('movimientos_v2').select('rfc_contraparte,cliente_id').eq('tipo','ingreso').gte('fecha',f90);
    var activosSet=new Set();
    (activos||[]).forEach(function(m){
      if(m.cliente_id)activosSet.add('id:'+m.cliente_id);
      else if(m.rfc_contraparte)activosSet.add('rfc:'+m.rfc_contraparte);
    });
    document.getElementById('cli-k-activos') && (document.getElementById('cli-k-activos').textContent=activosSet.size);

    // Top 5 por ventas YTD
    var {data:ytdVentas}=await sb.from('movimientos_v2').select('contraparte,monto').eq('categoria','venta').eq('year',año);
    var byCliente={};
    (ytdVentas||[]).forEach(function(m){
      var k=(m.contraparte||'Sin nombre').trim();
      byCliente[k]=(byCliente[k]||0)+Number(m.monto);
    });
    var top5fac=Object.entries(byCliente).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var topEl=document.getElementById('cli-k-top');
    if(top5fac.length){
      topEl.innerHTML=top5fac.map(function(d,i){
        return '<div style="display:flex;justify-content:space-between;gap:8px;">'+
          '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(i+1)+'. '+esc(d[0])+'</span>'+
          '<span style="color:#34d399;flex-shrink:0;">'+fmt(d[1])+'</span>'+
        '</div>';
      }).join('');
    }else{topEl.textContent='Sin ventas registradas';}

    // Top 5 deudores — nombre completo
    var {data:deudas}=await sb.from('movimientos_v2').select('contraparte,monto').eq('origen','sat_emitida').eq('conciliado',false);
    var byDeudor={};
    (deudas||[]).forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byDeudor[k]=(byDeudor[k]||0)+Number(m.monto);});
    var top5deu=Object.entries(byDeudor).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var deudorEl=document.getElementById('cli-k-deudor');
    if(top5deu.length){
      deudorEl.innerHTML=top5deu.map(function(d,i){
        return '<div style="display:flex;justify-content:space-between;gap:8px;">'+
          '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(i+1)+'. '+esc(d[0])+'</span>'+
          '<span style="color:#fbbf24;flex-shrink:0;">'+fmt(d[1])+'</span>'+
        '</div>';
      }).join('');
    }else{deudorEl.textContent='Sin facturas pendientes';}
  }catch(e){console.error('Clientes KPIs:',e);}
}

var allClientes=[];
function filtrarClientes(q){
  var ql=(q||'').toLowerCase();
  var filtroActivo=document.getElementById('clientes-activo-filter');
  var soloActivos=!filtroActivo||filtroActivo.value==='activo';
  var filtered=allClientes.filter(function(c){
    if(soloActivos&&c.activo===false)return false;
    if(!ql)return true;
    return (c.nombre||'').toLowerCase().includes(ql)||(c.rfc||'').toLowerCase().includes(ql);
  });
  renderClientesList(filtered);
}

function renderClientesList(list){
  var el=document.getElementById('clientes-list');
  var ct=document.getElementById('clientes-count');
  ct.textContent=list.length+' empresa'+(list.length!==1?'s':'');
  if(!list.length){el.innerHTML='<div class="empty-state">Sin empresas</div>';return;}
  var condLabels={'inmediato':'Pago inm.','15':'15d','30':'30d','45':'45d','60':'60d','90':'90d'};
  el.innerHTML=list.map(function(c){
    var initials=(c.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleEmpresa(\''+esc(c.id)+'\')">'+

      '<div class="cliente-avatar">'+esc(initials)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(c.nombre)+'</div>'+
        '<div class="cliente-meta">'+(c.rfc?'RFC: '+esc(c.rfc)+' · ':'')+
        (c.ciudad?esc(c.ciudad)+' · ':'')+
        (condLabels[c.condiciones_pago]||'30d')+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="event.stopPropagation();verContactosCliente(\''+esc(c.id)+'\',\''+esc(c.nombre)+'\')">Contactos</button>'+
        '<button class="btn-sm" onclick="event.stopPropagation();editarCliente(\''+esc(c.id)+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// Override loadClientes to also store allClientes
var _origLoadClientes=null;
async function loadClientes(forceRefresh){
  if(!forceRefresh){
    var cached=cacheGet('clientes');
    if(cached){
      clientes=cached; allClientes=cached;
      var kt=document.getElementById('cli-k-total'); if(kt)kt.textContent=clientes.length;
      renderClientesList(clientes); return;
    }
  }
  try{
    var {data,error}=await sb.from('clientes').select('*').order('nombre',{ascending:true});
    if(error)throw error;
    clientes=data||[]; allClientes=clientes;
    cacheSet('clientes',clientes);
    var kt=document.getElementById('cli-k-total'); if(kt)kt.textContent=clientes.length;
    renderClientesList(clientes);
  }catch(e){console.error('Clientes:',e);}
}

function verContactosCliente(clienteId, nombre){
  switchTab('contactos',document.getElementById('sb-contactos'));
  setTimeout(function(){
    var input=document.getElementById('contactos-search');
    if(input){input.value=nombre;filtrarContactos(nombre);}
  },100);
}

