
// ── FAB visibility — show only on dashboard and flujo ────
function showFAB(){ var f=document.getElementById('fab-container'); if(f) f.style.display='flex'; }
function hideFAB(){ var f=document.getElementById('fab-container'); cerrarFAB(); if(f) f.style.display='none'; }

// ── Cache layer ───────────────────────────────────────────
var _cache={};
var CACHE_TTL=5*60*1000; // 5 minutos

function cacheSet(key,data){_cache[key]={data:data,ts:Date.now()};}
function cacheGet(key){var c=_cache[key];return(c&&Date.now()-c.ts<CACHE_TTL)?c.data:null;}
function cacheInvalidate(key){delete _cache[key];}
function cacheInvalidateAll(){_cache={};}

// Shared CxC/CxP data — populated by loadCxC/loadCxP, reused by Claude
// [T7] _cxcRows/_cxpRows/_ytdMvmts → M2State aliases en config.js

// ── Finanzas KPIs ─────────────────────────────────────────
// Derives from in-memory movements — no extra query needed
async function loadFinanzasKPIs(){
  try{
    var rows = movements||[];
    // Ingresos = todo tipo='ingreso' excepto préstamos inter-empresa
    var ingresos = rows.filter(function(m){
      return m.tipo==='ingreso' && m.categoria!=='prestamo';
    }).reduce(function(a,m){ return a+(parseFloat(m.monto)||0); }, 0);
    // Egresos = todo tipo='egreso' excepto préstamos inter-empresa
    var egresos = rows.filter(function(m){
      return m.tipo==='egreso' && m.categoria!=='prestamo';
    }).reduce(function(a,m){ return a+(parseFloat(m.monto)||0); }, 0);
    var saldo = ingresos - egresos;
    var set=function(id,v,cls){var el=document.getElementById(id);if(!el)return;el.textContent=fmt(v);if(cls)el.className='mvalue '+(cls||'');};
    set('fin-ingresos', ingresos, 'c-green');
    set('fin-egresos',  egresos,  'c-amber');
    var saldoEl=document.getElementById('fin-saldo');
    if(saldoEl){saldoEl.textContent=fmt(saldo);saldoEl.className='mvalue '+(saldo>=0?'c-util-pos':'c-util-neg');}
  }catch(e){console.error('Flujo KPIs:',e);}
}

// ── Motor de consultas en lenguaje natural ───────────────
async function responderConsulta(){
  var inp=document.getElementById('query-input');
  var q=inp.value.trim();
  if(!q)return;
  var resp=document.getElementById('query-result');
  resp.innerHTML='<span style="color:#60a5fa;font-size:12px;">Consultando...</span>';


  try{
    // ── Contexto financiero enfocado en año en curso ──────
    var año=new Date().getFullYear();
    var MONTHS_ES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // Todos los movimientos del año — base de todo
    var mvmts;
    var cachedYTD=cacheGet('ytd_'+año);
    if(cachedYTD){
      mvmts=cachedYTD;
    }else{
      var {data:allMvmts}=await sb.from('movimientos_v2')
        .select('categoria,tipo,monto,fecha,month,contraparte,rfc_contraparte,descripcion,origen,conciliado,etiqueta,numero_factura,moneda')
        .eq('year',año).order('fecha',{ascending:false}).limit(2000);
      mvmts=allMvmts||[];
      cacheSet('ytd_'+año,mvmts);
    }
    _ytdMvmts=mvmts;

    // YTD resumen
    var ventasYTD=mvmts.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var cobrYTD=mvmts.filter(function(m){return m.tipo==='ingreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var gastoYTD=mvmts.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var utilYTD=ventasYTD-gastoYTD;
    var flujoYTD=cobrYTD-gastoYTD;

    // Ventas por mes
    var ventasMes={};
    mvmts.filter(function(m){return m.categoria==='venta';}).forEach(function(m){
      var k=MONTHS_ES[(m.month||1)-1];
      ventasMes[k]=(ventasMes[k]||0)+(parseFloat(m.monto)||0);
    });
    var resumenMeses=Object.entries(ventasMes).map(function(e){
      return e[0]+': $'+Math.round(e[1]).toLocaleString('es-MX');
    }).join(' | ');

    // Cobranza por mes
    var cobrMes={};
    mvmts.filter(function(m){return m.tipo==='ingreso'&&m.categoria!=='prestamo';}).forEach(function(m){
      var k=MONTHS_ES[(m.month||1)-1];
      cobrMes[k]=(cobrMes[k]||0)+(parseFloat(m.monto)||0);
    });
    var resumenCobrMes=Object.entries(cobrMes).map(function(e){
      return e[0]+': $'+Math.round(e[1]).toLocaleString('es-MX');
    }).join(' | ');

    // Gastos por mes
    var gastosMes={};
    mvmts.filter(function(m){return m.tipo==='egreso';}).forEach(function(m){
      var k=MONTHS_ES[(m.month||1)-1];
      gastosMes[k]=(gastosMes[k]||0)+(parseFloat(m.monto)||0);
    });
    var resumenGastosMes=Object.entries(gastosMes).map(function(e){
      return e[0]+': $'+Math.round(e[1]).toLocaleString('es-MX');
    }).join(' | ');

    // Ventas por cliente (YTD)
    var ventasByCliente={};
    mvmts.filter(function(m){return m.categoria==='venta';}).forEach(function(m){
      var k=(m.contraparte||'Sin nombre').trim();
      ventasByCliente[k]=(ventasByCliente[k]||0)+(parseFloat(m.monto)||0);
    });
    var topVentasCliente=Object.entries(ventasByCliente).sort(function(a,b){return b[1]-a[1];})
      .map(function(d){return d[0]+': $'+Math.round(d[1]).toLocaleString('es-MX');}).join('\n');

    // Gastos por etiqueta/proveedor
    var gastosByProv={};
    mvmts.filter(function(m){return m.tipo==='egreso';}).forEach(function(m){
      var k=(m.contraparte||m.etiqueta||'Sin clasificar').trim();
      gastosByProv[k]=(gastosByProv[k]||0)+(parseFloat(m.monto)||0);
    });
    var topGastos=Object.entries(gastosByProv).sort(function(a,b){return b[1]-a[1];}).slice(0,15)
      .map(function(d){return d[0]+': $'+Math.round(d[1]).toLocaleString('es-MX');}).join('\n');

    // CxC — facturas sin cobrar con antigüedad
    var {data:cxcRows}=await sb.from('facturas')
      .select('receptor_nombre,receptor_rfc,total,fecha,numero_factura,concepto')
      .eq('tipo','emitida').eq('conciliado',false).neq('estatus','cancelada')
      .order('fecha',{ascending:true});
    _cxcRows=(cxcRows||[]).map(function(m){return {contraparte:m.receptor_nombre,rfc_contraparte:m.receptor_rfc,monto:m.total,fecha:m.fecha,numero_factura:m.numero_factura};});
    updateBadges();
    var cxcTotal=_cxcRows.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var hoy=new Date();
    // Also add ventas directas count to context
    var {data:vtaDirectas}=await sb.from('facturas').select('total').eq('tipo','emitida').eq('sin_factura',true).eq('year',año);
    var vtaDirectasTotal=(vtaDirectas||[]).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);

    var cxcDetalle=_cxcRows.map(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return (m.contraparte||m.rfc_contraparte||'?')+
        (m.numero_factura?' | folio:'+m.numero_factura:'')+
        ' | $'+Math.round((parseFloat(m.monto)||0)).toLocaleString('es-MX')+
        ' | fecha:'+m.fecha+' | '+dias+'d sin cobrar';
    }).join('\n');

    // CxP — facturas sin pagar con antigüedad
    var {data:cxpRows}=await sb.from('facturas')
      .select('emisor_nombre,emisor_rfc,total,fecha,numero_factura,concepto')
      .eq('tipo','recibida').eq('conciliado',false).neq('estatus','cancelada').eq('efecto_sat','Ingreso')
      .order('fecha',{ascending:true});
    _cxpRows=(cxpRows||[]).map(function(m){return {contraparte:m.emisor_nombre,rfc_contraparte:m.emisor_rfc,monto:m.total,fecha:m.fecha,numero_factura:m.numero_factura};});
    updateBadges();
    var cxpTotal=_cxpRows.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var cxpDetalle=_cxpRows.map(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return (m.contraparte||m.rfc_contraparte||'?')+
        (m.numero_factura?' | folio:'+m.numero_factura:'')+
        ' | $'+Math.round((parseFloat(m.monto)||0)).toLocaleString('es-MX')+
        ' | fecha:'+m.fecha+' | '+dias+'d sin pagar';
    }).join('\n');

    // Proyectos del año
    var {data:projRows}=await sb.from('proyectos').select('*').eq('year',año).order('fecha_entrega',{ascending:true});
    var proyectosDetalle=(projRows||[]).map(function(p){
      return p.nombre_cliente+' | '+p.nombre_pedido+
        ' | piezas:'+p.total_piezas+
        ' | monto:$'+(p.monto_total||0)+
        ' | pedido:'+p.fecha_pedido+
        ' | entrega:'+p.fecha_entrega+
        (p.notas?' | notas:'+p.notas:'');
    }).join('\n');

    // Clientes registrados con todos sus campos
    var clientesDetalle=clientes.map(function(c){
      return c.nombre+(c.rfc?' | RFC:'+c.rfc:'')+(c.ciudad?' | '+c.ciudad:'')+(c.condiciones_pago?' | pago:'+c.condiciones_pago+'d':'');
    }).join('\n');

    // Construir prompt compacto
    var contextStr=
      'Empresa: Grupo M2 — Maquinado Industrial, Querétaro, México.\n'+
      'Fecha hoy: '+hoy.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'})+'.\n\n'+

      '## FINANZAS '+año+' (YTD)\n'+
      'Ventas: $'+Math.round(ventasYTD).toLocaleString('es-MX')+
      ' | Cobranza: $'+Math.round(cobrYTD).toLocaleString('es-MX')+
      ' | Gastos: $'+Math.round(gastoYTD).toLocaleString('es-MX')+
      ' | Utilidad: $'+Math.round(utilYTD).toLocaleString('es-MX')+
      ' | Flujo: $'+Math.round(flujoYTD).toLocaleString('es-MX')+'\n\n'+

      '## VENTAS POR MES\n'+resumenMeses+'\n\n'+

      '## COBRANZA POR MES\n'+resumenCobrMes+'\n\n'+

      '## GASTOS POR MES\n'+resumenGastosMes+'\n\n'+

      '## VENTAS POR CLIENTE (YTD)\n'+topVentasCliente+'\n\n'+

      '## GASTOS POR PROVEEDOR/CATEGORÍA (YTD)\n'+topGastos+'\n\n'+

      '## CUENTAS POR COBRAR — '+( cxcRows||[]).length+' facturas | Total: $'+Math.round(cxcTotal).toLocaleString('es-MX')+'\n'+
      (cxcDetalle||'Sin facturas pendientes')+'\n\n'+

      '## CUENTAS POR PAGAR — '+(cxpRows||[]).length+' facturas | Total: $'+Math.round(cxpTotal).toLocaleString('es-MX')+'\n'+
      (cxpDetalle||'Sin facturas pendientes')+'\n\n'+

      '## PROYECTOS '+año+'\n'+(proyectosDetalle||'Sin proyectos')+'\n\n'+

      '## COTIZACIONES\n'+(
        (cotizaciones||[]).length ?
        (cotizaciones||[]).slice(0,20).map(function(c){
          return (c.numero||'COT')+' | '+( c.cliente_nombre||'?')+' | '+
            (c.estatus||'borrador')+' | $'+Math.round(c.total||0).toLocaleString('es-MX');
        }).join('\n') :
        'Sin cotizaciones'
      )+'\n\n'+

      '## CLIENTES REGISTRADOS\n'+clientesDetalle;


    var apiResp=await fetch('https://iycqlbvywwogcfftciil.supabase.co/functions/v1/hyper-api',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+SUPABASE_KEY
      },
      body:JSON.stringify({pregunta:q, contexto:contextStr})
    });

    if(!apiResp.ok){
      var err=await apiResp.json().catch(function(){return {};});
      throw new Error(err.error||'Error en la consulta ('+apiResp.status+')');
    }

    var result=await apiResp.json();
    var answer=result.answer||'Sin respuesta.';
    // Escape first, then apply only safe formatting (bold + newlines)
    answer=esc(answer);
    answer=answer.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>');
    resp.innerHTML='<span style="color:var(--text-1);line-height:1.7;">'+answer.replace(/\n/g,'<br>')+'</span>';

  }catch(e){
    console.error('Consulta error:',e);
    resp.innerHTML='<span style="color:#f87171;">Error: '+esc(e.message)+'</span>';
  }
}
// ── Clientes UI ──────────────────────────────────────────
// ── CxC y CxP Dashboard ──────────────────────────────────
async function loadCxC(){
  try{
    var {data}=await sb.from('facturas')
      .select('receptor_nombre,total,fecha')
      .eq('tipo','emitida').eq('conciliado',false).neq('estatus','cancelada').eq('efecto_sat','Ingreso');
    if(data)data=data.map(function(f){return {contraparte:f.receptor_nombre,monto:f.total,fecha:f.fecha};});
    var rows=data||[];
    var total=rows.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    document.getElementById('cxc-total').textContent=fmt(total);
    document.getElementById('cxc-num-facturas').textContent=rows.length+' factura'+(rows.length!==1?'s':'');

    // Antigüedad
    var hoy=new Date(); var b=[0,0,0,0];
    rows.forEach(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      if(dias<=30)b[0]+=(parseFloat(m.monto)||0);
      else if(dias<=60)b[1]+=(parseFloat(m.monto)||0);
      else if(dias<=90)b[2]+=(parseFloat(m.monto)||0);
      else b[3]+=(parseFloat(m.monto)||0);
    });
    ['cxc-b0','cxc-b1','cxc-b2','cxc-b3'].forEach(function(id,i){
      document.getElementById(id).textContent=fmt(b[i]);
    });

    // Top 5 deudores
    var byCliente={};
    rows.forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byCliente[k]=(byCliente[k]||0)+(parseFloat(m.monto)||0);});
    var top5=Object.entries(byCliente).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var el=document.getElementById('cxc-top5');
    el.innerHTML=top5.map(function(d,i){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 1.25rem;border-bottom:0.5px solid var(--border);font-size:12px;">'+
        '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+(i+1)+'. '+esc(d[0])+'</span>'+
        '<span style="color:#d97706;font-weight:600;flex-shrink:0;">'+fmt(d[1])+'</span>'+
      '</div>';
    }).join('');
  }catch(e){console.error('CxC:',e);}
}

async function loadCxP(){
  try{
    var {data}=await sb.from('facturas')
      .select('emisor_nombre,total,fecha')
      .eq('tipo','recibida').eq('conciliado',false).neq('estatus','cancelada').eq('efecto_sat','Ingreso');
    if(data)data=data.map(function(f){return {contraparte:f.emisor_nombre,monto:f.total,fecha:f.fecha};});
    var rows=data||[];
    var total=rows.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    document.getElementById('cxp-total').textContent=fmt(total);
    document.getElementById('cxp-num-facturas').textContent=rows.length+' factura'+(rows.length!==1?'s':'');

    // Vence en 30 días (fecha_entrega o fecha + 30d estimado)
    var hoy=new Date();
    // Vencidas / urgentes = llevan >30 días sin pagar
    var vence30=rows.filter(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return dias>30;
    });
    var montoVence=vence30.reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var montoResto=total-montoVence;
    document.getElementById('cxp-vence30').textContent=fmt(montoVence);
    document.getElementById('cxp-vence30-num').textContent=vence30.length+' factura'+(vence30.length!==1?'s':'');
    document.getElementById('cxp-resto').textContent=fmt(montoResto);

    // Top 5 proveedores
    var byProv={};
    rows.forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byProv[k]=(byProv[k]||0)+(parseFloat(m.monto)||0);});
    var top5=Object.entries(byProv).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var el=document.getElementById('cxp-top5');
    el.innerHTML=top5.map(function(d,i){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 1.25rem;border-bottom:0.5px solid var(--border);font-size:12px;">'+
        '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+(i+1)+'. '+esc(d[0])+'</span>'+
        '<span style="color:#f87171;font-weight:600;flex-shrink:0;">'+fmt(d[1])+'</span>'+
      '</div>';
    }).join('');
  }catch(e){console.error('CxP:',e);}
}


// ── Dashboard ─────────────────────────────────────────────
// [T7] dbChart → M2State alias en config.js

async function loadDashboard(){
  var año=new Date().getFullYear();
  var mesActual=new Date().getMonth()+1;
  var mesAnterior=mesActual===1?12:mesActual-1;
  var añoAnterior=mesActual===1?año-1:año;
  var mismoMesAñoAnterior=mesActual;
  var añoAñoAnterior=año-1;

  try{
    // P1-a: ventas YTD from facturas emitidas Ingreso; compras from facturas recibidas Ingreso; gastos from movimientos_v2
    var dashResults=await Promise.all([
      sb.from('movimientos_v2').select('categoria,tipo,monto,month').eq('year',año),
      sb.from('facturas').select('total,month,year').eq('tipo','emitida').eq('year',año).neq('estatus','cancelada').eq('efecto_sat','Ingreso'),
      sb.from('facturas').select('total,month').eq('tipo','recibida').eq('year',año).neq('estatus','cancelada').eq('efecto_sat','Ingreso')
    ]);
    var ytd=dashResults[0].data||[];
    var factYTD=dashResults[1].data||[];       // ventas (CFDIs emitidos)
    var comprasFactYTD=dashResults[2].data||[]; // compras (CFDIs recibidos)

    var ventasYTD=factYTD.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var comprasYTD=comprasFactYTD.reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var cobrYTD=ytd.filter(function(m){return m.tipo==='ingreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var gastoYTD=ytd.filter(function(m){return m.tipo==='egreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var utilYTD=ventasYTD-comprasYTD; // accrual: CFDIs emitidos − CFDIs recibidos
    var flujoYTD=cobrYTD-gastoYTD;   // cash: ingresos − egresos de caja

    document.getElementById('db-ventas-ytd').textContent=fmt(ventasYTD);
    document.getElementById('db-util-ytd').textContent=fmt(utilYTD);
    document.getElementById('db-cobr-ytd').textContent=fmt(cobrYTD);
    var comprasYtdEl=document.getElementById('db-compras-ytd');
    if(comprasYtdEl){comprasYtdEl.textContent=fmt(comprasYTD);comprasYtdEl.className='mvalue c-amber';}
    var gastoYtdEl=document.getElementById('db-gasto-ytd');
    if(gastoYtdEl){gastoYtdEl.textContent=fmt(gastoYTD);gastoYtdEl.className='mvalue c-amber';}
    var flujoYtdEl=document.getElementById('db-flujo-ytd');
    if(flujoYtdEl){flujoYtdEl.textContent=fmt(flujoYTD);flujoYtdEl.className='mvalue '+(flujoYTD>=0?'c-util-pos':'c-util-neg');}
    document.getElementById('db-util-ytd').className='mvalue-hero '+(utilYTD>=0?'c-util-pos':'c-util-neg');
    // P1-d: KPIs del mes en Dashboard
    var ventasMesDB=factYTD.filter(function(f){return f.month===mesActual;}).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var comprasMesDB=comprasFactYTD.filter(function(f){return f.month===mesActual;}).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var cobrMesDB=ytd.filter(function(m){return m.tipo==='ingreso'&&m.categoria!=='prestamo'&&m.month===mesActual;}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var gastoMesDB=ytd.filter(function(m){return m.tipo==='egreso'&&m.categoria!=='prestamo'&&m.month===mesActual;}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var utilMesDB=ventasMesDB-comprasMesDB;
    var setMes=function(id,v,cls){var el=document.getElementById(id);if(!el)return;el.textContent=fmt(v);if(cls)el.className='mvalue '+(cls||'');};
    setMes('db-ventas-mes',ventasMesDB,'c-green');
    setMes('db-compras-mes',comprasMesDB,'c-amber');
    setMes('db-cobr-mes',cobrMesDB,'c-blue');
    setMes('db-gasto-mes',gastoMesDB,'c-amber');
    setMes('db-util-mes',utilMesDB,utilMesDB>=0?'c-util-pos':'c-util-neg');

    // Por cobrar — solo Ingreso (excluye complementos de pago y notas de crédito)
    var {data:pending}=await sb.from('facturas').select('total').eq('tipo','emitida').eq('conciliado',false).neq('estatus','cancelada').eq('efecto_sat','Ingreso');
    if(pending)pending=pending.map(function(f){return {monto:f.total};});
    var porCobrar=(pending||[]).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    document.getElementById('db-por-cobrar').textContent=fmt(porCobrar);

    // MoM: usa mismas fuentes que métricas actuales (facturas para ventas/compras, movimientos para cobr/gasto)
    var lyResults=await Promise.all([
      sb.from('movimientos_v2').select('tipo,monto,categoria').eq('year',añoAñoAnterior).eq('month',mismoMesAñoAnterior),
      sb.from('facturas').select('total').eq('tipo','emitida').eq('year',añoAñoAnterior).eq('month',mismoMesAñoAnterior).neq('estatus','cancelada').eq('efecto_sat','Ingreso'),
      sb.from('facturas').select('total').eq('tipo','recibida').eq('year',añoAñoAnterior).eq('month',mismoMesAñoAnterior).neq('estatus','cancelada').eq('efecto_sat','Ingreso')
    ]);
    var ly=lyResults[0].data||[];
    var ventasLY=(lyResults[1].data||[]).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var comprasLY=(lyResults[2].data||[]).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
    var cobrLY=ly.filter(function(m){return m.tipo==='ingreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
    var gastoLY=ly.filter(function(m){return m.tipo==='egreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);

    function momBadge(actual,anterior,label){
      if(!anterior)return '<span style="color:var(--text-3);">'+label+': '+fmt(actual)+'</span>';
      var pct=Math.round((actual-anterior)/anterior*100);
      var color=pct>=0?'#34d399':'#f87171';
      var arrow=pct>=0?'↑':'↓';
      return '<span style="color:'+color+';">'+arrow+' '+Math.abs(pct)+'% vs '+MONTHS[mismoMesAñoAnterior-1]+' '+añoAñoAnterior+'</span>';
    }
    document.getElementById('db-ventas-mom').innerHTML=momBadge(ventasMesDB,ventasLY,'Ventas '+MONTHS[mesActual-1]);
    var comprasMomEl=document.getElementById('db-compras-mom');
    if(comprasMomEl)comprasMomEl.innerHTML=momBadge(comprasMesDB,comprasLY,'Compras '+MONTHS[mesActual-1]);
    document.getElementById('db-cobr-mom').innerHTML=momBadge(cobrMesDB,cobrLY,'Cobr. '+MONTHS[mesActual-1]);
    document.getElementById('db-gasto-mom').innerHTML=momBadge(gastoMesDB,gastoLY,'Gasto '+MONTHS[mesActual-1]);
    document.getElementById('db-util-mom').innerHTML=momBadge(ventasMesDB-comprasMesDB,ventasLY-comprasLY,'Util. '+MONTHS[mesActual-1]);

    // Gráfica 12 meses — incluye año anterior si necesario
    var meses12=[]; var labels12=[]; var vData=[]; var cData=[];
    for(var i=11;i>=0;i--){
      var d=new Date(año,mesActual-1-i,1);
      meses12.push({y:d.getFullYear(),m:d.getMonth()+1});
      labels12.push(MONTHS[d.getMonth()].slice(0,3));
    }
    var needsPrevYear=meses12[0].y<año;
    var allCobrData=ytd.slice();
    var allVentasFactData=factYTD.slice();
    if(needsPrevYear){
      var prevResults=await Promise.all([
        sb.from('movimientos_v2').select('categoria,monto,month,year').eq('year',año-1),
        sb.from('facturas').select('total,month,year').eq('tipo','emitida').eq('year',año-1).neq('estatus','cancelada').eq('efecto_sat','Ingreso')
      ]);
      allCobrData=allCobrData.concat(prevResults[0].data||[]);
      allVentasFactData=allVentasFactData.concat(prevResults[1].data||[]);
    }
    meses12.forEach(function(mo){
      var ventasMo=allVentasFactData.filter(function(f){return f.year===mo.y&&f.month===mo.m;}).reduce(function(a,f){return a+(parseFloat(f.total)||0);},0);
      var cobrMo=allCobrData.filter(function(m){return m.year===mo.y&&m.month===mo.m&&m.tipo==='ingreso'&&m.categoria!=='prestamo';}).reduce(function(a,m){return a+(parseFloat(m.monto)||0);},0);
      vData.push(ventasMo); cData.push(cobrMo);
    });

    var ctx=document.getElementById('dbChart');
    if(dbChart)dbChart.destroy();
    dbChart=new Chart(ctx,{
      type:'bar',
      data:{
        labels:labels12,
        datasets:[
          {label:'Ventas',data:vData,backgroundColor:'#34d39933',borderColor:'#34d399',borderWidth:1.5,borderRadius:3},
          {label:'Cobranza',data:cData,backgroundColor:'#60a5fa33',borderColor:'#60a5fa',borderWidth:1.5,borderRadius:3}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#475569',font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+fmt(c.parsed.y);}}}},
        scales:{
          y:{beginAtZero:true,ticks:{callback:function(v){return '$'+Math.round(v/1000)+'k';},color:'#33415580',font:{size:10}},grid:{color:'rgba(255,255,255,.05)'}},
          x:{ticks:{color:'#47556980',font:{size:11}},grid:{display:false}}
        }
      }
    });

    loadCxC();
    loadCxP();

    // Últimos movimientos
    showFAB();
    var {data:ultimos}=await sb.from('movimientos_v2').select('*').order('fecha',{ascending:false}).limit(8);
    var me=getUserName();
    var ultiEl=document.getElementById('db-ultimos-mvmts');
    if(!(ultimos&&ultimos.length)){
      ultiEl.innerHTML='<div class="empty-state-cta"><div class="empty-state-icon">📭</div>'+
        '<div class="empty-state-msg">Sin movimientos de flujo recientes</div></div>';
      return;
    }
    ultiEl.innerHTML=ultimos.map(function(m){
      return '<div class="mvmt-item">'+
        '<div class="mvmt-dot" style="background:'+(CAT_COLORS[m.categoria]||'#475569')+'"></div>'+
        '<div class="mvmt-info">'+
          '<div class="mvmt-desc" style="font-size:12px;">'+esc((m.contraparte||m.descripcion||'').slice(0,35))+'</div>'+
          '<div class="mvmt-meta"><span class="badge '+(CAT_BADGE[m.categoria]||'bg')+'">'+(CAT_LABELS[m.categoria]||esc(m.categoria))+'</span>'+
          '<span class="mvmt-date">'+fmtDate(m.fecha)+'</span></div>'+
        '</div>'+
        '<div class="mvmt-amount" style="color:'+(CAT_COLORS[m.categoria]||'#888')+';font-size:13px;">'+(m.tipo==='egreso'?'−':'+')+fmt(parseFloat(m.monto)||0)+'</div>'+
      '</div>';
    }).join('');
  }catch(e){console.error('Dashboard error:',e);}
}

// ── Proyectos KPIs + filtros ──────────────────────────────
