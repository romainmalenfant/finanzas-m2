// ── Config ──────────────────────────────────────────────
const SUPABASE_URL = 'https://iycqlbvywwogcfftciil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y3FsYnZ5d3dvZ2NmZnRjaWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MzA2MTUsImV4cCI6MjA4OTAwNjYxNX0.-LTSOW9GJlNl2aJJsSZdhz8cS8c9u-UXM1cxP0Kndos';
const TABLE = 'movimientos_v2';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── M2State — Única fuente de verdad ────────────────────
// T7: Reemplaza todas las variables globales sueltas.
// Acceso: M2State.clientes, M2State.proyectos, etc.
// NUNCA declarar nuevas variables globales de datos — usar M2State.
var M2State = {

  // ── Datos maestros ───────────────────────────────────
  // Fuente: Supabase. Se pueblan en loadClientes(), loadProyectos(), etc.
  clientes:     [],   // ex: clientes, allClientes
  proveedores:  [],   // ex: proveedores, allProveedores
  proyectos:    [],   // ex: proyectos, allProyectos — UNIFICADO
  contactos:    [],   // ex: contactos, allContactos
  empleados:    [],   // ex: empleados, allEmpleados
  cotizaciones: [],   // ex: cotizaciones, allCotizaciones
  movements:    [],   // movimientos del mes visible en Flujo
  ventasMes:    [],   // facturas emitidas del mes visible

  // ── Datos derivados / cache ──────────────────────────
  // Poblados por loadBadgeData() y responderConsulta()
  cxcRows:            null,  // ex: _cxcRows
  cxpRows:            null,  // ex: _cxpRows
  ytdMvmts:           null,  // ex: _ytdMvmts
  entregasByProyecto: {},    // ex: entregasByProyecto (declarado en nav.js Y auth.js)

  // ── Cache layer ──────────────────────────────────────
  // Usado por fetchWithCache() en utils.js
  _cache:    {},
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos

  // ── Estado UI — formularios ──────────────────────────
  etiquetaSeleccionada:    '',    // ex: etiquetaSeleccionada (declarado en config.js Y movimientos.js)
  metodoPagoSeleccionado:  '',    // ex: metodoPagoSeleccionado
  tipoMovActual:           '',    // ex: tipoMovActual (implicit global en movimiento_form.js)
  requiereFactura:         true,  // ex: _requiereFactura

  // ── Estado UI — facturas ─────────────────────────────
  factItems:     [],   // ex: _factItems
  factItemId:    0,    // ex: _factItemId
  factEsSinSat:  false,// ex: _factEsSinSat
  ivaDebounce:   null, // ex: _ivaDebounce
  facturasTipo:  'emitidas',             // ex: facturasTipo
  facturasYearFilter: new Date().getFullYear(), // ex: facturasYearFilter

  // ── Estado UI — cotizaciones ─────────────────────────
  cotView:          'lista',               // ex: cotView
  cotYearFilter:    new Date().getFullYear(), // ex: cotYearFilter
  cotHistorialOpen: false,                 // ex: cotHistorialOpen
  cotItemsTemp:     [],                    // ex: cotItemsTemp
  cotEditId:        null,                  // ex: cotEditId
  dragId:           null,                  // ex: _dragId

  // ── Estado UI — SAT ──────────────────────────────────
  pdfMovimientos:      [],  // ex: pdfMovimientos
  satPendingEmitidas:  [],  // ex: satPendingEmitidas
  satPendingRecibidas: [],  // ex: satPendingRecibidas
  concilMatches:       [],  // ex: concilMatches
  lastEmitidas:        [],  // ex: lastEmitidas
  lastRecibidas:       [],  // ex: lastRecibidas
  lastBanco:           [],  // ex: lastBanco

  // ── Estado UI — misceláneos ──────────────────────────
  fabOpen:             false, // ex: _fabOpen
  facturasPendientesCache: [], // ex: facturasPendientesCache
  clienteModalFromForm: false, // ex: clienteModalFromForm
  repTipo:             'mes', // ex: repTipo

  // ── Charts ───────────────────────────────────────────
  myChart: null,  // gráfica de Flujo
  dbChart: null,  // gráfica de Dashboard

  // ── Tiempo / navegación ──────────────────────────────
  curYear:  new Date().getFullYear(),
  curMonth: new Date().getMonth(),

  // ── Polling ──────────────────────────────────────────
  pollingInterval: null,

  // ── Lifecycle ────────────────────────────────────────
  appInited: false  // ex: window._appInited
};

// ── Alias de compatibilidad ──────────────────────────────
// Permiten que el código existente siga funcionando sin
// modificar cada archivo. Son proxies que apuntan a M2State.
// PLAN DE MIGRACIÓN: Eliminar estos alias gradualmente
// conforme se migra cada módulo a usar M2State directamente.
Object.defineProperties(window, {
  // Datos maestros
  clientes:      { get: function(){ return M2State.clientes; },
                   set: function(v){ M2State.clientes = v; }, configurable: true },
  proveedores:   { get: function(){ return M2State.proveedores; },
                   set: function(v){ M2State.proveedores = v; }, configurable: true },
  proyectos:     { get: function(){ return M2State.proyectos; },
                   set: function(v){ M2State.proyectos = v; }, configurable: true },
  allProyectos:  { get: function(){ return M2State.proyectos; },
                   set: function(v){ M2State.proyectos = v; }, configurable: true },
  contactos:     { get: function(){ return M2State.contactos; },
                   set: function(v){ M2State.contactos = v; }, configurable: true },
  allContactos:  { get: function(){ return M2State.contactos; },
                   set: function(v){ M2State.contactos = v; }, configurable: true },
  empleados:     { get: function(){ return M2State.empleados; },
                   set: function(v){ M2State.empleados = v; }, configurable: true },
  allEmpleados:  { get: function(){ return M2State.empleados; },
                   set: function(v){ M2State.empleados = v; }, configurable: true },
  cotizaciones:  { get: function(){ return M2State.cotizaciones; },
                   set: function(v){ M2State.cotizaciones = v; }, configurable: true },
  allCotizaciones:{ get: function(){ return M2State.cotizaciones; },
                    set: function(v){ M2State.cotizaciones = v; }, configurable: true },
  movements:     { get: function(){ return M2State.movements; },
                   set: function(v){ M2State.movements = v; }, configurable: true },
  ventasMes:     { get: function(){ return M2State.ventasMes; },
                   set: function(v){ M2State.ventasMes = v; }, configurable: true },
  allClientes:   { get: function(){ return M2State.clientes; },
                   set: function(v){ M2State.clientes = v; }, configurable: true },
  allProveedores:{ get: function(){ return M2State.proveedores; },
                   set: function(v){ M2State.proveedores = v; }, configurable: true },

  // Datos derivados
  entregasByProyecto: { get: function(){ return M2State.entregasByProyecto; },
                        set: function(v){ M2State.entregasByProyecto = v; }, configurable: true },
  _cxcRows:      { get: function(){ return M2State.cxcRows; },
                   set: function(v){ M2State.cxcRows = v; }, configurable: true },
  _cxpRows:      { get: function(){ return M2State.cxpRows; },
                   set: function(v){ M2State.cxpRows = v; }, configurable: true },
  _ytdMvmts:     { get: function(){ return M2State.ytdMvmts; },
                   set: function(v){ M2State.ytdMvmts = v; }, configurable: true },

  // UI — formularios
  etiquetaSeleccionada:   { get: function(){ return M2State.etiquetaSeleccionada; },
                            set: function(v){ M2State.etiquetaSeleccionada = v; }, configurable: true },
  metodoPagoSeleccionado: { get: function(){ return M2State.metodoPagoSeleccionado; },
                            set: function(v){ M2State.metodoPagoSeleccionado = v; }, configurable: true },
  tipoMovActual:          { get: function(){ return M2State.tipoMovActual; },
                            set: function(v){ M2State.tipoMovActual = v; }, configurable: true },
  _requiereFactura:       { get: function(){ return M2State.requiereFactura; },
                            set: function(v){ M2State.requiereFactura = v; }, configurable: true },

  // Nota: allFacturas es local a facturas.js — no se mapea aquí
  // para evitar conflicto con cotizaciones. Cada módulo mantiene
  // su propio array local de registros filtrados de la tabla.
  _factItems:     { get: function(){ return M2State.factItems; },
                    set: function(v){ M2State.factItems = v; }, configurable: true },
  _factItemId:    { get: function(){ return M2State.factItemId; },
                    set: function(v){ M2State.factItemId = v; }, configurable: true },
  _factEsSinSat:  { get: function(){ return M2State.factEsSinSat; },
                    set: function(v){ M2State.factEsSinSat = v; }, configurable: true },
  _ivaDebounce:   { get: function(){ return M2State.ivaDebounce; },
                    set: function(v){ M2State.ivaDebounce = v; }, configurable: true },

  // UI — cotizaciones
  cotView:          { get: function(){ return M2State.cotView; },
                      set: function(v){ M2State.cotView = v; }, configurable: true },
  cotYearFilter:    { get: function(){ return M2State.cotYearFilter; },
                      set: function(v){ M2State.cotYearFilter = v; }, configurable: true },
  cotHistorialOpen: { get: function(){ return M2State.cotHistorialOpen; },
                      set: function(v){ M2State.cotHistorialOpen = v; }, configurable: true },
  cotItemsTemp:     { get: function(){ return M2State.cotItemsTemp; },
                      set: function(v){ M2State.cotItemsTemp = v; }, configurable: true },
  cotEditId:        { get: function(){ return M2State.cotEditId; },
                      set: function(v){ M2State.cotEditId = v; }, configurable: true },
  _dragId:          { get: function(){ return M2State.dragId; },
                      set: function(v){ M2State.dragId = v; }, configurable: true },

  // UI — SAT
  pdfMovimientos:      { get: function(){ return M2State.pdfMovimientos; },
                         set: function(v){ M2State.pdfMovimientos = v; }, configurable: true },
  satPendingEmitidas:  { get: function(){ return M2State.satPendingEmitidas; },
                         set: function(v){ M2State.satPendingEmitidas = v; }, configurable: true },
  satPendingRecibidas: { get: function(){ return M2State.satPendingRecibidas; },
                         set: function(v){ M2State.satPendingRecibidas = v; }, configurable: true },
  concilMatches:       { get: function(){ return M2State.concilMatches; },
                         set: function(v){ M2State.concilMatches = v; }, configurable: true },
  lastEmitidas:        { get: function(){ return M2State.lastEmitidas; },
                         set: function(v){ M2State.lastEmitidas = v; }, configurable: true },
  lastRecibidas:       { get: function(){ return M2State.lastRecibidas; },
                         set: function(v){ M2State.lastRecibidas = v; }, configurable: true },
  lastBanco:           { get: function(){ return M2State.lastBanco; },
                         set: function(v){ M2State.lastBanco = v; }, configurable: true },

  // UI — misceláneos
  _fabOpen:            { get: function(){ return M2State.fabOpen; },
                         set: function(v){ M2State.fabOpen = v; }, configurable: true },
  facturasPendientesCache: { get: function(){ return M2State.facturasPendientesCache; },
                             set: function(v){ M2State.facturasPendientesCache = v; }, configurable: true },
  clienteModalFromForm:    { get: function(){ return M2State.clienteModalFromForm; },
                             set: function(v){ M2State.clienteModalFromForm = v; }, configurable: true },
  repTipo:             { get: function(){ return M2State.repTipo; },
                         set: function(v){ M2State.repTipo = v; }, configurable: true },

  // Charts
  myChart: { get: function(){ return M2State.myChart; },
              set: function(v){ M2State.myChart = v; }, configurable: true },
  dbChart: { get: function(){ return M2State.dbChart; },
              set: function(v){ M2State.dbChart = v; }, configurable: true },

  // Tiempo
  curYear:  { get: function(){ return M2State.curYear; },
               set: function(v){ M2State.curYear = v; }, configurable: true },
  curMonth: { get: function(){ return M2State.curMonth; },
               set: function(v){ M2State.curMonth = v; }, configurable: true },

  // Polling
  pollingInterval: { get: function(){ return M2State.pollingInterval; },
                     set: function(v){ M2State.pollingInterval = v; }, configurable: true },

  // Lifecycle
  _appInited: { get: function(){ return M2State.appInited; },
                set: function(v){ M2State.appInited = v; }, configurable: true }
});

// ── Constantes globales (inmutables, no son estado) ──────
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CAT_COLORS = {
  venta:'#34d399', cobranza:'#60a5fa', gasto:'#f87171',
  compra:'#f87171', cobranza_sat:'#60a5fa', cuenta_por_cobrar:'#fbbf24'
};
const CAT_LABELS = {
  venta:'Venta', cobranza:'Cobranza', gasto:'Gasto',
  compra:'Compra', cuenta_por_cobrar:'Cuenta por cobrar', manual:'Manual'
};
const CAT_BADGE = {
  venta:'bv', cobranza:'bc', gasto:'bg', compra:'bg', cuenta_por_cobrar:'bx'
};

// ── APP_MODULES — registro central de módulos ────────────
var APP_MODULES = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '📊', color: '#E8192C', showPeriod: false },
  { id: 'finanzas',     label: 'Flujo',        icon: '🏦', color: '#6B6B6B', showPeriod: true  },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: '📄', color: '#E8192C', showPeriod: false },
  { id: 'proyectos',    label: 'Proyectos',    icon: '📋', color: '#B0B0B0', showPeriod: false },
  { id: 'clientes',     label: 'Empresas',     icon: '🏢', color: '#E8192C', showPeriod: false },
  { id: 'proveedores',  label: 'Proveedores',  icon: '🛒', color: '#6B6B6B', showPeriod: false },
  { id: 'contactos',    label: 'Contactos',    icon: '👤', color: '#8B0000', showPeriod: false },
  { id: 'empleados',    label: 'Empleados',    icon: '👥', color: '#6B6B6B', showPeriod: false },
  { id: 'sat',          label: 'SAT & Banco',  icon: '🏦', color: '#B0B0B0', showPeriod: true  },
  { id: 'facturas',     label: 'Facturas',     icon: '🧾', color: '#E8192C', showPeriod: false }
];

// Índice por id para lookups O(1)
var APP_MODULES_MAP = Object.fromEntries(
  APP_MODULES.map(function(m){ return [m.id, m]; })
);
