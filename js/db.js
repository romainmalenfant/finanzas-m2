// ── DB — Data Access Layer ──────────────────────────────────────────────────
// Única fuente de verdad para todas las queries a Supabase.
// Ningún módulo debe llamar sb.from() directamente — usar DB.tabla.método().
//
// Retorno: el dato directamente (array u objeto). En error lanza con contexto.
// ───────────────────────────────────────────────────────────────────────────

// ── Helpers privados ────────────────────────────────────────────────────────

var _dbCache  = {};
var _dbTTL    = 300000; // 5 min

async function _dbCached(key, fn) {
  var now = Date.now();
  if (_dbCache[key] && (now - _dbCache[key].t) < _dbTTL) return _dbCache[key].d;
  var d = await fn();
  _dbCache[key] = { d: d, t: now };
  return d;
}

function _dbBust(prefix) {
  Object.keys(_dbCache).forEach(function (k) {
    if (k.indexOf(prefix) === 0) delete _dbCache[k];
  });
}

async function _dbQ(label, chain) {
  var res = await chain;
  if (res.error) throw new Error('[' + label + '] ' + res.error.message);
  return res.data;
}

async function _dbQArr(label, chain) {
  var res = await chain;
  if (res.error) throw new Error('[' + label + '] ' + res.error.message);
  return res.data || [];
}

// ── DB ──────────────────────────────────────────────────────────────────────

var DB = {

  _bust:  _dbBust,
  _cache: _dbCache,

  // ── empleados ──────────────────────────────────────────────────────────

  empleados: {

    list: async function () {
      return _dbCached('empleados:list', async function () {
        return _dbQArr('DB.empleados.list',
          sb.from('empleados').select('*').order('nombre', { ascending: true })
        );
      });
    },

    save: async function (data) {
      _dbBust('empleados:');
      return _dbQ('DB.empleados.save',
        sb.from('empleados').upsert([data]).select().single()
      );
    },

    delete: async function (id) {
      _dbBust('empleados:');
      return _dbQArr('DB.empleados.delete',
        sb.from('empleados').delete().eq('id', id)
      );
    },

    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _dbQArr('DB.empleados.byRFC',
        sb.from('empleados').select('id,rfc,nombre').in('rfc', rfcs)
      );
    },

    insertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _dbBust('empleados:');
      return _dbQArr('DB.empleados.insertBulk',
        sb.from('empleados').insert(rows).select()
      );
    },
  },

  // ── contactos ──────────────────────────────────────────────────────────

  contactos: {

    list: async function () {
      return _dbCached('contactos:list', async function () {
        return _dbQArr('DB.contactos.list',
          sb.from('contactos')
            .select('*,clientes(nombre),proveedores(nombre)')
            .order('nombre', { ascending: true })
            .limit(500)
        );
      });
    },

    get: async function (id) {
      return _dbQ('DB.contactos.get',
        sb.from('contactos').select('*').eq('id', id).maybeSingle()
      );
    },

    save: async function (data) {
      _dbBust('contactos:');
      return _dbQ('DB.contactos.save',
        sb.from('contactos').upsert([data]).select().single()
      );
    },

    delete: async function (id) {
      _dbBust('contactos:');
      return _dbQArr('DB.contactos.delete',
        sb.from('contactos').delete().eq('id', id)
      );
    },

    byCliente: async function (clienteId) {
      return _dbQArr('DB.contactos.byCliente',
        sb.from('contactos').select('*').eq('cliente_id', clienteId).order('nombre')
      );
    },

    byProveedor: async function (provId) {
      return _dbQArr('DB.contactos.byProveedor',
        sb.from('contactos').select('*').eq('proveedor_id', provId).order('nombre')
      );
    },

    link: async function (id, clienteId, provId) {
      _dbBust('contactos:');
      var upd = {};
      if (clienteId !== undefined) upd.cliente_id   = clienteId;
      if (provId    !== undefined) upd.proveedor_id = provId;
      return _dbQ('DB.contactos.link',
        sb.from('contactos').update(upd).eq('id', id).select().single()
      );
    },
  },

  // ── clientes ───────────────────────────────────────────────────────────

  clientes: {

    list: async function () {
      return _dbCached('clientes:list', async function () {
        return _dbQArr('DB.clientes.list',
          sb.from('clientes').select('*').order('nombre').limit(500)
        );
      });
    },

    get: async function (id) {
      return _dbQ('DB.clientes.get',
        sb.from('clientes').select('*').eq('id', id).maybeSingle()
      );
    },

    save: async function (data) {
      _dbBust('clientes:');
      return _dbQ('DB.clientes.save',
        sb.from('clientes').upsert([data]).select().single()
      );
    },

    softDelete: async function (id) {
      _dbBust('clientes:');
      return _dbQArr('DB.clientes.softDelete',
        sb.from('clientes').update({ activo: false }).eq('id', id)
      );
    },

    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _dbQArr('DB.clientes.byRFC',
        sb.from('clientes').select('id,rfc').in('rfc', rfcs)
      );
    },

    upsertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _dbBust('clientes:');
      return _dbQArr('DB.clientes.upsertBulk',
        sb.from('clientes').upsert(rows, { onConflict: 'rfc' }).select()
      );
    },
  },

  // ── proveedores ────────────────────────────────────────────────────────

  proveedores: {

    list: async function () {
      return _dbCached('proveedores:list', async function () {
        return _dbQArr('DB.proveedores.list',
          sb.from('proveedores').select('*').order('nombre').limit(500)
        );
      });
    },

    get: async function (id) {
      return _dbQ('DB.proveedores.get',
        sb.from('proveedores').select('*').eq('id', id).maybeSingle()
      );
    },

    save: async function (data) {
      _dbBust('proveedores:');
      return _dbQ('DB.proveedores.save',
        sb.from('proveedores').upsert([data]).select().single()
      );
    },

    softDelete: async function (id) {
      _dbBust('proveedores:');
      return _dbQArr('DB.proveedores.softDelete',
        sb.from('proveedores').update({ activo: false }).eq('id', id)
      );
    },

    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _dbQArr('DB.proveedores.byRFC',
        sb.from('proveedores').select('id,rfc').in('rfc', rfcs)
      );
    },

    upsertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _dbBust('proveedores:');
      return _dbQArr('DB.proveedores.upsertBulk',
        sb.from('proveedores').upsert(rows, { onConflict: 'rfc' }).select()
      );
    },
  },

  // ── proyectos ──────────────────────────────────────────────────────────

  proyectos: {

    list: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbCached('proyectos:list:' + y, async function () {
        return _dbQArr('DB.proyectos.list',
          sb.from('proyectos').select('*').eq('year', y).order('fecha_entrega')
        );
      });
    },

    get: async function (id) {
      return _dbQ('DB.proyectos.get',
        sb.from('proyectos').select('*').eq('id', id).maybeSingle()
      );
    },

    save: async function (data) {
      _dbBust('proyectos:');
      var op = data.id
        ? sb.from('proyectos').update(data).eq('id', data.id).select().single()
        : sb.from('proyectos').insert([data]).select().single();
      return _dbQ('DB.proyectos.save', op);
    },

    delete: async function (id) {
      _dbBust('proyectos:');
      return _dbQArr('DB.proyectos.delete',
        sb.from('proyectos').delete().eq('id', id)
      );
    },

    byCliente: async function (nombre, año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.proyectos.byCliente',
        sb.from('proyectos')
          .select('*')
          .ilike('nombre_cliente', '%' + nombre + '%')
          .eq('year', y)
      );
    },
  },

  // ── entregas ───────────────────────────────────────────────────────────

  entregas: {

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _dbQArr('DB.entregas.byProyectos',
        sb.from('entregas').select('*').in('proyecto_id', ids)
      );
    },

    insert: async function (data) {
      return _dbQ('DB.entregas.insert',
        sb.from('entregas').insert([data]).select().single()
      );
    },

    deleteByProyecto: async function (proyId) {
      return _dbQArr('DB.entregas.deleteByProyecto',
        sb.from('entregas').delete().eq('proyecto_id', proyId)
      );
    },
  },

  // ── cotizaciones ───────────────────────────────────────────────────────

  cotizaciones: {

    list: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.cotizaciones.list',
        sb.from('cotizaciones')
          .select('*')
          .eq('year', y)
          .order('created_at', { ascending: false })
          .limit(500)
      );
    },

    get: async function (id) {
      return _dbQ('DB.cotizaciones.get',
        sb.from('cotizaciones').select('*').eq('id', id).single()
      );
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('cotizaciones').update(data).eq('id', data.id).select().single()
        : sb.from('cotizaciones').insert([data]).select().single();
      return _dbQ('DB.cotizaciones.save', op);
    },

    updateEstatus: async function (id, estatus, extra) {
      var upd = Object.assign({ estatus: estatus }, extra || {});
      return _dbQ('DB.cotizaciones.updateEstatus',
        sb.from('cotizaciones').update(upd).eq('id', id).select().single()
      );
    },

    linkProyecto: async function (id, proyId) {
      return _dbQArr('DB.cotizaciones.linkProyecto',
        sb.from('cotizaciones')
          .update({ proyecto_id: proyId, estatus: 'cerrada' })
          .eq('id', id)
      );
    },

    byProyecto: async function (proyId) {
      return _dbQArr('DB.cotizaciones.byProyecto',
        sb.from('cotizaciones')
          .select('id,numero,estatus,total,fecha,nombre_cliente,numero_requisicion,fecha_cierre')
          .eq('proyecto_id', proyId)
          .order('fecha', { ascending: false })
      );
    },
  },

  // ── cotizacion_items ───────────────────────────────────────────────────

  cotizacionItems: {

    byCotizacion: async function (cotId) {
      return _dbQArr('DB.cotizacionItems.byCotizacion',
        sb.from('cotizacion_items')
          .select('*')
          .eq('cotizacion_id', cotId)
          .order('orden')
      );
    },

    replace: async function (cotId, items) {
      await _dbQArr('DB.cotizacionItems.replace:delete',
        sb.from('cotizacion_items').delete().eq('cotizacion_id', cotId)
      );
      if (!items || !items.length) return [];
      return _dbQArr('DB.cotizacionItems.replace:insert',
        sb.from('cotizacion_items').insert(items).select()
      );
    },
  },

  // ── facturas ───────────────────────────────────────────────────────────

  facturas: {

    list: async function (year, tipo) {
      var y = year || new Date().getFullYear();
      var q = sb.from('facturas').select('*').eq('year', y).order('fecha');
      if (tipo) q = q.eq('tipo', tipo);
      return _dbQArr('DB.facturas.list', q);
    },

    get: async function (id) {
      return _dbQ('DB.facturas.get',
        sb.from('facturas').select('*').eq('id', id).maybeSingle()
      );
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('facturas').update(data).eq('id', data.id).select().single()
        : sb.from('facturas').insert([data]).select().single();
      return _dbQ('DB.facturas.save', op);
    },

    cancel: async function (id) {
      return _dbQArr('DB.facturas.cancel',
        sb.from('facturas').update({ estatus: 'cancelada' }).eq('id', id)
      );
    },

    setVencimiento: async function (id, fecha) {
      return _dbQArr('DB.facturas.setVencimiento',
        sb.from('facturas').update({ fecha_vencimiento: fecha }).eq('id', id)
      );
    },

    setComplemento: async function (id) {
      return _dbQArr('DB.facturas.setComplemento',
        sb.from('facturas').update({ complemento_ok: true }).eq('id', id)
      );
    },

    linkProyecto: async function (id, proyId) {
      return _dbQArr('DB.facturas.linkProyecto',
        sb.from('facturas').update({ proyecto_id: proyId || null }).eq('id', id)
      );
    },

    conciliar: async function (id) {
      return _dbQArr('DB.facturas.conciliar',
        sb.from('facturas').update({ conciliado: true }).eq('id', id)
      );
    },

    upsertSAT: async function (rows) {
      if (!rows || !rows.length) return [];
      return _dbQArr('DB.facturas.upsertSAT',
        sb.from('facturas').upsert(rows, { onConflict: 'uuid_sat' }).select()
      );
    },

    pendientesCobro: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.pendientesCobro',
        sb.from('facturas')
          .select('id,receptor_nombre,receptor_rfc,numero_factura,fecha,fecha_vencimiento,total,concepto,cliente_id')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .eq('year', y)
          .order('fecha')
      );
    },

    pendientesPago: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.pendientesPago',
        sb.from('facturas')
          .select('id,emisor_nombre,emisor_rfc,numero_factura,fecha,fecha_vencimiento,total,concepto,proveedor_id')
          .eq('tipo', 'recibida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .not('efecto_sat', 'ilike', '%nómin%')
          .eq('year', y)
          .order('fecha')
      );
    },

    porCliente: async function (clienteId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'id,total,fecha,concepto,numero_factura,conciliado,estatus';
      var r1 = clienteId
        ? await _dbQArr('DB.facturas.porCliente:id',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('cliente_id',clienteId).eq('year',y).order('fecha',{ascending:false}))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.porCliente:rfc',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('receptor_rfc',rfc).eq('year',y).order('fecha',{ascending:false}))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function (f) {
        if (seen[f.id]) return false;
        return (seen[f.id] = true);
      });
    },

    porProveedor: async function (provId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'id,total,fecha,concepto,numero_factura,conciliado,estatus';
      var r1 = provId
        ? await _dbQArr('DB.facturas.porProveedor:id',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('proveedor_id',provId).eq('year',y).order('fecha',{ascending:false}))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.porProveedor:rfc',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('emisor_rfc',rfc).eq('year',y).order('fecha',{ascending:false}))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function (f) {
        if (seen[f.id]) return false;
        return (seen[f.id] = true);
      });
    },

    activasClientes: async function (dias, empRFCs) {
      var d = dias || 90;
      var desde = new Date();
      desde.setDate(desde.getDate() - d);
      var empSet = {};
      (empRFCs || []).forEach(function(r){ if(r) empSet[(r+'').toUpperCase()] = true; });
      var rows = await _dbQArr('DB.facturas.activasClientes',
        sb.from('facturas')
          .select('cliente_id,receptor_rfc,receptor_nombre')
          .eq('tipo', 'emitida')
          .neq('estatus', 'cancelada')
          .gte('fecha', desde.toISOString().slice(0, 10))
      );
      return rows.filter(function (f) {
        return !empSet[(f.receptor_rfc || '').toUpperCase()];
      });
    },

    ytdRecibidas: async function (año, empRFCs, empNombres) {
      var y = año || new Date().getFullYear();
      var empRFCSet  = {};
      var empNomSet  = {};
      (empRFCs    || []).forEach(function(r){ if(r) empRFCSet[(r+'').toUpperCase()] = true; });
      (empNombres || []).forEach(function(n){ if(n) empNomSet[(n+'').toLowerCase()] = true; });
      var rows = await _dbQArr('DB.facturas.ytdRecibidas',
        sb.from('facturas')
          .select('emisor_nombre,emisor_rfc,total,efecto_sat')
          .eq('tipo', 'recibida')
          .not('efecto_sat', 'ilike', '%nómin%')
          .eq('year', y)
      );
      return rows.filter(function (f) {
        var rfc = (f.emisor_rfc   || '').toUpperCase();
        var nom = (f.emisor_nombre || '').toLowerCase();
        return !empRFCSet[rfc] && !empNomSet[nom];
      });
    },

    ytdEmitidas: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.ytdEmitidas',
        sb.from('facturas')
          .select('receptor_nombre,receptor_rfc,total,efecto_sat,conciliado,fecha,cliente_id')
          .eq('tipo', 'emitida')
          .neq('estatus', 'cancelada')
          .eq('year', y)
      );
    },

    pendientesComplemento: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.pendientesComplemento',
        sb.from('facturas')
          .select('id,receptor_nombre,numero_factura,fecha,total,metodo_pago')
          .eq('tipo', 'emitida')
          .eq('metodo_pago', 'PPD')
          .eq('complemento_ok', false)
          .neq('estatus', 'cancelada')
          .eq('year', y)
          .order('fecha')
      );
    },

    buscarRecibidas: async function (q, año) {
      var y = año || new Date().getFullYear();
      var base = sb.from('facturas')
        .select('id,emisor_nombre,numero_factura,total,fecha,concepto,efecto_sat')
        .eq('tipo', 'recibida')
        .not('efecto_sat', 'ilike', '%nómin%')
        .eq('year', y)
        .order('fecha', { ascending: false })
        .limit(50);
      if (q) base = base.or('emisor_nombre.ilike.%' + q + '%,numero_factura.ilike.%' + q + '%,concepto.ilike.%' + q + '%');
      return _dbQArr('DB.facturas.buscarRecibidas', base);
    },

    mayoresDeudores: async function (empRFCs, empNombres) {
      var empRFCSet = {};
      var empNomSet = {};
      (empRFCs    || []).forEach(function(r){ if(r) empRFCSet[(r+'').toUpperCase()] = true; });
      (empNombres || []).forEach(function(n){ if(n) empNomSet[(n+'').toLowerCase()] = true; });
      var rows = await _dbQArr('DB.facturas.mayoresDeudores',
        sb.from('facturas')
          .select('receptor_nombre,receptor_rfc,total,cliente_id')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
      );
      return rows.filter(function (f) {
        var rfc = (f.receptor_rfc   || '').toUpperCase();
        var nom = (f.receptor_nombre || '').toLowerCase();
        return !empRFCSet[rfc] && !empNomSet[nom];
      });
    },
  },

  // ── movimientos_v2 ─────────────────────────────────────────────────────

  movimientos: {

    list: async function (año, filtros) {
      var y = año || new Date().getFullYear();
      var q = sb.from('movimientos_v2').select('*').eq('year', y);
      if (filtros && filtros.origenes) q = q.in('origen', filtros.origenes);
      if (filtros && filtros.tipo)     q = q.eq('tipo', filtros.tipo);
      return _dbQArr('DB.movimientos.list', q.order('fecha').limit(2000));
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('movimientos_v2').update(data).eq('id', data.id).select().single()
        : sb.from('movimientos_v2').insert([data]).select().single();
      return _dbQ('DB.movimientos.save', op);
    },

    delete: async function (id) {
      return _dbQArr('DB.movimientos.delete',
        sb.from('movimientos_v2').delete().eq('id', id)
      );
    },

    conciliar: async function (id, factId) {
      var upd = { conciliado: true };
      if (factId) upd.factura_id = factId;
      return _dbQArr('DB.movimientos.conciliar',
        sb.from('movimientos_v2').update(upd).eq('id', id)
      );
    },

    banco: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.movimientos.banco',
        sb.from('movimientos_v2')
          .select('*')
          .eq('year', y)
          .in('origen', ['sat_emitida', 'sat_recibida', 'banco', 'manual'])
          .order('fecha')
          .order('orden')
      );
    },

    ultimoSaldo: async function () {
      return _dbQ('DB.movimientos.ultimoSaldo',
        sb.from('movimientos_v2')
          .select('saldo,fecha')
          .in('origen', ['sat_emitida', 'sat_recibida', 'banco'])
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle()
      );
    },

    porCliente: async function (nombre, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'categoria,tipo,monto,fecha,descripcion,origen,conciliado';
      var r1 = nombre
        ? await _dbQArr('DB.movimientos.porCliente:nombre',
            sb.from('movimientos_v2').select(cols)
              .ilike('contraparte','%'+nombre+'%').eq('year',y).order('fecha',{ascending:false}))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.movimientos.porCliente:rfc',
            sb.from('movimientos_v2').select(cols)
              .ilike('rfc_contraparte','%'+rfc+'%').eq('year',y).order('fecha',{ascending:false}))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function (m) {
        var k = m.fecha + '_' + m.monto + '_' + (m.descripcion||'');
        if (seen[k]) return false;
        return (seen[k] = true);
      });
    },

    upsertBanco: async function (rows) {
      if (!rows || !rows.length) return [];
      return _dbQArr('DB.movimientos.upsertBanco',
        sb.from('movimientos_v2').upsert(rows, { onConflict: 'id' }).select()
      );
    },
  },

  // ── proyecto_costos ────────────────────────────────────────────────────

  costos: {

    byProyecto: async function (id) {
      return _dbQArr('DB.costos.byProyecto',
        sb.from('proyecto_costos')
          .select('*')
          .eq('proyecto_id', id)
          .order('semana')
          .order('created_at')
      );
    },

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _dbQArr('DB.costos.byProyectos',
        sb.from('proyecto_costos')
          .select('id,proyecto_id,monto,categoria,subcategoria,semana')
          .in('proyecto_id', ids)
      );
    },

    insert: async function (rows) {
      if (!rows || !rows.length) return [];
      return _dbQArr('DB.costos.insert',
        sb.from('proyecto_costos').insert(rows).select()
      );
    },

    delete: async function (id) {
      return _dbQArr('DB.costos.delete',
        sb.from('proyecto_costos').delete().eq('id', id)
      );
    },
  },

  // ── factura_asignaciones ───────────────────────────────────────────────

  asignaciones: {

    byProyecto: async function (id) {
      return _dbQArr('DB.asignaciones.byProyecto',
        sb.from('factura_asignaciones')
          .select('*')
          .eq('proyecto_id', id)
          .order('created_at')
      );
    },

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _dbQArr('DB.asignaciones.byProyectos',
        sb.from('factura_asignaciones')
          .select('id,proyecto_id,monto,porcentaje,factura_id,categoria')
          .in('proyecto_id', ids)
      );
    },

    byFactura: async function (factId) {
      return _dbQArr('DB.asignaciones.byFactura',
        sb.from('factura_asignaciones')
          .select('id,proyecto_id,porcentaje,monto,notas')
          .eq('factura_id', factId)
          .order('created_at')
      );
    },

    usadoPorFactura: async function (factId, excludeId) {
      var rows = await _dbQArr('DB.asignaciones.usadoPorFactura',
        sb.from('factura_asignaciones')
          .select('id,porcentaje')
          .eq('factura_id', factId)
      );
      return rows
        .filter(function (r) { return r.id !== excludeId; })
        .reduce(function (s, r) { return s + (parseFloat(r.porcentaje) || 0); }, 0);
    },

    insert: async function (data) {
      return _dbQ('DB.asignaciones.insert',
        sb.from('factura_asignaciones').insert([data]).select().single()
      );
    },

    delete: async function (id) {
      return _dbQArr('DB.asignaciones.delete',
        sb.from('factura_asignaciones').delete().eq('id', id)
      );
    },
  },

};
