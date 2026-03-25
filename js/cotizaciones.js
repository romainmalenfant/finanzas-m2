// ── Cotizaciones ──────────────────────────────────────────
var cotizaciones = [], allCotizaciones = [];
// [F7] Sort state
var cotSort = { col: 'fecha', dir: 'desc' };

function sortCotizaciones(col){
  if(cotSort.col === col){ cotSort.dir = cotSort.dir==='asc'?'desc':'asc'; }
  else { cotSort.col = col; cotSort.dir = col==='total'?'desc':'asc'; }
  updateCotSortUI();
  filtrarCotizaciones();
}

function updateCotSortUI(){
  ['numero','cliente_nombre','total','estatus','fecha'].forEach(function(c){
    var btn = document.getElementById('cot-sort-'+c);
    if(!btn) return;
    if(c === cotSort.col){
      btn.style.background = 'var(--bg-card-2)';
      btn.style.color = 'var(--text-1)';
      btn.style.borderColor = 'var(--text-3)';
      btn.querySelector('span.sort-arrow').textContent = cotSort.dir==='asc' ? ' ↑' : ' ↓';
    } else {
      btn.style.background = '';
      btn.style.color = 'var(--text-3)';
      btn.style.borderColor = 'var(--border)';
      btn.querySelector('span.sort-arrow').textContent = '';
    }
  });
}

function applyCotSort(arr){
  var col = cotSort.col, dir = cotSort.dir;
  return arr.slice().sort(function(a, b){
    var va, vb;
    if(col==='total'){ va=parseFloat(a.total)||0; vb=parseFloat(b.total)||0; return dir==='asc'?va-vb:vb-va; }
    if(col==='fecha'){ va=new Date(a.fecha||a.created_at||0).getTime(); vb=new Date(b.fecha||b.created_at||0).getTime(); return dir==='asc'?va-vb:vb-va; }
    va=(a[col]||'').toLowerCase(); vb=(b[col]||'').toLowerCase();
    var r=va.localeCompare(vb,'es');
    return dir==='asc'?r:-r;
  });
}
var cotView = 'lista'; // 'lista' | 'kanban'
var cotYearFilter = new Date().getFullYear();
var cotHistorialOpen = false;
var cotItemsTemp = []; // items in current form
var cotEditId = null;
var cotVersionFlag = false; // true = crear nueva versión al guardar

var COT_CONDICIONES = [
  { id: 1, texto: 'Precios expresados en MXN, más IVA' },
  { id: 2, texto: 'Vigencia según los días indicados en el documento' },
  { id: 3, texto: 'Forma de pago: 50% de anticipo, 50% contra entrega' },
  { id: 4, texto: 'Tiempo de entrega sujeto a confirmación de agenda de producción' },
  { id: 5, texto: 'Los precios no incluyen flete ni maniobras de entrega' },
  { id: 6, texto: 'Se requiere plano técnico o muestra física para iniciar producción' },
  { id: 7, texto: 'Cambios en especificaciones o material pueden afectar precio y tiempo de entrega' },
];
var COT_CONDICIONES_DEFAULT = [1, 2, 3];

// ── Load & Render ─────────────────────────────────────────
async function loadCotizaciones(){
  try{
    cotizaciones = await DB.cotizaciones.list();
    allCotizaciones = cotizaciones;
    // Init year filter
    var yearSel = document.getElementById('cot-year-filter');
    if(yearSel && yearSel.options.length===0){
      var años = [...new Set(cotizaciones.map(function(c){return new Date(c.fecha||c.created_at).getFullYear();}))];
      var currentYear = new Date().getFullYear();
      if(!años.includes(currentYear)) años.push(currentYear);
      años.sort(function(a,b){return b-a;});
      años.forEach(function(y){
        var o=document.createElement('option');
        o.value=y; o.textContent=y;
        if(y===cotYearFilter)o.selected=true;
        yearSel.appendChild(o);
      });
    }
    renderCotizacionesKPIs();
    filtrarCotizaciones('');
  }catch(e){console.error('Cotizaciones:',e); showError('Error cargando cotizaciones');}
}

function renderCotizacionesKPIs(){
  var total = cotizaciones.length;
  var abiertas = cotizaciones.filter(function(c){return c.estatus==='borrador'||c.estatus==='enviada';}).length;
  var cerradas = cotizaciones.filter(function(c){return c.estatus==='cerrada';}).length;
  var perdidas = cotizaciones.filter(function(c){return c.estatus==='perdida';}).length;
  var pipeline = cotizaciones.filter(function(c){return c.estatus==='borrador'||c.estatus==='enviada';})
    .reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
  // FEAT-01: totales monetarios de cerradas y perdidas
  var totalCerradas = cotizaciones.filter(function(c){return c.estatus==='cerrada';})
    .reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
  var totalPerdidas = cotizaciones.filter(function(c){return c.estatus==='perdida';})
    .reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
  // FEAT-02: Win Rate — cerradas / (cerradas + perdidas)
  var disputadas = cerradas + perdidas;
  var winRate = disputadas > 0 ? Math.round((cerradas / disputadas) * 100) : null;

  var el = function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('cot-k-total', total);
  el('cot-k-abiertas', abiertas);
  el('cot-k-cerradas', cerradas);
  el('cot-k-perdidas', perdidas);
  el('cot-k-pipeline', fmt(pipeline));
  // FEAT-01: montos — inyección defensiva
  el('cot-k-cerradas-monto', fmt(totalCerradas));
  el('cot-k-perdidas-monto', fmt(totalPerdidas));
  // FEAT-02: win rate
  var elWR = document.getElementById('cot-k-winrate');
  if(elWR) elWR.textContent = winRate !== null ? winRate+'%' : '—';

  // FEAT-D1: Días promedio de cierre
  var cotCerradas = cotizaciones.filter(function(c){return c.estatus==='cerrada'&&c.fecha_cierre&&(c.created_at||c.fecha);});
  var diasProm = cotCerradas.length ? Math.round(cotCerradas.reduce(function(a,c){
    return a+Math.max(0,(new Date(c.fecha_cierre)-new Date(c.created_at||c.fecha))/864e5);
  },0)/cotCerradas.length) : null;
  el('cot-k-dias', diasProm!==null ? diasProm+'d' : '—');

  // FEAT-D2: Ticket promedio cerradas
  var ticketProm = cerradas>0 ? totalCerradas/cerradas : null;
  el('cot-k-ticket', ticketProm!==null ? fmt(ticketProm) : '—');

  // FEAT-D3: En riesgo (abiertas > 30 días)
  var hoy=new Date();
  var enRiesgo=cotizaciones.filter(function(c){
    if(c.estatus!=='borrador'&&c.estatus!=='enviada'&&c.estatus!=='en_negociacion') return false;
    return (hoy-new Date(c.created_at||c.fecha||''))/864e5>30;
  }).length;
  var elRiesgo=document.getElementById('cot-k-riesgo');
  if(elRiesgo){ elRiesgo.textContent=enRiesgo||'0'; elRiesgo.style.color=enRiesgo>0?'#f87171':'#16a34a'; }

  // FEAT-D4: Mejor cliente (monto cerrado)
  var byClienteMonto={};
  cotizaciones.filter(function(c){return c.estatus==='cerrada';}).forEach(function(c){
    var k=(c.cliente_nombre||'Sin cliente').trim();
    byClienteMonto[k]=(byClienteMonto[k]||0)+(parseFloat(c.total)||0);
  });
  var mejorCliente=Object.entries(byClienteMonto).sort(function(a,b){return b[1]-a[1];})[0]||null;
  var elMejor=document.getElementById('cot-k-mejor');
  var elMejorSub=document.getElementById('cot-k-mejor-monto');
  if(elMejor) elMejor.textContent=mejorCliente?mejorCliente[0].split(' ')[0]:'—';
  if(elMejorSub) elMejorSub.textContent=mejorCliente?fmt(mejorCliente[1]):'';

  // Paneles de insights
  renderInsightsCotizaciones();
}

function renderInsightsCotizaciones(){
  // ── Top conversión por cliente ─────────────────────────
  var byCliente={};
  cotizaciones.forEach(function(c){
    var k=(c.cliente_nombre||'Sin cliente').trim();
    if(!byCliente[k]) byCliente[k]={total:0,cerradas:0};
    byCliente[k].total++;
    if(c.estatus==='cerrada') byCliente[k].cerradas++;
  });
  var topConv=Object.entries(byCliente)
    .filter(function(e){return e[1].total>=2;})
    .map(function(e){return {nombre:e[0],cerradas:e[1].cerradas,total:e[1].total,pct:Math.round(e[1].cerradas/e[1].total*100)};})
    .sort(function(a,b){return b.pct-a.pct||b.cerradas-a.cerradas;}).slice(0,5);
  var elConv=document.getElementById('cot-insight-conv');
  if(elConv){
    elConv.innerHTML=topConv.length?topConv.map(function(r){
      var bar=Math.round(r.pct);
      var color=bar>=60?'#16a34a':bar>=30?'#d97706':'#f87171';
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid var(--border);">'+
        '<div style="flex:1;font-size:12px;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(r.nombre)+'</div>'+
        '<div style="font-size:11px;color:var(--text-3);white-space:nowrap;">'+r.cerradas+'/'+r.total+'</div>'+
        '<div style="width:50px;text-align:right;font-size:12px;font-weight:700;color:'+color+';">'+r.pct+'%</div>'+
      '</div>';
    }).join(''):'<div style="font-size:12px;color:var(--text-3);padding:8px 0;">Sin datos suficientes</div>';
  }

  // ── Cotizan pero nunca cierran ─────────────────────────
  var sinCerrar=Object.entries(byCliente)
    .filter(function(e){return e[1].cerradas===0&&e[1].total>=2;})
    .map(function(e){return {nombre:e[0],total:e[1].total};})
    .sort(function(a,b){return b.total-a.total;}).slice(0,5);
  var elSin=document.getElementById('cot-insight-sin');
  if(elSin){
    elSin.innerHTML=sinCerrar.length?sinCerrar.map(function(r){
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:.5px solid var(--border);">'+
        '<div style="flex:1;font-size:12px;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(r.nombre)+'</div>'+
        '<div style="font-size:11px;color:#f87171;font-weight:600;">'+r.total+' cot · 0 ✓</div>'+
      '</div>';
    }).join(''):'<div style="font-size:12px;color:var(--text-3);padding:8px 0;">✓ Todos han cerrado al menos una</div>';
  }
}

function filtrarCotizaciones(q){
  var ql = (q||'').toLowerCase();
  var filtroEstatus = document.getElementById('cot-estatus-filter');
  var estatus = filtroEstatus ? filtroEstatus.value : '';
  var hoy = new Date();
  var hace90 = new Date(hoy); hace90.setDate(hace90.getDate()-90);

  var filtered = allCotizaciones.filter(function(c){
    // Year filter
    var d = new Date(c.fecha||c.created_at);
    if(d.getFullYear() !== cotYearFilter) return false;
    if(estatus && c.estatus !== estatus) return false;
    if(!ql) return true;
    return (c.numero||'').toLowerCase().includes(ql) ||
           (c.cliente_nombre||'').toLowerCase().includes(ql);
  });

  // Split: activas = borrador/enviada/en_negociacion OR cerradas/perdidas <90 días
  var activas = filtered.filter(function(c){
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion') return true;
    var d = new Date(c.fecha||c.created_at);
    return d >= hace90;
  });
  var historial = filtered.filter(function(c){
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion') return false;
    var d = new Date(c.fecha||c.created_at);
    return d < hace90;
  });

  // [F7] aplicar sort en memoria
  renderCotizacionesList(applyCotSort(activas), applyCotSort(historial));
}

var EST_LABELS = {borrador:'Borrador', enviada:'Enviada', en_negociacion:'En negociación', cerrada:'Cerrada ✓', perdida:'Perdida'};
var EST_COLORS = {borrador:'#64748b', enviada:'#60a5fa', en_negociacion:'#a78bfa', cerrada:'#34d399', perdida:'#f87171'};

// -- T6: Pure render functions --

function renderCotizacionCard(c, variant){
  // variant: 'active' | 'historial'
  var color = EST_COLORS[c.estatus]||'#475569';
  var label = EST_LABELS[c.estatus]||c.estatus;

  var card = document.createElement('div');
  card.className = 'proj-card';
  card.style.cursor = 'pointer';
  if(variant==='historial') card.style.opacity = '0.7';
  card.addEventListener('click', function(){ verDetalleCotizacion(c.id); });

  var hdr = document.createElement('div');
  hdr.className = 'proj-hdr';
  hdr.style.cursor = 'pointer';

  var titleDiv = document.createElement('div');
  titleDiv.className = 'proj-title';
  var nombre = document.createElement('div');
  nombre.className = 'proj-nombre';
  nombre.textContent = c.numero||'COT';
  var cliente = document.createElement('div');
  cliente.className = 'proj-cliente';
  if(variant==='active'){
    cliente.textContent = (c.cliente_nombre||'Sin cliente') + ' · Vigencia: '+(c.vigencia_dias||15)+' días';
  } else {
    cliente.textContent = c.cliente_nombre||'';
  }
  titleDiv.appendChild(nombre);
  titleDiv.appendChild(cliente);

  var right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:12px;';

  var totalEl = document.createElement('div');
  totalEl.style.cssText = variant==='active'
    ? 'font-size:16px;font-weight:700;color:var(--text-1);'
    : 'font-size:15px;font-weight:600;color:var(--text-2);';
  totalEl.textContent = fmt(c.total||0);

  var badge = document.createElement('span');
  badge.style.cssText = 'padding:'+(variant==='active'?'3px 10px':'2px 8px')+';border-radius:5px;font-size:11px;font-weight:600;background:'+color+'22;color:'+color+';';
  badge.textContent = label;

  right.appendChild(totalEl);
  right.appendChild(badge);

  if(variant==='active'){
    var editBtn = document.createElement('button');
    editBtn.className = 'btn-sm';
    editBtn.style.flexShrink = '0';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', function(e){ e.stopPropagation(); editarCotizacion(c.id); });
    right.appendChild(editBtn);
  }

  hdr.appendChild(titleDiv);
  hdr.appendChild(right);
  card.appendChild(hdr);

  if(variant==='active'){
    var meta = document.createElement('div');
    meta.style.cssText = 'padding:8px 1.25rem;display:flex;gap:16px;font-size:11px;color:var(--text-3);';
    var fechaSpan = document.createElement('span');
    fechaSpan.textContent = 'Fecha: '+fmtDate(c.fecha);
    meta.appendChild(fechaSpan);
    if(c.notas){
      var notasSpan = document.createElement('span');
      notasSpan.textContent = c.notas.slice(0,60);
      meta.appendChild(notasSpan);
    }
    card.appendChild(meta);
  }
  return card;
}

function renderKanbanCard(c, col, hoy){
  var color = EST_COLORS[col.key]||'#475569';
  var dias = Math.floor((hoy - new Date(c.created_at||c.fecha)) / 864e5);
  var colIdx = KANBAN_COLS.findIndex(function(k){return k.key===col.key;});
  var prevCol = colIdx > 0 ? KANBAN_COLS[colIdx-1] : null;
  var nextCol = colIdx < KANBAN_COLS.length-1 ? KANBAN_COLS[colIdx+1] : null;

  var card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.addEventListener('click', function(){ verDetalleCotizacion(c.id); });
  card.addEventListener('dragstart', function(e){ kanbanDragStart(e, c.id); });

  // Header row
  var hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;';
  var numSpan = document.createElement('span');
  numSpan.style.cssText = 'font-size:11px;font-weight:600;color:'+color+';';
  numSpan.textContent = c.numero||'COT';
  var diasSpan = document.createElement('span');
  diasSpan.style.cssText = 'font-size:10px;color:var(--text-3);';
  diasSpan.textContent = dias+'d';
  hdrRow.appendChild(numSpan);
  hdrRow.appendChild(diasSpan);

  // Cliente
  var cliDiv = document.createElement('div');
  cliDiv.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  cliDiv.textContent = c.cliente_nombre||'Sin cliente';

  // Total
  var totalDiv = document.createElement('div');
  totalDiv.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-1);';
  totalDiv.textContent = fmt(c.total||0);

  card.appendChild(hdrRow);
  card.appendChild(cliDiv);
  card.appendChild(totalDiv);

  // Notas
  if(c.notas){
    var notasDiv = document.createElement('div');
    notasDiv.style.cssText = 'font-size:10px;color:var(--text-3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    notasDiv.textContent = c.notas;
    card.appendChild(notasDiv);
  }

  // Move buttons (touch support)
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:space-between;gap:4px;margin-top:8px;';
  btnRow.addEventListener('click', function(e){ e.stopPropagation(); });

  function makeNavBtn(targetCol, label, align){
    var btn = document.createElement('button');
    btn.className = 'btn-sm';
    btn.style.cssText = 'font-size:10px;padding:2px 6px;flex:1;'+(align==='right'?'text-align:right;':'');
    btn.title = 'Mover a '+targetCol.label;
    btn.textContent = align==='right' ? targetCol.label+' →' : '← '+targetCol.label;
    btn.addEventListener('click', function(e){ kanbanMoveCard(e, c.id, col.key, targetCol.key); });
    return btn;
  }
  if(prevCol) btnRow.appendChild(makeNavBtn(prevCol, prevCol.label, 'left'));
  else { var sp=document.createElement('span'); sp.style.flex='1'; btnRow.appendChild(sp); }
  if(nextCol) btnRow.appendChild(makeNavBtn(nextCol, nextCol.label, 'right'));
  else { var sp2=document.createElement('span'); sp2.style.flex='1'; btnRow.appendChild(sp2); }
  card.appendChild(btnRow);

  return card;
}

function renderCotItemRow(item){
  var tid = item._tempId||item.id;
  var isMaq = item.tipo==='maquinado';
  var isSvc = item.tipo==='servicio';

  var wrap = document.createElement('div');
  wrap.id = 'cot-item-'+tid;
  wrap.style.cssText = 'background:var(--bg-card-2);border-radius:8px;padding:12px;margin-bottom:8px;border:0.5px solid var(--border);';

  // Header: type label + delete button
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  var typeLabel = document.createElement('span');
  typeLabel.style.cssText = 'font-size:10px;font-weight:600;color:var(--brand-red);text-transform:uppercase;';
  typeLabel.textContent = isMaq?'🔩 Maquinado':isSvc?'⚙️ Servicio':'📦 Producto';
  var delBtn = document.createElement('button');
  delBtn.style.cssText = 'background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', function(){ eliminarCotItem(tid); });
  hdr.appendChild(typeLabel);
  hdr.appendChild(delBtn);
  wrap.appendChild(hdr);

  // Helper to create a form-group with label + input
  function makeField(labelText, inputEl, flex){
    var fg = document.createElement('div');
    fg.className = 'form-group';
    if(flex) fg.style.flex = flex;
    var lbl = document.createElement('label');
    lbl.textContent = labelText;
    fg.appendChild(lbl);
    fg.appendChild(inputEl);
    return fg;
  }

  function textInput(val, placeholder, field){
    var inp = document.createElement('input');
    inp.type = 'text'; inp.value = val; inp.placeholder = placeholder;
    inp.addEventListener('input', function(){ updateCotItem(tid, field, this.value); });
    return inp;
  }
  function numInput(val, field, step){
    var inp = document.createElement('input');
    inp.type = 'number'; inp.value = val; inp.min = '0';
    inp.step = step||'0.01'; inp.setAttribute('inputmode','decimal');
    inp.addEventListener('input', function(){ updateCotItem(tid, field, parseFloat(this.value)||0); });
    return inp;
  }

  // Row 1: descripcion + material (if maquinado)
  var row1 = document.createElement('div');
  row1.className = 'form-row';
  var descPlaceholder = isMaq?'Nombre de pieza':isSvc?'Tipo de servicio':'Descripción';
  row1.appendChild(makeField('Descripción *', textInput(item.descripcion||'', descPlaceholder, 'descripcion'), '2'));
  if(isMaq) row1.appendChild(makeField('Material', textInput(item.material||'', 'Acero, aluminio...', 'material')));
  wrap.appendChild(row1);

  // Row 2: cantidad, unidad, precio, subtotal
  var row2 = document.createElement('div');
  row2.className = 'form-row';
  row2.appendChild(makeField(isSvc?'Horas':'Cantidad', numInput(item.cantidad||1, 'cantidad')));
  row2.appendChild(makeField('Unidad', textInput(item.unidad||'pzas', '', 'unidad')));
  row2.appendChild(makeField('Precio unitario ($)', numInput(item.precio_unitario||0, 'precio_unitario')));
  var subDisplay = document.createElement('div');
  subDisplay.id = 'sub-'+tid;
  subDisplay.style.cssText = 'padding:8px 10px;background:var(--bg-card);border-radius:8px;font-size:14px;font-weight:600;color:#34d399;';
  subDisplay.textContent = fmt((item.cantidad||0)*(item.precio_unitario||0));
  row2.appendChild(makeField('Subtotal', subDisplay));
  wrap.appendChild(row2);

  // Row 3: notas
  var row3 = document.createElement('div');
  row3.className = 'form-group';
  var notasLbl = document.createElement('label');
  notasLbl.textContent = 'Notas del item';
  row3.appendChild(notasLbl);
  row3.appendChild(textInput(item.notas||'', 'Especificaciones adicionales...', 'notas'));
  wrap.appendChild(row3);

  return wrap;
}

function renderCotizacionesList(list, historial){
  var wrap = document.getElementById('cot-lista-wrap');
  if(!wrap) return;
  var el = document.getElementById('cotizaciones-list');
  if(!el){
    wrap.innerHTML = '<div id="cotizaciones-list"></div>';
    el = wrap.querySelector('#cotizaciones-list');
  }
  var ct = document.getElementById('cot-count');
  var total = list.length + (historial?historial.length:0);
  if(ct) ct.textContent = total + ' cotizaci' + (total===1?'ón':'ones');
  el.innerHTML = '';
  if(!list.length && !(historial&&historial.length)){
    var empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Sin cotizaciones para '+cotYearFilter+'.';
    el.appendChild(empty);
    renderHistorialCotizaciones(wrap, []);
    return;
  }
  var frag = document.createDocumentFragment();
  list.forEach(function(c){ frag.appendChild(renderCotizacionCard(c, 'active')); });
  el.appendChild(frag);
  renderHistorialCotizaciones(wrap, historial||[]);
}


// ── Cliente select ────────────────────────────────────────
function poblarClientesCot(clienteIdActual){
  var inp = document.getElementById('cot-cliente-search');
  var hid = document.getElementById('cot-cliente-id');
  if(!inp) return;
  var c = clientes.find(function(x){return x.id===clienteIdActual;});
  inp.value = c?c.nombre:'';
  if(hid) hid.value = clienteIdActual||'';
  makeAutocomplete('cot-cliente-search','cot-cliente-id','cot-cliente-dd',
    function(){return clientes.map(function(c){return {id:c.id,label:c.nombre,sub:c.rfc||''};});},
    function(){ precargarContactosCot(); setTimeout(precargarProyectosCot, 30); }
  );
  if(!(typeof allProyectos !== 'undefined' && allProyectos && allProyectos.length)) loadProyectos();
  makeAutocomplete('cot-proj-search','cot-proj-id','cot-proj-dd',
    function(){return (allProyectos||[]).map(function(p){return {id:p.id,label:p.nombre||p.titulo||'',sub:p.cliente_nombre||''};});},
    null
  );
}

// ── Form ──────────────────────────────────────────────────
function renderHistorialCotizaciones(wrap, list){
  var existing = document.getElementById('cot-historial-section');
  if(existing) existing.remove();
  if(!wrap || !list.length) return;

  var section = document.createElement('div');
  section.id = 'cot-historial-section';
  section.style.marginTop = '20px';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;cursor:pointer;user-select:none;';

  var hdrLabel = document.createElement('span');
  hdrLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-3);';
  hdrLabel.textContent = '📦 Historial archivado (>90 días) — '+list.length+' cotizaci'+(list.length===1?'ón':'ones');
  var arrow = document.createElement('span');
  arrow.id = 'hst-arrow';
  arrow.style.cssText = 'font-size:10px;color:var(--text-3);';
  arrow.textContent = cotHistorialOpen ? '▲' : '▼';
  hdr.appendChild(hdrLabel);
  hdr.appendChild(arrow);

  var body = document.createElement('div');
  body.id = 'cot-historial-body';
  body.style.display = cotHistorialOpen ? 'block' : 'none';
  body.style.marginTop = '8px';

  var frag = document.createDocumentFragment();
  list.forEach(function(c){ frag.appendChild(renderCotizacionCard(c, 'historial')); });
  body.appendChild(frag);

  hdr.addEventListener('click', function(){
    cotHistorialOpen = !cotHistorialOpen;
    body.style.display = cotHistorialOpen ? 'block' : 'none';
    var ar = document.getElementById('hst-arrow');
    if(ar) ar.textContent = cotHistorialOpen ? '▲' : '▼';
  });

  section.appendChild(hdr);
  section.appendChild(body);
  wrap.appendChild(section);
}

function renderCondicionesCot(selectedIds) {
  var list = document.getElementById('cot-condiciones-list');
  if (!list) return;
  var sel = selectedIds || COT_CONDICIONES_DEFAULT;
  list.innerHTML = COT_CONDICIONES.map(function (c) {
    var checked = sel.indexOf(c.id) !== -1;
    return '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:5px 8px;border-radius:6px;background:var(--bg-card-2);border:0.5px solid var(--border);">' +
      '<input type="checkbox" data-cond-id="' + c.id + '" ' + (checked ? 'checked' : '') + ' style="margin-top:2px;accent-color:#E8192C;flex-shrink:0;">' +
      '<span style="font-size:11px;color:var(--text-2);line-height:1.4;">' + c.texto + '</span>' +
      '</label>';
  }).join('');
}

function getCondicionesSeleccionadas() {
  var checks = document.querySelectorAll('#cot-condiciones-list input[type=checkbox]');
  var selected = [];
  checks.forEach(function (ch) {
    if (ch.checked) selected.push(parseInt(ch.getAttribute('data-cond-id')));
  });
  return selected;
}

function abrirNuevaCotizacion(){
  try{ _abrirNuevaCotizacion(); }catch(e){ console.error('abrirNuevaCotizacion:',e); showError('Error: '+e.message); }
}
function _abrirNuevaCotizacion(){
  cotEditId = null;
  cotItemsTemp = [];
  document.getElementById('cot-id-edit').value = '';
  document.getElementById('cot-modal-title').textContent = 'Nueva cotización';
  poblarClientesCot(null);
  var _ct=document.getElementById('cot-titulo'); if(_ct) _ct.value='';
  document.getElementById('cot-cliente-id').value = '';
  document.getElementById('cot-cliente-search').value = '';
  document.getElementById('cot-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cot-vigencia').value = '15';
  document.getElementById('cot-notas').value = '';
  var _cr=document.getElementById('cot-requisicion'); if(_cr) _cr.value='';
  // Limpiar contacto completamente al abrir nueva cotización
  var _ci = document.getElementById('cot-contacto-id');
  var _cs = document.getElementById('cot-contacto-search');
  var _cd = document.getElementById('cot-contacto-dd');
  if(_ci) _ci.value = '';
  if(_cs) _cs.value = '';
  if(_cd) { _cd.innerHTML = ''; _cd.style.display = 'none'; }
  renderCotItemsForm();
  recalcCotTotal();
  renderCondicionesCot(COT_CONDICIONES_DEFAULT);
  var btnNV = document.getElementById('btn-nueva-version-cot');
  if (btnNV) btnNV.style.display = 'none';
  cotVersionFlag = false;
  // BUG-04: z-index explícito para superar el detail panel (z-index:500)
  var _cotM = document.getElementById('cot-modal');
  _cotM.style.zIndex = '700';
  _cotM.style.display = 'flex';
  if(!clientes.length) loadClientes();
}

async function editarCotizacion(id){
  var c;
  try{
    c = cotizaciones.find(function(x){return x.id===id;});
    if(!c) c = await DB.cotizaciones.get(id);
  }catch(e){ showError('Error cargando cotización: '+e.message); return; }
  if(!c){ showError('Cotización no encontrada'); return; }
  cotEditId = id;
  document.getElementById('cot-id-edit').value = id;
  document.getElementById('cot-modal-title').textContent = 'Editar cotización';
  if(!clientes.length) loadClientes().then(function(){poblarClientesCot(c.cliente_id||null);});
  else poblarClientesCot(c.cliente_id||null);
  var _ct2=document.getElementById('cot-titulo'); if(_ct2) _ct2.value=c.titulo||'';
  document.getElementById('cot-cliente-id').value = c.cliente_id||'';
  document.getElementById('cot-cliente-search').value = c.cliente_nombre||'';
  // Pre-fill proyecto if set
  var projId = c.proyecto_id||'';
  var projInp2 = document.getElementById('cot-proj-search');
  var projHid2 = document.getElementById('cot-proj-id');
  if(projId && projHid2){
    projHid2.value = projId;
    var proy = (allProyectos||[]).find(function(x){return x.id===projId;});
    if(proy && projInp2) projInp2.value = proy.nombre||proy.titulo||'';
  } else {
    if(projHid2) projHid2.value = '';
    if(projInp2) projInp2.value = '';
    if(c.cliente_id) setTimeout(precargarProyectosCot, 80);
  }
  // Pre-fill contact if set
  var contId = c.contacto_id||'';
  if(contId && document.getElementById('cot-contacto-id')){
    document.getElementById('cot-contacto-id').value = contId;
    var cont = (contactos||[]).find(function(x){return x.id===contId;});
    if(cont && document.getElementById('cot-contacto-search')){
      var cNombre = (cont.nombre||'')+(cont.apellido?' '+cont.apellido:'');
      document.getElementById('cot-contacto-search').value = cNombre;
    }
    setTimeout(function(){ actualizarBtnClear('cot-contacto-id','cot-contacto-clear'); }, 50);
  } else {
    if(document.getElementById('cot-contacto-id')) document.getElementById('cot-contacto-id').value='';
    if(document.getElementById('cot-contacto-search')) document.getElementById('cot-contacto-search').value='';
    // Pre-populate with client's contacts
    if(c.cliente_id) setTimeout(precargarContactosCot, 50);
  }
  document.getElementById('cot-fecha').value = c.fecha||'';
  document.getElementById('cot-vigencia').value = c.vigencia_dias||15;
  document.getElementById('cot-notas').value = c.notas||'';
  var _cr2=document.getElementById('cot-requisicion'); if(_cr2) _cr2.value=c.numero_requisicion||'';
  // Pre-fill usuario_cliente
  var usuId = c.usuario_cliente_id||'';
  if(usuId && document.getElementById('cot-usuario-id')){
    document.getElementById('cot-usuario-id').value = usuId;
    var usu = (contactos||[]).find(function(x){return x.id===usuId;});
    if(usu && document.getElementById('cot-usuario-search'))
      document.getElementById('cot-usuario-search').value = (usu.nombre||'')+(usu.apellido?' '+usu.apellido:'');
    setTimeout(function(){ actualizarBtnClear('cot-usuario-id','cot-usuario-clear'); }, 50);
  } else {
    if(document.getElementById('cot-usuario-id')) document.getElementById('cot-usuario-id').value='';
    if(document.getElementById('cot-usuario-search')) document.getElementById('cot-usuario-search').value='';
  }
  // Load items
  DB.cotizacionItems.byCotizacion(id).then(function(items){
    cotItemsTemp = items||[];
    renderCotItemsForm();
    recalcCotTotal();
  });
  var vNum = c.version || 1;
  var btnNV = document.getElementById('btn-nueva-version-cot');
  if (btnNV) {
    btnNV.style.display = 'block';
    btnNV.textContent = '+ Nueva v' + (vNum + 1);
  }
  cotVersionFlag = false;
  var condSel = (c.condiciones && Array.isArray(c.condiciones)) ? c.condiciones : COT_CONDICIONES_DEFAULT;
  renderCondicionesCot(condSel);
  // BUG-04: z-index explícito para superar el detail panel (z-index:500)
  var _cotM2 = document.getElementById('cot-modal');
  _cotM2.style.zIndex = '700';
  _cotM2.style.display = 'flex';
}

function cerrarCotModal(){
  // Reset contacto
  var inp = document.getElementById('cot-contacto-search');
  var hid = document.getElementById('cot-contacto-id');
  var dd  = document.getElementById('cot-contacto-dd');
  if(inp) inp.value = '';
  if(hid) hid.value = '';
  if(dd)  { dd.innerHTML=''; dd.style.display='none'; }
  // Reset proyecto
  var pi = document.getElementById('cot-proj-search');
  var ph = document.getElementById('cot-proj-id');
  var pd = document.getElementById('cot-proj-dd');
  if(pi) pi.value = '';
  if(ph) ph.value = '';
  if(pd) { pd.innerHTML=''; pd.style.display='none'; }

  cotVersionFlag = false;
  var btnNVClose = document.getElementById('btn-nueva-version-cot');
  if (btnNVClose) btnNVClose.style.display = 'none';
  document.getElementById('cot-modal').style.display = 'none';
}

// ── Items ─────────────────────────────────────────────────
function agregarCotItem(tipo){
  cotItemsTemp.push({
    _tempId: Date.now(),
    tipo: tipo||'producto',
    descripcion: '',
    material: '',
    cantidad: 1,
    unidad: tipo==='servicio'?'hrs':'pzas',
    precio_unitario: 0,
    subtotal: 0,
    notas: ''
  });
  renderCotItemsForm();
}

function eliminarCotItem(tempId){
  cotItemsTemp = cotItemsTemp.filter(function(i){return String(i._tempId||i.id)!==String(tempId);});
  renderCotItemsForm();
  recalcCotTotal();
}

function renderCotItemsForm(){
  var el = document.getElementById('cot-items-list');
  el.innerHTML = '';
  if(!cotItemsTemp.length){
    var msg = document.createElement('div');
    msg.style.cssText = 'color:var(--text-3);font-size:12px;padding:12px 0;text-align:center;';
    msg.textContent = 'Sin items. Agrega uno abajo.';
    el.appendChild(msg);
    return;
  }
  var frag = document.createDocumentFragment();
  cotItemsTemp.forEach(function(item){ frag.appendChild(renderCotItemRow(item)); });
  el.appendChild(frag);
}

function updateCotItem(tempId, field, value){
  var item = cotItemsTemp.find(function(i){return String(i._tempId||i.id)===String(tempId);});
  if(!item) return;
  item[field] = value;
  item.subtotal = (parseFloat(item.cantidad)||0)*(parseFloat(item.precio_unitario)||0);
  // Update subtotal display directly
  var subEl = document.getElementById('sub-'+tempId);
  if(subEl) subEl.textContent = fmt(item.subtotal);
  recalcCotTotal();
}

function recalcCotTotal(){
  var subtotal = cotItemsTemp.reduce(function(a,i){return a+(parseFloat(i.subtotal)||0);},0);
  var iva = subtotal * 0.16;
  var total = subtotal + iva;
  var el = function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('cot-subtotal', fmt(subtotal));
  el('cot-iva', fmt(iva));
  el('cot-total', fmt(total));
}

// ── Cliente autocomplete in cot form ─────────────────────
function buscarClienteCot(q){
  var dd = document.getElementById('cot-cliente-dropdown');
  if(!q.trim()){dd.style.display='none';return;}
  var ql = q.toLowerCase();
  var matches = clientes.filter(function(c){
    return (c.nombre||'').toLowerCase().includes(ql)||(c.rfc||'').toLowerCase().includes(ql);
  }).slice(0,6);
  if(!matches.length){dd.style.display='none';return;}
  dd.style.display = 'block';
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  matches.forEach(function(c){
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border);color:var(--text-1);';
    var nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = '500';
    nameSpan.textContent = c.nombre;
    item.appendChild(nameSpan);
    if(c.rfc){
      var rfcSpan = document.createElement('span');
      rfcSpan.style.cssText = 'color:var(--text-3);font-size:11px;margin-left:6px;';
      rfcSpan.textContent = c.rfc;
      item.appendChild(rfcSpan);
    }
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    item.addEventListener('mousedown', function(){ selClienteCot(c.id, c.nombre); });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

function selClienteCot(id, nombre){
  document.getElementById('cot-cliente-id').value = id;
  document.getElementById('cot-cliente-search').value = nombre;
  document.getElementById('cot-cliente-selected').textContent = '✓ '+nombre;
  document.getElementById('cot-cliente-selected').style.display = 'block';
  document.getElementById('cot-cliente-dropdown').style.display = 'none';
}

document.addEventListener('click',function(e){
  // Cerrar dropdown de cliente
  var ddCli=document.getElementById('cot-cliente-dropdown');
  if(ddCli&&!ddCli.contains(e.target)&&e.target.id!=='cot-cliente-search') ddCli.style.display='none';
  // Cerrar dropdown de contacto al hacer clic fuera
  var ddCont=document.getElementById('cot-contacto-dd');
  if(ddCont&&ddCont.style.display!=='none'){
    var inp=document.getElementById('cot-contacto-search');
    if(!ddCont.contains(e.target)&&e.target!==inp) ddCont.style.display='none';
  }
});

// ── Guardar ───────────────────────────────────────────────
// ── Contactos vinculados al cliente en cotización ────────

/**
 * Pre-populates the contact dropdown with contacts
 * belonging to the currently selected client.
 * Called when client changes.
 */
function precargarContactosCot(){
  // Called on client change — reset contact field and reload dropdown
  var inp = document.getElementById('cot-contacto-search');
  var hid = document.getElementById('cot-contacto-id');
  if(inp) inp.value = '';
  if(hid) hid.value = '';
  actualizarBtnClear && actualizarBtnClear('cot-contacto-id','cot-contacto-clear');
  mostrarContactosCot();
}

function mostrarContactosCot(){
  // Called on focus — show contacts for selected client without resetting the field
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-contacto-dd');
  if(!dd) return;
  var pool = clienteId
    ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
    : [];
  if(!pool.length){
    dd.style.display = 'none';
    return;
  }
  _renderContactoCotDD(pool.slice(0,10), dd);
  dd.style.display = 'block';
}

/**
 * Filters contacts for the cotizacion contact search input.
 * Falls back to all contacts if no client is selected.
 */
function buscarContactoCot(q){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-contacto-dd');
  if(!dd) return;
  var ql = (q||'').toLowerCase().trim();
  if(!ql){ mostrarContactosCot(); return; }
  // Pool: contacts from selected client only
  var pool = clienteId
    ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
    : (contactos||[]);
  var matches = pool.filter(function(c){
    var nombre = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
    return nombre.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
  }).slice(0,10);
  if(!matches.length){ dd.style.display = 'none'; return; }
  _renderContactoCotDD(matches, dd);
  dd.style.display = 'block';
}

function _renderContactoCotDD(list, dd){
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  list.forEach(function(c){
    var nombre = (c.nombre||'') + (c.apellido ? ' '+c.apellido : '');
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:13px;';
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:500;color:var(--text-1);';
    nameEl.textContent = nombre;
    var subEl = document.createElement('div');
    subEl.style.cssText = 'font-size:10px;color:var(--text-3);';
    subEl.textContent = (c.cargo||'') + (c.email ? ' · '+c.email : '');
    item.appendChild(nameEl);
    item.appendChild(subEl);
    item.addEventListener('mousedown', function(){
      document.getElementById('cot-contacto-search').value = nombre;
      document.getElementById('cot-contacto-id').value = c.id;
      dd.style.display = 'none';
      actualizarBtnClear('cot-contacto-id','cot-contacto-clear');
    });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

function mostrarUsuariosCot(){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-usuario-dd');
  if(!dd) return;
  var pool = clienteId ? (contactos||[]).filter(function(c){ return c.cliente_id===clienteId; }) : [];
  if(!pool.length){ dd.style.display='none'; return; }
  _renderUsuarioCotDD(pool.slice(0,10), dd);
  dd.style.display = 'block';
}

function buscarUsuarioCot(q){
  var clienteId = document.getElementById('cot-cliente-id').value;
  var dd = document.getElementById('cot-usuario-dd');
  if(!dd) return;
  var ql = (q||'').toLowerCase().trim();
  if(!ql){ mostrarUsuariosCot(); return; }
  var pool = clienteId ? (contactos||[]).filter(function(c){ return c.cliente_id===clienteId; }) : (contactos||[]);
  var matches = pool.filter(function(c){
    var nombre = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
    return nombre.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
  }).slice(0,10);
  if(!matches.length){ dd.style.display='none'; return; }
  _renderUsuarioCotDD(matches, dd);
  dd.style.display = 'block';
}

function _renderUsuarioCotDD(list, dd){
  dd.innerHTML = '';
  var frag = document.createDocumentFragment();
  list.forEach(function(c){
    var nombre = (c.nombre||'')+(c.apellido?' '+c.apellido:'');
    var item = document.createElement('div');
    item.style.cssText = 'padding:9px 12px;cursor:pointer;border-bottom:0.5px solid var(--border-light);font-size:13px;';
    item.addEventListener('mouseenter', function(){ this.style.background='var(--bg-hover)'; });
    item.addEventListener('mouseleave', function(){ this.style.background=''; });
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:500;color:var(--text-1);';
    nameEl.textContent = nombre;
    var subEl = document.createElement('div');
    subEl.style.cssText = 'font-size:10px;color:var(--text-3);';
    subEl.textContent = (c.cargo||'')+(c.email?' · '+c.email:'');
    item.appendChild(nameEl);
    item.appendChild(subEl);
    item.addEventListener('mousedown', function(){
      document.getElementById('cot-usuario-search').value = nombre;
      document.getElementById('cot-usuario-id').value = c.id;
      dd.style.display = 'none';
      actualizarBtnClear('cot-usuario-id','cot-usuario-clear');
    });
    frag.appendChild(item);
  });
  dd.appendChild(frag);
}

async function guardarCotizacion(){
  var clienteId  = document.getElementById('cot-cliente-id').value||null;
  var contactoId = (document.getElementById('cot-contacto-id')||{}).value||null;
  var usuarioClienteId = (document.getElementById('cot-usuario-id')||{}).value||null;
  var proyectoId = (document.getElementById('cot-proj-id')||{}).value||null;
  var sel = document.getElementById('cot-cliente-sel');
  var tituloVal = (document.getElementById('cot-titulo')||{}).value||'';
  var clienteNombre = clienteId && clientes.find(function(c){return c.id===clienteId;}) ?
    clientes.find(function(c){return c.id===clienteId;}).nombre :
    document.getElementById('cot-cliente-search').value.trim();
  if(!clienteId){showError('Selecciona un cliente de la lista.'); if(sel)sel.focus(); return;}
  if(!clienteNombre){showError('Selecciona un cliente de la lista.'); return;}
  if(!cotItemsTemp.length){showError('Agrega al menos un item.'); return;}

  var subtotal = cotItemsTemp.reduce(function(a,i){return a+(parseFloat(i.subtotal)||0);},0);
  var iva = subtotal*0.16;
  var total = subtotal+iva;
  var fecha = document.getElementById('cot-fecha').value;
  var año = new Date(fecha+'T12:00').getFullYear();

  try{
    var btn = document.getElementById('btn-save-cot');
    btn.disabled=true; btn.textContent='Guardando...';

    var cotData = {
      condiciones: getCondicionesSeleccionadas(),
      titulo:      tituloVal||null,
      cliente_id:  clienteId,
      contacto_id: contactoId,
      usuario_cliente_id: usuarioClienteId,
      proyecto_id: proyectoId,
      cliente_nombre: clienteNombre,
      fecha: fecha,
      vigencia_dias: parseInt(document.getElementById('cot-vigencia').value)||15,
      numero_requisicion: (document.getElementById('cot-requisicion')||{}).value.trim()||null,
      notas: document.getElementById('cot-notas').value.trim()||null,
      subtotal: subtotal,
      iva: iva,
      total: total,
      estatus: cotEditId ? undefined : 'borrador'
    };

    var savedCot;
    if(cotEditId && cotVersionFlag) {
      // Create new version
      var cBase = cotizaciones.find(function(x){return x.id===cotEditId;}) || (await DB.cotizaciones.get(cotEditId));
      var baseId = cBase.cotizacion_base_id || cBase.id;
      cotData.cotizacion_base_id = baseId;
      cotData.version = (cBase.version || 1) + 1;
      cotData.numero = cBase.numero;
      cotData.estatus = 'borrador';
      savedCot = await DB.cotizaciones.save(cotData);
      cotVersionFlag = false;
    } else if(cotEditId) {
      cotData.id = cotEditId;
      savedCot = await DB.cotizaciones.save(cotData);
    } else {
      var count = await DB.cotizaciones.countPeriodo('COT-'+año+'-');
      cotData.numero = 'COT-'+año+'-'+String(count+1).padStart(3,'0');
      savedCot = await DB.cotizaciones.save(cotData);
    }

    // Upsert items
    var items = cotItemsTemp.map(function(item,idx){
      return {
        cotizacion_id: savedCot.id,
        tipo: item.tipo,
        descripcion: item.descripcion,
        material: item.material||null,
        cantidad: parseFloat(item.cantidad)||1,
        unidad: item.unidad||'pzas',
        precio_unitario: parseFloat(item.precio_unitario)||0,
        subtotal: parseFloat(item.subtotal)||0,
        notas: item.notas||null,
        orden: idx
      };
    });
    await DB.cotizacionItems.replace(cotEditId||savedCot.id, items);

    cerrarCotModal();
    await loadCotizaciones();
    showStatus('✓ Cotización guardada');
    verDetalleCotizacion(savedCot.id);
  }catch(e){
    console.error('guardarCotizacion:',e);
    showError('Error: '+e.message);
  }finally{
    cotVersionFlag = false;
    var btn=document.getElementById('btn-save-cot');
    if(btn){btn.disabled=false;btn.textContent='Guardar';}
  }
}

// ── Cambiar estatus ───────────────────────────────────────
async function cambiarEstatusCot(id, estatus){
  try{
    if(estatus === 'cerrada'){
      // Check for multiple versions
      var cot = (allCotizaciones||[]).find(function(c){return c.id===id;});
      if(!cot) cot = await DB.cotizaciones.get(id);
      var baseId = cot.cotizacion_base_id || cot.id;
      var versiones = await DB.cotizaciones.versionesByBase(baseId);
      if(versiones && versiones.length > 1){
        mostrarPickerVersiones(versiones, id);
        return;
      }
      await _cerrarCotizacion(id);
    } else {
      var extra = {};
      if(estatus==='perdida') extra.fecha_cierre = new Date().toISOString().split('T')[0];
      await DB.cotizaciones.updateEstatus(id, estatus, extra);
      await loadCotizaciones();
      if(cotView==='kanban') renderKanban();
      cerrarDetail();
      showStatus('✓ Cotización actualizada');
    }
  }catch(e){showError('Error: '+e.message);}
}

async function _cerrarCotizacion(id){
  try{
    var extra = { fecha_cierre: new Date().toISOString().split('T')[0] };
    await DB.cotizaciones.updateEstatus(id, 'cerrada', extra);
    await convertirACotizacionCerrada(id);
  }catch(e){showError('Error: '+e.message);}
}

var _versionPickerSelectedId = null;

function mostrarPickerVersiones(versiones, currentId){
  var sorted = versiones.slice().sort(function(a,b){ return (b.version||1)-(a.version||1); });
  var last4 = sorted.slice(0,4);
  var fmt2 = function(n){ return n!=null ? '$'+parseFloat(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; };
  var fmtEst = function(e){ return {borrador:'Borrador',enviada:'Enviada',en_negociacion:'En negociación',cerrada:'Cerrada',perdida:'Perdida'}[e]||e; };

  var existing = document.getElementById('version-picker-overlay');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'version-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:950;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML =
    '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:14px;width:100%;max-width:440px;padding:24px;box-shadow:0 8px 40px var(--shadow);">'+
      '<div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">¿Qué versión se aprobó?</div>'+
      '<div style="font-size:12px;color:var(--text-3);margin-bottom:18px;">'+(last4[0]&&last4[0].numero||'')+' · Elige la versión ganadora</div>'+
      '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">'+
        last4.map(function(v,i){
          var isLatest = i===0;
          return '<div onclick="versionPickerSelect(\''+v.id+'\')" id="vpick-'+v.id+'" style="padding:12px 14px;border-radius:8px;border:1.5px solid '+(isLatest?'#E8192C':'var(--border)')+';cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:'+(isLatest?'rgba(232,25,44,.07)':'var(--bg-card-2)')+';transition:all .15s;">'+
            '<div>'+
              '<span style="font-size:13px;font-weight:700;color:'+(isLatest?'#E8192C':'var(--text-1)')+';">v'+(v.version||1)+'</span>'+
              (isLatest ? '<span style="font-size:10px;color:#E8192C;margin-left:6px;">más reciente</span>' : '')+
              '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">'+(v.fecha||'')+(v.estatus?' · '+fmtEst(v.estatus):'')+'</div>'+
            '</div>'+
            '<span style="font-size:13px;font-weight:700;color:var(--text-1);">'+fmt2(v.total)+'</span>'+
          '</div>';
        }).join('')+
      '</div>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end;">'+
        '<button onclick="document.getElementById(\'version-picker-overlay\').remove()" style="padding:8px 18px;border:.5px solid var(--border);border-radius:8px;background:none;color:var(--text-2);cursor:pointer;font-size:13px;">Cancelar</button>'+
        '<button id="btn-vpick-ok" onclick="versionPickerConfirm()" style="padding:8px 22px;border-radius:8px;background:#E8192C;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Aprobar versión</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);
  // default: latest
  _versionPickerSelectedId = last4[0] && last4[0].id;
  versionPickerSelect(_versionPickerSelectedId);
}

function versionPickerSelect(id){
  _versionPickerSelectedId = id;
  document.querySelectorAll('[id^="vpick-"]').forEach(function(el){
    var vid = el.id.replace('vpick-','');
    var sel = vid === id;
    el.style.borderColor = sel ? '#E8192C' : 'var(--border)';
    el.style.background   = sel ? 'rgba(232,25,44,.07)' : 'var(--bg-card-2)';
  });
}

async function versionPickerConfirm(){
  if(!_versionPickerSelectedId) return;
  var overlay = document.getElementById('version-picker-overlay');
  if(overlay) overlay.remove();
  await _cerrarCotizacion(_versionPickerSelectedId);
}

var _perdidaId = null;
var PERDIDA_MOTIVOS = [
  'Precio muy alto',
  'Se fue con la competencia',
  'Proyecto cancelado por cliente',
  'Sin respuesta / cliente desapareció',
  'Fuera de presupuesto',
  'Tiempos de entrega',
  'Otro'
];

function marcarPerdida(id){
  _perdidaId = id;
  var cot = (allCotizaciones||[]).find(function(c){return c.id===id;});
  var overlay = document.getElementById('perdida-modal-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'perdida-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:.5px solid var(--border);border-radius:14px;width:100%;max-width:420px;padding:24px;box-shadow:0 8px 40px var(--shadow);">'+
        '<div style="font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Marcar como perdida</div>'+
        '<div id="perdida-modal-sub" style="font-size:12px;color:var(--text-3);margin-bottom:18px;"></div>'+
        '<label style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Motivo</label>'+
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px;">'+
          PERDIDA_MOTIVOS.map(function(m){
            return '<button onclick="perdidaSelMotivo(this,\''+m+'\')" style="font-size:11px;padding:4px 10px;border:.5px solid var(--border);border-radius:20px;background:none;color:var(--text-2);cursor:pointer;transition:all .12s;">'+m+'</button>';
          }).join('')+
        '</div>'+
        '<label style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;">Notas adicionales <span style="font-weight:400;">(opcional)</span></label>'+
        '<textarea id="perdida-modal-notas" rows="2" placeholder="Detalles..." style="width:100%;margin-top:6px;padding:8px 10px;border:.5px solid var(--border);border-radius:8px;background:var(--bg-card-2);color:var(--text-1);font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>'+
        '<div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">'+
          '<button onclick="cerrarModalPerdida()" style="padding:8px 18px;border:.5px solid var(--border);border-radius:8px;background:none;color:var(--text-2);cursor:pointer;font-size:13px;">Cancelar</button>'+
          '<button onclick="confirmarPerdida()" style="padding:8px 20px;border-radius:8px;background:#f87171;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Confirmar pérdida</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
  }
  var sub = document.getElementById('perdida-modal-sub');
  if(sub) sub.textContent = cot ? (cot.numero||'')+' · '+(cot.cliente_nombre||'') : '';
  // Reset state
  var notas = document.getElementById('perdida-modal-notas');
  if(notas) notas.value = '';
  overlay.querySelectorAll('button[data-sel]').forEach(function(b){ b.removeAttribute('data-sel'); b.style.cssText='font-size:11px;padding:4px 10px;border:.5px solid var(--border);border-radius:20px;background:none;color:var(--text-2);cursor:pointer;transition:all .12s;'; });
  overlay.style.display = 'flex';
}

function perdidaSelMotivo(btn, motivo){
  var overlay = document.getElementById('perdida-modal-overlay');
  if(!overlay) return;
  overlay.querySelectorAll('button[data-sel]').forEach(function(b){ b.removeAttribute('data-sel'); b.style.background='none'; b.style.color='var(--text-2)'; b.style.borderColor='var(--border)'; });
  btn.setAttribute('data-sel','1');
  btn.style.background = '#f87171'; btn.style.color = '#fff'; btn.style.borderColor = '#f87171';
}

function cerrarModalPerdida(){
  var overlay = document.getElementById('perdida-modal-overlay');
  if(overlay) overlay.style.display = 'none';
  _perdidaId = null;
}

async function confirmarPerdida(){
  if(!_perdidaId) return;
  var overlay = document.getElementById('perdida-modal-overlay');
  var selBtn = overlay ? overlay.querySelector('button[data-sel]') : null;
  var motivo = selBtn ? selBtn.textContent : '';
  var notas = ((document.getElementById('perdida-modal-notas')||{}).value||'').trim();
  var motivoFinal = motivo + (notas ? (motivo ? ' — ' : '') + notas : '');
  var id = _perdidaId;
  cerrarModalPerdida();
  try{
    await DB.cotizaciones.updateEstatus(id,'perdida',{motivo_perdida:motivoFinal||null,fecha_cierre:new Date().toISOString().split('T')[0]});
    loadCotizaciones();
    cerrarDetail();
    showStatus('Cotización marcada como perdida');
  }catch(e){showError('Error: '+e.message);}
}

// ── Cerrar cotización → crear proyecto ───────────────────
async function convertirACotizacionCerrada(cotId){
  var cot = cotizaciones.find(function(c){return c.id===cotId;}) ||
    await DB.cotizaciones.get(cotId);
  if(!cot) return;

  var items = await DB.cotizacionItems.byCotizacion(cotId);

  // Classify items
  var maquinados = items.filter(function(i){return i.tipo==='maquinado';});
  var servicios  = items.filter(function(i){return i.tipo==='servicio';});
  var productos  = items.filter(function(i){return i.tipo==='producto';});
  var totalPiezas = maquinados.reduce(function(a,i){return a+(parseFloat(i.cantidad)||0);},0);

  // Build description from all items
  var allDescs = items.map(function(i){return i.descripcion;}).filter(Boolean);
  var tipoPieza = allDescs.slice(0,2).join(', ')+(allDescs.length>2?' y más':'');

  // Build unidad from dominant type
  var unidad = maquinados.length ? (maquinados[0].unidad||'pzas') :
               servicios.length  ? (servicios[0].unidad||'hrs') : 'servicios';

  // Build items summary HTML
  var summaryHTML = items.length ?
    '<div style="font-size:11px;color:var(--text-3);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Items de la cotización</div>'+
    items.map(function(i){
      var badge = i.tipo==='maquinado'?'🔧':i.tipo==='servicio'?'⚙️':'📦';
      return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px solid var(--border-light);">'+
        '<span>'+badge+' '+esc(i.descripcion||'')+(i.material?' <span style="color:var(--text-3);">('+esc(i.material)+')</span>':'')+'</span>'+
        '<span style="color:var(--text-2);">'+fmt(parseFloat(i.subtotal)||0)+'</span>'+
      '</div>';
    }).join('') : '<span style="color:var(--text-3);">Sin items</span>';

  // Show/hide piezas row based on whether there are maquinados
  var piezasRow = document.getElementById('conv-piezas-row');
  if(piezasRow) piezasRow.style.display = maquinados.length ? 'flex' : 'none';

  // Show confirmation modal
  cerrarDetail();
  document.getElementById('conv-cot-id').value = cotId;
  document.getElementById('conv-cliente').textContent = cot.cliente_nombre||'';
  document.getElementById('conv-monto').textContent = fmt(cot.total||0);
  document.getElementById('conv-pedido').value = (cot.numero||'COT-').replace('COT-','PED-');
  document.getElementById('conv-tipo-pieza').value = tipoPieza;
  document.getElementById('conv-piezas').value = Math.round(totalPiezas)||0;
  document.getElementById('conv-unidad').value = unidad;
  document.getElementById('conv-items-summary').innerHTML = summaryHTML;
  document.getElementById('conv-fecha-entrega').value = '';
  var fechaMin = new Date(); fechaMin.setDate(fechaMin.getDate()+7);
  document.getElementById('conv-fecha-entrega').min = fechaMin.toISOString().split('T')[0];
  document.getElementById('conv-modal').style.display = 'flex';
}

async function confirmarConversion(){
  var cotId = document.getElementById('conv-cot-id').value;
  var cot = cotizaciones.find(function(c){return c.id===cotId;});
  if(!cot) return;

  var nombrePedido = document.getElementById('conv-pedido').value.trim();
  var tipoPieza = document.getElementById('conv-tipo-pieza').value.trim();
  var convUnidad = (document.getElementById('conv-unidad')||{}).value||'pzas';
  var totalPiezas = parseInt(document.getElementById('conv-piezas').value)||0;
  var fechaEntrega = document.getElementById('conv-fecha-entrega').value;

  if(!nombrePedido||!fechaEntrega){showError('Completa el nombre del pedido y fecha de entrega.');return;}

  try{
    var btn = document.getElementById('btn-confirmar-conv');
    btn.disabled=true; btn.textContent='Creando proyecto...';

    var año = new Date().getFullYear();
    var proyData = {
      nombre_cliente: cot.cliente_nombre,
      cliente_id: cot.cliente_id||null,
      nombre_pedido: nombrePedido,
      tipo_pieza: tipoPieza||null,
      total_piezas: totalPiezas,
      monto_total: cot.total,
      fecha_pedido: new Date().toISOString().split('T')[0],
      fecha_entrega: fechaEntrega,
      year: año,
      cotizacion_id: cotId,
      activo: true
    };

    var proj = await DB.proyectos.save(proyData);

    // Link cotizacion to proyecto
    await DB.cotizaciones.linkProyecto(cotId, proj.id);

    document.getElementById('conv-modal').style.display='none';
    cerrarDetail();
    loadCotizaciones();
    showStatus('✓ Proyecto creado: '+nombrePedido);
    setTimeout(function(){
      switchTab('proyectos', document.getElementById('sb-proyectos'));
      setTimeout(function(){verDetalleProyecto(proj.id);},600);
    },400);
  }catch(e){
    showError('Error: '+e.message);
  }finally{
    var btn=document.getElementById('btn-confirmar-conv');
    if(btn){btn.disabled=false;btn.textContent='Crear proyecto';}
  }
}

// ── Detalle cotización ────────────────────────────────────
async function verDetalleCotizacion(id){
  // Siempre re-fetch para tener fecha_cierre y numero_requisicion actualizados
  var cFresh = await DB.cotizaciones.get(id);
  var c = cFresh || cotizaciones.find(function(x){return x.id===id;});
  if(!c) return;

  var ini = (c.numero||'COT').slice(0,3).toUpperCase();
  var color = EST_COLORS[c.estatus]||'#475569';
  var label = EST_LABELS[c.estatus]||c.estatus;

  abrirDetail(c.numero||'Cotización', c.cliente_nombre, ini,
    '<div style="padding:16px;color:var(--text-3);font-size:12px;">Cargando...</div>',
    function(){editarCotizacion(id);}
  );

  try{
    var items = await DB.cotizacionItems.byCotizacion(id);

    var acciones = '';
    if(c.estatus==='borrador'||c.estatus==='enviada'||c.estatus==='en_negociacion'){
      acciones =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
          (c.estatus==='borrador'?'<button class="btn-primary" onclick="cambiarEstatusCot(\''+id+'\',\'enviada\')">Marcar enviada</button>':'')+
          (c.estatus==='enviada'?'<button class="btn-sm" onclick="cambiarEstatusCot(\''+id+'\',\'en_negociacion\')" style="color:#a78bfa;border-color:#a78bfa;">💬 En negociación</button>':'')+
          '<button class="btn-primary" style="background:#34d399;color:#0b0e17;" onclick="cambiarEstatusCot(\''+id+'\',\'cerrada\')">✓ Cerrar (ganada)</button>'+
          '<button class="btn-sm" style="color:#f87171;" onclick="marcarPerdida(\''+id+'\')">Marcar perdida</button>'+
          '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        '</div>';
    } else if(c.estatus==='cerrada'){
      acciones = '<div style="display:flex;gap:8px;">'+
        '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>'+
        (c.proyecto_id?'<button class="btn-sm" onclick="cerrarDetail();switchTab(\'proyectos\',document.getElementById(\'sb-proyectos\'));setTimeout(function(){verDetalleProyecto(\''+c.proyecto_id+'\');},600);">Ver proyecto →</button>':'')+
      '</div>';
    } else {
      acciones = '<button class="btn-sm" onclick="generarPDFCotizacion(\''+id+'\')">📄 PDF</button>';
    }

    var itemsHTML = items.map(function(item){
      var isMaq=item.tipo==='maquinado', isSvc=item.tipo==='servicio';
      return '<tr>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-1);">'+
          '<div style="font-weight:500;">'+esc(item.descripcion||'')+'</div>'+
          (item.material?'<div style="font-size:11px;color:var(--text-3);">Material: '+esc(item.material)+'</div>':'')+
          (item.notas?'<div style="font-size:11px;color:var(--text-3);">'+esc(item.notas)+'</div>':'')+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-2);text-align:center;">'+
          '<span style="font-size:10px;background:'+(isMaq?'#1a2035':isSvc?'#0d1f3c':'#12172a')+';color:'+(isMaq?'#60a5fa':isSvc?'#a78bfa':'#94a3b8')+';padding:2px 6px;border-radius:4px;">'+
          (isMaq?'Maquinado':isSvc?'Servicio':'Producto')+'</span>'+
        '</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-1);text-align:right;">'+(item.cantidad||0)+' '+(item.unidad||'')+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:var(--text-2);text-align:right;">'+fmt(item.precio_unitario||0)+'</td>'+
        '<td style="padding:8px 12px;border-bottom:0.5px solid var(--border);color:#34d399;font-weight:600;text-align:right;">'+fmt(item.subtotal||0)+'</td>'+
      '</tr>';
    }).join('');

    var body =
      // Status & actions
      '<div class="detail-section" style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span style="padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;background:'+color+'22;color:'+color+';">'+label+'</span>'+
        acciones+
      '</div>'+
      // KPIs
      '<div class="detail-section"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Subtotal</div><div class="detail-kpi-value" style="font-size:16px;color:var(--text-1);">'+fmt(c.subtotal||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">IVA (16%)</div><div class="detail-kpi-value" style="font-size:16px;color:var(--text-2);">'+fmt(c.iva||0)+'</div></div>'+
        '<div class="detail-kpi"><div class="detail-kpi-label">Total</div><div class="detail-kpi-value c-green">'+fmt(c.total||0)+'</div></div>'+
      '</div></div>'+
      // Info
      '<div class="detail-section"><div class="detail-grid">'+
        '<div class="detail-field"><div class="detail-field-label">Fecha</div><div class="detail-field-value">'+fmtDateFull(c.fecha)+'</div></div>'+
        '<div class="detail-field"><div class="detail-field-label">Vigencia</div><div class="detail-field-value">'+(c.vigencia_dias||15)+' días</div></div>'+
        (c.numero_requisicion?'<div class="detail-field"><div class="detail-field-label">No. Requisición</div><div class="detail-field-value" style="font-family:monospace;">'+esc(c.numero_requisicion)+'</div></div>':'')+
        (c.fecha_cierre?'<div class="detail-field"><div class="detail-field-label">Fecha cierre</div><div class="detail-field-value">'+fmtDateFull(c.fecha_cierre)+'</div></div>':'')+
        (c.notas?'<div class="detail-field" style="grid-column:span 2;"><div class="detail-field-label">Notas</div><div class="detail-field-value" style="color:var(--text-2);">'+esc(c.notas)+'</div></div>':'')+
      '</div></div>'+
      // Items table
      '<div class="detail-section">'+
        '<div class="detail-section-title">Items ('+items.length+')</div>'+
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'+
          '<thead><tr>'+
            '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Descripción</th>'+
            '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Tipo</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Cant.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">P.U.</th>'+
            '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;border-bottom:0.5px solid var(--border);">Subtotal</th>'+
          '</tr></thead>'+
          '<tbody>'+itemsHTML+'</tbody>'+
        '</table></div>'+
      '</div>';

    // Contacto vinculado a esta cotización específicamente
    var contactoHTML = '';
    if(c.contacto_id){
      var cotCont=await DB.contactos.get(c.contacto_id);
      if(cotCont){
        var ctNombre=(cotCont.nombre||'')+(cotCont.apellido?' '+cotCont.apellido:'');
        contactoHTML=
          '<div class="detail-section">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'+
            '<div class="detail-section-title" style="margin-bottom:0;">Contacto vinculado</div>'+
            '<button class="btn-sm" style="font-size:11px;color:var(--text-3);" '+
              'onclick="quitarContactoCot(\''+id+'\')" title="Quitar contacto de esta cotización">× Quitar</button>'+
          '</div>'+
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+cotCont.id+'\')">'+ 
            '<div>'+
              '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(ctNombre)+'</div>'+
              '<div style="font-size:11px;color:var(--text-3);">'+(cotCont.cargo||'')+(cotCont.email?' · '+cotCont.email:'')+'</div>'+
              (cotCont.telefono?'<div style="font-size:11px;color:var(--text-3);">'+esc(cotCont.telefono)+'</div>':'')+
            '</div>'+
            '<span style="font-size:11px;color:var(--text-3);">→</span>'+
          '</div>'+
          '</div>';
      }
    } else if(c.cliente_id){
      // No contact linked yet — offer to set one from this company's contacts
      contactoHTML=
        '<div class="detail-section">'+
        '<div class="detail-section-title">Contacto vinculado</div>'+
        '<div style="color:var(--text-4);font-size:12px;padding:4px 0 10px;">Sin contacto vinculado a esta cotización</div>'+
        '<button class="btn-sm" style="font-size:11px;" '+
          'onclick="vincularContactoCot(\''+id+'\',\''+c.cliente_id+'\')">+ Vincular contacto</button>'+
        '</div>';
    }
    body += contactoHTML;

    // Usuario del cliente vinculado
    if(c.usuario_cliente_id){
      var cotUsu=await DB.contactos.get(c.usuario_cliente_id);
      if(cotUsu){
        var usuNombre=(cotUsu.nombre||'')+(cotUsu.apellido?' '+cotUsu.apellido:'');
        body+=
          '<div class="detail-section">'+
          '<div class="detail-section-title">Usuario (solicitante)</div>'+
          '<div class="detail-list-item" style="cursor:pointer;" onclick="verDetalleContacto(\''+cotUsu.id+'\')">'+
            '<div>'+
              '<div style="font-size:13px;font-weight:500;color:var(--text-1);">'+esc(usuNombre)+'</div>'+
              '<div style="font-size:11px;color:var(--text-3);">'+(cotUsu.cargo||'')+(cotUsu.email?' · '+cotUsu.email:'')+'</div>'+
            '</div>'+
            '<span style="font-size:11px;color:var(--text-3);">→</span>'+
          '</div>'+
          '</div>';
      }
    }

    document.getElementById('detail-body').innerHTML = body;
  }catch(e){
    console.error('Detalle cotizacion:',e);
    document.getElementById('detail-body').innerHTML = '<div style="padding:16px;color:#f87171;">Error: '+esc(String(e.message||e))+'</div>';
  }
}


// ── Vincular contacto a cotización desde detalle ─────────
function vincularContactoCot(cotId, clienteId){
  var uid = 'cot_' + cotId;
  var secId = 'vinc-cont-sec-' + uid;
  var existing = document.getElementById(secId);
  if(existing){ existing.remove(); return; }

  var sec = document.createElement('div');
  sec.id = secId;
  sec.style.cssText = 'padding:10px 0 4px;position:relative;';

  var inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Buscar contacto de esta empresa...';
  inp.autocomplete = 'off';
  inp.style.cssText = 'width:100%;padding:7px 10px;font-size:12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-1);box-sizing:border-box;';

  var dd = document.createElement('div');
  dd.style.cssText = 'background:var(--bg-card);border:0.5px solid var(--border);border-radius:8px;z-index:600;max-height:200px;overflow-y:auto;margin-top:4px;box-shadow:0 4px 16px var(--shadow);display:none;';

  function renderDD(matches){
    dd.innerHTML = '';
    if(!matches.length){ dd.style.display='none'; return; }
    dd.style.display = 'block';
    matches.forEach(function(c){
      var nombre = (c.nombre||'') + (c.apellido ? ' '+c.apellido : '');
      var yaAsignado = (c.cliente_id && c.cliente_id !== clienteId) || c.proveedor_id;
      var item = document.createElement('div');
      item.style.cssText = 'padding:9px 12px;border-bottom:0.5px solid var(--border-light);font-size:12px;' +
        (yaAsignado ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;');
      item.innerHTML =
        '<div style="font-weight:500;color:var(--text-1);">' + esc(nombre) + '</div>' +
        '<div style="font-size:10px;color:var(--text-3);">' + esc(c.cargo||'') +
          (c.email ? ' · '+esc(c.email) : '') +
          (yaAsignado ? ' · <span style="color:#f87171;">Ya tiene empresa</span>' : '') +
        '</div>';
      if(!yaAsignado){
        item.addEventListener('mousedown', function(){
          seleccionarContactoCot(cotId, c.id, nombre);
        });
      }
      dd.appendChild(item);
    });
  }

  function getPool(q){
    var ql = (q||'').toLowerCase().trim();
    var pool = clienteId
      ? (contactos||[]).filter(function(c){ return c.cliente_id === clienteId; })
      : (contactos||[]);
    if(!pool.length) pool = contactos||[];
    return ql
      ? pool.filter(function(c){
          var n = ((c.nombre||'')+' '+(c.apellido||'')).toLowerCase();
          return n.includes(ql)||(c.cargo||'').toLowerCase().includes(ql)||(c.email||'').toLowerCase().includes(ql);
        }).slice(0,8)
      : pool.slice(0,8);
  }

  inp.addEventListener('focus', function(){ renderDD(getPool('')); });
  inp.addEventListener('input', function(){ renderDD(getPool(this.value)); });
  inp.addEventListener('blur', function(){ setTimeout(function(){ dd.style.display='none'; }, 150); });

  sec.appendChild(inp);
  sec.appendChild(dd);

  var detailBody = document.getElementById('detail-body');
  if(detailBody){
    var sections = detailBody.querySelectorAll('.detail-section');
    var last = sections[sections.length-1];
    if(last) last.appendChild(sec);
    else detailBody.appendChild(sec);
    setTimeout(function(){ inp.focus(); }, 50);
  }
}

async function seleccionarContactoCot(cotId, contactoId, nombre){
  try{
    await DB.cotizaciones.linkContact(cotId, contactoId);
    showStatus('✓ Contacto vinculado: ' + nombre);
    verDetalleCotizacion(cotId);
  }catch(e){ showError('Error: ' + e.message); }
}

// ── Empresa config (editar aquí) ─────────────────────────
var EMPRESA_CONFIG = {
  nombre:    'Grupo M2',
  slogan:    'Maquinados Industriales',
  direcciones: [
    'Cam, Carr. Pie de Gallo Km 0.10 L3, 76220 Santa Rosa Jáuregui, Querétaro',
    'Priv. Chairel 100 A, 89359, Tampico, Tamaulipas'
  ],
  web:       'www.grupom2.com.mx',
  tel:       '+52 56 5035 8701',
  email:     'contacto@grupom2.com.mx',
  banco:     'BBVA · CLABE: 012680001205003565 · Cuenta: 0120500356',
  legal:     'Precios en MXN + IVA. Vigencia según cotización. Pedido sujeto a confirmación por escrito. ' +
             'No incluye maniobras de carga/descarga salvo acuerdo. Pagos anticipados no son reembolsables.',
  logo:      null,
  firma_nombre: 'Ing. [Nombre]',
  firma_cargo:  'Director General'
};

// ── PDF ───────────────────────────────────────────────────
async function generarPDFCotizacion(id){
  var c = await DB.cotizaciones.get(id);
  if(!c){ showError('Cotización no encontrada'); return; }

  var items = await DB.cotizacionItems.byCotizacion(id);
  items = items||[];

  var contactoNombre = '';
  if(c.contacto_id){
    try{
      var ctPdf = await DB.contactos.get(c.contacto_id);
      if(ctPdf) contactoNombre = (ctPdf.nombre||'')+(ctPdf.apellido?' '+ctPdf.apellido:'')+(ctPdf.cargo?' · '+ctPdf.cargo:'');
    }catch(e){}
  }
  var usuarioNombre = '';
  if(c.usuario_cliente_id){
    try{
      var usuPdf = await DB.contactos.get(c.usuario_cliente_id);
      if(usuPdf) usuarioNombre = (usuPdf.nombre||'')+(usuPdf.apellido?' '+usuPdf.apellido:'')+(usuPdf.cargo?' · '+usuPdf.cargo:'');
    }catch(e){}
  }

  // Logo embebido como PNG base64 (120x120px, compatible con jsPDF)
  var logoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAqqSURBVHhe7Zz5VxRXFoD9tyKrIMgiiCjIIovIvrjvRtw3FBA1zsk4MxqNxsTjRtRZ4sQ4i4kaoxlzdEzGRNygF3qBbgTp7jvnvqaa6rpNdTVU0e0774fvQFfft1R91VWv3lIzbK2bwNpYK+CUGabChfAm/gMBpwjBnCMEc44QzDlCMOcIwZwjBHOOEMw5QjDnCMGcIwRzjhDMOUIw5wjBnCMEc44QzDlCMOcIwZwjBHOOEMw5QjDnCMGcIwRzjhDMOUIw5wjBnCMEc44QzDlCMOcIwZwjBHOOEMw5QjDnCMGcIwRzjhDMOYYK7k1JAvPiYjAvLgmid85sEquZhJlgLl5E8uzLzaaxGvg5JQl+Sk8ZJy0FXiTGBcWYFy0k5WmmpAj6MtNJudOFoYJHHv0IAD6Ct98KpgV5JF4LQ9e+JPkhvtERsFRVkHg1bublwOa1K2DTupVBdDbWBmKch9pJWRHj88Loix4Y/OQEmPJySD2MxFDBPreL7uwYI4/+A73JCSSNGo69u0k+cuxbPyRpJuKHjDTYsmY5kYvsX9YQiHNdOE/KmQq+t25wdnWQ+hhF1AQjrnNnSZqJsFSUgW/4LclDjmVpJUkXiqcpSbBrRTMRi6B0lC/F6i3YjxfcF86TehlBVAXjpcu2aT1Jp6Q3PRVGe57T9DLe3vqGpAtFT1IcdDbVErESX+XPC4o3RrAfZ+dBUj+9ia5gvGQNOMFUuICklTN0428knZzR355pari9jv8A/rC0gkiVOFNeStIYKdjnGoS+7AxSpp5EXTDy7slj1uJWpkec7W0kXo53wAnmogKSLhQXSwqJVImuhhp4mTiTpDFSMOI80kXK1JOYEIyEuifhPdU3MkxiA3hGoX/VcpIuFDfz5hKpEjtXNrPHJWUaBPP3vHoJHlPvpPA67LTeMobv3iFl6knMCMaGh711vBXcl5EGntcvQ8SN4zx6mJQZCrUW84drV8DdrDkkjW4kzISBY0dI3SU8FhNNoyMxJNgHPvcgmIsL2UF5e+sm+V7O0F+uk/JC4W8xNxGxEtcL5pM0eoOdMMr6B/b57RCJ15OYEoyMPvuFXa6V2+W8e/wT9KYmk/KU9CTGsU4LpVSJE0vKWMNLmU5vLDVLyT5I+AYHSLyexJzgcHitFjDNzyVlKQnXYm5vqmMngDKdVsyFC8Cxbw+4zn4K7u7L4O6+EhLsefNazWQ/JPCEVuatJ1ET7LX3k23h8L0bBmt9DSknFGot5u2rWuDJ7FkkjRb6lzfDyMMH7BleWb/J4L58iZShJ1ET3L96BXidDrJdDeyqVJYRCrUWM/Y9387JJGnCkhTvf2TSSayEtWm8W9QIoibYVLCA/Rpg9B35LhSu85+T/EPxLDkBWidoMSOXirU9MysZun6V1GmqDH/3LSlHb6IqGGMcbfvYI5Lyezkj39+DN0naBiZ6kuIn7GdGTi5ZTNKEw75zG6nTVPH09U7LyFLUBSOuzz8j3wcOxOtX4bvzEuPYL8zaUMc+38+c+LkXiejRKDEOPG9ek3pNhXc//xdMBfm0LAOICcF4EIdv/4vEYHpLRfhf3OCpkyzevm1LYNvXeTlErAR2btzL0jYIb21uJPWaLJ5XL9j4cqTDpFMhNgTjiNGc2eyRIRDj9YBt/VqSpxLs/ZIaPnLByAWVlvQule5JOQMf/47UPYBnFNxXLrH+ZOfhQxNi37kdzDiQkUD7uo0mZgQjeNny2vyPT1q6IS1LyllPkJSnUnC4Z+HDDdXwIsxBR4HKuku4vjhH4mONmBKMWKqrwNnVSbYr6cvJAk/vm6A8lYIRHP/tUBn/PVNeQtLIUWs9O9sPkPhYI+YEawHvYSMP7pM8QwlGnqYmq7asb+RP3DOmJhj7y3FCHU5ImBRpKaQ8vXkvBbsvXSD5IRMJRtRa1rj9QUboCQNqgvVg6K9/JmXqyXsn2LF3F8lLQk0w8vX8iVvWe5c3wrNZiSSN0YJxSFRZpp68d4JxgFyZl0Q4wYhay/pYXRW8UjS6hGAVDBF87y7JS0KL4HAt6/Oli4LihWAVYlEw8jxRvWV9a97cQKwQrALO0FDukIQhgrdqE4w8TZ14bvSOlc2BOCFYBffVbvYrVjLy48NJd9c5Ow6wWRDKPLHPOtL+3R8y09h0HmxFyzm5pCwQ49i32z/i5fUYwtDVblIvPTFUMDdgwwtnfxiBsiydEYI5RwjmHMMF43Pld9kZ8I952fC/EB0J4XieFA/f5mQyHqWnku+1gGt+5Z+fpCaTNcDh+CUl0V+PuZms61P5vVYwHzwWd7LnkGduIzBUMO4MLgk5V1YMl4sWskcT3DFlnBr/zsmCw/XVbKrN8epK+GJx8HOqFtqa64M+f1ZWDPcinOzeXbQQji+tgIvFBXCkvpqNNytjwvH3+blwqLGG5YV16GqoZsdIGacnhgo+UVXGBEmfcWQH50wp49TA9PLOBzxJfk2OJ3Fq6CUYuzrxf7yqHGzyzx7RCj6W4apG+ZXj9txM+FNVOYnVE0MF729pCEwsxxUGeIn9LUI5csGYtq2lPuL5zHoL/jU5gc2rVsaocXN+DlwOMeEPj5Fym54YKvhgcx072/F/nAeFl1jsC1bGqYGCsUMCL204n/mbvPFeJq2gYPkKhtMVpXA/wvdmoOCP6qrg04pStlrin7njVyYt3M7JgrPlxUHb8EQ9oDj59MZQwdcL8uFU5eLAZQnHXScjWPoF431Y2VesBRT61diY7+PZs9ivL9JGFgruLlrgvwqNnbSRgEtT8cSQFrph+XiyXCuMrHMmUgwVjL8a3AE8oO1Ntex+E2lL+vvM9MAsSGx1/r66MuL7OF5FsD2A9cAG20MNi8WV3MifN7kJ8zLwNoUDHR2NtQzcL6PXRhkqWBB9hGDOEYI5JzYEJ4w1eKSGj/wvIvX44F/G2PeBz3565ff3sYYQG7WSp5fyxf8xRmowSflgmrF8emfPYukZUt6KMqXy8B0j0prloHpEmWkXfK0gn3X3ybfhxHDb5o1sCQseNJyLjAeeTRw/0gXWlia2St62aQPYNm9gqwPw9UuW2mr22bZ2NfSvaGGrD611NewvDitiGly7a9vgn0CPS1ssZaVsgTmOHTv27GJ59c3NBPuWzf681q0G15lTbFqu68xp9ipGR3sbDJ7+BEx5uWBtaQTb+jVg27gOrA210Jfrf2zDWPvuHWAuWQTuKxfBXFoUtI93sjPgyzBvEzKCaRf8KC2FtKRxBYOldinYNq5n63+Z1KYGNu948I/H2Tiv82Ab9C9rhv61q6B//Rqw79jKXtIycOwoDBzF+HpwHtgPlspysG9vBWfHQejLmgOOPTvBecj/ZjlcaY/vubRt2QQDxz9mi8qcne1sVQVbgbCtFcxFheA6dZK9n9K2YR1Lh3H4ng1cI2VpqGXlYbmWmipw7N/L6sfy27aFxQx8dAT6Vy4L2kfc50fpxk+TVTLtgiNlOuYO80zMCxZMDSGYc4RgzhGCOUcI5hwhmHOEYM4RgjlHCOYcIZhzhGDOEYI5RwjmHCGYc4RgzhGCOUcI5hwhmHOEYM4RgjlHCOYcIZhzhGDOEYI5RwjmHCGYc4RgzhGCOUcI5hwhmHOEYM4RgjlHCOYcIZhzhGDOEYI5Z4YJX3GbFCfglP8DBFIVqQu37psAAAAASUVORK5CYII=';

  try{
    var doc = new jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'letter'});
    var pw = doc.internal.pageSize.getWidth();  // 279
    var ph = doc.internal.pageSize.getHeight(); // 216

    var fmt = function(n){ return '$'+parseFloat(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };

    var C = {
      white:   [255,255,255],
      bgPage:  [248,248,246],
      red:     [232,25,44],
      carbon:  [51,51,51],       // #333333 brand carbon (header/footer)
      dark2:   [80,80,80],       // table header — entre carbon y brand gray
      gray1:   [245,244,242],    // alternating row
      gray2:   [210,210,210],    // secondary text en header (legible sobre #333)
      gray3:   [170,170,170],    // tertiary text
      text:    [26,26,26],       // main text #1a1a1a
    };

    var fmtDateFull = function(d){ if(!d) return '—'; try{ var dt=new Date(d+'T12:00'); return dt.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}); }catch(e){return d;} };

    // ── Background ────────────────────────────────────────
    doc.setFillColor(...C.bgPage);
    doc.rect(0,0,pw,ph,'F');

    // ── HEADER: dark full-width bar ───────────────────────
    var headerH = 38;
    doc.setFillColor(...C.carbon);
    doc.rect(0,0,pw,headerH,'F');

    // Logo — red background square + logo image
    doc.setFillColor(...C.red);
    doc.rect(0,0,headerH,headerH,'F');
    if(logoDataUrl){
      try{ doc.addImage(logoDataUrl,'PNG',1,1,headerH-2,headerH-2); }catch(e){ console.error('logo err:',e); }
    } else {
      doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...C.white);
      doc.text('MK2',headerH/2,headerH/2+2,{align:'center'});
    }

    // Company name + slogan (right of logo)
    var logoRight = headerH + 8;
    doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(...C.white);
    doc.text(EMPRESA_CONFIG.nombre, logoRight, 15);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray2);
    doc.text(EMPRESA_CONFIG.slogan || '', logoRight, 22);
    doc.text((EMPRESA_CONFIG.web||'') + '  ·  ' + (EMPRESA_CONFIG.tel||''), logoRight, 29);

    // Quote number (right side of header)
    var vLabel = (c.version && c.version > 1) ? ' v' + c.version : '';
    doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red);
    doc.text((c.numero||'COTIZACIÓN')+vLabel, pw-12, 18, {align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray2);
    doc.text('Fecha: ' + fmtDateFull(c.fecha), pw-12, 26, {align:'right'});
    doc.text('Vigencia: ' + (c.vigencia_dias||15) + ' días hábiles', pw-12, 33, {align:'right'});

    var y = headerH + 10;

    // ── Thin red accent line below header ─────────────────
    doc.setFillColor(...C.red);
    doc.rect(0,headerH,pw,1.5,'F');

    // ── CLIENT BLOCK ──────────────────────────────────────
    var extraRows = (contactoNombre ? 1 : 0) + (usuarioNombre ? 1 : 0);
    var clientH = 16 + extraRows * 7;
    doc.setFillColor(...C.white);
    doc.roundedRect(12, y, 130, clientH, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red);
    doc.text('DIRIGIDO A', 18, y+6);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...C.text);
    doc.text(c.cliente_nombre||'—', 18, y+13);
    var clientY = y + 13;
    if(contactoNombre){
      clientY += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
      doc.text('Contacto: ' + contactoNombre, 18, clientY);
    }
    if(usuarioNombre){
      clientY += 6;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
      doc.text('Solicitante: ' + usuarioNombre, 18, clientY);
    }

    // Title/Notas block (right of client)
    if(c.titulo || c.notas){
      doc.setFillColor(...C.white);
      doc.roundedRect(148, y, pw-160, clientH, 2, 2, 'F');
      if(c.titulo){
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red);
        doc.text('PROYECTO / REFERENCIA', 154, y+6);
        doc.setFontSize(9); doc.setFont('helvetica','bolditalic'); doc.setTextColor(...C.text);
        var tituloLines = doc.splitTextToSize(c.titulo, pw-172);
        doc.text(tituloLines.slice(0,2), 154, y+13);
      }
      if(c.notas){
        var notasY = c.titulo ? y+20 : y+6;
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.gray3);
        doc.text('NOTAS', 154, notasY);
        doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
        var notasLines = doc.splitTextToSize(c.notas, pw-172);
        doc.text(notasLines.slice(0,2), 154, notasY+6);
      }
    }

    y = headerH + clientH + 14;

    // ── ITEMS TABLE ───────────────────────────────────────
    var tableData = items.map(function(item){
      var tipoLabel = item.tipo==='maquinado'?'Maquinado':item.tipo==='servicio'?'Servicio':'Producto';
      var desc = (item.descripcion||'');
      if(item.material) desc += '\n' + item.material;
      if(item.notas)    desc += '\n' + item.notas;
      return [
        {content: desc, styles:{fontSize:8.5, textColor:C.text, cellPadding:{top:4,bottom:4,left:4,right:4}}},
        {content: tipoLabel, styles:{fontSize:8, textColor:C.gray2, halign:'center'}},
        {content: (item.cantidad||0)+' '+(item.unidad||'pza'), styles:{halign:'center', textColor:C.gray3}},
        {content: fmt(item.precio_unitario||0), styles:{halign:'right', textColor:C.gray3}},
        {content: fmt(item.subtotal||0), styles:{halign:'right', fontStyle:'bold', textColor:C.text}},
      ];
    });

    doc.autoTable({
      head:[[ 'Descripción', 'Tipo', 'Cant.', 'P. Unitario', 'Subtotal' ]],
      body: tableData,
      startY: y,
      margin:{ left:12, right:12 },
      styles:{ fontSize:8.5, cellPadding:3.5, lineColor:[220,226,234], lineWidth:0.3, textColor:C.text },
      headStyles:{ fillColor:C.dark2, textColor:C.white, fontStyle:'bold', fontSize:8, cellPadding:5 },
      alternateRowStyles:{ fillColor:C.gray1 },
      bodyStyles:{ fillColor:C.white },
      columnStyles:{
        0:{ cellWidth:'auto' },
        1:{ cellWidth:26, halign:'center' },
        2:{ cellWidth:24, halign:'center' },
        3:{ cellWidth:30, halign:'right' },
        4:{ cellWidth:33, halign:'right' },
      }
    });

    var finalY = doc.lastAutoTable.finalY + 8;

    // ── TOTALS ────────────────────────────────────────────
    var tx = pw - 14;
    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
    doc.text('Subtotal:', tx-40, finalY); doc.setTextColor(...C.text); doc.text(fmt(c.subtotal||0), tx, finalY, {align:'right'});
    finalY += 6;
    doc.setTextColor(...C.gray3); doc.text('IVA (16%):', tx-40, finalY); doc.setTextColor(...C.text); doc.text(fmt(c.iva||0), tx, finalY, {align:'right'});
    finalY += 7;

    // Total — línea separadora + texto bold rojo
    doc.setDrawColor(...C.red); doc.setLineWidth(0.6);
    doc.line(tx-60, finalY-2, tx, finalY-2);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.setTextColor(...C.gray3); doc.text('TOTAL:', tx-60, finalY+5);
    doc.setTextColor(...C.red); doc.setFontSize(12);
    doc.text(fmt(c.total||0), tx, finalY+5, {align:'right'});

    // ── CONDITIONS ────────────────────────────────────────
    var condIds = Array.isArray(c.condiciones) ? c.condiciones : [];
    if(condIds.length){
      finalY += 18;
      var condTexts = COT_CONDICIONES.filter(function(cc){ return condIds.indexOf(cc.id)!==-1; }).map(function(cc){ return cc.texto; });
      if(condTexts.length){
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.gray3);
        doc.text('CONDICIONES', 12, finalY);
        finalY += 5;
        doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray2); doc.setFontSize(7);
        condTexts.forEach(function(ct, i){
          doc.text('• ' + ct, 12, finalY + (i * 5));
        });
      }
    }

    // ── Signature ─────────────────────────────────────────
    var firmaY = Math.min(finalY + (condIds.length ? condIds.length*5+8 : 18), ph - 38);
    var firmaX = pw - 80;
    doc.setDrawColor(...C.gray2); doc.setLineWidth(0.4);
    doc.line(firmaX, firmaY, firmaX+60, firmaY);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...C.text);
    doc.text(EMPRESA_CONFIG.firma_nombre, firmaX+30, firmaY+5, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3); doc.setFontSize(7.5);
    doc.text(EMPRESA_CONFIG.firma_cargo, firmaX+30, firmaY+10, {align:'center'});

    // ── FOOTER: dark bar ──────────────────────────────────
    var footerH = 22;
    var footerY = ph - footerH;
    doc.setFillColor(...C.carbon);
    doc.rect(0, footerY, pw, footerH, 'F');
    // Red left accent in footer
    doc.setFillColor(...C.red);
    doc.rect(0, footerY, 5, footerH, 'F');

    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray2);
    EMPRESA_CONFIG.direcciones.forEach(function(dir, i){
      doc.text(dir, 10, footerY+6+(i*5));
    });

    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...C.white);
    doc.text(EMPRESA_CONFIG.web||'', pw/2, footerY+7, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
    doc.text((EMPRESA_CONFIG.tel||'') + '   |   ' + (EMPRESA_CONFIG.email||''), pw/2, footerY+12, {align:'center'});
    if(EMPRESA_CONFIG.banco) doc.text(EMPRESA_CONFIG.banco, pw/2, footerY+17, {align:'center'});


    // ── Guardar en storage (siempre sobreescribe) ─────────
    var vSuffix = 'v' + (c.version || 1);
    var fileName = (c.numero||'cotizacion') + '.' + vSuffix + '.pdf';
    try{
      var pdfBlob = doc.output('blob');
      var pdfPath = 'cotizaciones/' + id + '.pdf';
      await sb.storage.from('facturas').upload(pdfPath, pdfBlob, { upsert:true, contentType:'application/pdf' });
      await DB.cotizaciones.savePdfPath(id, pdfPath);
      var local = cotizaciones.find(function(x){return x.id===id;});
      if(local) local.pdf_path = pdfPath;
    }catch(storageErr){ console.warn('No se pudo guardar PDF en storage:', storageErr); }

    doc.save(fileName);
    showStatus('✓ PDF generado y guardado');
  }catch(e){
    console.error('PDF error:',e);
    showError('Error generando PDF: '+e.message);
  }
}

// ── View toggle ───────────────────────────────────────────
function toggleCotView(view){
  cotView = view;
  document.getElementById('btn-view-lista').classList.toggle('active', view==='lista');
  document.getElementById('btn-view-kanban').classList.toggle('active', view==='kanban');
  document.getElementById('cot-lista-wrap').style.display = view==='lista'?'block':'none';
  document.getElementById('cot-kanban-wrap').style.display = view==='kanban'?'block':'none';
  if(view==='kanban') renderKanban();
}

// ── Kanban ────────────────────────────────────────────────
var KANBAN_COLS = [
  {key:'borrador',     label:'Borrador',         icon:'📝'},
  {key:'enviada',      label:'Enviada',           icon:'📤'},
  {key:'en_negociacion',label:'En negociación',   icon:'💬'},
  {key:'cerrada',      label:'Cerrada ✓',         icon:'✅', limit90:true},
  {key:'perdida',      label:'Perdida',           icon:'❌', limit90:true}
];

// ── U6: Kanban touch/mobile support ──────────────────────
// Mueve una card entre columnas — funciona en touch Y desktop
async function kanbanMoveCard(e, cotId, fromEstatus, toEstatus){
  e.stopPropagation();
  if(fromEstatus===toEstatus) return;
  if(toEstatus==='cerrada'){
    await cambiarEstatusCot(cotId,'cerrada');
    return;
  }
  if(toEstatus==='perdida'){
    marcarPerdida(cotId);
    return;
  }
  try{
    await DB.cotizaciones.updateEstatus(cotId, toEstatus);
    showStatus('✓ Movida a '+EST_LABELS[toEstatus]);
    await loadCotizaciones();
    if(cotView==='kanban') renderKanban();
  }catch(err){showError('Error: '+err.message);}
}

function renderKanban(){
  var el = document.getElementById('cot-kanban-wrap');
  var hoy = new Date();
  var hace90 = new Date(hoy); hace90.setDate(hace90.getDate()-90);

  var board = document.createElement('div');
  board.className = 'kanban-board';

  KANBAN_COLS.forEach(function(col){
    var cards = allCotizaciones.filter(function(c){
      if(c.estatus !== col.key) return false;
      if(col.limit90){
        var d = new Date(c.created_at||c.fecha);
        if(d < hace90) return false;
      }
      return true;
    });
    var total = cards.reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
    var color = EST_COLORS[col.key]||'#475569';

    // Column container
    var colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.addEventListener('dragover', function(e){ e.preventDefault(); });
    colEl.addEventListener('drop', function(e){ kanbanDrop(e, col.key); });

    // Column header
    var colHdr = document.createElement('div');
    colHdr.className = 'kanban-col-hdr';
    colHdr.style.borderTop = '3px solid '+color;

    var colTitle = document.createElement('span');
    colTitle.textContent = col.icon+' '+col.label;

    var colMeta = document.createElement('div');
    colMeta.style.cssText = 'display:flex;gap:8px;align-items:center;';
    var colTotal = document.createElement('span');
    colTotal.style.cssText = 'font-size:10px;color:var(--text-3);';
    colTotal.textContent = fmt(total);
    var colCount = document.createElement('span');
    colCount.style.cssText = 'font-size:10px;background:'+color+'22;color:'+color+';padding:2px 7px;border-radius:10px;';
    colCount.textContent = cards.length;
    colMeta.appendChild(colTotal);
    colMeta.appendChild(colCount);
    colHdr.appendChild(colTitle);
    colHdr.appendChild(colMeta);

    // Cards container
    var cardsEl = document.createElement('div');
    cardsEl.className = 'kanban-cards';
    cardsEl.id = 'kcol-'+col.key;

    if(cards.length){
      var frag = document.createDocumentFragment();
      cards.forEach(function(c){ frag.appendChild(renderKanbanCard(c, col, hoy)); });
      cardsEl.appendChild(frag);
    } else {
      var empty = document.createElement('div');
      empty.style.cssText = 'color:var(--text-4);font-size:11px;text-align:center;padding:16px 0;';
      empty.textContent = 'Sin cotizaciones';
      cardsEl.appendChild(empty);
    }

    colEl.appendChild(colHdr);
    colEl.appendChild(cardsEl);
    board.appendChild(colEl);
  });

  el.innerHTML = '';
  el.appendChild(board);
}

// ── Drag & drop ───────────────────────────────────────────
var _dragId = null;
function kanbanDragStart(e, id){ _dragId = id; e.dataTransfer.effectAllowed='move'; }

async function kanbanDrop(e, newEstatus){
  e.preventDefault();
  if(!_dragId) return;
  var cot = allCotizaciones.find(function(c){return c.id===_dragId;});
  if(!cot || cot.estatus===newEstatus){ _dragId=null; return; }

  // Special handling for cerrada — triggers project creation
  if(newEstatus==='cerrada'){
    _dragId=null;
    await cambiarEstatusCot(cot.id,'cerrada');
    return;
  }
  // Special handling for perdida — show reason modal
  if(newEstatus==='perdida'){
    _dragId=null;
    marcarPerdida(cot.id);
    return;
  }
  try{
    await DB.cotizaciones.updateEstatus(cot.id, newEstatus);
    showStatus('✓ Movida a '+EST_LABELS[newEstatus]);
    // Reload from DB to ensure sync
    await loadCotizaciones();
    if(cotView==='kanban') renderKanban();
  }catch(err){ showError('Error: '+err.message); }
  _dragId=null;
}

// ESC closes cotizacion modal
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    var m=document.getElementById('cot-modal');
    if(m&&m.style.display==='block'){cerrarCotModal();return;}
    var m2=document.getElementById('conv-modal');
    if(m2&&m2.style.display==='block'){m2.style.display='none';return;}
  }
});
