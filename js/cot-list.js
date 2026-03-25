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
