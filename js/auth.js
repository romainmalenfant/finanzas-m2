// ── Auth ─────────────────────────────────────────────────
async function hacerLogin(){
  var email=document.getElementById('login-email').value.trim();
  var pass=document.getElementById('login-password').value;
  var btn=document.getElementById('login-btn');
  var errEl=document.getElementById('login-error');
  if(!email||!pass){errEl.textContent='Ingresa tu correo y contraseña.';errEl.style.display='block';return;}
  btn.textContent='Entrando...';btn.disabled=true;errEl.style.display='none';
  try{
    var {data,error}=await sb.auth.signInWithPassword({email:email,password:pass});
    if(error)throw error;
    mostrarApp(data.user);
  }catch(e){
    errEl.textContent=e.message==='Invalid login credentials'?'Correo o contraseña incorrectos.':e.message;
    errEl.style.display='block';
  }finally{btn.textContent='Entrar';btn.disabled=false;}
}

function mostrarApp(user){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('user-badge').textContent=user.email.split('@')[0];
  // Run init if not already done
  if(!window._appInited){window._appInited=true;iniciarApp();}
}

async function iniciarApp(){
  switchTab('dashboard', document.getElementById('sb-dashboard'));
  var name=getUserName();
  if(name){
    var ni=document.getElementById('user-name-input');
    if(ni)ni.value=name;
  }
  loadMovements();
  loadClientes();
  startPolling();
  // Load badge data immediately on startup
  loadBadgeData();
}

async function loadBadgeData(){
  // Load each independently so one failure doesn't block others
  try{
    var {data:cxc}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha')
      .eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente');
    _cxcRows=cxc||[];
  }catch(e){console.warn('Badge CxC:',e); _cxcRows=[];}

  try{
    var {data:cxp}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha')
      .eq('origen','sat_recibida').eq('conciliado',false);
    _cxpRows=cxp||[];
  }catch(e){console.warn('Badge CxP:',e); _cxpRows=[];}

  try{
    var año=new Date().getFullYear();
    var {data:projs}=await sb.from('proyectos').select('*').eq('year',año);
    var ids=(projs||[]).map(function(p){return p.id;});
    var ents=[];
    if(ids.length){
      var {data:ed}=await sb.from('entregas').select('*').in('proyecto_id',ids);
      ents=ed||[];
    }
    entregasByProyecto={};
    ents.forEach(function(e){
      if(!entregasByProyecto[e.proyecto_id])entregasByProyecto[e.proyecto_id]=[];
      entregasByProyecto[e.proyecto_id].push(e);
    });
    if(typeof proyectos==='undefined'||!proyectos.length) proyectos=projs||[];
  }catch(e){console.warn('Badge proyectos:',e);}

  updateBadges();
}

async function cerrarSesion(){
  await sb.auth.signOut();
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-email').value='';
  document.getElementById('login-password').value='';
}

async function checkSession(){
  var {data:{session}}=await sb.auth.getSession();
  if(session&&session.user){
    mostrarApp(session.user);
    return true;
  }
  return false;
}

// ── Init ─────────────────────────────────────────────────
(async function init(){
  // Configure PDF.js worker only when the library has loaded (it is deferred)
  if(typeof pdfjsLib!=='undefined')
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  // Check existing session — if valid, mostrarApp calls iniciarApp
  var hasSession=await checkSession();
  if(!hasSession)return; // wait for login
})();

