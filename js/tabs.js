// ── switchTab ─────────────────────────────────────────────
// Depende de APP_MODULES y APP_MODULES_MAP definidos en config.js
function switchTab(tab, btn){
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

  // Mostrar/ocultar selector de período
  var tb=document.querySelector('.topbar');
  if(tb){
    if(mod.showPeriod)tb.classList.remove('hide-period');
    else tb.classList.add('hide-period');
  }

  // Inicializar módulo
  if(tab==='dashboard')    loadDashboard();
  if(tab==='proyectos')    loadProyectos();
  if(tab==='clientes')     {loadClientes();loadClientesKPIs();}
  if(tab==='proveedores')  {loadProveedores();loadProveedoresKPIs();}
  if(tab==='contactos')    loadContactos();
  if(tab==='empleados')    loadEmpleados();
  if(tab==='sat')          initSATTab();
  if(tab==='cotizaciones') loadCotizaciones();
  if(tab==='facturas')     loadFacturas();
}
