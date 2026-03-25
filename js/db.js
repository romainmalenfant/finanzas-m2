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

    byNombre: async function (nombre) {
      return _dbQ('DB.clientes.byNombre',
        sb.from('clientes').select('*').ilike('nombre', '%' + nombre + '%').limit(1).maybeSingle()
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
      var key = año ? 'proyectos:list:' + año : 'proyectos:list:all';
      return _dbCached(key, async function () {
        var q = sb.from('proyectos').select('*').order('fecha_entrega', {ascending:true});
        if (año) q = q.eq('year', año);
        return _dbQArr('DB.proyectos.list', q);
      });
    },

    softDelete: async function (id) {
      _dbBust('proyectos:');
      return _dbQArr('DB.proyectos.softDelete',
        sb.from('proyectos').update({ activo: false }).eq('id', id)
      );
    },

    cerrar: async function (id) {
      _dbBust('proyectos:');
      return _dbQ('DB.proyectos.cerrar',
        sb.from('proyectos').update({ cerrado: true }).eq('id', id).select().single()
      );
    },

    reabrir: async function (id) {
      _dbBust('proyectos:');
      return _dbQ('DB.proyectos.reabrir',
        sb.from('proyectos').update({ cerrado: false }).eq('id', id).select().single()
      );
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

    softDeleteByProyecto: async function (proyId) {
      return _dbQArr('DB.entregas.softDeleteByProyecto',
        sb.from('entregas').update({ activo: false }).eq('proyecto_id', proyId)
      );
    },
  },

  // ── cotizaciones ───────────────────────────────────────────────────────

  cotizaciones: {

    list: async function (año) {
      var q = sb.from('cotizaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (año) q = q.eq('year', año);
      return _dbQArr('DB.cotizaciones.list', q);
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

    /** Genera número de folio: retorna el count de COT con ese prefijo. */
    countPeriodo: async function (prefix) {
      var res = await sb.from('cotizaciones')
        .select('*', { count: 'exact', head: true })
        .ilike('numero', prefix + '%');
      if (res.error) throw new Error('[DB.cotizaciones.countPeriodo] ' + res.error.message);
      return res.count || 0;
    },

    /** Todas las versiones de una cotización (por base id o propio id). */
    versionesByBase: async function (baseId) {
      return _dbQArr('DB.cotizaciones.versionesByBase',
        sb.from('cotizaciones')
          .select('id,numero,version,total,estatus,pdf_path,fecha,cotizacion_base_id,cliente_nombre')
          .or('id.eq.' + baseId + ',cotizacion_base_id.eq.' + baseId)
          .order('version', { ascending: true })
      );
    },

    /** Guarda el pdf_path generado. */
    savePdfPath: async function (id, pdfPath) {
      return _dbQ('DB.cotizaciones.savePdfPath',
        sb.from('cotizaciones').update({ pdf_path: pdfPath }).eq('id', id).select().single()
      );
    },

    /** Vincula contacto a cotización. */
    linkContact: async function (id, contactoId) {
      return _dbQArr('DB.cotizaciones.linkContact',
        sb.from('cotizaciones').update({ contacto_id: contactoId }).eq('id', id)
      );
    },

    /** Cotizaciones de un cliente — busca por cliente_id o por nombre ilike. */
    byCliente: async function (clienteId, nombre) {
      var cols = 'id,numero,version,estatus,total,fecha,cliente_nombre,numero_requisicion,fecha_cierre,usuario_cliente_id,pdf_path,cotizacion_base_id';
      var q = sb.from('cotizaciones').select(cols).order('fecha', { ascending: false }).limit(50);
      if (clienteId) q = q.eq('cliente_id', clienteId);
      else if (nombre) q = q.ilike('cliente_nombre', '%' + nombre + '%');
      return _dbQArr('DB.cotizaciones.byCliente', q);
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

    // Upsert: INSERT si no existe, UPDATE si ya existe — para import XML
    upsert: async function (data) {
      return _dbQ('DB.facturas.upsert',
        sb.from('facturas').upsert(data, { onConflict: 'id' })
      );
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
      var sel = sb.from('facturas')
        .select('id,emisor_nombre,numero_factura,total,fecha,concepto,efecto_sat')
        .eq('tipo', 'recibida')
        .not('efecto_sat', 'ilike', '%nómin%')
        .eq('year', y)
        .order('fecha', { ascending: false })
        .limit(50);
      if (!q) return _dbQArr('DB.facturas.buscarRecibidas', sel);
      var base2 = function() {
        return sb.from('facturas')
          .select('id,emisor_nombre,numero_factura,total,fecha,concepto,efecto_sat')
          .eq('tipo', 'recibida').not('efecto_sat', 'ilike', '%nómin%')
          .eq('year', y).order('fecha', { ascending: false }).limit(20);
      };
      // Texto: proveedor, folio, concepto (solo columnas text — sin id UUID)
      var textQ = sel.or(
        'emisor_nombre.ilike.%' + q + '%' +
        ',numero_factura.ilike.%' + q + '%' +
        ',concepto.ilike.%' + q + '%'
      );
      var rows = await _dbQArr('DB.facturas.buscarRecibidas', textQ);
      var seen = {}; rows.forEach(function(r){ seen[r.id] = true; });
      function _merge(arr){ arr.forEach(function(r){ if(!seen[r.id]){ rows.push(r); seen[r.id]=true; } }); }
      // UUID: exact match solo si el input luce como UUID (36 chars con guiones)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.trim())) {
        try {
          var uuidRows = await _dbQArr('DB.facturas.buscarRecibidas:uuid',
            base2().eq('id', q.trim()));
          _merge(uuidRows);
        } catch(e) { /* silenciar si falla */ }
      }
      // Monto: query separada solo si q es puramente numérico
      var numQ = parseFloat(q.replace(/[$,\s]/g, ''));
      if (/^[$\d,.\s]+$/.test(q) && !isNaN(numQ) && numQ > 0) {
        var amountRows = await _dbQArr('DB.facturas.buscarRecibidas:monto',
          base2().gte('total', numQ * 0.995).lte('total', numQ * 1.005));
        _merge(amountRows);
      }
      return rows;
    },

    /** Todas las facturas de un año — para la pestaña Facturas. */
    loadAll: async function (year) {
      var y = year || new Date().getFullYear();
      return _dbQArr('DB.facturas.loadAll',
        sb.from('facturas').select('*').eq('year', y).order('fecha', { ascending: false })
      );
    },

    /** Cartera emitida pendiente (con efecto_sat Ingreso o null). */
    cartera: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.cartera',
        sb.from('facturas')
          .select('id,receptor_nombre,numero_factura,fecha,fecha_vencimiento,total,monto_pagado,efecto_sat')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .or('efecto_sat.eq.Ingreso,efecto_sat.is.null')
          .order('fecha', { ascending: true })
          .limit(200)
      );
    },

    /** Cartera recibida pendiente (cxp). */
    carteraCxP: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.carteraCxP',
        sb.from('facturas')
          .select('id,emisor_nombre,numero_factura,fecha,fecha_vencimiento,total,monto_pagado')
          .eq('tipo', 'recibida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .order('fecha', { ascending: true })
          .limit(200)
      );
    },

    /** Complementos de pago por emitir (PPD conciliadas sin complemento). */
    complementosPorHacer: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.complementosPorHacer',
        sb.from('facturas')
          .select('id,receptor_nombre,receptor_rfc,numero_factura,uuid_sat,concepto,fecha,total')
          .eq('tipo', 'emitida').eq('metodo_pago', 'PPD').eq('conciliado', true)
          .or('complemento_ok.is.null,complemento_ok.eq.false')
          .neq('estatus', 'cancelada').eq('year', y)
          .order('fecha', { ascending: false }).limit(100)
      );
    },

    /** Complementos de pago por recibir (PPD recibidas sin complemento). */
    complementosPorRecibir: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.complementosPorRecibir',
        sb.from('facturas')
          .select('id,emisor_nombre,numero_factura,concepto,fecha,total')
          .eq('tipo', 'recibida').eq('metodo_pago', 'PPD').eq('conciliado', true)
          .or('complemento_ok.is.null,complemento_ok.eq.false')
          .neq('estatus', 'cancelada').eq('year', y)
          .order('fecha', { ascending: false }).limit(100)
      );
    },

    /** CxC de una empresa: busca por cliente_id Y rfc, deduplica. */
    cxcByCliente: async function (clienteId, rfc) {
      var cols = 'id,total,fecha,concepto,numero_factura,cliente_id,receptor_rfc';
      var r1 = clienteId
        ? await _dbQArr('DB.facturas.cxcByCliente:id',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente').eq('cliente_id', clienteId))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.cxcByCliente:rfc',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('conciliado',false).eq('estatus','vigente').eq('receptor_rfc', rfc))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function(f){ if(seen[f.id])return false; return(seen[f.id]=true); });
    },

    /** CxP de un proveedor: busca por proveedor_id Y rfc, deduplica. */
    cxpByProveedor: async function (provId, rfc) {
      var cols = 'id,total,fecha,concepto,numero_factura,proveedor_id,emisor_rfc';
      var r1 = provId
        ? await _dbQArr('DB.facturas.cxpByProveedor:id',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('conciliado',false).eq('estatus','vigente').eq('proveedor_id', String(provId)))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.cxpByProveedor:rfc',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('conciliado',false).eq('estatus','vigente').eq('emisor_rfc', rfc))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function(f){ if(seen[f.id])return false; return(seen[f.id]=true); });
    },

    /** Ventas YTD de un cliente: busca por id Y rfc, suma totales. */
    ytdByCliente: async function (clienteId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'total,cliente_id,receptor_rfc';
      var r1 = clienteId
        ? await _dbQArr('DB.facturas.ytdByCliente:id',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('year',y).neq('estatus','cancelada').eq('efecto_sat','Ingreso').eq('cliente_id', clienteId))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.ytdByCliente:rfc',
            sb.from('facturas').select(cols).eq('tipo','emitida').eq('year',y).neq('estatus','cancelada').eq('efecto_sat','Ingreso').eq('receptor_rfc', rfc))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function(f){ if(seen[f.cliente_id+'_'+f.receptor_rfc])return false; return(seen[f.cliente_id+'_'+f.receptor_rfc]=true); });
    },

    /** Compras YTD de un proveedor: busca por id Y rfc, suma totales. */
    ytdByProveedor: async function (provId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'total,proveedor_id,emisor_rfc';
      var r1 = provId
        ? await _dbQArr('DB.facturas.ytdByProveedor:id',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('year',y).neq('estatus','cancelada').eq('efecto_sat','Ingreso').eq('proveedor_id', String(provId)))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.facturas.ytdByProveedor:rfc',
            sb.from('facturas').select(cols).eq('tipo','recibida').eq('year',y).neq('estatus','cancelada').eq('efecto_sat','Ingreso').eq('emisor_rfc', rfc))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function(f){ if(seen[f.proveedor_id+'_'+f.emisor_rfc])return false; return(seen[f.proveedor_id+'_'+f.emisor_rfc]=true); });
    },

    /** Facturas vinculadas a un proyecto. */
    porProyecto: async function (proyId) {
      return _dbQArr('DB.facturas.porProyecto',
        sb.from('facturas')
          .select('id,fecha,numero_factura,total,conciliado,tipo,receptor_nombre,emisor_nombre,proyecto_id')
          .eq('proyecto_id', proyId)
          .order('fecha', { ascending: false })
          .limit(50)
      );
    },

    /** Facturas emitidas vinculadas a varios proyectos (para ranking de rentabilidad). */
    porProyectos: async function (ids) {
      if(!ids||!ids.length) return [];
      return _dbQArr('DB.facturas.porProyectos',
        sb.from('facturas')
          .select('id,total,tipo,proyecto_id')
          .in('proyecto_id', ids)
          .eq('tipo','emitida')
      );
    },

    /** Facturas emitidas de un cliente sin proyecto asignado (para vincular). */
    porClienteSinProyecto: async function (clienteId) {
      return _dbQArr('DB.facturas.porClienteSinProyecto',
        sb.from('facturas')
          .select('id,fecha,numero_factura,total,conciliado,tipo,receptor_nombre')
          .eq('cliente_id', clienteId)
          .eq('tipo', 'emitida')
          .is('proyecto_id', null)
          .order('fecha', { ascending: false })
          .limit(30)
      );
    },

    /** CxC para dashboard: todas las emitidas pendientes (Ingreso). */
    cxcDashboard: async function () {
      return _dbQArr('DB.facturas.cxcDashboard',
        sb.from('facturas')
          .select('receptor_nombre,total,fecha')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .eq('efecto_sat', 'Ingreso')
      );
    },

    /** CxP para dashboard: todas las recibidas pendientes (Ingreso). */
    cxpDashboard: async function () {
      return _dbQArr('DB.facturas.cxpDashboard',
        sb.from('facturas')
          .select('emisor_nombre,total,fecha')
          .eq('tipo', 'recibida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .eq('efecto_sat', 'Ingreso')
      );
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

    /** Todas emitidas Ingreso del año — para dashboard (total,month,year). */
    emitidas_ytd: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.emitidas_ytd',
        sb.from('facturas').select('total,month,year')
          .eq('tipo', 'emitida').eq('year', y).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
      );
    },

    /** Todas recibidas Ingreso del año — para dashboard (total,month). */
    recibidas_ytd: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.recibidas_ytd',
        sb.from('facturas').select('total,month')
          .eq('tipo', 'recibida').eq('year', y).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
      );
    },

    /** Emitidas Ingreso de un mes específico (para MoM). */
    emitidas_mes: async function (año, mes) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.emitidas_mes',
        sb.from('facturas').select('total')
          .eq('tipo', 'emitida').eq('year', y).eq('month', mes).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
      );
    },

    /** Recibidas Ingreso de un mes específico (para MoM). */
    recibidas_mes: async function (año, mes) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.recibidas_mes',
        sb.from('facturas').select('total')
          .eq('tipo', 'recibida').eq('year', y).eq('month', mes).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
      );
    },

    /** Todas emitidas Ingreso pendientes de cobro (sin filtro de año). */
    porCobrarAll: async function () {
      return _dbQArr('DB.facturas.porCobrarAll',
        sb.from('facturas').select('total')
          .eq('tipo', 'emitida').eq('conciliado', false).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
      );
    },

    /** CxC para contexto IA — más columnas que cxcDashboard. */
    cxcContext: async function () {
      return _dbQArr('DB.facturas.cxcContext',
        sb.from('facturas')
          .select('receptor_nombre,receptor_rfc,total,fecha,numero_factura,concepto')
          .eq('tipo', 'emitida').eq('conciliado', false).neq('estatus', 'cancelada')
          .order('fecha', { ascending: false }).limit(20)
      );
    },

    /** CxP para contexto IA — más columnas que cxpDashboard. */
    cxpContext: async function () {
      return _dbQArr('DB.facturas.cxpContext',
        sb.from('facturas')
          .select('emisor_nombre,emisor_rfc,total,fecha,numero_factura,concepto')
          .eq('tipo', 'recibida').eq('conciliado', false).neq('estatus', 'cancelada').eq('efecto_sat', 'Ingreso')
          .order('fecha', { ascending: false }).limit(20)
      );
    },

    /** Ventas directas (sin_factura=true) del año. */
    vtaDirectas: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.vtaDirectas',
        sb.from('facturas').select('total').eq('tipo', 'emitida').eq('sin_factura', true).eq('year', y)
      );
    },

    /** Facturas emitidas para el tab Flujo (full cols, year + mes opcional). */
    emitidasFlujo: async function (año, mes) {
      var y = año || new Date().getFullYear();
      var q = sb.from('facturas')
        .select('id,fecha,total,receptor_nombre,cliente_id,concepto,numero_factura,sin_factura,numero_vta,metodo_pago,conciliado,estatus')
        .eq('tipo', 'emitida').eq('year', y);
      if (mes && mes > 0) q = q.eq('month', mes);
      return _dbQArr('DB.facturas.emitidasFlujo', q.order('fecha', { ascending: false }));
    },

    /** Solo totales de emitidas para cálculo YTD en Flujo. */
    emitidasYTDTotal: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.facturas.emitidasYTDTotal',
        sb.from('facturas').select('total').eq('tipo', 'emitida').eq('year', y).neq('estatus', 'cancelada')
      );
    },

    /** Todas las facturas pendientes de conciliación (sin filtro de tipo). */
    pendientesConc: async function () {
      return _dbQArr('DB.facturas.pendientesConc',
        sb.from('facturas')
          .select('id,tipo,receptor_nombre,emisor_nombre,total,fecha')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .in('efecto_sat', ['Ingreso', 'ingreso'])
      );
    },

    /** Facturas pendientes de conciliación de un tipo específico. */
    pendientesConcTipo: async function (tipo) {
      return _dbQArr('DB.facturas.pendientesConcTipo',
        sb.from('facturas')
          .select('id,tipo,receptor_nombre,emisor_nombre,total,fecha')
          .eq('tipo', tipo)
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
      );
    },

    /** Facturas pendientes de conciliación en un rango de monto (±10%). */
    pendientesConcRango: async function (tipo, min, max) {
      return _dbQArr('DB.facturas.pendientesConcRango',
        sb.from('facturas')
          .select('id,receptor_nombre,emisor_nombre,numero_factura,fecha,total,metodo_pago,concepto')
          .eq('tipo', tipo)
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .gte('total', min)
          .lte('total', max)
      );
    },

    /** Cuenta facturas de venta directa (VTA-año-NNN) para generar siguiente número. */
    contarVta: async function (año) {
      var res = await sb.from('facturas')
        .select('*', { count: 'exact', head: true })
        .ilike('numero_vta', 'VTA-' + año + '-%');
      if (res.error) throw new Error('[DB.facturas.contarVta] ' + res.error.message);
      return res.count || 0;
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

    /** Movimientos flujo (manual/banco) de un año, mes opcional. */
    flujo: async function (año, mes) {
      var y = año || new Date().getFullYear();
      var q = sb.from('movimientos_v2').select('*')
        .eq('year', y)
        .in('origen', ['manual', 'banco_abono', 'banco_cargo']);
      if (mes && mes > 0) q = q.eq('month', mes);
      return _dbQArr('DB.movimientos.flujo', q.order('fecha', { ascending: false }));
    },

    /** KPIs YTD: categoria+monto para todo el año. */
    ytdKPIs: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.movimientos.ytdKPIs',
        sb.from('movimientos_v2').select('categoria,monto').eq('year', y)
      );
    },

    /** Todos los movimientos de un mes (sin filtro de origen, para reportes). */
    porMes: async function (año, mes) {
      return _dbQArr('DB.movimientos.porMes',
        sb.from('movimientos_v2').select('*').eq('year', año).eq('month', mes).order('fecha', { ascending: true })
      );
    },

    /** Ventas YTD por cliente (contraparte,monto) para KPIs de empresas. */
    ventasYTD: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.movimientos.ventasYTD',
        sb.from('movimientos_v2').select('contraparte,monto').eq('categoria', 'venta').eq('year', y)
      );
    },

    /** Movimientos SAT emitida vinculados a un proyecto. */
    satLinkedProyecto: async function (proyId) {
      return _dbQArr('DB.movimientos.satLinkedProyecto',
        sb.from('movimientos_v2')
          .select('id,fecha,monto,numero_factura,conciliado')
          .eq('origen', 'sat_emitida')
          .eq('proyecto_id', proyId)
      );
    },

    /** Movimientos SAT emitida disponibles para un cliente (sin proyecto asignado). */
    satDisponiblesProyecto: async function (clienteId) {
      return _dbQArr('DB.movimientos.satDisponiblesProyecto',
        sb.from('movimientos_v2')
          .select('id,fecha,monto,numero_factura,contraparte')
          .eq('origen', 'sat_emitida')
          .eq('cliente_id', clienteId)
          .is('proyecto_id', null)
      );
    },

    /** Asigna o desasigna un proyecto a un movimiento. */
    setProyecto: async function (id, proyId) {
      return _dbQArr('DB.movimientos.setProyecto',
        sb.from('movimientos_v2').update({ proyecto_id: proyId || null }).eq('id', id)
      );
    },

    /** SAT emitidas pendientes de conciliación para un cliente (por id o RFC). */
    satPendientesCliente: async function (clienteId, rfc) {
      var cols = 'id,descripcion,monto,fecha,moneda,numero_factura,tipo_cambio,contraparte,rfc_contraparte';
      var r1 = clienteId
        ? await _dbQArr('DB.movimientos.satPendientesCliente:id',
            sb.from('movimientos_v2').select(cols).eq('origen', 'sat_emitida').eq('conciliado', false).eq('cliente_id', clienteId))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.movimientos.satPendientesCliente:rfc',
            sb.from('movimientos_v2').select(cols).eq('origen', 'sat_emitida').eq('conciliado', false).eq('rfc_contraparte', rfc))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function (m) {
        if (seen[m.id]) return false; return (seen[m.id] = true);
      });
    },

    /** Vincula un movimiento SAT a otro como movimiento relacionado. */
    linkRelacionado: async function (id, relId) {
      return _dbQArr('DB.movimientos.linkRelacionado',
        sb.from('movimientos_v2').update({ conciliado: true, movimiento_relacionado_id: relId }).eq('id', id)
      );
    },

    /** Último saldo registrado desde importaciones banco (banco_abono/banco_cargo). */
    ultimoSaldoBanco: async function () {
      return _dbQ('DB.movimientos.ultimoSaldoBanco',
        sb.from('movimientos_v2').select('saldo,fecha')
          .in('origen', ['banco_abono', 'banco_cargo'])
          .order('fecha', { ascending: false })
          .order('orden', { ascending: false })
          .limit(1).maybeSingle()
      );
    },

    /** Verifica cuáles IDs ya existen en la tabla. */
    checkExistentes: async function (ids) {
      if (!ids || !ids.length) return [];
      return _dbQArr('DB.movimientos.checkExistentes',
        sb.from('movimientos_v2').select('id').in('id', ids)
      );
    },

    /** Movimientos banco (banco_abono/banco_cargo) para un año, mes opcional. */
    bancoCargos: async function (año, mes) {
      var y = año || new Date().getFullYear();
      var q = sb.from('movimientos_v2').select('*')
        .eq('year', y)
        .in('origen', ['banco_abono', 'banco_cargo']);
      if (mes && mes > 0) q = q.eq('month', mes);
      return _dbQArr('DB.movimientos.bancoCargos',
        q.order('fecha', { ascending: false }).order('orden', { ascending: false })
      );
    },

    /** Actualiza la categoría de un movimiento. */
    updateCategoria: async function (id, cat) {
      return _dbQArr('DB.movimientos.updateCategoria',
        sb.from('movimientos_v2').update({ categoria: cat }).eq('id', id)
      );
    },

    /** Movimientos vinculados a un conjunto de facturas (para complementos). */
    byFacturas: async function (ids) {
      if (!ids || !ids.length) return [];
      return _dbQArr('DB.movimientos.byFacturas',
        sb.from('movimientos_v2').select('factura_id,fecha,descripcion').in('factura_id', ids)
      );
    },

    /** Todos los movimientos del año — summary para dashboard (categoria,tipo,monto,month,year). */
    ytdSummary: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.movimientos.ytdSummary',
        sb.from('movimientos_v2').select('categoria,tipo,monto,month,year').eq('year', y)
      );
    },

    /** Todos los movimientos del año — full cols para contexto IA. */
    ytdFull: async function (año) {
      var y = año || new Date().getFullYear();
      return _dbQArr('DB.movimientos.ytdFull',
        sb.from('movimientos_v2')
          .select('categoria,tipo,monto,fecha,month,contraparte,rfc_contraparte,descripcion,origen,conciliado,etiqueta,numero_factura,moneda')
          .eq('year', y).order('fecha', { ascending: false }).limit(2000)
      );
    },

    /** Movimientos de un mes y año específico (para comparativa MoM). */
    delMes: async function (año, mes) {
      return _dbQArr('DB.movimientos.delMes',
        sb.from('movimientos_v2').select('tipo,monto,categoria').eq('year', año).eq('month', mes)
      );
    },

    /** Últimos N movimientos sin filtro de año. */
    recientes: async function (n) {
      return _dbQArr('DB.movimientos.recientes',
        sb.from('movimientos_v2').select('*').order('fecha', { ascending: false }).limit(n || 8)
      );
    },

    /** Movimientos de un cliente por cliente_id exacto (+ por rfc_contraparte si hay RFC). */
    porClienteId: async function (clienteId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'categoria,tipo,monto,fecha,descripcion,contraparte';
      var r1 = clienteId
        ? await _dbQArr('DB.movimientos.porClienteId:id',
            sb.from('movimientos_v2').select(cols).eq('year', y).eq('cliente_id', clienteId).order('fecha', { ascending: false }).limit(20))
        : [];
      var r2 = rfc
        ? await _dbQArr('DB.movimientos.porClienteId:rfc',
            sb.from('movimientos_v2').select(cols).eq('year', y).eq('rfc_contraparte', rfc).order('fecha', { ascending: false }).limit(20))
        : [];
      var seen = {};
      return r1.concat(r2).filter(function (m) {
        var k = (m.fecha || '') + '_' + (m.monto || '') + '_' + (m.descripcion || '');
        if (seen[k]) return false;
        return (seen[k] = true);
      });
    },
  },

  // ── proyecto_costos ────────────────────────────────────────────────────

  costos: {

    byProyecto: async function (id) {
      return _dbQArr('DB.costos.byProyecto',
        sb.from('proyecto_costos')
          .select('*')
          .eq('proyecto_id', id)
          .order('semana', { ascending: false })
          .order('created_at', { ascending: false })
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
          .select('id,proyecto_id,monto,porcentaje,factura_id')
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

  // ── storage ────────────────────────────────────────────────────────────────

  storage: {

    /** Sube un archivo al bucket facturas. path = 'año/uuid.xml' o 'año/uuid.pdf' */
    upload: async function (path, file) {
      var res = await sb.storage.from('facturas').upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      });
      if (res.error) throw new Error('[DB.storage.upload] ' + res.error.message);
      return res.data;
    },

    /** URL firmada para descargar (válida 1 hora). */
    signedUrl: async function (path) {
      var res = await sb.storage.from('facturas').createSignedUrl(path, 3600);
      if (res.error) throw new Error('[DB.storage.signedUrl] ' + res.error.message);
      return res.data.signedUrl;
    },

    /** Vincula xml_path y/o pdf_path al registro de factura. */
    linkPaths: async function (facturaId, paths) {
      var res = await sb.from('facturas').update(paths).eq('id', facturaId);
      if (res.error) throw new Error('[DB.storage.linkPaths] ' + res.error.message);
    },

  },

  // ── documentos (huérfanos y vinculados) ────────────────────────────────────
  documentos: {

    /** Guarda un documento (huérfano si no tiene factura_id). */
    save: async function (data) {
      var res = await sb.from('documentos').insert([data]).select().single();
      if (res.error) throw new Error('[DB.documentos.save] ' + res.error.message);
      return res.data;
    },

    /** Upsert por id — para complementos/cancelaciones que usan UUID del CFDI como id. */
    upsert: async function (data) {
      var res = await sb.from('documentos').upsert(data, { onConflict: 'id' }).select().single();
      if (res.error) throw new Error('[DB.documentos.upsert] ' + res.error.message);
      return res.data;
    },

    /** Lista huérfanos (sin factura vinculada). */
    huerfanos: async function () {
      return _dbQArr('DB.documentos.huerfanos',
        sb.from('documentos').select('*').is('factura_id', null).order('created_at', { ascending: false })
      );
    },

    /** Vincula un documento huérfano a una factura. */
    vincular: async function (docId, facturaId, pdfPath) {
      // Actualizar registro en documentos
      var r1 = await sb.from('documentos').update({ factura_id: facturaId }).eq('id', docId);
      if (r1.error) throw new Error('[DB.documentos.vincular] ' + r1.error.message);
      // Actualizar pdf_path en la factura
      var r2 = await sb.from('facturas').update({ pdf_path: pdfPath }).eq('id', facturaId);
      if (r2.error) throw new Error('[DB.documentos.vincular:factura] ' + r2.error.message);
    },

  },

};
