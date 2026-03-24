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
    if(typeof pdfjsLib!=='undefined')
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
  // Init banco-year-sel if needed
  var bancoYearSel=document.getElementById('banco-year-sel');
  if(bancoYearSel&&!bancoYearSel.options.length){
    for(var by=curYear-3;by<=curYear+1;by++){
      var bo=document.createElement('option');
      bo.value=by; bo.textContent=by;
      if(by===curYear)bo.selected=true;
      bancoYearSel.appendChild(bo);
    }
  }
  if(typeof loadBanco==='function') loadBanco();
}


// ── SAT Excel Import ──────────────────────────────────────
function parsearExcelSAT(buf,fileName){
  var emitidas=[],recibidas=[];
  try{
    var wb=XLSX.read(buf,{type:'array'});
    var sheetNameE=wb.SheetNames.includes('Hoja2')?'Hoja2':(wb.SheetNames.find(function(s){return s.toUpperCase().includes('EMIT');})||wb.SheetNames[0]);
    if(sheetNameE){
      var ws=wb.Sheets[sheetNameE];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      var colUUID=-1,colRFC=-1,colNombre=-1,colFecha=-1,colTotal=-1,colEfecto=-1,colEstado=-1,colRFCEmisor=-1,colNomEmisor=-1,dataStart=2;
      for(var hi=0;hi<Math.min(rows.length,5);hi++){
        var idx=rows[hi].indexOf('Folio Fiscal');
        if(idx>=0){colUUID=idx;colRFCEmisor=rows[hi].indexOf('RFC Emisor');colNomEmisor=rows[hi].indexOf('Nombre o Razón Social del Emisor');colRFC=rows[hi].indexOf('RFC Receptor');colNombre=rows[hi].indexOf('Nombre o Razón Social del Receptor');colFecha=rows[hi].indexOf('Fecha de Emisión');colTotal=rows[hi].indexOf('Total');colEfecto=rows[hi].indexOf('Efecto del Comprobante');colEstado=rows[hi].indexOf('Estado del Comprobante');dataStart=hi+1;break;}
      }
      // Fallback posicional para CSV estándar SAT emitidas: A=UUID,B=RFC Emisor,C=Nom Emisor,D=RFC Receptor,E=Nom Receptor,F=Fecha,I=Total,J=Efecto,L=Estado
      if(colUUID<0){colUUID=0;colRFCEmisor=1;colNomEmisor=2;colRFC=3;colNombre=4;colFecha=5;colTotal=8;colEfecto=9;colEstado=11;dataStart=1;}
      for(var i=dataStart;i<rows.length;i++){
        var r=rows[i];var uuid=r[colUUID];
        if(!uuid||String(uuid).length<10)continue;
        var total=parseFloat(String(r[colTotal]||'').replace(/[$,]/g,''))||0;
        if(total<=0)continue;
        var fecha=r[colFecha]?String(r[colFecha]).split('T')[0]:'';
        if(!fecha)continue;
        var d=new Date(fecha+'T12:00');
        var efecto=String(r[colEfecto]||'Ingreso').trim();
        var estado=String(r[colEstado]||'Vigente').trim();
        emitidas.push({uuid:String(uuid),rfc_emisor:String(r[colRFCEmisor]||''),nom_emisor:String(r[colNomEmisor]||''),rfc_receptor:String(r[colRFC]||''),nombre_receptor:String(r[colNombre]||''),fecha_emision:fecha,total:total,efecto:efecto,estado:estado,year:d.getFullYear(),month:d.getMonth()+1,conciliada:false});
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

  function sumByEfecto(arr){
    var r={};
    arr.forEach(function(f){
      var ef=f.efecto||'Ingreso';
      if(ef.toLowerCase()==='pago')return;
      if(!r[ef])r[ef]=0;
      r[ef]+=f.total||0;
    });
    return r;
  }

  function renderResumen(totales,orden){
    return orden.filter(function(ef){return totales[ef];}).map(function(ef){
      var colors={Ingreso:'#3B6D11',Egreso:'#A32D2D','Nómina':'#7B5EA7','Nomina':'#7B5EA7'};
      var c=colors[ef]||'#555';
      return '<span style="margin-right:14px;"><span style="color:#555;">'+ef+':</span> <b style="color:'+c+'">'+fmt(totales[ef])+'</b></span>';
    }).join('');
  }

  var ordenEfectos=['Ingreso','Egreso','Nómina','Nomina'];
  var totalesE=sumByEfecto(emitidas);
  var totalesR=sumByEfecto(recibidas);

  document.getElementById('sat-preview-title').textContent='Previa — '+emitidas.length+' emitidas, '+recibidas.length+' recibidas';

  var html='<div style="margin-bottom:14px;padding:12px;background:#EAF3DE;border-radius:8px;font-size:13px;">'
    +'<div style="margin-bottom:5px;"><b>'+emitidas.length+' emitidas</b> &nbsp; '+renderResumen(totalesE,ordenEfectos)+'</div>'
    +'<div><b>'+recibidas.length+' recibidas</b> &nbsp; '+renderResumen(totalesR,ordenEfectos)+'</div>'
    +'<div style="color:#73726c;font-size:11px;margin-top:6px;">UUIDs ya existentes se omiten automáticamente. · Complementos de pago no suman monto.</div>'
    +'</div>';

  Object.keys(meses).sort().forEach(function(k){
    var m=meses[k];
    html+='<div style="font-weight:500;font-size:13px;margin:12px 0 6px;">'+MONTHS[m.mes-1]+' '+m.año+'</div>';
    if(m.emitidas.length){
      html+='<div style="font-size:11px;color:#3B6D11;margin-bottom:4px;">Emitidas ('+m.emitidas.length+')</div>';
      html+=m.emitidas.map(function(f){
        var ef=f.efecto||'Ingreso';
        var isPago=ef.toLowerCase()==='pago';
        var efColors={Ingreso:'#3B6D11',Egreso:'#A32D2D','Nómina':'#7B5EA7','Nomina':'#7B5EA7',Pago:'#888'};
        var efC=efColors[ef]||'#888';
        return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:.5px solid #eeecea;">'
          +'<span>'+esc((f.nombre_receptor||f.rfc_receptor||'').slice(0,40))+' <span style="font-size:10px;color:'+efC+';background:'+efC+'18;padding:1px 5px;border-radius:3px;">'+ef+'</span></span>'
          +'<span style="color:'+(isPago?'#aaa':efC)+';font-weight:500;">'+(isPago?'—':fmt(f.total))+'</span>'
          +'</div>';
      }).join('');
    }
    if(m.recibidas.length){
      html+='<div style="font-size:11px;color:#A32D2D;margin:8px 0 4px;">Recibidas ('+m.recibidas.length+')</div>';
      html+=m.recibidas.map(function(f){
        var ef=f.efecto||'Ingreso';
        var isPago=ef.toLowerCase()==='pago';
        var efColors={Ingreso:'#A32D2D',Egreso:'#3B6D11','Nómina':'#7B5EA7','Nomina':'#7B5EA7',Pago:'#888'};
        var efC=efColors[ef]||'#888';
        return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:.5px solid #eeecea;">'
          +'<span>'+esc((f.nombre_emisor||f.rfc_emisor||'').slice(0,40))+' <span style="font-size:10px;color:'+efC+';background:'+efC+'18;padding:1px 5px;border-radius:3px;">'+ef+'</span></span>'
          +'<span style="color:'+(isPago?'#aaa':efC)+';font-weight:500;">'+(isPago?'—':fmt(f.total))+'</span>'
          +'</div>';
      }).join('');
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
      var cliMatch=await DB.clientes.byRFC(rfcsE);
      (cliMatch||[]).forEach(function(c){rfcToClienteId[c.rfc]=c.id;});
    }

    // Auto-match proveedores por RFC para recibidas
    var rfcsR=[...new Set(satPendingRecibidas.map(function(f){return f.rfc_emisor;}).filter(Boolean))];
    var rfcToProvId={};
    if(rfcsR.length){
      var provMatch=await DB.proveedores.byRFC(rfcsR);
      (provMatch||[]).forEach(function(p){rfcToProvId[p.rfc]=p.id;});
    }

    satPendingEmitidas.forEach(function(f){
      if(!f.uuid||f.total<=0)return;
      var fechaD=new Date((f.fecha_emision||'')+'T12:00');
      factRows.push({
        uuid_sat:f.uuid,
        numero_factura:null,
        tipo:'emitida',
        fecha:f.fecha_emision,
        emisor_rfc:null, // empresa propia
        emisor_nombre:null,
        receptor_rfc:f.rfc_receptor||null,
        receptor_nombre:f.nombre_receptor||null,
        subtotal:parseFloat(f.subtotal)||0,
        iva:parseFloat(f.iva)||0,
        total:parseFloat(f.total)||0,
        metodo_pago:f.metodo_pago||'PPD',
        forma_pago:f.forma_pago||null,
        uso_cfdi:f.uso_cfdi||null,
        concepto:f.concepto||null,
        estatus:(String(f.estado||'').toLowerCase().includes('cancelad')?'cancelada':'vigente'),
        efecto_sat:f.efecto||'Ingreso',
        conciliado:false,
        complemento_requerido:(f.efecto==='Pago'||(f.metodo_pago||'PPD')==='PPD'),
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
        metodo_pago:f.metodo_pago||'PPD',
        forma_pago:f.forma_pago||null,
        uso_cfdi:f.uso_cfdi||null,
        concepto:f.concepto||null,
        estatus:(String(f.estado||'').toLowerCase().includes('cancelad')?'cancelada':'vigente'),
        efecto_sat:f.efecto||'Ingreso',
        conciliado:false,
        complemento_requerido:(f.efecto==='Pago'||(f.metodo_pago||'PPD')==='PPD'),
        proveedor_id:rfcToProvId[f.rfc_emisor]||null,
        year:isNaN(fechaD.getFullYear())?null:fechaD.getFullYear(),
        month:isNaN(fechaD.getMonth())?null:fechaD.getMonth()+1,
        origen:'sat'
      });
    });

    if(factRows.length){
      await DB.facturas.upsertSAT(factRows);
    }

    // Auto-crear clientes
    var clientesNuevos=0,proveedoresNuevos=0;
    if(satPendingEmitidas.length){
      var emitidasParaClientes=satPendingEmitidas.filter(function(f){var ef=(f.efecto||'').toLowerCase();return ef!=='nómina'&&ef!=='nomina'&&ef!=='pago';});
      var rfcsE=[...new Set(emitidasParaClientes.map(function(f){return f.rfc_receptor;}).filter(Boolean))];
      if(rfcsE.length){
        var cEx=await DB.clientes.byRFC(rfcsE);
        var rfcsExist=new Set((cEx||[]).map(function(c){return c.rfc;}));
        var nc={};
        emitidasParaClientes.forEach(function(f){if(!f.rfc_receptor||rfcsExist.has(f.rfc_receptor)||nc[f.rfc_receptor])return;nc[f.rfc_receptor]={id:'cli_'+f.rfc_receptor.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,16),nombre:f.nombre_receptor||f.rfc_receptor,rfc:f.rfc_receptor,condiciones_pago:'30'};});
        var ncArr=Object.values(nc);
        if(ncArr.length){await DB.clientes.upsertBulk(ncArr);clientesNuevos=ncArr.length;}
      }
    }
    if(satPendingRecibidas.length){
      var rfcsR=[...new Set(satPendingRecibidas.map(function(f){return f.rfc_emisor;}).filter(Boolean))];
      if(rfcsR.length){
        var pEx=await DB.proveedores.byRFC(rfcsR);
        var rfcsPEx=new Set((pEx||[]).map(function(p){return p.rfc;}));
        var np={};
        satPendingRecibidas.forEach(function(f){if(!f.rfc_emisor||rfcsPEx.has(f.rfc_emisor)||np[f.rfc_emisor])return;np[f.rfc_emisor]={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),nombre:f.nombre_emisor||f.rfc_emisor,rfc:f.rfc_emisor,condiciones_pago:'30',tipo:'general'};});
        var npArr=Object.values(np);
        if(npArr.length){await DB.proveedores.upsertBulk(npArr);proveedoresNuevos=npArr.length;}
      }
    }
    // Auto-crear/asociar empleados de registros Nómina
    var empleadosNuevos=0;
    var nominaRows=satPendingEmitidas.filter(function(f){var ef=(f.efecto||'').toLowerCase();return ef==='nómina'||ef==='nomina';});
    if(nominaRows.length){
      var rfcsNom=[...new Set(nominaRows.map(function(f){return f.rfc_receptor;}).filter(Boolean))];
      if(rfcsNom.length){
        var empEx=await DB.empleados.byRFC(rfcsNom);
        var rfcsEmpExist=new Set((empEx||[]).map(function(e){return e.rfc;}));
        var ne=[];
        nominaRows.forEach(function(f){
          if(!f.rfc_receptor||rfcsEmpExist.has(f.rfc_receptor)||ne.find(function(x){return x.rfc===f.rfc_receptor;}))return;
          var partes=(f.nombre_receptor||'').trim().split(/\s+/);
          ne.push({nombre:partes[0]||f.rfc_receptor,apellido:partes.length>1?partes.slice(1).join(' '):null,rfc:f.rfc_receptor,estatus:'Activo',activo:true});
        });
        if(ne.length){await DB.empleados.insertBulk(ne);empleadosNuevos=ne.length;}
      }
    }
    var cntE=satPendingEmitidas.length,cntR=satPendingRecibidas.length;
    cerrarSATPreview();
    var msg='✓ '+cntE+' emitidas, '+cntR+' recibidas importadas';
    if(clientesNuevos)msg+=' · '+clientesNuevos+' clientes creados';
    if(proveedoresNuevos)msg+=' · '+proveedoresNuevos+' proveedores creados';
    if(empleadosNuevos)msg+=' · '+empleadosNuevos+' empleados creados';
    showStatus(msg);
    loadClientes();loadMovements();if(empleadosNuevos&&typeof loadEmpleados==='function')loadEmpleados();
  }catch(e){showError('Error al importar: '+e.message);console.error(e);}
  finally{btn.disabled=false;btn.textContent='Importar';}
}


// ── XML CFDI Import ───────────────────────────────────────

/** Parsea un XML CFDI y extrae los campos relevantes. */
function parsearXMLCFDI(xmlText) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML inválido');

  // Comprobante (puede tener namespace cfdi: o sin prefijo)
  var comp = doc.querySelector('Comprobante') || doc.querySelector('[*|Comprobante]');
  if (!comp) {
    // Intentar con el elemento raíz directamente
    comp = doc.documentElement;
  }

  // Timbre fiscal
  var timbre = doc.querySelector('TimbreFiscalDigital') ||
               doc.querySelector('[*|TimbreFiscalDigital]');
  var uuid = timbre ? (timbre.getAttribute('UUID') || timbre.getAttribute('uuid') || '').toLowerCase() : null;

  var emisor  = doc.querySelector('Emisor')  || doc.querySelector('[*|Emisor]');
  var receptor= doc.querySelector('Receptor')|| doc.querySelector('[*|Receptor]');

  var tipoComp = comp.getAttribute('TipoDeComprobante') || 'I';

  // Para complementos de pago (tipo P): extraer facturas relacionadas
  var docsRelacionados = [];
  if (tipoComp === 'P') {
    var docNodes = doc.querySelectorAll('DoctoRelacionado');
    docNodes.forEach(function(d) {
      var idDoc = d.getAttribute('IdDocumento') || d.getAttribute('iddocumento') || '';
      var impPagado = parseFloat(d.getAttribute('ImpPagado') || '0') || 0;
      var saldoInsoluto = parseFloat(d.getAttribute('ImpSaldoInsoluto') || '-1');
      if (idDoc) docsRelacionados.push({
        uuid: idDoc.toLowerCase(),
        imp_pagado: impPagado,
        saldo_insoluto: saldoInsoluto,
        pagado_completo: saldoInsoluto === 0
      });
    });
  }

  return {
    uuid:            uuid,
    tipo_comprobante: tipoComp,
    fecha:           (comp.getAttribute('Fecha')||'').split('T')[0] || null,
    total:           parseFloat(comp.getAttribute('Total') || comp.getAttribute('total') || '0') || 0,
    tipo_cambio:     parseFloat(comp.getAttribute('TipoCambio') || '1') || 1,
    moneda:          comp.getAttribute('Moneda') || 'MXN',
    metodo_pago:     comp.getAttribute('MetodoPago') || null,
    forma_pago:      comp.getAttribute('FormaPago') || null,
    serie:           comp.getAttribute('Serie') || null,
    folio:           comp.getAttribute('Folio') || null,
    emisor_rfc:      emisor  ? emisor.getAttribute('Rfc')    || emisor.getAttribute('rfc')    : null,
    emisor_nombre:   emisor  ? emisor.getAttribute('Nombre') || emisor.getAttribute('nombre') : null,
    receptor_rfc:    receptor? receptor.getAttribute('Rfc')    || receptor.getAttribute('rfc')    : null,
    receptor_nombre: receptor? receptor.getAttribute('Nombre') || receptor.getAttribute('nombre') : null,
    docs_relacionados: docsRelacionados,
  };
}

/** Lee un File como texto. */
function readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    var r = new FileReader();
    r.onload = function(e) { resolve(e.target.result); };
    r.onerror = reject;
    r.readAsText(file, 'utf-8');
  });
}

/** Maneja la subida de XMLs CFDI. */
async function importarXMLsCFDI(input) {
  var files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  var btn = document.getElementById('xml-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

  var okNuevo = 0, okVinculado = 0, okComplemento = 0, errors = [];
  var rfcEmp = (typeof RFC_EMPRESA !== 'undefined' ? RFC_EMPRESA : '').toUpperCase();

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    try {
      var text = await readFileAsText(file);
      var parsed = parsearXMLCFDI(text);

      if (!parsed.uuid) { errors.push(file.name + ': sin UUID'); continue; }

      // Candado RFC: el emisor o receptor debe ser Grupo M2
      if (rfcEmp) {
        var emisorRfc  = (parsed.emisor_rfc  || '').toUpperCase();
        var receptorRfc= (parsed.receptor_rfc|| '').toUpperCase();
        if (emisorRfc !== rfcEmp && receptorRfc !== rfcEmp) {
          errors.push(file.name + ': RFC no corresponde a esta empresa');
          continue;
        }
      }

      var año = parsed.fecha ? parseInt(parsed.fecha.split('-')[0]) : new Date().getFullYear();
      var path = año + '/' + parsed.uuid + '.xml';

      // ── Complemento de pago (tipo P) ───────────────────────
      if (parsed.tipo_comprobante === 'P') {
        // Subir XML del complemento a Storage para referencia
        await DB.storage.upload(path, new File([text], parsed.uuid + '.xml', { type: 'application/xml' }));

        // Marcar cada factura referenciada según saldo insoluto
        var marcadas = 0;
        for (var j = 0; j < parsed.docs_relacionados.length; j++) {
          var doc = parsed.docs_relacionados[j];
          var facRef = await DB.facturas.get(doc.uuid);
          if (facRef) {
            var update = { id: facRef.id };
            // Si saldo insoluto = 0 → completamente pagada
            if (doc.pagado_completo) update.conciliado = true;
            await DB.facturas.save(update);
            marcadas++;
          }
        }
        okComplemento++;
        if (!marcadas && parsed.docs_relacionados.length) {
          errors.push(file.name + ': complemento procesado pero facturas referenciadas no encontradas en BD');
        }
        continue;
      }

      // ── Factura normal (tipo I, E, N, T) ───────────────────
      // Determinar tipo: emisor = M2 → emitida; receptor = M2 → recibida
      var existing = await DB.facturas.get(parsed.uuid);
      var tipo = existing ? existing.tipo : null;
      if (!tipo && rfcEmp) {
        tipo = (parsed.emisor_rfc || '').toUpperCase() === rfcEmp ? 'emitida' : 'recibida';
      }
      if (!tipo) tipo = 'recibida';

      // Subir XML a Storage
      await DB.storage.upload(path, new File([text], parsed.uuid + '.xml', { type: 'application/xml' }));

      if (existing) {
        await DB.storage.linkPaths(existing.id, { xml_path: path });
        okVinculado++;
      } else {
        var numero = (parsed.serie ? parsed.serie + '-' : '') + (parsed.folio || '');
        await DB.facturas.save({
          id: parsed.uuid,
          uuid_sat: parsed.uuid,
          tipo: tipo,
          emisor_nombre: parsed.emisor_nombre,
          emisor_rfc: parsed.emisor_rfc,
          receptor_nombre: parsed.receptor_nombre,
          receptor_rfc: parsed.receptor_rfc,
          total: parsed.total,
          fecha: parsed.fecha,
          year: año,
          month: parsed.fecha ? parseInt(parsed.fecha.split('-')[1]) : null,
          numero_factura: numero || null,
          metodo_pago: parsed.metodo_pago,
          forma_pago: parsed.forma_pago,
          moneda: parsed.moneda,
          tipo_cambio: parsed.tipo_cambio,
          estatus: 'vigente',
          conciliado: parsed.metodo_pago === 'PUE', // PUE = ya pagada de origen
          xml_path: path,
        });
        okNuevo++;
      }
    } catch(e) {
      errors.push(file.name + ': ' + e.message);
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Subir XMLs'; }

  var totalFacturas = okNuevo + okVinculado;
  var totalGeneral = totalFacturas + okComplemento;

  if (totalGeneral > 0) {
    var partes = [];
    if (okNuevo)        partes.push(okNuevo + ' nueva' + (okNuevo !== 1 ? 's' : ''));
    if (okVinculado)    partes.push(okVinculado + ' vinculada' + (okVinculado !== 1 ? 's' : '') + ' a factura existente');
    if (okComplemento)  partes.push(okComplemento + ' complemento' + (okComplemento !== 1 ? 's' : '') + ' de pago procesado' + (okComplemento !== 1 ? 's' : ''));
    showStatus('✓ ' + totalGeneral + ' XML' + (totalGeneral !== 1 ? 's' : '') + ' procesado' + (totalGeneral !== 1 ? 's' : '') + ' — ' + partes.join(', '));
  }
  if (errors.length) showError(errors.slice(0, 3).join(' | ') + (errors.length > 3 ? ' (+' + (errors.length - 3) + ' más)' : ''));
}
