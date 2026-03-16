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
  initApiKeyBanner();
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
  try{
    var hoy=new Date();
    // CxC — facturas emitidas sin cobrar
    var {data:cxc}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha,numero_factura,rfc_contraparte')
      .eq('origen','sat_emitida').eq('conciliado',false);
    _cxcRows=cxc||[];

    // CxP — facturas recibidas sin pagar
    var {data:cxp}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha,numero_factura,rfc_contraparte')
      .eq('origen','sat_recibida').eq('conciliado',false);
    _cxpRows=cxp||[];

    // Proyectos atrasados
    var {data:projs}=await sb.from('proyectos').select('*').eq('year',new Date().getFullYear());
    var {data:ents}=await sb.from('entregas').select('*').in('proyecto_id',(projs||[]).map(function(p){return p.id;}));
    entregasByProyecto={};
    (ents||[]).forEach(function(e){if(!entregasByProyecto[e.proyecto_id])entregasByProyecto[e.proyecto_id]=[];entregasByProyecto[e.proyecto_id].push(e);});
    proyectos=(projs||[]);

    updateBadges();
  }catch(e){console.error('loadBadgeData:',e);}
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
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  // Check existing session — if valid, mostrarApp calls iniciarApp
  var hasSession=await checkSession();
  if(!hasSession)return; // wait for login
})();

