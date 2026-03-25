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
  banco:     'BBVA \u00b7 CLABE: 012680001205003565 \u00b7 Cuenta: 0120500356',
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
      if(ctPdf) contactoNombre = (ctPdf.nombre||'')+(ctPdf.apellido?' '+ctPdf.apellido:'')+(ctPdf.cargo?' \u00b7 '+ctPdf.cargo:'');
    }catch(e){}
  }
  var usuarioNombre = '';
  if(c.usuario_cliente_id){
    try{
      var usuPdf = await DB.contactos.get(c.usuario_cliente_id);
      if(usuPdf) usuarioNombre = (usuPdf.nombre||'')+(usuPdf.apellido?' '+usuPdf.apellido:'')+(usuPdf.cargo?' \u00b7 '+usuPdf.cargo:'');
    }catch(e){}
  }

  // Logo embebido como PNG base64 (120x120px, compatible con jsPDF)
  var logoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA3cAAAN3CAYAAACRM6MWAAAACXBIWXMAABcRAAAXEQHKJvM/AAAgAElEQVR4nOzd7VXjWNouYPVZ8x9OBDARwERQdATFRFBUBEVFIBRBURGUiWCoCBoiGIjghQheiICzNLN9Wu2yZNnItvaj61rLa7qnwcj6sHTvj2f/9vb2VgAAAJC3/+P4AQAA5E+4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAACEC4AwAA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AOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAg75qmJQAAAfpJREFUAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAgAOEOAAAggP/Xfh3QAADAMAyaf9XX8QZcIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAAECB3AAAAAXIHAAAQIHcAAAABcgcAABAgdwAAAAFyBwAA8N22A++tYjPeOKtbAAAAAElFTkSuQmCC';

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
      dark2:   [80,80,80],       // table header \u2014 entre carbon y brand gray
      gray1:   [245,244,242],    // alternating row
      gray2:   [210,210,210],    // secondary text en header (legible sobre #333)
      gray3:   [170,170,170],    // tertiary text
      text:    [26,26,26],       // main text #1a1a1a
    };

    var fmtDateFull = function(d){ if(!d) return '\u2014'; try{ var dt=new Date(d+'T12:00'); return dt.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}); }catch(e){return d;} };

    // ── Background ────────────────────────────────────────
    doc.setFillColor(...C.bgPage);
    doc.rect(0,0,pw,ph,'F');

    // ── HEADER: dark full-width bar ───────────────────────
    var headerH = 38;
    doc.setFillColor(...C.carbon);
    doc.rect(0,0,pw,headerH,'F');

    // Logo \u2014 red background square + logo image
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
    doc.text((EMPRESA_CONFIG.web||'') + '  \u00b7  ' + (EMPRESA_CONFIG.tel||''), logoRight, 29);

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
    doc.text(c.cliente_nombre||'\u2014', 18, y+13);
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

    // Total \u2014 línea separadora + texto bold rojo
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
          doc.text('\u2022 ' + ct, 12, finalY + (i * 5));
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
    showStatus('\u2713 PDF generado y guardado');
  }catch(e){
    console.error('PDF error:',e);
    showError('Error generando PDF: '+e.message);
  }
}
