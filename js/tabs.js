// ── Fallback si config_append.js no fue aplicado aún ────
if(typeof APP_MODULES === 'undefined'){
  console.warn('APP_MODULES no definido. Agrega config_append.js a config.js');
  var APP_MODULES = [
    {id:'dashboard',label:'Dashboard',icon:'📊',color:'#60a5fa',showPeriod:false},
    {id:'finanzas',label:'Finanzas',icon:'💰',color:'#34d399',showPeriod:true},
    {id:'cotizaciones',label:'Cotizaciones',icon:'📄',color:'#34d399',showPeriod:false},
    {id:'proyectos',label:'Proyectos',icon:'📋',color:'#fbbf24',showPeriod:false},
    {id:'clientes',label:'Empresas',icon:'🏢',color:'#60a5fa',showPeriod:false},
    {id:'proveedores',label:'Proveedores',icon:'🛒',color:'#f87171',showPeriod:false},
    {id:'contactos',label:'Contactos',icon:'👤',color:'#a78bfa',showPeriod:false},
    {id:'empleados',label:'Empleados',icon:'👥',color:'#94a3b8',showPeriod:false},
    {id:'sat',label:'SAT & Banco',icon:'🏦',color:'#fb923c',showPeriod:true},
    {id:'facturas',label:'Facturas',icon:'🧾',color:'#a78bfa',showPeriod:false},
    {id:'documentos',label:'Documentos',icon:'📁',color:'#38bdf8',showPeriod:false}
  ];
  var APP_MODULES_MAP = Object.fromEntries(APP_MODULES.map(function(m){return [m.id,m];}));
}

// ── switchTab ─────────────────────────────────────────────
// Depende de APP_MODULES y APP_MODULES_MAP definidos en config.js
function switchTab(tab, btn){
  // FAB: los 3 botones en dashboard, finanzas y facturas
  var fabCobranza = document.getElementById('fab-cobranza');
  var fabGasto    = document.getElementById('fab-gasto');
  var fabFactura  = document.getElementById('fab-factura-emitida');
  if(tab==='dashboard'||tab==='finanzas'||tab==='facturas'){
    if(fabCobranza) fabCobranza.style.display='flex';
    if(fabGasto)    fabGasto.style.display='flex';
    if(fabFactura)  fabFactura.style.display='flex';
    if(typeof showFAB==='function') showFAB();
  } else {
    if(typeof hideFAB==='function') hideFAB();
  }
  // Cerrar modales de rentabilidad al salir del tab
  ['rent-costos-modal','rent-form-modal'].forEach(function(id){
    var m=document.getElementById(id); if(m) m.style.display='none';
  });
  // Ocultar todos usando el registro central
  APP_MODULES.forEach(function(m){
    var el=document.getElementById('tab-'+m.id);
    if(el)el.style.display='none';
    var sb=document.getElementById('sb-'+m.id);
    if(sb)sb.classList.remove('active');
  });

  var panel=document.getElementById('tab-'+tab);
  if(panel)panel.style.display='block';

  // Color y estado activo desde APP_MODULES_MAP (O1)
  var mod=APP_MODULES_MAP[tab]||{color:'#60a5fa'};
  var activeBtn=btn||document.getElementById('sb-'+tab);
  if(activeBtn){
    activeBtn.classList.add('active');
    activeBtn.style.setProperty('--tab-color', mod.color);
  }

  // Inicializar módulo
  if(tab==='dashboard')    loadDashboard();
  if(tab==='finanzas')     {initFlujoSelectors();loadMovements();}
  if(tab==='proyectos')    loadProyectos();
  if(tab==='rentabilidad') loadRentabilidad();
  if(tab==='clientes')     {loadClientes();loadClientesKPIs();}
  if(tab==='proveedores')  {loadProveedores();loadProveedoresKPIs();}
  if(tab==='contactos')    loadContactos();
  if(tab==='empleados')    loadEmpleados();
  if(tab==='sat')          initSATTab();
  if(tab==='cotizaciones') loadCotizaciones();
  if(tab==='facturas')     loadFacturas();
  if(tab==='documentos')   docsInit();
}
