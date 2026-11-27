import { all, put, remove, get } from './db.js';
import { renderProperties, showPropertyDetail } from './properties.js';
import { openJob, renderJobs, renderDocumentsHub } from './jobs.js';
import { renderLabor } from './labor.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName = c => c.type === 'company' ? (c.legalName || c.tradeName || 'Empresa sin nombre') : `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Cliente sin nombre';

export async function renderClients(root, goHome = () => {}, initialSearch = '') {
  const clients = (await all('clients')).sort((a,b) => displayName(a).localeCompare(displayName(b), 'es'));
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">GESTIÓN</p><h1>Clientes</h1><p class="muted">Personas y organizaciones, con sus inmuebles y trabajos asociados.</p></div><div class="heading-actions"><button class="secondary" id="back-home">← Inicio</button><button class="primary" id="new-client">＋ Nuevo cliente</button></div></div>
    <section class="panel"><div class="list-toolbar"><div class="search-wrap"><input id="client-search" type="search" placeholder="Buscar por nombre, documento, teléfono o email…" aria-label="Buscar clientes"></div><span class="count-label" id="client-count"></span></div>
    <div id="client-list" class="client-list"></div></section>`;
  root.querySelector('#back-home').onclick = goHome;
  const list = root.querySelector('#client-list');
  const count = root.querySelector('#client-count');
  const paint = (term = '') => {
    const q = term.trim().toLocaleLowerCase('es');
    const filtered = clients.filter(c => [displayName(c), c.document, c.taxId, c.contactName, c.phone, c.email, c.address].join(' ').toLocaleLowerCase('es').includes(q));
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}`;
    list.innerHTML = filtered.length ? filtered.map(c => `<button class="client-row client-row-button" data-id="${esc(c.id)}"><div class="avatar">${esc(displayName(c).slice(0,1).toUpperCase())}</div><div class="client-info"><strong>${esc(displayName(c))}</strong><small>${c.type === 'company' ? 'Empresa / organización' : 'Persona física'} · ${esc(c.phone || 'Sin teléfono')}${c.document || c.taxId ? ` · ${esc(c.document || c.taxId)}` : ''}</small></div><span class="client-email">${esc(c.email || '')}</span><span class="row-arrow">›</span></button>`).join('') : `<div class="empty"><div class="empty-icon">♙</div><strong>${q ? 'No hay coincidencias' : 'Todavía no hay clientes'}</strong><p>${q ? 'Probá con otro término.' : 'Creá el primer cliente para comenzar a organizar tus trabajos.'}</p></div>`;
    list.querySelectorAll('[data-id]').forEach(row => row.addEventListener('click', () => {
      const currentTerm = root.querySelector('#client-search')?.value || '';
      showClientDetail(root, clients, row.dataset.id, () => renderClients(root, goHome, currentTerm), goHome);
    }));
  };
  paint(initialSearch);
  root.querySelector('#client-search').value = initialSearch;
  root.querySelector('#client-search').addEventListener('input', e => paint(e.target.value));
  root.querySelector('#new-client').addEventListener('click', () => showClientForm(root, null, async client => { await put('clients', client); clients.push(client); clients.sort((a,b) => displayName(a).localeCompare(displayName(b), 'es')); paint(root.querySelector('#client-search')?.value || ''); }));
}

async function showClientDetail(root, clients, id, refresh, goHome) {
  const client = clients.find(c => c.id === id);
  if (!client) return;
  const [allProperties, allJobs, allLists, allQuotes, allDPMS, allMeasurements, allProtocols] = await Promise.all([
    all('properties'), all('jobs'), all('material_lists'), all('labor_quotes'), all('dpms_calculations'), all('measurements'), all('srt_protocols')
  ]);
  const properties = allProperties.filter(p => p.clientId === id);
  // Include jobs linked directly to the client and legacy jobs whose property identifies the client.
  const propertyIds = new Set(properties.map(p => p.id));
  const jobs = allJobs.filter(j => j.clientId === id || propertyIds.has(j.propertyId));
  const jobIds = new Set(jobs.map(j => j.id));
  const relatedLists = allLists.filter(x => x.clientId === id || propertyIds.has(x.propertyId) || jobIds.has(x.jobId));
  const relatedQuotes = allQuotes.filter(x => x.clientId === id || propertyIds.has(x.propertyId) || jobIds.has(x.jobId));
  const technicalCounts = { dpms: allDPMS.filter(x => jobIds.has(x.jobId)).length, measurements: allMeasurements.filter(x => jobIds.has(x.jobId)).length, protocols: allProtocols.filter(x => jobIds.has(x.jobId)).length };
  const name = displayName(client);
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">FICHA DEL CLIENTE</p><h1>${esc(name)}</h1><p class="muted">${client.type === 'company' ? 'Empresa / organización' : 'Persona física'}</p></div><div class="heading-actions"><button class="secondary" id="back-list">← Clientes</button><button class="primary" id="edit-client">Editar ficha</button></div></div>
  <section class="detail-grid"><article class="panel detail-panel"><h2>Datos de contacto</h2>${detailLine(client.type === 'company' ? 'Razón social' : 'Nombre', client.type === 'company' ? client.legalName : `${client.firstName || ''} ${client.lastName || ''}`.trim())}${client.type === 'company' ? detailLine('Nombre comercial', client.tradeName) + detailLine('CUIT', client.taxId) + detailLine('Persona de contacto', client.contactName) : detailLine('DNI', client.document)}${detailLine('Teléfono', client.phone)}${detailLine('Email', client.email)}${detailLine('Domicilio', client.address)}${detailLine('Localidad', client.locality)}${detailLine('Provincia', client.province)}${detailLine('Observaciones', client.notes)}</article>
  <article class="panel detail-panel"><h2>Actividad asociada</h2><div class="related-stat"><strong>${properties.length}</strong><span>Inmuebles</span></div><div class="related-stat"><strong>${jobs.length}</strong><span>Trabajos</span></div><div class="related-properties">${properties.length ? properties.map(p => `<button class="related-property-row" data-property-id="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc([p.address,p.locality].filter(Boolean).join(', ') || 'Sin dirección')}</small></span><span>›</span></button>`).join('') : '<p class="muted">Todavía no hay inmuebles asociados.</p>'}</div><button class="secondary" id="add-property">＋ Agregar inmueble</button><div class="related-properties" style="margin-top:14px">${jobs.length ? jobs.map(j => `<button class="related-property-row" data-job-id="${esc(j.id)}"><span><strong>${esc(j.code)} · ${esc(j.name)}</strong><small>${esc(({pending:'Pendiente',in_progress:'En proceso',paused:'Pausado',completed:'Finalizado',cancelled:'Cancelado'})[j.status]||'Pendiente')} · ${esc(j.propertyId ? (properties.find(p=>p.id===j.propertyId)?.name||'Inmueble') : 'Sin inmueble')}</small></span><span>›</span></button>`).join('') : '<p class="muted">Todavía no hay trabajos asociados.</p>'}</div><button class="primary" id="add-job">＋ Nuevo trabajo</button></article></section>
  <section class="panel" style="margin-top:18px"><div class="section-title"><div><h2>Documentación y recursos vinculados</h2><p class="muted">Se reúnen registros asociados directamente al cliente, a sus inmuebles o a sus trabajos.</p></div></div><div class="job-content-grid"><article class="job-content-card"><h3>Listados de materiales</h3><strong>${relatedLists.length} ${relatedLists.length===1?'listado':'listados'}</strong>${relatedLists.length?relatedLists.map(x=>`<button type="button" class="related-property-row" data-open-material-list="${esc(x.id)}"><span><strong>${esc(x.title||'Listado sin título')}</strong><small>${Number(x.items?.length)||0} ítems · Abrir listado</small></span><span>›</span></button>`).join(''):'<p class="muted">Sin listados asociados.</p>'}</article><article class="job-content-card"><h3>Presupuestos</h3><strong>${relatedQuotes.length} ${relatedQuotes.length===1?'presupuesto':'presupuestos'}</strong>${relatedQuotes.length?relatedQuotes.map(x=>`<button type="button" class="related-property-row" data-open-quote="${esc(x.id)}"><span><strong>${esc(x.title||'Presupuesto')}</strong><small>N.º ${esc(x.number||'Sin número')} · Abrir presupuesto</small></span><span>›</span></button>`).join(''):'<p class="muted">Sin presupuestos asociados.</p>'}</article><article class="job-content-card"><h3>Documentación técnica</h3><strong>${technicalCounts.dpms+technicalCounts.measurements+technicalCounts.protocols} registros</strong><p class="job-content-note">${technicalCounts.dpms} DPMS · ${technicalCounts.measurements} mediciones · ${technicalCounts.protocols} protocolos SRT</p><button type="button" class="secondary" id="open-client-technical-docs" ${technicalCounts.dpms+technicalCounts.measurements+technicalCounts.protocols?'':'disabled'}>Consultar documentación técnica</button></article></div></section>
  <div class="detail-footer"><small>Alta: ${formatDate(client.createdAt)}${client.updatedAt ? ` · Última modificación: ${formatDate(client.updatedAt)}` : ''}</small><button class="danger" id="delete-client">Eliminar cliente</button></div>`;
  root.querySelector('#back-list').onclick = refresh;
  root.querySelector('#add-property').onclick = () => renderProperties(root, goHome, id, () => showClientDetail(root, clients, id, refresh, goHome));
  root.querySelector('#add-job').onclick = () => renderJobs(root, goHome, id);
  root.querySelectorAll('[data-job-id]').forEach(row => row.addEventListener('click', () => openJob(root, row.dataset.jobId, () => showClientDetail(root, clients, id, refresh, goHome), goHome)));
  root.querySelectorAll('[data-property-id]').forEach(row => row.addEventListener('click', async () => {
    const currentProperties = await all('properties');
    const current = currentProperties.find(p => p.id === row.dataset.propertyId);
    if (!current) return;
    await showPropertyDetail(root, currentProperties, clients, current.id, () => renderProperties(root, goHome, id, () => showClientDetail(root, clients, id, refresh, goHome)), goHome, id, () => showClientDetail(root, clients, id, refresh, goHome));
  }));
  root.querySelectorAll('[data-open-material-list]').forEach(b=>b.onclick=()=>renderLabor(root,goHome,{materialListId:b.dataset.openMaterialList}));
  root.querySelectorAll('[data-open-quote]').forEach(b=>b.onclick=()=>renderLabor(root,goHome,{quoteId:b.dataset.openQuote}));
  root.querySelector('#open-client-technical-docs')?.addEventListener('click',()=>renderDocumentsHub(root,goHome,jobId=>openJob(root,jobId,()=>showClientDetail(root,clients,id,refresh,goHome),goHome)));
  root.querySelector('#edit-client').onclick = () => showClientForm(root, client, async updated => { Object.assign(client, updated); await put('clients', client); await showClientDetail(root, clients, id, refresh, goHome); });
  root.querySelector('#delete-client').onclick = async () => {
    const linkedLists = relatedLists.length, linkedQuotes = relatedQuotes.length;
    const linked = properties.length + jobs.length + linkedLists + linkedQuotes;
    if (linked) { alert(`No se puede eliminar este cliente porque conserva relaciones: ${properties.length} inmueble(s), ${jobs.length} trabajo(s), ${linkedLists} listado(s) de materiales y ${linkedQuotes} presupuesto(s). Primero reasigná o eliminá esos registros.`); return; }
    if (!confirm(`¿Eliminar definitivamente a ${name}? Esta acción no se puede deshacer.`)) return;
    await remove('clients', id); const index = clients.findIndex(c => c.id === id); if (index >= 0) clients.splice(index, 1); refresh();
  };
}

function detailLine(label, value) { return value ? `<div class="detail-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : ''; }
function formatDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('es-AR', {dateStyle:'medium'}).format(new Date(value)); }

function showClientForm(root, existing, onSave) {
  const isEdit = Boolean(existing);
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const v = existing || {};
  overlay.innerHTML = `<form class="modal" id="client-form"><div class="modal-head"><div><p class="eyebrow">${isEdit ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO'}</p><h2>${isEdit ? 'Editar cliente' : 'Agregar cliente'}</h2></div><button type="button" class="icon-button" id="close-modal" aria-label="Cerrar">✕</button></div>
    <label>Tipo de cliente<select name="type" ${isEdit ? 'disabled' : ''}><option value="person" ${v.type !== 'company' ? 'selected' : ''}>Persona física</option><option value="company" ${v.type === 'company' ? 'selected' : ''}>Empresa / organización</option></select></label>
    <div id="person-fields"><div class="form-grid"><label>Nombre<input name="firstName" maxlength="80" autocomplete="given-name" value="${esc(v.firstName)}"></label><label>Apellido<input name="lastName" maxlength="80" autocomplete="family-name" value="${esc(v.lastName)}"></label></div><label>DNI <span class="optional">(opcional)</span><input name="document" maxlength="30" value="${esc(v.document)}"></label></div>
    <div id="company-fields"><label>Razón social<input name="legalName" maxlength="140" value="${esc(v.legalName)}"></label><label>Nombre comercial <span class="optional">(opcional)</span><input name="tradeName" maxlength="120" value="${esc(v.tradeName)}"></label><label>CUIT <span class="optional">(opcional)</span><input name="taxId" maxlength="30" value="${esc(v.taxId)}"></label><label>Persona de contacto <span class="optional">(opcional)</span><input name="contactName" maxlength="120" value="${esc(v.contactName)}"></label></div>
    <div class="form-grid"><label>Teléfono<input name="phone" maxlength="40" autocomplete="tel" value="${esc(v.phone)}"></label><label>Email<input name="email" type="email" maxlength="120" autocomplete="email" value="${esc(v.email)}"></label></div>
    <label>Domicilio <span class="optional">(opcional)</span><input name="address" maxlength="180" value="${esc(v.address)}"></label><div class="form-grid"><label>Localidad<input name="locality" maxlength="100" value="${esc(v.locality)}"></label><label>Provincia<input name="province" maxlength="100" value="${esc(v.province)}"></label></div>
    <label>Observaciones <span class="optional">(opcional)</span><textarea name="notes" rows="3">${esc(v.notes)}</textarea></label>
    <div class="modal-actions"><button type="button" class="secondary" id="cancel-modal">Cancelar</button><button class="primary" type="submit">${isEdit ? 'Guardar cambios' : 'Guardar cliente'}</button></div></form>`;
  root.append(overlay);
  const form = overlay.querySelector('form');
  const close = () => overlay.remove();
  const syncType = () => { const company = form.elements.type.value === 'company'; overlay.querySelector('#person-fields').hidden = company; overlay.querySelector('#company-fields').hidden = !company; form.elements.firstName.required = !company; form.elements.lastName.required = !company; form.elements.legalName.required = company; };
  if (isEdit) form.elements.type.value = v.type;
  syncType(); form.elements.type.addEventListener('change', syncType);
  overlay.querySelector('#close-modal').onclick = close; overlay.querySelector('#cancel-modal').onclick = close;
  form.addEventListener('submit', async e => {
    e.preventDefault(); const data = Object.fromEntries(new FormData(form));
    const type = isEdit ? existing.type : data.type;
    const requiredName = type === 'company' ? data.legalName?.trim() : `${data.firstName || ''} ${data.lastName || ''}`.trim();
    if (!requiredName) { alert(type === 'company' ? 'Ingresá la razón social.' : 'Ingresá nombre y apellido.'); return; }
    const now = new Date().toISOString();
    const client = { ...(existing || {}), ...data, type, id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
    if (type === 'person') { delete client.legalName; delete client.tradeName; delete client.taxId; delete client.contactName; }
    else { delete client.firstName; delete client.lastName; delete client.document; }
    await onSave(client); close();
  });
  (v.type === 'company' ? form.elements.legalName : form.elements.firstName).focus();
}

// Formulario reutilizable para alta contextual desde otros módulos.
export function openClientForm(root, onSave) { showClientForm(root, null, onSave); }
