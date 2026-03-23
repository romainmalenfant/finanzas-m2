// ── Banco BBVA Module ─────────────────────────────────────────────────────
// Parser Excel BBVA · Preview · Import · Conciliación

var _bancoPreviewData = [];
var _bancoData        = [];
var _concMatches      = [];

// ── Parser ────────────────────────────────────────────────────────────────
function parseBBVAExcel(buf){
  var wb   = XLSX.read(buf,{type:'array',cellDates:true});
  var ws   = wb.Sheets[wb.SheetNames[0]];
  var rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  var movs = [];
  for(var i=2;i<rows.length;i++){
    var r        = rows[i];
    var fechaRaw = r[0];  // col B = index 0 (sheet starts at col B)
    var concepto = String(r[1]||'').trim();
    var cargo    = parseFloat(String(r[2]||'').replace(/[$,]/g,''))||0;
    var abono    = parseFloat(String(r[3]||'').replace(/[$,]/g,''))||0;
    var saldo    = parseFloat(String(r[4]||'').replace(/[$,]/g,''))||0;
    if(!fechaRaw&&!concepto) continue;
    var fecha;
    if(fechaRaw instanceof Date){
      var d=fechaRaw;
      fecha=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    } else {
      var pts=String(fechaRaw).split('/');
      if(pts.length===3) fecha=pts[2].trim()+'-'+pts[1].trim().padStart(2,'0')+'-'+pts[0].trim().padStart(2,'0');
    }
    if(!fecha||(!cargo&&!abono)) continue;
    movs.push({fecha:fecha,concepto:concepto,cargo:cargo,abono:abono,saldo:saldo});
  }
  return movs;
}

// ── Categoría ─────────────────────────────────────────────────────────────
function detectarCategoriaBanco(concepto){
  var c=(concepto||'').toUpperCase();
  if(/PRIMA VACACIONAL|DISPERSION NOMINA|PAGO NOMINA|FINIQUITO/.test(c)) return 'nomina';
  if(/\bIMSS\b|AFORE|\bINFONAVIT\b/.test(c))                             return 'obligacion_patronal';
  if(/SAT\/GUIA|SAT GUIA|PAGO SAT|KONFIO/.test(c))                       return 'impuesto';
  if(/DEPOSITO DE TERCERO|SPEI RECIBIDO/.test(c))                        return 'cliente';
  return 'otro';
}

var _catLabels={
  nomina:'Nómina',obligacion_patronal:'Obl. patronal',
  impuesto:'Impuesto',cliente:'Cliente',otro:'Por conciliar'
};
var _catColors={
  nomina:'background:#fef9c3;color:#854d0e',
  obligacion_patronal:'background:#fee2e2;color:#991b1b',
  impuesto:'background:#fce7f3;color:#9d174d',
  cliente:'background:#d1fae5;color:#065f46',
  otro:'background:#e0e7ff;color:#3730a3'
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
  var saldoFinal  = movs[0].saldo;          // más reciente (orden desc)
  var firstMov    = movs[movs.length-1];    // más antiguo = primera transacción

  // Continuidad con mes anterior
  var continuityHtml='';
  try{
    var {data:last}=await sb.from('movimientos_banco').select('saldo,fecha')
      .order('fecha',{ascending:false}).limit(1).maybeSingle();
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
  movs.forEach(function(m){var c=detectarCategoriaBanco(m.concepto);catCount[c]=(catCount[c]||0)+1;});

  var summaryHtml=
    '<div style="background:var(--bg-card-2);border-radius:8px;padding:12px;margin-bottom:12px;">'+
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px;">'+
        '<div><div style="font-size:11px;color:var(--text-3);">Abonos</div><div style="font-size:16px;font-weight:700;color:#16a34a;">'+fmt(totalAbonos)+'</div></div>'+
        '<div><div style="font-size:11px;color:var(--text-3);">Cargos</div><div style="font-size:16px;font-weight:700;color:#dc2626;">'+fmt(totalCargos)+'</div></div>'+
        '<div><div style="font-size:11px;color:var(--text-3);">Saldo inicial</div><div style="font-size:14px;font-weight:600;">'+fmt(firstMov.saldo)+'</div></div>'+
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
      var cat=detectarCategoriaBanco(m.concepto);
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
async function confirmarImportBanco(){
  var btn=document.getElementById('btn-confirmar-sat');
  if(btn){btn.disabled=true;btn.textContent='Importando…';}
  try{
    var rows=_bancoPreviewData.map(function(m){
      var esAbono=m.abono>0;
      var cat=detectarCategoriaBanco(m.concepto);
      var monto=esAbono?m.abono:m.cargo;
      var safeKey=m.concepto.replace(/[^a-zA-Z0-9]/g,'').slice(0,10);
      return {
        id:'bbva_'+(esAbono?'a':'c')+'_'+m.fecha.replace(/-/g,'')+'_'+String(monto).replace(/\./g,'')+'_'+safeKey,
        fecha:m.fecha, descripcion:m.concepto,
        cargo:m.cargo||null, abono:m.abono||null, saldo:m.saldo,
        categoria:cat,
        conciliado:['nomina','obligacion_patronal','impuesto'].includes(cat),
        tipo:esAbono?'abono':'cargo',
        year:parseInt(m.fecha.split('-')[0]),
        month:parseInt(m.fecha.split('-')[1])
      };
    });
    var {error}=await sb.from('movimientos_banco').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
    if(error) throw error;
    var cntA=rows.filter(function(r){return r.tipo==='abono';}).length;
    var cntC=rows.filter(function(r){return r.tipo==='cargo';}).length;
    cerrarSATPreview();
    showStatus('✓ '+rows.length+' movimientos BBVA importados ('+cntA+' abonos · '+cntC+' cargos)');
    _bancoPreviewData=[];
    loadBanco();
  }catch(e){showError('Error importando: '+e.message);}
  finally{if(btn){btn.disabled=false;btn.textContent='Importar';}}
}

// ── Load & KPIs ───────────────────────────────────────────────────────────
async function loadBanco(){
  try{
    var yearSel=document.getElementById('banco-year-sel');
    var año=parseInt((yearSel&&yearSel.value)||new Date().getFullYear());
    var {data,error}=await sb.from('movimientos_banco').select('*').eq('year',año).order('fecha',{ascending:false});
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
        : (cat==='nomina'||cat==='obligacion_patronal'||cat==='impuesto'
            ? '<span style="font-size:10px;color:var(--text-3);">Revisión manual</span>'
            : '<button class="btn-sm" onclick="abrirConciliacion(\''+m.id+'\')" style="padding:1px 8px;font-size:10px;color:#f59e0b;border-color:#f59e0b;">Conciliar</button>');
      return '<tr>'+
        '<td style="white-space:nowrap;">'+fmtDate(m.fecha)+'</td>'+
        '<td style="font-size:11px;max-width:280px;">'+esc((m.descripcion||'').slice(0,70))+'</td>'+
        '<td style="text-align:right;color:#dc2626;">'+(m.cargo?fmt(parseFloat(m.cargo)):'')+'</td>'+
        '<td style="text-align:right;color:#16a34a;">'+(m.abono?fmt(parseFloat(m.abono)):'')+'</td>'+
        '<td style="text-align:right;">'+fmt(parseFloat(m.saldo)||0)+'</td>'+
        '<td><span style="'+(_catColors[cat]||'')+';border-radius:8px;padding:1px 8px;font-size:10px;">'+(_catLabels[cat]||cat)+'</span></td>'+
        '<td>'+estadoHtml+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
}

// ── Conciliación masiva ───────────────────────────────────────────────────
async function conciliarMes(){
  var toMatch=_bancoData.filter(function(m){
    return !m.conciliado&&(m.categoria==='cliente'||m.categoria==='otro'||!m.categoria);
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
    conSug+' con sugerencia · '+sinSug+' sin match exacto</div>'+
    matches.map(function(x,xi){
      var m=x.mov;
      var esAbono=(m.abono||0)>0;
      var monto=parseFloat(m.abono||m.cargo)||0;
      var candidatosHtml=x.candidatos.length
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
        : '<div style="font-size:11px;color:var(--text-3);padding:6px 0;">Sin facturas con monto similar (±$1.00)</div>';
      return '<div style="border:0.5px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">'+
          '<div><div style="font-size:11px;font-weight:600;">'+esc((m.descripcion||'').slice(0,65))+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(m.fecha)+'</div></div>'+
          '<div style="font-size:15px;font-weight:700;color:'+(esAbono?'#16a34a':'#dc2626')+';">'+fmt(monto)+'</div>'+
        '</div>'+
        candidatosHtml+
        (x.candidatos.length
          ? '<button class="btn-sm" onclick="_confirmarConcMatch('+xi+')" style="margin-top:8px;font-size:11px;">✓ Confirmar match</button>'
          : '')+
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
    await sb.from('movimientos_banco').update({conciliado:true,factura_id:factId}).eq('id',x.mov.id);
    // Update in memory
    var mi=_bancoData.findIndex(function(m){return m.id===x.mov.id;});
    if(mi>=0){_bancoData[mi].conciliado=true;_bancoData[mi].factura_id=factId;}
    _concMatches.splice(xi,1);
    // Re-render modal
    if(_concMatches.length){
      _mostrarModalConciliacion(_concMatches);
    } else {
      cerrarSATPreview();
      showStatus('✓ Conciliación completada');
    }
    _renderBancoKPIs(_bancoData);
    _renderMovsBanco(_bancoData);
  }catch(e){showError('Error: '+e.message);}
}
