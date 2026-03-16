// ── Sidebar badges ────────────────────────────────────────
function updateBadges(){
  var hoy=new Date();
  // SAT — facturas emitidas sin cobrar >30 días
  if(_cxcRows){
    var venc=_cxcRows.filter(function(m){return Math.floor((hoy-new Date(m.fecha))/(864e5))>30;}).length;
    var b=document.getElementById('badge-sat');
    if(b){b.style.display=venc>0?'flex':'none';b.textContent=venc>9?'9+':String(venc);}
  }
  // Proveedores — CxP sin pagar >30 días
  if(_cxpRows){
    var vp=_cxpRows.filter(function(m){return Math.floor((hoy-new Date(m.fecha))/(864e5))>30;}).length;
    var bp=document.getElementById('badge-proveedores');
    if(bp){bp.style.display=vp>0?'flex':'none';bp.textContent=vp>9?'9+':String(vp);}
  }
  // Proyectos atrasados
  if(typeof proyectos!=='undefined'&&proyectos.length&&typeof entregasByProyecto!=='undefined'){
    var atr=proyectos.filter(function(p){
      var ents=entregasByProyecto[p.id]||[];
      var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
      var est=estadoProyecto(p,entregadas);
      return(est.lbl||est)==='Atrasado';
    }).length;
    var bj=document.getElementById('badge-proyectos');
    if(bj){bj.style.display=atr>0?'flex':'none';bj.textContent=atr>9?'9+':String(atr);}
  }
}

function invalidateMovementCache(){cacheInvalidate('ytd_'+new Date().getFullYear());_ytdMvmts=null;_cxcRows=null;_cxpRows=null;}
async function deleteRow(id){
  var {error}=await sb.from(TABLE).delete().eq('id',id);
  if(error)throw error;
}

// ── Proyectos DB ─────────────────────────────────────────
var entregasByProyecto={};

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

// ── Navigation ───────────────────────────────────────────
function prevMonth(){if(curMonth===0){curMonth=11;curYear--;}else{curMonth--;}loadMovements();}
function nextMonth(){if(curMonth===11){curMonth=0;curYear++;}else{curMonth++;}loadMovements();}
function goToday(){var n=new Date();curYear=n.getFullYear();curMonth=n.getMonth();loadMovements();}
function handleKey(e){if(e.ctrlKey&&e.key==='Enter')processMovement();}

