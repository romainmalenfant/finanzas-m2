// ── Empleados ─────────────────────────────────────────────
var empleados=[], allEmpleados=[];

async function loadEmpleados(){
  try{
    var {data,error}=await sb.from('empleados').select('*').order('nombre',{ascending:true});
    if(error){
      document.getElementById('empleados-list').innerHTML='<div class="empty-state" style="color:#f87171;">Tabla <code>empleados</code> no encontrada. Créala en Supabase primero.</div>';
      return;
    }
    empleados=data||[]; allEmpleados=empleados;
    var activos=empleados.filter(function(e){return e.estatus==='Activo';}).length;
    var nomina=empleados.filter(function(e){return e.estatus==='Activo';}).reduce(function(a,e){return a+Number(e.salario_mensual||0);},0);
    var areas=new Set(empleados.map(function(e){return e.area;}).filter(Boolean)).size;
    document.getElementById('emp-k-total').textContent=empleados.length;
    document.getElementById('emp-k-activos').textContent=activos;
    document.getElementById('emp-k-nomina').textContent=fmt(nomina);
    document.getElementById('emp-k-areas').textContent=areas;
    document.getElementById('empleados-count').textContent=empleados.length+' empleado'+(empleados.length!==1?'s':'');
    renderEmpleados(empleados);
  }catch(e){console.error('Empleados:',e);}
}

function filtrarEmpleados(q){
  var ql=(q||'').toLowerCase();
  var filtroActivo=document.getElementById('empleados-activo-filter');
  var soloActivos=!filtroActivo||filtroActivo.value==='activo';
  var f=allEmpleados.filter(function(e){
    if(soloActivos&&e.activo===false)return false;
    if(!ql)return true;
    return (e.nombre||'').toLowerCase().includes(ql)||(e.cargo||'').toLowerCase().includes(ql)||(e.area||'').toLowerCase().includes(ql);
  });
  renderEmpleados(f);
}

function renderEmpleados(list){
  var el=document.getElementById('empleados-list');
  if(!list.length){el.innerHTML='<div class="empty-state">Sin empleados</div>';return;}
  var statusColor={'Activo':'#34d399','Inactivo':'#fbbf24','Baja':'#f87171'};
  el.innerHTML=list.map(function(e){
    var nombre=(e.nombre||'')+(e.apellido?' '+e.apellido:'');
    var ini=nombre.trim().split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
    var sc=statusColor[e.estatus]||'#475569';
    return '<div class="cliente-card" style="cursor:pointer;" onclick="verDetalleEmpleado(\''+esc(String(e.id))+'\')">'+
      '<div class="cliente-avatar" style="background:var(--bg-card-2);color:'+sc+';">'+esc(ini)+'</div>'+
      '<div class="cliente-info">'+
        '<div class="cliente-nombre">'+esc(nombre)+'</div>'+
        '<div class="cliente-meta" style="display:flex;gap:10px;flex-wrap:wrap;">'+
          (e.cargo?'<span>'+esc(e.cargo)+'</span>':'')+
          (e.area?'<span style="color:#60a5fa;">'+esc(e.area)+'</span>':'')+
          (e.salario_mensual?'<span>'+fmt(parseFloat(e.salario_mensual)||0)+'</span>':'')+
          '<span style="color:'+sc+';">'+esc(e.estatus||'Activo')+'</span>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="btn-sm" onclick="editarEmpleado(\''+esc(String(e.id))+'\')">Editar</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function abrirNuevoEmpleado(){
  ['emp-nombre','emp-apellido','emp-cargo','emp-area','emp-email','emp-tel'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('emp-salario').value='';
  document.getElementById('emp-ingreso').value='';
  document.getElementById('emp-estatus').value='Activo';
  document.getElementById('empleado-id-edit').value='';
  document.getElementById('empleado-modal-title').textContent='Nuevo empleado';
  document.getElementById('empleado-modal').style.display='flex';
}

function editarEmpleado(id){
  var e=empleados.find(function(x){return String(x.id)===String(id);});
  if(!e)return;
  document.getElementById('empleado-id-edit').value=e.id;
  document.getElementById('empleado-modal-title').textContent='Editar empleado';
  document.getElementById('emp-nombre').value=e.nombre||'';
  document.getElementById('emp-apellido').value=e.apellido||'';
  document.getElementById('emp-cargo').value=e.cargo||'';
  document.getElementById('emp-area').value=e.area||'';
  document.getElementById('emp-salario').value=e.salario_mensual||'';
  document.getElementById('emp-ingreso').value=e.fecha_ingreso||'';
  document.getElementById('emp-email').value=e.email||'';
  document.getElementById('emp-tel').value=e.telefono||'';
  document.getElementById('emp-estatus').value=e.estatus||'Activo';
  document.getElementById('emp-contrato').value=e.tipo_contrato||'';
  document.getElementById('emp-rfc').value=e.rfc||'';
  document.getElementById('emp-imss').value=e.imss||'';
  document.getElementById('emp-clabe').value=e.clabe||'';
  document.getElementById('emp-vacaciones').value=e.dias_vacaciones||0;
  document.getElementById('emp-emg-nombre').value=e.contacto_emergencia_nombre||'';
  document.getElementById('emp-emg-tel').value=e.contacto_emergencia_tel||'';
  document.getElementById('emp-notas').value=e.notas||'';
  document.getElementById('emp-tiene-contrato').checked=!!e.tiene_contrato;
  document.getElementById('emp-imss-activo').checked=!!e.imss_activo;
  document.getElementById('emp-activo').checked=(e.activo!==false);
  document.getElementById('emp-contrato').value='';
  document.getElementById('emp-rfc').value='';
  document.getElementById('emp-imss').value='';
  document.getElementById('emp-clabe').value='';
  document.getElementById('emp-vacaciones').value=0;
  document.getElementById('emp-emg-nombre').value='';
  document.getElementById('emp-emg-tel').value='';
  document.getElementById('emp-notas').value='';
  document.getElementById('emp-tiene-contrato').checked=false;
  document.getElementById('emp-imss-activo').checked=false;
  document.getElementById('empleado-modal').style.display='flex';
}

async function guardarEmpleado(){
  var nombre=document.getElementById('emp-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio.');return;}
  var btn=document.getElementById('btn-save-empleado');
  btn.disabled=true; btn.textContent='Guardando...';
  var idEdit=document.getElementById('empleado-id-edit').value;
  var rec={
    nombre:nombre,
    apellido:document.getElementById('emp-apellido').value.trim()||null,
    cargo:document.getElementById('emp-cargo').value.trim()||null,
    area:document.getElementById('emp-area').value.trim()||null,
    salario_mensual:parseFloat(document.getElementById('emp-salario').value)||null,
    fecha_ingreso:document.getElementById('emp-ingreso').value||null,
    email:document.getElementById('emp-email').value.trim()||null,
    telefono:document.getElementById('emp-tel').value.trim()||null,
    estatus:document.getElementById('emp-estatus').value,
    tipo_contrato:document.getElementById('emp-contrato').value||null,
    rfc:(document.getElementById('emp-rfc').value.trim().toUpperCase())||null,
    imss:document.getElementById('emp-imss').value.trim()||null,
    clabe:document.getElementById('emp-clabe').value.trim()||null,
    dias_vacaciones:parseInt(document.getElementById('emp-vacaciones').value)||0,
    contacto_emergencia_nombre:document.getElementById('emp-emg-nombre').value.trim()||null,
    contacto_emergencia_tel:document.getElementById('emp-emg-tel').value.trim()||null,
    notas:document.getElementById('emp-notas').value.trim()||null,
    tiene_contrato:document.getElementById('emp-tiene-contrato').checked,
    imss_activo:document.getElementById('emp-imss-activo').checked,
    activo:document.getElementById('emp-activo').checked
  };
  if(idEdit)rec.id=idEdit;
  try{
    var {error}=await sb.from('empleados').upsert([rec]);
    if(error)throw error;
    document.getElementById('empleado-modal').style.display='none';
    showStatus('✓ Empleado guardado');
    loadEmpleados();
  }catch(e){showError('Error: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

async function eliminarEmpleado(id){
  var e=empleados.find(function(x){return String(x.id)===String(id);});
  if(!confirm('¿Eliminar '+(e?e.nombre:id)+'?'))return;
  try{await sb.from('empleados').delete().eq('id',id);loadEmpleados();}
  catch(err){showError('Error: '+err.message);}
}


