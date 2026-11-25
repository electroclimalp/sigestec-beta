import { get, put, all, normalizeStoredValue } from './db.js';
import { renderClients } from './clients.js';
import { renderProperties } from './properties.js';
import { renderJobs, renderMeasurementsHub, renderDocumentsHub } from './jobs.js';
import { renderDPMS } from './dpms.js';
import { renderInstruments } from './instruments.js';
import { renderLabor } from './labor.js';

const root = document.querySelector('#app');
const modules = [
  {id:'clients', title:'Clientes', desc:'Personas y organizaciones · compartidos entre todos los oficios', icon:'♙', ready:true},
  {id:'properties', title:'Inmuebles', desc:'Domicilios y propiedades', icon:'⌂', ready:true},
  {id:'tools', title:'Área técnica · Electricidad', desc:'Cálculos, mediciones, ensayos e inspecciones eléctricas', icon:'∑'},
  {id:'documents', title:'Documentación', desc:'Informes y registros técnicos de todos los trabajos', icon:'▧'},
  {id:'finance', title:'Gestión económica', desc:'Presupuestos, materiales y servicios', icon:'$'},
  {id:'instruments', title:'Instrumentos de medición', desc:'Biblioteca personal de equipos', icon:'⌁'},
  {id:'settings', title:'Configuración', desc:'Identidad, oficios activos y preferencias', icon:'⚙'}
];

async function init() {
  document.querySelector('#settings-shortcut').onclick = () => navigate('settings');
  document.querySelector('#home-shortcut').onclick = () => renderHome();
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); updateConnection();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  const identity = await get('settings', 'identity');
  if (!identity?.value?.completed) await renderSetup(); else { updateBrand(identity.value); await renderHome(); }
  await runScheduledBackup();
}
function updateConnection() { document.querySelector('#connection-state').textContent = navigator.onLine ? '● Local · Con conexión' : '● Sin conexión'; }
function updateBrand(identity) { document.querySelector('#business-name').textContent = identity.tradeName || identity.name || 'Espacio de trabajo local'; }
async function navigate(id) {
  if (id === 'home') return renderHome();
  if (id === 'clients') return renderClients(root, renderHome);
  if (id === 'properties') return renderProperties(root, renderHome);
  if (id === 'jobs') return renderJobs(root, renderHome);
  if (id === 'settings') return renderSettings();
  if (id === 'instruments') return renderInstruments(root, renderHome);
  if (id === 'labor') return renderLabor(root, renderHome);
  if (id === 'finance') { root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTIÓN ECONÓMICA</p><h1>Presupuestos y costos</h1><p class="muted">Tarifarios de mano de obra por región y presupuestos vinculados a clientes e inmuebles.</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="module-grid"><button class="module-card" id="open-labor"><span class="module-icon">$</span><strong>Mano de obra y presupuestos</strong><small>Catálogo regional, referencias de precios y armado de presupuestos exportables a PDF.</small></button></section>`;root.querySelector('#back-home').onclick=renderHome;root.querySelector('#open-labor').onclick=()=>renderLabor(root,renderHome);return; }
  if (id === 'tools') { root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">OFICIO ACTIVO · ELECTRICIDAD</p><h1>Área técnica</h1><p class="muted">Las herramientas y registros eléctricos se organizan por expediente. Clientes e inmuebles permanecen compartidos.</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="panel trade-context"><strong>Espacio de trabajo: Electricidad</strong><p class="muted">En esta etapa solo está habilitado el oficio electricidad. La estructura permite incorporar otros oficios en espacios independientes, sin mezclar sus herramientas ni modificar los clientes.</p></section><section class="module-grid"><button class="module-card" id="open-jobs"><span class="module-icon">▤</span><strong>Expedientes de trabajo</strong><small>Crear o abrir trabajos eléctricos vinculados a cualquier cliente.</small></button><button class="module-card" id="open-dpms"><span class="module-icon">∑</span><strong>Cálculos eléctricos</strong><small>DPMS y dimensionamiento asociado a cada expediente.</small></button><button class="module-card" id="open-measurements"><span class="module-icon">▧</span><strong>Mediciones y ensayos</strong><small>PAT, diferenciales, aislación, continuidad, tensión e inspecciones.</small></button></section>`; root.querySelector('#back-home').onclick=renderHome; root.querySelector('#open-jobs').onclick=()=>renderJobs(root,renderHome); root.querySelector('#open-dpms').onclick=()=>renderJobs(root,renderHome); root.querySelector('#open-measurements').onclick=()=>renderMeasurementsHub(root,renderHome,()=>navigate('jobs')); return; }
  if (id === 'documents') return renderDocumentsHub(root, renderHome, (jobId)=>{ const jobsReturn=()=>renderDocumentsHub(root,renderHome,()=>{}); import('./jobs.js').then(m=>m.openJob(root,jobId,jobsReturn,renderHome)); });
  const item = modules.find(m => m.id === id);
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MÓDULO</p><h1>${item.title}</h1><p class="muted">${item.desc}</p></div><button class="secondary" id="back-home">← Inicio</button></div><section class="panel coming"><div class="empty-icon">${item.icon}</div><h2>Módulo previsto para una próxima etapa</h2><p>La arquitectura ya reserva este espacio. Lo incorporaremos sin rehacer el núcleo de la aplicación.</p></section>`;
  root.querySelector('#back-home').onclick = renderHome;
}
async function renderHome() {
  const clients = await all('clients'), properties = await all('properties'), jobs = await all('jobs');
  root.innerHTML = `<section class="welcome"><div><p class="eyebrow">PANEL PRINCIPAL</p><h1>Tu trabajo, organizado.</h1><p>Un espacio de gestión con áreas de trabajo independientes por oficio y una base común de clientes e inmuebles.</p></div><div class="welcome-symbol">GT</div></section>
    <section class="stats"><div class="stat"><span>Clientes</span><strong>${clients.length}</strong></div><div class="stat"><span>Inmuebles</span><strong>${properties.length}</strong></div><div class="stat"><span>Trabajos</span><strong>${jobs.length}</strong></div></section>
    <div class="section-title"><div><h2>Accesos principales</h2><p class="muted">Elegí dónde querés trabajar.</p></div></div>
    <section class="module-grid">${modules.map(m => `<button class="module-card" data-module="${m.id}"><span class="module-icon">${m.icon}</span><strong>${m.title}</strong><small>${m.desc}</small><span class="card-arrow">→</span></button>`).join('')}</section>
    <p class="local-note">Oficio habilitado en esta etapa: Electricidad. Los clientes e inmuebles son compartidos entre oficios. Tus datos se guardan en este dispositivo. Esta versión inicial no envía información a ningún servidor.</p>`;
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
  const backupPanel = document.createElement('section');
  backupPanel.className = 'panel settings-panel backup-panel';
  backupPanel.innerHTML = `<h2>Respaldo de datos</h2><p class="muted">Exportá una copia de tus clientes, inmuebles, trabajos, cálculos, mediciones, protocolos, instrumentos, regiones tarifarias, ítems personalizados y presupuestos. El archivo queda en tu dispositivo; SIGESTEC no lo envía a ningún servidor.</p><div class="backup-actions"><button type="button" class="primary" id="export-backup">Descargar copia de seguridad</button><button type="button" class="secondary" id="import-backup">Restaurar desde archivo</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><p class="local-note">La restauración incorpora los registros del respaldo. Si encuentra registros con el mismo identificador, reemplaza esos registros. No borra los demás datos.</p><div class="backup-automation"><h3>Respaldo automático</h3><p class="muted">SIGESTEC puede generar y descargar una copia cuando abras la aplicación y se cumpla el intervalo elegido.</p><label class="backup-toggle"><input type="checkbox" id="auto-backup-enabled"> Activar respaldo automático</label><label>Frecuencia<select id="auto-backup-frequency"><option value="1">Todos los días</option><option value="7">Cada 7 días</option><option value="15">Cada 15 días</option><option value="30">Cada 30 días</option></select></label><p id="auto-backup-info" class="local-note" aria-live="polite"></p><button type="button" class="secondary" id="save-auto-backup">Guardar configuración automática</button><p class="muted backup-caveat">Importante: el navegador debe permitir las descargas automáticas. La copia se guarda en la carpeta de descargas del dispositivo; no protege frente a la pérdida del dispositivo ni sustituye guardar otra copia en un lugar externo.</p></div><p id="backup-status" class="success" role="status" aria-live="polite"></p>`;
  const tradesPanel = document.createElement('section');
  tradesPanel.className = 'panel settings-panel trade-settings';
  const activeTrades = v.activeTrades || ['electricity'];
  tradesPanel.innerHTML = `<h2>Oficios y espacios de trabajo</h2><p class="muted">Cada oficio tendrá sus propias herramientas, cálculos, mediciones y expedientes. Los clientes e inmuebles serán compartidos, para que un mismo cliente pueda tener trabajos de distintas especialidades sin mezclar sus registros.</p><label class="backup-toggle"><input type="checkbox" checked disabled> Electricidad <span class="optional">Activo en esta etapa</span></label><label class="backup-toggle"><input type="checkbox" disabled> Aire acondicionado <span class="optional">Etapa futura</span></label><label class="backup-toggle"><input type="checkbox" disabled> Electrónica <span class="optional">Etapa futura</span></label><p class="local-note">La selección de oficios no modifica ni duplica clientes o inmuebles. Cada trabajo pertenece a un solo oficio; un cliente puede tener tantos trabajos como necesite.</p>`;
  root.querySelector('.settings-panel').after(tradesPanel);
  root.querySelector('.settings-panel').after(backupPanel);
  root.querySelector('#export-backup').onclick = exportBackup;
  root.querySelector('#import-backup').onclick = () => root.querySelector('#backup-file').click();
  root.querySelector('#backup-file').onchange = importBackup;
  const autoConfig = readAutoBackupConfig();
  root.querySelector('#auto-backup-enabled').checked = autoConfig.enabled;
  root.querySelector('#auto-backup-frequency').value = String(autoConfig.intervalDays);
  updateAutoBackupInfo();
  root.querySelector('#save-auto-backup').onclick = saveAutoBackupConfig;
}

const BACKUP_STORES = ['clients','properties','jobs','settings','dpms_calculations','measurements','srt_protocols','instruments','labor_regions','labor_quotes','labor_custom_items'];
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
  const backup = {format:'SIGESTEC_BACKUP', formatVersion:1, appVersion:'0.5.34', backupType:kind, createdAt:new Date().toISOString(), stores:data};
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
    if (backup?.format !== 'SIGESTEC_BACKUP' || backup?.formatVersion !== 1 || !backup.stores || !BACKUP_STORES.filter(name => !['instruments','labor_regions','labor_quotes','labor_custom_items'].includes(name)).every(name => Array.isArray(backup.stores[name])) || BACKUP_STORES.filter(name => ['instruments','labor_regions','labor_quotes','labor_custom_items'].includes(name)).some(name => backup.stores[name] !== undefined && !Array.isArray(backup.stores[name]))) {
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
function safe(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init().catch(err => { console.error(err); root.innerHTML = '<section class="panel"><h1>No se pudo iniciar la aplicación</h1><p>Revisá que el navegador permita almacenamiento local y volvé a cargar.</p></section>'; });
