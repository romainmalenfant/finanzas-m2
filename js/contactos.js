
function setContactoTipo(tipo){
  var esEmpresa = tipo==='empresa';
  // Toggle buttons
  var btnEmp = document.getElementById('cont-tipo-empresa');
  var btnProv = document.getElementById('cont-tipo-proveedor');
  if(btnEmp) { btnEmp.classList.toggle('active', esEmpresa); }
  if(btnProv){ btnProv.classList.toggle('active', !esEmpresa); }
  // Show/hide fields
  var campoEmp  = document.getElementById('cont-campo-empresa');
  var campoProv = document.getElementById('cont-campo-proveedor');
  if(campoEmp)  campoEmp.style.display  = esEmpresa  ? 'block' : 'none';
  if(campoProv) campoProv.style.display = !esEmpresa ? 'block' : 'none';
  // Clear the hidden field of the type not shown
  if(esEmpresa){
    var hp = document.getElementById('contacto-proveedor-sel');
    var sp = document.getElementById('contacto-prov-search');
    if(hp) hp.value=''; if(sp) sp.value='';
  } else {
    var hc = document.getElementById('contacto-cliente-sel');
    var sc = document.getElementById('contacto-empresa-search');
    if(hc) hc.value=''; if(sc) sc.value='';
  }
}

function _resetACInput(id){
  // Clona el input para eliminar todos los listeners anteriores (fix Bug 4)
  var el=document.getElementById(id);
  if(!el)return;
  var clone=el.cloneNode(true);
  el.parentNode.replaceChild(clone,el);
}

function initContactoACs(){
  if(!document.getElementById('contacto-empresa-search')) return;
  _resetACInput('contacto-empresa-search');
  _resetACInput('contacto-prov-search');
  makeAutocomplete('contacto-empresa-search','contacto-cliente-sel','contacto-empresa-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},
    null
  );
  makeAutocomplete('contacto-prov-search','contacto-proveedor-sel','contacto-prov-dd',
    function(){return proveedores.map(function(p){return {id:p.id,label:p.nombre,sub:p.rfc||''};});},
    null
  );
}

function setContactoEmpresa(id, nombre){
  setContactoTipo('empresa');
  var inp=document.getElementById('contacto-empresa-search');
  var hid=document.getElementById('contacto-cliente-sel');
  if(inp) inp.value=nombre||'';
  if(hid) hid.value=id||'';
}
// ── Contactos ─────────────────────────────────────────────
var contactos=[], allContactos=[];

async function loadContactos(){
  try{
    var {data,error}=await sb.from('contactos').select('*,clientes(nombre),proveedores(nombre)').order('nombre',{ascending:true});
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
    var empresa=c.clientes&&c.clientes.nombre
      ? c.clientes.nombre
      : (c.proveedores&&c.proveedores.nombre ? '🛒 '+c.proveedores.nombre : 'Sin empresa');
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
  var empInp=document.getElementById('contacto-empresa-search');
  if(empInp)empInp.value='';
  // Reset toggle to empresa by default
  setContactoTipo('empresa');
  document.getElementById('contacto-proveedor-sel') && (document.getElementById('contacto-proveedor-sel').value='');
  document.getElementById('contacto-prov-search') && (document.getElementById('contacto-prov-search').value='');
  // Garantizar que ambos arrays estén cargados antes de registrar los ACs
  var loads = [];
  if(!clientes.length)    loads.push(loadClientes());
  if(!proveedores.length) loads.push(loadProveedores());
  Promise.all(loads).then(function(){ initContactoACs(); });
  // Si ya estaban cargados, inicializar de inmediato también
  if(!loads.length) initContactoACs();
  document.getElementById('contacto-activo').checked=true;
  document.getElementById('contacto-modal').style.display='flex';
}

// Abre el modal de nuevo contacto pre-vinculado a una empresa o proveedor
function abrirNuevoContactoConVinculo(tipo, id, nombre){
  abrirNuevoContacto();
  // Esperar a que el modal y los ACs estén listos
  setTimeout(function(){
    setContactoTipo(tipo);
    if(tipo==='empresa'){
      var inp=document.getElementById('contacto-empresa-search');
      var hid=document.getElementById('contacto-cliente-sel');
      if(inp) inp.value=nombre||'';
      if(hid) hid.value=id||'';
    } else {
      var inp=document.getElementById('contacto-prov-search');
      var hid=document.getElementById('contacto-proveedor-sel');
      if(inp) inp.value=nombre||'';
      if(hid) hid.value=id||'';
    }
  }, 120);
}


// ── Búsqueda inline de contacto (Bug 2 / Nice-to-have 1 & 2) ──────────
// Genera HTML de un widget inline de búsqueda de contacto
function renderBuscarContactoHTML(tipo, entityId, entityNombre){
  var uid=entityId.replace(/[^a-z0-9]/gi,'').slice(0,12);
  return '<div style="margin-top:8px;" id="cont-buscar-wrap-'+uid+'">'+
    '<div style="position:relative;">'+
      '<input type="text" id="cont-buscar-inp-'+uid+'"'+
        ' placeholder="Buscar contacto existente..."'+
        ' autocomplete="off"'+
        ' oninput="buscarContactoInline(this.value,\''+tipo+'\',\''+entityId+'\',\''+esc(entityNombre)+'\',\''+uid+'\')"'+
        ' style="width:100%;padding:7px 10px;font-size:12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-1);">'+
      '<div id="cont-buscar-dd-'+uid+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;z-index:600;max-height:180px;overflow-y:auto;margin-top:2px;box-shadow:0 4px 16px var(--shadow);"></div>'+
    '</div>'+
  '</div>';
}

function buscarContactoInline(q, tipo, entityId, entityNombre, uid){
  var dd=document.getElementById('cont-buscar-dd-'+uid);
  if(!dd)return;
  var ql=(q||'').toLowerCase().trim();
  if(!ql){dd.style.display='none';return;}

  // Filter contacts not already linked to this entity
  var matches=(contactos||[]).filter(function(c){
    if(tipo==='empresa'&&c.cliente_id===entityId)return false; // already linked
    if(tipo==='proveedor'&&c.proveedor_id===entityId)return false;
    var nombre=((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
    return nombre.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
  }).slice(0,6);

  dd.style.display='block';
  dd.innerHTML=matches.map(function(c){
    var nombre=(c.nombre||'')+(c.apellido?' '+c.apellido:'');
    return '<div style="padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:12px;"'+
      ' onmousedown="asociarContactoExistente(\''+c.id+'\',\''+tipo+'\',\''+entityId+'\');document.getElementById(\'cont-buscar-dd-'+uid+'\').style.display=\'none\'">'+
      '<div style="font-weight:500;color:var(--text-1);">'+esc(nombre)+'</div>'+
      '<div style="font-size:10px;color:var(--text-3);">'+(c.cargo||'')+(c.email?' · '+c.email:'')+'</div>'+
    '</div>';
  }).join('')+
  '<div style="padding:9px 12px;cursor:pointer;font-size:12px;color:#60a5fa;font-weight:500;border-top:0.5px solid var(--border);"'+
    ' onmousedown="document.getElementById(\'cont-buscar-dd-'+uid+'\').style.display=\'none\';abrirNuevoContactoConVinculo(\''+tipo+'\',\''+entityId+'\',\''+esc(entityNombre)+'\')"'+
  '>+ Crear nuevo contacto</div>';
}

async function asociarContactoExistente(contactoId, tipo, entityId){
  try{
    var update=tipo==='empresa' ? {cliente_id:entityId,proveedor_id:null} : {proveedor_id:entityId,cliente_id:null};
    var {error}=await sb.from('contactos').update(update).eq('id',contactoId);
    if(error)throw error;
    showStatus('✓ Contacto asociado');
    loadContactos();
    // Refresh the current detail view
    if(tipo==='empresa') verDetalleEmpresa(entityId);
    else verDetalleProveedor(entityId);
  }catch(e){showError('Error: '+e.message);}
}

function editarContacto(id){
  var c=contactos.find(function(x){return x.id===id;});
  if(!c)return;
  // Bug 3: limpiar TODOS los campos de vinculación antes de cargar el nuevo contacto
  var empInpE=document.getElementById('contacto-empresa-search');
  var provInpE=document.getElementById('contacto-prov-search');
  var hidCli=document.getElementById('contacto-cliente-sel');
  var hidProv=document.getElementById('contacto-proveedor-sel');
  if(empInpE) empInpE.value='';
  if(provInpE) provInpE.value='';
  if(hidCli) hidCli.value='';
  if(hidProv) hidProv.value='';
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
  // Restore tipo toggle based on saved data
  if(!clientes.length) loadClientes();
  if(!proveedores.length) loadProveedores();
  initContactoACs();
  if(c.proveedor_id){
    setContactoTipo('proveedor');
    var provObj=proveedores.find(function(p){return p.id===c.proveedor_id;});
    if(provObj){
      var pi=document.getElementById('contacto-prov-search'); if(pi) pi.value=provObj.nombre;
      var ph=document.getElementById('contacto-proveedor-sel'); if(ph) ph.value=c.proveedor_id;
    }
  } else {
    setContactoTipo('empresa');
    sel.value=c.cliente_id||'';
    var empInp=document.getElementById('contacto-empresa-search');
    if(empInp&&c.cliente_id){
      var cliObj=clientes.find(function(cl){return cl.id===c.cliente_id;});
      if(cliObj) empInp.value=cliObj.nombre;
    }
  }
  document.getElementById('contacto-modal').style.display='flex';
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
    proveedor_id:document.getElementById('contacto-proveedor-sel')&&document.getElementById('contacto-proveedor-sel').value||null,
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

