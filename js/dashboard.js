// ── Cache layer ───────────────────────────────────────────
var _cache={};
var CACHE_TTL=5*60*1000; // 5 minutos

function cacheSet(key,data){_cache[key]={data:data,ts:Date.now()};}
function cacheGet(key){var c=_cache[key];return(c&&Date.now()-c.ts<CACHE_TTL)?c.data:null;}
function cacheInvalidate(key){delete _cache[key];}
function cacheInvalidateAll(){_cache={};}

// Shared CxC/CxP data — populated by loadCxC/loadCxP, reused by Claude
var _cxcRows=null, _cxpRows=null, _ytdMvmts=null;

// ── Finanzas KPIs ─────────────────────────────────────────
// Derives from in-memory movements — no extra query needed
async function loadFinanzasKPIs(){
  try{
    // Use already-loaded movements array (from loadMovements)
    var rows=movements||[];
    var ventas=rows.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var cobr=rows.filter(function(m){return m.categoria==='cobranza';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var gastos=rows.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var util=ventas-gastos;
    var flujo=cobr-gastos;
    var setV=function(id,v,cls){var el=document.getElementById(id);if(!el)return;el.textContent=fmt(v);el.className='mvalue-hero '+(cls||'');};
    setV('fin-ventas',ventas,'c-green');
    setV('fin-util',util,util>=0?'c-util-pos':'c-util-neg');
    setV('fin-cobr',cobr,'c-blue');
    setV('fin-gasto',gastos,'c-red');
    setV('fin-flujo',flujo,flujo>=0?'c-util-pos':'c-util-neg');
    // CxC del mes — from cache or quick filter of cxcRows
    var cxc=(_cxcRows||[]).filter(function(m){
      var d=new Date(m.fecha);
      return d.getFullYear()===curYear&&d.getMonth()===curMonth;
    }).reduce(function(a,m){return a+Number(m.monto);},0);
    setV('fin-cxc',cxc,'c-amber');
    var ventasEl=document.getElementById('fin-ventas-sub');
    if(ventasEl)ventasEl.textContent=MONTHS[curMonth]+' '+curYear;
  }catch(e){console.error('Finanzas KPIs:',e);}
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
        .eq('year',año).order('fecha',{ascending:false});
      mvmts=allMvmts||[];
      cacheSet('ytd_'+año,mvmts);
    }
    _ytdMvmts=mvmts;

    // YTD resumen
    var ventasYTD=mvmts.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var cobrYTD=mvmts.filter(function(m){return m.categoria==='cobranza';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var gastoYTD=mvmts.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var utilYTD=ventasYTD-gastoYTD;
    var flujoYTD=cobrYTD-gastoYTD;

    // Ventas por mes
    var ventasMes={};
    mvmts.filter(function(m){return m.categoria==='venta';}).forEach(function(m){
      var k=MONTHS_ES[(m.month||1)-1];
      ventasMes[k]=(ventasMes[k]||0)+Number(m.monto);
    });
    var resumenMeses=Object.entries(ventasMes).map(function(e){
      return e[0]+': $'+Math.round(e[1]).toLocaleString('es-MX');
    }).join(' | ');

    // Ventas por cliente (YTD)
    var ventasByCliente={};
    mvmts.filter(function(m){return m.categoria==='venta';}).forEach(function(m){
      var k=(m.contraparte||'Sin nombre').trim();
      ventasByCliente[k]=(ventasByCliente[k]||0)+Number(m.monto);
    });
    var topVentasCliente=Object.entries(ventasByCliente).sort(function(a,b){return b[1]-a[1];})
      .map(function(d){return d[0]+': $'+Math.round(d[1]).toLocaleString('es-MX');}).join('\n');

    // Gastos por etiqueta/proveedor
    var gastosByProv={};
    mvmts.filter(function(m){return m.tipo==='egreso';}).forEach(function(m){
      var k=(m.contraparte||m.etiqueta||'Sin clasificar').trim();
      gastosByProv[k]=(gastosByProv[k]||0)+Number(m.monto);
    });
    var topGastos=Object.entries(gastosByProv).sort(function(a,b){return b[1]-a[1];}).slice(0,15)
      .map(function(d){return d[0]+': $'+Math.round(d[1]).toLocaleString('es-MX');}).join('\n');

    // CxC — facturas sin cobrar con antigüedad
    var {data:cxcRows}=await sb.from('movimientos_v2')
      .select('contraparte,rfc_contraparte,monto,fecha,numero_factura,descripcion')
      .eq('origen','sat_emitida').eq('conciliado',false)
      .order('fecha',{ascending:true});
    _cxcRows=cxcRows||[]; updateBadges();
    var cxcTotal=_cxcRows.reduce(function(a,m){return a+Number(m.monto);},0);
    var hoy=new Date();
    var cxcDetalle=(cxcRows||[]).map(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return (m.contraparte||m.rfc_contraparte||'?')+
        (m.numero_factura?' | folio:'+m.numero_factura:'')+
        ' | $'+Math.round(Number(m.monto)).toLocaleString('es-MX')+
        ' | fecha:'+m.fecha+' | '+dias+'d sin cobrar';
    }).join('\n');

    // CxP — facturas sin pagar con antigüedad
    var {data:cxpRows}=await sb.from('movimientos_v2')
      .select('contraparte,rfc_contraparte,monto,fecha,numero_factura,descripcion')
      .eq('origen','sat_recibida').eq('conciliado',false)
      .order('fecha',{ascending:true});
    _cxpRows=cxpRows||[]; updateBadges();
    var cxpTotal=_cxpRows.reduce(function(a,m){return a+Number(m.monto);},0);
    var cxpDetalle=(cxpRows||[]).map(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return (m.contraparte||m.rfc_contraparte||'?')+
        (m.numero_factura?' | folio:'+m.numero_factura:'')+
        ' | $'+Math.round(Number(m.monto)).toLocaleString('es-MX')+
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
    // Format answer — bold for numbers
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
    var {data}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha')
      .eq('origen','sat_emitida').eq('conciliado',false);
    var rows=data||[];
    var total=rows.reduce(function(a,m){return a+Number(m.monto);},0);
    document.getElementById('cxc-total').textContent=fmt(total);
    document.getElementById('cxc-num-facturas').textContent=rows.length+' factura'+(rows.length!==1?'s':'');

    // Antigüedad
    var hoy=new Date(); var b=[0,0,0,0];
    rows.forEach(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      if(dias<=30)b[0]+=Number(m.monto);
      else if(dias<=60)b[1]+=Number(m.monto);
      else if(dias<=90)b[2]+=Number(m.monto);
      else b[3]+=Number(m.monto);
    });
    ['cxc-b0','cxc-b1','cxc-b2','cxc-b3'].forEach(function(id,i){
      document.getElementById(id).textContent=fmt(b[i]);
    });

    // Top 5 deudores
    var byCliente={};
    rows.forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byCliente[k]=(byCliente[k]||0)+Number(m.monto);});
    var top5=Object.entries(byCliente).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var el=document.getElementById('cxc-top5');
    el.innerHTML=top5.map(function(d,i){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 1.25rem;border-bottom:0.5px solid #0f1420;font-size:12px;">'+
        '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+(i+1)+'. '+esc(d[0])+'</span>'+
        '<span style="color:#fbbf24;font-weight:600;flex-shrink:0;">'+fmt(d[1])+'</span>'+
      '</div>';
    }).join('');
  }catch(e){console.error('CxC:',e);}
}

async function loadCxP(){
  try{
    var {data}=await sb.from('movimientos_v2')
      .select('contraparte,monto,fecha')
      .eq('origen','sat_recibida').eq('conciliado',false);
    var rows=data||[];
    var total=rows.reduce(function(a,m){return a+Number(m.monto);},0);
    document.getElementById('cxp-total').textContent=fmt(total);
    document.getElementById('cxp-num-facturas').textContent=rows.length+' factura'+(rows.length!==1?'s':'');

    // Vence en 30 días (fecha_entrega o fecha + 30d estimado)
    var hoy=new Date();
    // Vencidas / urgentes = llevan >30 días sin pagar
    var vence30=rows.filter(function(m){
      var dias=Math.floor((hoy-new Date(m.fecha))/(1000*60*60*24));
      return dias>30;
    });
    var montoVence=vence30.reduce(function(a,m){return a+Number(m.monto);},0);
    var montoResto=total-montoVence;
    document.getElementById('cxp-vence30').textContent=fmt(montoVence);
    document.getElementById('cxp-vence30-num').textContent=vence30.length+' factura'+(vence30.length!==1?'s':'');
    document.getElementById('cxp-resto').textContent=fmt(montoResto);

    // Top 5 proveedores
    var byProv={};
    rows.forEach(function(m){var k=(m.contraparte||'Sin nombre').trim();byProv[k]=(byProv[k]||0)+Number(m.monto);});
    var top5=Object.entries(byProv).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var el=document.getElementById('cxp-top5');
    el.innerHTML=top5.map(function(d,i){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 1.25rem;border-bottom:0.5px solid #0f1420;font-size:12px;">'+
        '<span style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+(i+1)+'. '+esc(d[0])+'</span>'+
        '<span style="color:#f87171;font-weight:600;flex-shrink:0;">'+fmt(d[1])+'</span>'+
      '</div>';
    }).join('');
  }catch(e){console.error('CxP:',e);}
}


// ── Dashboard ─────────────────────────────────────────────
var dbChart=null;

async function loadDashboard(){
  var año=new Date().getFullYear();
  var mesActual=new Date().getMonth()+1;
  var mesAnterior=mesActual===1?12:mesActual-1;
  var añoAnterior=mesActual===1?año-1:año;
  var mismoMesAñoAnterior=mesActual;
  var añoAñoAnterior=año-1;

  try{
    // YTD — todos los movimientos del año
    var {data:ytdData}=await sb.from('movimientos_v2').select('categoria,tipo,monto,month').eq('year',año);
    var ytd=ytdData||[];

    var ventasYTD=ytd.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var cobrYTD=ytd.filter(function(m){return m.categoria==='cobranza';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var gastoYTD=ytd.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var utilYTD=ventasYTD-gastoYTD;
    var flujoYTD=cobrYTD-gastoYTD;

    document.getElementById('db-ventas-ytd').textContent=fmt(ventasYTD);
    document.getElementById('db-util-ytd').textContent=fmt(utilYTD);
    document.getElementById('db-cobr-ytd').textContent=fmt(cobrYTD);
    document.getElementById('db-gasto-ytd').textContent=fmt(gastoYTD);
    document.getElementById('db-flujo-ytd').textContent=fmt(flujoYTD);
    document.getElementById('db-util-ytd').className='mvalue-hero '+(utilYTD>=0?'c-util-pos':'c-util-neg');

    // Por cobrar
    var {data:pending}=await sb.from('movimientos_v2').select('monto').eq('origen','sat_emitida').eq('conciliado',false);
    var porCobrar=(pending||[]).reduce(function(a,m){return a+Number(m.monto);},0);
    document.getElementById('db-por-cobrar').textContent=fmt(porCobrar);

    // MoM comparación
    var ventasMes=ytd.filter(function(m){return m.categoria==='venta'&&m.month===mesActual;}).reduce(function(a,m){return a+Number(m.monto);},0);
    var cobrMes=ytd.filter(function(m){return m.categoria==='cobranza'&&m.month===mesActual;}).reduce(function(a,m){return a+Number(m.monto);},0);
    var gastoMes=ytd.filter(function(m){return m.tipo==='egreso'&&m.month===mesActual;}).reduce(function(a,m){return a+Number(m.monto);},0);

    var {data:lastYearData}=await sb.from('movimientos_v2').select('categoria,tipo,monto,month').eq('year',añoAñoAnterior).eq('month',mismoMesAñoAnterior);
    var ly=lastYearData||[];
    var ventasLY=ly.filter(function(m){return m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var cobrLY=ly.filter(function(m){return m.categoria==='cobranza';}).reduce(function(a,m){return a+Number(m.monto);},0);
    var gastoLY=ly.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+Number(m.monto);},0);

    function momBadge(actual,anterior,label){
      if(!anterior)return '<span style="color:var(--text-3);">'+label+': '+fmt(actual)+'</span>';
      var pct=Math.round((actual-anterior)/anterior*100);
      var color=pct>=0?'#34d399':'#f87171';
      var arrow=pct>=0?'↑':'↓';
      return '<span style="color:'+color+';">'+arrow+' '+Math.abs(pct)+'% vs '+MONTHS[mismoMesAñoAnterior-1]+' '+añoAñoAnterior+'</span>';
    }
    document.getElementById('db-ventas-mom').innerHTML=momBadge(ventasMes,ventasLY,'Ventas '+MONTHS[mesActual-1]);
    document.getElementById('db-cobr-mom').innerHTML=momBadge(cobrMes,cobrLY,'Cobr. '+MONTHS[mesActual-1]);
    document.getElementById('db-gasto-mom').innerHTML=momBadge(gastoMes,gastoLY,'Gasto '+MONTHS[mesActual-1]);
    document.getElementById('db-util-mom').innerHTML=momBadge(ventasMes-gastoMes,ventasLY-gastoLY,'Util. '+MONTHS[mesActual-1]);

    // Gráfica 12 meses — incluye año anterior si necesario
    var meses12=[]; var labels12=[]; var vData=[]; var cData=[];
    for(var i=11;i>=0;i--){
      var d=new Date(año,mesActual-1-i,1);
      meses12.push({y:d.getFullYear(),m:d.getMonth()+1});
      labels12.push(MONTHS[d.getMonth()].slice(0,3));
    }
    var needsPrevYear=meses12[0].y<año;
    var allChartData=ytd.slice();
    if(needsPrevYear){
      var {data:prevYearData}=await sb.from('movimientos_v2').select('categoria,monto,month,year').eq('year',año-1);
      allChartData=allChartData.concat(prevYearData||[]);
    }
    meses12.forEach(function(mo){
      var ventasMo=allChartData.filter(function(m){return m.year===mo.y&&m.month===mo.m&&m.categoria==='venta';}).reduce(function(a,m){return a+Number(m.monto);},0);
      var cobrMo=allChartData.filter(function(m){return m.year===mo.y&&m.month===mo.m&&m.categoria==='cobranza';}).reduce(function(a,m){return a+Number(m.monto);},0);
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
    var {data:ultimos}=await sb.from('movimientos_v2').select('*').order('fecha',{ascending:false}).limit(8);
    var me=getUserName();
    var ultiEl=document.getElementById('db-ultimos-mvmts');
    if(!(ultimos&&ultimos.length)){ultiEl.innerHTML='<div class="empty-state">Sin movimientos</div>';return;}
    ultiEl.innerHTML=ultimos.map(function(m){
      return '<div class="mvmt-item">'+
        '<div class="mvmt-dot" style="background:'+(CAT_COLORS[m.categoria]||'#475569')+'"></div>'+
        '<div class="mvmt-info">'+
          '<div class="mvmt-desc" style="font-size:12px;">'+esc((m.contraparte||m.descripcion||'').slice(0,35))+'</div>'+
          '<div class="mvmt-meta"><span class="badge '+(CAT_BADGE[m.categoria]||'bg')+'">'+(CAT_LABELS[m.categoria]||m.categoria)+'</span>'+
          '<span class="mvmt-date">'+fmtDate(m.fecha)+'</span></div>'+
        '</div>'+
        '<div class="mvmt-amount" style="color:'+(CAT_COLORS[m.categoria]||'#888')+';font-size:13px;">'+(m.tipo==='egreso'?'−':'+')+fmt(m.monto)+'</div>'+
      '</div>';
    }).join('');
  }catch(e){console.error('Dashboard error:',e);}
}

// ── Proyectos KPIs + filtros ──────────────────────────────
