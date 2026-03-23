// ── Sidebar badges ────────────────────────────────────────
function updateBadges(){
  try{
    var hoy=new Date();
    // SAT — facturas emitidas sin cobrar >30 días
    if(_cxcRows&&_cxcRows.length>=0){
      var venc=_cxcRows.filter(function(m){
        try{return Math.floor((hoy-new Date(m.fecha))/(864e5))>30;}catch(e){return false;}
      }).length;
      var b=document.getElementById('badge-sat');
      if(b){b.style.display=venc>0?'flex':'none';b.textContent=venc>9?'9+':String(venc);}
    }
    // Proveedores — CxP sin pagar >30 días
    if(_cxpRows&&_cxpRows.length>=0){
      var vp=_cxpRows.filter(function(m){
        try{return Math.floor((hoy-new Date(m.fecha))/(864e5))>30;}catch(e){return false;}
      }).length;
      var bp=document.getElementById('badge-proveedores');
      if(bp){bp.style.display=vp>0?'flex':'none';bp.textContent=vp>9?'9+':String(vp);}
    }
    // Proyectos atrasados
    if(typeof proyectos!=='undefined'&&proyectos.length&&
       typeof entregasByProyecto!=='undefined'&&typeof estadoProyecto==='function'){
      var atr=proyectos.filter(function(p){
        try{
          var ents=entregasByProyecto[p.id]||[];
          var entregadas=ents.reduce(function(a,e){return a+Number(e.piezas||0);},0);
          var est=estadoProyecto(p,entregadas);
          return(est.lbl||est)==='Atrasado';
        }catch(e){return false;}
      }).length;
      var bj=document.getElementById('badge-proyectos');
      if(bj){bj.style.display=atr>0?'flex':'none';bj.textContent=atr>9?'9+':String(atr);}
    }
  }catch(e){console.error('updateBadges:',e);}
}

function invalidateMovementCache(){cacheInvalidate('ytd_'+new Date().getFullYear());_ytdMvmts=null;_cxcRows=null;_cxpRows=null;}
async function deleteRow(id){
  var {error}=await sb.from(TABLE).delete().eq('id',id);
  if(error)throw error;
}

// ── Proyectos DB ─────────────────────────────────────────
// [T7] entregasByProyecto → M2State alias en config.js

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
function handleKey(e){if(e.ctrlKey&&e.key==='Enter')processMovement();}

// Inicializa los selectores de período del tab Flujo
function initFlujoSelectors(){
  var ySel=document.getElementById('flujo-year-sel');
  if(ySel&&!ySel.options.length){
    var yr=new Date().getFullYear();
    for(var y=yr-3;y<=yr+1;y++){
      var o=document.createElement('option');
      o.value=y;o.textContent=y;
      if(y===curYear)o.selected=true;
      ySel.appendChild(o);
    }
  } else if(ySel){ySel.value=String(curYear);}
  var mSel=document.getElementById('flujo-month-sel');
  if(mSel&&!mSel.options.length){
    var todosOpt=document.createElement('option');
    todosOpt.value=-1;todosOpt.textContent='Todos los meses';
    mSel.appendChild(todosOpt);
    MONTHS.forEach(function(m,i){
      var o=document.createElement('option');
      o.value=i;o.textContent=m;
      if(i===curMonth)o.selected=true;
      mSel.appendChild(o);
    });
  } else if(mSel){mSel.value=String(curMonth);}
}


// ── Polling ──────────────────────────────────────────────
function startPolling(){
  if(pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(function(){loadMovements();}, 60000);
}
