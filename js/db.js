// ── DB — Data Access Layer ──────────────────────────────────────────────────
// Única fuente de verdad para todas las queries a Supabase.
// Ningún módulo debe llamar sb.from() directamente — usar DB.tabla.método().
//
// Convención de retorno:
//   - Los métodos retornan el dato directamente (array u objeto).
//   - En error, lanzan un Error con contexto: "[DB.facturas.list] mensaje"
//   - Los métodos de mutación (save/delete) retornan el registro afectado o void.
//
// Uso:
//   var facts = await DB.facturas.list({ year: 2025, tipo: 'emitida' });
//   var proy  = await DB.proyectos.get(id);
//   await DB.clientes.save({ id: '...', nombre: '...' });
// ───────────────────────────────────────────────────────────────────────────

var DB = (function () {

  // ── Infraestructura interna ──────────────────────────────────────────────

  var _cache  = {};
  var _TTL    = 300000; // 5 min

  /** Ejecuta fn(), guarda resultado en caché bajo key. */
  async function _cached(key, fn) {
    var now = Date.now();
    if (_cache[key] && (now - _cache[key].t) < _TTL) return _cache[key].d;
    var d = await fn();
    _cache[key] = { d: d, t: now };
    return d;
  }

  /** Invalida entradas de caché cuya clave empieza con prefix. */
  function _bust(prefix) {
    Object.keys(_cache).forEach(function (k) {
      if (k.indexOf(prefix) === 0) delete _cache[k];
    });
  }

  /**
   * Ejecuta una query de Supabase y lanza error con contexto si falla.
   * @param {string} label  p.ej. "DB.facturas.list"
   * @param {Promise} chain  resultado de sb.from(...).select(...)...
   * @param {'array'|'single'|'maybeSingle'} mode
   */
  async function _q(label, chain, mode) {
    var res = await chain;
    if (res.error) throw new Error('[' + label + '] ' + res.error.message);
    if (mode === 'single' || mode === 'maybeSingle') return res.data;
    return res.data || [];
  }

  // ── empleados ────────────────────────────────────────────────────────────

  var empleados = {

    list: async function () {
      return _cached('empleados:list', async function () {
        return _q('DB.empleados.list',
          sb.from('empleados').select('*').order('nombre')
        );
      });
    },

    save: async function (data) {
      _bust('empleados:');
      return _q('DB.empleados.save',
        sb.from('empleados').upsert([data]).select().single(),
        'single'
      );
    },

    delete: async function (id) {
      _bust('empleados:');
      return _q('DB.empleados.delete',
        sb.from('empleados').delete().eq('id', id)
      );
    },

    /** Para importSAT: verifica qué RFCs ya existen como empleados. */
    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _q('DB.empleados.byRFC',
        sb.from('empleados').select('id,rfc,nombre').in('rfc', rfcs)
      );
    },

    /** Para importSAT: inserta empleados nuevos detectados en nómina. */
    insertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _bust('empleados:');
      return _q('DB.empleados.insertBulk',
        sb.from('empleados').insert(rows).select()
      );
    },
  };

  // ── contactos ────────────────────────────────────────────────────────────

  var contactos = {

    list: async function () {
      return _cached('contactos:list', async function () {
        return _q('DB.contactos.list',
          sb.from('contactos')
            .select('*,clientes(nombre),proveedores(nombre)')
            .order('nombre')
            .limit(500)
        );
      });
    },

    get: async function (id) {
      return _q('DB.contactos.get',
        sb.from('contactos').select('*').eq('id', id).maybeSingle(),
        'maybeSingle'
      );
    },

    save: async function (data) {
      _bust('contactos:');
      return _q('DB.contactos.save',
        sb.from('contactos').upsert([data]).select().single(),
        'single'
      );
    },

    delete: async function (id) {
      _bust('contactos:');
      return _q('DB.contactos.delete',
        sb.from('contactos').delete().eq('id', id)
      );
    },

    byCliente: async function (clienteId) {
      return _q('DB.contactos.byCliente',
        sb.from('contactos').select('*').eq('cliente_id', clienteId).order('nombre')
      );
    },

    byProveedor: async function (provId) {
      return _q('DB.contactos.byProveedor',
        sb.from('contactos').select('*').eq('proveedor_id', provId).order('nombre')
      );
    },

    /** Asocia un contacto a una empresa (cliente o proveedor). */
    link: async function (id, clienteId, provId) {
      _bust('contactos:');
      var upd = {};
      if (clienteId !== undefined) upd.cliente_id   = clienteId;
      if (provId    !== undefined) upd.proveedor_id = provId;
      return _q('DB.contactos.link',
        sb.from('contactos').update(upd).eq('id', id).select().single(),
        'single'
      );
    },
  };

  // ── clientes ─────────────────────────────────────────────────────────────

  var clientes = {

    list: async function () {
      return _cached('clientes:list', async function () {
        return _q('DB.clientes.list',
          sb.from('clientes').select('*').order('nombre').limit(500)
        );
      });
    },

    get: async function (id) {
      return _q('DB.clientes.get',
        sb.from('clientes').select('*').eq('id', id).maybeSingle(),
        'maybeSingle'
      );
    },

    save: async function (data) {
      _bust('clientes:');
      return _q('DB.clientes.save',
        sb.from('clientes').upsert([data]).select().single(),
        'single'
      );
    },

    softDelete: async function (id) {
      _bust('clientes:');
      return _q('DB.clientes.softDelete',
        sb.from('clientes').update({ activo: false }).eq('id', id)
      );
    },

    /** Para importSAT: busca clientes por array de RFCs. */
    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _q('DB.clientes.byRFC',
        sb.from('clientes').select('id,rfc').in('rfc', rfcs)
      );
    },

    /** Para importSAT: upsert masivo por RFC. */
    upsertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _bust('clientes:');
      return _q('DB.clientes.upsertBulk',
        sb.from('clientes').upsert(rows, { onConflict: 'rfc' }).select()
      );
    },
  };

  // ── proveedores ──────────────────────────────────────────────────────────

  var proveedores = {

    list: async function () {
      return _cached('proveedores:list', async function () {
        return _q('DB.proveedores.list',
          sb.from('proveedores').select('*').order('nombre').limit(500)
        );
      });
    },

    get: async function (id) {
      return _q('DB.proveedores.get',
        sb.from('proveedores').select('*').eq('id', id).maybeSingle(),
        'maybeSingle'
      );
    },

    save: async function (data) {
      _bust('proveedores:');
      return _q('DB.proveedores.save',
        sb.from('proveedores').upsert([data]).select().single(),
        'single'
      );
    },

    softDelete: async function (id) {
      _bust('proveedores:');
      return _q('DB.proveedores.softDelete',
        sb.from('proveedores').update({ activo: false }).eq('id', id)
      );
    },

    byRFC: async function (rfcs) {
      if (!rfcs || !rfcs.length) return [];
      return _q('DB.proveedores.byRFC',
        sb.from('proveedores').select('id,rfc').in('rfc', rfcs)
      );
    },

    upsertBulk: async function (rows) {
      if (!rows || !rows.length) return [];
      _bust('proveedores:');
      return _q('DB.proveedores.upsertBulk',
        sb.from('proveedores').upsert(rows, { onConflict: 'rfc' }).select()
      );
    },
  };

  // ── proyectos ────────────────────────────────────────────────────────────

  var proyectos = {

    list: async function (año) {
      var y = año || new Date().getFullYear();
      return _cached('proyectos:list:' + y, async function () {
        return _q('DB.proyectos.list',
          sb.from('proyectos').select('*').eq('year', y).order('fecha_entrega')
        );
      });
    },

    get: async function (id) {
      return _q('DB.proyectos.get',
        sb.from('proyectos').select('*').eq('id', id).maybeSingle(),
        'maybeSingle'
      );
    },

    save: async function (data) {
      _bust('proyectos:');
      var op = data.id
        ? sb.from('proyectos').update(data).eq('id', data.id).select().single()
        : sb.from('proyectos').insert([data]).select().single();
      return _q('DB.proyectos.save', op, 'single');
    },

    delete: async function (id) {
      _bust('proyectos:');
      return _q('DB.proyectos.delete',
        sb.from('proyectos').delete().eq('id', id)
      );
    },

    /** Busca proyectos por nombre de cliente (ilike) — para verDetalleEmpresa. */
    byCliente: async function (nombre, año) {
      var y = año || new Date().getFullYear();
      return _q('DB.proyectos.byCliente',
        sb.from('proyectos')
          .select('*')
          .ilike('nombre_cliente', '%' + nombre + '%')
          .eq('year', y)
      );
    },
  };

  // ── entregas ─────────────────────────────────────────────────────────────

  var entregas = {

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _q('DB.entregas.byProyectos',
        sb.from('entregas').select('*').in('proyecto_id', ids)
      );
    },

    insert: async function (data) {
      return _q('DB.entregas.insert',
        sb.from('entregas').insert([data]).select().single(),
        'single'
      );
    },

    deleteByProyecto: async function (proyId) {
      return _q('DB.entregas.deleteByProyecto',
        sb.from('entregas').delete().eq('proyecto_id', proyId)
      );
    },
  };

  // ── cotizaciones ─────────────────────────────────────────────────────────

  var cotizaciones = {

    list: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.cotizaciones.list',
        sb.from('cotizaciones')
          .select('*')
          .eq('year', y)
          .order('created_at', { ascending: false })
          .limit(500)
      );
    },

    get: async function (id) {
      return _q('DB.cotizaciones.get',
        sb.from('cotizaciones').select('*').eq('id', id).single(),
        'single'
      );
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('cotizaciones').update(data).eq('id', data.id).select().single()
        : sb.from('cotizaciones').insert([data]).select().single();
      return _q('DB.cotizaciones.save', op, 'single');
    },

    updateEstatus: async function (id, estatus, extra) {
      var upd = Object.assign({ estatus: estatus }, extra || {});
      return _q('DB.cotizaciones.updateEstatus',
        sb.from('cotizaciones').update(upd).eq('id', id).select().single(),
        'single'
      );
    },

    linkProyecto: async function (id, proyId) {
      return _q('DB.cotizaciones.linkProyecto',
        sb.from('cotizaciones')
          .update({ proyecto_id: proyId, estatus: 'cerrada' })
          .eq('id', id)
      );
    },

    /** Cuenta cotizaciones con número que empieza con prefix (para generar folio). */
    countPeriodo: async function (prefix) {
      return _q('DB.cotizaciones.countPeriodo',
        sb.from('cotizaciones').select('*', { count: 'exact', head: true }).ilike('numero', prefix + '%'),
        'maybeSingle'
      );
    },

    /** Cotizaciones vinculadas a un proyecto. */
    byProyecto: async function (proyId) {
      return _q('DB.cotizaciones.byProyecto',
        sb.from('cotizaciones')
          .select('id,numero,estatus,total,fecha,nombre_cliente,numero_requisicion,fecha_cierre')
          .eq('proyecto_id', proyId)
          .order('fecha', { ascending: false })
      );
    },
  };

  // ── cotizacion_items ─────────────────────────────────────────────────────

  var cotizacionItems = {

    byCotizacion: async function (cotId) {
      return _q('DB.cotizacionItems.byCotizacion',
        sb.from('cotizacion_items')
          .select('*')
          .eq('cotizacion_id', cotId)
          .order('orden')
      );
    },

    /**
     * Reemplaza todos los items de una cotización.
     * Elimina los existentes e inserta los nuevos en un paso lógico.
     */
    replace: async function (cotId, items) {
      await _q('DB.cotizacionItems.replace:delete',
        sb.from('cotizacion_items').delete().eq('cotizacion_id', cotId)
      );
      if (!items || !items.length) return [];
      return _q('DB.cotizacionItems.replace:insert',
        sb.from('cotizacion_items').insert(items).select()
      );
    },
  };

  // ── facturas ─────────────────────────────────────────────────────────────

  var facturas = {

    list: async function (year, tipo) {
      var y = year || new Date().getFullYear();
      var q = sb.from('facturas').select('*').eq('year', y).order('fecha');
      if (tipo) q = q.eq('tipo', tipo);
      return _q('DB.facturas.list', q);
    },

    get: async function (id) {
      return _q('DB.facturas.get',
        sb.from('facturas').select('*').eq('id', id).maybeSingle(),
        'maybeSingle'
      );
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('facturas').update(data).eq('id', data.id).select().single()
        : sb.from('facturas').insert([data]).select().single();
      return _q('DB.facturas.save', op, 'single');
    },

    cancel: async function (id) {
      return _q('DB.facturas.cancel',
        sb.from('facturas').update({ estatus: 'cancelada' }).eq('id', id)
      );
    },

    setVencimiento: async function (id, fecha) {
      return _q('DB.facturas.setVencimiento',
        sb.from('facturas').update({ fecha_vencimiento: fecha }).eq('id', id)
      );
    },

    setComplemento: async function (id) {
      return _q('DB.facturas.setComplemento',
        sb.from('facturas').update({ complemento_ok: true }).eq('id', id)
      );
    },

    linkProyecto: async function (id, proyId) {
      return _q('DB.facturas.linkProyecto',
        sb.from('facturas').update({ proyecto_id: proyId || null }).eq('id', id)
      );
    },

    conciliar: async function (id, movId) {
      return _q('DB.facturas.conciliar',
        sb.from('facturas').update({ conciliado: true }).eq('id', id)
      );
    },

    /** Para importSAT: upsert masivo por uuid_sat. */
    upsertSAT: async function (rows) {
      if (!rows || !rows.length) return [];
      return _q('DB.facturas.upsertSAT',
        sb.from('facturas').upsert(rows, { onConflict: 'uuid_sat' }).select()
      );
    },

    // ── Queries especializadas ──────────────────────────────

    /** Facturas emitidas pendientes de cobro (conciliado=false). */
    pendientesCobro: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.facturas.pendientesCobro',
        sb.from('facturas')
          .select('id,receptor_nombre,receptor_rfc,numero_factura,fecha,fecha_vencimiento,total,concepto,cliente_id')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
          .eq('year', y)
          .order('fecha')
      );
    },

    /** Facturas recibidas pendientes de pago (conciliado=false), excluyendo nómina. */
    pendientesPago: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.facturas.pendientesPago',
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

    /**
     * Facturas de un cliente — busca por cliente_id Y por RFC, deduplica.
     * Retorna { pendientes, ytd }.
     */
    porCliente: async function (clienteId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'id,total,fecha,concepto,numero_factura,conciliado,estatus';
      var [r1, r2] = await Promise.all([
        clienteId
          ? _q('DB.facturas.porCliente:id',
              sb.from('facturas').select(cols)
                .eq('tipo', 'emitida').eq('cliente_id', clienteId).eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
        rfc
          ? _q('DB.facturas.porCliente:rfc',
              sb.from('facturas').select(cols)
                .eq('tipo', 'emitida').eq('receptor_rfc', rfc).eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
      ]);
      // Deduplicar por id
      var seen = {};
      return r1.concat(r2).filter(function (f) {
        if (seen[f.id]) return false;
        return (seen[f.id] = true);
      });
    },

    /** Facturas de un proveedor — busca por proveedor_id Y por RFC, deduplica. */
    porProveedor: async function (provId, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'id,total,fecha,concepto,numero_factura,conciliado,estatus';
      var [r1, r2] = await Promise.all([
        provId
          ? _q('DB.facturas.porProveedor:id',
              sb.from('facturas').select(cols)
                .eq('tipo', 'recibida').eq('proveedor_id', provId).eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
        rfc
          ? _q('DB.facturas.porProveedor:rfc',
              sb.from('facturas').select(cols)
                .eq('tipo', 'recibida').eq('emisor_rfc', rfc).eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
      ]);
      var seen = {};
      return r1.concat(r2).filter(function (f) {
        if (seen[f.id]) return false;
        return (seen[f.id] = true);
      });
    },

    /** Clientes únicos activos en los últimos N días (default 90), excluyendo empleados. */
    activasClientes: async function (dias, empRFCs) {
      var d = dias || 90;
      var desde = new Date();
      desde.setDate(desde.getDate() - d);
      var empSet = new Set((empRFCs || []).map(function (r) { return (r || '').toUpperCase(); }));
      var rows = await _q('DB.facturas.activasClientes',
        sb.from('facturas')
          .select('cliente_id,receptor_rfc,receptor_nombre')
          .eq('tipo', 'emitida')
          .neq('estatus', 'cancelada')
          .gte('fecha', desde.toISOString().slice(0, 10))
      );
      return rows.filter(function (f) {
        return !empSet.has((f.receptor_rfc || '').toUpperCase());
      });
    },

    /** Top proveedores YTD, excluyendo nómina y empleados. */
    ytdRecibidas: async function (año, empRFCs, empNombres) {
      var y = año || new Date().getFullYear();
      var empRFCSet  = new Set((empRFCs    || []).map(function (r) { return (r || '').toUpperCase(); }));
      var empNomSet  = new Set((empNombres || []).map(function (n) { return (n || '').toLowerCase(); }));
      var rows = await _q('DB.facturas.ytdRecibidas',
        sb.from('facturas')
          .select('emisor_nombre,emisor_rfc,total,efecto_sat')
          .eq('tipo', 'recibida')
          .not('efecto_sat', 'ilike', '%nómin%')
          .eq('year', y)
      );
      return rows.filter(function (f) {
        var rfc = (f.emisor_rfc  || '').toUpperCase();
        var nom = (f.emisor_nombre || '').toLowerCase();
        return !empRFCSet.has(rfc) && !empNomSet.has(nom);
      });
    },

    /** Facturas emitidas YTD — para dashboard y KPIs. */
    ytdEmitidas: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.facturas.ytdEmitidas',
        sb.from('facturas')
          .select('receptor_nombre,receptor_rfc,total,efecto_sat,conciliado,fecha,cliente_id')
          .eq('tipo', 'emitida')
          .neq('estatus', 'cancelada')
          .eq('year', y)
      );
    },

    /** Facturas emitidas pendientes de complemento de pago. */
    pendientesComplemento: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.facturas.pendientesComplemento',
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

    /** Búsqueda de facturas recibidas para conciliación o asignación. */
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
      return _q('DB.facturas.buscarRecibidas', base);
    },

    /** Mayores deudores: facturas emitidas sin conciliar, excluyendo empleados. */
    mayoresDeudores: async function (empRFCs, empNombres) {
      var empRFCSet = new Set((empRFCs    || []).map(function (r) { return (r || '').toUpperCase(); }));
      var empNomSet = new Set((empNombres || []).map(function (n) { return (n || '').toLowerCase(); }));
      var rows = await _q('DB.facturas.mayoresDeudores',
        sb.from('facturas')
          .select('receptor_nombre,receptor_rfc,total,cliente_id')
          .eq('tipo', 'emitida')
          .eq('conciliado', false)
          .neq('estatus', 'cancelada')
      );
      return rows.filter(function (f) {
        var rfc = (f.receptor_rfc   || '').toUpperCase();
        var nom = (f.receptor_nombre || '').toLowerCase();
        return !empRFCSet.has(rfc) && !empNomSet.has(nom);
      });
    },
  };

  // ── movimientos_v2 ───────────────────────────────────────────────────────

  var movimientos = {

    list: async function (año, filtros) {
      var y = año || new Date().getFullYear();
      var q = sb.from('movimientos_v2').select('*').eq('year', y);
      if (filtros && filtros.origenes) q = q.in('origen', filtros.origenes);
      if (filtros && filtros.tipo)     q = q.eq('tipo', filtros.tipo);
      return _q('DB.movimientos.list', q.order('fecha').limit(2000));
    },

    save: async function (data) {
      var op = data.id
        ? sb.from('movimientos_v2').update(data).eq('id', data.id).select().single()
        : sb.from('movimientos_v2').insert([data]).select().single();
      return _q('DB.movimientos.save', op, 'single');
    },

    delete: async function (id) {
      return _q('DB.movimientos.delete',
        sb.from('movimientos_v2').delete().eq('id', id)
      );
    },

    conciliar: async function (id, factId) {
      var upd = { conciliado: true };
      if (factId) upd.factura_id = factId;
      return _q('DB.movimientos.conciliar',
        sb.from('movimientos_v2').update(upd).eq('id', id)
      );
    },

    /** Movimientos bancarios: filtra por origenes sat_emitida / sat_recibida / banco. */
    banco: async function (año) {
      var y = año || new Date().getFullYear();
      return _q('DB.movimientos.banco',
        sb.from('movimientos_v2')
          .select('*')
          .eq('year', y)
          .in('origen', ['sat_emitida', 'sat_recibida', 'banco', 'manual'])
          .order('fecha')
          .order('orden')
      );
    },

    /** Último saldo bancario registrado. */
    ultimoSaldo: async function () {
      var row = await _q('DB.movimientos.ultimoSaldo',
        sb.from('movimientos_v2')
          .select('saldo,fecha')
          .in('origen', ['sat_emitida', 'sat_recibida', 'banco'])
          .order('fecha', { ascending: false })
          .limit(1),
        'maybeSingle'
      );
      return row;
    },

    /** Movimientos de un cliente: busca por contraparte Y rfc, deduplica. */
    porCliente: async function (nombre, rfc, año) {
      var y = año || new Date().getFullYear();
      var cols = 'categoria,tipo,monto,fecha,descripcion,origen,conciliado';
      var [r1, r2] = await Promise.all([
        nombre
          ? _q('DB.movimientos.porCliente:nombre',
              sb.from('movimientos_v2').select(cols)
                .ilike('contraparte', '%' + nombre + '%').eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
        rfc
          ? _q('DB.movimientos.porCliente:rfc',
              sb.from('movimientos_v2').select(cols)
                .ilike('rfc_contraparte', '%' + rfc + '%').eq('year', y).order('fecha', { ascending: false }))
          : Promise.resolve([]),
      ]);
      var seen = new Set();
      return r1.concat(r2).filter(function (m) {
        var k = m.fecha + '_' + m.monto + '_' + m.descripcion;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },

    /** Upsert masivo desde importación SAT banco. */
    upsertBanco: async function (rows) {
      if (!rows || !rows.length) return [];
      return _q('DB.movimientos.upsertBanco',
        sb.from('movimientos_v2').upsert(rows, { onConflict: 'id' }).select()
      );
    },
  };

  // ── proyecto_costos ──────────────────────────────────────────────────────

  var costos = {

    byProyecto: async function (id) {
      return _q('DB.costos.byProyecto',
        sb.from('proyecto_costos')
          .select('*')
          .eq('proyecto_id', id)
          .order('semana')
          .order('created_at')
      );
    },

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _q('DB.costos.byProyectos',
        sb.from('proyecto_costos')
          .select('id,proyecto_id,monto,categoria,subcategoria,semana')
          .in('proyecto_id', ids)
      );
    },

    insert: async function (rows) {
      if (!rows || !rows.length) return [];
      return _q('DB.costos.insert',
        sb.from('proyecto_costos').insert(rows).select()
      );
    },

    delete: async function (id) {
      return _q('DB.costos.delete',
        sb.from('proyecto_costos').delete().eq('id', id)
      );
    },
  };

  // ── factura_asignaciones ─────────────────────────────────────────────────

  var asignaciones = {

    byProyecto: async function (id) {
      return _q('DB.asignaciones.byProyecto',
        sb.from('factura_asignaciones')
          .select('*')
          .eq('proyecto_id', id)
          .order('created_at')
      );
    },

    byProyectos: async function (ids) {
      if (!ids || !ids.length) return [];
      return _q('DB.asignaciones.byProyectos',
        sb.from('factura_asignaciones')
          .select('id,proyecto_id,monto,porcentaje,factura_id,categoria')
          .in('proyecto_id', ids)
      );
    },

    byFactura: async function (factId) {
      return _q('DB.asignaciones.byFactura',
        sb.from('factura_asignaciones')
          .select('id,proyecto_id,porcentaje,monto,notas')
          .eq('factura_id', factId)
          .order('created_at')
      );
    },

    /** % ya asignado a otros proyectos de esta factura (para validar ≤ 100). */
    usadoPorFactura: async function (factId, excludeId) {
      var rows = await _q('DB.asignaciones.usadoPorFactura',
        sb.from('factura_asignaciones')
          .select('id,porcentaje')
          .eq('factura_id', factId)
      );
      return rows
        .filter(function (r) { return r.id !== excludeId; })
        .reduce(function (s, r) { return s + (parseFloat(r.porcentaje) || 0); }, 0);
    },

    insert: async function (data) {
      return _q('DB.asignaciones.insert',
        sb.from('factura_asignaciones').insert([data]).select().single(),
        'single'
      );
    },

    delete: async function (id) {
      return _q('DB.asignaciones.delete',
        sb.from('factura_asignaciones').delete().eq('id', id)
      );
    },
  };

  // ── API pública ──────────────────────────────────────────────────────────

  return {
    // Infraestructura (acceso interno si se necesita)
    _bust: _bust,
    _cache: _cache,

    // Tablas
    empleados:        empleados,
    contactos:        contactos,
    clientes:         clientes,
    proveedores:      proveedores,
    proyectos:        proyectos,
    entregas:         entregas,
    cotizaciones:     cotizaciones,
    cotizacionItems:  cotizacionItems,
    facturas:         facturas,
    movimientos:      movimientos,
    costos:           costos,
    asignaciones:     asignaciones,
  };

})();
