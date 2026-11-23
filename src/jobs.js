import { all, put, remove } from './db.js';
import { renderDPMS } from './dpms.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientName = c => c?.type === 'company' ? (c.legalName || c.tradeName || 'Empresa sin nombre') : `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'Cliente sin nombre';
const statusNames = {pending:'Pendiente', in_progress:'En proceso', paused:'Pausado', completed:'Finalizado', cancelled:'Cancelado'};
const specialtyNames = {electricity:'Electricidad', air_conditioning:'Aire acondicionado', electronics:'Electrónica', refrigeration:'Refrigeración', plumbing:'Plomería', other:'Otro'};
const fmt = value => value ? new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(value)) : '—';
let jobsCache = [];

export async function renderJobs(root, goHome = () => {}, clientFilter = null) {
  const [jobs, clients, properties] = await Promise.all([all('jobs'), all('clients'), all('properties')]);
  jobsCache = jobs;
  const clientMap = new Map(clients.map(c => [c.id,c]));
  const propertyMap = new Map(properties.map(p => [p.id,p]));
  const heading = clientFilter ? `Trabajos de ${clientName(clientMap.get(clientFilter))}` : 'Trabajos';
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTIÓN</p><h1>${esc(heading)}</h1><p class="muted">Cada trabajo funciona como una carpeta digital independiente.</p></div><div class="heading-actions"><button class="secondary" id="back-jobs">← Inicio</button><button class="primary" id="new-job">＋ Nuevo trabajo</button></div></div>
  <section class="panel"><div class="list-toolbar"><div class="search-wrap"><input id="job-search" type="search" placeholder="Buscar por código, trabajo, cliente o inmueble…" aria-label="Buscar trabajos"></div><select id="job-status-filter" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${Object.entries(statusNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><span class="count-label" id="job-count"></span></div><div id="job-list" class="client-list"></div></section>`;
  root.querySelector('#back-jobs').onclick = goHome;
  const list=root.querySelector('#job-list'), count=root.querySelector('#job-count'), search=root.querySelector('#job-search'), statusFilter=root.querySelector('#job-status-filter');
  const paint=()=>{
    const q=search.value.trim().toLocaleLowerCase('es'), st=statusFilter.value;
    const filtered=jobs.filter(j=>(!clientFilter||j.clientId===clientFilter)&&(!st||j.status===st)&&[j.code,j.name,j.description,clientName(clientMap.get(j.clientId)),propertyMap.get(j.propertyId)?.name].join(' ').toLocaleLowerCase('es').includes(q)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    count.textContent=`${filtered.length} ${filtered.length===1?'trabajo':'trabajos'}`;
    list.innerHTML=filtered.length?filtered.map(j=>`<div class="job-list-item client-row"><button class="job-open-row" data-id="${esc(j.id)}"><span class="avatar">▤</span><span class="client-info"><strong>${esc(j.code)} · ${esc(j.name)}</strong><small>${esc(clientName(clientMap.get(j.clientId)))} · ${esc(propertyMap.get(j.propertyId)?.name||'Sin inmueble')} · ${esc(specialtyNames[j.specialty]||'Especialidad')}</small></span><span class="client-email status-${esc(j.status)}">${esc(statusNames[j.status]||'Pendiente')}</span><span class="row-arrow">›</span></button><button type="button" class="danger job-delete-list" data-delete-job="${esc(j.id)}" title="Eliminar trabajo">Eliminar</button></div>`).join(''):`<div class="empty"><div class="empty-icon">▤</div><strong>${q||st?'No hay coincidencias':'Todavía no hay trabajos'}</strong><p>${q||st?'Probá cambiando la búsqueda o el filtro.':'Creá un trabajo para empezar a organizar tareas, cálculos y documentación.'}</p></div>`;
    list.querySelectorAll('[data-id]').forEach(row=>row.onclick=()=>showJobDetail(root,jobs,clients,properties,row.dataset.id,()=>renderJobs(root,goHome,clientFilter),goHome));
    list.querySelectorAll('[data-delete-job]').forEach(btn=>btn.onclick=async e=>{e.stopPropagation();const target=jobs.find(j=>j.id===btn.dataset.deleteJob);if(target)await deleteJobAndHistory(target,jobs,()=>renderJobs(root,goHome,clientFilter));});
  };
  search.addEventListener('input',paint); statusFilter.addEventListener('change',paint); paint();
  root.querySelector('#new-job').onclick=()=>showJobForm(root,null,clients,properties,clientFilter,async job=>{await put('jobs',job);jobs.push(job);jobsCache=jobs;paint();});
}

async function showJobDetail(root,jobs,clients,properties,id,refresh,goHome){
  const job=jobs.find(j=>j.id===id);if(!job)return;
  const client=clients.find(c=>c.id===job.clientId),property=properties.find(p=>p.id===job.propertyId);
  root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">CARPETA DE TRABAJO · ${esc(job.code)}</p><h1>${esc(job.name)}</h1><p class="muted">${esc(clientName(client))} · ${esc(statusNames[job.status]||'Pendiente')}</p></div><div class="heading-actions"><button class="secondary" id="back-job-list">← Trabajos</button><button class="primary" id="edit-job">Editar trabajo</button></div></div>
  <section class="detail-grid"><article class="panel detail-panel"><h2>Información general</h2>${line('Código',job.code)}${line('Especialidad',specialtyNames[job.specialty])}${line('Tipo de trabajo',job.type)}${line('Estado',statusNames[job.status])}${line('Fecha de creación',fmt(job.createdAt))}${line('Fecha prevista',fmt(job.expectedDate))}${line('Descripción',job.description)}${line('Observaciones',job.notes)}</article>
  <article class="panel detail-panel"><h2>Cliente asociado</h2><div class="related-stat"><strong>${esc(clientName(client))}</strong></div>${line('Teléfono',client?.phone)}${line('Email',client?.email)}<h2 style="margin-top:22px">Inmueble asociado</h2><div class="related-stat"><strong>${esc(property?.name||'Sin inmueble asociado')}</strong></div>${line('Dirección',[property?.address,property?.locality,property?.province].filter(Boolean).join(', '))}</article></section>
  <section class="panel" style="margin-top:18px"><div class="section-title"><div><h2>Contenido de la carpeta</h2><p class="muted">Estos espacios se habilitarán en las próximas etapas.</p></div></div><div class="module-grid"><button class="module-card" id="open-job-dpms"><span class="module-icon">⌁</span><strong>Cálculos técnicos</strong><small>DPMS, PAT y caída de tensión</small></button><div class="module-card"><span class="module-icon">▧</span><strong>Mediciones e inspecciones</strong><small>Registros y protocolos</small></div><div class="module-card"><span class="module-icon">$</span><strong>Presupuestos</strong><small>Materiales y mano de obra</small></div><div class="module-card"><span class="module-icon">▤</span><strong>Archivos e informes</strong><small>Fotos, adjuntos y documentos</small></div></div></section>
  <div class="detail-footer"><small>Creado: ${fmt(job.createdAt)}${job.updatedAt?` · Modificado: ${fmt(job.updatedAt)}`:''}</small><button class="danger" id="delete-job">Eliminar trabajo</button></div>`;
  root.querySelector('#back-job-list').onclick=refresh;
  root.querySelector('#open-job-dpms').onclick=()=>renderDPMS(root,job,()=>showJobDetail(root,jobs,clients,properties,id,refresh,goHome));
  root.querySelector('#edit-job').onclick=()=>showJobForm(root,job,clients,properties,null,async updated=>{Object.assign(job,updated);await put('jobs',job);await showJobDetail(root,jobs,clients,properties,id,refresh,goHome);});
  root.querySelector('#delete-job').onclick=async()=>deleteJobAndHistory(job,jobs,refresh);
}


async function deleteJobAndHistory(job,jobs,refresh){
  const calculations=await all('dpms_calculations');
  const related=calculations.filter(x=>x.jobId===job.id);
  const warning=related.length?` También se eliminarán ${related.length} cálculo(s) DPMS guardado(s) asociado(s).`:'';
  if(!confirm(`¿Eliminar definitivamente el trabajo «${job.code} · ${job.name}»?${warning} Esta acción no se puede deshacer.`))return;
  for(const record of related) await remove('dpms_calculations',record.id);
  await remove('jobs',job.id);
  const i=jobs.findIndex(x=>x.id===job.id);if(i>=0)jobs.splice(i,1);
  refresh();
}

function line(label,value){return value?`<div class="detail-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';}

function showJobForm(root,existing,clients,properties,selectedClientId,onSave){
  if(!clients.length){alert('Primero tenés que crear un cliente para poder abrir un trabajo.');return;}
  const v=existing||{}, overlay=document.createElement('div');overlay.className='modal-backdrop';
  const chosenClient=v.clientId||selectedClientId||clients[0].id;
  const clientOptions=clients.map(c=>`<option value="${esc(c.id)}" ${chosenClient===c.id?'selected':''}>${esc(clientName(c))}</option>`).join('');
  const propertyOptions=properties.filter(p=>p.clientId===chosenClient);
  overlay.innerHTML=`<form class="modal" id="job-form"><div class="modal-head"><div><p class="eyebrow">${existing?'ACTUALIZAR CARPETA':'NUEVA CARPETA'}</p><h2>${existing?'Editar trabajo':'Crear trabajo'}</h2></div><button type="button" class="icon-button" id="close-job" aria-label="Cerrar">✕</button></div>
  <label>Cliente asociado<select name="clientId" required ${existing?'disabled':''}>${clientOptions}</select></label>
  <label>Inmueble asociado <span class="optional">(opcional)</span><select name="propertyId"><option value="">Sin inmueble asociado</option>${propertyOptions.map(p=>`<option value="${esc(p.id)}" ${v.propertyId===p.id?'selected':''}>${esc(p.name)}${p.address?' · '+esc(p.address):''}</option>`).join('')}</select></label>
  <label>Nombre del trabajo<input name="name" required maxlength="140" value="${esc(v.name)}" placeholder="Ej.: Instalación eléctrica vivienda"></label>
  <div class="form-grid"><label>Especialidad<select name="specialty"><option value="electricity" ${(!v.specialty||v.specialty==='electricity')?'selected':''}>Electricidad</option><option value="air_conditioning" ${v.specialty==='air_conditioning'?'selected':''}>Aire acondicionado</option><option value="electronics" ${v.specialty==='electronics'?'selected':''}>Electrónica</option><option value="refrigeration" ${v.specialty==='refrigeration'?'selected':''}>Refrigeración</option><option value="plumbing" ${v.specialty==='plumbing'?'selected':''}>Plomería</option><option value="other" ${v.specialty==='other'?'selected':''}>Otro</option></select></label><label>Tipo de trabajo <span class="optional">(opcional)</span><input name="type" maxlength="100" value="${esc(v.type)}" placeholder="Instalación, reparación…"></label></div>
  <div class="form-grid"><label>Estado<select name="status">${Object.entries(statusNames).map(([k,n])=>`<option value="${k}" ${(v.status||'pending')===k?'selected':''}>${n}</option>`).join('')}</select></label><label>Fecha prevista <span class="optional">(opcional)</span><input type="date" name="expectedDate" value="${esc(v.expectedDate)}"></label></div>
  <label>Descripción <span class="optional">(opcional)</span><textarea name="description" rows="3" maxlength="1200">${esc(v.description)}</textarea></label>
  <label>Observaciones <span class="optional">(opcional)</span><textarea name="notes" rows="3" maxlength="1200">${esc(v.notes)}</textarea></label>
  <div class="modal-actions"><button type="button" class="secondary" id="cancel-job">Cancelar</button><button class="primary" type="submit">${existing?'Guardar cambios':'Crear trabajo'}</button></div></form>`;
  root.append(overlay);const form=overlay.querySelector('form'),close=()=>overlay.remove();
  overlay.querySelector('#close-job').onclick=close;overlay.querySelector('#cancel-job').onclick=close;
  const clientSelect=form.elements.clientId,propertySelect=form.elements.propertyId;
  if(!existing)clientSelect.addEventListener('change',()=>{const current=properties.filter(p=>p.clientId===clientSelect.value);propertySelect.innerHTML='<option value="">Sin inmueble asociado</option>'+current.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.address?' · '+esc(p.address):''}</option>`).join('');});
  form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));if(existing)data.clientId=existing.clientId;const now=new Date().toISOString();const job={...(existing||{}),...data,id:existing?.id||crypto.randomUUID(),code:existing?.code||nextCode(),createdAt:existing?.createdAt||now,updatedAt:existing?now:null};await onSave(job);close();});
  form.elements.name.focus();
}
function nextCode(){const year=new Date().getFullYear();const nums=jobsCache.filter(j=>String(j.code||'').startsWith(`TR-${year}-`)).map(j=>Number(String(j.code).split('-').pop())||0);return `TR-${year}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;}

export async function openJob(root, id, back, goHome = () => {}) {
  const [jobs, clients, properties] = await Promise.all([all('jobs'), all('clients'), all('properties')]);
  jobsCache = jobs;
  await showJobDetail(root, jobs, clients, properties, id, back, goHome);
}
