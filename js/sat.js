// ── Manejo del PDF ───────────────────────────────────────
var pdfMovimientos=[];

async function handlePDF(input){
  var file=input.files[0];
  if(!file)return;
  input.value='';
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
var satPendingEmitidas=[], satPendingRecibidas=[];

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
  // Sync global month so finanzas KPIs stay in sync
  curMonth=mes-1; curYear=año;
  document.getElementById('month-label').textContent=MONTHS[curMonth]+' '+curYear;
  document.getElementById('sat-periodo').textContent=MONTHS[mes-1]+' '+año;
  loadFinanzasKPIs();
  try{
    var {data,error}=await sb.from('movimientos_v2').select('*')
      .eq('year',año).eq('month',mes)
      .in('origen',['sat_emitida','sat_recibida','banco_abono','banco_cargo'])
      .order('fecha',{ascending:false});
    if(error)throw error;
    var all=(data||[]).filter(function(p){
      if(!año)return true;
      return !p.year||p.year===parseInt(año);
    });
    var emitidas=all.filter(function(m){return m.origen==='sat_emitida';});
    var recibidas=all.filter(function(m){return m.origen==='sat_recibida';});
    var banco=all.filter(function(m){return m.origen==='banco_abono'||m.origen==='banco_cargo';});
    var totalEmitido=emitidas.reduce(function(a,m){return a+Number(m.monto);},0);
    var totalRecibido=recibidas.reduce(function(a,m){return a+Number(m.monto);},0);
    var totalAbonos=banco.filter(function(m){return m.origen==='banco_abono';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var porCobrar=emitidas.filter(function(m){return !m.conciliado;}).reduce(function(a,m){return a+Number(m.monto);},0);
    document.getElementById('sat-emitido').textContent=fmt(totalEmitido);
    document.getElementById('sat-cobrado').textContent=fmt(totalAbonos);
    document.getElementById('sat-recibido').textContent=fmt(totalRecibido);
    document.getElementById('sat-por-cobrar').textContent=fmt(porCobrar);
    renderFacturasEmitidas(emitidas);
    renderMovsBanco(banco);
    renderFacturasRecibidas(recibidas);
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
  el.innerHTML='<div class="sat-row sat-row-hdr" style="grid-template-columns:1fr 100px 90px 80px 70px;"><span>Cliente / RFC</span><span>No. Factura</span><span style="text-align:right">Total</span><span>Fecha</span><span>Estado</span></div>'+
    sorted.map(function(f){
      var pill=f.conciliado?'<span class="pill-azul">Cobrada</span>':'<span class="pill-verde">Vigente</span>';
      var numFac=f.numero_factura||'—';
      return '<div class="sat-row" style="grid-template-columns:1fr 100px 90px 80px 70px;">'+
        '<div><div style="font-size:12px;font-weight:500;">'+esc((f.contraparte||'-').slice(0,35))+'</div>'+
        '<div style="font-size:10px;color:#888780;">'+esc(f.rfc_contraparte||'')+'</div></div>'+
        '<div style="font-size:11px;color:#5f5e5a;">'+esc(numFac)+'</div>'+
        '<div style="text-align:right;font-weight:500;color:#3B6D11;">'+fmt(Number(f.monto))+'</div>'+
        '<div style="color:#73726c;font-size:11px;">'+fmtDate(f.fecha)+'</div>'+
        '<div>'+pill+'</div>'+
      '</div>';
    }).join('');
}

function renderMovsBanco(list){
  if(list)lastBanco=list;
  var sortKey=(document.getElementById('banco-sort')||{}).value||'fecha_desc';
  var sorted=sortList(lastBanco,sortKey);
  var el=document.getElementById('banco-list');
  var ct=document.getElementById('banco-count');
  ct.textContent=sorted.length+' movimiento'+(sorted.length!==1?'s':'');
  if(!sorted.length){el.innerHTML='<div class="empty-state">Sin movimientos bancarios importados</div>';return;}
  el.innerHTML='<div class="sat-row sat-row-hdr" style="grid-template-columns:80px 1fr 100px 80px;"><span>Fecha</span><span>Descripción</span><span style="text-align:right">Importe</span><span>Tipo</span></div>'+
    sorted.map(function(m){
      var esAbono=m.origen==='banco_abono';
      return '<div class="sat-row" style="grid-template-columns:80px 1fr 100px 80px;">'+
        '<div style="color:#73726c;">'+fmtDate(m.fecha)+'</div>'+
        '<div style="font-size:12px;">'+esc((m.descripcion||'-').slice(0,50))+'</div>'+
        '<div style="text-align:right;font-weight:500;color:'+(esAbono?'#3B6D11':'#A32D2D')+'">'+(esAbono?'+':'-')+fmt(Number(m.monto))+'</div>'+
        '<div><span class="'+(esAbono?'pill-verde':'pill-rojo')+'">'+(esAbono?'Abono':'Cargo')+'</span></div>'+
      '</div>';
    }).join('');
}

function renderFacturasRecibidas(list){
  if(list)lastRecibidas=list;
  var sortKey=(document.getElementById('recib-sort')||{}).value||'fecha_asc';
  var sorted=sortList(lastRecibidas,sortKey);
  var el=document.getElementById('recib-list');
  var ct=document.getElementById('recib-count');
  ct.textContent=sorted.length+' factura'+(sorted.length!==1?'s':'');
  if(!sorted.length){el.innerHTML='<div class="empty-state">Sin facturas recibidas importadas</div>';return;}
  el.innerHTML='<div class="sat-row sat-row-hdr" style="grid-template-columns:1fr 90px 80px 70px;"><span>Proveedor / RFC</span><span style="text-align:right">Total</span><span>Fecha</span><span>Estado</span></div>'+
    sorted.map(function(f){
      var pill=f.conciliado?'<span class="pill-azul">Pagada</span>':'<span class="pill-verde">Vigente</span>';
      return '<div class="sat-row" style="grid-template-columns:1fr 90px 80px 70px;">'+
        '<div><div style="font-size:12px;font-weight:500;">'+esc((f.contraparte||'-').slice(0,35))+'</div>'+
        '<div style="font-size:10px;color:#888780;">'+esc(f.rfc_contraparte||'')+'</div></div>'+
        '<div style="text-align:right;font-weight:500;color:#A32D2D;">'+fmt(Number(f.monto))+'</div>'+
        '<div style="color:#73726c;font-size:11px;">'+fmtDate(f.fecha)+'</div>'+
        '<div>'+pill+'</div>'+
      '</div>';
    }).join('');
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
    var rows=[];
    satPendingEmitidas.forEach(function(f){
      if(!f.uuid||f.total<=0)return;
      rows.push({id:'sat_e_'+f.uuid.replace(/-/g,'').slice(0,22),fecha:f.fecha_emision,descripcion:f.nombre_receptor||f.rfc_receptor||'',contraparte:f.nombre_receptor||'',monto:f.total,tipo:'ingreso',categoria:'venta',origen:'sat_emitida',uuid_sat:f.uuid,rfc_contraparte:f.rfc_receptor||null,conciliado:false,year:f.year,month:f.month,usuario:'SAT'});
    });
    satPendingRecibidas.forEach(function(f){
      if(!f.uuid||f.total<=0)return;
      rows.push({id:'sat_r_'+f.uuid.replace(/-/g,'').slice(0,22),fecha:f.fecha_emision,descripcion:f.nombre_emisor||f.rfc_emisor||'',contraparte:f.nombre_emisor||'',monto:f.total,tipo:'egreso',categoria:'compra',origen:'sat_recibida',uuid_sat:f.uuid,rfc_contraparte:f.rfc_emisor||null,conciliado:false,year:f.year,month:f.month,usuario:'SAT'});
    });
    if(rows.length){var {error}=await sb.from('movimientos_v2').upsert(rows,{onConflict:'id',ignoreDuplicates:true});if(error)throw error;}
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
    var msg='✓ '+satPendingEmitidas.length+' ventas, '+satPendingRecibidas.length+' compras importadas';
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

// ── Conciliación automática ──────────────────────────────
async function conciliarMes(){
  var btn=document.getElementById('btn-conciliar');
  var mes=parseInt(document.getElementById('sat-mes-sel').value)||curMonth+1;
  var año=parseInt(document.getElementById('sat-año-sel').value)||curYear;
  btn.disabled=true;btn.textContent='Conciliando...';
  try{
    var [{data:emitidas},{data:abonos}]=await Promise.all([
      sb.from('movimientos_v2').select('*').eq('year',año).eq('month',mes).eq('conciliado',false).eq('origen','sat_emitida'),
      sb.from('movimientos_v2').select('*').eq('year',año).eq('month',mes).eq('conciliado',false).eq('origen','banco_abono')
    ]);
    emitidas=emitidas||[];abonos=abonos||[];
    var matches=[];var abonosUsados=new Set();
    emitidas.forEach(function(f){
      var fechaF=new Date(f.fecha+'T12:00');
      var match=abonos.find(function(a){
        if(abonosUsados.has(a.id))return false;
        var diff=Math.abs(Number(a.monto)-Number(f.monto))/Math.max(Number(f.monto),1);
        if(diff>0.05)return false;
        var dias=(new Date(a.fecha+'T12:00')-fechaF)/(1000*60*60*24);
        return dias>=-1&&dias<=60;
      });
      if(match){abonosUsados.add(match.id);matches.push({factura:f,abono:match});}
    });
    if(!matches.length){showStatus('No se encontraron matches automáticos.');btn.disabled=false;btn.textContent='⚡ Conciliar automáticamente';return;}
    mostrarPreviewConciliacion(matches,año,mes);
  }catch(e){showError('Error: '+e.message);}
  finally{btn.disabled=false;btn.textContent='⚡ Conciliar automáticamente';}
}

var concilMatches=[];
function mostrarPreviewConciliacion(matches,año,mes){
  concilMatches=matches;
  var total=matches.reduce(function(a,m){return a+Number(m.factura.monto);},0);
  var html='<div style="padding:12px;background:#EAF3DE;border-radius:8px;font-size:13px;margin-bottom:14px;"><b>'+matches.length+' coincidencias</b> · <b style="color:#3B6D11">'+fmt(total)+'</b></div>'+
    '<div class="sat-row sat-row-hdr" style="grid-template-columns:1fr 1fr 90px;"><span>Factura</span><span>Abono bancario</span><span style="text-align:right">Monto</span></div>'+
    matches.map(function(m){return '<div class="sat-row" style="grid-template-columns:1fr 1fr 90px;align-items:start;"><div><div style="font-size:12px;font-weight:500;">'+esc((m.factura.contraparte||'-').slice(0,30))+'</div><div style="font-size:10px;color:#888780;">'+fmtDate(m.factura.fecha)+'</div></div><div><div style="font-size:12px;font-weight:500;">'+esc((m.abono.descripcion||'-').slice(0,30))+'</div><div style="font-size:10px;color:#888780;">'+fmtDate(m.abono.fecha)+'</div></div><div style="text-align:right;font-weight:500;color:#3B6D11;">'+fmt(Number(m.factura.monto))+'</div></div>';}).join('');
  document.getElementById('sat-preview-title').textContent='Confirmar conciliación — '+MONTHS[mes-1]+' '+año;
  document.getElementById('sat-preview-body').innerHTML=html;
  document.getElementById('btn-confirmar-sat').textContent='Confirmar';
  document.getElementById('btn-confirmar-sat').onclick=confirmarConciliacion;
  document.getElementById('sat-preview-modal').style.display='block';
}

async function confirmarConciliacion(){
  var btn=document.getElementById('btn-confirmar-sat');
  btn.disabled=true;btn.textContent='Guardando...';
  try{
    for(var i=0;i<concilMatches.length;i++){
      var m=concilMatches[i];
      await sb.from('movimientos_v2').update({conciliado:true,movimiento_relacionado_id:m.abono.id}).eq('id',m.factura.id);
      await sb.from('movimientos_v2').update({conciliado:true,movimiento_relacionado_id:m.factura.id}).eq('id',m.abono.id);
    }
    document.getElementById('btn-confirmar-sat').onclick=confirmarImportSAT;
    cerrarSATPreview();
    showStatus('✓ '+concilMatches.length+' facturas conciliadas');
    concilMatches=[];
    loadSATData();
  }catch(e){showError('Error: '+e.message);}
  finally{btn.disabled=false;}
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
    var totalPendiente=pendientes.reduce(function(a,f){return a+Number(f.monto);},0);
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
    var html='<div class="sat-row sat-row-hdr" style="grid-template-columns:1fr 90px 80px 60px 70px;"><span>Cliente</span><span>No. Factura</span><span style="text-align:right">Monto</span><span>Días</span><span>Fecha</span></div>';
    bandas.forEach(function(b){
      var items=grupos[b.key];if(!items.length)return;
      var subtotal=items.reduce(function(a,i){return a+Number(i.f.monto);},0);
      html+='<div style="padding:8px 1.25rem;background:'+b.bg+';border-bottom:.5px solid #d3d1c7;"><span style="font-size:11px;font-weight:500;color:'+b.color+';">'+b.label+' · '+items.length+' factura'+(items.length!==1?'s':'')+' · '+fmt(subtotal)+'</span></div>';
      html+=items.map(function(i){
        var numFac=i.f.numero_factura||'—';
        return '<div class="sat-row" style="grid-template-columns:1fr 90px 80px 60px 70px;">'+
          '<div><div style="font-size:12px;font-weight:500;">'+esc((i.f.contraparte||i.f.rfc_contraparte||'-').slice(0,28))+'</div>'+
          '<div style="font-size:10px;color:#888780;">'+esc(i.f.rfc_contraparte||'')+'</div></div>'+
          '<div style="font-size:11px;color:#5f5e5a;">'+esc(numFac)+'</div>'+
          '<div style="text-align:right;font-weight:500;color:'+b.color+';">'+fmt(Number(i.f.monto))+'</div>'+
          '<div style="color:#73726c;font-size:12px;">'+i.dias+'d</div>'+
          '<div style="color:#73726c;font-size:11px;">'+fmtDate(i.f.fecha)+'</div>'+
        '</div>';
      }).join('');
    });
    el.innerHTML=html;
  }catch(e){console.error('Cartera:',e);}
}

