
// ── Validador RFC SAT ────────────────────────────────────
// Personas morales: 12 chars (3 letras + 6 fecha + 3 homoclave)
// Personas físicas: 13 chars (4 letras + 6 fecha + 3 homoclave)
function validarRFC(rfc){
  if(!rfc) return false;
  return /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase());
}

// [F7] Sort state — Proveedores
var provSort = { col: 'nombre', dir: 'asc' };

function sortProveedores(col){
  if(provSort.col === col){ provSort.dir = provSort.dir==='asc'?'desc':'asc'; }
  else { provSort.col = col; provSort.dir = 'asc'; }
  updateProvSortUI();
  filtrarProveedores(document.getElementById('proveedores-search')?document.getElementById('proveedores-search').value:'');
}

function updateProvSortUI(){
  ['nombre','ciudad','condiciones_pago'].forEach(function(c){
    var btn = document.getElementById('prov-sort-'+c);
    if(!btn) return;
    if(c === provSort.col){
      btn.style.background = 'var(--bg-card-2)'; btn.style.color = 'var(--text-1)'; btn.style.borderColor = 'var(--text-3)';
      btn.querySelector('span.sort-arrow').textContent = provSort.dir==='asc' ? ' ↑' : ' ↓';
    } else {
      btn.style.background = ''; btn.style.color = 'var(--text-3)'; btn.style.borderColor = 'var(--border)';
      btn.querySelector('span.sort-arrow').textContent = '';
    }
  });
}

function applyProvSort(arr){
  var col = provSort.col, dir = provSort.dir;
  return arr.slice().sort(function(a,b){
    var va=(a[col]||'').toLowerCase(), vb=(b[col]||'').toLowerCase();
    var r=va.localeCompare(vb,'es');
    return dir==='asc'?r:-r;
  });
}
// ── Proveedores DB & UI ──────────────────────────────────
async function loadProveedores(){
  try{
    var {data,error}=await sb.from('proveedores').select('*').order('nombre',{ascending:true}).limit(500);
    if(error)throw error;
    proveedores=data||[];
    renderProveedores();
  }catch(e){console.error('Proveedores error:',e);}
}

async function upsertProveedor(p){
  var {error}=await sb.from('proveedores').upsert([p]);
  if(error)throw error;
}

async function deleteProveedor(id){
  var {error}=await sb.from('proveedores').update({activo:false}).eq('id',id);
  if(error)throw error;
}

var tipoLabels={general:'General',nomina:'Nómina',servicios:'Servicios',material:'Material',financiero:'Financiero'};
var condLabels2={inmediato:'Pago inmediato','15':'Crédito 15d','30':'Crédito 30d','60':'Crédito 60d','90':'Crédito 90d'};

// -- T6: Pure render functions --

function renderProveedorCard(p, detailed){
  var initials = (p.nombre||'?').split(' ').slice(0,2)
    .map(function(w){return w[0];}).join('').toUpperCase();

  var card = document.createElement('div');
  card.className = 'cliente-card';
  card.style.cursor = 'pointer';
  card.addEventListener('click', function(){ verDetalleProveedor(p.id); });

  var avatar = document.createElement('div');
  avatar.className = 'cliente-avatar';
  if(detailed) avatar.style.background = '#e8e6e0';
  avatar.textContent = initials;

  var info = document.createElement('div');
  info.className = 'cliente-info';

  var nameEl = document.createElement('div');
  nameEl.className = 'cliente-nombre';
  nameEl.textContent = p.nombre;

  var meta = document.createElement('div');
  meta.className = 'cliente-meta';

  if(detailed){
    meta.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    function addMetaSpan(text){
      var s = document.createElement('span'); s.textContent = text; meta.appendChild(s);
    }
    if(p.rfc)    addMetaSpan('RFC: '+p.rfc);
    if(p.ciudad) addMetaSpan(p.ciudad);
    addMetaSpan(condLabels2[p.condiciones_pago]||'Crédito 30d');
    if(p.tipo && p.tipo!=='general'){
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.cssText = 'background:#F1EFE8;color:#5f5e5a;';
      badge.textContent = tipoLabels[p.tipo]||p.tipo;
      meta.appendChild(badge);
    }
  } else {
    meta.textContent = (p.rfc ? 'RFC: '+p.rfc+' · ' : '') + (p.tipo||'General');
  }

  info.appendChild(nameEl);
  info.appendChild(meta);

  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;';
  var editBtn = document.createElement('button');
  editBtn.className = 'btn-sm';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', function(e){
    e.stopPropagation();
    editarProveedor(p.id);
  });
  actions.appendChild(editBtn);

  card.appendChild(avatar);
  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function renderTop5Proveedores(top5, container){
  container.innerHTML = '';
  if(!top5.length){ container.textContent = 'Sin compras registradas'; return; }
  var frag = document.createDocumentFragment();
  top5.forEach(function(d, i){
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
    var label = document.createElement('span');
    label.style.cssText = 'color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;';
    label.textContent = (i+1)+'. '+d[0];
    var amount = document.createElement('span');
    amount.style.cssText = 'color:var(--text-2);flex-shrink:0;';
    amount.textContent = fmt(d[1]);
    row.appendChild(label);
    row.appendChild(amount);
    frag.appendChild(row);
  });
  container.appendChild(frag);
}

function renderProveedores(){
  var el = document.getElementById('proveedores-list');
  var ct = document.getElementById('prov-count');
  if(!el) return;
  ct.textContent = proveedores.length + ' proveedor' + (proveedores.length!==1?'es':'');
  el.innerHTML = '';
  if(!proveedores.length){
    var empty = document.createElement('div');
    empty.className = 'empty-state-cta';
    empty.innerHTML = '<div class="empty-state-icon">🛒</div>'
      + '<div class="empty-state-msg">Sin proveedores. Se crean automáticamente al importar facturas SAT recibidas.</div>'
      + '<button class="btn-primary" onclick="abrirNuevoProveedor()">+ Nuevo proveedor</button>';
    el.appendChild(empty);
    return;
  }
  var frag = document.createDocumentFragment();
  proveedores.forEach(function(p){ frag.appendChild(renderProveedorCard(p, true)); });
  el.appendChild(frag);
}

function abrirNuevoProveedor(){
  document.getElementById('prov-id-edit').value='';
  document.getElementById('prov-modal-title').textContent='Nuevo proveedor';
  document.getElementById('prov-nombre').value='';
  document.getElementById('prov-rfc').value='';
  document.getElementById('prov-ciudad').value='';
  document.getElementById('prov-tipo').value='general';
  document.getElementById('prov-pago').value='30';
  document.getElementById('prov-clabe').value='';
  document.getElementById('prov-limite').value=0;
  document.getElementById('prov-categoria').value='';
  document.getElementById('prov-calificacion').value=0;
  document.getElementById('prov-notas').value='';
  document.getElementById('prov-activo').checked=true;
  document.getElementById('prov-modal').style.display='flex';
}

function editarProveedor(id){
  var p=proveedores.find(function(x){return x.id===id;});
  if(!p)return;
  document.getElementById('prov-id-edit').value=p.id;
  document.getElementById('prov-modal-title').textContent='Editar proveedor';
  document.getElementById('prov-nombre').value=p.nombre||'';
  document.getElementById('prov-rfc').value=p.rfc||'';
  document.getElementById('prov-ciudad').value=p.ciudad||'';
  document.getElementById('prov-tipo').value=p.tipo||'general';
  document.getElementById('prov-pago').value=p.condiciones_pago||'30';
  document.getElementById('prov-clabe').value=p.clabe||'';
  document.getElementById('prov-limite').value=p.limite_credito||0;
  document.getElementById('prov-categoria').value=p.categoria||'';
  document.getElementById('prov-calificacion').value=p.calificacion||0;
  document.getElementById('prov-notas').value=p.notas||'';
  document.getElementById('prov-modal').style.display='flex';
}

function cerrarModalProveedor(){document.getElementById('prov-modal').style.display='none';}

async function guardarProveedor(){
  var nombre=document.getElementById('prov-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio.');return;}
  var btn=document.getElementById('btn-save-prov');
  btn.disabled=true; btn.textContent='Guardando...';
  var id=document.getElementById('prov-id-edit').value||Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  var rfcVal = document.getElementById('prov-rfc').value.trim().toUpperCase();
  if(!rfcVal){ showError('El RFC es obligatorio.'); btn.disabled=false; btn.textContent='Guardar'; return; }
  if(!validarRFC(rfcVal)){ showError('RFC inválido. Debe tener 12 caracteres (persona moral) o 13 (persona física).'); btn.disabled=false; btn.textContent='Guardar'; return; }
  var p={
    id:id, nombre:nombre,
    rfc:rfcVal,
    ciudad:document.getElementById('prov-ciudad').value.trim()||null,
    tipo:document.getElementById('prov-tipo').value,
    condiciones_pago:document.getElementById('prov-pago').value,
    clabe:document.getElementById('prov-clabe').value.trim()||null,
    limite_credito:parseFloat(document.getElementById('prov-limite').value)||0,
    categoria:document.getElementById('prov-categoria').value||null,
    calificacion:parseInt(document.getElementById('prov-calificacion').value)||0,
    notas:document.getElementById('prov-notas').value.trim()||null,
    activo:document.getElementById('prov-activo').checked
  };
  try{
    await upsertProveedor(p);
    proveedores=proveedores.filter(function(x){return x.id!==id;});
    proveedores.push(p);
    proveedores.sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
    cerrarModalProveedor();
    cacheInvalidate('proveedores');
    await loadProveedores(true);
    showStatus('✓ Proveedor guardado');
  }catch(e){showError('Error: '+e.message);}
  finally{btn.disabled=false; btn.textContent='Guardar';}
}

async function eliminarProveedor(id){
  var p=proveedores.find(function(x){return x.id===id;});
  if(!confirm('¿Eliminar proveedor "'+(p?p.nombre:id)+'"?'))return;
  try{
    await deleteProveedor(id);
    proveedores=proveedores.filter(function(x){return x.id!==id;});
    allProveedores=proveedores;
    cacheInvalidate('proveedores');
    renderProveedoresList(proveedores);
    showStatus('✓ Proveedor eliminado');
  }catch(e){showError('No se pudo eliminar: '+e.message);}
}

// ── Proveedores KPIs ──────────────────────────────────────
async function loadProveedoresKPIs(){
  try{
    var año=new Date().getFullYear();
    var {data:cxpRaw}=await sb.from('facturas').select('emisor_nombre,total').eq('tipo','recibida').eq('conciliado',false).eq('estatus','vigente');
    var cxp=(cxpRaw||[]).map(function(f){return {contraparte:f.emisor_nombre,monto:f.total};});
    var totalCXP=(cxp||[]).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    document.getElementById('prov-k-cxp').textContent=fmt(totalCXP);
    document.getElementById('prov-k-pendientes') && (document.getElementById('prov-k-pendientes').textContent=(cxp||[]).length);

    var añoStart=año+'-01-01', añoEnd=(año+1)+'-01-01';
    var empRfcsProv=new Set((allEmpleados||[]).map(function(e){return (e.rfc||'').trim().toUpperCase();}));
    var empNomsProv=new Set((allEmpleados||[]).map(function(e){return (e.nombre||'').trim().toLowerCase();}));
    var {data:ytdCompras}=await sb.from('facturas')
      .select('emisor_nombre,emisor_rfc,total,efecto_sat')
      .eq('tipo','recibida').not('efecto_sat','ilike','%nómin%')
      .gte('fecha',añoStart).lt('fecha',añoEnd);
    var byProv={};
    (ytdCompras||[]).forEach(function(f){
      var rfc=(f.emisor_rfc||'').trim().toUpperCase();
      var k=(f.emisor_nombre||'').trim();
      if(!k) return;
      if(rfc&&empRfcsProv.has(rfc)) return;
      if(empNomsProv.has(k.toLowerCase())) return;
      byProv[k]=(byProv[k]||0)+(parseFloat(f.total)||0);
    });
    var top5=Object.entries(byProv).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var topEl=document.getElementById('prov-k-top');
    renderTop5Proveedores(top5, topEl);
  }catch(e){console.error('Proveedores KPIs:',e);}
}

// [T7] allProveedores → M2State alias en config.js
function filtrarProveedores(q){
  var ql=(q||'').toLowerCase();
  var filtroActivo=document.getElementById('proveedores-activo-filter');
  var soloActivos=!filtroActivo||filtroActivo.value==='activo';
  var filtered=allProveedores.filter(function(p){
    if(soloActivos&&p.activo===false)return false;
    if(!ql)return true;
    return (p.nombre||'').toLowerCase().includes(ql)||(p.rfc||'').toLowerCase().includes(ql);
  });
  renderProveedoresList(filtered);
}

function renderProveedoresList(list){
  var el = document.getElementById('proveedores-list');
  var ct = document.getElementById('prov-count');
  ct.textContent = list.length + ' proveedor' + (list.length!==1?'es':'');
  el.innerHTML = '';
  if(!list.length){
    var empty = document.createElement('div');
    empty.className = 'empty-state-cta';
    empty.innerHTML = '<div class="empty-state-icon">🛒</div>'
      + '<div class="empty-state-msg">Sin proveedores</div>'
      + '<button class="btn-primary" onclick="abrirNuevoProveedor()">+ Nuevo proveedor</button>';
    el.appendChild(empty);
    return;
  }
  var frag = document.createDocumentFragment();
  applyProvSort(list).forEach(function(p){ frag.appendChild(renderProveedorCard(p, false)); });
  el.appendChild(frag);
}

async function loadProveedores(forceRefresh){
  try{
    proveedores=await fetchWithCache('proveedores',async function(){
      var {data,error}=await sb.from('proveedores').select('*').order('nombre',{ascending:true}).limit(500);
      if(error)throw error;
      return data||[];
    },forceRefresh);
    allProveedores=proveedores;
    var kt=document.getElementById('prov-k-total'); if(kt)kt.textContent=proveedores.length;
    renderProveedoresList(proveedores);
  }catch(e){console.error('Proveedores:',e);}
}

