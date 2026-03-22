// ── Reportes ─────────────────────────────────────────────
// [T7] repTipo → M2State alias en config.js

function abrirReportes(){
  var añoActual=curYear;
  // Poblar selects de mes
  var selMes=document.getElementById('rep-mes-sel');
  selMes.innerHTML=MONTHS.map(function(m,i){return'<option value="'+(i+1)+'"'+(i===curMonth?' selected':'')+'>'+m+'</option>';}).join('');
  // Poblar selects de año
  [document.getElementById('rep-año-mes-sel'),document.getElementById('rep-año-sel')].forEach(function(sel){
    sel.innerHTML='';
    for(var y=añoActual-3;y<=añoActual+1;y++){
      sel.innerHTML+='<option value="'+y+'"'+(y===añoActual?' selected':'')+'>'+y+'</option>';
    }
  });
  document.getElementById('rep-modal').style.display='block';
}

function cerrarReportes(){document.getElementById('rep-modal').style.display='none';}

function selRepTipo(tipo){
  repTipo=tipo;
  document.getElementById('rep-opt-mes').classList.toggle('rep-active',tipo==='mes');
  document.getElementById('rep-opt-año').classList.toggle('rep-active',tipo==='año');
  document.getElementById('rep-config-mes').style.display=tipo==='mes'?'block':'none';
  document.getElementById('rep-config-año').style.display=tipo==='año'?'block':'none';
}

async function generarReporte(){
  var btn=document.getElementById('btn-gen-rep');
  btn.disabled=true; btn.textContent='Generando...';
  try{
    if(repTipo==='mes'){
      var mes=parseInt(document.getElementById('rep-mes-sel').value);
      var año=parseInt(document.getElementById('rep-año-mes-sel').value);
      await generarPDFMensual(mes,año);
    } else {
      var año=parseInt(document.getElementById('rep-año-sel').value);
      await generarPDFAnual(año);
    }
    cerrarReportes();
  }catch(e){showError('Error generando reporte: '+e.message);console.error(e);}
  finally{btn.disabled=false;btn.textContent='Generar PDF ↗';}
}

async function fetchMes(año,mes){
  var {data,error}=await sb.from(TABLE).select('*').eq('year',año).eq('month',mes).order('fecha',{ascending:true});
  if(error)throw error;
  return data||[];
}

function calcMetrics(mvts){
  function s(cats){return mvts.filter(function(m){return cats.includes(m.categoria);}).reduce(function(a,m){return a+Number(m.monto);},0);}
  var v=s(['venta']),c=s(['cobranza']),g=s(['gasto','compra']),x=s(['cuenta_por_cobrar']);
  return{ventas:v,cobr:c,gastos:g,cxc:x,util:v-g,flujo:c-g};
}

function initPDF(){
  var doc=new jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  return doc;
}

function addHeader(doc,titulo,subtitulo){
  doc.setFillColor(26,26,24);
  doc.rect(0,0,210,18,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('GRUPO M2',14,7);
  doc.setFontSize(7); doc.setFont('helvetica','normal');
  doc.text('Maquinado Industrial',14,12);
  doc.setFontSize(8);
  doc.text(titulo,210-14,7,{align:'right'});
  doc.text(subtitulo,210-14,12,{align:'right'});
  doc.setTextColor(26,26,24);
  return 24;
}

function addMetricsTable(doc,y,m){
  var cols=[
    ['Ventas facturadas','$'+Math.round(m.ventas).toLocaleString('es-MX'),'#3B6D11'],
    ['Cobranza cobrada','$'+Math.round(m.cobr).toLocaleString('es-MX'),'#185FA5'],
    ['Gastos / egresos','$'+Math.round(m.gastos).toLocaleString('es-MX'),'#A32D2D'],
    ['Cuentas por cobrar','$'+Math.round(m.cxc).toLocaleString('es-MX'),'#854F0B'],
    ['Utilidad operativa','$'+Math.round(m.util).toLocaleString('es-MX'),m.util>=0?'#3B6D11':'#A32D2D'],
    ['Flujo de caja','$'+Math.round(m.flujo).toLocaleString('es-MX'),m.flujo>=0?'#3B6D11':'#A32D2D'],
  ];
  var cx=14, cw=30, ch=12, gap=3;
  var totalW=(cw+gap)*3-gap;
  var startX=(210-totalW)/2;
  cols.forEach(function(c,i){
    var col=i%3, row=Math.floor(i/3);
    var x=startX+(cw+gap)*col, cy=y+row*(ch+gap);
    doc.setFillColor(245,244,240);
    doc.roundedRect(x,cy,cw,ch,2,2,'F');
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(136,135,128);
    doc.text(c[0],x+cw/2,cy+4,{align:'center'});
    var rgb=hexToRgb(c[2]);
    doc.setTextColor(rgb[0],rgb[1],rgb[2]);
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text(c[1],x+cw/2,cy+9,{align:'center'});
  });
  doc.setTextColor(26,26,24);
  return y+(ch+gap)*2+4;
}

function hexToRgb(hex){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return[r,g,b];
}

function addMovimientosTable(doc,y,mvts){
  if(!mvts.length){
    doc.setFontSize(9); doc.setTextColor(136,135,128);
    doc.text('Sin movimientos registrados.',14,y+6);
    return y+12;
  }
  var rows=mvts.map(function(m){
    return[
      fmtDate(m.fecha),
      (m.descripcion||'').slice(0,45),
      m.contraparte||'',
      CAT_LABELS[m.categoria]||m.categoria,
      (m.categoria==='gasto'?'-':'')+' $'+Math.round(Number(m.monto)).toLocaleString('es-MX'),
      m.usuario||''
    ];
  });
  doc.autoTable({
    startY:y,
    head:[['Fecha','Descripción','Contraparte','Tipo','Monto','Registrado por']],
    body:rows,
    styles:{fontSize:7,cellPadding:2,textColor:[26,26,24]},
    headStyles:{fillColor:[26,26,24],textColor:[255,255,255],fontSize:7,fontStyle:'bold'},
    columnStyles:{0:{cellWidth:18},1:{cellWidth:55},2:{cellWidth:30},3:{cellWidth:22},4:{cellWidth:22,halign:'right'},5:{cellWidth:25}},
    alternateRowStyles:{fillColor:[245,244,240]},
    margin:{left:14,right:14},
    theme:'plain'
  });
  return doc.lastAutoTable.finalY+6;
}

async function generarPDFMensual(mes,año){
  var mvts=await fetchMes(año,mes);
  var m=calcMetrics(mvts);
  var doc=initPDF();
  var y=addHeader(doc,'Reporte Mensual',MONTHS[mes-1]+' '+año);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text(MONTHS[mes-1]+' '+año,14,y);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(115,114,108);
  doc.text('Generado el '+new Date().toLocaleDateString('es-MX')+' · '+mvts.length+' movimientos',14,y+5);
  doc.setTextColor(26,26,24);
  y=addMetricsTable(doc,y+10,m);
  doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text('Detalle de movimientos',14,y);
  y=addMovimientosTable(doc,y+4,mvts);
  doc.save('GrupoM2_'+MONTHS[mes-1]+'_'+año+'.pdf');
}

async function generarPDFAnual(año){
  var doc=initPDF();
  var y=addHeader(doc,'Reporte Anual',''+año);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Resumen Anual '+año,14,y);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(115,114,108);
  doc.text('Generado el '+new Date().toLocaleDateString('es-MX'),14,y+5);
  doc.setTextColor(26,26,24);
  y+=12;
  // Tabla resumen por mes
  var resumenRows=[];
  var totales={ventas:0,cobr:0,gastos:0,cxc:0,util:0,flujo:0};
  for(var mes=1;mes<=12;mes++){
    var mvts=await fetchMes(año,mes);
    if(!mvts.length)continue;
    var m=calcMetrics(mvts);
    totales.ventas+=m.ventas; totales.cobr+=m.cobr; totales.gastos+=m.gastos;
    totales.cxc+=m.cxc; totales.util+=m.util; totales.flujo+=m.flujo;
    resumenRows.push([
      MONTHS[mes-1],
      '$'+Math.round(m.ventas).toLocaleString('es-MX'),
      '$'+Math.round(m.cobr).toLocaleString('es-MX'),
      '$'+Math.round(m.gastos).toLocaleString('es-MX'),
      '$'+Math.round(m.util).toLocaleString('es-MX'),
      '$'+Math.round(m.flujo).toLocaleString('es-MX'),
    ]);
  }
  // Fila totales
  resumenRows.push([
    'TOTAL',
    '$'+Math.round(totales.ventas).toLocaleString('es-MX'),
    '$'+Math.round(totales.cobr).toLocaleString('es-MX'),
    '$'+Math.round(totales.gastos).toLocaleString('es-MX'),
    '$'+Math.round(totales.util).toLocaleString('es-MX'),
    '$'+Math.round(totales.flujo).toLocaleString('es-MX'),
  ]);
  doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text('Resumen por mes',14,y);
  doc.autoTable({
    startY:y+4,
    head:[['Mes','Ventas','Cobranza','Gastos','Utilidad','Flujo caja']],
    body:resumenRows,
    styles:{fontSize:8,cellPadding:2.5,textColor:[26,26,24]},
    headStyles:{fillColor:[26,26,24],textColor:[255,255,255],fontSize:7,fontStyle:'bold'},
    columnStyles:{0:{cellWidth:28},1:{cellWidth:28,halign:'right'},2:{cellWidth:28,halign:'right'},3:{cellWidth:28,halign:'right'},4:{cellWidth:28,halign:'right'},5:{cellWidth:28,halign:'right'}},
    alternateRowStyles:{fillColor:[245,244,240]},
    margin:{left:14,right:14},
    theme:'plain',
    didParseCell:function(d){
      if(d.row.index===resumenRows.length-1){
        d.cell.styles.fontStyle='bold';
        d.cell.styles.fillColor=[232,230,224];
      }
    }
  });
  doc.save('GrupoM2_Anual_'+año+'.pdf');
}

