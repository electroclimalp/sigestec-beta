import { get, put, all } from './db.js';
import { renderClients } from './clients.js';
import { renderProperties } from './properties.js';
import { renderJobs, renderMeasurementsHub } from './jobs.js';
import { renderDPMS } from './dpms.js';

const root = document.querySelector('#app');
const modules = [
  {id:'clients', title:'Clientes', desc:'Personas y organizaciones', icon:'♙', ready:true},
  {id:'properties', title:'Inmuebles', desc:'Domicilios y propiedades', icon:'⌂', ready:true},
  {id:'jobs', title:'Trabajos', desc:'Carpetas de trabajo e historial', icon:'▤'},
  {id:'tools', title:'Cálculos y mediciones', desc:'Cálculos eléctricos, ensayos e inspecciones', icon:'∑'},
  {id:'finance', title:'Gestión económica', desc:'Presupuestos, materiales y servicios', icon:'$',},
  {id:'documents', title:'Documentación', desc:'Informes y documentos PDF', icon:'▧'},
  {id:'settings', title:'Configuración', desc:'Identidad y preferencias', icon:'⚙'}
];

async function init() {
  document.querySelector('#settings-shortcut').onclick = () => navigate('settings');
  document.querySelector('#home-shortcut').onclick = () => renderHome();
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); updateConnection();
  setupAppUpdates();
  const identity = await get('settings', 'identity');
  if (!identity?.value?.completed) await renderSetup(); else { updateBrand(identity.value); await renderHome(); }
}

function setupAppUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(registration => {
    const showUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      if (document.querySelector('#app-update-notice')) return;
      const notice = document.createElement('aside');
      notice.id = 'app-update-notice';
      notice.className = 'app-update-notice';
      notice.innerHTML = '<div><strong>Hay una actualización de SIGESTEC</strong><small>Guardá tus cambios y actualizá para usar la nueva versión.</small></div><button type="button" id="apply-app-update">Actualizar</button><button type="button" class="app-update-close" aria-label="Cerrar aviso">×</button>';
      document.body.append(notice);
      notice.querySelector('#apply-app-update').addEventListener('click', () => {
        notice.querySelector('#apply-app-update').disabled = true;
        registration.waiting?.postMessage('SKIP_WAITING');
      });
      notice.querySelector('.app-update-close').addEventListener('click', () => notice.remove());
    };
    if (registration.waiting) showUpdate();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') showUpdate();
      });
    });
    registration.update().catch(() => {});
  }).catch(() => {});
}

function updateConnection() { document.querySelector('#connection-state').textContent = navigator.onLine ? '● Local · Con conexión' : '● Sin conexión'; }
function updateBrand(identity) { document.querySelector('#business-name').textContent = identity.tradeName || identity.name || 'Espacio de trabajo local'; }
async function navigate(id) {
  if (id === 'home') return renderHome();
  if (id === 'clients') return renderClients(root, renderHome);
  if (id === 'properties') return renderProperties(root, renderHome);
  if (id === 'jobs') return renderJobs(root, renderHome);
  if (id === 'settings') return renderSettings();
  if (id === 'tools') { root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MÓDULO TÉCNICO</p><h1>Cálculos y mediciones</h1><p class="muted">Cálculos eléctricos, ensayos y registros de inspección.</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="module-grid"><button class="module-card" id="open-dpms"><span class="module-icon">∑</span><strong>DPMS</strong><small>Demanda de potencia máxima simultánea. Se accede desde la carpeta de cada trabajo.</small></button><button class="module-card" id="open-measurements"><span class="module-icon">▧</span><strong>Mediciones e inspecciones</strong><small>Consultar los registros técnicos de todos los trabajos.</small></button></section>`; root.querySelector('#back-home').onclick=renderHome; root.querySelector('#open-dpms').onclick=()=>navigate('jobs'); root.querySelector('#open-measurements').onclick=()=>renderMeasurementsHub(root,renderHome,()=>navigate('jobs')); return; }
  const item = modules.find(m => m.id === id);
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MÓDULO</p><h1>${item.title}</h1><p class="muted">${item.desc}</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="panel coming"><div class="empty-icon">${item.icon}</div><h2>Módulo previsto para una próxima etapa</h2><p>La arquitectura ya reserva este espacio. Lo incorporaremos sin rehacer el núcleo de la aplicación.</p></section>`;
  root.querySelector('#back-home').onclick = renderHome;
}
async function renderHome() {
  const clients = await all('clients'), properties = await all('properties'), jobs = await all('jobs');
  root.innerHTML = `<section class="welcome"><div><p class="eyebrow">PANEL PRINCIPAL</p><h1>Tu trabajo, organizado.</h1><p>Una herramienta simple para administrar clientes, trabajos y documentación técnica.</p></div><div class="welcome-symbol">GT</div></section>
    <section class="stats"><div class="stat"><span>Clientes</span><strong>${clients.length}</strong></div><div class="stat"><span>Inmuebles</span><strong>${properties.length}</strong></div><div class="stat"><span>Trabajos</span><strong>${jobs.length}</strong></div></section>
    <div class="section-title"><div><h2>Accesos principales</h2><p class="muted">Elegí dónde querés trabajar.</p></div></div>
    <section class="module-grid">${modules.map(m => `<button class="module-card" data-module="${m.id}"><span class="module-icon">${m.icon}</span><strong>${m.title}</strong><small>${m.desc}</small><span class="card-arrow">→</span></button>`).join('')}</section>
    <p class="local-note">Tus datos se guardan en este dispositivo. Esta versión inicial no envía información a ningún servidor.</p>`;
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
  root.querySelector('#back-home').onclick = renderHome;
  root.querySelector('#settings-form').addEventListener('submit', async e => { e.preventDefault(); const value = Object.fromEntries(new FormData(e.currentTarget)); value.completed = true; await put('settings', {key:'identity', value}); updateBrand(value); const msg = document.createElement('p'); msg.className='success'; msg.textContent='Cambios guardados.'; e.currentTarget.append(msg); });
}
function safe(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init().catch(err => { console.error(err); root.innerHTML = '<section class="panel"><h1>No se pudo iniciar la aplicación</h1><p>Revisá que el navegador permita almacenamiento local y volvé a cargar.</p></section>'; });
