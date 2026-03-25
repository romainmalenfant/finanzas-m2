// â”€â”€ Empresa config (editar aquÃ­) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var EMPRESA_CONFIG = {
  nombre:    'Grupo M2',
  slogan:    'Maquinados Industriales',
  direcciones: [
    'Cam, Carr. Pie de Gallo Km 0.10 L3, 76220 Santa Rosa JÃ¡uregui, QuerÃ©taro',
    'Priv. Chairel 100 A, 89359, Tampico, Tamaulipas'
  ],
  web:       'www.grupom2.com.mx',
  tel:       '+52 56 5035 8701',
  email:     'contacto@grupom2.com.mx',
  banco:     'BBVA Â· CLABE: 012680001205003565 Â· Cuenta: 0120500356',
  legal:     'Precios en MXN + IVA. Vigencia segÃºn cotizaciÃ³n. Pedido sujeto a confirmaciÃ³n por escrito. ' +
             'No incluye maniobras de carga/descarga salvo acuerdo. Pagos anticipados no son reembolsables.',
  logo:      null,
  firma_nombre: 'Ing. [Nombre]',
  firma_cargo:  'Director General'
};

// â”€â”€ PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generarPDFCotizacion(id){
  var c = await DB.cotizaciones.get(id);
  if(!c){ showError('CotizaciÃ³n no encontrada'); return; }

  var items = await DB.cotizacionItems.byCotizacion(id);
  items = items||[];

  var contactoNombre = '';
  if(c.contacto_id){
    try{
      var ctPdf = await DB.contactos.get(c.contacto_id);
      if(ctPdf) contactoNombre = (ctPdf.nombre||'')+(ctPdf.apellido?' '+ctPdf.apellido:'')+(ctPdf.cargo?' Â· '+ctPdf.cargo:'');
    }catch(e){}
  }
  var usuarioNombre = '';
  if(c.usuario_cliente_id){
    try{
      var usuPdf = await DB.contactos.get(c.usuario_cliente_id);
      if(usuPdf) usuarioNombre = (usuPdf.nombre||'')+(usuPdf.apellido?' '+usuPdf.apellido:'')+(usuPdf.cargo?' Â· '+usuPdf.cargo:'');
    }catch(e){}
  }

  // Logo embebido como PNG base64 (120x120px, compatible con jsPDF)
  var logoDataUrl = 'data:image/png;base64,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';

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
      dark2:   [80,80,80],       // table header â€” entre carbon y brand gray
      gray1:   [245,244,242],    // alternating row
      gray2:   [210,210,210],    // secondary text en header (legible sobre #333)
      gray3:   [170,170,170],    // tertiary text
      text:    [26,26,26],       // main text #1a1a1a
    };

    var fmtDateFull = function(d){ if(!d) return 'â€”'; try{ var dt=new Date(d+'T12:00'); return dt.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}); }catch(e){return d;} };

    // â”€â”€ Background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFillColor(...C.bgPage);
    doc.rect(0,0,pw,ph,'F');

    // â”€â”€ HEADER: dark full-width bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    var headerH = 38;
    doc.setFillColor(...C.carbon);
    doc.rect(0,0,pw,headerH,'F');

    // Logo â€” red background square + logo image
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
    doc.text((EMPRESA_CONFIG.web||'') + '  Â·  ' + (EMPRESA_CONFIG.tel||''), logoRight, 29);

    // Quote number (right side of header)
    var vLabel = (c.version && c.version > 1) ? ' v' + c.version : '';
    doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red);
    doc.text((c.numero||'COTIZACIÃ“N')+vLabel, pw-12, 18, {align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray2);
    doc.text('Fecha: ' + fmtDateFull(c.fecha), pw-12, 26, {align:'right'});
    doc.text('Vigencia: ' + (c.vigencia_dias||15) + ' dÃ­as hÃ¡biles', pw-12, 33, {align:'right'});

    var y = headerH + 10;

    // â”€â”€ Thin red accent line below header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFillColor(...C.red);
    doc.rect(0,headerH,pw,1.5,'F');

    // â”€â”€ CLIENT BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    var extraRows = (contactoNombre ? 1 : 0) + (usuarioNombre ? 1 : 0);
    var clientH = 16 + extraRows * 7;
    doc.setFillColor(...C.white);
    doc.roundedRect(12, y, 130, clientH, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red);
    doc.text('DIRIGIDO A', 18, y+6);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...C.text);
    doc.text(c.cliente_nombre||'â€”', 18, y+13);
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

    // â”€â”€ ITEMS TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      head:[[ 'DescripciÃ³n', 'Tipo', 'Cant.', 'P. Unitario', 'Subtotal' ]],
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

    // â”€â”€ TOTALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    var tx = pw - 14;
    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3);
    doc.text('Subtotal:', tx-40, finalY); doc.setTextColor(...C.text); doc.text(fmt(c.subtotal||0), tx, finalY, {align:'right'});
    finalY += 6;
    doc.setTextColor(...C.gray3); doc.text('IVA (16%):', tx-40, finalY); doc.setTextColor(...C.text); doc.text(fmt(c.iva||0), tx, finalY, {align:'right'});
    finalY += 7;

    // Total â€” lÃ­nea separadora + texto bold rojo
    doc.setDrawColor(...C.red); doc.setLineWidth(0.6);
    doc.line(tx-60, finalY-2, tx, finalY-2);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.setTextColor(...C.gray3); doc.text('TOTAL:', tx-60, finalY+5);
    doc.setTextColor(...C.red); doc.setFontSize(12);
    doc.text(fmt(c.total||0), tx, finalY+5, {align:'right'});

    // â”€â”€ CONDITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          doc.text('â€¢ ' + ct, 12, finalY + (i * 5));
        });
      }
    }

    // â”€â”€ Signature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    var firmaY = Math.min(finalY + (condIds.length ? condIds.length*5+8 : 18), ph - 38);
    var firmaX = pw - 80;
    doc.setDrawColor(...C.gray2); doc.setLineWidth(0.4);
    doc.line(firmaX, firmaY, firmaX+60, firmaY);
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...C.text);
    doc.text(EMPRESA_CONFIG.firma_nombre, firmaX+30, firmaY+5, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setTextColor(...C.gray3); doc.setFontSize(7.5);
    doc.text(EMPRESA_CONFIG.firma_cargo, firmaX+30, firmaY+10, {align:'center'});

    // â”€â”€ FOOTER: dark bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


    // â”€â”€ Guardar en storage (siempre sobreescribe) â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    showStatus('âœ“ PDF generado y guardado');
  }catch(e){
    console.error('PDF error:',e);
    showError('Error generando PDF: '+e.message);
  }
}
