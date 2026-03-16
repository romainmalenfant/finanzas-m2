// ── Tab colors ────────────────────────────────────────────
var TAB_COLORS = {
  dashboard:   '#60a5fa',
  finanzas:    '#34d399',
  proyectos:   '#fbbf24',
  clientes:    '#60a5fa',
  proveedores: '#f87171',
  contactos:   '#a78bfa',
  empleados:   '#94a3b8',
  sat:         '#fb923c',
  cotizaciones:'#34d399'
};

// ── switchTab updated ────────────────────────────────────
function switchTab(tab, btn){
  var all=['dashboard','finanzas','proyectos','clientes','proveedores','contactos','empleados','sat','cotizaciones'];
  all.forEach(function(t){
    var el=document.getElementById('tab-'+t);
    if(el)el.style.display='none';
    var sb=document.getElementById('sb-'+t);
    if(sb)sb.classList.remove('active');
  });
  var panel=document.getElementById('tab-'+tab);
  if(panel)panel.style.display='block';

  // Apply color and active state
  var activeBtn = btn || document.getElementById('sb-'+tab);
  if(activeBtn){
    activeBtn.classList.add('active');
    var color = TAB_COLORS[tab]||'#60a5fa';
    activeBtn.style.setProperty('--tab-color', color);
  }

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
  if(tab==='cotizaciones')loadCotizaciones();
}

