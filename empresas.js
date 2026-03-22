
// ── Validador RFC SAT ────────────────────────────────────
// Personas morales: 12 chars (3 letras + 6 fecha + 3 homoclave)
// Personas físicas: 13 chars (4 letras + 6 fecha + 3 homoclave)
function validarRFC(rfc){
  if(!rfc) return false;
  return /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase());
}

// [F7] Sort state — Empresas/Clientes
var clientesSort = { col: 'nombre', dir: 'asc' };

function sortClientes(col){
  if(clientesSort.col === col){ clientesSort.dir = clientesSort.dir==='asc'?'desc':'asc'; }
  else { clientesSort.col = col; clientesSort.dir = 'asc'; }
  updateClientesSortUI();
  filtrarClientes(document.getElementById('clientes-search')?document.getElementById('clientes-search').value:'');
}

function updateClientesSortUI(){
  ['nombre','ciudad','condiciones_pago'].forEach(function(c){
    var btn = document.getElementById('cli-sort-'+c);
    if(!btn) return;
    if(c === clientesSort.col){
      btn.style.background = 'var(--bg-card-2)'; btn.style.color = 'var(--text-1)'; btn.style.borderColor = 'var(--text-3)';
      btn.querySelector('span.sort-arrow').textContent = clientesSort.dir==='asc' ? ' ↑' : ' ↓';
    } else {
      btn.style.background = ''; btn.style.color = 'var(--text-3)'; btn.style.borderColor = 'var(--border)';
      btn.querySelector('span.sort-arrow').textContent = '';
    }
  });
}

function applyClientesSort(arr){
  var col = clientesSort.col, dir = clientesSort.dir;
  return arr.slice().sort(function(a,b){
    var va=(a[col]||'').toLowerCase(), vb=(b[col]||'').toLowerCase();
    var r=va.localeCompare(vb,'es');
    return dir==='asc'?r:-r;
  });
}
// ── Clientes DB ──────────────────────────────────────────
async function loadClientes(){
  try{
    var {data,error}=await sb.from('clientes').select('*').order('nombre',{ascending:true}).limit(500);
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
  var {error}=await sb.from('clientes').update({activo:false}).eq('id',id);
  if(error)throw error;
}



async function upsertProyecto(proj){
  var {error}=await sb.from('proyectos').upsert([proj]);
  if(error)throw error;
}

async function deleteProyecto(id){
  var {error}=await sb.from('proyectos').update({activo:false}).eq('id',id);
  if(error)throw error;
  await sb.from('entregas').update({activo:false}).eq('proyecto_id',id);
}

async function insertEntrega(entrega){
  var {error}=await sb.from('entregas').insert([entrega]);
  if(error)throw error;
}

// ── Clientes UI ──────────────────────────────────────────
var clienteModalFromForm=false;

// -- T6: Pure render functions --

function renderClienteCard(c, variant){
  // variant: 'full' (renderClientes) | 'list' (renderClientesList)
  var condFull = {'inmediato':'Pago inmediato','15':'Crédito 15d','30':'Crédito 30d','45':'Crédito 45d','60':'Crédito 60d','90':'Crédito 90d'};
  var condShort = {'inmediato':'Pago inm.','15':'15d','30':'30d','45':'45d','60':'60d','90':'90d'};
  var condLabels = variant==='full' ? condFull : condShort;

  var initials = (c.nombre||'?').split(' ').slice(0,2)
    .map(function(w){return w[0];}).join('').toUpperCase();

  var card = document.createElement('div');
  card.className = 'cliente-card';
  card.style.cursor = 'pointer';
  card.addEventListener('click', function(){ verDetalleEmpresa(c.id); });

  var avatar = document.createElement('div');
  avatar.className = 'cliente-avatar';
  avatar.textContent = initials;

  var info = document.createElement('div');
  info.className = 'cliente-info';

  var nameEl = document.createElement('div');
  nameEl.className = 'cliente-nombre';
  nameEl.textContent = c.nombre;

  var meta = document.createElement('div');
  meta.className = 'cliente-meta';
  var metaParts = [];
  if(c.rfc)    metaParts.push('RFC: '+c.rfc);
  if(c.ciudad) metaParts.push(c.ciudad);
  metaParts.push(condLabels[c.condiciones_pago]||(variant==='full'?'Crédito 30d':'30d'));
  meta.textContent = metaParts.join(' · ');

  info.appendChild(nameEl);
  info.appendChild(meta);

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;';

  if(variant==='list'){
    var contsBtn = document.createElement('button');
    contsBtn.className = 'btn-sm';
    contsBtn.textContent = 'Contactos';
    contsBtn.addEventListener('click', function(e){
      e.stopPropagation();
      verContactosCliente(c.id, c.nombre);
    });
    actions.appendChild(contsBtn);
  }

  var editBtn = document.createElement('button');
  editBtn.className = 'btn-sm';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', function(e){
    e.stopPropagation();
    editarCliente(c.id);
  });
  actions.appendChild(editBtn);

  card.appendChild(avatar);
  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function renderTop5Rows(top5, container, amountColor){
  container.innerHTML = '';
  if(!top5.length){ container.textContent = container.dataset.empty||'Sin datos'; return; }
  var frag = document.createDocumentFragment();
  top5.forEach(function(d, i){
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    var label = document.createElement('span');
    label.style.cssText = 'color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    label.textContent = (i+1)+'. '+d[0];
    var amount = document.createElement('span');
    amount.style.cssText = 'color:'+amountColor+';flex-shrink:0;';
    amount.textContent = fmt(d[1]);
    row.appendChild(label);
    row.appendChild(amount);
    frag.appendChild(row);
  });
  container.appendChild(frag);
}

function renderClientes(){
  var el = document.getElementById('clientes-list');
  var ct = document.getElementById('clientes-count');
  if(!el) return;
  ct.textContent = clientes.length + ' empresa' + (clientes.length!==1?'s':'');
  el.innerHTML = '';
  if(!clientes.length){
    var empty = document.createElement('div');
    empty.className = 'empty-state-cta';
    empty.innerHTML = '<div class="empty-state-icon">🏢</div>'
      + '<div class="empty-state-msg">Sin empresas registradas</div>'
      + '<button class="btn-primary" onclick="abrirNuevoCliente(false)">+ Nueva empresa</button>';
    el.appendChild(empty);
    return;
  }
  var frag = document.createDocumentFragment();
  clientes.forEach(function(c){ frag.appendChild(renderClienteCard(c, 'full')); });
  el.appendChild(frag);
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
  var rfcVal = document.getElementById('cliente-rfc').value.trim().toUpperCase();
  if(!rfcVal){ showError('El RFC es obligatorio.'); btn.disabled=false; btn.textContent='Guardar cliente'; return; }
  if(!validarRFC(rfcVal)){ showError('RFC inválido. Debe tener 12 caracteres (persona moral) o 13 (persona física).'); btn.disabled=false; btn.textContent='Guardar cliente'; return; }
  var c={
    id:id, nombre:nombre,
    rfc:rfcVal,
    ciudad:document.getElementById('cliente-ciudad').value.trim()||null,
    condiciones_pago:document.getElementById('cliente-pago').value,
    activo:(document.getElementById('cliente-activo')||{checked:true}).checked
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
  try{
    await deleteCliente(id);
    clientes=clientes.filter(function(x){return x.id!==id;});
    allClientes=clientes;
    cacheInvalidate('clientes');
    renderClientesList(clientes);
    showStatus('✓ Cliente eliminado');
  }catch(e){showError('No se pudo eliminar: '+e.message);}
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
      byCliente[k]=(byCliente[k]||0)+(parseFloat(m.monto)||0);
    });
    var top5fac=Object.entries(byCliente).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var topEl=document.getElementById('cli-k-top');
    renderTop5Rows(top5fac, topEl, '#34d399');
    if(!top5fac.length) topEl.textContent='Sin ventas registradas';

    // Top 5 deudores — nombre completo
    var {data:deudasRaw}=await sb.from('facturas').select('receptor_nombre,total').eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente').or('efecto_sat.eq.Ingreso,efecto_sat.is.null');
    var deudas=(deudasRaw||[]).map(function(f){return {contraparte:f.receptor_nombre,monto:f.total};});
    var byDeudor={};
    (deudas||[]).forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byDeudor[k]=(byDeudor[k]||0)+(parseFloat(m.monto)||0);});
    var top5deu=Object.entries(byDeudor).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var deudorEl=document.getElementById('cli-k-deudor');
    renderTop5Rows(top5deu, deudorEl, '#fbbf24');
    if(!top5deu.length) deudorEl.textContent='Sin facturas pendientes';
  }catch(e){console.error('Clientes KPIs:',e);}
}

// [T7] allClientes → M2State alias en config.js
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
  var el = document.getElementById('clientes-list');
  var ct = document.getElementById('clientes-count');
  ct.textContent = list.length + ' empresa' + (list.length!==1?'s':'');
  el.innerHTML = '';
  if(!list.length){
    var empty = document.createElement('div');
    empty.className = 'empty-state-cta';
    empty.innerHTML = '<div class="empty-state-icon">🏢</div>'
      + '<div class="empty-state-msg">Sin empresas</div>'
      + '<button class="btn-primary" onclick="abrirNuevoCliente(false)">+ Nueva empresa</button>';
    el.appendChild(empty);
    return;
  }
  var frag = document.createDocumentFragment();
  applyClientesSort(list).forEach(function(c){ frag.appendChild(renderClienteCard(c, 'list')); });
  el.appendChild(frag);
}

// Override loadClientes to also store allClientes
async function loadClientes(forceRefresh){
  try{
    clientes=await fetchWithCache('clientes',async function(){
      var {data,error}=await sb.from('clientes').select('*').order('nombre',{ascending:true}).limit(500);
      if(error)throw error;
      return data||[];
    },forceRefresh);
    allClientes=clientes;
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

