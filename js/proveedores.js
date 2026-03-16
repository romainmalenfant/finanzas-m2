// ── Proveedores DB & UI ──────────────────────────────────
async function loadProveedores(){
  try{
    var {data,error}=await sb.from('proveedores').select('*').order('nombre',{ascending:true});
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
  var {error}=await sb.from('proveedores').delete().eq('id',id);
  if(error)throw error;
}

var tipoLabels={general:'General',nomina:'Nómina',servicios:'Servicios',material:'Material',financiero:'Financiero'};
var condLabels2={inmediato:'Pago inmediato','15':'Crédito 15d','30':'Crédito 30d','60':'Crédito 60d','90':'Crédito 90d'};

function renderProveedores(){
  var el=document.getElementById('proveedores-list');
  var ct=document.getElementById('prov-count');
  if(!el)return;
  ct.textContent=proveedores.length+' proveedor'+(proveedores.length!==1?'es':'');
  if(!proveedores.length){
    el.innerHTML='<div class="empty-state">Sin proveedores. Se crean automáticamente al importar facturas SAT recibidas.</div>';
    return;
  }
  el.innerHTML=proveedores.map(function(p){
    var initials=(p.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    var tipoBadge=p.tipo&&p.tipo!=='general'?'<span class="badge" style="background:#F1EFE8;color:#5f5e5a;">'+esc(tipoLabels[p.tipo]||p.tipo)+'</span>':'';
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleEmpresa(\''+esc(c.id)+'\')">'+
      '<div class="cliente-avatar" style="background:#e8e6e0;">'+esc(initials)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(p.nombre)+'</div>'+
        '<div class="cliente-meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'+
          (p.rfc?'<span>RFC: '+esc(p.rfc)+'</span>':'')+
          (p.ciudad?'<span>'+esc(p.ciudad)+'</span>':'')+
          '<span>'+(condLabels2[p.condiciones_pago]||'Crédito 30d')+'</span>'+
          tipoBadge+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="event.stopPropagation();editarProveedor(\''+esc(p.id)+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
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
  document.getElementById('prov-modal').style.display='block';
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
  document.getElementById('prov-modal').style.display='block';
}

function cerrarModalProveedor(){document.getElementById('prov-modal').style.display='none';}

async function guardarProveedor(){
  var nombre=document.getElementById('prov-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio.');return;}
  var btn=document.getElementById('btn-save-prov');
  btn.disabled=true; btn.textContent='Guardando...';
  var id=document.getElementById('prov-id-edit').value||Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  var p={
    id:id, nombre:nombre,
    rfc:document.getElementById('prov-rfc').value.trim().toUpperCase()||null,
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
    renderProveedores();
  }catch(e){showError('No se pudo eliminar: '+e.message);}
}

// ── Proveedores KPIs ──────────────────────────────────────
async function loadProveedoresKPIs(){
  try{
    var año=new Date().getFullYear();
    var {data:cxp}=await sb.from('movimientos_v2').select('contraparte,monto').eq('origen','sat_recibida').eq('conciliado',false);
    var totalCXP=(cxp||[]).reduce(function(a,m){return a+Number(m.monto);},0);
    document.getElementById('prov-k-cxp').textContent=fmt(totalCXP);
    document.getElementById('prov-k-pendientes') && (document.getElementById('prov-k-pendientes').textContent=(cxp||[]).length);

    var {data:ytdCompras}=await sb.from('movimientos_v2').select('contraparte,monto').eq('tipo','egreso').eq('year',año);
    var byProv={};
    (ytdCompras||[]).forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byProv[k]=(byProv[k]||0)+Number(m.monto);});
    var top5=Object.entries(byProv).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var topEl=document.getElementById('prov-k-top');
    if(top5.length){
      topEl.innerHTML=top5.map(function(d,i){
        return '<div style="display:flex;justify-content:space-between;gap:8px;">'+
          '<span style="color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;">'+(i+1)+'. '+esc(d[0])+'</span>'+
          '<span style="color:#94a3b8;flex-shrink:0;">'+fmt(d[1])+'</span>'+
        '</div>';
      }).join('');
    }else{topEl.textContent='Sin compras registradas';}
  }catch(e){console.error('Proveedores KPIs:',e);}
}

var allProveedores=[];
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
  var el=document.getElementById('proveedores-list');
  var ct=document.getElementById('prov-count');
  ct.textContent=list.length+' proveedor'+(list.length!==1?'es':'');
  if(!list.length){el.innerHTML='<div class="empty-state">Sin proveedores</div>';return;}
  el.innerHTML=list.map(function(p){
    var initials=(p.nombre||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleProveedor(\''+esc(p.id)+'\')">'+
      '<div class="cliente-avatar">'+esc(initials)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(p.nombre)+'</div>'+
        '<div class="cliente-meta">'+(p.rfc?'RFC: '+esc(p.rfc)+' · ':'')+
        (p.tipo||'General')+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="event.stopPropagation();editarProveedor(\''+esc(p.id)+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

async function loadProveedores(forceRefresh){
  if(!forceRefresh){
    var cached=cacheGet('proveedores');
    if(cached){
      proveedores=cached; allProveedores=cached;
      var kt=document.getElementById('prov-k-total'); if(kt)kt.textContent=proveedores.length;
      renderProveedoresList(proveedores); return;
    }
  }
  try{
    var {data,error}=await sb.from('proveedores').select('*').order('nombre',{ascending:true});
    if(error)throw error;
    proveedores=data||[]; allProveedores=proveedores;
    cacheSet('proveedores',proveedores);
    var kt=document.getElementById('prov-k-total'); if(kt)kt.textContent=proveedores.length;
    renderProveedoresList(proveedores);
  }catch(e){console.error('Proveedores:',e);}
}

