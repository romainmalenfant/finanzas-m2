// ── Etiqueta de gasto ────────────────────────────────────
var etiquetaSeleccionada='';
function detectarGasto(texto){
  var t=texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  var esGasto=t.match(/pag[ao]|nomin|compr[ao]|gast|egres|proveedor|renta|servicio|material|herramienta|combustible|luz\b|agua\b|telefon|internet|manten|reparac|flete|envio|seguro|impuest|iva|isr|sueldo|mutuo|utilidad/);
  var row=document.getElementById('etiqueta-row');
  if(esGasto){
    row.style.display='block';
    // Auto-sugerir etiqueta
    if(!etiquetaSeleccionada){
      var sugerida='';
      if(t.match(/nomin|sueldo/))sugerida='Nómina';
      else if(t.match(/renta/))sugerida='Renta';
      else if(t.match(/material/))sugerida='Material';
      else if(t.match(/herramienta/))sugerida='Herramienta';
      else if(t.match(/manten/))sugerida='Mantenimiento';
      else if(t.match(/flete|envio|transport/))sugerida='Transporte';
      else if(t.match(/impuest|iva|isr/))sugerida='Impuestos';
      else if(t.match(/mutuo/))sugerida='Mutuo';
      else if(t.match(/luz|agua|telefon|internet|utilidad/))sugerida='Utilidades';
      if(sugerida)selEtiqueta(null,sugerida);
    }
  } else {
    row.style.display='none';
    etiquetaSeleccionada='';
    document.querySelectorAll('.etiq-btn').forEach(function(b){b.classList.remove('active');});
  }
}
function selEtiqueta(btn,etiq){
  etiquetaSeleccionada=etiq;
  document.querySelectorAll('.etiq-btn').forEach(function(b){b.classList.remove('active');});
  if(btn){btn.classList.add('active');}
  else{
    document.querySelectorAll('.etiq-btn').forEach(function(b){
      if(b.textContent===etiq)b.classList.add('active');
    });
  }
}
function clasificar(texto){
  var t=texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  // Monto — encuentra cualquier número en el texto
  var monto=0;
  var numeros=t.match(/[\d]+(?:[,\.][\d]+)*/g);
  if(numeros){
    var base=parseFloat(numeros[0].replace(/,/g,''))||0;
    // Buscar multiplicador justo después del número
    var mulMatch=t.match(/([\d]+(?:[,\.][\d]+)*)\s*(mil\b|k\b|millones?\b|mdp\b)/);
    if(mulMatch){
      base=parseFloat(mulMatch[1].replace(/,/g,''))||0;
      if(mulMatch[2].match(/mil|k/))base*=1000;
      if(mulMatch[2].match(/millon/))base*=1000000;
    }
    monto=base;
  }
  // Fecha — detectar expresiones temporales
  var fechaBase=new Date();
  var mvYear=fechaBase.getFullYear();
  var mvMonth=fechaBase.getMonth()+1;

  // Detectar mes específico mencionado ("en enero", "de marzo", etc.)
  var mesesNombres=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var mesEncontrado=null;
  mesesNombres.forEach(function(m,i){
    if(t.includes(m))mesEncontrado=i+1;
  });

  if(mesEncontrado){
    mvMonth=mesEncontrado;
    // Si el mes mencionado es futuro en este año, asumimos año pasado
    var ahora=new Date();
    if(mesEncontrado > ahora.getMonth()+1){
      mvYear=ahora.getFullYear()-1;
    }
    fechaBase=new Date(mvYear+'-'+String(mvMonth).padStart(2,'0')+'-01');
  } else if(t.match(/mes pasado|mes anterior|el mes que paso/)){
    fechaBase.setMonth(fechaBase.getMonth()-1);
    mvYear=fechaBase.getFullYear();
    mvMonth=fechaBase.getMonth()+1;
  } else if(t.match(/\bayer\b|el d[ií]a de ayer/)){
    fechaBase.setDate(fechaBase.getDate()-1);
    mvYear=fechaBase.getFullYear();
    mvMonth=fechaBase.getMonth()+1;
  } else if(t.match(/antier|anteayer|hace dos d[ií]as/)){
    fechaBase.setDate(fechaBase.getDate()-2);
    mvYear=fechaBase.getFullYear();
    mvMonth=fechaBase.getMonth()+1;
  }

  var fecha=fechaBase.toISOString().split('T')[0];
  // Categoría
  var cat='gasto';
  if(t.match(/factur|vendimos|vend[eoii]|vendi\b|cotiz.*acept|pedido.*cerr|orden.*compra|cerramos|contrato.*firm|nueva.*venta|cerr.*venta/))cat='venta';
  else if(t.match(/deposit|nos.*pagaron|transfiri|nos.*pag|recib.*pago|cobramos|liquid|abono.*recib|pagaron/))cat='cobranza';
  else if(t.match(/deben|pendiente.*cobr|por cobrar|no.*han.*pag|sin.*pag|nos.*debe|adeud|factur.*pendiente/))cat='cuenta_por_cobrar';
  else if(t.match(/pag[ao]|nomin|compr[ao]|gast|egres|proveedor|renta|servicio|material|herramienta|combustible|luz\b|agua\b|telefon|internet|manten|reparac|flete|envio|seguro|impuest|iva|isr|sueldo/))cat='gasto';
  // Contraparte
  var contra='';
  var cp=texto.match(/(?:\s[aA]\s|\sde\s|\sDe\s|\scon\s|\spara\s)\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s]{1,30}?)(?:\s+por\b|\s+de\b|\s*$|,)/);
  if(cp)contra=cp[1].trim();
  // Descripción = texto completo
  var desc=texto.charAt(0).toUpperCase()+texto.slice(1);
  return{amount:monto,category:cat,description:desc,counterpart:contra,fecha:fecha,year:mvYear,month:mvMonth};
}

async function processMovement(){
  var inp=document.getElementById('mvmt-input');
  var text=inp.value.trim();
  if(!text)return;

  var userName=getUserName();
  if(!userName){
    var n=prompt('¿Cuál es tu nombre? (se mostrará en los movimientos)');
    if(!n||!n.trim()){showStatus('Escribe tu nombre para continuar.');return;}
    saveName(n.trim());
    document.getElementById('user-name-input').value=n.trim();
    userName=n.trim();
  }

  var btn=document.getElementById('btn-submit');
  btn.disabled=true;
  showStatus('Procesando...',0);

  try{
    var p=clasificar(text);
    // ── Verificar duplicado ──────────────────────────────
    var dup=findDuplicate(p.amount,p.fecha,p.category);
    if(dup){
      var confirmar=confirm(
        '⚠️ Posible duplicado detectado:\n\n'+
        '"'+dup.descripcion.slice(0,60)+'"\n'+
        'Monto: $'+Math.round(dup.monto).toLocaleString('es-MX')+
        ' · Fecha: '+fmtDate(dup.fecha)+
        ' · Registrado por: '+(dup.usuario||'desconocido')+
        '\n\n¿Es un movimiento diferente y quieres registrarlo de todas formas?'
      );
      if(!confirmar){
        showStatus('Movimiento no registrado (posible duplicado).',3000);
        btn.disabled=false;
        return;
      }
    }
    var mv={
      id:Date.now().toString()+Math.random().toString(36).slice(2,7),
      fecha:p.fecha,
      raw_text:text,
      descripcion:p.description||text.slice(0,50),
      contraparte:p.counterpart||'',
      monto:Math.abs(p.amount||0),
      categoria:p.category,
      year:p.year,
      month:p.month,
      usuario:userName,
      etiqueta:(p.category==='gasto'&&etiquetaSeleccionada)?etiquetaSeleccionada:null
    };
    await insertMovement(mv);
    var mesDistinto=(p.year!==curYear||p.month!==curMonth+1);
    var msgMes=mesDistinto?' (guardado en '+['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][p.month-1]+')':'';
    inp.value='';
    etiquetaSeleccionada='';
    document.getElementById('etiqueta-row').style.display='none';
    document.querySelectorAll('.etiq-btn').forEach(function(b){b.classList.remove('active');});
    showStatus('✓ '+CAT_LABELS[mv.categoria]+(mv.etiqueta?' · '+mv.etiqueta:'')+' · $'+Math.round(mv.monto).toLocaleString('es-MX')+msgMes);
    await loadMovements();
  }catch(e){
    console.error(e);
    showError('Error al guardar: '+e.message);
    var _sm=document.getElementById('status-msg');if(_sm)_sm.textContent='';
  }finally{
    btn.disabled=false;
  }
}


// ── Metrics ──────────────────────────────────────────────
function computeMetrics(){
  function sum(cats){return movements.filter(function(m){return cats.includes(m.categoria);}).reduce(function(a,m){return a+Number(m.monto);},0);}
  var v=sum(['venta']),c=sum(['cobranza']),g=sum(['gasto','compra']),x=sum(['cuenta_por_cobrar']);
  return{ventas:v,cobr:c,gastos:g,cxc:x,util:v-g,flujo:c-g};
}

// ── Render ───────────────────────────────────────────────
function render(){
  document.getElementById('month-label').textContent=MONTHS[curMonth]+' '+curYear;
  var m=computeMetrics();
  document.getElementById('m-ventas').textContent=fmt(m.ventas);
  document.getElementById('m-cobr').textContent=fmt(m.cobr);
  document.getElementById('m-gasto').textContent=fmt(m.gastos);
  document.getElementById('m-cxc').textContent=fmt(m.cxc);
  var uel=document.getElementById('m-util');
  uel.textContent=fmt(m.util);
  uel.className='mvalue '+(m.util>=0?'c-util-pos':'c-util-neg');
  var fel=document.getElementById('m-flujo');
  fel.textContent=fmt(m.flujo);
  fel.className='mvalue '+(m.flujo>=0?'c-util-pos':'c-util-neg');
  renderChart(m);
  renderMovements();
  loadFinanzasKPIs();
}

function renderChart(m){
  var ctx=document.getElementById('myChart');ctx.style.background='transparent';
  var vals=[m.ventas,m.cobr,m.gastos,m.cxc];
  var bg=['#34d39933','#60a5fa33','#f8717133','#fbbf2433'];
  var br=['#34d399','#60a5fa','#f87171','#fbbf24'];
  if(myChart){myChart.destroy();}
  myChart=new Chart(ctx,{
    type:'bar',
    data:{labels:['Ventas','Cobranza','Gastos','Ctas x cobrar'],datasets:[{data:vals,backgroundColor:bg,borderColor:br,borderWidth:1.5,borderRadius:4}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return fmt(c.parsed.y);}}}},
      scales:{
        y:{beginAtZero:true,ticks:{callback:function(v){return'$'+Math.round(v/1000)+'k';},color:'#33415580',font:{size:10}},grid:{color:'rgba(255,255,255,.05)'}},
        x:{ticks:{color:'#47556980',font:{size:11}},grid:{display:false}}
      }
    }
  });
}

// ── Sort helpers ─────────────────────────────────────────
var lastEmitidas=[], lastRecibidas=[], lastBanco=[];

function sortList(list, sortKey){
  var sorted=list.slice();
  if(sortKey==='fecha_desc')sorted.sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});
  else if(sortKey==='fecha_asc')sorted.sort(function(a,b){return (a.fecha||'').localeCompare(b.fecha||'');});
  else if(sortKey==='monto_desc')sorted.sort(function(a,b){return Number(b.monto)-Number(a.monto);});
  else if(sortKey==='monto_asc')sorted.sort(function(a,b){return Number(a.monto)-Number(b.monto);});
  return sorted;
}

function sortAndRender(){
  var sortKey=document.getElementById('mvmt-sort').value;
  var sorted=sortList(movements, sortKey);
  var me=getUserName();
  var el=document.getElementById('mvmts-list');
  el.innerHTML=sorted.map(function(m){
    var isOwn=!m.usuario||(m.usuario===me);
    return '<div class="mvmt-item">'+
      '<div class="mvmt-dot" style="background:'+(CAT_COLORS[m.categoria]||'#888')+'"></div>'+
      '<div class="mvmt-info">'+
        '<div class="mvmt-desc">'+esc(m.descripcion)+(m.contraparte?' · <span style="font-weight:400">'+esc(m.contraparte)+'</span>':'')+'</div>'+
        '<div class="mvmt-meta">'+
          '<span class="badge '+(CAT_BADGE[m.categoria]||'bg')+'">'+(CAT_LABELS[m.categoria]||m.categoria)+'</span>'+
          (m.etiqueta?'<span class="badge" style="background:var(--bg-hover);color:var(--text-2);">'+esc(m.etiqueta)+'</span>':'')+
          (m.metodo_pago?'<span class="badge" style="background:var(--bg-hover);color:var(--text-2);">'+esc(m.metodo_pago)+'</span>':'')+
          (m.moneda&&m.moneda!=='MXN'?'<span class="badge" style="background:#dbeafe;color:#1d4ed8;">'+esc(m.moneda)+'</span>':'')+
          (m.origen==='banco_abono'||m.origen==='banco_cargo'?'<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-size:9px;">'+(m.origen==='banco_abono'?'Banco +':'Banco −')+'</span>':'')+
          (m.usuario&&m.usuario!=='SAT'&&m.usuario!=='BBVA'?'<span class="badge badge-user">'+esc(m.usuario)+'</span>':'')+
          '<span class="mvmt-date">'+fmtDate(m.fecha)+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="mvmt-amount" style="color:'+(CAT_COLORS[m.categoria]||'#888')+'">'+(m.tipo==='egreso'||m.categoria==='gasto'||m.categoria==='compra'?'−':'+')+fmt(m.monto)+'</div>'+
      '<button class="btn-del '+(isOwn?'btn-del-own':'')+'" onclick="deleteMovement(\''+esc(m.id)+'\',\''+esc(m.usuario||'')+'\');" title="'+(isOwn?'Eliminar':'Eliminar (de otro usuario)')+'">×</button>'+
    '</div>';
  }).join('');
}

function renderMovements(){
  var el=document.getElementById('mvmts-list');
  var ct=document.getElementById('mvmt-count');
  ct.textContent=movements.length+' movimiento'+(movements.length!==1?'s':'');
  if(!movements.length){el.innerHTML='<div class="empty-state">Sin movimientos registrados este mes</div>';return;}
  sortAndRender();
}


// ── Detección de duplicados ──────────────────────────────
function findDuplicate(monto, fecha, categoria){
  // Solo compara dentro de la misma dirección: ingresos vs ingresos, egresos vs egresos
  var ingresos=['venta','cobranza'];
  var egresos=['gasto','cuenta_por_cobrar'];
  var dirNuevo=ingresos.includes(categoria)?'ingreso':'egreso';

  var fechaD=new Date(fecha+'T12:00');
  return movements.find(function(m){
    // Misma dirección financiera (no comparar venta con gasto)
    var dirExist=ingresos.includes(m.categoria)?'ingreso':'egreso';
    if(dirNuevo!==dirExist)return false;
    // Mismo monto ±5%
    var diff=Math.abs(Number(m.monto)-monto)/Math.max(monto,1);
    if(diff>0.05)return false;
    // Fecha dentro de 10 días
    var mFecha=new Date(m.fecha+'T12:00');
    var dias=Math.abs((fechaD-mFecha)/(1000*60*60*24));
    return dias<=10;
  })||null;
}

// ── Extracción de movimientos desde texto PDF ────────────
function extraerMovimientosDePDF(texto, fileName){
  var lineas=texto.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>3;});
  var detectados=[];
  var tipoArchivo='generico';
  // Detectar tipo
  if(/comprobante|cfdi|rfc|folio fiscal|uuid/i.test(texto))tipoArchivo='factura_sat';
  else if(/estado de cuenta|saldo|cargo|abono|referencia/i.test(texto))tipoArchivo='estado_cuenta';
  else if(/proveedor|factura.*proveedor|compra/i.test(texto))tipoArchivo='factura_proveedor';

  if(tipoArchivo==='factura_sat'){
    // Factura SAT: buscar total, RFC receptor, fecha
    var total=texto.match(/total[:\s]+\$?\s*([\d,\.]+)/i);
    var receptor=texto.match(/receptor[:\s\n]+([A-ZÁÉÍÓÚÑa-z\s]{3,50})/i);
    var fecha=texto.match(/fecha[:\s]+([\d]{4}-[\d]{2}-[\d]{2}|[\d]{2}\/[\d]{2}\/[\d]{4})/i);
    var uuid=texto.match(/uuid[:\s]+([a-f0-9\-]{36})/i);
    if(total){
      var monto=parseFloat(total[1].replace(/,/g,''))||0;
      var contra=receptor?receptor[1].trim().slice(0,40):'';
      var fStr=fecha?normalizarFecha(fecha[1]):new Date().toISOString().split('T')[0];
      detectados.push({
        monto:monto, categoria:'venta', contraparte:contra,
        descripcion:'Factura SAT'+(contra?' · '+contra:''),
        fecha:fStr, fuente:fileName, ref:uuid?uuid[1].slice(0,8):'',
        raw_text:'PDF: '+fileName
      });
    }
  } else if(tipoArchivo==='estado_cuenta'){
    // Estado de cuenta: buscar filas con fecha + monto + cargo/abono
    var patron=/(\d{2}[\/-]\d{2}[\/-]\d{2,4})\s+(.{5,50}?)\s+([\d,\.]+)\s*(cargo|abono|dep[oó]sito|retiro)?/gi;
    var match;
    while((match=patron.exec(texto))!==null){
      var m=parseFloat(match[3].replace(/,/g,''))||0;
      if(m<10)continue;
      var tipo=match[4]?match[4].toLowerCase():'';
      var cat=(tipo.match(/abono|dep/))?'cobranza':'gasto';
      detectados.push({
        monto:m, categoria:cat, contraparte:'',
        descripcion:match[2].trim().slice(0,60),
        fecha:normalizarFecha(match[1]),
        fuente:fileName, ref:'', raw_text:'PDF: '+fileName
      });
      if(detectados.length>=50)break;
    }
  } else {
    // Genérico: buscar cualquier línea con monto
    var patronGen=/([\d]{1,3}(?:,[\d]{3})*(?:\.[\d]{1,2})?|[\d]{3,}(?:\.[\d]{1,2})?)/g;
    lineas.forEach(function(linea){
      var nums=linea.match(patronGen);
      if(!nums)return;
      var montos=nums.map(function(n){return parseFloat(n.replace(/,/g,''));}).filter(function(n){return n>=100&&n<=9999999;});
      if(!montos.length)return;
      var monto=Math.max.apply(null,montos);
      var p=clasificar(linea);
      detectados.push({
        monto:monto, categoria:p.category, contraparte:p.counterpart,
        descripcion:linea.slice(0,80),
        fecha:p.fecha, fuente:fileName, ref:'',
        raw_text:'PDF: '+fileName+' · '+linea.slice(0,60)
      });
    });
    // Limitar y quitar duplicados por monto+descripción
    var vistos={};
    detectados=detectados.filter(function(d){
      var k=d.monto+'|'+d.descripcion.slice(0,20);
      if(vistos[k])return false;
      vistos[k]=true;return true;
    }).slice(0,30);
  }
  return detectados;
}

function normalizarFecha(str){
  if(!str)return new Date().toISOString().split('T')[0];
  // dd/mm/yyyy o dd-mm-yyyy → yyyy-mm-dd
  var m=str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if(m){
    var y=m[3].length===2?'20'+m[3]:m[3];
    return y+'-'+m[2]+'-'+m[1];
  }
  // yyyy-mm-dd ya correcto
  if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str;
  return new Date().toISOString().split('T')[0];
}

