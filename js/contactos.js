// ── Contactos ─────────────────────────────────────────────
var contactos=[], allContactos=[];

async function loadContactos(){
  try{
    var {data,error}=await sb.from('contactos').select('*,clientes(nombre)').order('nombre',{ascending:true});
    if(error)throw error;
    contactos=data||[];allContactos=contactos;
    var kt=document.getElementById('cont-k-total'); if(kt)kt.textContent=contactos.length;
    var ka=document.getElementById('cont-k-activos'); if(ka)ka.textContent=contactos.filter(function(c){return c.activo!==false;}).length;
    var ke=document.getElementById('cont-k-empresas'); if(ke){var es=new Set(contactos.filter(function(c){return c.cliente_id;}).map(function(c){return c.cliente_id;}));ke.textContent=es.size;}
    // Populate cliente select in modal
    var sel=document.getElementById('contacto-cliente-sel');
    sel.innerHTML='<option value="">— Sin empresa —</option>';
    clientes.forEach(function(c){
      var o=document.createElement('option');
      o.value=c.id;o.textContent=c.nombre;
      sel.appendChild(o);
    });
    renderContactosList(contactos);
  }catch(e){console.error('Contactos:',e);}
}

function filtrarContactos(q){
  var ql=(q||'').toLowerCase();
  var filtroActivo=document.getElementById('contactos-activo-filter');
  var soloActivos=!filtroActivo||filtroActivo.value==='activo';
  var filtered=allContactos.filter(function(c){
    if(soloActivos&&c.activo===false)return false;
    if(!ql)return true;
    return (c.nombre||'').toLowerCase().includes(ql)||
           (c.apellido||'').toLowerCase().includes(ql)||
           (c.cargo||'').toLowerCase().includes(ql)||
           (c.clientes&&c.clientes.nombre||'').toLowerCase().includes(ql);
  });
  renderContactosList(filtered);
}

function renderContactosList(list){
  var el=document.getElementById('contactos-list');
  var ct=document.getElementById('contactos-count');
  ct.textContent=list.length+' contacto'+(list.length!==1?'s':'');
  if(!list.length){el.innerHTML='<div class="empty-state">Sin contactos registrados</div>';return;}
  el.innerHTML=list.map(function(c){
    var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
    var initials=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
    var empresa=c.clientes&&c.clientes.nombre?c.clientes.nombre:'Sin empresa';
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleContacto(\''+esc(c.id)+'\')">'+
      '<div class="cliente-avatar" style="background:var(--bg-hover);color:#60a5fa;">'+esc(initials)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(nombre)+'</div>'+
        '<div class="cliente-meta" style="display:flex;gap:10px;flex-wrap:wrap;">'+
          '<span style="color:#60a5fa;">'+esc(empresa)+'</span>'+
          (c.cargo?'<span>'+esc(c.cargo)+'</span>':'')+
          (c.email?'<span>'+esc(c.email)+'</span>':'')+
          (c.telefono?'<span>'+esc(c.telefono)+'</span>':'')+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="editarContacto(\''+esc(c.id)+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function abrirNuevoContacto(){
  document.getElementById('contacto-id-edit').value='';
  document.getElementById('contacto-modal-title').textContent='Nuevo contacto';
  document.getElementById('contacto-nombre').value='';
  document.getElementById('contacto-apellido').value='';
  document.getElementById('contacto-cargo').value='';
  document.getElementById('contacto-email').value='';
  document.getElementById('contacto-tel').value='';
  document.getElementById('contacto-notas').value='';
  document.getElementById('contacto-cliente-sel').value='';
  // Ensure clientes loaded
  if(!clientes.length)loadClientes();
  else{
    var sel=document.getElementById('contacto-cliente-sel');
    sel.innerHTML='<option value="">— Sin empresa —</option>';
    clientes.forEach(function(c){var o=document.createElement('option');o.value=c.id;o.textContent=c.nombre;sel.appendChild(o);});
  }
  document.getElementById('contacto-activo').checked=true;
  document.getElementById('contacto-modal').style.display='block';
}

function editarContacto(id){
  var c=contactos.find(function(x){return x.id===id;});
  if(!c)return;
  document.getElementById('contacto-id-edit').value=c.id;
  document.getElementById('contacto-modal-title').textContent='Editar contacto';
  document.getElementById('contacto-nombre').value=c.nombre||'';
  document.getElementById('contacto-apellido').value=c.apellido||'';
  document.getElementById('contacto-cargo').value=c.cargo||'';
  document.getElementById('contacto-email').value=c.email||'';
  document.getElementById('contacto-tel').value=c.telefono||'';
  document.getElementById('contacto-notas').value=c.notas||'';
  // Populate select then set value
  var sel=document.getElementById('contacto-cliente-sel');
  sel.innerHTML='<option value="">— Sin empresa —</option>';
  clientes.forEach(function(cl){var o=document.createElement('option');o.value=cl.id;o.textContent=cl.nombre;sel.appendChild(o);});
  sel.value=c.cliente_id||'';
  document.getElementById('contacto-modal').style.display='block';
}

function cerrarModalContacto(){document.getElementById('contacto-modal').style.display='none';}

async function guardarContacto(){
  var nombre=document.getElementById('contacto-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio.');return;}
  var btn=document.getElementById('btn-save-contacto');
  btn.disabled=true;btn.textContent='Guardando...';
  var id=document.getElementById('contacto-id-edit').value||Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  var c={
    id:id,nombre:nombre,
    apellido:document.getElementById('contacto-apellido').value.trim()||null,
    cargo:document.getElementById('contacto-cargo').value.trim()||null,
    email:document.getElementById('contacto-email').value.trim()||null,
    telefono:document.getElementById('contacto-tel').value.trim()||null,
    notas:document.getElementById('contacto-notas').value.trim()||null,
    cliente_id:document.getElementById('contacto-cliente-sel').value||null,
    activo:document.getElementById('contacto-activo').checked
  };
  try{
    var {error}=await sb.from('contactos').upsert([c]);
    if(error)throw error;
    cerrarModalContacto();
    showStatus('✓ Contacto guardado');
    loadContactos();
  }catch(e){showError('Error: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

async function eliminarContacto(id){
  var c=contactos.find(function(x){return x.id===id;});
  if(!confirm('¿Eliminar contacto "'+(c?c.nombre+' '+(c.apellido||''):id)+'"?'))return;
  try{await sb.from('contactos').delete().eq('id',id);contactos=contactos.filter(function(x){return x.id!==id;});allContactos=contactos;renderContactosList(contactos);}
  catch(e){showError('Error: '+e.message);}
}

function filtrarProyectos(q){
  var ql=(q||'').toLowerCase();
  var año=document.getElementById('proj-year-filter').value;
  var status=document.getElementById('proj-status-filter').value;
  var filtered=proyectos.filter(function(p){
    if(año&&p.year&&String(p.year)!==String(año))return false;
    if(status){
      var ents=entregasByProyecto[p.id]||[];
      var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
      var est=estadoProyecto(p,entregadas);
      if((est.lbl||est)!==status)return false;
    }
    if(!ql)return true;
    return (p.nombre_cliente||'').toLowerCase().includes(ql)||
           (p.nombre_pedido||'').toLowerCase().includes(ql)||
           (p.tipo_pieza||'').toLowerCase().includes(ql);
  });
  document.getElementById('proj-count').textContent=filtered.length+' proyecto'+(filtered.length!==1?'s':'');
  proyectos=filtered;
  renderProyectos();
  proyectos=allProyectos; // restore after render
}

