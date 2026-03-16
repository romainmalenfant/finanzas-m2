// ── Theme ─────────────────────────────────────────────────
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('theme-toggle-btn');
  if(btn) btn.textContent = theme==='dark' ? '☀️' : '🌙';
  localStorage.setItem('m2_theme', theme);
}
function toggleTheme(){
  var current = document.documentElement.getAttribute('data-theme');
  applyTheme(current==='dark' ? 'light' : 'dark');
}
// Init theme on load
(function(){
  var saved = localStorage.getItem('m2_theme') || 'light';
  applyTheme(saved);
})();

// ── Helpers ──────────────────────────────────────────────
function fmt(n){var a=Math.abs(Math.round(n));return(n<0?'-':'')+'$'+a.toLocaleString('es-MX');}
function fmtDate(iso){if(!iso)return'—';var d=new Date(iso+'T12:00');var hoy=new Date();var base=d.getDate()+' '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];return d.getFullYear()===hoy.getFullYear()?base:base+' '+d.getFullYear();}
function fmtDateFull(iso){if(!iso)return'—';var d=new Date(iso+'T12:00');return d.getDate()+' '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]+' '+d.getFullYear();}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function getApiKey(){return localStorage.getItem('m2_anthropic_key')||'';}
function saveApiKey(){
  var k=document.getElementById('apikey-input').value.trim();
  if(k){
    localStorage.setItem('m2_anthropic_key',k);
    document.getElementById('apikey-banner').style.display='none';
    showStatus('✓ API key guardada');
  }
}
function initApiKeyBanner(){
  var banner=document.getElementById('apikey-banner');
  if(!banner)return;
  if(getApiKey()){banner.style.display='none';}
}
function getUserName(){
  // Use logged-in user email (before @) as name
  var session=null;
  try{var s=localStorage.getItem('sb-iycqlbvywwogcfftciil-auth-token');if(s){var p=JSON.parse(s);session=p&&p.user&&p.user.email;}}catch(e){}
  return session?session.split('@')[0]:localStorage.getItem('m2_username')||'';
}
function saveName(v){localStorage.setItem('m2_username',v);}
function showToast(msg, type, dur){
  var colors={success:'#34d399',error:'#f87171',warn:'#fbbf24',info:'#60a5fa'};
  var icons={success:'✓',error:'✗',warn:'⚠',info:'i'};
  var t=type||'success'; var ms=dur||3500;
  var color=colors[t]||colors.success;
  var icon=icons[t]||icons.success;
  var id='toast-'+Date.now();
  var el=document.createElement('div');
  el.className='toast'; el.id=id;
  el.innerHTML=
    '<div class="toast-content">'+
      '<div class="toast-icon" style="background:'+color+'22;color:'+color+';">'+icon+'</div>'+
      '<div class="toast-msg">'+msg+'</div>'+
      '<button class="toast-close" onclick="removeToast(\''+id+'\')" >×</button>'+
    '</div>'+
    '<div class="toast-bar" style="background:'+color+';animation:toast-progress '+ms+'ms linear forwards;"></div>';
  var container=document.getElementById('toast-container');
  container.appendChild(el);
  requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add('show');});});
  setTimeout(function(){removeToast(id);},ms);
}
function removeToast(id){
  var el=document.getElementById(id);
  if(!el)return;
  el.classList.remove('show'); el.classList.add('hide');
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},250);
}
function showError(msg){showToast(msg,'error',5000);}
function showStatus(msg,dur){
  if(!msg||msg==='Procesando...')return; // skip processing placeholder
  var type=msg.startsWith('✓')||msg.startsWith('Guardado')||msg.startsWith('guard')?'success':
           msg.startsWith('Error')||msg.startsWith('error')?'error':'info';
  showToast(msg.replace(/^[✓✗] */,''),type,dur||3500);
}
function setSyncState(online){var el=document.getElementById('sync-indicator');el.innerHTML=online?'<span class="dot-live"></span> En línea':'<span class="dot-sync"></span> Sin conexión';}

// ── Supabase SDK ─────────────────────────────────────────
async function loadMovements(){
  try{
    var {data,error}=await sb.from(TABLE).select('*').eq('year',curYear).eq('month',curMonth+1).order('fecha',{ascending:false});
    if(error)throw error;
    movements=data||[];
    setSyncState(true);
    render();
    loadYTD();
  }catch(e){
    setSyncState(false);
    showError('Error al cargar datos: '+e.message);
  }
}

async function loadYTD(){
  try{
    var {data,error}=await sb.from(TABLE).select('categoria,monto').eq('year',curYear);
    if(error)return;
    var ytd=calcMetrics(data||[]);
    document.getElementById('ytd-ventas').textContent=fmt(ytd.ventas);
    document.getElementById('ytd-cobr').textContent=fmt(ytd.cobr);
    document.getElementById('ytd-gasto').textContent=fmt(ytd.gastos);
    document.getElementById('ytd-cxc').textContent=fmt(ytd.cxc);
    document.getElementById('ytd-util').textContent=fmt(ytd.util);
    document.getElementById('ytd-flujo').textContent=fmt(ytd.flujo);
  }catch(e){console.error('YTD error:',e);}
}

async function insertMovement(mv){
  var {error}=await sb.from('movimientos_v2').insert([mv]);
  if(error)throw error;
}


// ── Autocomplete helper ───────────────────────────────────
// Creates a validated autocomplete on an input.
// inputId: text input, hiddenId: hidden id field, dropdownId: dropdown div
// getItems(): returns array of {id, label, sub}
// onSelect(item): callback when item selected
function makeAutocomplete(inputId, hiddenId, dropdownId, getItems, onSelect){
  var inp = document.getElementById(inputId);
  var hid = document.getElementById(hiddenId);
  var dd  = document.getElementById(dropdownId);
  if(!inp||!hid||!dd) return;

  inp.addEventListener('input', function(){
    var q = this.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    hid.value = ''; // clear id when typing
    if(!q.trim()){dd.style.display='none';return;}
    var matches = getItems().filter(function(item){
      return item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q)||
             (item.sub||'').toLowerCase().includes(q);
    }).slice(0,7);
    if(!matches.length){dd.style.display='none';return;}
    dd.style.display='block';
    dd.innerHTML = matches.map(function(item){
      return '<div class="ac-item" onmousedown="event.preventDefault()" onclick="(function(){'+
        'document.getElementById(\''+hiddenId+'\').value=\''+item.id.replace(/'/g,"\\'")+'\''+';'+
        'document.getElementById(\''+inputId+'\').value=\''+item.label.replace(/'/g,"\\'")+'\';'+
        'document.getElementById(\''+dropdownId+'\').style.display=\'none\';'+
        (onSelect?'('+onSelect.toString()+')('+JSON.stringify(item)+');':'')+
      '})()">'+
        '<span class="ac-item-name">'+esc(item.label)+'</span>'+
        (item.sub?'<span class="ac-item-sub">'+esc(item.sub)+'</span>':'')+
      '</div>';
    }).join('');
  });

  inp.addEventListener('blur', function(){
    setTimeout(function(){dd.style.display='none';},200);
    // If no id selected, clear input
    if(!hid.value) inp.value='';
  });

  document.addEventListener('click', function(e){
    if(!dd.contains(e.target)&&e.target!==inp) dd.style.display='none';
  });
}
