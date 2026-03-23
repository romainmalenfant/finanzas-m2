// ── Banco BBVA Module ─────────────────────────────────────────────────────
// Parser Excel BBVA · Preview · Import · Conciliación

var _bancoPreviewData    = [];
var _bancoData           = [];
var _concMatches         = [];
var _rowsPendingImport   = [];

// ── Helpers de fecha ──────────────────────────────────────────────────────
function _parseFechaBBVA(v){
  if(!v) return null;
  // Ya es Date (cellDates:true)
  if(v instanceof Date){
    if(isNaN(v.getTime())) return null;
    return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  }
  var s=String(v).trim();
  // ISO: 2025-03-15
  var iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(iso) return iso[1]+'-'+iso[2].padStart(2,'0')+'-'+iso[3].padStart(2,'0');
  // DD/MM/YYYY o D/M/YYYY
  var dmy=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(dmy) return dmy[3]+'-'+dmy[2].padStart(2,'0')+'-'+dmy[1].padStart(2,'0');
  // YYYY/MM/DD
  var ymd=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(ymd) return ymd[1]+'-'+ymd[2].padStart(2,'0')+'-'+ymd[3].padStart(2,'0');
  return null;
}

// ── Parser ────────────────────────────────────────────────────────────────
function parseBBVAExcel(buf){
  var wb   = XLSX.read(buf,{type:'array',cellDates:true});
  var ws   = wb.Sheets[wb.SheetNames[0]];
  var rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  var movs = [];

  // Detectar fila de inicio: primera fila donde fecha es válida Y (cargo>0 O abono>0)
  var startRow = -1;
  for(var i=0;i<rows.length;i++){
    var r0=rows[i];
    var fechaTmp=_parseFechaBBVA(r0[0]);
    if(!fechaTmp) continue;
    var cargoTmp =parseFloat(String(r0[2]||'').replace(/[$,]/g,''))||0;
    var abonoTmp =parseFloat(String(r0[3]||'').replace(/[$,]/g,''))||0;
    if(cargoTmp>0||abonoTmp>0){startRow=i;break;}
  }
  if(startRow<0) return movs; // sin datos

  for(var i=startRow;i<rows.length;i++){
    var r        = rows[i];
    var fecha    = _parseFechaBBVA(r[0]);
    var concepto = String(r[1]||'').trim();
    var cargo    = parseFloat(String(r[2]||'').replace(/[$,]/g,''))||0;
    var abono    = parseFloat(String(r[3]||'').replace(/[$,]/g,''))||0;
    var saldo    = parseFloat(String(r[4]||'').replace(/[$,]/g,''))||0;
    if(!fecha||(!cargo&&!abono)) continue;
    movs.push({fecha:fecha,concepto:concepto,cargo:cargo,abono:abono,saldo:saldo});
  }

  // BBVA exporta más-reciente primero → invertir para orden cronológico
  movs.reverse();
  return movs;
}

// ── Categoría ─────────────────────────────────────────────────────────────
// esAbono: true = abono (ingreso), false = cargo (egreso)
function detectarCategoriaBanco(concepto, esAbono){
  var c=(concepto||'').toUpperCase();
  if(/\bMUTUO\b/.test(c))                                        return 'prestamo';
  if(/PRIMA VACACIONAL|DISPERSION NOMINA|PAGO NOMINA/.test(c))  return 'nomina';
  if(/\bIMSS\b|AFORE|\bINFONAVIT\b/.test(c))                    return 'obligacion_patronal';
  if(/\bSAT\b.*GUIA|SAT GUIA|PAGO SAT|PAGO.*\bSAT\b/.test(c)) return 'impuesto';
  // Default por tipo de movimiento
  return esAbono ? 'cliente' : 'proveedor';
}

var _catLabels={
  nomina:'Nómina',
  obligacion_patronal:'Obl. patronal',
  impuesto:'Impuesto',
  cliente:'Pago Cliente',
  proveedor:'Pago Proveedores',
  prestamo:'Préstamo'
};
var _catColors={
  nomina:'background:#fef9c3;color:#854d0e',
  obligacion_patronal:'background:#fee2e2;color:#991b1b',
  impuesto:'background:#fce7f3;color:#9d174d',
  cliente:'background:#d1fae5;color:#065f46',
  proveedor:'background:#e0e7ff;color:#3730a3',
  prestamo:'background:#ede9fe;color:#5b21b6'
};

// ── Import Entry Point ────────────────────────────────────────────────────
async function importarBBVAExcel(input){
  var files=Array.from(input.files||[]);
  if(!files.length) return;
  input.value='';
  if(!files[0].name.match(/\.(xlsx|xls)$/i)){showError('Solo archivos Excel (.xlsx)');return;}
  showStatus('Leyendo Excel BBVA…',0);
  try{
    var buf  = await readFileAsync(files[0]);
    var movs = parseBBVAExcel(buf);
    if(!movs.length){showError('No se encontraron movimientos');return;}
    _bancoPreviewData = movs;
    await mostrarPreviewBanco(movs,files[0].name);
    var sm=document.getElementById('status-msg');if(sm)sm.textContent='';
  }catch(e){console.error(e);showError('Error leyendo Excel: '+e.message);}
}

// ── Preview ───────────────────────────────────────────────────────────────
async function mostrarPreviewBanco(movs,fileName){
  var totalAbonos = movs.reduce(function(a,m){return a+m.abono;},0);
  var totalCargos = movs.reduce(function(a,m){return a+m.cargo;},0);
  // movs está en orden cronológico ascendente (oldest first)
  // Saldo final = último movimiento (más reciente)
  var lastMov     = movs[movs.length-1];
  var saldoFinal  = lastMov.saldo;
  // Saldo inicial = antes del primer movimiento (más antiguo)
  var firstMov    = movs[0];

  // Continuidad con mes anterior
  var continuityHtml='';
  try{
    var {data:last}=await sb.from('movimientos_v2').select('saldo,fecha')
      .in('origen',['banco_abono','banco_cargo'])
      .order('fecha',{ascending:false}).order('orden',{ascending:false}).limit(1).maybeSingle();
    if(last&&last.saldo!=null){
      var saldoAntes = firstMov.saldo+firstMov.cargo-firstMov.abono;
      var diff=Math.abs((parseFloat(last.saldo)||0)-saldoAntes);
      if(diff<=1){
        continuityHtml='<div style="background:#d1fae5;color:#065f46;border-radius:6px;padding:8px 12px;font-size:12px;margin-bottom:8px;">✓ Continuidad de saldo correcta · '+fmtDate(last.fecha)+' → '+fmtDate(firstMov.fecha)+'</div>';
      } else {
        continuityHtml='<div style="background:#fef3c7;color:#92400e;border-radius:6px;padding:8px 12px;font-size:12px;margin-bottom:8px;">⚠️ Saldo mes anterior: '+fmt(parseFloat(last.saldo))+' · Saldo previo a primer movimiento: '+fmt(saldoAntes)+' · Diferencia: '+fmt(diff)+'</div>';
      }
    }
  }catch(e){}

  // Conteo por categoría
  var catCount={};
  movs.forEach(function(m){var c=detectarCategoriaBanco(m.concepto,m.abono>0);catCount[c]=(catCount[c]||0)+1;});

  var summaryHtml=
    '<div style="background:var(--bg-card-2);border-radius:8px;padding:12px;margin-bottom:12px;">'+
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px;">'+
        '<div><div style="font-size:11px;color:var(--text-3);">Abonos</div><div style="font-size:16px;font-weight:700;color:#16a34a;">'+fmt(totalAbonos)+'</div></div>'+
        '<div><div style="font-size:11px;color:var(--text-3);">Cargos</div><div style="font-size:16px;font-weight:700;color:#dc2626;">'+fmt(totalCargos)+'</div></div>'+
        '<div><div style="font-size:11px;color:var(--text-3);">Saldo inicial</div><div style="font-size:14px;font-weight:600;">'+fmt(firstMov.saldo+firstMov.cargo-firstMov.abono)+'</div></div>'+
        '<div><div style="font-size:11px;color:var(--text-3);">Saldo final</div><div style="font-size:14px;font-weight:600;">'+fmt(saldoFinal)+'</div></div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--text-3);">'+movs.length+' movimientos · '+esc(fileName)+'</div>'+
    '</div>'+
    continuityHtml+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">'+
    Object.entries(catCount).map(function(e){
      return '<span style="'+(_catColors[e[0]]||'')+';border-radius:12px;padding:2px 10px;font-size:11px;">'+(_catLabels[e[0]]||e[0])+': '+e[1]+'</span>';
    }).join('')+'</div>';

  var rowsHtml='<div style="overflow-y:auto;max-height:340px;"><table class="sat-table"><thead><tr>'+
    '<th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cargo</th>'+
    '<th style="text-align:right;">Abono</th><th style="text-align:right;">Saldo</th><th>Categoría</th>'+
    '</tr></thead><tbody>'+
    movs.map(function(m){
      var cat=detectarCategoriaBanco(m.concepto,m.abono>0);
      return '<tr>'+
        '<td style="white-space:nowrap;">'+fmtDate(m.fecha)+'</td>'+
        '<td style="font-size:11px;max-width:260px;">'+esc(m.concepto.slice(0,80))+'</td>'+
        '<td style="text-align:right;color:#dc2626;">'+(m.cargo?fmt(m.cargo):'')+'</td>'+
        '<td style="text-align:right;color:#16a34a;">'+(m.abono?fmt(m.abono):'')+'</td>'+
        '<td style="text-align:right;">'+fmt(m.saldo)+'</td>'+
        '<td><span style="'+(_catColors[cat]||'')+';border-radius:8px;padding:1px 8px;font-size:10px;">'+(_catLabels[cat]||cat)+'</span></td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';

  var body =document.getElementById('sat-preview-body');
  var title=document.getElementById('sat-preview-title');
  if(title) title.textContent='Previa — Banco BBVA';
  if(body)  body.innerHTML=summaryHtml+rowsHtml;
  var btn=document.getElementById('btn-confirmar-sat');
  if(btn){btn.textContent='Importar';btn.onclick=confirmarImportBanco;}
  var modal=document.getElementById('sat-preview-modal');
  if(modal) modal.style.display='flex';
}

// ── Confirmar import ──────────────────────────────────────────────────────
function _buildBancoRows(movs){
  return movs.map(function(m,i){
    var esAbono=m.abono>0;
    var cat=detectarCategoriaBanco(m.concepto,esAbono);
    var monto=esAbono?m.abono:m.cargo;
    var safeKey=m.concepto.replace(/[^a-zA-Z0-9]/g,'').slice(0,10);
    return {
      id:'bbva_'+(esAbono?'a':'c')+'_'+m.fecha.replace(/-/g,'')+'_'+String(monto).replace(/\./g,'')+'_'+safeKey,
      fecha:m.fecha,
      descripcion:m.concepto,
      monto:monto,
      tipo:esAbono?'ingreso':'egreso',
      categoria:cat,
      origen:esAbono?'banco_abono':'banco_cargo',
      cargo:m.cargo||null,
      abono:m.abono||null,
      saldo:m.saldo,
      conciliado:['nomina','obligacion_patronal','impuesto'].includes(cat),
      year:parseInt(m.fecha.split('-')[0]),
      month:parseInt(m.fecha.split('-')[1]),
      orden:i,
      usuario:'banco_bbva'
    };
  });
}

async function confirmarImportBanco(){
  var btn=document.getElementById('btn-confirmar-sat');
  if(btn){btn.disabled=true;btn.textContent='Verificando…';}
  try{
    var allRows=_buildBancoRows(_bancoPreviewData);
    var ids=allRows.map(function(r){return r.id;});

    // Consultar cuáles IDs ya existen en BD
    var {data:existing,error:qErr}=await sb.from('movimientos_v2').select('id').in('id',ids);
    if(qErr) throw qErr;

    var existingSet=new Set((existing||[]).map(function(r){return r.id;}));
    var newRows=allRows.filter(function(r){return !existingSet.has(r.id);});
    var dupCount=allRows.length-newRows.length;

    if(dupCount===allRows.length){
      // Todo duplicado — no importar
      _mostrarAlertaDuplicados(allRows.length,0);
      return;
    }
    if(dupCount>0){
      // Algunos duplicados — pedir confirmación
      _rowsPendingImport=newRows;
      _mostrarAlertaDuplicados(dupCount,newRows.length);
      return;
    }
    // Sin duplicados — importar directo
    _rowsPendingImport=newRows;
    await _ejecutarImportBanco();
  }catch(e){showError('Error importando: '+e.message);}
  finally{if(btn){btn.disabled=false;btn.textContent='Importar';}}
}

function _mostrarAlertaDuplicados(dupCount,newCount){
  var body=document.getElementById('sat-preview-body');
  var btn=document.getElementById('btn-confirmar-sat');
  if(!body) return;

  if(newCount===0){
    // Todo duplicado
    body.insertAdjacentHTML('afterbegin',
      '<div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:12px 16px;margin-bottom:12px;border:1px solid #fcd34d;">'+
        '<div style="font-weight:700;margin-bottom:4px;">⚠️ Todos los movimientos ya están registrados</div>'+
        '<div style="font-size:12px;">'+dupCount+' movimiento'+(dupCount!==1?'s':'')+' ya exist'+(dupCount!==1?'en':'e')+' en la base de datos. No se importará nada.</div>'+
      '</div>');
    if(btn){btn.textContent='Cerrar';btn.disabled=false;btn.onclick=cerrarSATPreview;}
  } else {
    // Algunos duplicados
    body.insertAdjacentHTML('afterbegin',
      '<div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:12px 16px;margin-bottom:12px;border:1px solid #fcd34d;">'+
        '<div style="font-weight:700;margin-bottom:4px;">⚠️ '+dupCount+' movimiento'+(dupCount!==1?'s':'')+' duplicado'+(dupCount!==1?'s':'')+' detectado'+(dupCount!==1?'s':'')+' — se omitirán</div>'+
        '<div style="font-size:12px;">Se importarán únicamente los <strong>'+newCount+' nuevos</strong>. ¿Continuar?</div>'+
      '</div>');
    if(btn){
      btn.textContent='Importar '+newCount+' nuevos';
      btn.disabled=false;
      btn.onclick=function(){btn.disabled=true;btn.textContent='Importando…';_ejecutarImportBanco();};
    }
  }
}

async function _ejecutarImportBanco(){
  var btn=document.getElementById('btn-confirmar-sat');
  try{
    var rows=_rowsPendingImport;
    if(!rows||!rows.length){cerrarSATPreview();return;}
    var {error}=await sb.from('movimientos_v2').upsert(rows,{onConflict:'id',ignoreDuplicates:false});
    if(error) throw error;
    var cntA=rows.filter(function(r){return r.tipo==='ingreso';}).length;
    var cntC=rows.filter(function(r){return r.tipo==='egreso';}).length;
    cerrarSATPreview();
    showStatus('✓ '+rows.length+' movimientos BBVA importados ('+cntA+' abonos · '+cntC+' cargos)');
    _bancoPreviewData=[];
    _rowsPendingImport=[];
    loadBanco();
  }catch(e){
    showError('Error importando: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Importar';}
  }
}

// ── Load & KPIs ───────────────────────────────────────────────────────────
async function loadBanco(){
  try{
    var yearSel=document.getElementById('banco-year-sel');
    var año=parseInt((yearSel&&yearSel.value)||new Date().getFullYear());
    // Inicializar selector de mes si aún no tiene opciones
    var monthSel=document.getElementById('banco-month-sel');
    if(monthSel&&!monthSel.options.length){
      var allOpt=document.createElement('option');
      allOpt.value=0;allOpt.textContent='Todos los meses';
      monthSel.appendChild(allOpt);
      (typeof MONTHS!=='undefined'?MONTHS:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']).forEach(function(m,i){
        var o=document.createElement('option');
        o.value=i+1;o.textContent=m;
        monthSel.appendChild(o);
      });
    }
    var mes=monthSel?parseInt(monthSel.value||0):0;
    var q=sb.from('movimientos_v2').select('*').eq('year',año).in('origen',['banco_abono','banco_cargo']);
    if(mes>0)q=q.eq('month',mes);
    var {data,error}=await q.order('fecha',{ascending:false}).order('orden',{ascending:false});
    if(error) throw error;
    _bancoData=data||[];
    _renderBancoKPIs(_bancoData);
    _renderMovsBanco(_bancoData);
  }catch(e){console.error('loadBanco:',e);}
}

function _renderBancoKPIs(movs){
  var el=document.getElementById('banco-kpis');
  if(!el) return;
  var abonos=movs.reduce(function(a,m){return a+(parseFloat(m.abono)||0);},0);
  var cargos=movs.reduce(function(a,m){return a+(parseFloat(m.cargo)||0);},0);
  var saldo=movs.length?parseFloat(movs[0].saldo||0):0;
  var sinConc=movs.filter(function(m){return !m.conciliado;}).length;
  el.innerHTML=
    '<div class="mcard"><div class="mlabel">Saldo actual</div><div class="mvalue" style="color:#3b82f6;">'+fmt(saldo)+'</div></div>'+
    '<div class="mcard"><div class="mlabel">Abonos año</div><div class="mvalue c-green">'+fmt(abonos)+'</div></div>'+
    '<div class="mcard"><div class="mlabel">Cargos año</div><div class="mvalue c-red">'+fmt(cargos)+'</div></div>'+
    '<div class="mcard"><div class="mlabel">Sin conciliar</div><div class="mvalue c-amber">'+sinConc+'</div></div>';
}

// Public wrapper — called from index.html sort selector
function renderMovsBanco(){ _renderMovsBanco(_bancoData); }

// ── Categoría editable ────────────────────────────────────────────────────
var _catOpts=['nomina','obligacion_patronal','impuesto','cliente','proveedor','prestamo'];
var _catColorFallback='background:#e0e7ff;color:#3730a3';
function _catSelect(id, current){
  var style=_catColors[current]||_catColorFallback;
  return '<select onchange="_cambiarCategoria(\''+id+'\',this.value)" '+
    'style="font-size:10px;padding:1px 6px;border:0.5px solid var(--border);border-radius:8px;'+
    'background:'+style.split(';')[0].replace('background:','')+
    ';color:'+style.split(';')[1].replace('color:','')+
    ';font-family:inherit;cursor:pointer;">'+
    _catOpts.map(function(c){
      return '<option value="'+c+'"'+(c===current?' selected':'')+'>'+_catLabels[c]+'</option>';
    }).join('')+
  '</select>';
}
async function _cambiarCategoria(id, cat){
  try{
    await sb.from('movimientos_v2').update({categoria:cat}).eq('id',id);
    var mi=_bancoData.findIndex(function(m){return m.id===id;});
    if(mi>=0) _bancoData[mi].categoria=cat;
    _renderMovsBanco(_bancoData);
  }catch(e){showError('Error al cambiar categoría: '+e.message);}
}

function _renderMovsBanco(movs){
  var el=document.getElementById('banco-list');
  var ct=document.getElementById('banco-count');
  var sinConc=movs.filter(function(m){return !m.conciliado;}).length;
  if(ct) ct.textContent=movs.length+' movimiento'+(movs.length!==1?'s':'')+(sinConc?' · '+sinConc+' sin conciliar':'');
  if(!movs.length){if(el)el.innerHTML='<div class="empty-state">Sin movimientos. Sube el Excel BBVA mensual.</div>';return;}
  if(el) el.innerHTML='<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
    '<th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cargo</th>'+
    '<th style="text-align:right;">Abono</th><th style="text-align:right;">Saldo</th>'+
    '<th>Categoría</th><th>Estado</th></tr></thead><tbody>'+
    movs.map(function(m){
      var conc=m.conciliado;
      var cat=m.categoria||'otro';
      var estadoHtml=conc
        ? '<span style="color:#16a34a;font-size:11px;">✓ Conciliado</span>'
        : (cat==='nomina'||cat==='obligacion_patronal'||cat==='impuesto'||cat==='prestamo'
            ? '<span style="font-size:10px;color:var(--text-3);">Revisión manual</span>'
            : '<button class="btn-sm" onclick="abrirConciliacion(\''+m.id+'\')" style="padding:1px 8px;font-size:10px;color:#f59e0b;border-color:#f59e0b;">Conciliar</button>');
      return '<tr>'+
        '<td style="white-space:nowrap;">'+fmtDate(m.fecha)+'</td>'+
        '<td style="font-size:11px;max-width:280px;">'+esc((m.descripcion||'').slice(0,70))+'</td>'+
        '<td style="text-align:right;color:#dc2626;">'+(m.cargo?fmt(parseFloat(m.cargo)):'')+'</td>'+
        '<td style="text-align:right;color:#16a34a;">'+(m.abono?fmt(parseFloat(m.abono)):'')+'</td>'+
        '<td style="text-align:right;">'+fmt(parseFloat(m.saldo)||0)+'</td>'+
        '<td>'+_catSelect(m.id,cat)+'</td>'+
        '<td>'+estadoHtml+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
}

// ── Conciliación masiva ───────────────────────────────────────────────────
async function conciliarMes(){
  // Excluir categorías que no se concilian contra facturas (auto-aprobadas o préstamos)
  var _noConc={nomina:1,obligacion_patronal:1,impuesto:1,prestamo:1};
  var toMatch=_bancoData.filter(function(m){
    return !m.conciliado&&!_noConc[m.categoria||''];
  });
  if(!toMatch.length){showStatus('No hay movimientos pendientes de conciliar.');return;}
  showStatus('Buscando matches…',0);
  try{
    var {data:facts}=await sb.from('facturas').select('id,tipo,receptor_nombre,emisor_nombre,total,fecha')
      .eq('conciliado',false).neq('estatus','cancelada').in('efecto_sat',['Ingreso','ingreso']);
    var fl=facts||[];
    var matches=toMatch.map(function(m){
      var monto=parseFloat(m.abono||m.cargo)||0;
      var esAbono=(m.abono||0)>0;
      var candidatos=fl.filter(function(f){
        return f.tipo===(esAbono?'emitida':'recibida')&&Math.abs((parseFloat(f.total)||0)-monto)<=1.0;
      });
      return {mov:m,candidatos:candidatos};
    });
    var sm=document.getElementById('status-msg');if(sm)sm.textContent='';
    _mostrarModalConciliacion(matches);
  }catch(e){showError('Error: '+e.message);}
}

async function abrirConciliacion(movId){
  var m=_bancoData.find(function(x){return x.id===movId;});
  if(!m) return;
  var monto=parseFloat(m.abono||m.cargo)||0;
  var esAbono=(m.abono||0)>0;
  try{
    var {data:facts}=await sb.from('facturas').select('id,tipo,receptor_nombre,emisor_nombre,total,fecha')
      .eq('tipo',esAbono?'emitida':'recibida').eq('conciliado',false).neq('estatus','cancelada');
    var candidatos=(facts||[]).filter(function(f){return Math.abs((parseFloat(f.total)||0)-monto)<=1.0;});
    _mostrarModalConciliacion([{mov:m,candidatos:candidatos}]);
  }catch(e){showError('Error: '+e.message);}
}

function _mostrarModalConciliacion(matches){
  _concMatches=matches;
  var conSug=matches.filter(function(x){return x.candidatos.length>0;}).length;
  var sinSug=matches.filter(function(x){return x.candidatos.length===0;}).length;

  var html='<div style="font-size:12px;color:var(--text-3);margin-bottom:12px;">'+
    '<span style="color:#16a34a;font-weight:600;">'+conSug+' con sugerencia</span>'+
    ' · <span style="color:#f87171;">'+sinSug+' sin match exacto</span></div>'+
    matches.map(function(x,xi){
      var m=x.mov;
      var esAbono=(m.abono||0)>0;
      var monto=parseFloat(m.abono||m.cargo)||0;
      var tieneMatch=x.candidatos.length>0;
      // borde: verde si hay sugerencia, ámbar si no
      var cardBorder=tieneMatch?'border:1px solid #16a34a;':'border:1px solid #f59e0b;';
      var candidatosHtml=tieneMatch
        ? x.candidatos.map(function(f,fi){
            var nombre=(f.receptor_nombre||f.emisor_nombre||'—').slice(0,40);
            var diff=Math.abs((parseFloat(f.total)||0)-monto);
            return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:0.5px solid var(--border);border-radius:6px;cursor:pointer;margin-top:4px;">'+
              '<input type="radio" name="conc_'+xi+'" value="'+f.id+'" '+(fi===0?'checked':'')+'>'+
              '<div style="flex:1;font-size:11px;">'+esc(nombre)+'<span style="color:var(--text-3);"> · '+fmtDate(f.fecha)+'</span></div>'+
              '<div style="font-size:11px;font-weight:600;color:'+(esAbono?'#16a34a':'#dc2626')+';">'+fmt(parseFloat(f.total)||0)+
              (diff>0?'<span style="color:var(--text-3);font-weight:400;font-size:10px;"> Δ'+fmt(diff)+'</span>':'')+'</div>'+
            '</label>';
          }).join('')
        : '<div style="font-size:11px;color:#f59e0b;padding:6px 0;">Sin facturas con monto similar (±$1.00)</div>';
      return '<div style="'+cardBorder+'border-radius:8px;padding:10px 12px;margin-bottom:10px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">'+
          '<div><div style="font-size:11px;font-weight:600;">'+esc((m.descripcion||'').slice(0,65))+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(m.fecha)+'</div></div>'+
          '<div style="font-size:15px;font-weight:700;color:'+(esAbono?'#16a34a':'#dc2626')+';">'+fmt(monto)+'</div>'+
        '</div>'+
        candidatosHtml+
        '<div style="display:flex;gap:8px;margin-top:8px;">'+
        (tieneMatch
          ? '<button class="btn-sm" onclick="_confirmarConcMatch('+xi+')" style="font-size:11px;">✓ Confirmar match</button>'
          : '')+
        '<button class="btn-sm" onclick="_forzarConciliacion('+xi+')" style="font-size:11px;color:var(--text-3);border-color:var(--border);">Marcar conciliado sin factura</button>'+
        '</div>'+
      '</div>';
    }).join('');

  var body=document.getElementById('sat-preview-body');
  var title=document.getElementById('sat-preview-title');
  if(title) title.textContent='Conciliación bancaria';
  if(body)  body.innerHTML=html;
  var btn=document.getElementById('btn-confirmar-sat');
  if(btn){btn.textContent='Cerrar';btn.onclick=cerrarSATPreview;}
  var modal=document.getElementById('sat-preview-modal');
  if(modal) modal.style.display='flex';
}

async function _confirmarConcMatch(xi){
  var x=_concMatches[xi];if(!x)return;
  var radios=document.querySelectorAll('input[name="conc_'+xi+'"]');
  var factId=null;
  radios.forEach(function(r){if(r.checked)factId=r.value;});
  if(!factId)return;
  try{
    await sb.from('facturas').update({conciliado:true}).eq('id',factId);
    await sb.from('movimientos_v2').update({conciliado:true,factura_id:factId}).eq('id',x.mov.id);
    var mi=_bancoData.findIndex(function(m){return m.id===x.mov.id;});
    if(mi>=0){_bancoData[mi].conciliado=true;_bancoData[mi].factura_id=factId;}
    _concMatches.splice(xi,1);
    if(_concMatches.length){_mostrarModalConciliacion(_concMatches);}
    else{cerrarSATPreview();showStatus('✓ Conciliación completada');}
    _renderBancoKPIs(_bancoData);
    _renderMovsBanco(_bancoData);
  }catch(e){showError('Error: '+e.message);}
}

async function _forzarConciliacion(xi){
  var x=_concMatches[xi];if(!x)return;
  try{
    await sb.from('movimientos_v2').update({conciliado:true}).eq('id',x.mov.id);
    var mi=_bancoData.findIndex(function(m){return m.id===x.mov.id;});
    if(mi>=0){_bancoData[mi].conciliado=true;}
    _concMatches.splice(xi,1);
    if(_concMatches.length){_mostrarModalConciliacion(_concMatches);}
    else{cerrarSATPreview();showStatus('✓ Conciliación completada');}
    _renderBancoKPIs(_bancoData);
    _renderMovsBanco(_bancoData);
  }catch(e){showError('Error: '+e.message);}
}
