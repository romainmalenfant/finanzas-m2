// ── Manejo del PDF ───────────────────────────────────────
// [T7] pdfMovimientos → M2State alias en config.js

async function handlePDF(input){
  var file=input.files[0];
  if(!file)return;
  input.value='';

  // T5 — límite de tamaño: PDFs > 10MB probablemente no son facturas SAT
  var MAX_MB=10;
  if(file.size > MAX_MB*1024*1024){
    showError('El archivo pesa más de '+MAX_MB+'MB. Solo se aceptan facturas SAT (PDF ligeros).');
    return;
  }

  var userName=getUserName();
  if(!userName){
    var n=prompt('¿Cuál es tu nombre?');
    if(!n||!n.trim())return;
    saveName(n.trim());
    document.getElementById('user-name-input').value=n.trim();
  }
  showStatus('Leyendo PDF...',0);
  try{
    var arrayBuffer=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
    var textoTotal='';
    for(var i=1;i<=pdf.numPages;i++){
      var page=await pdf.getPage(i);
      var content=await page.getTextContent();
      textoTotal+=content.items.map(function(s){return s.str;}).join(' ')+'\n';
    }
    var detectados=extraerMovimientosDePDF(textoTotal,file.name);
    if(!detectados.length){showStatus('No se detectaron movimientos en el PDF.',3000);return;}
    // Marcar duplicados
    detectados.forEach(function(d){
      d.dup=findDuplicate(d.monto,d.fecha,d.categoria);
      d.incluir=!d.dup; // por default excluir si hay duplicado
      d.id='pdf_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
    });
    pdfMovimientos=detectados;
    mostrarModalPDF(file.name,detectados);
    var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
  }catch(e){
    console.error(e);
    showError('Error al leer PDF: '+e.message);
    var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
  }
}

function mostrarModalPDF(fileName, detectados){
  var total=detectados.length;
  var dups=detectados.filter(function(d){return d.dup;}).length;
  document.getElementById('pdf-modal-title').textContent=total+' movimiento'+(total!==1?'s':'')+' detectados en "'+fileName+'"';
  document.getElementById('pdf-modal-sub').textContent=(dups?dups+' posible'+(dups!==1?'s duplicados':'duplicado')+' marcado'+(dups!==1?'s':'')+' · ':'')+' Revisa y confirma cuáles guardar';
  var lista=document.getElementById('pdf-preview-list');
  lista.innerHTML=detectados.map(function(d,i){
    var color=CAT_COLORS[d.categoria]||'#888';
    var signo=d.categoria==='gasto'?'−':'+';
    var dupHTML='';
    if(d.dup){
      dupHTML='<div class="dup-banner">⚠️ Posible duplicado: ya existe "'+esc(d.dup.descripcion.slice(0,50))+'" por '+fmt(d.dup.monto)+' del '+fmtDate(d.dup.fecha)+'<div class="dup-actions"><button class="dup-btn '+(d.incluir?'':'active')+'" onclick="setPDFDup('+i+',false)">Es el mismo — no importar</button><button class="dup-btn '+(d.incluir?'active':'')+'" onclick="setPDFDup('+i+',true)">Es diferente — sí importar</button></div></div>';
    }
    return '<div class="preview-item'+(d.dup?' duplicate':'')+(d.incluir?'':' excluded')+'" id="pitem_'+i+'">'+
      dupHTML+
      '<div class="preview-row">'+
        '<input type="checkbox" class="preview-check" '+(d.incluir?'checked':'')+' onchange="togglePDFItem('+i+',this.checked)">'+
        '<div class="preview-info">'+
          '<div class="preview-desc">'+esc(d.descripcion)+'</div>'+
          '<div class="preview-meta">'+
            '<span class="badge '+(CAT_BADGE[d.categoria]||'bg')+'">'+CAT_LABELS[d.categoria]+'</span>'+
            (d.contraparte?'<span>'+esc(d.contraparte)+'</span>':'')+
            '<span>'+fmtDate(d.fecha)+'</span>'+
            (d.ref?'<span>Ref: '+esc(d.ref)+'</span>':'')+
          '</div>'+
        '</div>'+
        '<div class="preview-amount" style="color:'+color+'">'+signo+fmt(d.monto)+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('pdf-modal').style.display='block';
}

function togglePDFItem(i, checked){
  pdfMovimientos[i].incluir=checked;
  var el=document.getElementById('pitem_'+i);
  if(checked)el.classList.remove('excluded'); else el.classList.add('excluded');
}

function setPDFDup(i, incluir){
  pdfMovimientos[i].incluir=incluir;
  var el=document.getElementById('pitem_'+i);
  if(incluir)el.classList.remove('excluded'); else el.classList.add('excluded');
  var btns=el.querySelectorAll('.dup-btn');
  btns[0].classList.toggle('active',!incluir);
  btns[1].classList.toggle('active',incluir);
  var chk=el.querySelector('.preview-check');
  if(chk)chk.checked=incluir;
}

function closePDFModal(){
  document.getElementById('pdf-modal').style.display='none';
  pdfMovimientos=[];
}

async function confirmPDFImport(){
  var userName=getUserName();
  var aGuardar=pdfMovimientos.filter(function(d){return d.incluir;});
  if(!aGuardar.length){closePDFModal();return;}
  var btn=document.getElementById('btn-confirm-pdf');
  btn.disabled=true;
  btn.textContent='Guardando...';
  var ok=0;
  for(var i=0;i<aGuardar.length;i++){
    var d=aGuardar[i];
    var fechaBase=new Date(d.fecha+'T12:00');
    var mv={
      id:Date.now().toString()+Math.random().toString(36).slice(2,7),
      fecha:d.fecha, raw_text:d.raw_text,
      descripcion:d.descripcion, contraparte:d.contraparte||'',
      monto:d.monto, categoria:d.categoria,
      year:fechaBase.getFullYear(), month:fechaBase.getMonth()+1,
      usuario:userName
    };
    try{await insertMovement(mv);ok++;}catch(e){console.error('Error guardando:',e);}
  }
  closePDFModal();
  showStatus('✓ '+ok+' movimiento'+(ok!==1?'s':'')+' importados del PDF');
  await loadMovements();
  btn.disabled=false;
  btn.textContent='Guardar seleccionados';
}

// ── SAT & Banco Module ───────────────────────────────────
// [T7] satPending* → M2State aliases en config.js

function initSATTab(){
  var mesEl=document.getElementById('sat-mes-sel');
  var añoEl=document.getElementById('sat-año-sel');
  if(!mesEl.options.length){
    MONTHS.forEach(function(m,i){
      var o=document.createElement('option');
      o.value=i+1; o.textContent=m;
      if(i===curMonth)o.selected=true;
      mesEl.appendChild(o);
    });
    for(var y=curYear-3;y<=curYear+1;y++){
      var o=document.createElement('option');
      o.value=y; o.textContent=y;
      if(y===curYear)o.selected=true;
      añoEl.appendChild(o);
    }
  }
  loadSATData();
}

async function loadSATData(){
  var mes=parseInt(document.getElementById('sat-mes-sel').value)||curMonth+1;
  var año=parseInt(document.getElementById('sat-año-sel').value)||curYear;
  document.getElementById('sat-periodo').textContent=MONTHS[mes-1]+' '+año;

  try{
    // ── KPIs del período seleccionado (resumen mensual) ──
    var {data:kpiData}=await sb.from('movimientos_v2').select('origen,monto,conciliado')
      .eq('year',año).eq('month',mes)
      .in('origen',['sat_emitida','sat_recibida','banco_abono','banco_cargo']);
    var kpi=kpiData||[];
    var totalEmitido=kpi.filter(function(m){return m.origen==='sat_emitida';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var totalRecibido=kpi.filter(function(m){return m.origen==='sat_recibida';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var totalAbonos=kpi.filter(function(m){return m.origen==='banco_abono';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    document.getElementById('sat-emitido').textContent=fmt(totalEmitido);
    document.getElementById('sat-cobrado').textContent=fmt(totalAbonos);
    document.getElementById('sat-recibido').textContent=fmt(totalRecibido);

    // ── Listas atemporales — todo lo pendiente sin filtro de mes ──
    var [{data:emitidas},{data:banco},{data:recibidas}] = await Promise.all([
      // Facturas emitidas: todas las pendientes de pago
      sb.from('facturas')
        .select('id,uuid_sat,numero_factura,fecha,total,monto_pagado,estatus_pago,receptor_nombre,receptor_rfc,cliente_id,conciliado,estatus')
        .eq('tipo','emitida').neq('estatus','cancelada')
        .order('fecha',{ascending:false}).limit(200),
      // Abonos bancarios: todos (vinculados y sin vincular)
      sb.from('movimientos_v2')
        .select('*').eq('origen','banco_abono')
        .order('fecha',{ascending:false}).limit(200),
      // Facturas recibidas: todas
      sb.from('facturas')
        .select('id,uuid_sat,numero_factura,fecha,total,monto_pagado,estatus_pago,emisor_nombre,emisor_rfc,proveedor_id,conciliado,estatus')
        .eq('tipo','recibida').neq('estatus','cancelada')
        .order('fecha',{ascending:false}).limit(200)
    ]);

    // Por cobrar = suma de facturas emitidas no pagadas
    var porCobrar=(emitidas||[])
      .filter(function(f){return f.estatus_pago!=='pagada';})
      .reduce(function(a,f){return a+((parseFloat(f.total)||0)-(parseFloat(f.monto_pagado)||0));},0);
    document.getElementById('sat-por-cobrar').textContent=fmt(porCobrar);

    renderFacturasEmitidas(emitidas||[]);
    renderMovsBanco(banco||[]);
    renderFacturasRecibidas(recibidas||[]);
    loadCartera();
  }catch(e){showError('Error cargando SAT: '+e.message);}
}

function renderFacturasEmitidas(list){
  if(list)lastEmitidas=list;
  var sortKey=(document.getElementById('emit-sort')||{}).value||'fecha_asc';
  var sorted=sortList(lastEmitidas,sortKey);
  var el=document.getElementById('emit-list');
  var ct=document.getElementById('emit-count');
  ct.textContent=sorted.length+' factura'+(sorted.length!==1?'s':'');
  if(!sorted.length){el.innerHTML='<div class="empty-state">Sin facturas emitidas importadas</div>';return;}
  el.innerHTML='<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
    '<th>Cliente / RFC</th><th>No. Factura</th><th>Fecha</th><th style="text-align:right;">Total</th><th style="text-align:right;">Pagado</th><th>Estado</th>'+
    '</tr></thead><tbody>'+
    sorted.map(function(f){
      var estPago=f.estatus_pago||'pendiente';
      var montoPagado=parseFloat(f.monto_pagado)||0;
      var total=parseFloat(f.total)||0;
      var numFac=f.numero_factura||'—';
      var badgeBg=estPago==='pagada'?'#dbeafe':estPago==='parcial'?'#fef3c7':'#dcfce7';
      var badgeColor=estPago==='pagada'?'#1d4ed8':estPago==='parcial'?'#d97706':'#16a34a';
      var badgeLabel=estPago==='pagada'?'Pagada':estPago==='parcial'?'Parcial':'Pendiente';
      return '<tr style="cursor:pointer;" onclick="abrirConciliacionIndividual(\''+f.id+'\')" >'+
        '<td><div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc((f.receptor_nombre||f.receptor_rfc||'-').slice(0,40))+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+esc(f.receptor_rfc||'')+'</div></td>'+
        '<td class="muted">'+esc(numFac)+'</td>'+
        '<td class="muted">'+fmtDate(f.fecha)+'</td>'+
        '<td class="monto" style="color:#16a34a;">'+fmt(total)+'</td>'+
        '<td class="monto" style="color:'+(montoPagado>0?'#1d4ed8':'#94a3b8')+';">'+fmt(montoPagado)+'</td>'+
        '<td><span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;background:'+badgeBg+';color:'+badgeColor+';">'+badgeLabel+'</span></td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
}

function renderMovsBanco(list){
  if(list)lastBanco=list;
  var sortKey=(document.getElementById('banco-sort')||{}).value||'fecha_desc';
  var sorted=sortList(lastBanco,sortKey);
  var el=document.getElementById('banco-list');
  var ct=document.getElementById('banco-count');
  // Count unlinked abonos
  var sinVincular=sorted.filter(function(m){return m.origen==='banco_abono'&&!m.conciliado;}).length;
  ct.textContent=sorted.length+' movimiento'+(sorted.length!==1?'s':'')+(sinVincular?' · '+sinVincular+' sin vincular':'');
  if(!sorted.length){el.innerHTML='<div class="empty-state">Sin movimientos bancarios importados</div>';return;}
  el.innerHTML='<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
    '<th>Fecha</th><th>Descripción</th><th style="text-align:right;">Importe</th><th>Tipo</th><th>Vínculo</th>'+
    '</tr></thead><tbody>'+
    sorted.map(function(m){
      var esAbono=m.origen==='banco_abono';
      var vinculado=m.conciliado;
      var vinculoBadge=!esAbono?'':
        vinculado
          ?'<span style="padding:2px 8px;border-radius:5px;font-size:11px;background:#dbeafe;color:#1d4ed8;">Vinculado</span>'
          :'<span style="padding:2px 8px;border-radius:5px;font-size:11px;background:#fef3c7;color:#d97706;cursor:pointer;" onclick="abrirConciliacionPago(\\'+esc(m.id)+'\')" >Vincular →</span>';
      return '<tr>'+
        '<td class="muted">'+fmtDate(m.fecha)+'</td>'+
        '<td style="font-size:12px;color:var(--text-1);">'+esc((m.descripcion||'-').slice(0,55))+'</td>'+
        '<td class="monto" style="color:'+(esAbono?'#16a34a':'#dc2626')+';">'+(esAbono?'+':'−')+fmt(parseFloat(m.monto)||0)+'</td>'+
        '<td><span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;background:'+(esAbono?'#dcfce7':'#fee2e2')+';color:'+(esAbono?'#16a34a':'#dc2626')+';">'+(esAbono?'Abono':'Cargo')+'</span></td>'+
        '<td>'+vinculoBadge+'</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
}

function renderFacturasRecibidas(list){
  if(list)lastRecibidas=list;
  var sortKey=(document.getElementById('recib-sort')||{}).value||'fecha_asc';
  var sorted=sortList(lastRecibidas,sortKey);
  var el=document.getElementById('recib-list');
  var ct=document.getElementById('recib-count');
  ct.textContent=sorted.length+' factura'+(sorted.length!==1?'s':'');
  if(!sorted.length){el.innerHTML='<div class="empty-state">Sin facturas recibidas</div>';return;}
  el.innerHTML='<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
    '<th>Proveedor / RFC</th><th>No. Factura</th><th>Fecha</th><th style="text-align:right;">Total</th><th>Estado</th>'+
    '</tr></thead><tbody>'+
    sorted.map(function(f){
      var estPago=f.estatus_pago||'pendiente';
      var badgeBg=estPago==='pagada'?'#dbeafe':estPago==='parcial'?'#fef3c7':'#fef3c7';
      var badgeColor=estPago==='pagada'?'#1d4ed8':estPago==='parcial'?'#d97706':'#d97706';
      var badgeLabel=estPago==='pagada'?'Pagada':estPago==='parcial'?'Parcial':'Vigente';
      return '<tr>'+
        '<td><div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc((f.emisor_nombre||f.emisor_rfc||'-').slice(0,40))+'</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+esc(f.emisor_rfc||'')+'</div></td>'+
        '<td class="muted">'+esc(f.numero_factura||'—')+'</td>'+
        '<td class="muted">'+fmtDate(f.fecha)+'</td>'+
        '<td class="monto" style="color:#dc2626;">'+fmt(parseFloat(f.total)||0)+'</td>'+
        '<td><span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;background:'+badgeBg+';color:'+badgeColor+';">'+badgeLabel+'</span></td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
}

// ── SAT Excel Import ──────────────────────────────────────
function parsearExcelSAT(buf,fileName){
  var emitidas=[],recibidas=[];
  try{
    var wb=XLSX.read(buf,{type:'array'});
    if(wb.SheetNames.includes('Hoja2')){
      var ws=wb.Sheets['Hoja2'];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      var colUUID=-1,colRFC=-1,colNombre=-1,colFecha=-1,colTotal=-1,colEfecto=-1,colEstado=-1,dataStart=2;
      for(var hi=0;hi<Math.min(rows.length,5);hi++){
        var idx=rows[hi].indexOf('Folio Fiscal');
        if(idx>=0){colUUID=idx;colRFC=rows[hi].indexOf('RFC Receptor');colNombre=rows[hi].indexOf('Nombre o Razón Social del Receptor');colFecha=rows[hi].indexOf('Fecha de Emisión');colTotal=rows[hi].indexOf('Total');colEfecto=rows[hi].indexOf('Efecto del Comprobante');colEstado=rows[hi].indexOf('Estado del Comprobante');dataStart=hi+1;break;}
      }
      if(colUUID<0){colUUID=0;colRFC=1;colNombre=2;colFecha=6;colTotal=5;colEfecto=4;colEstado=9;dataStart=2;}
      for(var i=dataStart;i<rows.length;i++){
        var r=rows[i];var uuid=r[colUUID];
        if(!uuid||String(uuid).length<10)continue;
        var total=parseFloat(String(r[colTotal]||'').replace(/,/g,''))||0;
        if(total<=0)continue;
        var fecha=r[colFecha]?String(r[colFecha]).split('T')[0]:'';
        if(!fecha)continue;
        var d=new Date(fecha+'T12:00');
        emitidas.push({uuid:String(uuid),rfc_receptor:String(r[colRFC]||''),nombre_receptor:String(r[colNombre]||''),fecha_emision:fecha,total:total,efecto:String(r[colEfecto]||'Ingreso'),estado:String(r[colEstado]||'Vigente'),year:d.getFullYear(),month:d.getMonth()+1,conciliada:false});
      }
    }
    var hRecib=wb.SheetNames.find(function(s){return s.toUpperCase().includes('RECIB');});
    if(hRecib){
      var ws2=wb.Sheets[hRecib];
      var rows2=XLSX.utils.sheet_to_json(ws2,{header:1,defval:''});
      var c2UUID=-1,c2RFCEm=-1,c2NomEm=-1,c2Fecha=-1,c2Total=-1,c2Efecto=-1,c2Estado=-1,hIdx=1;
      for(var hi2=0;hi2<Math.min(rows2.length,5);hi2++){
        var idx2=rows2[hi2].indexOf('Folio Fiscal');
        if(idx2>=0){c2UUID=idx2;c2RFCEm=rows2[hi2].indexOf('RFC Emisor');c2NomEm=rows2[hi2].indexOf('Nombre o Razón Social del Emisor');c2Fecha=rows2[hi2].indexOf('Fecha de Emisión');c2Total=rows2[hi2].indexOf('Total');c2Efecto=rows2[hi2].indexOf('Efecto del Comprobante');c2Estado=rows2[hi2].indexOf('Estado del Comprobante');hIdx=hi2;break;}
      }
      if(c2UUID<0){c2UUID=8;c2RFCEm=9;c2NomEm=10;c2Fecha=13;c2Total=16;c2Efecto=17;c2Estado=19;hIdx=1;}
      for(var j=hIdx+1;j<rows2.length;j++){
        var r2=rows2[j];var uuid2=r2[c2UUID];
        if(!uuid2||String(uuid2).length<10)continue;
        var total2=parseFloat(String(r2[c2Total]||'').replace(/,/g,''))||0;
        if(total2<=0)continue;
        var fecha2=r2[c2Fecha]?String(r2[c2Fecha]).split('T')[0]:'';
        if(!fecha2)continue;
        var d2=new Date(fecha2+'T12:00');
        recibidas.push({uuid:String(uuid2),rfc_emisor:String(r2[c2RFCEm]||''),nombre_emisor:String(r2[c2NomEm]||''),fecha_emision:fecha2,total:total2,efecto:String(r2[c2Efecto]||'Ingreso'),estado:String(r2[c2Estado]||'Vigente'),year:d2.getFullYear(),month:d2.getMonth()+1,conciliada:false});
      }
    }
  }catch(e){console.error('Error parsing SAT Excel:',e);}
  return{emitidas:emitidas,recibidas:recibidas};
}

function procesarExcelSAT(buf,fileName){
  try{
    var result=parsearExcelSAT(buf,fileName);
    if(!result.emitidas.length&&!result.recibidas.length){showError('No se encontraron facturas en el archivo.');return;}
    satPendingEmitidas=result.emitidas;
    satPendingRecibidas=result.recibidas;
    mostrarPreviewSAT(result.emitidas,result.recibidas);
    var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
  }catch(e){showError('Error al leer el Excel: '+e.message);}
}

async function importarSATMultiple(input){
  var files=Array.from(input.files||[]);
  if(!files.length)return;
  input.value='';
  showStatus('Leyendo '+files.length+' archivo'+(files.length>1?'s':'')+' SAT...',0);
  var allEmitidas=[],allRecibidas=[];
  for(var i=0;i<files.length;i++){
    var buf=await readFileAsync(files[i]);
    var result=parsearExcelSAT(buf,files[i].name);
    allEmitidas=allEmitidas.concat(result.emitidas);
    allRecibidas=allRecibidas.concat(result.recibidas);
  }
  var uuidsE=new Set(),uuidsR=new Set();
  allEmitidas=allEmitidas.filter(function(f){if(uuidsE.has(f.uuid))return false;uuidsE.add(f.uuid);return true;});
  allRecibidas=allRecibidas.filter(function(f){if(uuidsR.has(f.uuid))return false;uuidsR.add(f.uuid);return true;});
  if(!allEmitidas.length&&!allRecibidas.length){showError('No se encontraron facturas.');return;}
  satPendingEmitidas=allEmitidas;
  satPendingRecibidas=allRecibidas;
  mostrarPreviewSAT(allEmitidas,allRecibidas);
  var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
}

function readFileAsync(file){
  return new Promise(function(resolve,reject){
    var r=new FileReader();
    r.onload=function(e){resolve(e.target.result);};
    r.onerror=reject;
    r.readAsArrayBuffer(file);
  });
}

function mostrarPreviewSAT(emitidas,recibidas){
  var meses={};
  emitidas.forEach(function(f){var k=f.year+'-'+String(f.month).padStart(2,'0');if(!meses[k])meses[k]={año:f.year,mes:f.month,emitidas:[],recibidas:[]};meses[k].emitidas.push(f);});
  recibidas.forEach(function(f){var k=f.year+'-'+String(f.month).padStart(2,'0');if(!meses[k])meses[k]={año:f.year,mes:f.month,emitidas:[],recibidas:[]};meses[k].recibidas.push(f);});
  var totalE=emitidas.reduce(function(a,f){return a+f.total;},0);
  var totalR=recibidas.reduce(function(a,f){return a+f.total;},0);
  document.getElementById('sat-preview-title').textContent='Previa — '+emitidas.length+' ventas, '+recibidas.length+' compras';
  var html='<div style="margin-bottom:14px;padding:12px;background:#EAF3DE;border-radius:8px;font-size:13px;"><b>'+emitidas.length+'</b> facturas emitidas · Total: <b style="color:#3B6D11">'+fmt(totalE)+'</b><br><b>'+recibidas.length+'</b> facturas recibidas · Total: <b style="color:#A32D2D">'+fmt(totalR)+'</b><br><span style="color:#73726c;font-size:11px;">UUIDs ya existentes se omiten automáticamente.</span></div>';
  Object.keys(meses).sort().forEach(function(k){
    var m=meses[k];
    html+='<div style="font-weight:500;font-size:13px;margin:12px 0 6px;">'+MONTHS[m.mes-1]+' '+m.año+'</div>';
    if(m.emitidas.length){
      html+='<div style="font-size:11px;color:#3B6D11;margin-bottom:4px;">Ventas ('+m.emitidas.length+')</div>';
      html+=m.emitidas.slice(0,5).map(function(f){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:.5px solid #eeecea;"><span>'+esc((f.nombre_receptor||f.rfc_receptor||'').slice(0,40))+'</span><span style="color:#3B6D11;font-weight:500;">'+fmt(f.total)+'</span></div>';}).join('');
      if(m.emitidas.length>5)html+='<div style="font-size:11px;color:#888780;padding:4px 0;">...y '+(m.emitidas.length-5)+' más</div>';
    }
    if(m.recibidas.length){
      html+='<div style="font-size:11px;color:#A32D2D;margin:8px 0 4px;">Compras ('+m.recibidas.length+')</div>';
      html+=m.recibidas.slice(0,5).map(function(f){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:.5px solid #eeecea;"><span>'+esc((f.nombre_emisor||f.rfc_emisor||'').slice(0,40))+'</span><span style="color:#A32D2D;font-weight:500;">'+fmt(f.total)+'</span></div>';}).join('');
      if(m.recibidas.length>5)html+='<div style="font-size:11px;color:#888780;padding:4px 0;">...y '+(m.recibidas.length-5)+' más</div>';
    }
  });
  document.getElementById('sat-preview-body').innerHTML=html;
  document.getElementById('btn-confirmar-sat').textContent='Importar';
  document.getElementById('btn-confirmar-sat').onclick=confirmarImportSAT;
  document.getElementById('sat-preview-modal').style.display='block';
}

function cerrarSATPreview(){
  document.getElementById('sat-preview-modal').style.display='none';
  satPendingEmitidas=[];satPendingRecibidas=[];
}

async function confirmarImportSAT(){
  var btn=document.getElementById('btn-confirmar-sat');
  btn.disabled=true;btn.textContent='Importando...';
  try{
    // ── Build facturas rows (new table) ──────────────────
    var factRows=[];

    // Auto-match clientes por RFC para emitidas
    var rfcsE=[...new Set(satPendingEmitidas.map(function(f){return f.rfc_receptor;}).filter(Boolean))];
    var rfcToClienteId={};
    if(rfcsE.length){
      var {data:cliMatch}=await sb.from('clientes').select('id,rfc').in('rfc',rfcsE);
      (cliMatch||[]).forEach(function(c){rfcToClienteId[c.rfc]=c.id;});
    }

    // Auto-match proveedores por RFC para recibidas
    var rfcsR=[...new Set(satPendingRecibidas.map(function(f){return f.rfc_emisor;}).filter(Boolean))];
    var rfcToProvId={};
    if(rfcsR.length){
      var {data:provMatch}=await sb.from('proveedores').select('id,rfc').in('rfc',rfcsR);
      (provMatch||[]).forEach(function(p){rfcToProvId[p.rfc]=p.id;});
    }

    satPendingEmitidas.forEach(function(f){
      if(!f.uuid||f.total<=0)return;
      var fechaD=new Date((f.fecha_emision||'')+'T12:00');
      factRows.push({
        uuid_sat:f.uuid,
        numero_factura:f.uuid.slice(0,8).toUpperCase(),
        tipo:'emitida',
        fecha:f.fecha_emision,
        emisor_rfc:null, // empresa propia
        emisor_nombre:null,
        receptor_rfc:f.rfc_receptor||null,
        receptor_nombre:f.nombre_receptor||null,
        subtotal:parseFloat(f.subtotal)||0,
        iva:parseFloat(f.iva)||0,
        total:parseFloat(f.total)||0,
        metodo_pago:f.metodo_pago||'PUE',
        forma_pago:f.forma_pago||null,
        uso_cfdi:f.uso_cfdi||null,
        concepto:f.concepto||f.nombre_receptor||null,
        estatus:'vigente',
        conciliado:false,
        complemento_requerido:(f.metodo_pago==='PPD'),
        cliente_id:rfcToClienteId[f.rfc_receptor]||null,
        year:isNaN(fechaD.getFullYear())?null:fechaD.getFullYear(),
        month:isNaN(fechaD.getMonth())?null:fechaD.getMonth()+1,
        origen:'sat'
      });
    });

    satPendingRecibidas.forEach(function(f){
      if(!f.uuid||f.total<=0)return;
      var fechaD=new Date((f.fecha_emision||'')+'T12:00');
      factRows.push({
        uuid_sat:f.uuid,
        tipo:'recibida',
        fecha:f.fecha_emision,
        emisor_rfc:f.rfc_emisor||null,
        emisor_nombre:f.nombre_emisor||null,
        receptor_rfc:null,
        receptor_nombre:null,
        subtotal:parseFloat(f.subtotal)||0,
        iva:parseFloat(f.iva)||0,
        total:parseFloat(f.total)||0,
        metodo_pago:f.metodo_pago||'PUE',
        forma_pago:f.forma_pago||null,
        uso_cfdi:f.uso_cfdi||null,
        concepto:f.concepto||f.nombre_emisor||null,
        estatus:'vigente',
        conciliado:false,
        complemento_requerido:false,
        proveedor_id:rfcToProvId[f.rfc_emisor]||null,
        year:isNaN(fechaD.getFullYear())?null:fechaD.getFullYear(),
        month:isNaN(fechaD.getMonth())?null:fechaD.getMonth()+1,
        origen:'sat'
      });
    });

    if(factRows.length){
      var {error}=await sb.from('facturas').upsert(factRows,{onConflict:'uuid_sat',ignoreDuplicates:true});
      if(error)throw error;
    }

    // Auto-crear clientes
    var clientesNuevos=0,proveedoresNuevos=0;
    if(satPendingEmitidas.length){
      var rfcsE=[...new Set(satPendingEmitidas.map(function(f){return f.rfc_receptor;}).filter(Boolean))];
      if(rfcsE.length){
        var {data:cEx}=await sb.from('clientes').select('rfc').in('rfc',rfcsE);
        var rfcsExist=new Set((cEx||[]).map(function(c){return c.rfc;}));
        var nc={};
        satPendingEmitidas.forEach(function(f){if(!f.rfc_receptor||rfcsExist.has(f.rfc_receptor)||nc[f.rfc_receptor])return;nc[f.rfc_receptor]={id:'cli_'+f.rfc_receptor.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,16),nombre:f.nombre_receptor||f.rfc_receptor,rfc:f.rfc_receptor,condiciones_pago:'30'};});
        var ncArr=Object.values(nc);
        if(ncArr.length){await sb.from('clientes').upsert(ncArr,{onConflict:'rfc',ignoreDuplicates:true});clientesNuevos=ncArr.length;}
      }
    }
    if(satPendingRecibidas.length){
      var rfcsR=[...new Set(satPendingRecibidas.map(function(f){return f.rfc_emisor;}).filter(Boolean))];
      if(rfcsR.length){
        var {data:pEx}=await sb.from('proveedores').select('rfc').in('rfc',rfcsR);
        var rfcsPEx=new Set((pEx||[]).map(function(p){return p.rfc;}));
        var np={};
        satPendingRecibidas.forEach(function(f){if(!f.rfc_emisor||rfcsPEx.has(f.rfc_emisor)||np[f.rfc_emisor])return;np[f.rfc_emisor]={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),nombre:f.nombre_emisor||f.rfc_emisor,rfc:f.rfc_emisor,condiciones_pago:'30',tipo:'general'};});
        var npArr=Object.values(np);
        if(npArr.length){await sb.from('proveedores').upsert(npArr,{onConflict:'rfc',ignoreDuplicates:true});proveedoresNuevos=npArr.length;}
      }
    }
    cerrarSATPreview();
    var msg='✓ '+satPendingEmitidas.length+' emitidas, '+satPendingRecibidas.length+' recibidas importadas';
    if(clientesNuevos)msg+=' · '+clientesNuevos+' clientes creados';
    if(proveedoresNuevos)msg+=' · '+proveedoresNuevos+' proveedores creados';
    showStatus(msg);
    loadClientes();loadMovements();loadSATData();
  }catch(e){showError('Error al importar: '+e.message);console.error(e);}
  finally{btn.disabled=false;btn.textContent='Importar';}
}

// ── BBVA Import ──────────────────────────────────────────
async function importarBBVAMultiple(input){
  var files=Array.from(input.files||[]);
  if(!files.length)return;
  input.value='';

  // T5 — límite de tamaño: estados de cuenta BBVA raramente superan 15MB
  var MAX_MB=15;
  var oversized=files.filter(function(f){return f.size>MAX_MB*1024*1024;});
  if(oversized.length){
    showError(oversized.length+' archivo(s) superan '+MAX_MB+'MB y no se procesarán: '+oversized.map(function(f){return f.name;}).join(', '));
    files=files.filter(function(f){return f.size<=MAX_MB*1024*1024;});
    if(!files.length)return;
  }

  showStatus('Leyendo '+files.length+' PDF'+(files.length>1?'s':'')+' BBVA...',0);
  var totalRows=[];
  try{
    for(var i=0;i<files.length;i++){
      var buf=await readFileAsync(files[i]);
      var pdf=await pdfjsLib.getDocument({data:buf}).promise;
      var allItems=[];
      for(var p=1;p<=pdf.numPages;p++){
        var pg=await pdf.getPage(p);
        var vp=pg.getViewport({scale:1});
        var ct=await pg.getTextContent();
        ct.items.forEach(function(item){if(item.str&&item.str.trim()){allItems.push({str:item.str.trim(),x:Math.round(item.transform[4]),y:Math.round(item.transform[5]),page:p,width:vp.width});}});
      }
      var movs=parseBBVAPositional(allItems);
      console.log('BBVA file',i+1,'parsed:',movs.length,movs.slice(0,2));
      movs.forEach(function(m){
        var fechaD=new Date(m.fecha+'T12:00');
        var safeKey=(m.descripcion||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8);
        var esAbono=m.abono>0;
        totalRows.push({id:'banco_'+(esAbono?'a':'c')+'_'+m.fecha.replace(/-/g,'')+'_'+String(m.cargo||m.abono||0).replace('.','')+'_'+safeKey,fecha:m.fecha,descripcion:m.descripcion,contraparte:'',monto:esAbono?m.abono:m.cargo,tipo:esAbono?'ingreso':'egreso',categoria:esAbono?'cobranza':'gasto',origen:esAbono?'banco_abono':'banco_cargo',conciliado:false,year:fechaD.getFullYear(),month:fechaD.getMonth()+1,usuario:'BBVA'});
      });
    }
    var seen={};totalRows=totalRows.filter(function(r){if(seen[r.id])return false;seen[r.id]=true;return true;});
    if(!totalRows.length){showError('No se detectaron movimientos en los PDFs.');var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';return;}
    var {error}=await sb.from('movimientos_v2').upsert(totalRows,{onConflict:'id',ignoreDuplicates:true});
    if(error)throw error;
    var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
    showStatus('✓ '+totalRows.length+' movimientos BBVA importados ('+totalRows.filter(function(r){return r.origen==='banco_abono';}).length+' abonos, '+totalRows.filter(function(r){return r.origen==='banco_cargo';}).length+' cargos)');
    loadSATData();
  }catch(e){console.error(e);showError('Error BBVA: '+e.message);var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';}
}

function parseBBVAPositional(items){
  var MESES={ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,OCT:10,NOV:11,DIC:12};
  var movimientos=[];
  var año=new Date().getFullYear();
  items.forEach(function(it){
    var m=it.str.match(/(\d{4})-\d{2}-\d{2}|AL\s+\d+\/\d+\/(\d{4})|DEL\s+\d+\/\d+\/(\d{4})/);
    if(m){var y=parseInt(m[1]||m[2]||m[3]);if(y>2000&&y<2100)año=y;}
  });
  var lineMap={};
  items.forEach(function(it){
    var key=it.page+'|'+Math.round(it.y/5)*5;
    if(!lineMap[key])lineMap[key]={page:it.page,y:it.y,items:[]};
    lineMap[key].items.push(it);
  });
  var lines=Object.values(lineMap).sort(function(a,b){if(a.page!==b.page)return a.page-b.page;return b.y-a.y;});
  var textLines=lines.map(function(l){return l.items.sort(function(a,b){return a.x-b.x;}).map(function(i){return i.str;}).join(' ');});
  var xCargo=null,xAbono=null;
  lines.forEach(function(l){
    var texts=l.items.map(function(i){return i.str;});
    var ci=texts.indexOf('CARGOS'),ai=texts.indexOf('ABONOS');
    if(ci>=0&&ai>=0&&!xCargo){xCargo=l.items[ci].x;xAbono=l.items[ai].x;}
  });
  lines.forEach(function(l,li){
    var lineStr=textLines[li];
    var fm=lineStr.match(/^(\d{1,2})\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\b/i);
    if(!fm)return;
    var dia=parseInt(fm[1]);var mesNum=MESES[fm[2].toUpperCase()];if(!mesNum)return;
    var fechaISO=año+'-'+String(mesNum).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
    var cargo=0,abono=0;
    if(xCargo&&xAbono){
      var tol=50;
      l.items.forEach(function(it){
        var n=parseFloat(it.str.replace(/,/g,''));
        if(isNaN(n)||n<1||n>50000000)return;
        if(Math.abs(it.x-xCargo)<tol)cargo=n;
        else if(Math.abs(it.x-xAbono)<tol)abono=n;
      });
    }
    if(!cargo&&!abono){
      var isAbono=/SPEI\s*RECIB|DEP\.?\s*CHE|C07\s+DEP/i.test(lineStr);
      var isCargo=/\bP14\b|\bN06\b|PAGO\s+CTA|SAT\b/i.test(lineStr)&&!isAbono;
      var nums=[];
      l.items.forEach(function(it){var n=parseFloat(it.str.replace(/,/g,''));if(!isNaN(n)&&n>=1&&n<50000000)nums.push({n:n,x:it.x});});
      nums.sort(function(a,b){return a.x-b.x;});
      if(nums.length){var imp=nums[0].n;if(isAbono)abono=imp;else cargo=imp;}
    }
    if(!cargo&&!abono)return;
    var desc=lineStr.replace(/^\d{1,2}\/[A-Z]{3}\s*/i,'').replace(/^\d{1,2}\/[A-Z]{3}\s*/i,'').replace(/^[A-Z]\d{2}\s+/,'').replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/g,'').replace(/\b\d{5,}(?:\.\d{2})?\b/g,'').replace(/\s+/g,' ').trim().slice(0,60)||'Movimiento BBVA';
    movimientos.push({fecha:fechaISO,descripcion:desc,cargo:cargo,abono:abono});
  });
  var seen={};
  return movimientos.filter(function(m){var k=m.fecha+'_'+(m.cargo||m.abono);if(seen[k])return false;seen[k]=true;return true;});
}

// ── Conciliación — estado en memoria ─────────────────────
// [T7] concilMatches → M2State alias en config.js
var _concilPagoActual = null; // movimiento bancario abierto en popup individual

// ── Helper: calcular distribución FIFO ───────────────────
function calcularFIFO(montoPago, facturasPendientes){
  // Ordena por fecha ASC (más antigua primero)
  var sorted = facturasPendientes.slice().sort(function(a,b){
    return new Date(a.fecha+'T12:00') - new Date(b.fecha+'T12:00');
  });
  var restante = montoPago;
  var distribucion = [];
  sorted.forEach(function(f){
    if(restante <= 0){ distribucion.push({factura:f, monto:0}); return; }
    var pendiente = (parseFloat(f.total)||0) - (parseFloat(f.monto_pagado)||0);
    var aplicar = Math.min(restante, pendiente);
    distribucion.push({factura:f, monto:Math.round(aplicar*100)/100});
    restante = Math.round((restante - aplicar)*100)/100;
  });
  return {distribucion:distribucion, sobrante:restante};
}

// ── Nivel de confianza del match ─────────────────────────
function nivelConfianza(abono, factura){
  var descLower = (abono.descripcion||'').toLowerCase();
  var rfcF = (factura.receptor_rfc||factura.rfc_contraparte||'').toLowerCase();
  var nombreF = (factura.receptor_nombre||factura.contraparte||'').toLowerCase().slice(0,10);
  // Nivel 1: RFC aparece en descripción
  if(rfcF && descLower.includes(rfcF)) return 'alta';
  // Nivel 1b: nombre parcial en descripción
  if(nombreF.length > 4 && descLower.includes(nombreF)) return 'alta';
  // Nivel 2: monto match ±5% + ventana 60 días
  var montoAbono = parseFloat(abono.monto)||0;
  var montoFact = parseFloat(factura.total)||0;
  var diff = Math.abs(montoAbono - montoFact) / Math.max(montoFact, 1);
  var dias = (new Date(abono.fecha+'T12:00') - new Date(factura.fecha+'T12:00')) / 864e5;
  if(diff <= 0.05 && dias >= -1 && dias <= 60) return 'media';
  return 'baja';
}

// ── Conciliación masiva ───────────────────────────────────
async function conciliarMes(){
  var btn=document.getElementById('btn-conciliar');
  var mes=parseInt(document.getElementById('sat-mes-sel').value)||curMonth+1;
  var año=parseInt(document.getElementById('sat-año-sel').value)||curYear;
  btn.disabled=true; btn.textContent='Analizando...';
  try{
    // Facturas emitidas pendientes del período (desde tabla facturas)
    var [{data:facturas},{data:abonos}] = await Promise.all([
      sb.from('facturas')
        .select('id,uuid_sat,numero_factura,fecha,total,monto_pagado,estatus_pago,receptor_nombre,receptor_rfc,cliente_id,concepto')
        .eq('tipo','emitida').eq('year',año).neq('estatus_pago','pagada').neq('estatus','cancelada')
        .order('fecha',{ascending:true}),
      sb.from('movimientos_v2')
        .select('*').eq('year',año).eq('month',mes).eq('origen','banco_abono').eq('conciliado',false)
        .order('fecha',{ascending:true})
    ]);
    facturas = facturas||[]; abonos = abonos||[];
    if(!abonos.length){ showStatus('No hay abonos bancarios sin vincular en este período.'); return; }
    if(!facturas.length){ showStatus('No hay facturas pendientes de pago.'); return; }

    // Generar matches sugeridos por cliente
    var matches = [];
    var abonosUsados = new Set();

    abonos.forEach(function(abono){
      if(abonosUsados.has(abono.id)) return;
      // Buscar facturas del mismo cliente (por RFC o cliente_id)
      var rfcAbono = (abono.rfc_contraparte||'').toLowerCase();
      var factsCli = facturas.filter(function(f){
        var rfcF = (f.receptor_rfc||'').toLowerCase();
        if(rfcAbono && rfcF && rfcAbono === rfcF) return true;
        if(abono.cliente_id && f.cliente_id && abono.cliente_id === f.cliente_id) return true;
        return false;
      });

      // Si no hay match por cliente, intentar por monto exacto
      if(!factsCli.length){
        factsCli = facturas.filter(function(f){
          var pendiente = (parseFloat(f.total)||0) - (parseFloat(f.monto_pagado)||0);
          var diff = Math.abs((parseFloat(abono.monto)||0) - pendiente) / Math.max(pendiente,1);
          return diff <= 0.02;
        });
      }

      if(!factsCli.length) return; // sin match

      var fifo = calcularFIFO(parseFloat(abono.monto)||0, factsCli);
      var confianza = nivelConfianza(abono, factsCli[0]);
      matches.push({ abono:abono, distribucion:fifo.distribucion, sobrante:fifo.sobrante, confianza:confianza });
      abonosUsados.add(abono.id);
    });

    if(!matches.length){ showStatus('No se encontraron matches. Usa "Vincular →" en cada abono para vincular manualmente.'); return; }
    mostrarPreviewConciliacionMasiva(matches, año, mes);
  }catch(e){ showError('Error: '+e.message); console.error(e); }
  finally{ btn.disabled=false; btn.textContent='⚡ Conciliar'; }
}

// ── Preview conciliación masiva ───────────────────────────
function mostrarPreviewConciliacionMasiva(matches, año, mes){
  concilMatches = matches;
  var totalMonto = matches.reduce(function(a,m){ return a+(parseFloat(m.abono.monto)||0); },0);
  var confianzaColors = {alta:'#16a34a', media:'#d97706', baja:'#dc2626'};
  var confianzaBg = {alta:'#dcfce7', media:'#fef3c7', baja:'#fee2e2'};

  var html = '<div style="padding:12px;background:#EAF3DE;border-radius:8px;font-size:13px;margin-bottom:14px;">'+
    '<b>'+matches.length+' pagos</b> listos para vincular · Total: <b style="color:#3B6D11">'+fmt(totalMonto)+'</b><br>'+
    '<span style="font-size:11px;color:#73726c;">Revisa la distribución. Puedes ajustar los montos antes de confirmar.</span></div>';

  matches.forEach(function(m, mi){
    var conf = m.confianza;
    html += '<div style="border:0.5px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden;">';
    // Abono header
    html += '<div style="padding:10px 14px;background:var(--bg-card-2);display:flex;justify-content:space-between;align-items:center;">'+
      '<div>'+
        '<div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc((m.abono.descripcion||'Sin descripción').slice(0,50))+'</div>'+
        '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(m.abono.fecha)+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;">'+
        '<span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;background:'+confianzaBg[conf]+';color:'+confianzaColors[conf]+';">'+
          (conf==='alta'?'✓ Alta confianza':conf==='media'?'~ Media confianza':'? Baja confianza')+'</span>'+
        '<span style="font-size:14px;font-weight:700;color:#16a34a;">+'+fmt(parseFloat(m.abono.monto)||0)+'</span>'+
      '</div>'+
    '</div>';
    // Distribución FIFO editable
    html += '<div style="padding:10px 14px;">';
    html += '<div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Distribución FIFO (editable)</div>';
    m.distribucion.filter(function(d){ return d.monto > 0; }).forEach(function(d, di){
      var pendiente = (parseFloat(d.factura.total)||0) - (parseFloat(d.factura.monto_pagado)||0);
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-weight:500;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+
            esc(d.factura.receptor_nombre||d.factura.receptor_rfc||'?')+
            (d.factura.numero_factura?' · '+esc(d.factura.numero_factura):'')+
          '</div>'+
          '<div style="font-size:10px;color:var(--text-3);">'+fmtDate(d.factura.fecha)+' · Pendiente: '+fmt(pendiente)+'</div>'+
        '</div>'+
        '<input type="number" '+
          'id="concil-monto-'+mi+'-'+di+'" '+
          'value="'+d.monto+'" min="0" max="'+pendiente+'" step="0.01" '+
          'style="width:100px;padding:4px 8px;border:0.5px solid var(--border);border-radius:6px;font-size:12px;text-align:right;background:var(--bg-input);color:var(--text-1);" '+
          'oninput="recalcSobrante('+mi+')" '+
          'data-match-idx="'+mi+'" data-dist-idx="'+di+'" data-factura-id="'+d.factura.id+'" data-pendiente="'+pendiente+'">'+
      '</div>';
    });
    // Sobrante
    if(m.sobrante > 0){
      html += '<div id="concil-sobrante-'+mi+'" style="font-size:11px;color:#d97706;margin-top:4px;">⚠️ Sobrante: '+fmt(m.sobrante)+' → se registrará como saldo a favor del cliente</div>';
    } else {
      html += '<div id="concil-sobrante-'+mi+'" style="font-size:11px;color:#16a34a;margin-top:4px;">✓ Sin sobrante</div>';
    }
    html += '</div></div>';
  });

  document.getElementById('sat-preview-title').textContent = 'Confirmar conciliación — '+MONTHS[mes-1]+' '+año;
  document.getElementById('sat-preview-body').innerHTML = html;
  document.getElementById('btn-confirmar-sat').textContent = 'Confirmar '+matches.length+' pagos';
  document.getElementById('btn-confirmar-sat').onclick = confirmarConciliacionMasiva;
  document.getElementById('sat-preview-modal').style.display = 'block';
}

function recalcSobrante(matchIdx){
  var m = concilMatches[matchIdx];
  if(!m) return;
  var montoPago = parseFloat(m.abono.monto)||0;
  var totalAplicado = 0;
  m.distribucion.filter(function(d){ return d.monto > 0; }).forEach(function(d, di){
    var inp = document.getElementById('concil-monto-'+matchIdx+'-'+di);
    if(inp) totalAplicado += parseFloat(inp.value)||0;
  });
  var sobrante = Math.round((montoPago - totalAplicado)*100)/100;
  var el = document.getElementById('concil-sobrante-'+matchIdx);
  if(el){
    if(sobrante > 0.01){
      el.style.color='#d97706';
      el.textContent='⚠️ Sobrante: '+fmt(sobrante)+' → saldo a favor del cliente';
    } else if(sobrante < -0.01){
      el.style.color='#dc2626';
      el.textContent='⛔ Excede el monto del pago en '+fmt(Math.abs(sobrante));
    } else {
      el.style.color='#16a34a';
      el.textContent='✓ Sin sobrante';
    }
  }
}

async function confirmarConciliacionMasiva(){
  var btn = document.getElementById('btn-confirmar-sat');
  btn.disabled = true; btn.textContent = 'Guardando...';
  var errores = 0, ok = 0;
  try{
    for(var mi = 0; mi < concilMatches.length; mi++){
      var m = concilMatches[mi];
      var montoPago = parseFloat(m.abono.monto)||0;
      var totalAplicado = 0;
      var distribFinal = [];
      var di = 0;
      for(var k = 0; k < m.distribucion.length; k++){
        if(m.distribucion[k].monto <= 0) continue;
        var inp = document.getElementById('concil-monto-'+mi+'-'+di);
        var montoAplicar = inp ? (parseFloat(inp.value)||0) : m.distribucion[k].monto;
        if(montoAplicar > 0){
          distribFinal.push({facturaId: m.distribucion[k].factura.id, monto: montoAplicar, factura: m.distribucion[k].factura});
          totalAplicado += montoAplicar;
        }
        di++;
      }
      var sobrante = Math.round((montoPago - totalAplicado)*100)/100;
      try{
        await aplicarPago(m.abono.id, distribFinal, sobrante);
        ok++;
      }catch(e){ console.error('Error aplicando pago '+m.abono.id, e); errores++; }
    }
    cerrarSATPreview();
    showStatus('✓ '+ok+' pagos conciliados'+(errores?' · '+errores+' con error':''));
    concilMatches = [];
    loadSATData();
  }catch(e){ showError('Error: '+e.message); }
  finally{ btn.disabled=false; btn.textContent='Confirmar'; }
}

// ── Conciliación individual (desde abono específico) ──────
async function abrirConciliacionPago(movimientoId){
  try{
    var {data:abono} = await sb.from('movimientos_v2').select('*').eq('id',movimientoId).maybeSingle();
    if(!abono){ showError('Movimiento no encontrado'); return; }
    _concilPagoActual = abono;

    // Buscar facturas pendientes — sin filtro de cliente si no hay RFC
    var query = sb.from('facturas')
      .select('id,uuid_sat,numero_factura,fecha,total,monto_pagado,estatus_pago,receptor_nombre,receptor_rfc,cliente_id,concepto')
      .eq('tipo','emitida').neq('estatus_pago','pagada').neq('estatus','cancelada')
      .order('fecha',{ascending:true}).limit(20);

    if(abono.cliente_id) query = query.eq('cliente_id', abono.cliente_id);
    else if(abono.rfc_contraparte) query = query.eq('receptor_rfc', abono.rfc_contraparte);

    var {data:facturasCli} = await query;
    facturasCli = facturasCli||[];

    // Si no hay facturas del cliente, buscar todas las pendientes
    if(!facturasCli.length){
      var {data:todasPend} = await sb.from('facturas')
        .select('id,uuid_sat,numero_factura,fecha,total,monto_pagado,estatus_pago,receptor_nombre,receptor_rfc,cliente_id,concepto')
        .eq('tipo','emitida').neq('estatus_pago','pagada').neq('estatus','cancelada')
        .order('fecha',{ascending:true}).limit(20);
      facturasCli = todasPend||[];
    }

    var fifo = calcularFIFO(parseFloat(abono.monto)||0, facturasCli);
    mostrarPreviewConciliacionMasiva([{abono:abono, distribucion:fifo.distribucion, sobrante:fifo.sobrante, confianza:'baja'}], curYear, curMonth+1);
  }catch(e){ showError('Error: '+e.message); }
}

// ── Desde factura: ver pagos vinculados ───────────────────
async function abrirConciliacionIndividual(facturaId){
  try{
    var {data:factura} = await sb.from('facturas').select('*').eq('id',facturaId).maybeSingle();
    if(!factura){ showError('Factura no encontrada'); return; }

    // Ver pagos ya vinculados
    var {data:pagos} = await sb.from('pagos_facturas')
      .select('*, movimientos_v2(*)')
      .eq('factura_id',facturaId)
      .order('created_at',{ascending:true});
    pagos = pagos||[];

    var pendiente = (parseFloat(factura.total)||0) - (parseFloat(factura.monto_pagado)||0);
    var html = '<div style="padding:12px;background:var(--bg-card-2);border-radius:8px;margin-bottom:14px;font-size:13px;">'+
      '<div style="font-weight:600;color:var(--text-1);">'+esc(factura.receptor_nombre||factura.receptor_rfc||'?')+'</div>'+
      '<div style="font-size:11px;color:var(--text-3);">'+(factura.numero_factura||'Sin folio')+' · '+fmtDate(factura.fecha)+'</div>'+
      '<div style="display:flex;gap:16px;margin-top:8px;">'+
        '<div><div style="font-size:10px;color:var(--text-3);">Total</div><div style="font-weight:600;color:#16a34a;">'+fmt(parseFloat(factura.total)||0)+'</div></div>'+
        '<div><div style="font-size:10px;color:var(--text-3);">Pagado</div><div style="font-weight:600;color:#1d4ed8;">'+fmt(parseFloat(factura.monto_pagado)||0)+'</div></div>'+
        '<div><div style="font-size:10px;color:var(--text-3);">Pendiente</div><div style="font-weight:600;color:'+(pendiente>0?'#d97706':'#16a34a')+';">'+fmt(pendiente)+'</div></div>'+
      '</div>'+
    '</div>';

    if(pagos.length){
      html += '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Pagos registrados</div>';
      pagos.forEach(function(p){
        var mov = p.movimientos_v2;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:0.5px solid var(--border-light);font-size:12px;">'+
          '<div>'+
            '<div style="font-weight:500;color:var(--text-1);">'+esc((mov&&mov.descripcion||'Pago manual').slice(0,45))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+(mov?fmtDate(mov.fecha):'—')+'</div>'+
          '</div>'+
          '<span style="font-weight:600;color:#1d4ed8;">'+fmt(parseFloat(p.monto_aplicado)||0)+'</span>'+
        '</div>';
      });
    } else {
      html += '<div style="color:var(--text-4);font-size:12px;padding:8px 0;">Sin pagos registrados.</div>';
    }

    if(pendiente > 0){
      html += '<div style="margin-top:14px;padding-top:10px;border-top:0.5px solid var(--border);">'+
        '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Vincular abono bancario</div>'+
        '<select id="concil-abono-sel" style="width:100%;padding:7px 10px;font-size:12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-1);">'+
          '<option value="">— Seleccionar abono —</option>'+
        '</select>'+
        '<div style="margin-top:6px;display:flex;gap:8px;align-items:center;">'+
          '<label style="font-size:11px;color:var(--text-3);">Monto a aplicar</label>'+
          '<input type="number" id="concil-monto-manual" value="'+pendiente+'" min="0.01" step="0.01" style="width:120px;padding:5px 8px;border:0.5px solid var(--border);border-radius:6px;font-size:12px;text-align:right;background:var(--bg-input);color:var(--text-1);">'+
        '</div>'+
        '<button class="btn-primary" style="margin-top:10px;width:100%;" onclick="confirmarVinculoManual(\'+facturaId+\')">Confirmar vínculo</button>'+
      '</div>';
    }

    document.getElementById('sat-preview-title').textContent = 'Detalle de factura · '+esc(factura.numero_factura||'Sin folio');
    document.getElementById('sat-preview-body').innerHTML = html;
    document.getElementById('btn-confirmar-sat').textContent = 'Cerrar';
    document.getElementById('btn-confirmar-sat').onclick = cerrarSATPreview;
    document.getElementById('sat-preview-modal').style.display = 'block';

    // Cargar abonos sin vincular en el select
    cargarAbonosSinVincular(factura.cliente_id, factura.receptor_rfc);
  }catch(e){ showError('Error: '+e.message); }
}

async function cargarAbonosSinVincular(clienteId, rfcReceptor){
  var sel = document.getElementById('concil-abono-sel');
  if(!sel) return;
  var query = sb.from('movimientos_v2').select('id,fecha,descripcion,monto,rfc_contraparte')
    .eq('origen','banco_abono').eq('conciliado',false).order('fecha',{ascending:false}).limit(30);
  var {data:abonos} = await query;
  abonos = (abonos||[]);
  // Priorizar abonos del mismo cliente/RFC al tope
  abonos.sort(function(a,b){
    var aMatch = (rfcReceptor && (a.rfc_contraparte||'').toLowerCase()===rfcReceptor.toLowerCase());
    var bMatch = (rfcReceptor && (b.rfc_contraparte||'').toLowerCase()===rfcReceptor.toLowerCase());
    return (bMatch?1:0)-(aMatch?1:0);
  });
  sel.innerHTML = '<option value="">— Seleccionar abono —</option>';
  abonos.forEach(function(a){
    var opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = fmtDate(a.fecha)+' · '+fmt(parseFloat(a.monto)||0)+' · '+(a.descripcion||'').slice(0,35);
    sel.appendChild(opt);
  });
}

async function confirmarVinculoManual(facturaId){
  var sel = document.getElementById('concil-abono-sel');
  var montoInp = document.getElementById('concil-monto-manual');
  if(!sel||!sel.value){ showError('Selecciona un abono bancario'); return; }
  var montoAplicar = parseFloat(montoInp&&montoInp.value)||0;
  if(montoAplicar <= 0){ showError('El monto debe ser mayor a 0'); return; }
  try{
    var {data:factura} = await sb.from('facturas').select('id,total,monto_pagado,cliente_id,receptor_rfc').eq('id',facturaId).maybeSingle();
    if(!factura) throw new Error('Factura no encontrada');
    await aplicarPago(sel.value, [{facturaId:facturaId, monto:montoAplicar, factura:factura}], 0);
    cerrarSATPreview();
    showStatus('✓ Pago vinculado correctamente');
    loadSATData();
  }catch(e){ showError('Error: '+e.message); }
}

// ── Núcleo: aplicar pago a facturas + escribir pagos_facturas ─
async function aplicarPago(movimientoId, distribucion, sobrante){
  for(var i=0; i<distribucion.length; i++){
    var d = distribucion[i];
    if(!d.monto || d.monto <= 0) continue;

    // 1. Insertar en pagos_facturas
    var {error:epf} = await sb.from('pagos_facturas').insert({
      movimiento_id: movimientoId,
      factura_id: d.facturaId,
      monto_aplicado: d.monto
    });
    if(epf && epf.code !== '23505') throw epf; // ignorar duplicados

    // 2. Actualizar monto_pagado y estatus_pago en factura
    var nuevoMontoPagado = (parseFloat(d.factura.monto_pagado)||0) + d.monto;
    var totalFactura = parseFloat(d.factura.total)||0;
    var nuevoEstatus = nuevoMontoPagado >= totalFactura*0.999 ? 'pagada'
      : nuevoMontoPagado > 0 ? 'parcial' : 'pendiente';
    var {error:ef} = await sb.from('facturas').update({
      monto_pagado: Math.round(nuevoMontoPagado*100)/100,
      estatus_pago: nuevoEstatus,
      conciliado: nuevoEstatus === 'pagada',
      fecha_pago: nuevoEstatus === 'pagada' ? new Date().toISOString().split('T')[0] : null,
      movimiento_banco_id: movimientoId
    }).eq('id', d.facturaId);
    if(ef) throw ef;
  }

  // 3. Marcar el movimiento bancario como conciliado
  var {error:em} = await sb.from('movimientos_v2').update({
    conciliado: true,
    factura_vinculada_id: distribucion.length===1 ? distribucion[0].facturaId : null
  }).eq('id', movimientoId);
  if(em) throw em;

  // 4. Si hay sobrante, actualizar saldo_favor del cliente
  if(sobrante > 0.01){
    var clienteId = distribucion[0] && distribucion[0].factura && distribucion[0].factura.cliente_id;
    if(clienteId){
      // Sumar al saldo_favor existente
      var {data:cli} = await sb.from('clientes').select('saldo_favor').eq('id',clienteId).maybeSingle();
      var saldoActual = parseFloat(cli&&cli.saldo_favor)||0;
      await sb.from('clientes').update({ saldo_favor: Math.round((saldoActual+sobrante)*100)/100 }).eq('id',clienteId);
    }
  }
}

// ── Antigüedad de cartera ────────────────────────────────
async function loadCartera(){
  try{
    var hoy=new Date();
    var hace6=new Date(hoy);hace6.setMonth(hace6.getMonth()-6);
    var {data:pendientes}=await sb.from('movimientos_v2').select('*').eq('origen','sat_emitida').eq('conciliado',false).gte('fecha',hace6.toISOString().split('T')[0]).order('fecha',{ascending:true});
    pendientes=pendientes||[];
    var el=document.getElementById('cartera-list');
    var ct=document.getElementById('cartera-count');
    if(!pendientes.length){ct.textContent='Sin pendientes';el.innerHTML='<div class="empty-state">No hay facturas pendientes de cobro ✓</div>';return;}
    var totalPendiente=pendientes.reduce(function(a,f){return a+(parseFloat(f.monto)||0);},0);
    ct.textContent=pendientes.length+' pendiente'+(pendientes.length!==1?'s':'')+' · '+fmt(totalPendiente);
    var grupos={g0:[],g30:[],g60:[],g90:[]};
    pendientes.forEach(function(f){
      var dias=Math.floor((hoy-new Date(f.fecha+'T12:00'))/(1000*60*60*24));
      if(dias<=30)grupos.g0.push({f:f,dias:dias});
      else if(dias<=60)grupos.g30.push({f:f,dias:dias});
      else if(dias<=90)grupos.g60.push({f:f,dias:dias});
      else grupos.g90.push({f:f,dias:dias});
    });
    var bandas=[{key:'g90',label:'Más de 90 días',color:'#791F1F',bg:'#F7C1C1'},{key:'g60',label:'61-90 días',color:'#A32D2D',bg:'#FCEBEB'},{key:'g30',label:'31-60 días',color:'#854F0B',bg:'#FAEEDA'},{key:'g0',label:'0-30 días',color:'#3B6D11',bg:'#EAF3DE'}];
    var html='<div style="overflow-x:auto;"><table class="sat-table"><thead><tr>'+
      '<th>Cliente</th><th>No. Factura</th><th>Fecha</th><th>Días</th><th style="text-align:right;">Monto</th>'+
      '</tr></thead><tbody>';
    bandas.forEach(function(b){
      var items=grupos[b.key];if(!items.length)return;
      var subtotal=items.reduce(function(a,i){return a+Number(i.f.monto);},0);
      html+='<tr><td colspan="5" class="sat-banda" style="background:'+b.bg+';color:'+b.color+';">'+
        b.label+' · '+items.length+' factura'+(items.length!==1?'s':'')+' · <b>'+fmt(subtotal)+'</b></td></tr>';
      html+=items.map(function(i){
        var numFac=i.f.numero_factura||'—';
        return '<tr>'+
          '<td><div style="font-size:12px;font-weight:500;color:var(--text-1);">'+esc((i.f.contraparte||'-').slice(0,35))+'</div>'+
            '<div style="font-size:10px;color:var(--text-3);">'+esc(i.f.rfc_contraparte||'')+'</div></td>'+
          '<td class="muted">'+esc(numFac)+'</td>'+
          '<td class="muted">'+fmtDate(i.f.fecha)+'</td>'+
          '<td class="muted">'+i.dias+'d</td>'+
          '<td class="monto" style="color:'+b.color+';">'+fmt(parseFloat(i.f.monto)||0)+'</td>'+
        '</tr>';
      }).join('');
    });
    html+='</tbody></table></div>';
    el.innerHTML=html;
  }catch(e){console.error('Cartera:',e);}
}

