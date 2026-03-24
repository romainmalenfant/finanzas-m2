// ── Rentabilidad ──────────────────────────────────────────
var _rentProyectoId = null;
var _rentCostos     = [];   // costos del proyecto abierto
var _rentLineas     = [];   // líneas del form actual
var _rentAllCostos  = [];   // todos los costos cargados (para KPIs globales)

var RENT_CAT_LABELS = {
  mano_obra:'Mano de obra', materiales:'Materiales',
  maquinaria:'Maquinaria y equipo', herramientas:'Herramientas',
  seguridad:'Equipo de seguridad', servicios:'Servicios', otro:'Otro'
};

// ── Carga principal ───────────────────────────────────────
async function loadRentabilidad(){
  var el = document.getElementById('rent-list');
  if(!el) return;
  try{
    // Necesitamos proyectos y sus costos
    if(!(allProyectos||[]).length) await loadProyectos();
    var projs = allProyectos||[];

    // Cargar costos de todos los proyectos
    var {data:costos} = await sb.from('proyecto_costos')
      .select('id,proyecto_id,monto,categoria')
      .in('proyecto_id', projs.map(function(p){return p.id;}));
    _rentAllCostos = costos||[];

    filtrarRentabilidad(document.getElementById('rent-search').value||'');
  }catch(e){ if(el) el.innerHTML='<div style="color:#f87171;font-size:12px;padding:8px;">Error: '+e.message+'</div>'; }
}

function filtrarRentabilidad(q){
  var projs = allProyectos||[];
  var query = (q||'').toLowerCase().trim();
  if(query) projs = projs.filter(function(p){
    return ((p.nombre_pedido||'')+(p.nombre_cliente||'')).toLowerCase().indexOf(query)!==-1;
  });
  renderRentList(projs);
}

function renderRentList(projs){
  var el = document.getElementById('rent-list');
  if(!el) return;

  // Agrupar costos por proyecto
  var costosByProj = {};
  _rentAllCostos.forEach(function(c){
    if(!costosByProj[c.proyecto_id]) costosByProj[c.proyecto_id]=0;
    costosByProj[c.proyecto_id]+=(parseFloat(c.monto)||0);
  });

  var totalIng=0, totalCos=0;
  var rows = projs.map(function(p){
    var ingresos = parseFloat(p.monto_total)||0;
    var costos   = costosByProj[p.id]||0;
    var margen   = ingresos - costos;
    var pct      = ingresos>0 ? Math.round((margen/ingresos)*100) : null;
    var barW     = ingresos>0 ? Math.max(0,Math.min(100,Math.round((costos/ingresos)*100))) : 0;
    var margenColor = margen>=0 ? '#16a34a' : '#dc2626';
    totalIng+=ingresos; totalCos+=costos;
    return '<div style="display:grid;grid-template-columns:1.8fr 110px 110px 110px 90px 100px;gap:8px;align-items:center;'+
      'padding:10px 12px;border-bottom:.5px solid var(--border);cursor:pointer;transition:background .12s;"'+
      ' onmouseenter="this.style.background=\'var(--bg-card-2)\'"'+
      ' onmouseleave="this.style.background=\'\'"'+
      ' onclick="abrirRentProyecto(\''+p.id+'\')"'+
    '>'+
      '<div>'+
        '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(p.nombre_pedido)+'</div>'+
        '<div style="font-size:11px;color:var(--text-3);">'+esc(p.nombre_cliente||'')+'</div>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--text-2);text-align:right;">'+fmt(ingresos)+'</div>'+
      '<div style="font-size:12px;color:var(--text-2);text-align:right;">'+fmt(costos)+'</div>'+
      '<div style="font-size:12px;font-weight:600;color:'+margenColor+';text-align:right;">'+fmt(margen)+'</div>'+
      '<div style="font-size:12px;font-weight:600;color:'+margenColor+';text-align:right;">'+(pct!==null?pct+'%':'—')+'</div>'+
      '<div style="background:var(--bg-card-2);border-radius:4px;height:6px;overflow:hidden;">'+
        '<div style="width:'+barW+'%;height:100%;background:'+(barW>75?'#dc2626':barW>50?'#d97706':'#16a34a')+';border-radius:4px;transition:width .3s;"></div>'+
      '</div>'+
    '</div>';
  }).join('');

  var totalMargen = totalIng - totalCos;
  var totalPct    = totalIng>0 ? Math.round((totalMargen/totalIng)*100) : null;

  // Actualizar KPIs globales
  var ki=document.getElementById('rent-k-ingresos'); if(ki) ki.textContent=fmt(totalIng);
  var kc=document.getElementById('rent-k-costos');   if(kc) kc.textContent=fmt(totalCos);
  var km=document.getElementById('rent-k-margen');   if(km){ km.textContent=fmt(totalMargen); km.style.color=totalMargen>=0?'#16a34a':'#dc2626'; }
  var kp=document.getElementById('rent-k-pct');      if(kp){ kp.textContent=totalPct!==null?totalPct+'%':'—'; kp.style.color=totalPct>=50?'#16a34a':totalPct>=25?'#d97706':'#dc2626'; }

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1.8fr 110px 110px 110px 90px 100px;gap:8px;padding:6px 12px;'+
      'font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;border-bottom:.5px solid var(--border);">'+
      '<span>Proyecto</span><span style="text-align:right;">Ingresos</span><span style="text-align:right;">Costos</span>'+
      '<span style="text-align:right;">Margen</span><span style="text-align:right;">%</span><span>Costos vs ingresos</span>'+
    '</div>'+
    (rows || '<div class="empty-state">Sin proyectos</div>');
}

// ── Detalle de proyecto ───────────────────────────────────
async function abrirRentProyecto(proyId){
  _rentProyectoId = proyId;
  var p = (allProyectos||[]).find(function(x){return x.id===proyId;});
  if(!p) return;

  document.getElementById('rent-modal-title').textContent   = p.nombre_pedido;
  document.getElementById('rent-modal-subtitle').textContent = p.nombre_cliente||'';
  document.getElementById('rent-costos-modal').style.display = 'flex';
  document.getElementById('rent-historial').innerHTML = '<div style="font-size:12px;color:var(--text-3);">Cargando...</div>';

  try{
    var {data:costos} = await sb.from('proyecto_costos')
      .select('*').eq('proyecto_id', proyId).order('semana',{ascending:false}).order('created_at',{ascending:false});
    _rentCostos = costos||[];
    renderRentHistorial(p);
  }catch(e){ document.getElementById('rent-historial').innerHTML='<div style="color:#f87171;font-size:12px;">Error: '+e.message+'</div>'; }
}

function renderRentHistorial(p){
  var ingresos = parseFloat(p.monto_total)||0;
  var costos   = _rentCostos.reduce(function(a,c){return a+(parseFloat(c.monto)||0);},0);
  var margen   = ingresos - costos;
  var pct      = ingresos>0 ? Math.round((margen/ingresos)*100) : null;
  var mc       = margen>=0?'#16a34a':'#dc2626';

  var ki=document.getElementById('rent-proj-ing'); if(ki) ki.textContent=fmt(ingresos);
  var kc=document.getElementById('rent-proj-cos'); if(kc) kc.textContent=fmt(costos);
  var km=document.getElementById('rent-proj-mar'); if(km){ km.textContent=fmt(margen); km.style.color=mc; }
  var kp=document.getElementById('rent-proj-pct'); if(kp){ kp.textContent=pct!==null?pct+'%':'—'; kp.style.color=mc; }

  if(!_rentCostos.length){
    document.getElementById('rent-historial').innerHTML='<div class="empty-state" style="font-size:12px;">Sin costos registrados</div>';
    return;
  }

  // Agrupar por semana
  var semanas = {};
  _rentCostos.forEach(function(c){
    var k = c.semana;
    if(!semanas[k]) semanas[k]=[];
    semanas[k].push(c);
  });

  var html = Object.keys(semanas).map(function(sem){
    var items = semanas[sem];
    var totalSem = items.reduce(function(a,c){return a+(parseFloat(c.monto)||0);},0);
    // Agrupar por categoría dentro de la semana
    var byCat = {};
    items.forEach(function(c){
      if(!byCat[c.categoria]) byCat[c.categoria]=[];
      byCat[c.categoria].push(c);
    });
    return '<div style="margin-bottom:14px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'+
        '<div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;">Semana del '+fmtDate(sem)+'</div>'+
        '<div style="font-size:12px;font-weight:600;color:var(--text-1);">'+fmt(totalSem)+'</div>'+
      '</div>'+
      Object.keys(byCat).map(function(cat){
        var catItems = byCat[cat];
        return '<div style="background:var(--bg-card-2);border-radius:8px;padding:8px 10px;margin-bottom:6px;">'+
          '<div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">'+
            (RENT_CAT_LABELS[cat]||cat)+
            (catItems[0].subcategoria?' · <span style="color:var(--text-2);">'+esc(catItems[0].subcategoria)+'</span>':'')+
          '</div>'+
          catItems.map(function(c){
            return '<div style="display:grid;grid-template-columns:2fr 50px 70px 70px 70px 28px;gap:6px;align-items:center;font-size:12px;padding:3px 0;border-bottom:.5px solid var(--border);">'+
              '<span style="color:var(--text-1);">'+esc(c.concepto)+'</span>'+
              '<span style="color:var(--text-3);">'+c.cantidad+'</span>'+
              '<span style="color:var(--text-3);">'+esc(c.unidad||'')+'</span>'+
              '<span style="color:var(--text-3);">'+fmt(parseFloat(c.precio_unitario)||0)+'</span>'+
              '<span style="font-weight:600;text-align:right;">'+fmt(parseFloat(c.monto)||0)+'</span>'+
              '<button onclick="eliminarCosto(\''+c.id+'\')" style="background:none;border:none;color:var(--text-4);cursor:pointer;font-size:14px;padding:0;line-height:1;" title="Eliminar">×</button>'+
            '</div>';
          }).join('')+
        '</div>';
      }).join('')+
    '</div>';
  }).join('');

  document.getElementById('rent-historial').innerHTML = html;
}

function cerrarRentCostos(){
  document.getElementById('rent-costos-modal').style.display='none';
  _rentProyectoId=null; _rentCostos=[];
  loadRentabilidad();
}

// ── Form de captura de costos ─────────────────────────────
function abrirFormCosto(){
  _rentLineas=[];
  // Fecha: lunes de la semana actual
  var hoy = new Date();
  var dia = hoy.getDay();
  var lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia===0?6:dia-1));
  document.getElementById('costo-semana').value = lunes.toISOString().split('T')[0];
  document.getElementById('costo-categoria').value = 'mano_obra';
  document.getElementById('costo-subcategoria').value = '';
  actualizarSubcatOptions();
  agregarLineaCosto();
  document.getElementById('rent-form-modal').style.display='flex';
}

function cerrarFormCosto(){
  document.getElementById('rent-form-modal').style.display='none';
}

function agregarLineaCosto(){
  var id = Date.now()+Math.random().toString(36).slice(2,5);
  _rentLineas.push({id:id});
  renderLineas();
}

function eliminarLinea(id){
  _rentLineas = _rentLineas.filter(function(l){return l.id!==id;});
  if(!_rentLineas.length) agregarLineaCosto();
  else renderLineas();
}

function renderLineas(){
  var el = document.getElementById('costo-lineas');
  if(!el) return;
  el.innerHTML = _rentLineas.map(function(l){
    return '<div id="linea-'+l.id+'" style="display:grid;grid-template-columns:2fr 70px 80px 90px 80px 28px;gap:6px;align-items:center;margin-bottom:5px;">'+
      '<input type="text" placeholder="Concepto (ej: Juan Pérez)"'+
        ' style="padding:6px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);font-size:12px;width:100%;"'+
        ' oninput="calcLinea(\''+l.id+'\')" id="lc-'+l.id+'">'+
      '<input type="number" placeholder="1" min="0" step="any"'+
        ' style="padding:6px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);font-size:12px;width:100%;"'+
        ' oninput="calcLinea(\''+l.id+'\')" id="lq-'+l.id+'" value="1">'+
      '<input type="text" placeholder="horas"'+
        ' style="padding:6px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);font-size:12px;width:100%;"'+
        ' id="lu-'+l.id+'" value="horas">'+
      '<input type="number" placeholder="0.00" min="0" step="any"'+
        ' style="padding:6px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);font-size:12px;width:100%;"'+
        ' oninput="calcLinea(\''+l.id+'\')" id="lp-'+l.id+'">'+
      '<div id="lt-'+l.id+'" style="font-size:12px;font-weight:600;color:#16a34a;text-align:right;">$0</div>'+
      '<button onclick="eliminarLinea(\''+l.id+'\')" style="background:none;border:none;color:var(--text-4);cursor:pointer;font-size:18px;padding:0;line-height:1;">×</button>'+
    '</div>';
  }).join('');
  calcTotal();
}

function calcLinea(id){
  var q = parseFloat(document.getElementById('lq-'+id).value)||0;
  var p = parseFloat(document.getElementById('lp-'+id).value)||0;
  var t = q*p;
  var el = document.getElementById('lt-'+id);
  if(el) el.textContent = fmt(t);
  calcTotal();
}

function calcTotal(){
  var total = 0;
  _rentLineas.forEach(function(l){
    var q = parseFloat((document.getElementById('lq-'+l.id)||{}).value)||0;
    var p = parseFloat((document.getElementById('lp-'+l.id)||{}).value)||0;
    total += q*p;
  });
  var el = document.getElementById('costo-total-preview');
  if(el) el.textContent = fmt(total);
}

async function guardarCostos(){
  if(!_rentProyectoId) return;
  var semana   = document.getElementById('costo-semana').value;
  var cat      = document.getElementById('costo-categoria').value;
  var subcat   = document.getElementById('costo-subcategoria').value.trim()||null;
  if(!semana){ alert('Selecciona la semana.'); return; }

  var rows = [];
  var valido = true;
  _rentLineas.forEach(function(l){
    var concepto = (document.getElementById('lc-'+l.id)||{}).value.trim();
    var cantidad = parseFloat((document.getElementById('lq-'+l.id)||{}).value)||0;
    var unidad   = (document.getElementById('lu-'+l.id)||{}).value.trim()||'pzs';
    var precio   = parseFloat((document.getElementById('lp-'+l.id)||{}).value)||0;
    if(!concepto||!cantidad||!precio){ valido=false; return; }
    rows.push({
      id: Date.now().toString()+Math.random().toString(36).slice(2,5),
      proyecto_id: _rentProyectoId,
      semana, categoria:cat, subcategoria:subcat,
      concepto, cantidad, unidad, precio_unitario:precio
    });
  });

  if(!valido||!rows.length){ alert('Completa todos los campos de cada línea (concepto, cantidad y precio).'); return; }

  // Guardar subcategoría en localStorage para autocomplete
  if(subcat) guardarSubcat(cat, subcat);

  try{
    var {error} = await sb.from('proyecto_costos').insert(rows);
    if(error) throw error;
    cerrarFormCosto();
    showStatus('✓ '+rows.length+' costo'+(rows.length!==1?'s':'')+' registrado'+(rows.length!==1?'s':''));
    await abrirRentProyecto(_rentProyectoId);
  }catch(e){ showError('Error: '+e.message); }
}

async function eliminarCosto(id){
  if(!confirm('¿Eliminar este costo?')) return;
  try{
    await sb.from('proyecto_costos').delete().eq('id',id);
    _rentCostos = _rentCostos.filter(function(c){return c.id!==id;});
    var p = (allProyectos||[]).find(function(x){return x.id===_rentProyectoId;});
    if(p) renderRentHistorial(p);
    showStatus('Costo eliminado');
  }catch(e){ showError('Error: '+e.message); }
}

// ── Autocomplete subcategorías (localStorage) ─────────────
function _subcatKey(cat){ return 'rent_subcat_'+cat; }

function guardarSubcat(cat, val){
  var key   = _subcatKey(cat);
  var saved = JSON.parse(localStorage.getItem(key)||'[]');
  if(!saved.includes(val)) saved.unshift(val);
  if(saved.length>20) saved=saved.slice(0,20);
  localStorage.setItem(key, JSON.stringify(saved));
}

function getSubcats(cat){
  return JSON.parse(localStorage.getItem(_subcatKey(cat))||'[]');
}

function actualizarSubcatOptions(){
  document.getElementById('costo-subcategoria').value='';
  cerrarSubcatDD();
}

function mostrarSubcatAC(){
  var cat  = document.getElementById('costo-categoria').value;
  var vals = getSubcats(cat);
  mostrarSubcatDDItems(vals);
}

function filtrarSubcatAC(q){
  var cat  = document.getElementById('costo-categoria').value;
  var vals = getSubcats(cat).filter(function(v){ return v.toLowerCase().indexOf(q.toLowerCase())!==-1; });
  mostrarSubcatDDItems(vals);
}

function mostrarSubcatDDItems(vals){
  var dd = document.getElementById('costo-subcat-dd');
  if(!vals.length){ cerrarSubcatDD(); return; }
  dd.innerHTML = vals.map(function(v){
    return '<div style="padding:8px 12px;font-size:12px;cursor:pointer;color:var(--text-1);"'+
      ' onmouseenter="this.style.background=\'var(--bg-card-2)\'"'+
      ' onmouseleave="this.style.background=\'\'"'+
      ' onclick="selSubcat(\''+esc(v)+'\')">'+esc(v)+'</div>';
  }).join('');
  dd.style.display='block';
}

function selSubcat(v){
  document.getElementById('costo-subcategoria').value=v;
  cerrarSubcatDD();
}

function cerrarSubcatDD(){
  var dd=document.getElementById('costo-subcat-dd');
  if(dd) dd.style.display='none';
}

document.addEventListener('click',function(e){
  if(!e.target.closest('#costo-subcategoria')&&!e.target.closest('#costo-subcat-dd')) cerrarSubcatDD();
});
