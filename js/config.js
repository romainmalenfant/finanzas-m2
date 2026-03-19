// ── Config ──────────────────────────────────────────────
const SUPABASE_URL = 'https://iycqlbvywwogcfftciil.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y3FsYnZ5d3dvZ2NmZnRjaWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MzA2MTUsImV4cCI6MjA4OTAwNjYxNX0.-LTSOW9GJlNl2aJJsSZdhz8cS8c9u-UXM1cxP0Kndos';
const TABLE = 'movimientos_v2';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ────────────────────────────────────────────────
let movements = [];
let proyectos = []; var allProyectos = [];
let clientes = [];
let proveedores = [];var etiquetaSeleccionada='';
var metodoPagoSeleccionado='';
let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth();
let myChart = null;
let pollingInterval = null;

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CAT_COLORS = {venta:'#34d399',cobranza:'#60a5fa',gasto:'#f87171',compra:'#f87171',cobranza_sat:'#60a5fa',cuenta_por_cobrar:'#fbbf24'};
const CAT_LABELS = {venta:'Venta',cobranza:'Cobranza',gasto:'Gasto',compra:'Compra',cuenta_por_cobrar:'Cuenta por cobrar',manual:'Manual'};
const CAT_BADGE  = {venta:'bv',cobranza:'bc',gasto:'bg',compra:'bg',cuenta_por_cobrar:'bx'};
// ── APP_MODULES — registro central de módulos ─────────────
// Fuente de verdad para tabs.js y search.js
// Para agregar un módulo: solo añadir aquí
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

// Índice por id para lookups O(1) — evita .find() en cada render
var APP_MODULES_MAP = Object.fromEntries(APP_MODULES.map(function(m){ return [m.id, m]; }));
