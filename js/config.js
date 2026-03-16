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
