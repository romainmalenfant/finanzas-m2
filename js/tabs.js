// ── Tabs ─────────────────────────────────────────────────


// ── switchTab updated ────────────────────────────────────
function switchTab(tab, btn){
  var all=['dashboard','finanzas','proyectos','clientes','proveedores','contactos','empleados','sat'];
  all.forEach(function(t){
    var el=document.getElementById('tab-'+t);
    if(el)el.style.display='none';
    var sb=document.getElementById('sb-'+t);
    if(sb)sb.classList.remove('active');
  });
  var panel=document.getElementById('tab-'+tab);
  if(panel)panel.style.display='block';
  if(btn)btn.classList.add('active');
  else{var sb=document.getElementById('sb-'+tab);if(sb)sb.classList.add('active');}
  // Hide month nav — only show on finanzas and sat
  var tb=document.querySelector('.topbar');
  if(tb){
    var showPeriod=(tab==='finanzas'||tab==='sat');
    if(showPeriod)tb.classList.remove('hide-period');
    else tb.classList.add('hide-period');
  }
  if(tab==='dashboard')loadDashboard();
  if(tab==='proyectos')loadProyectos();
  if(tab==='clientes'){loadClientes();loadClientesKPIs();}
  if(tab==='proveedores'){loadProveedores();loadProveedoresKPIs();}
  if(tab==='contactos')loadContactos();
  if(tab==='empleados')loadEmpleados();
  if(tab==='sat')initSATTab();
}

