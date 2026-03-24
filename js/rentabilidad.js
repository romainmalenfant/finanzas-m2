// ── Rentabilidad ──────────────────────────────────────────
var _rentAllCostos   = [];
var _rentAllAsig     = [];    // factura_asignaciones globales (todos los proyectos)
var _rentExpanded    = null;  // id del proyecto expandido
var _rentLineas      = [];
var _rentProjCostos  = [];    // costos manuales del proyecto expandido
var _rentProjAsig    = [];    // factura_asignaciones del proyecto expandido
var _rentFactSelData = {};    // {projId: facturaData seleccionada}
var _rentFactOpts    = {};    // {projId: {factId: factData}} para evitar escaping
var _rentFactTimer   = {};    // debounce por projId

var RENT_CAT_LABELS = {
  mano_obra:'Mano de obra', materiales:'Materiales',
  maquinaria:'Maquinaria y equipo', herramientas:'Herramientas',
  seguridad:'Equipo de seguridad', servicios:'Servicios', otro:'Otro'
};

// ── Carga principal ───────────────────────────────────────
async function loadRentabilidad(){
  // Reset al entrar al tab — colapsa cualquier proyecto abierto
  _rentExpanded = null;
  _rentProjCostos = [];
  _rentProjAsig = [];
  _rentLineasByProj = {};
  _rentFactSelData = {};
  _rentFactOpts = {};
  var el = document.getElementById('rent-list');
  if(!el) return;
  try{
    if(!(allProyectos||[]).length) await loadProyectos();
    var projs = allProyectos||[];
    if(!projs.length){ el.innerHTML='<div class="empty-state">Sin proyectos</div>'; return; }
    var ids = projs.map(function(p){return p.id;});
    _rentAllCostos = await DB.costos.byProyectos(ids);
    _rentAllAsig = await DB.asignaciones.byProyectos(ids);
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

  var costosByProj = {};
  _rentAllCostos.forEach(function(c){
    costosByProj[c.proyecto_id]=(costosByProj[c.proyecto_id]||0)+(parseFloat(c.monto)||0);
  });
  _rentAllAsig.forEach(function(a){
    if(a.proyecto_id) costosByProj[a.proyecto_id]=(costosByProj[a.proyecto_id]||0)+(parseFloat(a.monto)||0);
  });

  var totalIng=0, totalCos=0;

  var rows = projs.map(function(p){
    var ingresos = parseFloat(p.monto_total)||0;
    var costos   = costosByProj[p.id]||0;
    var margen   = ingresos - costos;
    var pct      = ingresos>0 ? Math.round((margen/ingresos)*100) : null;
    var barW     = ingresos>0 ? Math.max(0,Math.min(100,Math.round((costos/ingresos)*100))) : 0;
    var barColor = barW>75?'#dc2626':barW>50?'#d97706':'#16a34a';
    var mc       = margen>=0?'#16a34a':'#dc2626';
    var isOpen   = _rentExpanded===p.id;
    totalIng+=ingresos; totalCos+=costos;

    return '<div>'+
      // Fila principal
      '<div style="display:grid;grid-template-columns:28px 1.8fr 110px 110px 110px 70px 120px;gap:8px;align-items:center;'+
        'padding:11px 12px;border-bottom:.5px solid var(--border);cursor:pointer;transition:background .12s;'+
        (isOpen?'background:var(--bg-card-2);':'')+'"'+
        ' onmouseenter="if(\''+p.id+'\'!==_rentExpanded)this.style.background=\'var(--bg-card-2)\'"'+
        ' onmouseleave="if(\''+p.id+'\'!==_rentExpanded)this.style.background=\'\'"'+
        ' onclick="toggleRentProyecto(\''+p.id+'\')"'+
      '>'+
        '<span style="font-size:14px;color:var(--text-3);transition:transform .2s;'+(isOpen?'transform:rotate(90deg)':'')+'">▶</span>'+
        '<div>'+
          '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(p.nombre_pedido)+'</div>'+
          '<div style="font-size:11px;color:var(--text-3);">'+esc(p.nombre_cliente||'')+'</div>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--text-2);text-align:right;">'+fmt(ingresos)+'</div>'+
        '<div style="font-size:12px;color:#dc2626;font-weight:500;text-align:right;">'+(costos>0?fmt(costos):'—')+'</div>'+
        '<div style="font-size:12px;font-weight:700;color:'+mc+';text-align:right;">'+fmt(margen)+'</div>'+
        '<div style="font-size:12px;font-weight:700;color:'+mc+';text-align:right;">'+(pct!==null?pct+'%':'—')+'</div>'+
        '<div style="background:var(--bg-hover);border-radius:4px;height:6px;overflow:hidden;">'+
          '<div style="width:'+barW+'%;height:100%;background:'+barColor+';border-radius:4px;"></div>'+
        '</div>'+
      '</div>'+
      // Sección expandida
      '<div id="rent-expand-'+p.id+'" style="display:'+(isOpen?'block':'none')+';">'+
        (isOpen ? _buildExpand(p) : '')+
      '</div>'+
    '</div>';
  }).join('');

  var totalMargen = totalIng - totalCos;
  var totalPct    = totalIng>0 ? Math.round((totalMargen/totalIng)*100) : null;
  var mc2         = totalMargen>=0?'#16a34a':'#dc2626';

  var ki=document.getElementById('rent-k-ingresos'); if(ki) ki.textContent=fmt(totalIng);
  var kc=document.getElementById('rent-k-costos');   if(kc) kc.textContent=fmt(totalCos);
  var km=document.getElementById('rent-k-margen');   if(km){ km.textContent=fmt(totalMargen); km.style.color=mc2; }
  var kp=document.getElementById('rent-k-pct');      if(kp){ kp.textContent=totalPct!==null?totalPct+'%':'—'; kp.style.color=mc2; }

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:28px 1.8fr 110px 110px 110px 70px 120px;gap:8px;'+
      'padding:6px 12px;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;border-bottom:.5px solid var(--border);">'+
      '<span></span><span>Proyecto</span><span style="text-align:right;">Ingresos</span>'+
      '<span style="text-align:right;">Costos</span><span style="text-align:right;">Margen</span>'+
      '<span style="text-align:right;">%</span><span>Costos/Ingresos</span>'+
    '</div>'+
    (rows||'<div class="empty-state">Sin proyectos</div>');
  // (líneas se inicializan al abrir el form, no al expandir el proyecto)
}

// ── Expand inline ─────────────────────────────────────────
async function toggleRentProyecto(id){
  if(_rentExpanded===id){
    // Colapsar
    _rentExpanded=null;
    _rentProjCostos=[];
    filtrarRentabilidad(document.getElementById('rent-search').value||'');
    return;
  }
  _rentExpanded=id;
  // Mostrar placeholder mientras carga
  filtrarRentabilidad(document.getElementById('rent-search').value||'');
  var expandEl=document.getElementById('rent-expand-'+id);
  if(expandEl) expandEl.innerHTML='<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>';

  try{
    var [costos,asig] = await Promise.all([
      DB.costos.byProyecto(id),
      DB.asignaciones.byProyecto(id)
    ]);
    _rentProjCostos=costos;
    _rentProjAsig=asig;
    var p=(allProyectos||[]).find(function(x){return x.id===id;});
    if(expandEl&&p){
      expandEl.innerHTML=_buildExpand(p);
      _rentLineasByProj[id]=[];   // se re-inicia al abrir el form
    }
  }catch(e){ if(expandEl) expandEl.innerHTML='<div style="padding:12px;color:#f87171;font-size:12px;">Error: '+e.message+'</div>'; }
}

function _buildExpand(p){
  var ingresos=parseFloat(p.monto_total)||0;
  var costos=_rentProjCostos.reduce(function(a,c){return a+(parseFloat(c.monto)||0);},0)
            +_rentProjAsig.reduce(function(a,c){return a+(parseFloat(c.monto)||0);},0);
  var margen=ingresos-costos;
  var pct=ingresos>0?Math.round((margen/ingresos)*100):null;
  var mc=margen>=0?'#16a34a':'#dc2626';

  // Agrupar por semana
  var semanas={};
  _rentProjCostos.forEach(function(c){
    if(!semanas[c.semana]) semanas[c.semana]=[];
    semanas[c.semana].push(c);
  });

  // Facturas asignadas
  var asigHTML='';
  if(_rentProjAsig.length){
    asigHTML='<div style="margin-top:10px;">'+
      '<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">🧾 Facturas asignadas</div>'+
      _rentProjAsig.map(function(a){
        return '<div style="display:grid;grid-template-columns:2fr 50px 70px 80px 28px;gap:6px;align-items:center;'+
          'font-size:12px;padding:5px 8px;background:var(--bg-card);border-radius:5px;margin-bottom:3px;">'+
          '<span style="color:var(--text-1);">'+esc(a.emisor_nombre||'Proveedor')+(a.numero_factura?' <span style="color:var(--text-3);">· '+esc(a.numero_factura)+'</span>':'')+'</span>'+
          '<span style="color:var(--text-3);text-align:center;">'+parseFloat(a.porcentaje).toFixed(1)+'%</span>'+
          '<span style="color:var(--text-3);text-align:right;">'+fmt(parseFloat(a.total_factura)||0)+'</span>'+
          '<span style="font-weight:600;text-align:right;color:#16a34a;">'+fmt(parseFloat(a.monto)||0)+'</span>'+
          '<button onclick="eliminarAsig(\''+a.id+'\',\''+p.id+'\')" title="Eliminar"'+
            ' style="background:none;border:none;color:var(--text-4);cursor:pointer;font-size:16px;padding:0;line-height:1;">×</button>'+
        '</div>';
      }).join('')+
    '</div>';
  }

  var historialHTML='<div class="empty-state" style="font-size:12px;">Sin costos registrados aún</div>';
  if(_rentProjCostos.length){
    historialHTML=Object.keys(semanas).map(function(sem){
      var items=semanas[sem];
      var totalSem=items.reduce(function(a,c){return a+(parseFloat(c.monto)||0);},0);
      var byCat={};
      items.forEach(function(c){ if(!byCat[c.categoria]) byCat[c.categoria]=[]; byCat[c.categoria].push(c); });
      return '<div style="margin-bottom:10px;">'+
        '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:.5px solid var(--border);margin-bottom:6px;">'+
          '<span style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.05em;">Sem. '+fmtDate(sem)+'</span>'+
          '<span style="font-size:12px;font-weight:600;">'+fmt(totalSem)+'</span>'+
        '</div>'+
        Object.keys(byCat).map(function(cat){
          var catItems=byCat[cat];
          return '<div style="margin-bottom:6px;">'+
            '<div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">'+
              (RENT_CAT_LABELS[cat]||cat)+(catItems[0].subcategoria?' · '+esc(catItems[0].subcategoria):'')+
            '</div>'+
            catItems.map(function(c){
              return '<div style="display:grid;grid-template-columns:2fr 50px 60px 70px 80px 28px;gap:6px;align-items:center;'+
                'font-size:12px;padding:4px 8px;background:var(--bg-card);border-radius:5px;margin-bottom:2px;">'+
                '<span>'+esc(c.concepto)+'</span>'+
                '<span style="color:var(--text-3);">'+c.cantidad+'</span>'+
                '<span style="color:var(--text-3);">'+esc(c.unidad||'')+'</span>'+
                '<span style="color:var(--text-3);">'+fmt(parseFloat(c.precio_unitario)||0)+'</span>'+
                '<span style="font-weight:600;text-align:right;">'+fmt(parseFloat(c.monto)||0)+'</span>'+
                '<button onclick="eliminarCosto(\''+c.id+'\',\''+p.id+'\')" title="Eliminar"'+
                  ' style="background:none;border:none;color:var(--text-4);cursor:pointer;font-size:16px;padding:0;line-height:1;">×</button>'+
              '</div>';
            }).join('')+
          '</div>';
        }).join('')+
      '</div>';
    }).join('');
  }

  // Form de captura inline
  var hoy=new Date();
  var dia=hoy.getDay();
  var lunes=new Date(hoy); lunes.setDate(hoy.getDate()-(dia===0?6:dia-1));
  var lunesFmt=lunes.toISOString().split('T')[0];

  return '<div style="padding:16px;border-bottom:.5px solid var(--border);background:var(--bg-card-2);">'+
    // Mini KPIs
    '<div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">'+
      _miniKpi('Ingresos',fmt(ingresos),'var(--text-1)')+
      _miniKpi('Costos',fmt(costos),'#dc2626')+
      _miniKpi('Margen',fmt(margen),mc)+
      _miniKpi('% Margen',(pct!==null?pct+'%':'—'),mc)+
    '</div>'+
    // Historial
    '<div style="margin-bottom:14px;">'+
      '<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Costos registrados</div>'+
      historialHTML+
      asigHTML+
    '</div>'+
    // Form inline — colapsado por defecto
    '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:10px;overflow:hidden;" id="rent-inline-form-'+p.id+'">'+
      '<button onclick="rentToggleForm(\''+p.id+'\')"'+
        ' style="width:100%;display:flex;align-items:center;gap:8px;padding:11px 14px;background:none;border:none;'+
        'cursor:pointer;font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;text-align:left;">'+
        '<span id="rent-form-icon-'+p.id+'" style="font-size:16px;line-height:1;transition:transform .15s;display:inline-block;">+</span>'+
        'Registrar costos'+
      '</button>'+
      '<div id="rent-form-body-'+p.id+'" style="display:none;padding:0 14px 14px;">'+
        '<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">'+
          '<div class="form-group" style="margin:0;flex:0 0 140px;">'+
            '<label style="font-size:10px;">Semana</label>'+
            '<input type="date" id="ri-semana-'+p.id+'" value="'+lunesFmt+'" style="font-size:12px;padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);width:100%;">'+
          '</div>'+
          '<div class="form-group" style="margin:0;flex:1 1 150px;">'+
            '<label style="font-size:10px;">Categoría</label>'+
            '<select id="ri-cat-'+p.id+'" onchange="rentActSubcat(\''+p.id+'\')" style="font-size:12px;padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);width:100%;">'+
              '<option value="mano_obra">Mano de obra</option>'+
              '<option value="materiales">Materiales</option>'+
              '<option value="maquinaria">Maquinaria y equipo</option>'+
              '<option value="herramientas">Herramientas</option>'+
              '<option value="seguridad">Equipo de seguridad</option>'+
              '<option value="servicios">Servicios</option>'+
              '<option value="otro">Otro</option>'+
            '</select>'+
          '</div>'+
          '<div class="form-group" style="margin:0;flex:1 1 160px;position:relative;">'+
            '<label style="font-size:10px;">Subcategoría <span style="font-weight:400;color:var(--text-4);">(opcional)</span></label>'+
            '<input type="text" id="ri-subcat-'+p.id+'" placeholder="Ej: Operador CNC..." autocomplete="off"'+
              ' oninput="rentFiltSubcat(\''+p.id+'\',this.value)" onfocus="rentMostrarSubcat(\''+p.id+'\')"'+
              ' style="font-size:12px;padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);width:100%;">'+
            '<div id="ri-subcat-dd-'+p.id+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:.5px solid var(--border);border-radius:8px;z-index:600;max-height:140px;overflow-y:auto;margin-top:2px;box-shadow:0 4px 16px var(--shadow);"></div>'+
          '</div>'+
        '</div>'+
        // Líneas
        '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;'+
          'display:grid;grid-template-columns:2fr 70px 80px 90px 80px 28px;gap:6px;padding:0 2px;margin-bottom:4px;">'+
          '<span>Concepto</span><span>Cant.</span><span>Unidad</span><span>Precio/u</span><span style="text-align:right;">Total</span><span></span>'+
        '</div>'+
        '<div id="ri-lineas-'+p.id+'"></div>'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);">'+
          '<span style="font-size:13px;font-weight:600;color:var(--text-1);">Total: <span id="ri-total-'+p.id+'" style="color:#16a34a;">$0</span></span>'+
          '<button class="btn-primary" onclick="rentGuardar(\''+p.id+'\')" style="font-size:12px;padding:7px 18px;">Guardar</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
    // Sección: Asignar factura recibida — colapsada por defecto
    '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:10px;overflow:hidden;margin-top:10px;">'+
      '<button onclick="rentToggleAsignar(\''+p.id+'\')"'+
        ' style="width:100%;display:flex;align-items:center;gap:8px;padding:11px 14px;background:none;border:none;'+
        'cursor:pointer;font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;text-align:left;">'+
        '<span id="rent-asig-icon-'+p.id+'" style="font-size:16px;line-height:1;transition:transform .15s;display:inline-block;">+</span>'+
        '🧾 Asignar factura recibida'+
      '</button>'+
      '<div id="rent-asig-body-'+p.id+'" style="display:none;padding:0 14px 14px;">'+
        '<div style="position:relative;">'+
          '<input type="text" id="rent-fact-search-'+p.id+'" placeholder="Buscar por proveedor, folio, UUID o monto..." autocomplete="off"'+
            ' oninput="rentBuscarFactura(\''+p.id+'\',this.value)"'+
            ' style="width:100%;padding:6px 10px;border:.5px solid var(--border);border-radius:7px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;box-sizing:border-box;">'+
          '<div id="rent-fact-dd-'+p.id+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:.5px solid var(--border);border-radius:8px;z-index:650;max-height:180px;overflow-y:auto;margin-top:3px;box-shadow:0 4px 20px var(--shadow);"></div>'+
        '</div>'+
        '<div id="rent-fact-info-'+p.id+'" style="display:none;margin-top:10px;"></div>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function _miniKpi(label, val, color){
  return '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:8px;padding:8px 14px;min-width:100px;">'+
    '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">'+label+'</div>'+
    '<div style="font-size:15px;font-weight:700;color:'+color+';">'+val+'</div>'+
  '</div>';
}

// ── Form inline por proyecto ───────────────────────────────
var _rentLineasByProj = {};

function rentAgregarLinea(projId){
  if(!_rentLineasByProj[projId]) _rentLineasByProj[projId]=[];
  var id=Date.now()+Math.random().toString(36).slice(2,5);
  _rentLineasByProj[projId].push({id:id});
  rentRenderLineas(projId);
}

function rentEliminarLinea(projId, id){
  _rentLineasByProj[projId]=(_rentLineasByProj[projId]||[]).filter(function(l){return l.id!==id;});
  if(!_rentLineasByProj[projId].length) rentAgregarLinea(projId);
  else rentRenderLineas(projId);
}

function rentRenderLineas(projId){
  var el=document.getElementById('ri-lineas-'+projId);
  if(!el) return;
  var lineas=_rentLineasByProj[projId]||[];
  el.innerHTML=lineas.map(function(l){
    return '<div style="display:grid;grid-template-columns:2fr 70px 80px 90px 80px 28px;gap:6px;align-items:center;margin-bottom:4px;">'+
      '<input type="text" placeholder="Concepto" id="ric-'+l.id+'"'+
        ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '<input type="number" placeholder="1" min="0" step="any" value="1" id="riq-'+l.id+'"'+
        ' oninput="rentCalcLinea(\''+projId+'\',\''+l.id+'\')"'+
        ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '<input type="text" placeholder="horas" value="horas" id="riu-'+l.id+'"'+
        ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '<input type="number" placeholder="0.00" min="0" step="any" id="rip-'+l.id+'"'+
        ' oninput="rentCalcLinea(\''+projId+'\',\''+l.id+'\')"'+
        ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '<div id="rit-'+l.id+'" style="font-size:12px;font-weight:600;color:#16a34a;text-align:right;">$0</div>'+
      '<button onclick="rentEliminarLinea(\''+projId+'\',\''+l.id+'\')"'+
        ' style="background:none;border:none;color:var(--text-4);cursor:pointer;font-size:18px;padding:0;line-height:1;">×</button>'+
    '</div>';
  }).join('');
}

function rentCalcLinea(projId, lid){
  var q=parseFloat((document.getElementById('riq-'+lid)||{}).value)||0;
  var p=parseFloat((document.getElementById('rip-'+lid)||{}).value)||0;
  var el=document.getElementById('rit-'+lid); if(el) el.textContent=fmt(q*p);
  rentCalcTotal(projId);
}

function rentCalcTotal(projId){
  var lineas=_rentLineasByProj[projId]||[];
  var total=0;
  lineas.forEach(function(l){
    var q=parseFloat((document.getElementById('riq-'+l.id)||{}).value)||0;
    var p=parseFloat((document.getElementById('rip-'+l.id)||{}).value)||0;
    total+=q*p;
  });
  var el=document.getElementById('ri-total-'+projId); if(el) el.textContent=fmt(total);
}

async function rentGuardar(projId){
  var semana=(document.getElementById('ri-semana-'+projId)||{}).value;
  var cat=(document.getElementById('ri-cat-'+projId)||{}).value||'mano_obra';
  var subcat=((document.getElementById('ri-subcat-'+projId)||{}).value||'').trim()||null;
  if(!semana){ alert('Selecciona la semana.'); return; }

  var lineas=_rentLineasByProj[projId]||[];
  var rows=[];
  lineas.forEach(function(l){
    var concepto=((document.getElementById('ric-'+l.id)||{}).value||'').trim();
    var cantidad=parseFloat((document.getElementById('riq-'+l.id)||{}).value)||0;
    var unidad=((document.getElementById('riu-'+l.id)||{}).value||'').trim()||'pzs';
    var precio=parseFloat((document.getElementById('rip-'+l.id)||{}).value)||0;
    if(concepto&&cantidad&&precio) rows.push({
      id:Date.now().toString()+Math.random().toString(36).slice(2,5),
      proyecto_id:projId, semana, categoria:cat, subcategoria:subcat,
      concepto, cantidad, unidad, precio_unitario:precio
    });
  });

  if(!rows.length){ alert('Completa al menos una línea con concepto, cantidad y precio.'); return; }
  if(subcat) guardarSubcat(cat, subcat);

  try{
    await DB.costos.insert(rows);
    _rentLineasByProj[projId]=[];
    showStatus('✓ '+rows.length+' costo'+(rows.length!==1?'s':'')+' registrado'+(rows.length!==1?'s':''));
    // Recargar costos globales y del proyecto expandido
    _rentProjCostos=await DB.costos.byProyecto(projId);
    _rentAllCostos=await DB.costos.byProyectos((allProyectos||[]).map(function(p){return p.id;}));
    filtrarRentabilidad(document.getElementById('rent-search').value||'');
  }catch(e){ showError('Error: '+e.message); }
}

async function eliminarCosto(id, projId){
  if(!confirm('¿Eliminar este costo?')) return;
  try{
    await DB.costos.delete(id);
    _rentProjCostos=_rentProjCostos.filter(function(c){return c.id!==id;});
    _rentAllCostos=_rentAllCostos.filter(function(c){return c.id!==id;});
    var p=(allProyectos||[]).find(function(x){return x.id===projId;});
    var expandEl=document.getElementById('rent-expand-'+projId);
    if(expandEl&&p) expandEl.innerHTML=_buildExpand(p);
    _rentLineasByProj[projId]=[];   // se re-inicia al abrir el form
    showStatus('Costo eliminado');
    filtrarRentabilidad(document.getElementById('rent-search').value||'');
  }catch(e){ showError('Error: '+e.message); }
}

// ── Autocomplete subcategorías (localStorage) ─────────────
function _subcatKey(cat){ return 'rent_subcat_'+cat; }
function guardarSubcat(cat,val){
  var key=_subcatKey(cat);
  var saved=JSON.parse(localStorage.getItem(key)||'[]');
  if(!saved.includes(val)) saved.unshift(val);
  if(saved.length>20) saved=saved.slice(0,20);
  localStorage.setItem(key,JSON.stringify(saved));
}
function getSubcats(cat){ return JSON.parse(localStorage.getItem(_subcatKey(cat))||'[]'); }

function rentActSubcat(projId){
  document.getElementById('ri-subcat-'+projId).value='';
  document.getElementById('ri-subcat-dd-'+projId).style.display='none';
}
function rentMostrarSubcat(projId){
  var cat=(document.getElementById('ri-cat-'+projId)||{}).value||'mano_obra';
  rentShowSubcatItems(projId, getSubcats(cat));
}
function rentFiltSubcat(projId, q){
  var cat=(document.getElementById('ri-cat-'+projId)||{}).value||'mano_obra';
  rentShowSubcatItems(projId, getSubcats(cat).filter(function(v){ return v.toLowerCase().indexOf(q.toLowerCase())!==-1; }));
}
function rentShowSubcatItems(projId, vals){
  var dd=document.getElementById('ri-subcat-dd-'+projId); if(!dd) return;
  if(!vals.length){ dd.style.display='none'; return; }
  dd.innerHTML=vals.map(function(v){
    return '<div style="padding:7px 12px;font-size:12px;cursor:pointer;color:var(--text-1);"'+
      ' onmouseenter="this.style.background=\'var(--bg-card-2)\'" onmouseleave="this.style.background=\'\'"'+
      ' onclick="rentSelSubcat(\''+projId+'\',\''+esc(v)+'\')">'+esc(v)+'</div>';
  }).join('');
  dd.style.display='block';
}
function rentSelSubcat(projId, v){
  var inp=document.getElementById('ri-subcat-'+projId); if(inp) inp.value=v;
  var dd=document.getElementById('ri-subcat-dd-'+projId); if(dd) dd.style.display='none';
}

document.addEventListener('click',function(e){
  if(!e.target.closest('[id^="ri-subcat-"]')) {
    document.querySelectorAll('[id^="ri-subcat-dd-"]').forEach(function(dd){ dd.style.display='none'; });
  }
  if(!e.target.closest('[id^="rent-fact-"]')) {
    document.querySelectorAll('[id^="rent-fact-dd-"]').forEach(function(dd){ dd.style.display='none'; });
  }
});

// ── Asignación de facturas ─────────────────────────────────
function rentBuscarFactura(projId, q){
  var dd=document.getElementById('rent-fact-dd-'+projId);
  if(!q||q.length<2){ if(dd) dd.style.display='none'; return; }
  clearTimeout(_rentFactTimer[projId]);
  _rentFactTimer[projId]=setTimeout(async function(){
    try{
      var data=await DB.facturas.buscarRecibidas(q, new Date().getFullYear());
      if(!dd) return;
      if(!(data&&data.length)){
        dd.innerHTML='<div style="padding:8px 12px;font-size:12px;color:var(--text-3);">Sin resultados</div>';
        dd.style.display='block'; return;
      }
      if(!_rentFactOpts[projId]) _rentFactOpts[projId]={};
      data.forEach(function(f){ _rentFactOpts[projId][f.id]=f; });
      dd.innerHTML=data.map(function(f){
        return '<div style="padding:8px 12px;cursor:pointer;border-bottom:.5px solid var(--border);"'+
          ' onmouseenter="this.style.background=\'var(--bg-card-2)\'" onmouseleave="this.style.background=\'\'"'+
          ' onclick="rentSelFactura(\''+projId+'\',\''+f.id+'\')">'+
          '<div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc(f.emisor_nombre||'—')+'</div>'+
          '<div style="font-size:11px;color:var(--text-3);">'+(f.numero_factura||'Sin folio')+' · '+fmtDate(f.fecha)+' · <strong>'+fmt(parseFloat(f.total)||0)+'</strong></div>'+
        '</div>';
      }).join('');
      dd.style.display='block';
    }catch(e){ console.error('rentBuscarFactura:',e); }
  },320);
}

async function rentSelFactura(projId, factId){
  var f=(_rentFactOpts[projId]||{})[factId]; if(!f) return;
  _rentFactSelData[projId]=f;
  var dd=document.getElementById('rent-fact-dd-'+projId);
  if(dd) dd.style.display='none';
  var inp=document.getElementById('rent-fact-search-'+projId);
  if(inp) inp.value=esc(f.emisor_nombre||'')+(f.numero_factura?' — '+f.numero_factura:'');
  var infoEl=document.getElementById('rent-fact-info-'+projId); if(!infoEl) return;
  infoEl.innerHTML='<div style="font-size:12px;color:var(--text-3);">Cargando disponibilidad...</div>';
  infoEl.style.display='block';
  // Cargar % ya asignado de esta factura
  var pctUsado = await DB.asignaciones.usadoPorFactura(factId);
  var pctDisp=Math.max(0,100-pctUsado);
  var totalFact=parseFloat(f.total)||0;
  infoEl.innerHTML=
    // Info de la factura
    '<div style="background:var(--bg-card-2);border:.5px solid var(--border);border-radius:7px;padding:8px 12px;margin-bottom:10px;font-size:12px;">'+
      '<span style="font-weight:600;color:var(--text-1);">'+esc(f.emisor_nombre||'—')+'</span>'+
      (f.numero_factura?'<span style="color:var(--text-3);"> · '+esc(f.numero_factura)+'</span>':'')+
      '<span style="float:right;font-weight:700;color:var(--text-1);">'+fmt(totalFact)+'</span>'+
      (f.concepto?'<div style="color:var(--text-3);margin-top:2px;font-size:11px;">'+esc(f.concepto.slice(0,60))+'</div>':'')+
    '</div>'+
    // Barra de disponibilidad
    '<div style="margin-bottom:10px;">'+
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-bottom:4px;">'+
        '<span>Ya asignado: <strong>'+pctUsado.toFixed(1)+'%</strong> ('+fmt(totalFact*pctUsado/100)+')</span>'+
        '<span>Disponible: <strong style="color:'+(pctDisp>0?'#16a34a':'#dc2626')+';">'+pctDisp.toFixed(1)+'%</strong></span>'+
      '</div>'+
      '<div style="height:6px;background:var(--bg-hover);border-radius:4px;overflow:hidden;">'+
        '<div style="width:'+Math.min(100,pctUsado)+'%;height:100%;background:'+(pctUsado>=100?'#dc2626':'#f87171')+';border-radius:4px;"></div>'+
      '</div>'+
    '</div>'+
    // Inputs: % y notas
    '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">'+
      '<div class="form-group" style="margin:0;flex:0 0 100px;">'+
        '<label style="font-size:10px;">% a asignar</label>'+
        '<input type="number" id="rent-fact-pct-'+projId+'" min="0.1" max="'+pctDisp+'" step="0.1" placeholder="40"'+
          ' oninput="rentCalcAsig(\''+projId+'\')"'+
          ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '</div>'+
      '<div style="flex:0 0 90px;padding-bottom:1px;">'+
        '<div style="font-size:10px;color:var(--text-3);margin-bottom:4px;">Monto</div>'+
        '<div id="rent-fact-monto-'+projId+'" style="font-size:16px;font-weight:700;color:#16a34a;">$0</div>'+
      '</div>'+
      '<div class="form-group" style="margin:0;flex:1 1 140px;">'+
        '<label style="font-size:10px;">Notas <span style="font-weight:400;color:var(--text-4);">(opcional)</span></label>'+
        '<input type="text" id="rent-fact-notas-'+projId+'" placeholder="Ej: Acero estructura principal"'+
          ' style="padding:5px 8px;border:.5px solid var(--border);border-radius:6px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;width:100%;">'+
      '</div>'+
      '<button class="btn-primary" onclick="rentGuardarAsig(\''+projId+'\')" style="font-size:12px;padding:7px 18px;flex:0 0 auto;">Asignar</button>'+
    '</div>';
}

function rentCalcAsig(projId){
  var f=_rentFactSelData[projId]; if(!f) return;
  var pct=parseFloat((document.getElementById('rent-fact-pct-'+projId)||{}).value)||0;
  var monto=(parseFloat(f.total)||0)*pct/100;
  var el=document.getElementById('rent-fact-monto-'+projId);
  if(el){ el.textContent=fmt(monto); el.style.color=monto>0?'#16a34a':'var(--text-3)'; }
}

async function rentGuardarAsig(projId){
  var f=_rentFactSelData[projId];
  if(!f){ showError('Selecciona una factura recibida'); return; }
  var pct=parseFloat((document.getElementById('rent-fact-pct-'+projId)||{}).value)||0;
  if(!pct||pct<=0){ showError('Ingresa un porcentaje válido'); return; }
  var totalFact=parseFloat(f.total)||0;
  var monto=totalFact*pct/100;
  var notas=((document.getElementById('rent-fact-notas-'+projId)||{}).value||'').trim()||null;
  // Validar que no exceda 100%
  var pctUsado = await DB.asignaciones.usadoPorFactura(f.id);
  if(pctUsado+pct>100.001){
    showError('Excede el 100%. Disponible: '+(100-pctUsado).toFixed(1)+'%'); return;
  }
  try{
    await DB.asignaciones.insert({
      factura_id:f.id, proyecto_id:projId,
      porcentaje:pct, monto:monto,
      emisor_nombre:f.emisor_nombre||null,
      numero_factura:f.numero_factura||null,
      total_factura:totalFact||null,
      notas:notas
    });
    showStatus('✓ '+fmt(monto)+' asignado ('+pct+'% de factura)');
    delete _rentFactSelData[projId];
    // Actualizar listas en memoria y re-renderizar
    var newRec={id:'tmp',proyecto_id:projId,monto:monto,porcentaje:pct,
      emisor_nombre:f.emisor_nombre,numero_factura:f.numero_factura,total_factura:totalFact};
    _rentProjAsig=[newRec].concat(_rentProjAsig);
    _rentAllAsig=[{id:'tmp',proyecto_id:projId,monto:monto}].concat(_rentAllAsig);
    filtrarRentabilidad(document.getElementById('rent-search').value||'');
  }catch(e){ showError('Error: '+e.message); }
}

async function eliminarAsig(id, projId){
  if(!confirm('¿Eliminar esta asignación?')) return;
  try{
    await DB.asignaciones.delete(id);
    _rentProjAsig=_rentProjAsig.filter(function(a){return a.id!==id;});
    _rentAllAsig=_rentAllAsig.filter(function(a){return a.id!==id;});
    showStatus('Asignación eliminada');
    filtrarRentabilidad(document.getElementById('rent-search').value||'');
  }catch(e){ showError('Error: '+e.message); }
}

// Inicializar líneas al expandir (llamado desde _buildExpand vía DOM ready)
function _initRentExpand(projId){
  if(!_rentLineasByProj[projId]||!_rentLineasByProj[projId].length){
    _rentLineasByProj[projId]=[];
    rentAgregarLinea(projId);
  } else {
    rentRenderLineas(projId);
  }
}

function rentToggleForm(projId){
  var body = document.getElementById('rent-form-body-'+projId);
  var icon = document.getElementById('rent-form-icon-'+projId);
  if(!body) return;
  var opening = body.style.display === 'none';
  body.style.display = opening ? 'block' : 'none';
  if(icon){ icon.textContent = opening ? '−' : '+'; icon.style.transform = opening ? 'rotate(0deg)' : ''; }
  if(opening) _initRentExpand(projId);
}

function rentToggleAsignar(projId){
  var body = document.getElementById('rent-asig-body-'+projId);
  var icon = document.getElementById('rent-asig-icon-'+projId);
  if(!body) return;
  var opening = body.style.display === 'none';
  body.style.display = opening ? 'block' : 'none';
  if(icon) icon.textContent = opening ? '−' : '+';
  if(opening){
    var inp = document.getElementById('rent-fact-search-'+projId);
    if(inp) setTimeout(function(){ inp.focus(); }, 50);
  }
}
