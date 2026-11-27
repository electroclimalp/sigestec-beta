import { get, put, all, normalizeStoredValue } from './db.js';
import { renderClients } from './clients.js';
import { renderProperties } from './properties.js';
import { renderJobs, renderMeasurementsHub, renderDocumentsHub } from './jobs.js';
import { renderInstruments } from './instruments.js';
import { renderLabor } from './labor.js';

const root = document.querySelector('#app');
const modules = [
  {id:'clients', title:'Clientes', desc:'Personas y organizaciones', icon:'♙'},
  {id:'properties', title:'Inmuebles', desc:'Domicilios y propiedades', icon:'⌂'},
  {id:'papers', title:'Gestión documental', desc:'Expedientes, documentación técnica y presupuestos', icon:'▤'},
  {id:'field', title:'Operaciones técnicas', desc:'Herramientas, cálculos, mediciones y ensayos por especialidad', icon:'⌁'},
  {id:'instruments', title:'Instrumentos de medición', desc:'Biblioteca personal de equipos', icon:'⌁'},
  {id:'settings', title:'Configuración', desc:'Identidad, oficios activos y preferencias', icon:'⚙'}
];

async function init() {
  installSectionNavigation();
  document.querySelector('#settings-shortcut').onclick = () => navigate('settings');
  document.querySelector('#home-shortcut').onclick = () => renderHome();
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); updateConnection();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  const identity = await get('settings', 'identity');
  const appearance = await get('settings', 'appearance');
  applyAppearance(appearance?.value || {});
  if (!identity?.value?.completed) await renderSetup(); else { updateBrand(identity.value); await renderHome(); }
  await runScheduledBackup();
}
function updateConnection() { document.querySelector('#connection-state').textContent = navigator.onLine ? '● Local · Con conexión' : '● Sin conexión'; }
function updateBrand(identity) { document.querySelector('#business-name').textContent = identity.tradeName || identity.name || 'Espacio de trabajo local'; }
async function navigate(id) {
  if (id === 'home') return renderHome();
  if (id === 'electricity') return renderElectricityRoot();
  if (id === 'clients') return renderClients(root, renderHome);
  if (id === 'properties') return renderProperties(root, renderHome);
  if (id === 'jobs') return renderJobs(root, renderHome);
  if (id === 'papers') { root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTIÓN DOCUMENTAL Y COMERCIAL</p><h1>Gestión documental</h1><p class="muted">Expedientes, documentación técnica y presupuestos de cada trabajo.</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="module-grid"><button class="module-card" id="open-jobs"><span class="module-icon">▤</span><strong>Expedientes de trabajo</strong><small>Legajo de cada intervención, vinculado al cliente y al inmueble.</small></button><button class="module-card" id="open-documents"><span class="module-icon">▧</span><strong>Documentación técnica</strong><small>Informes, protocolos, registros y documentos de los trabajos.</small></button><button class="module-card" id="open-budgets"><span class="module-icon">$</span><strong>Presupuestos</strong><small>Mano de obra, materiales y servicios.</small></button></section>`; root.querySelector('#back-home').onclick=renderHome; root.querySelector('#open-jobs').onclick=()=>renderJobs(root,renderHome); root.querySelector('#open-documents').onclick=()=>renderDocumentsHub(root,renderHome,(jobId)=>{const jobsReturn=()=>renderDocumentsHub(root,renderHome,()=>{});import('./jobs.js').then(m=>m.openJob(root,jobId,jobsReturn,renderHome));}); root.querySelector('#open-budgets').onclick=()=>renderLabor(root,renderHome); return; }
  if (id === 'field') { root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">HERRAMIENTAS PROFESIONALES</p><h1>Operaciones técnicas</h1><p class="muted">Herramientas profesionales organizadas por especialidad.</p></div></div><section class="panel trade-context"><strong>Oficio activo: Electricidad</strong><p class="muted">Las herramientas de cada especialidad se mantienen separadas, mientras clientes e inmuebles son compartidos.</p></section><section class="module-grid"><button class="module-card" id="open-electricity"><span class="module-icon">∑</span><strong>Electricidad</strong><small>Cálculos eléctricos, mediciones, ensayos e inspecciones.</small></button></section>`; root.querySelector('#open-electricity').onclick=renderElectricityRoot; return; }
  if (id === 'settings') return renderSettings();
  if (id === 'instruments') return renderInstruments(root, renderHome);
  if (id === 'labor') return renderLabor(root, renderHome);
  if (id === 'finance' || id === 'labor') return renderLabor(root,renderHome);
  const item = modules.find(m => m.id === id);
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MÓDULO</p><h1>${item.title}</h1><p class="muted">${item.desc}</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="panel coming"><div class="empty-icon">${item.icon}</div><h2>Módulo previsto para una próxima etapa</h2><p>La arquitectura ya reserva este espacio. Lo incorporaremos sin rehacer el núcleo de la aplicación.</p></section>`;
  root.querySelector('#back-home').onclick = renderHome;
}
function renderElectricityRoot() {
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">OPERACIONES TÉCNICAS</p><h1>Electricidad</h1><p class="muted">Herramientas para el análisis y la verificación de instalaciones.</p></div></div><section class="module-grid"><button class="module-card" id="open-dpms"><span class="module-icon">∑</span><strong>Cálculos eléctricos</strong><small>DPMS y dimensionamiento.</small></button><button class="module-card" id="open-measurements"><span class="module-icon">▧</span><strong>Mediciones e inspecciones</strong><small>PAT, diferenciales, aislación, continuidad, tensión y verificaciones.</small></button></section>`;
  root.querySelector('#open-dpms').onclick=()=>renderJobs(root,()=>navigate('electricity'));
  root.querySelector('#open-measurements').onclick=()=>renderMeasurementsHub(root,()=>navigate('electricity'),()=>navigate('electricity'));
}

function currentArea() {
  const h = root.querySelector('h1')?.textContent?.trim().toLocaleLowerCase('es') || '';
  const eyebrow = root.querySelector('.eyebrow')?.textContent?.toLocaleLowerCase('es') || '';
  const allText = `${h} ${eyebrow}`;
  if (/medicion|inspeccion|ensayo|protocolo|dpms|cálculo|calculo|electricidad|trabajo ·/.test(allText)) return 'electricity';
  if (/presupuesto|document|expediente|trabajos|carpeta de trabajo/.test(allText)) return 'papers';
  if (/cliente/.test(allText)) return 'clients';
  if (/inmueble|propiedad/.test(allText)) return 'properties';
  if (/instrument/.test(allText)) return 'instruments';
  if (/configuración|preferencias/.test(allText)) return 'settings';
  return 'home';
}
function areaRoot(area) {
  if (area === 'electricity') return renderElectricityRoot();
  if (area === 'papers') return navigate('papers');
  if (area === 'clients') return renderClients(root, renderHome);
  if (area === 'properties') return renderProperties(root, renderHome);
  if (area === 'instruments') return renderInstruments(root, renderHome);
  if (area === 'settings') return renderSettings();
  return renderHome();
}
function installSectionNavigation() {
  const observer = new MutationObserver(() => {
    if (!root.firstElementChild || root.querySelector('.sigestec-section-nav')) return;
    const area = currentArea();
    const nav = document.createElement('nav'); nav.className='sigestec-section-nav'; nav.setAttribute('aria-label','Navegación de sección');
    nav.innerHTML = `<button type="button" class="secondary" data-nav-back>← Atrás</button><button type="button" class="secondary" data-nav-root>⌂ ${area==='electricity'?'Electricidad':area==='papers'?'Gestión documental':area==='clients'?'Clientes':area==='properties'?'Inmuebles':area==='instruments'?'Instrumentos':area==='settings'?'Configuración':'Inicio'}</button>`;
    nav.querySelector('[data-nav-back]').onclick = () => {
      const legacy = [...root.querySelectorAll('button')].find(b => b !== nav.querySelector('[data-nav-back]') && b !== nav.querySelector('[data-nav-root]') && (b.id === 'back-home' || b.id?.startsWith('back-') || b.id?.endsWith('-back') || b.id === 'srt-back' || b.id === 'dpms-back') );
      if (legacy) legacy.click(); else renderHome();
    };
    nav.querySelector('[data-nav-root]').onclick=()=>areaRoot(area);
    root.insertBefore(nav,root.firstElementChild);
    root.querySelectorAll('.page-heading button[id^="back-"], .page-heading button[id$="-back"], .page-heading #srt-back, .page-heading #dpms-back').forEach(b=>b.classList.add('legacy-navigation-control'));
  });
  observer.observe(root,{childList:true});
}

async function renderHome() {
  root.innerHTML = `<section class="welcome"><div><p class="eyebrow">PANEL PRINCIPAL</p><h1>Tu trabajo, organizado.</h1><p>Un espacio para gestionar clientes, inmuebles, documentación y trabajo técnico desde un mismo lugar.</p></div><div class="welcome-symbol" aria-hidden="true">SG</div></section>
    <div class="section-title home-section-title"><div><h2>Áreas de trabajo</h2><p class="muted">Elegí dónde querés trabajar.</p></div></div>
    <section class="module-grid">${modules.map(m => `<button class="module-card" data-module="${m.id}"><span class="module-icon">${m.icon}</span><strong>${m.title}</strong><small>${m.desc}</small><span class="card-arrow">→</span></button>`).join('')}</section>
    <p class="local-note">Oficio habilitado en esta etapa: Electricidad. Clientes e inmuebles son compartidos entre oficios. Tus datos se guardan en este dispositivo.</p>`;
  root.querySelectorAll('[data-module]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.module)));
}

async function renderSetup() {
  root.innerHTML = `<section class="setup-wrap"><div class="setup-card"><p class="eyebrow">PRIMER INICIO</p><h1>Configuremos tu espacio de trabajo</h1><p class="muted">Estos datos identifican al profesional o empresa y podrán aparecer en los documentos que generes. Podés modificarlos más adelante.</p>
  <form id="setup-form"><label>Nombre / razón social<input name="name" required maxlength="120" placeholder="Tu nombre o empresa"></label><label>Nombre comercial <span class="optional">(opcional)</span><input name="tradeName" maxlength="120"></label><div class="form-grid"><label>CUIT / DNI <span class="optional">(opcional)</span><input name="taxId" maxlength="30"></label><label>Teléfono<input name="phone" maxlength="40"></label></div><label>Email<input name="email" type="email" maxlength="120"></label><label>Domicilio <span class="optional">(opcional)</span><input name="address" maxlength="180"></label><div class="modal-actions"><button class="primary" type="submit">Guardar y comenzar →</button></div></form></div></section>`;
  root.querySelector('#setup-form').addEventListener('submit', async e => { e.preventDefault(); const value = Object.fromEntries(new FormData(e.currentTarget)); value.completed = true; await put('settings', {key:'identity', value}); updateBrand(value); renderHome(); });
}
async function renderSettings() {
  const record = await get('settings', 'identity'); const v = record?.value || {};
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">PREFERENCIAS</p><h1>Configuración</h1><p class="muted">Identidad del profesional o empresa.</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="panel settings-panel"><form id="settings-form"><label>Nombre / razón social<input name="name" required value="${safe(v.name)}"></label><label>Nombre comercial<input name="tradeName" value="${safe(v.tradeName)}"></label><div class="form-grid"><label>CUIT / DNI<input name="taxId" value="${safe(v.taxId)}"></label><label>Teléfono<input name="phone" value="${safe(v.phone)}"></label></div><label>Email<input name="email" type="email" value="${safe(v.email)}"></label><label>Domicilio<input name="address" value="${safe(v.address)}"></label><div class="modal-actions"><button class="primary">Guardar cambios</button></div></form></section><p class="local-note">Los datos se almacenan localmente en este navegador.</p>`;
  const appearanceRecord = await get('settings', 'appearance');
  const appearance = normalizeAppearance(appearanceRecord?.value || {});
  const appearancePanel = document.createElement('section');
  appearancePanel.className = 'panel settings-panel appearance-panel';
  appearancePanel.innerHTML = `<div class="appearance-heading"><div><p class="eyebrow">PERSONALIZACIÓN</p><h2>Apariencia</h2><p class="muted">Elegí un estilo equilibrado y ajustá los colores y la comodidad de lectura.</p></div><span class="appearance-preview-mark" aria-hidden="true">Aa</span></div><form id="appearance-form"><fieldset class="appearance-fieldset"><legend>Estilo visual</legend><div class="theme-options">
      <label class="theme-choice"><input type="radio" name="theme" value="corporate" ${appearance.theme==='corporate'?'checked':''}><span class="theme-swatch theme-corporate"><i></i><i></i><i></i></span><strong>Corporativo</strong><small>Identidad original SIGESTEC</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="light" ${appearance.theme==='light'?'checked':''}><span class="theme-swatch theme-light"><i></i><i></i><i></i></span><strong>Claro</strong><small>Azul pizarra y coral</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="dark" ${appearance.theme==='dark'?'checked':''}><span class="theme-swatch theme-dark"><i></i><i></i><i></i></span><strong>Oscuro</strong><small>Grafito y turquesa</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="tech" ${appearance.theme==='tech'?'checked':''}><span class="theme-swatch theme-tech"><i></i><i></i><i></i></span><strong>Tecnológico</strong><small>Grafito y ámbar</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="ocean" ${appearance.theme==='ocean'?'checked':''}><span class="theme-swatch theme-ocean"><i></i><i></i><i></i></span><strong>Océano</strong><small>Azul y coral</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="natural" ${appearance.theme==='natural'?'checked':''}><span class="theme-swatch theme-natural"><i></i><i></i><i></i></span><strong>Natural</strong><small>Verde salvia y piedra</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="violet" ${appearance.theme==='violet'?'checked':''}><span class="theme-swatch theme-violet"><i></i><i></i><i></i></span><strong>Violeta</strong><small>Violeta y turquesa</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="rose" ${appearance.theme==='rose'?'checked':''}><span class="theme-swatch theme-rose"><i></i><i></i><i></i></span><strong>Rosa</strong><small>Fucsia y granate</small></label>
      <label class="theme-choice"><input type="radio" name="theme" value="warm" ${appearance.theme==='warm'?'checked':''}><span class="theme-swatch theme-warm"><i></i><i></i><i></i></span><strong>Cálido</strong><small>Camel, arena y azul pizarra</small></label>
    <label class="theme-choice custom-theme-choice" id="custom-theme-choice" hidden><input type="radio" name="theme" value="custom"><span class="theme-swatch theme-custom"><i></i><i></i><i></i></span><strong>Mi marca</strong><small>Paleta creada desde tu logotipo</small></label></div></fieldset><div class="form-grid appearance-controls"><label>Estilo de botones<select name="buttonStyle"><option value="filled" ${appearance.buttonStyle==='filled'?'selected':''}>Relleno · color pleno</option><option value="soft" ${appearance.buttonStyle==='soft'?'selected':''}>Suave · tonos equilibrados</option><option value="outline" ${appearance.buttonStyle==='outline'?'selected':''}>Contorno · discreto</option></select></label><label>Tamaño de texto<select name="textSize"><option value="normal" ${appearance.textSize==='normal'?'selected':''}>Normal</option><option value="large" ${appearance.textSize==='large'?'selected':''}>Grande · lectura cómoda</option></select></label><label>Espaciado<select name="density"><option value="comfortable" ${appearance.density==='comfortable'?'selected':''}>Cómodo</option><option value="normal" ${appearance.density==='normal'?'selected':''}>Normal</option><option value="compact" ${appearance.density==='compact'?'selected':''}>Compacto</option></select></label></div><section class="logo-theme-builder" aria-labelledby="logo-theme-title"><h3 id="logo-theme-title">Crear tema desde un logotipo</h3><p class="muted">La imagen se procesa localmente en este navegador. No se envía a ningún servidor.</p><label>Logotipo de tu empresa<input type="file" id="brand-logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><div class="logo-theme-preview" id="brand-logo-preview" hidden><img id="brand-logo-image" alt="Vista previa del logotipo"><div><strong id="brand-palette-name">Paleta detectada</strong><div class="brand-palette-swatches" id="brand-palette-swatches"></div></div></div><div class="appearance-actions"><button type="button" class="secondary" id="generate-brand-theme" disabled>Generar paleta</button><button type="button" class="secondary" id="use-brand-theme" disabled>Usar tema de marca</button></div><p class="local-note" id="brand-theme-status" role="status" aria-live="polite">Elegí un logo para analizar sus colores.</p></section><div class="appearance-footer"><p class="local-note">Podés probar los cambios antes de aplicarlos. La apariencia guardada no cambia hasta que confirmes.</p><div class="appearance-actions"><div class="appearance-actions-left"><button type="button" class="secondary" id="reset-appearance">Restablecer</button><button type="button" class="secondary" id="cancel-appearance">Cancelar</button></div><div class="appearance-actions-right"><span id="appearance-status" class="success" role="status" aria-live="polite"></span><button type="button" class="primary" id="apply-appearance">Aplicar tema</button></div></div></div></form>`;
  const appearanceForm = appearancePanel.querySelector('#appearance-form');
  const savedAppearance = normalizeAppearance(appearanceRecord?.value || {});
  const readAppearance = () => {const value=Object.fromEntries(new FormData(appearanceForm));if(value.theme==='custom'&&generatedBrandPalette)value.customPalette=generatedBrandPalette;return normalizeAppearance(value);};
  const setAppearanceForm = value => { for (const [key,val] of Object.entries(value)) { const control=appearanceForm.elements[key]; if (!control) continue; if (control instanceof RadioNodeList) [...control].forEach(item => item.checked=item.value===val); else control.value=val; } };
  const previewAppearance = () => { applyAppearance(readAppearance()); appearancePanel.querySelector('#appearance-status').textContent='Vista previa: todavía no se guardaron los cambios.'; };
  appearanceForm.addEventListener('change', previewAppearance);
  let generatedBrandPalette = appearance.customPalette || null; if(appearance.theme==='custom'&&generatedBrandPalette){appearancePanel.querySelector('#custom-theme-choice').hidden=false;const sw=appearancePanel.querySelector('.theme-custom');sw.style.background=`linear-gradient(135deg,${generatedBrandPalette.main} 0 50%,${generatedBrandPalette.contrast} 50%)`;}
  const logoInput=appearancePanel.querySelector('#brand-logo-file');
  const generateBrand=appearancePanel.querySelector('#generate-brand-theme');
  const useBrand=appearancePanel.querySelector('#use-brand-theme');
  const brandStatus=appearancePanel.querySelector('#brand-theme-status');
  let logoDataUrl='';
  logoInput.addEventListener('change', async ()=>{
    const file=logoInput.files?.[0]; if(!file)return;
    if(!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)){brandStatus.textContent='Formato no compatible. Usá PNG, JPG, WEBP o SVG.';return;}
    if(file.size>8*1024*1024){brandStatus.textContent='El logo supera 8 MB. Elegí una imagen más liviana.';return;}
    try{
      const raw=await fileToDataURL(file); const img=await loadImage(raw);
      const canvas=document.createElement('canvas'); const scale=Math.min(1,512/Math.max(img.width,img.height)); canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
      logoDataUrl=canvas.toDataURL('image/png');
      const preview=appearancePanel.querySelector('#brand-logo-preview');preview.hidden=false;appearancePanel.querySelector('#brand-logo-image').src=logoDataUrl;
      generateBrand.disabled=false;brandStatus.textContent='Logotipo cargado. Generá la paleta para analizar sus colores.';
    }catch(e){brandStatus.textContent='No se pudo leer la imagen. Probá con PNG o JPG.';}
  });
  generateBrand.onclick=()=>{
    const img=appearancePanel.querySelector('#brand-logo-image');
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,64,64);
    const data=ctx.getImageData(0,0,64,64).data;const bins=new Map();
    for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;if(a<.55)continue;const r=data[i],g=data[i+1],b=data[i+2];const max=Math.max(r,g,b),min=Math.min(r,g,b);if(max<35||max-min<18)continue;const key=[Math.round(r/24)*24,Math.round(g/24)*24,Math.round(b/24)*24].map(v=>Math.max(0,Math.min(255,v))).join(',');bins.set(key,(bins.get(key)||0)+1);}
    const ranked=[...bins.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>`#${k.split(',').map(v=>Number(v).toString(16).padStart(2,'0')).join('')}`);
    if(!ranked.length){brandStatus.textContent='No se detectaron colores suficientes. Probá con un logo más colorido.';return;}
    const main=ranked.find(c=>colorSaturation(c)>.22)||ranked[0];const contrast=ranked.find(c=>c!==main&&colorDistance(c,main)>95)||complementaryColor(main);
    generatedBrandPalette={main,contrast,soft:mixColor(main,'#ffffff',.86),deep:mixColor(main,'#172536',.48),logo:logoDataUrl};
    const swatches=appearancePanel.querySelector('#brand-palette-swatches');swatches.innerHTML=[main,contrast,generatedBrandPalette.soft,generatedBrandPalette.deep].map(c=>`<i style="background:${c}"></i>`).join('');
    appearancePanel.querySelector('#brand-palette-name').textContent='Paleta generada · '+main.toUpperCase()+' / '+contrast.toUpperCase();
    const customSwatch=appearancePanel.querySelector('.theme-custom');customSwatch.style.background=`linear-gradient(135deg,${generatedBrandPalette.main} 0 50%,${generatedBrandPalette.contrast} 50%)`;useBrand.disabled=false;brandStatus.textContent='Paleta lista. Revisá la vista previa y elegí “Usar tema de marca”.';
  };
  useBrand.onclick=()=>{if(!generatedBrandPalette)return;appearanceForm.elements.theme.value='custom';const val=readAppearance();val.theme='custom';val.customPalette=generatedBrandPalette;setAppearanceForm(val);previewAppearance();appearancePanel.querySelector('#custom-theme-choice').hidden=false;brandStatus.textContent='Tema de marca en vista previa. Aplicalo para guardarlo.';};

  appearancePanel.querySelector('#apply-appearance').onclick = async () => { const value=readAppearance(); applyAppearance(value); await put('settings',{key:'appearance',value}); appearancePanel.querySelector('#appearance-status').textContent='Tema aplicado y guardado en este navegador.'; };
  appearancePanel.querySelector('#cancel-appearance').onclick = () => { setAppearanceForm(savedAppearance); applyAppearance(savedAppearance); appearancePanel.querySelector('#appearance-status').textContent='Se descartó la vista previa.'; };
  appearancePanel.querySelector('#reset-appearance').onclick = () => { const value=normalizeAppearance({}); setAppearanceForm(value); previewAppearance(); };
  root.querySelector('#back-home').onclick = renderHome;
  root.querySelector('#settings-form').addEventListener('submit', async e => { e.preventDefault(); const value = Object.fromEntries(new FormData(e.currentTarget)); value.completed = true; await put('settings', {key:'identity', value}); updateBrand(value); const msg = document.createElement('p'); msg.className='success'; msg.textContent='Cambios guardados.'; e.currentTarget.append(msg); });
  const backupPanel = document.createElement('section');
  backupPanel.className = 'panel settings-panel backup-panel';
  backupPanel.innerHTML = `<h2>Respaldo de datos</h2><p class="muted">Exportá una copia de tus clientes, inmuebles, trabajos, cálculos, mediciones, protocolos, instrumentos, regiones tarifarias, ítems personalizados, materiales, listados de materiales y presupuestos. El archivo queda en tu dispositivo; SIGESTEC no lo envía a ningún servidor.</p><div class="backup-actions"><button type="button" class="primary" id="export-backup">Descargar copia de seguridad</button><button type="button" class="secondary" id="import-backup">Restaurar desde archivo</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><p class="local-note">La restauración incorpora los registros del respaldo. Si encuentra registros con el mismo identificador, reemplaza esos registros. No borra los demás datos.</p><div class="backup-automation"><h3>Respaldo automático</h3><p class="muted">SIGESTEC puede generar y descargar una copia cuando abras la aplicación y se cumpla el intervalo elegido.</p><label class="backup-toggle"><input type="checkbox" id="auto-backup-enabled"> Activar respaldo automático</label><label>Frecuencia<select id="auto-backup-frequency"><option value="1">Todos los días</option><option value="7">Cada 7 días</option><option value="15">Cada 15 días</option><option value="30">Cada 30 días</option></select></label><p id="auto-backup-info" class="local-note" aria-live="polite"></p><button type="button" class="secondary" id="save-auto-backup">Guardar configuración automática</button><p class="muted backup-caveat">Importante: el navegador debe permitir las descargas automáticas. La copia se guarda en la carpeta de descargas del dispositivo; no protege frente a la pérdida del dispositivo ni sustituye guardar otra copia en un lugar externo.</p></div><p id="backup-status" class="success" role="status" aria-live="polite"></p>`;
  const tradesPanel = document.createElement('section');
  tradesPanel.className = 'panel settings-panel trade-settings';
  const activeTrades = v.activeTrades || ['electricity'];
  tradesPanel.innerHTML = `<h2>Oficios y espacios de trabajo</h2><p class="muted">Cada oficio tendrá sus propias herramientas, cálculos, mediciones y expedientes. Los clientes e inmuebles serán compartidos, para que un mismo cliente pueda tener trabajos de distintas especialidades sin mezclar sus registros.</p><label class="backup-toggle"><input type="checkbox" checked disabled> Electricidad <span class="optional">Activo en esta etapa</span></label><label class="backup-toggle"><input type="checkbox" disabled> Aire acondicionado <span class="optional">Etapa futura</span></label><label class="backup-toggle"><input type="checkbox" disabled> Electrónica <span class="optional">Etapa futura</span></label><p class="local-note">La selección de oficios no modifica ni duplica clientes o inmuebles. Cada trabajo pertenece a un solo oficio; un cliente puede tener tantos trabajos como necesite.</p>`;
  root.querySelector('.settings-panel').after(tradesPanel);
  root.querySelector('.settings-panel').after(backupPanel);
  root.querySelector('.settings-panel').after(appearancePanel);
  root.querySelector('#export-backup').onclick = exportBackup;
  root.querySelector('#import-backup').onclick = () => root.querySelector('#backup-file').click();
  root.querySelector('#backup-file').onchange = importBackup;
  const autoConfig = readAutoBackupConfig();
  root.querySelector('#auto-backup-enabled').checked = autoConfig.enabled;
  root.querySelector('#auto-backup-frequency').value = String(autoConfig.intervalDays);
  updateAutoBackupInfo();
  root.querySelector('#save-auto-backup').onclick = saveAutoBackupConfig;
}

const BACKUP_STORES = ['clients','properties','jobs','settings','dpms_calculations','measurements','srt_protocols','instruments','labor_regions','labor_quotes','labor_custom_items','materials','material_lists'];
const AUTO_BACKUP_KEY = 'sigestec-auto-backup-config';
const AUTO_BACKUP_LAST_KEY = 'sigestec-auto-backup-last';

function readAutoBackupConfig() {
  try {
    const value = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || '{}');
    return { enabled:value.enabled === true, intervalDays:[1,7,15,30].includes(Number(value.intervalDays)) ? Number(value.intervalDays) : 7 };
  } catch { return { enabled:false, intervalDays:7 }; }
}
function updateAutoBackupInfo(message = '') {
  const info = document.querySelector('#auto-backup-info');
  if (!info) return;
  const config = readAutoBackupConfig();
  const last = Number(localStorage.getItem(AUTO_BACKUP_LAST_KEY) || 0);
  const lastText = last ? new Date(last).toLocaleString('es-AR') : 'Todavía no se generó una copia automática.';
  const nextText = last ? new Date(last + config.intervalDays * 86400000).toLocaleString('es-AR') : 'Se generará al activar la función.';
  info.textContent = `${message ? message + ' ' : ''}Último respaldo automático: ${lastText} Próximo respaldo estimado: ${config.enabled ? nextText : 'Automatización desactivada.'}`;
}
async function saveAutoBackupConfig() {
  const enabled = document.querySelector('#auto-backup-enabled').checked;
  const intervalDays = Number(document.querySelector('#auto-backup-frequency').value);
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify({enabled, intervalDays, updatedAt:new Date().toISOString()}));
  if (enabled && !localStorage.getItem(AUTO_BACKUP_LAST_KEY)) {
    try {
      await downloadBackupFile('automatico');
      localStorage.setItem(AUTO_BACKUP_LAST_KEY, String(Date.now()));
      updateAutoBackupInfo('Configuración guardada. Se descargó la primera copia automática.');
    } catch (error) {
      console.error(error);
      updateAutoBackupInfo('Configuración guardada, pero no se pudo descargar la primera copia. Revisá los permisos del navegador.');
    }
    return;
  }
  updateAutoBackupInfo('Configuración guardada.');
}
async function runScheduledBackup() {
  const config = readAutoBackupConfig();
  if (!config.enabled) return;
  const last = Number(localStorage.getItem(AUTO_BACKUP_LAST_KEY) || 0);
  if (last && Date.now() - last < config.intervalDays * 86400000) return;
  try {
    await downloadBackupFile('automatico');
    localStorage.setItem(AUTO_BACKUP_LAST_KEY, String(Date.now()));
    localStorage.setItem('sigestec-auto-backup-result', 'ok');
  } catch (error) {
    console.error('No se pudo generar el respaldo automático:', error);
    localStorage.setItem('sigestec-auto-backup-result', 'error');
  }
}
async function downloadBackupFile(kind = 'manual') {
  const data = {};
  for (const store of BACKUP_STORES) data[store] = await all(store);
  const backup = {format:'SIGESTEC_BACKUP', formatVersion:1, appVersion:'0.5.37', backupType:kind, createdAt:new Date().toISOString(), stores:data};
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SIGESTEC-respaldo-${kind}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function exportBackup() {
  const status = document.querySelector('#backup-status');
  try {
    await downloadBackupFile('manual');
    status.textContent = 'Copia de seguridad descargada. Guardala también en otro dispositivo o almacenamiento externo.';
  } catch (error) {
    console.error(error); status.textContent = 'No se pudo generar el respaldo. Revisá el almacenamiento del navegador.';
  }
}
async function importBackup(event) {
  const file = event.target.files?.[0];
  const status = document.querySelector('#backup-status');
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.format !== 'SIGESTEC_BACKUP' || backup?.formatVersion !== 1 || !backup.stores || !BACKUP_STORES.filter(name => !['instruments','labor_regions','labor_quotes','labor_custom_items','materials','material_lists'].includes(name)).every(name => Array.isArray(backup.stores[name])) || BACKUP_STORES.filter(name => ['instruments','labor_regions','labor_quotes','labor_custom_items','materials','material_lists'].includes(name)).some(name => backup.stores[name] !== undefined && !Array.isArray(backup.stores[name]))) {
      throw new Error('Formato de respaldo no válido o incompleto.');
    }
    const total = BACKUP_STORES.reduce((sum, name) => sum + (backup.stores[name]||[]).length, 0);
    if (!confirm(`Se van a incorporar ${total} registros del respaldo. Si algún registro tiene el mismo identificador que uno existente, será reemplazado. Los demás datos se conservarán. ¿Continuar?`)) return;
    const db = await (await import('./db.js')).openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORES, 'readwrite');
      for (const name of BACKUP_STORES) {
        const store = tx.objectStore(name);
        for (const record of (backup.stores[name]||[])) {
          if (!record || typeof record !== 'object' || !Object.prototype.hasOwnProperty.call(record, name === 'settings' ? 'key' : 'id')) {
            tx.abort(); reject(new Error(`El respaldo contiene un registro inválido en ${name}.`)); return;
          }
          store.put(normalizeStoredValue(record));
        }
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Falló la restauración.'));
      tx.onabort = () => reject(tx.error || new Error('La restauración fue cancelada.'));
    });
    status.textContent = `Restauración completada: ${total} registros incorporados. Recargá SIGESTEC para actualizar los datos visibles.`;
  } catch (error) {
    console.error(error); status.textContent = `No se pudo restaurar el respaldo: ${error.message}`;
  } finally { event.target.value = ''; }
}
const APPEARANCE_DEFAULTS = {theme:'corporate', accent:'teal', buttonStyle:'filled', textSize:'normal', density:'comfortable'};
function normalizeAppearance(value={}) {
  const allowed = {theme:['corporate','tech','light','dark','ocean','natural','violet','rose','warm','custom'],accent:['teal','blue','indigo','green'],textSize:['normal','large'],density:['comfortable','normal','compact'],buttonStyle:['filled','soft','outline']};
  const out={}; for (const [key,values] of Object.entries(allowed)) out[key]=values.includes(value[key])?value[key]:APPEARANCE_DEFAULTS[key]; if(value.customPalette&&/^#[0-9a-f]{6}$/i.test(value.customPalette.main||'')&&/^#[0-9a-f]{6}$/i.test(value.customPalette.contrast||'')) out.customPalette=value.customPalette; return out;
}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
function colorSaturation(hex){const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=((n>>8)&255)/255,b=(n&255)/255;return (Math.max(r,g,b)-Math.min(r,g,b))/(Math.max(r,g,b)||1);}
function colorDistance(a,b){const x=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),y=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));return Math.hypot(...x.map((v,i)=>v-y[i]));}
function mixColor(a,b,t){const x=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),y=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('');}
function complementaryColor(hex){const n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255;return '#'+[255-r,255-g,255-b].map(v=>v.toString(16).padStart(2,'0')).join('');}
function contrastText(hex){const n=parseInt(hex.slice(1),16),c=[n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2]>.42?'#172536':'#ffffff';}
function applyAppearance(value={}) {
  const a=normalizeAppearance(value); const root=document.documentElement;
  root.dataset.theme=a.theme; root.dataset.accent=a.accent;
  if(a.theme==='custom'&&a.customPalette){const p=a.customPalette;root.style.setProperty('--header',p.deep);root.style.setProperty('--navy',p.deep);root.style.setProperty('--hero',p.main);root.style.setProperty('--accent',p.contrast);root.style.setProperty('--accent-strong',p.deep);root.style.setProperty('--accent-soft',p.soft);root.style.setProperty('--button-secondary',p.soft);root.style.setProperty('--button-secondary-text',p.deep);root.style.setProperty('--nav-active',p.main);root.style.setProperty('--primary-button-text',contrastText(p.contrast));root.style.setProperty('--shadow-tint',p.deep);}
  else ['--header','--navy','--hero','--accent','--accent-strong','--accent-soft','--button-secondary','--button-secondary-text','--nav-active','--primary-button-text','--shadow-tint'].forEach(k=>root.style.removeProperty(k)); root.dataset.buttonStyle=a.buttonStyle; root.dataset.textSize=a.textSize; root.dataset.density=a.density;
  root.style.removeProperty('--accent'); root.style.removeProperty('--accent-strong'); root.style.removeProperty('--accent-soft');
  const themeColor=document.querySelector('meta[name="theme-color"]');
  if(themeColor) themeColor.content=getComputedStyle(root).getPropertyValue('--header').trim() || '#19344e';
}
function safe(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init().catch(err => { console.error(err); root.innerHTML = '<section class="panel"><h1>No se pudo iniciar la aplicación</h1><p>Revisá que el navegador permita almacenamiento local y volvé a cargar.</p></section>'; });
