import { all, put, remove } from './db.js';
import { renderDPMS } from './dpms.js';
import { openClientForm } from './clients.js';
import { renderSRT } from './srt.js';

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
  const [client,property,allCalculations,allMeasurements,allMaterialLists,allQuotes,allProtocols]=await Promise.all([
    Promise.resolve(clients.find(c=>c.id===job.clientId)),
    Promise.resolve(properties.find(p=>p.id===job.propertyId)),
    all('dpms_calculations'),
    all('measurements'),
    all('material_lists'),
    all('labor_quotes'),
    all('srt_protocols')
  ]);
  const calculations=allCalculations.filter(x=>x.jobId===job.id).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  const latest=calculations[0]||null;
  const measurements=allMeasurements.filter(x=>x.jobId===job.id).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  const latestMeasurement=measurements[0]||null;
  const materialLists=allMaterialLists.filter(x=>x.jobId===job.id);
  const quotes=allQuotes.filter(x=>x.jobId===job.id);
  const protocols=allProtocols.filter(x=>x.jobId===job.id);
  const latestDate=latest?new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(latest.updatedAt||latest.createdAt)):null;
  root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">CARPETA DE TRABAJO · ${esc(job.code)}</p><h1>${esc(job.name)}</h1><p class="muted">${esc(clientName(client))} · ${esc(statusNames[job.status]||'Pendiente')}</p></div><div class="heading-actions"><button class="secondary" id="back-job-list">← Trabajos</button><button class="primary" id="edit-job">Editar trabajo</button></div></div>
  <section class="detail-grid"><article class="panel detail-panel"><h2>Información general</h2>${line('Código',job.code)}${line('Especialidad',specialtyNames[job.specialty])}${line('Tipo de trabajo',job.type)}${line('Estado',statusNames[job.status])}${line('Fecha de creación',fmt(job.createdAt))}${line('Fecha prevista',fmt(job.expectedDate))}${line('Descripción',job.description)}${line('Observaciones',job.notes)}</article>
  <article class="panel detail-panel"><h2>Cliente asociado</h2><div class="related-stat"><strong>${esc(clientName(client))}</strong></div>${line('Teléfono',client?.phone)}${line('Email',client?.email)}<h2 style="margin-top:22px">Inmueble asociado</h2><div class="related-stat"><strong>${esc(property?.name||'Sin inmueble asociado')}</strong></div>${line('Dirección',[property?.address,property?.locality,property?.province].filter(Boolean).join(', '))}</article></section>
  <section class="panel" style="margin-top:18px"><div class="section-title"><div><h2>Contenido de la carpeta</h2><p class="muted">Resumen de la información técnica asociada a este trabajo.</p></div></div><div class="job-content-grid"><article class="job-content-card"><div class="job-content-head"><span class="module-icon">⌁</span><span class="job-content-count">${calculations.length} ${calculations.length===1?'cálculo':'cálculos'}</span></div><h3>Cálculos técnicos · DPMS</h3>${latest?`<p class="muted">Último cálculo: ${esc(latestDate)}</p><div class="job-dpms-kpis"><div><span>Potencia aparente</span><strong>${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(latest.result?.totalVA||0)} VA</strong></div><div><span>Corriente</span><strong>${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(latest.result?.currentA||0)} A</strong></div></div><p class="job-content-note">${esc(latest.input?.supply==='three'?'Trifásico':'Monofásico')} · ${esc(latest.propertySnapshot?.name||property?.name||'Sin inmueble')}</p>`:`<p class="muted">Todavía no hay cálculos DPMS guardados en este trabajo.</p>`}<button class="secondary" id="open-job-dpms">${latest?'Abrir cálculos y registros':'＋ Crear primer cálculo'}</button></article><article class="job-content-card"><div class="job-content-head"><span class="module-icon">▧</span><span class="job-content-count">${measurements.length} ${measurements.length===1?'registro':'registros'}</span></div><h3>Mediciones e inspecciones</h3>${latestMeasurement?`<p class="muted">Último registro: ${esc(latestMeasurement.title)} · ${esc(fmt(latestMeasurement.date))}</p><p class="job-content-note">${esc(measurementTypeNames[latestMeasurement.type]||'Medición')} · ${esc(measurementStatusNames[latestMeasurement.status]||'Borrador')}</p>`:`<p class="muted">Todavía no hay mediciones ni inspecciones registradas.</p>`}<div class="job-measurement-shortcuts"><button class="secondary" id="open-job-measurements">${measurements.length?'Ver historial':'Ver historial'}</button><button class="primary" data-job-new-measurement="pat">＋ PAT</button><button class="secondary" data-job-new-measurement="rcd">Diferencial</button><button class="secondary" data-job-new-measurement="insulation">Megóhmetro</button><button class="secondary" data-job-new-measurement="continuity">Continuidad</button><button class="secondary" data-job-new-measurement="voltage">Tensión</button><button class="secondary" data-job-new-measurement="visual">Inspección</button><button class="secondary" id="open-job-srt-card">SRT 900/15</button></div></article><article class="job-content-card"><div class="job-content-head"><span class="module-icon">$</span><span class="job-content-count">${quotes.length} ${quotes.length===1?'presupuesto':'presupuestos'}</span></div><h3>Presupuestos</h3>${quotes.length?quotes.map(q=>`<p class="job-content-note">${esc(q.title||'Presupuesto')} · ${esc(q.number||'Sin número')}</p>`).join(''):'<p class="muted">Todavía no hay presupuestos vinculados a este trabajo.</p>'}</article><article class="job-content-card"><div class="job-content-head"><span class="module-icon">▦</span><span class="job-content-count">${materialLists.length} ${materialLists.length===1?'listado':'listados'}</span></div><h3>Materiales</h3>${materialLists.length?materialLists.map(x=>`<p class="job-content-note">${esc(x.title||'Listado sin título')} · ${Number(x.items?.length)||0} ítems</p>`).join(''):'<p class="muted">Todavía no hay listados vinculados a este trabajo.</p>'}</article><article class="job-content-card"><div class="job-content-head"><span class="module-icon">▤</span><span class="job-content-count">Documentación</span></div><h3>Informes y registros</h3><p class="muted">${protocols.length} protocolos SRT · ${calculations.length} cálculos DPMS · ${measurements.length} mediciones.</p><button class="secondary" id="open-job-documents">Ver documentación</button></article></div></section>
  <div class="detail-footer"><small>Creado: ${fmt(job.createdAt)}${job.updatedAt?` · Modificado: ${fmt(job.updatedAt)}`:''}</small><button class="danger" id="delete-job">Eliminar trabajo</button></div>`;
  root.querySelector('#back-job-list').onclick=refresh;
  root.querySelector('#open-job-dpms').onclick=()=>renderDPMS(root,job,()=>showJobDetail(root,jobs,clients,properties,id,refresh,goHome));
  root.querySelector('#open-job-measurements').onclick=()=>renderMeasurements(root,job,()=>showJobDetail(root,jobs,clients,properties,id,refresh,goHome));
  root.querySelectorAll('[data-job-new-measurement]').forEach(b=>b.onclick=()=>showMeasurementForm(root,job,null,()=>showJobDetail(root,jobs,clients,properties,id,refresh,goHome),b.dataset.jobNewMeasurement));
  root.querySelector('#open-job-srt-card').onclick=()=>renderSRT(root,job.id,()=>showJobDetail(root,jobs,clients,properties,id,refresh,goHome));
  root.querySelector('#open-job-documents').onclick=()=>renderDocumentsHub(root,goHome,jobId=>openJob(root,jobId,()=>renderDocumentsHub(root,goHome),goHome));
  root.querySelector('#edit-job').onclick=()=>showJobForm(root,job,clients,properties,null,async updated=>{Object.assign(job,updated);await put('jobs',job);await showJobDetail(root,jobs,clients,properties,id,refresh,goHome);});
  root.querySelector('#delete-job').onclick=async()=>deleteJobAndHistory(job,jobs,refresh);
}


async function deleteJobAndHistory(job,jobs,refresh){
  const [calculations,measurements,protocols,materialLists,quotes]=await Promise.all([all('dpms_calculations'),all('measurements'),all('srt_protocols'),all('material_lists'),all('labor_quotes')]);
  const related=calculations.filter(x=>x.jobId===job.id);
  const relatedMeasurements=measurements.filter(x=>x.jobId===job.id);
  const relatedProtocols=protocols.filter(x=>x.jobId===job.id);
  const relatedLists=materialLists.filter(x=>x.jobId===job.id);
  const relatedQuotes=quotes.filter(x=>x.jobId===job.id);
  if(relatedLists.length||relatedQuotes.length){alert(`No se puede eliminar este trabajo porque tiene ${relatedLists.length} listado(s) de materiales y ${relatedQuotes.length} presupuesto(s) vinculados. Reasigná esos documentos antes de eliminar la carpeta.`);return;}
  const warning=(related.length||relatedMeasurements.length||relatedProtocols.length)?` También se eliminarán ${related.length} cálculo(s) DPMS, ${relatedMeasurements.length} medición(es) y ${relatedProtocols.length} protocolo(s) SRT asociado(s).`:'';
  if(!confirm(`¿Eliminar definitivamente el trabajo «${job.code} · ${job.name}»?${warning} Esta acción no se puede deshacer.`))return;
  for(const record of related) await remove('dpms_calculations',record.id);
  for(const record of relatedMeasurements) await remove('measurements',record.id);
  for(const record of relatedProtocols) await remove('srt_protocols',record.id);
  await remove('jobs',job.id);
  const i=jobs.findIndex(x=>x.id===job.id);if(i>=0)jobs.splice(i,1);
  refresh();
}

function line(label,value){return value?`<div class="detail-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';}

function showJobForm(root,existing,clients,properties,selectedClientId,onSave){
  const v=existing||{}, overlay=document.createElement('div');overlay.className='modal-backdrop';
  const chosenClient=v.clientId||selectedClientId||clients[0]?.id||'';
  const clientOptions=clients.map(c=>`<option value="${esc(c.id)}" ${chosenClient===c.id?'selected':''}>${esc(clientName(c))}</option>`).join('');
  const propertyOptions=properties.filter(p=>p.clientId===chosenClient);
  overlay.innerHTML=`<form class="modal" id="job-form"><div class="modal-head"><div><p class="eyebrow">${existing?'ACTUALIZAR CARPETA':'NUEVA CARPETA'}</p><h2>${existing?'Editar trabajo':'Crear trabajo'}</h2></div><button type="button" class="icon-button" id="close-job" aria-label="Cerrar">✕</button></div>
  <label>Cliente asociado<select name="clientId" required ${existing?'disabled':''} ${clients.length?'':'disabled'}>${clientOptions}</select></label>
  ${!existing?'<button type="button" class="secondary" id="add-client-from-job">＋ Crear cliente</button>':''}
  <label>Inmueble asociado <span class="optional">(opcional)</span><select name="propertyId"><option value="">Sin inmueble asociado</option>${propertyOptions.map(p=>`<option value="${esc(p.id)}" ${v.propertyId===p.id?'selected':''}>${esc(p.name)}${p.address?' · '+esc(p.address):''}</option>`).join('')}</select></label>
  <label>Nombre del trabajo<input name="name" required maxlength="140" value="${esc(v.name)}" placeholder="Ej.: Instalación eléctrica vivienda"></label>
  <div class="form-grid"><label>Oficio / especialidad<select name="specialty">${existing?`<option value="${esc(v.specialty||'electricity')}">${esc(specialtyNames[v.specialty]||'Electricidad')}</option>`:`<option value="electricity" selected>Electricidad</option>`}</select><small class="optional">En esta etapa los nuevos trabajos se crean dentro del espacio de Electricidad.</small></label><label>Tipo de trabajo <span class="optional">(opcional)</span><input name="type" maxlength="100" value="${esc(v.type)}" placeholder="Instalación, reparación…"></label></div>
  <div class="form-grid"><label>Estado<select name="status">${Object.entries(statusNames).map(([k,n])=>`<option value="${k}" ${(v.status||'pending')===k?'selected':''}>${n}</option>`).join('')}</select></label><label>Fecha prevista <span class="optional">(opcional)</span><input type="date" name="expectedDate" value="${esc(v.expectedDate)}"></label></div>
  <label>Descripción <span class="optional">(opcional)</span><textarea name="description" rows="3" maxlength="1200">${esc(v.description)}</textarea></label>
  <label>Observaciones <span class="optional">(opcional)</span><textarea name="notes" rows="3" maxlength="1200">${esc(v.notes)}</textarea></label>
  <div class="modal-actions"><button type="button" class="secondary" id="cancel-job">Cancelar</button><button class="primary" type="submit">${existing?'Guardar cambios':'Crear trabajo'}</button></div></form>`;
  root.append(overlay);const form=overlay.querySelector('form'),close=()=>overlay.remove();
  overlay.querySelector('#close-job').onclick=close;overlay.querySelector('#cancel-job').onclick=close;
  const clientSelect=form.elements.clientId,propertySelect=form.elements.propertyId;
  overlay.querySelector('#add-client-from-job')?.addEventListener('click',()=>openClientForm(root,async client=>{
    await put('clients',client);clients.push(client);
    clientSelect.disabled=false;clientSelect.innerHTML=clients.map(c=>`<option value="${esc(c.id)}">${esc(clientName(c))}</option>`).join('');
    clientSelect.value=client.id;
    propertySelect.innerHTML='<option value="">Sin inmueble asociado</option>'+properties.filter(p=>p.clientId===client.id).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.address?' · '+esc(p.address):''}</option>`).join('');
    form.elements.name.focus();
  }));
  if(!existing)clientSelect.addEventListener('change',()=>{const current=properties.filter(p=>p.clientId===clientSelect.value);propertySelect.innerHTML='<option value="">Sin inmueble asociado</option>'+current.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.address?' · '+esc(p.address):''}</option>`).join('');});
  form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));if(!data.clientId){alert('Creá o seleccioná un cliente antes de guardar el trabajo.');return;}if(existing)data.clientId=existing.clientId;const now=new Date().toISOString();const job={...(existing||{}),...data,tradeId:existing?.tradeId||'electricity',id:existing?.id||crypto.randomUUID(),code:existing?.code||nextCode(),createdAt:existing?.createdAt||now,updatedAt:existing?now:null};await onSave(job);close();});
  form.elements.name.focus();
}
function nextCode(){const year=new Date().getFullYear();const nums=jobsCache.filter(j=>String(j.code||'').startsWith(`TR-${year}-`)).map(j=>Number(String(j.code).split('-').pop())||0);return `TR-${year}-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;}


const measurementTypeNames={pat:'Puesta a tierra (PAT)',insulation:'Resistencia de aislación',continuity:'Continuidad de conductores',rcd:'Ensayo de interruptor diferencial',polarity:'Polaridad',visual:'Inspección visual',voltage:'Tensión eléctrica',other:'Otra medición / inspección'};
const measurementStatusNames={draft:'Borrador',completed:'Completado',observed:'Con observaciones'};
const measurementDate=v=>v?new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(v+'T12:00:00')):'—';

async function renderMeasurements(root,job,back){
  const records=(await all('measurements')).filter(x=>x.jobId===job.id).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">${esc(job.code)} · CARPETA DE TRABAJO</p><h1>Mediciones e inspecciones</h1><p class="muted">Registros técnicos asociados a este trabajo. Editar actualiza el mismo registro.</p></div><div class="heading-actions"><button class="secondary" id="back-measurements">← Carpeta</button><button class="secondary" id="open-job-srt">Protocolo SRT 900/15</button><button class="primary" id="new-measurement">＋ Nuevo registro</button></div></div>
  <section class="panel"><div class="section-title"><div><h2>Registros guardados</h2><p class="muted">${records.length} ${records.length===1?'registro':'registros'}</p></div></div><div id="measurement-list">${records.length?records.map(r=>`<div class="history-row measurement-row"><div><strong>${esc(r.title)}</strong><small>${esc(measurementTypeNames[r.type]||'Medición')} · ${esc(measurementDate(r.date))} · ${esc(measurementStatusNames[r.status]||'Borrador')}</small></div><div class="history-actions"><button class="secondary" data-view-measurement="${esc(r.id)}">Abrir</button><button class="secondary" data-edit-measurement="${esc(r.id)}">Editar</button><button class="danger" data-delete-measurement="${esc(r.id)}">Eliminar</button></div></div>`).join(''):`<div class="empty"><div class="empty-icon">▧</div><strong>Todavía no hay registros</strong><p>Creá una medición o inspección para este trabajo.</p></div>`}</div></section>`;
  root.querySelector('#back-measurements').onclick=back;
  root.querySelector('#open-job-srt').onclick=()=>renderSRT(root,job.id,()=>renderMeasurements(root,job,back));
  root.querySelector('#new-measurement').onclick=()=>showMeasurementForm(root,job,null,()=>renderMeasurements(root,job,back));
  root.querySelectorAll('[data-view-measurement]').forEach(b=>b.onclick=()=>showMeasurementDetail(root,job,records.find(r=>r.id===b.dataset.viewMeasurement),()=>renderMeasurements(root,job,back)));
  root.querySelectorAll('[data-edit-measurement]').forEach(b=>b.onclick=()=>showMeasurementForm(root,job,records.find(r=>r.id===b.dataset.editMeasurement),()=>renderMeasurements(root,job,back)));
  root.querySelectorAll('[data-delete-measurement]').forEach(b=>b.onclick=async()=>{const r=records.find(x=>x.id===b.dataset.deleteMeasurement);if(r&&confirm(`¿Eliminar el registro «${r.title}»?`)){await remove('measurements',r.id);renderMeasurements(root,job,back);}});
}

export async function renderMeasurementsHub(root, goHome = () => {}, goJobs = () => {}) {
  const [records, jobs, clients, properties, protocols] = await Promise.all([all('measurements'), all('jobs'), all('clients'), all('properties'), all('srt_protocols')]);
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const propertyMap = new Map(properties.map(p => [p.id, p]));
  const sorted = records.slice().sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  const tiles = [
    ['pat','⏚','Puesta a tierra (PAT)','Resistencia de puesta a tierra y métodos de medición'],
    ['rcd','IΔn','Interruptores diferenciales','Ensayos 0,5×, 1×, 5× y prueba de rampa'],
    ['insulation','MΩ','Resistencia de aislación','Ensayos con megóhmetro y tensiones de prueba'],
    ['continuity','Ω↔','Continuidad eléctrica','Conductores de protección y equipotencialidad'],
    ['voltage','V~','Tensión y parámetros eléctricos','Tensiones, frecuencia y secuencia de fases'],
    ['visual','☑','Inspección visual','Verificación de componentes y condiciones de seguridad']
  ];
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MÓDULO TÉCNICO</p><h1>Mediciones e inspecciones</h1><p class="muted">Elegí directamente el ensayo que necesitás realizar. Cada registro queda vinculado a un trabajo.</p></div><button class="secondary" id="back-measurements-hub">← Inicio</button></div>
  <div class="section-title"><div><h2>Nuevo ensayo o inspección</h2><p class="muted">Acceso directo por tipo de medición.</p></div></div>
  <section class="module-grid measurement-type-grid">${tiles.map(([id,icon,title,desc])=>`<button class="module-card" data-new-type="${id}"><span class="module-icon">${icon}</span><strong>${title}</strong><small>${desc}</small><span class="card-arrow">＋</span></button>`).join('')}
  <button class="module-card srt-module-card" id="open-srt-protocol"><span class="module-icon">▤</span><strong>Protocolo SRT 900/15</strong><small>Completar, guardar e imprimir el protocolo oficial de puesta a tierra y continuidad de masas.</small><span class="card-arrow">→</span></button></section>
  <section class="panel" style="margin-top:22px"><div class="section-title"><div><h2>Historial de mediciones</h2><p class="muted">${sorted.length} ${sorted.length===1?'registro':'registros'} en ${jobs.length} ${jobs.length===1?'trabajo':'trabajos'} · ${protocols.length} ${protocols.length===1?'protocolo':'protocolos'} SRT</p></div><div class="heading-actions"><button class="secondary" id="select-all-measurements">Seleccionar todos</button><button class="primary" id="export-selected-measurements" disabled>Generar PDF (0)</button></div></div><p class="muted">Generá informes PDF individuales o reuní varios ensayos en un único documento. Cada informe incluye los datos del cliente, inmueble, trabajo, instrumento y resultados técnicos.</p><div class="client-list">${sorted.length?sorted.map(r=>{const j=jobMap.get(r.jobId),c=j?clientMap.get(j.clientId):null;return `<div class="history-row measurement-row"><label class="measurement-export-select"><input type="checkbox" data-select-measurement="${esc(r.id)}" aria-label="Seleccionar ${esc(r.title)} para exportar"></label><div><strong>${esc(r.title)}</strong><small>${esc(measurementTypeNames[r.type]||'Medición')} · ${esc(measurementDate(r.date))} · ${esc(j?.code||'Trabajo no disponible')} · ${esc(j?.name||'')}</small><small>${esc(clientName(c))} · ${esc(measurementStatusNames[r.status]||'Borrador')}</small></div><div class="history-actions"><button class="secondary" data-export-one-measurement="${esc(r.id)}">PDF</button><button class="secondary" data-open-measurement-job="${esc(r.jobId)}">Abrir trabajo</button></div></div>`;}).join(''):`<div class="empty"><div class="empty-icon">▧</div><strong>Todavía no hay mediciones cargadas</strong><p>Elegí uno de los ensayos de arriba para comenzar.</p></div>`}</div></section>`;
  root.querySelector('#back-measurements-hub').onclick=goHome;
  root.querySelector('#open-srt-protocol').onclick=()=>renderSRT(root,null,()=>renderMeasurementsHub(root,goHome,goJobs));
  root.querySelectorAll('[data-new-type]').forEach(b=>b.onclick=()=>chooseJobForMeasurement(root,jobs,b.dataset.newType,()=>renderMeasurementsHub(root,goHome,goJobs)));
  root.querySelectorAll('[data-open-measurement-job]').forEach(b=>b.onclick=()=>{const job=jobMap.get(b.dataset.openMeasurementJob);if(job)renderMeasurements(root,job,()=>renderMeasurementsHub(root,goHome,goJobs));});
  const checks=[...root.querySelectorAll('[data-select-measurement]')],exportButton=root.querySelector('#export-selected-measurements'),selectAll=root.querySelector('#select-all-measurements');
  const updateExportSelection=()=>{const selected=checks.filter(x=>x.checked).length;exportButton.disabled=!selected;exportButton.textContent=`Generar PDF (${selected})`;selectAll.textContent=selected===checks.length&&checks.length?'Quitar selección':'Seleccionar todos';};
  checks.forEach(x=>x.addEventListener('change',updateExportSelection));
  selectAll.onclick=()=>{const select=checks.some(x=>!x.checked);checks.forEach(x=>x.checked=select);updateExportSelection();};
  exportButton.onclick=()=>{const selected=records.filter(r=>checks.some(x=>x.checked&&x.dataset.selectMeasurement===r.id));openMeasurementsPDF(selected,jobMap,clientMap,propertyMap);};
  root.querySelectorAll('[data-export-one-measurement]').forEach(b=>b.onclick=()=>{const record=records.find(r=>r.id===b.dataset.exportOneMeasurement);if(record)openMeasurementsPDF([record],jobMap,clientMap,propertyMap);});
}

async function openMeasurementsPDF(records,jobMap,clientMap,propertyMap){
  if(!records.length)return;
  const settings=await all('settings');
  const identity=settings.find(x=>x.key==='identity')?.value||{};
  const fmtValue=value=>{
    if(value===null||value===undefined||value==='')return '—';
    if(Array.isArray(value))return value.map(fmtValue).join(' · ');
    if(typeof value==='object')return Object.entries(value).filter(([,v])=>v!==''&&v!==null&&v!==undefined).map(([k,v])=>`${k}: ${fmtValue(v)}`).join(' | ')||'—';
    return String(value);
  };
  const row=(label,value)=>value!==undefined&&value!==null&&value!==''?`<div class="data-row"><span>${esc(label)}</span><strong>${esc(fmtValue(value))}</strong></div>`:'';
  const reports=records.map((r,index)=>{
    const job=jobMap.get(r.jobId)||{},client=clientMap.get(job.clientId)||{},property=propertyMap.get(job.propertyId)||{},snapshot=r.instrumentSnapshot||{},tech=r.technical||{},cfg=technicalForms[r.type]||technicalForms.other;
    const technical=cfg.fields.map(f=>row(f[1],tech[f[0]]!==undefined&&tech[f[0]]!==''?(f[2]==='number'&&f[3]?`${tech[f[0]]} ${f[3]}`:tech[f[0]]):'')).join('');
    const rcdTests=r.type==='rcd'?(tech.rcdTests||[]):[];
    const rcdHtml=rcdTests.length?`<section><h2>Matriz de ensayos diferenciales</h2><div class="test-grid">${rcdTests.map((t,i)=>`<article class="test-card"><h3>Ensayo ${i+1} · ${esc(t.testMode||'Prueba')}</h3><div class="data-grid">${row('Forma de onda',t.wave||tech.testWave)}${row('Polaridad',t.polarity)}${row('Multiplicador',t.testMultiplier)}${row('Corriente aplicada',t.appliedCurrent!==undefined&&t.appliedCurrent!==''?`${t.appliedCurrent} mA`:'')}${row('Tiempo 0°',t.time0!==undefined&&t.time0!==''?`${t.time0} ms`:'')}${row('Tiempo 180°',t.time180!==undefined&&t.time180!==''?`${t.time180} ms`:'')}${row('Máximo / esperado',t.maxTime)}${row('Evaluación',t.evaluation)}</div></article>`).join('')}</div>${tech.rcdRamp?`<h3>Ensayo de rampa independiente</h3><div class="data-grid">${row('Corriente de disparo',tech.rcdRamp.tripCurrent!==undefined?`${tech.rcdRamp.tripCurrent} mA`:'')}${row('Tiempo',tech.rcdRamp.tripTime!==undefined?`${tech.rcdRamp.tripTime} ms`:'')}${row('Evaluación',tech.rcdRamp.evaluation)}</div>`:''}</section>`:'';
    return `<article class="report ${index?'page-break':''}"><header class="report-header"><div class="brand"><div class="brand-name">${esc(identity.tradeName||identity.name||'SIGESTEC')}</div><div class="brand-sub">${esc(identity.name||'Informe técnico de electricidad')}</div></div><div class="report-tag">INFORME TÉCNICO</div><h1>${esc(r.title||cfg.title)}</h1><p class="subtitle">${esc(measurementTypeNames[r.type]||'Medición')} · ${esc(measurementDate(r.date))}</p><div class="status">${esc(measurementStatusNames[r.status]||'Borrador')}</div></header>
      <section><h2>Identificación del trabajo</h2><div class="data-grid">${row('Código',job.code)}${row('Trabajo',job.name)}${row('Especialidad',specialtyNames[job.specialty]||'Electricidad')}${row('Estado del trabajo',statusNames[job.status])}${row('Cliente',clientName(client))}${row('Documento / CUIT',client.document||client.taxId)}${row('Teléfono',client.phone)}${row('Correo electrónico',client.email)}${row('Inmueble',property.name)}${row('Dirección',[property.address,property.locality,property.province].filter(Boolean).join(', '))}</div></section>
      <section><h2>Datos del ensayo</h2><div class="data-grid">${row('Fecha de medición',measurementDate(r.date))}${row('Instrumento',r.instrument||snapshot.name)}${row('Marca',r.instrumentBrand||snapshot.brand)}${row('Modelo',r.instrumentModel||snapshot.model)}${row('Número de serie',r.serial||snapshot.serial)}${row('Rango',snapshot.range)}${row('Última calibración',snapshot.calibrationDate)}${row('Vencimiento de calibración',snapshot.calibrationDue)}${row('Condiciones',r.conditions)}</div></section>
      <section><h2>Parámetros y resultados registrados</h2>${technical?`<div class="data-grid">${technical}</div>`:'<p class="muted">No se registraron parámetros técnicos adicionales.</p>'}</section>${rcdHtml}
      ${row('Observaciones',r.observations)?`<section><h2>Observaciones</h2><p>${esc(r.observations)}</p></section>`:''}
      <section class="professional"><h2>Profesional interviniente</h2><div class="data-grid">${row('Nombre / razón social',identity.name)}${row('Nombre comercial',identity.tradeName)}${row('CUIT / DNI',identity.taxId)}${row('Teléfono',identity.phone)}${row('Correo electrónico',identity.email)}</div><div class="signature"><span>Firma y aclaración</span><span>Fecha</span></div></section>
      <footer>Generado por SIGESTEC · ${new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date())} · Registro ${esc(r.id)}</footer></article>`;
  }).join('');
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informes técnicos SIGESTEC</title><style>
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b45;margin:0;background:#fff;font-size:10pt;line-height:1.4}.report{padding:12mm 13mm 15mm;max-width:210mm;margin:0 auto}.page-break{break-before:page;page-break-before:always}.report-header{border-bottom:2px solid #1769aa;padding-bottom:7mm;margin-bottom:7mm;position:relative}.brand{margin-bottom:7mm}.brand-name{font-size:15pt;font-weight:700;color:#123b62}.brand-sub{font-size:8.5pt;color:#64748b}.report-tag{position:absolute;right:0;top:0;color:#1769aa;font-size:8pt;font-weight:700;letter-spacing:1px}.report h1{font-size:20pt;margin:0 0 2mm;color:#123b62}.subtitle{margin:0;color:#52677e}.status{display:inline-block;margin-top:3mm;padding:1.5mm 3mm;background:#edf4fa;border-radius:3mm;font-size:8pt;font-weight:700}section{margin:0 0 7mm;break-inside:avoid}h2{font-size:11pt;color:#1769aa;border-bottom:1px solid #d7e2ec;padding-bottom:2mm;margin:0 0 3mm}h3{font-size:9pt;margin:0 0 2mm;color:#23496d}.data-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 7mm}.data-row{display:flex;justify-content:space-between;gap:4mm;padding:1.6mm 0;border-bottom:1px solid #edf1f5;min-width:0}.data-row span{color:#65778b;flex:0 0 42%}.data-row strong{font-weight:600;text-align:right;overflow-wrap:anywhere;flex:1}.test-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.test-card{border:1px solid #dce5ed;border-radius:2mm;padding:3mm;break-inside:avoid}.test-card .data-grid{grid-template-columns:1fr}.test-card .data-row{padding:1mm 0}.professional{margin-top:10mm}.signature{display:flex;justify-content:space-between;gap:20mm;margin-top:15mm}.signature span{border-top:1px solid #52677e;padding-top:2mm;flex:1;text-align:center;font-size:8pt;color:#52677e}footer{border-top:1px solid #d7e2ec;padding-top:2mm;margin-top:8mm;color:#78899b;font-size:7.5pt;text-align:center}.muted{color:#64748b}@page{size:A4 portrait;margin:0} @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.report{max-width:none;margin:0}.page-break{break-before:page;page-break-before:always}button{display:none}}
  </style></head><body>${reports}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`;
  const w=window.open('','_blank');
  if(!w){alert('El navegador bloqueó la ventana del informe. Permití ventanas emergentes para SIGESTEC y volvé a intentarlo.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

function chooseJobForMeasurement(root,jobs,type,onDone){
  if(!jobs.length){alert('Primero necesitás crear un trabajo. Después vas a poder cargar el ensayo directamente desde acá.');return;}
  const overlay=document.createElement('div');overlay.className='modal-backdrop';
  overlay.innerHTML=`<section class="modal"><div class="modal-head"><div><p class="eyebrow">NUEVO ENSAYO</p><h2>¿A qué trabajo lo asociamos?</h2><p class="muted">Elegí la carpeta y se abrirá directamente el formulario de ${esc(measurementTypeNames[type])}.</p></div><button class="icon-button" id="close-job-choice">✕</button></div><label>Trabajo<select id="measurement-job-choice">${jobs.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(j=>`<option value="${esc(j.id)}">${esc(j.code)} · ${esc(j.name)}</option>`).join('')}</select></label><div class="modal-actions"><button class="secondary" id="cancel-job-choice">Cancelar</button><button class="primary" id="continue-job-choice">Continuar →</button></div></section>`;
  root.append(overlay);const close=()=>overlay.remove();overlay.querySelector('#close-job-choice').onclick=close;overlay.querySelector('#cancel-job-choice').onclick=close;overlay.querySelector('#continue-job-choice').onclick=()=>{const job=jobs.find(j=>j.id===overlay.querySelector('#measurement-job-choice').value);if(!job)return;close();showMeasurementForm(root,job,null,()=>{onDone();},type);};
}

function showMeasurementDetail(root,job,r,back){if(!r)return;const cfg=technicalForms[r.type]||technicalForms.other,tech=r.technical||{};const technicalRows=cfg.fields.map(f=>{const value=tech[f[0]];return value!==undefined&&value!==''?line(f[1],value+(f[3]&&f[2]==='number'?' '+f[3]:'')):''}).join('');const rcdTests=r.type==='rcd'?(tech.rcdTests||[]):[];const rcdTestsHtml=r.type==='rcd'?`<section class="panel" style="margin-top:16px"><h2>Matriz de ensayos · ${rcdTests.length} filas</h2>${rcdTests.length?`<div class="table-wrap"><table class="data-table rcd-matrix"><thead><tr><th>Forma de onda</th><th>Polaridad</th><th>Prueba</th><th>Multiplicador</th><th>Corriente aplicada (mA)</th><th>Tiempo 0° (ms)</th><th>Tiempo 180° (ms)</th><th>Máximo / esperado</th><th>Evaluación</th></tr></thead><tbody>${rcdTests.map(t=>`<tr><td>${esc(t.wave||tech.testWave||'')}</td><td>${esc(t.polarity||'')}</td><td>${esc(t.testMode||'')}</td><td>${esc(t.testMultiplier||'')}</td><td>${esc(t.appliedCurrent||'')}</td><td>${esc(t.time0||'')}</td><td>${esc(t.time180||'')}</td><td>${esc(t.maxTime||'')}</td><td>${esc(t.evaluation||'')}</td></tr>`).join('')}</tbody></table></div><p class="muted">Forma de corriente residual: ${esc(tech.testWave||'No especificada')} · Límite Uc: ${esc(tech.touchVoltageLimit||'No especificado')} · Norma: ${esc(tech.standardReference||'No especificada')}</p>${tech.rcdRamp?`<h3>Ensayo de rampa independiente</h3><p>Corriente de disparo: ${esc(tech.rcdRamp.tripCurrent||'—')} mA · Tiempo: ${esc(tech.rcdRamp.tripTime||'—')} ms · Evaluación: ${esc(tech.rcdRamp.evaluation||'No evaluado')}</p>`:''}`:'<p class="muted">Todavía no se cargaron ensayos.</p>'}</section>`:'';root.innerHTML=`<div class="page-heading"><div><p class="eyebrow">${esc(job.code)} · REGISTRO TÉCNICO</p><h1><span class="measurement-symbol">${cfg.symbol}</span> ${esc(r.title)}</h1><p class="muted">${esc(measurementTypeNames[r.type]||'Medición')} · ${esc(measurementDate(r.date))}</p></div><div class="heading-actions"><button class="secondary" id="back-records">← Registros</button><button class="primary" id="edit-record">Editar ensayo</button></div></div><section class="detail-grid"><article class="panel detail-panel"><h2>Datos del ensayo</h2>${line('Estado',measurementStatusNames[r.status])}${line('Fecha',measurementDate(r.date))}${line('Instrumento',r.instrument)}${line('Marca / modelo',r.instrumentModel)}${line('N.º de serie',r.serial)}${r.instrumentSnapshot?line('Rango del instrumento',r.instrumentSnapshot.range):''}${r.instrumentSnapshot?.calibrationDue?line('Vencimiento de calibración',r.instrumentSnapshot.calibrationDue):''}${line('Condiciones',r.conditions)}</article><article class="panel detail-panel"><h2>Configuración y resultados específicos</h2>${technicalRows||'<p class="muted">Todavía no hay parámetros técnicos cargados.</p>'}</article></section>${rcdTestsHtml}${r.observations?`<section class="panel"><h2>Observaciones</h2><p>${esc(r.observations)}</p></section>`:''}<div class="detail-footer"><small>Creado: ${fmt(r.createdAt)} · Modificado: ${fmt(r.updatedAt||r.createdAt)}</small><button class="secondary" id="print-record">Imprimir / PDF</button></div>`;root.querySelector('#back-records').onclick=back;root.querySelector('#edit-record').onclick=()=>showMeasurementForm(root,job,r,back);root.querySelector('#print-record').onclick=async()=>{const [jobs,clients,properties]=await Promise.all([all('jobs'),all('clients'),all('properties')]);const jobMap=new Map(jobs.map(x=>[x.id,x])),clientMap=new Map(clients.map(x=>[x.id,x])),propertyMap=new Map(properties.map(x=>[x.id,x]));openMeasurementsPDF([r],jobMap,clientMap,propertyMap);};}

const technicalForms={
 pat:{title:'Puesta a tierra (PAT)',symbol:'⏚',intro:'Ensayo de resistencia de puesta a tierra. La resistividad del suelo se registra como estudio separado.',fields:[
  ['method','Método de medición','select',['Caída de potencial (3 puntos)','Método del 62 %','Selectivo con pinza y picas','Pinza telurimétrica','Medición de continuidad del conductor de tierra','Otro']],
  ['earthResistance','Resistencia medida de PAT','number','Ω'],['patCriterion','Criterio normativo aplicado','select',['AEA 90364-7-770/2026 · máximo 100 Ω (cuando corresponda)','AEA 90364-7-771 / SRT 900/15 · referencia 40 Ω (verificar ámbito y condición)','Otro criterio documentado']],['expectedResistance','Resistencia máxima admisible según criterio seleccionado','number','Ω'],['electrodeCount','Cantidad de electrodos','number',''],['electrodeType','Tipo de electrodo','text'],['electrodeLength','Longitud del electrodo','number','m'],['auxDistance','Distancia a pica auxiliar','number','m'],['soilCondition','Condición del terreno','select',['Seco','Húmedo','Saturado','Rocoso','Relleno','Otro']],['soilResistivity','Resistividad del suelo (si se midió)','number','Ω·m'],['soilMethod','Método de resistividad','select',['Wenner 4 puntas','Schlumberger','Otro']],['measurementRepeat','Lecturas / repetición','textarea'],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]
 ]},
 rcd:{title:'Interruptores diferenciales (RCD)',symbol:'IΔn',intro:'Identificá el interruptor diferencial una sola vez y agregá todos los ensayos realizados. Cada prueba queda guardada como una fila independiente dentro del mismo registro.',fields:[
  ['rcdType','Tipo de diferencial','select',['AC','A','F','B']],['ratedCurrent','Corriente diferencial asignada IΔn','number','mA'],['ratedVoltage','Tensión asignada Un','number','V'],['poles','Polos','select',['2P','4P','1P+N','Otros']],['manufacturer','Fabricante','text'],['model','Modelo / referencia','text'],['deviceId','Identificación del ID / circuito','text']
 ]},
 insulation:{title:'Resistencia de aislación',symbol:'MΩ',intro:'Ensayo con megóhmetro. Definí tensión de prueba y puntos de medición; el criterio depende del circuito y la norma aplicable.',fields:[
  ['circuit','Circuito / elemento ensayado','text'],['nominalVoltage','Tensión nominal del circuito','number','V'],['testVoltage','Tensión de ensayo','select',['250 V','500 V','1000 V','2500 V','5000 V','Otra']],['testDuration','Duración del ensayo','number','s'],['testConnection','Conexión / pares ensayados','text'],['insulationValue','Resistencia de aislación medida','number','MΩ'],['expectedMinimum','Resistencia mínima esperada','number','MΩ'],['temperature','Temperatura','number','°C'],['humidity','Humedad relativa','number','%'],['discharge','Descarga posterior verificada','select',['Sí','No','No aplica']],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]
 ]},
 continuity:{title:'Continuidad eléctrica',symbol:'Ω↔',intro:'Verificación de continuidad de conductores de protección y enlaces equipotenciales.',fields:[
  ['conductor','Conductor / enlace ensayado','text'],['originPoint','Punto de origen','text'],['endPoint','Punto de destino','text'],['testCurrent','Corriente de ensayo','number','mA'],['openVoltage','Tensión en vacío del instrumento','number','V'],['leadCompensation','Compensación de puntas','select',['Realizada','No realizada','No aplica']],['resistance','Resistencia medida','number','Ω'],['expectedMaximum','Resistencia máxima / criterio esperado','number','Ω'],['polarity','Polaridad de medición','select',['Directa','Inversa','Ambas','No aplica']],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]
 ]},
 voltage:{title:'Tensión y parámetros eléctricos',symbol:'V~',intro:'Mediciones de tensión, frecuencia, secuencia y polaridad.',fields:[
  ['phaseNeutral','Tensión fase-neutro','number','V'],['phaseEarth','Tensión fase-tierra','number','V'],['neutralEarth','Tensión neutro-tierra','number','V'],['phasePhase','Tensión entre fases','number','V'],['frequency','Frecuencia','number','Hz'],['phaseSequence','Secuencia de fases','select',['L1-L2-L3','L1-L3-L2','Incorrecta / otra','No aplica']],['polarity','Polaridad','select',['Correcta','Invertida','No aplica']],['expectedRange','Rango esperado / tolerancia','text'],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]
 ]},
 visual:{title:'Inspección visual',symbol:'☑',intro:'Lista de verificación documentada. Cada ítem debe poder justificarse con observaciones o evidencia.',fields:[
  ['area','Sector / tablero / instalación','text'],['item','Elemento inspeccionado','text'],['condition','Condición observada','select',['Conforme','No conforme','No aplica','No verificado']],['defect','Defecto / riesgo identificado','textarea'],['recommendation','Acción correctiva recomendada','textarea'],['photoNotes','Referencia de fotografías / evidencias','textarea'],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación general','select',['Conforme','No conforme','Con observaciones','No evaluado']]
 ]},
 polarity:{title:'Polaridad',symbol:'±',intro:'Comprobación de polaridad y correspondencia de conductores.',fields:[['testPoint','Punto / circuito','text'],['resultPolarity','Resultado','select',['Correcta','Invertida','Indeterminada']],['measuredVoltage','Tensión medida','number','V'],['expectedResult','Resultado esperado','text'],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]]},
 other:{title:'Otra medición / inspección',symbol:'∿',intro:'Registro técnico complementario.',fields:[['method','Método / procedimiento','text'],['measuredValue','Resultado medido','text'],['expectedResult','Resultado esperado','text'],['standardReference','Norma, edición y cláusula aplicada','text'],['evaluation','Evaluación técnica','select',['Conforme','No conforme','No evaluado']]]}
};
function technicalField(field,value){const [name,label,type,extra]=field,unit=type==='number'?extra:'';if(type==='select')return `<label>${label}<select data-tech="${name}"><option value="">Seleccionar…</option>${extra.map(x=>`<option value="${esc(x)}" ${value===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;if(type==='textarea')return `<label class="full-field">${label}<textarea data-tech="${name}" rows="2">${esc(value||'')}</textarea></label>`;return `<label>${label}${unit?` <span class="optional">(${unit})</span>`:''}<input data-tech="${name}" type="${type}" value="${esc(value||'')}" ${type==='number'?'step="any"':''}></label>`;}
function rcdWaveProfiles(type){
 const base=[{wave:'CA sinusoidal',polarity:'Alterna',key:'ac'}];
 if(type==='A'||type==='F'||type==='B')base.push({wave:'CC pulsante',polarity:'Positiva',key:'pulse+'},{wave:'CC pulsante',polarity:'Negativa',key:'pulse-'});
 if(type==='F')base.push({wave:'Frecuencia mixta (compuesta)',polarity:'Según forma de onda',key:'mixed'});
 if(type==='B')base.push({wave:'CC lisa',polarity:'Positiva',key:'smooth+'},{wave:'CC lisa',polarity:'Negativa',key:'smooth-'});
 return base;
}
function rcdDefaultRows(type){
 const multipliers=['0,5 × IΔn (no disparo)','1 × IΔn','2 × IΔn','5 × IΔn'];
 return rcdWaveProfiles(type).flatMap(profile=>multipliers.map((mode,i)=>({testMode:mode,testMultiplier:['0,5×','1×','2×','5×'][i],wave:profile.wave,polarity:profile.polarity,maxTime:profile.key==='ac'?(i===0?'No debe disparar':i===1?'300 ms':i===2?'150 ms':'40 ms'):'Según IEC 62423 / norma de producto y método de ensayo'})));
}
function rcdMatrixRow(test={},index=0){
 const val=(key)=>esc(test[key]??'');
 const mode=test.testMode||'Ensayo adicional';
 return `<tr class="rcd-matrix-row" data-rcd-row>
 <td><input data-rcd-test="wave" value="${val('wave')}" aria-label="Forma de onda" readonly></td>
 <td><input data-rcd-test="polarity" value="${val('polarity')}" aria-label="Polaridad" readonly></td>
 <td><input data-rcd-test="testMode" value="${esc(mode)}" aria-label="Tipo de ensayo"></td>
 <td><input data-rcd-test="testMultiplier" value="${val('testMultiplier')}" aria-label="Multiplicador"></td>
 <td><input data-rcd-test="appliedCurrent" type="number" step="any" value="${val('appliedCurrent')}" placeholder="mA"></td>
 <td><input data-rcd-test="time0" type="number" step="any" value="${val('time0')}" placeholder="ms"></td>
 <td><input data-rcd-test="time180" type="number" step="any" value="${val('time180')}" placeholder="ms"></td>
 <td><input data-rcd-test="maxTime" type="text" value="${val('maxTime')}" aria-label="Límite de referencia"></td>
 <td><select data-rcd-test="evaluation"><option value="">Evaluar</option>${['Conforme','No conforme','No evaluado','No aplica'].map(x=>`<option ${test.evaluation===x?'selected':''}>${x}</option>`).join('')}</select></td>
 <td><button type="button" class="danger" data-remove-rcd-row aria-label="Quitar fila">×</button></td></tr>`;
}
function rcdMatrixHtml(tests=[],type='AC',tech={}){
 const profiles=rcdWaveProfiles(type),defaults=rcdDefaultRows(type);
 // Mergear filas guardadas con la matriz mínima que corresponde al tipo actual.
 // Los ensayos anteriores se conservan y las nuevas formas de onda aparecen vacías.
 const saved=tests.map(t=>({...t,wave:t.wave||tech.testWave||'CA sinusoidal',polarity:t.polarity||'Alterna'}));
 const savedByKey=new Map(saved.map(t=>[`${t.wave}|${t.polarity}|${t.testMultiplier}`,t]));
 const rows=defaults.map(t=>({...t,...(savedByKey.get(`${t.wave}|${t.polarity}|${t.testMultiplier}`)||{})}));
 const known=new Set(rows.map(t=>`${t.wave}|${t.polarity}|${t.testMultiplier}`));
 for(const t of saved)if(!known.has(`${t.wave}|${t.polarity}|${t.testMultiplier}`))rows.push(t);
 return `<section class="technical-fields rcd-tests-section"><div class="section-title"><div><h3>Matriz de ensayos del diferencial</h3><p class="muted">La matriz se adapta al tipo de diferencial. Las formas de onda y polaridades habilitadas se generan según la clase seleccionada.</p></div><button type="button" class="primary" id="add-rcd-test">＋ Agregar ensayo adicional</button></div>
 <div class="form-grid rcd-global-settings"><label>Límite de tensión de contacto Uc (ajuste del instrumento; no es tensión nominal ni tensión de ensayo)<select data-rcd-global="touchVoltageLimit"><option>25 V</option><option>50 V</option><option>Otro / no aplica</option></select></label><label>Norma / edición / cláusula de referencia<input data-rcd-global="standardReference" value="${esc(tech.standardReference||'')}" placeholder="IEC 61008-1 / IEC 61009-1 / IEC 62423"></label></div>
 <div class="table-wrap"><table class="data-table rcd-matrix"><thead><tr><th>Forma de onda</th><th>Polaridad</th><th>Ensayo</th><th>× IΔn</th><th>Corriente aplicada (mA)</th><th>0° (ms)</th><th>180° (ms)</th><th>Máximo / esperado</th><th>Evaluación</th><th></th></tr></thead><tbody id="rcd-test-list">${rows.map((t,i)=>rcdMatrixRow(t,i)).join('')}</tbody></table></div><p class="muted" id="rcd-test-count">${rows.length} filas · Los límites de CC pulsante, CC lisa y frecuencia mixta dependen del ensayo normativo específico y del instrumento; no se extrapolan los tiempos de CA sinusoidal.</p>
 <section class="rcd-ramp-panel"><div class="section-title"><div><h3>Ensayo de rampa</h3><p class="muted">Función independiente de la matriz por multiplicador. Seleccioná la forma de onda y polaridad admitidas por el instrumento.</p></div></div><div class="form-grid"><label>Forma de corriente residual<select data-rcd-ramp="wave">${profiles.map(p=>`<option>${esc(p.wave)} · ${esc(p.polarity)}</option>`).join('')}</select></label><label>Corriente inicial (mA)<input data-rcd-ramp="startCurrent" type="number" step="any" placeholder="mA"></label><label>Corriente final (mA)<input data-rcd-ramp="endCurrent" type="number" step="any" placeholder="mA"></label><label>Incremento / resolución (mA)<input data-rcd-ramp="stepCurrent" type="number" step="any" placeholder="mA"></label><label>Corriente real de disparo (mA)<input data-rcd-ramp="tripCurrent" type="number" step="any" placeholder="mA"></label><label>Tiempo de disparo (ms)<input data-rcd-ramp="tripTime" type="number" step="any" placeholder="ms"></label><label>Evaluación<select data-rcd-ramp="evaluation"><option value="">Evaluar</option><option>Conforme</option><option>No conforme</option><option>No evaluado</option></select></label></div></section>
 <div class="form-grid"><label>Observaciones de la batería<input data-rcd-global="matrixNotes" value="${esc(tech.matrixNotes||'')}"></label></div></section>`;
}
function instrumentCategoryForType(type){return ({pat:['pat'],insulation:['insulation'],rcd:['rcd'],continuity:['continuity'],voltage:['voltage','clamp','phase'],polarity:['voltage','phase'],visual:['other'],other:['other']})[type]||['other'];}
async function showMeasurementForm(root,job,existing,onDone,presetType=null){const availableInstruments=(await all('instruments')).filter(x=>x.active!==false);const v=existing||{},type=existing?.type||presetType||'pat',cfg=technicalForms[type]||technicalForms.other,tech=v.technical||{},overlay=document.createElement('div');overlay.className='modal-backdrop';
 const oldRcdTest=type==='rcd'&&!tech.rcdTests?.length&&(tech.testMode||tech.tripTime||tech.rampTrip)?[{...tech}]:[];
 const rcdTests=type==='rcd'?(tech.rcdTests||oldRcdTest):[];
 overlay.innerHTML=`<form class="modal measurement-specialized-form" id="measurement-form"><div class="modal-head"><div><p class="eyebrow">${existing?'ACTUALIZAR ENSAYO':'NUEVO ENSAYO'} · ${esc(job.code)}</p><h2><span class="measurement-symbol">${cfg.symbol}</span>${cfg.title}</h2><p class="muted">${cfg.intro}</p></div><button type="button" class="icon-button" id="close-measurement">✕</button></div>
 <input type="hidden" name="type" value="${esc(type)}"><div class="form-grid"><label>Nombre del registro<input name="title" required maxlength="140" value="${esc(v.title||cfg.title)}" placeholder="Identificación del ensayo"></label><label>Fecha<input type="date" name="date" required value="${esc(v.date||new Date().toISOString().slice(0,10))}"></label></div>
 <div class="form-grid"><label>Estado<select name="status">${Object.entries(measurementStatusNames).map(([k,n])=>`<option value="${k}" ${(v.status||'draft')===k?'selected':''}>${n}</option>`).join('')}</select></label><label>Instrumento de la biblioteca<select name="instrumentId" id="measurement-instrument"><option value="">Carga manual / sin instrumento registrado</option>${availableInstruments.filter(i=>(i.categories||[]).some(c=>instrumentCategoryForType(type).includes(c))).map(i=>`<option value="${esc(i.id)}" ${v.instrumentId===i.id?'selected':''}>${esc(i.name)} · ${esc(i.brand||'')} ${esc(i.model||'')}</option>`).join('')}${v.instrumentId&&!availableInstruments.some(i=>(i.categories||[]).some(c=>instrumentCategoryForType(type).includes(c))&&i.id===v.instrumentId)?`<option value="${esc(v.instrumentId)}" selected>${esc(v.instrument||'Instrumento histórico')} · conservar identificación</option>`:''}</select><small class="muted">Elegir un equipo completa marca, modelo y serie automáticamente.</small></label></div>
 <div class="form-grid"><label>Instrumento / identificación<input name="instrument" maxlength="100" value="${esc(v.instrument||'')}" placeholder="Instrumento utilizado"></label><label>Marca / modelo<input name="instrumentModel" maxlength="140" value="${esc(v.instrumentModel||'')}"></label><label>N.º de serie<input name="serial" maxlength="100" value="${esc(v.serial||'')}"></label></div>
 <section class="technical-fields"><div class="section-title"><div><h3>Identificación y características del dispositivo</h3><p class="muted">${type==='rcd'?'Estos datos identifican al interruptor diferencial y se comparten entre todos sus ensayos.':'Campos propios del ensayo.'}</p></div></div><div class="form-grid">${cfg.fields.map(f=>technicalField(f,tech[f[0]]!==undefined?tech[f[0]]:(type==='pat'&&f[0]==='expectedResistance'?'100':type==='pat'&&f[0]==='patCriterion'?'AEA 90364-7-770/2026 · hasta 100 Ω (cuando corresponda)':''))).join('')}</div></section>
 ${type==='rcd'?rcdMatrixHtml(rcdTests,tech.rcdType||'AC',tech):''}
 <label>Condiciones del ensayo<input name="conditions" maxlength="240" value="${esc(v.conditions||'')}" placeholder="Temperatura, humedad, tensión de red, observaciones del entorno…"></label><label>Observaciones generales<textarea name="observations" rows="3" maxlength="4000">${esc(v.observations||'')}</textarea></label>
 <div class="modal-actions"><button type="button" class="secondary" id="cancel-measurement">Cancelar</button><button type="submit" class="primary">${existing?'Guardar cambios':'Guardar ensayo'}</button></div></form>`;
 root.append(overlay);const form=overlay.querySelector('form'),close=()=>overlay.remove();overlay.querySelector('#close-measurement').onclick=close;overlay.querySelector('#cancel-measurement').onclick=close;
 const instrumentSelect=form.elements.instrumentId;instrumentSelect.addEventListener('change',()=>{const item=availableInstruments.find(x=>x.id===instrumentSelect.value);if(!item)return;form.elements.instrument.value=item.name||'';form.elements.instrumentModel.value=[item.brand,item.model].filter(Boolean).join(' ');form.elements.serial.value=item.serial||'';});
 if(type==='rcd'){
  const list=overlay.querySelector('#rcd-test-list'),count=overlay.querySelector('#rcd-test-count'),typeSelect=overlay.querySelector('[data-tech="rcdType"]');
  const refreshCount=()=>{count.textContent=`${list.children.length} filas · Matriz para diferencial tipo ${typeSelect.value}`;};
  overlay.querySelector('#add-rcd-test').onclick=()=>{list.insertAdjacentHTML('beforeend',rcdMatrixRow({wave:'Ensayo adicional',polarity:'A definir',testMode:'Ensayo adicional',maxTime:'Definir según norma'}));refreshCount();};
  list.addEventListener('click',e=>{const b=e.target.closest('[data-remove-rcd-row]');if(b){b.closest('tr').remove();refreshCount();}});
  for(const el of overlay.querySelectorAll('[data-rcd-global]')){const key=el.dataset.rcdGlobal;el.value=tech[key]||el.value;}
  const ramp=tech.rcdRamp||{};for(const el of overlay.querySelectorAll('[data-rcd-ramp]'))el.value=ramp[el.dataset.rcdRamp]||el.value;
  typeSelect.addEventListener('change',()=>{const previous=[...list.querySelectorAll('[data-rcd-row]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-rcd-test]')].map(el=>[el.dataset.rcdTest,el.value])));const generated=rcdDefaultRows(typeSelect.value);const byKey=new Map(previous.map(t=>[`${t.wave}|${t.polarity}|${t.testMultiplier}`,t]));const merged=generated.map(t=>({...t,...(byKey.get(`${t.wave}|${t.polarity}|${t.testMultiplier}`)||{})}));list.innerHTML=merged.map((t,i)=>rcdMatrixRow(t,i)).join('');refreshCount();const rampWave=overlay.querySelector('[data-rcd-ramp="wave"]');if(rampWave&&!rcdWaveProfiles(typeSelect.value).some(p=>rampWave.value.startsWith(p.wave)))rampWave.value=rcdWaveProfiles(typeSelect.value)[0].wave+' · '+rcdWaveProfiles(typeSelect.value)[0].polarity;});
 }
 const patCriterion=overlay.querySelector('[data-tech="patCriterion"]'),patExpected=overlay.querySelector('[data-tech="expectedResistance"]');
 if(patCriterion&&patExpected){const updatePatLimit=()=>{if(patCriterion.value.startsWith('AEA 90364-7-770/2026'))patExpected.value='100';else if(patCriterion.value.startsWith('AEA 90364-7-771'))patExpected.value='40';else patExpected.value='';};patCriterion.addEventListener('change',updatePatLimit);}
 form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const technical=Object.fromEntries([...form.querySelectorAll('[data-tech]')].map(el=>[el.dataset.tech,el.value]));
  if(type==='rcd'){technical.rcdTests=[...form.querySelectorAll('[data-rcd-row]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-rcd-test]')].map(el=>[el.dataset.rcdTest,el.value])));for(const el of form.querySelectorAll('[data-rcd-global]'))technical[el.dataset.rcdGlobal]=el.value;technical.rcdRamp=Object.fromEntries([...form.querySelectorAll('[data-rcd-ramp]')].map(el=>[el.dataset.rcdRamp,el.value]));}
  const now=new Date().toISOString();const selectedInstrument=availableInstruments.find(x=>x.id===data.instrumentId);const instrumentSnapshot=selectedInstrument?{id:selectedInstrument.id,name:selectedInstrument.name,brand:selectedInstrument.brand||'',model:selectedInstrument.model||'',serial:selectedInstrument.serial||'',range:selectedInstrument.range||'',categories:[...(selectedInstrument.categories||[])],calibrationDate:selectedInstrument.calibrationDate||'',calibrationDue:selectedInstrument.calibrationDue||'',notes:selectedInstrument.notes||''}:((data.instrument||data.instrumentModel||data.serial)?{name:data.instrument||'',brandModel:data.instrumentModel||'',serial:data.serial||'',manual:true}:null);const record={...(existing||{}),...data,instrumentSnapshot,technical,id:existing?.id||crypto.randomUUID(),jobId:job.id,createdAt:existing?.createdAt||now,updatedAt:now};await put('measurements',record);close();onDone();});form.elements.title.focus();}

export async function openJob(root, id, back, goHome = () => {}) {
  const [jobs, clients, properties] = await Promise.all([all('jobs'), all('clients'), all('properties')]);
  jobsCache = jobs;
  await showJobDetail(root, jobs, clients, properties, id, back, goHome);
}

// Biblioteca central de documentación: selección múltiple y exportación conjunta a PDF.
export async function renderDocumentsHub(root, goHome = () => {}, openJobCallback = () => {}) {
  const [calculations, measurements, protocols, jobs, clients, settings] = await Promise.all([
    all('dpms_calculations'), all('measurements'), all('srt_protocols'), all('jobs'), all('clients'), all('settings')
  ]);
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const propertyRecords = await all('properties');
  const propertyMap = new Map(propertyRecords.map(p => [p.id,p]));
  const entries = [
    ...calculations.map(r => ({kind:'dpms', id:r.id, jobId:r.jobId, record:r, title:`Cálculo DPMS · ${r.title || r.code || 'Sin título'}`, date:r.updatedAt||r.createdAt, status:'Cálculo guardado', subtype:'Cálculo DPMS'})),
    ...measurements.map(r => ({kind:'measurement', id:r.id, jobId:r.jobId, record:r, title:r.title || measurementTypeNames[r.type] || 'Medición', date:r.updatedAt||r.createdAt||r.date, status:measurementStatusNames[r.status]||'Borrador', subtype:measurementTypeNames[r.type]||'Medición'})),
    ...protocols.map(r => ({kind:'srt', id:r.id, jobId:r.jobId, record:r, title:`Protocolo SRT 900/15 · ${r.company||'Establecimiento'}`, date:r.updatedAt||r.createdAt||r.dateFrom, status:'Protocolo guardado', subtype:'Puesta a tierra y continuidad'}))
  ].filter(x=>jobMap.has(x.jobId) && (!jobMap.get(x.jobId).specialty || jobMap.get(x.jobId).specialty==='electricity' || jobMap.get(x.jobId).tradeId==='electricity')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const identity=settings.find(x=>x.key==='identity')?.value||{};
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">BIBLIOTECA TÉCNICA</p><h1>Documentación</h1><p class="muted">Consultá los informes y reuní varios registros en un solo PDF, sin duplicar ni modificar los originales.</p></div><button class="secondary" id="back-documents">← Inicio</button></div>
  <section class="panel"><div class="list-toolbar"><input id="document-search" type="search" placeholder="Buscar por informe, cliente, trabajo o tipo…" aria-label="Buscar documentación"><select id="document-type"><option value="">Todos los documentos</option><option value="dpms">Cálculos DPMS</option><option value="measurement">Mediciones y ensayos</option><option value="srt">Protocolos SRT</option></select><span class="count-label" id="document-count"></span></div>
  <div class="document-bulk-actions"><label class="measurement-export-select"><input type="checkbox" id="document-select-visible"> Seleccionar todos los visibles</label><span id="document-selection-count" class="muted">0 seleccionados</span><button class="primary" id="document-export-selected" disabled>Exportar seleccionados a PDF (0)</button></div>
  <div class="client-list" id="document-list"></div></section>
  <p class="local-note">Los documentos se generan desde los registros existentes. Para guardar el PDF, elegí «Guardar como PDF» en el diálogo de impresión.</p>`;
  root.querySelector('#back-documents').onclick=goHome;
  const list=root.querySelector('#document-list'), search=root.querySelector('#document-search'), type=root.querySelector('#document-type'), count=root.querySelector('#document-count'), selectVisible=root.querySelector('#document-select-visible'), exportButton=root.querySelector('#document-export-selected'), selectionCount=root.querySelector('#document-selection-count');
  const selected=new Set();
  let visible=[];
  const updateSelection=()=>{
    const n=selected.size;
    selectionCount.textContent=`${n} ${n===1?'seleccionado':'seleccionados'}`;
    exportButton.disabled=!n;
    exportButton.textContent=`Exportar seleccionados a PDF (${n})`;
    const visibleIds=visible.map(e=>e.kind+':'+e.id);
    const checked=visibleIds.filter(id=>selected.has(id)).length;
    selectVisible.checked=visibleIds.length>0&&checked===visibleIds.length;
    selectVisible.indeterminate=checked>0&&checked<visibleIds.length;
  };
  const paint=()=>{
    const q=search.value.trim().toLocaleLowerCase('es'), t=type.value;
    visible=entries.filter(e=>!t||(t==='other'?false:e.kind===t)).filter(e=>{const j=jobMap.get(e.jobId),c=clientMap.get(j.clientId);return [e.title,e.subtype,j.code,j.name,clientName(c),e.status].join(' ').toLocaleLowerCase('es').includes(q);});
    count.textContent=`${visible.length} ${visible.length===1?'documento':'documentos'}`;
    list.innerHTML=visible.length?visible.map(e=>{const j=jobMap.get(e.jobId),c=clientMap.get(j.clientId),key=e.kind+':'+e.id;return `<div class="history-row measurement-row"><label class="measurement-export-select"><input type="checkbox" data-document-select="${esc(key)}" ${selected.has(key)?'checked':''} aria-label="Seleccionar ${esc(e.title)}"></label><div><strong>${esc(e.title)}</strong><small>${esc(e.subtype)} · ${esc(fmt(e.date))} · ${esc(e.status)}</small><small>${esc(j.code)} · ${esc(j.name)} · ${esc(clientName(c))}</small></div><div class="history-actions"><button class="secondary" data-document-open="${esc(e.id)}" data-document-kind="${e.kind}" data-job-id="${esc(e.jobId)}">Abrir</button><button class="secondary" data-document-job="${esc(e.jobId)}">Expediente</button></div></div>`;}).join(''):`<div class="empty"><div class="empty-icon">▧</div><strong>No hay documentos para mostrar</strong><p>Los cálculos DPMS, las mediciones y los protocolos SRT aparecerán acá cuando estén asociados a un trabajo eléctrico.</p></div>`;
    list.querySelectorAll('[data-document-select]').forEach(box=>box.addEventListener('change',()=>{if(box.checked)selected.add(box.dataset.documentSelect);else selected.delete(box.dataset.documentSelect);updateSelection();}));
    list.querySelectorAll('[data-document-open]').forEach(b=>b.onclick=()=>{const job=jobMap.get(b.dataset.jobId);if(!job)return;if(b.dataset.documentKind==='dpms')renderDPMS(root,job,()=>renderDocumentsHub(root,goHome,openJobCallback));else if(b.dataset.documentKind==='srt')renderSRT(root,job.id,()=>renderDocumentsHub(root,goHome,openJobCallback));else{const record=measurements.find(x=>x.id===b.dataset.documentOpen);if(record)showMeasurementDetail(root,job,record,()=>renderDocumentsHub(root,goHome,openJobCallback));}});
    list.querySelectorAll('[data-document-job]').forEach(b=>b.onclick=()=>openJobCallback(b.dataset.documentJob));
    updateSelection();
  };
  search.addEventListener('input',paint);type.addEventListener('change',()=>{selected.clear();paint();});
  selectVisible.onchange=()=>{visible.forEach(e=>{const key=e.kind+':'+e.id;if(selectVisible.checked)selected.add(key);else selected.delete(key);});paint();};
  exportButton.onclick=()=>{const chosen=entries.filter(e=>selected.has(e.kind+':'+e.id));openDocumentsBundlePDF(chosen,jobMap,clientMap,propertyMap,identity,settings);};
  paint();
}

function openDocumentsBundlePDF(entries,jobMap,clientMap,propertyMap,identity,settings=[]){
  if(!entries.length)return;
  const escv=v=>esc(v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v));
  const row=(label,value)=>value!==undefined&&value!==null&&value!==''?`<div class="row"><span>${esc(label)}</span><strong>${escv(value)}</strong></div>`:'';
  const section=(title,content)=>content?`<section><h2>${esc(title)}</h2>${content}</section>`:'';
  const docs=entries.map((e,index)=>{
    const j=jobMap.get(e.jobId)||{},c=clientMap.get(j.clientId)||{},p=propertyMap.get(j.propertyId)||{},r=e.record||{};
    const client=c.type==='company'?(c.legalName||c.tradeName||'Empresa'):[c.firstName,c.lastName].filter(Boolean).join(' ')||'—';
    const common=`${row('Tipo',e.subtype)}${row('Fecha',fmt(e.date))}${row('Estado',e.status)}${row('Código de trabajo',j.code)}${row('Trabajo',j.name)}${row('Cliente',client)}${row('Documento / CUIT',c.document||c.taxId)}${row('Inmueble',p.name)}${row('Dirección',[p.address,p.locality,p.province].filter(Boolean).join(', '))}`;
    let body='';
    if(e.kind==='measurement'){
      const cfg=technicalForms[r.type]||technicalForms.other,tech=r.technical||{};
      const technical=cfg.fields.map(f=>row(f[1],tech[f[0]]!==undefined&&tech[f[0]]!==''?(f[2]==='number'&&f[3]?`${tech[f[0]]} ${f[3]}`:tech[f[0]]):'')).join('');
      const snap=r.instrumentSnapshot||{};
      body=section('Datos del ensayo',`${row('Instrumento',r.instrument||snap.name)}${row('Marca',r.instrumentBrand||snap.brand)}${row('Modelo',r.instrumentModel||snap.model)}${row('Número de serie',r.serial||snap.serial)}${row('Rango',snap.range)}${row('Calibración',snap.calibrationDate)}${row('Vencimiento',snap.calibrationDue)}${row('Condiciones',r.conditions)}`)+section('Parámetros y resultados',technical||'<p>Sin parámetros adicionales.</p>');
      if(r.type==='rcd'&&(tech.rcdTests||[]).length){body+=section('Matriz de ensayos diferenciales',`<table><thead><tr><th>Onda</th><th>Polaridad</th><th>Prueba</th><th>Multiplicador</th><th>Corriente</th><th>Tiempo 0°</th><th>Tiempo 180°</th><th>Máx.</th><th>Evaluación</th></tr></thead><tbody>${tech.rcdTests.map(t=>`<tr>${[t.wave||tech.testWave,t.polarity,t.testMode,t.testMultiplier,t.appliedCurrent,t.time0,t.time180,t.maxTime,t.evaluation].map(v=>`<td>${escv(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);}
      body+=section('Observaciones',r.observations?`<p>${esc(r.observations)}</p>`:'');
    } else if(e.kind==='dpms'){
      const i=r.input||{},x=r.result||{},s=i.scope||{},b=x.breakdown||{};
      body=section('Resultado DPMS',`${row('Potencia aparente',x.totalVA!==undefined?`${x.totalVA} VA`:'')}${row('Potencia activa estimada',x.activeW!==undefined?`${x.activeW} W`:'')}${row('Corriente equivalente',x.currentA!==undefined?`${x.currentA} A`:'')}${row('Suministro',i.supply==='three'?'Trifásico':'Monofásico')}${row('Tensión',i.voltage!==undefined?`${i.voltage} V`:'')}${row('Factor de potencia',i.fp)}${row('Grado de electrificación',x.grade)}${row('Cantidad de circuitos',x.circuitCount)}${row('Factor de simultaneidad',x.cs)}${row('Demanda general',b.generalDemandVA!==undefined?`${b.generalDemandVA} VA`:'')}${row('Demanda de cargas específicas',b.dedicatedDemandVA!==undefined?`${b.dedicatedDemandVA} VA`:'')}`);
      if((x.circuitDetails||[]).length)body+=section('Detalle por circuito',`<table><thead><tr><th>Circuito / carga</th><th>Bocas / cant.</th><th>Potencia</th><th>Demanda base</th><th>Demanda DPMS</th></tr></thead><tbody>${x.circuitDetails.map(v=>`<tr><td>${escv(v.name)}</td><td>${escv(v.bocas??v.quantity)}</td><td>${escv(v.activeW!==undefined?v.activeW+' W':'—')}</td><td>${escv(v.demandVA!==undefined?v.demandVA+' VA':'')}</td><td>${escv(v.dpmsVA!==undefined?v.dpmsVA+' VA':'')}</td></tr>`).join('')}</tbody></table>`);
      body+=section('Alcance y suministro',`${row('Alcance',s.scopeLabel|| (s.isDwelling?'Vivienda':''))}${row('Superficie de aplicación',x.applicationArea!==undefined?`${x.applicationArea} m²`:'')}`);
      const vd=(settings.find(v=>v.key===`voltage-drop:${e.jobId}`)?.value||[]).find(v=>v.result?.dpms?.recordId===r.id);
      if(vd){const z=vd.result||{};body+=section('Alimentador TP–TS · Caída de tensión',`${row('Tipo de tendido',vd.input?.installation==='aerial'?'Aéreo':'Subterráneo')}${row('Longitud',vd.input?.distance!==undefined?`${vd.input.distance} m`:'')}${row('Caída máxima objetivo',vd.input?.limit!==undefined?`${vd.input.limit} %`:'')}${row('ITM de referencia',z.protection?.rating!==undefined?`${z.protection.rating} A`:'')}${row('Cobre',z.cu?.section!==undefined?`${z.cu.section} mm² · ${z.cu.percent??'—'} % · ${z.cu.voltageDropV??'—'} V`:'')}${row('Aluminio',z.al?.section!==undefined?`${z.al.section} mm² · ${z.al.percent??'—'} % · ${z.al.voltageDropV??'—'} V`:'')}`); }
    } else {
      const skip=new Set(['id','jobId','createdAt','updatedAt','files','measurements']);
      const details=Object.entries(r).filter(([k,v])=>!skip.has(k)&&v!==''&&v!==null&&v!==undefined).map(([k,v])=>row(k.replace(/([A-Z])/g,' $1'),v)).join('');
      const points=(r.measurements||[]).map(m=>`<tr>${[m.number,m.sector,m.ground,m.use,m.scheme,m.resistance,m.complies,m.continuity,m.capacity,m.protection,m.automaticCutoff].map(v=>`<td>${escv(v)}</td>`).join('')}</tr>`).join('');
      body=section('Datos del protocolo',details)+section('Puntos de medición',points?`<table><thead><tr>${['N.º','Sector','Terreno','Uso PAT','Esquema','Ω','Cumple','Continuidad','Capacidad','Protección','Corte auto.'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${points}</tbody></table>`:'<p>Sin puntos registrados.</p>')+section('Conclusiones',r.conclusions?`<p>${esc(r.conclusions)}</p>`:'')+section('Recomendaciones',r.recommendations?`<p>${esc(r.recommendations)}</p>`:'');
    }
    return `<article class="report ${index?'page-break':''}"><header><div class="brand">${esc(identity.tradeName||identity.name||'SIGESTEC')}</div><div class="tag">DOCUMENTACIÓN TÉCNICA · ELECTRICIDAD</div><h1>${esc(e.title)}</h1><p>${esc(e.subtype)} · ${esc(fmt(e.date))}</p></header>${section('Identificación',common)}${body}<section class="sign"><h2>Profesional interviniente</h2><p>${esc(identity.name||'')}</p><p>${esc(identity.tradeName||'')}</p><div class="signature"><span>Firma y aclaración</span><span>Fecha</span></div></section><footer>Generado por SIGESTEC · Registro ${esc(e.id)}</footer></article>`;
  }).join('');
  const w=window.open('','_blank');if(!w){alert('El navegador bloqueó la ventana emergente. Permití ventanas emergentes para generar el PDF.');return;}
  w.document.open();w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Documentación técnica SIGESTEC</title><style>*{box-sizing:border-box}body{font:10pt/1.4 Arial,sans-serif;color:#172b45;margin:0}.report{padding:12mm 13mm;max-width:210mm;margin:auto}.page-break{break-before:page;page-break-before:always}header{border-bottom:2px solid #1769aa;padding-bottom:6mm;margin-bottom:7mm}header h1{font-size:19pt;margin:4mm 0 1mm;color:#123b62}.brand{font-size:14pt;font-weight:bold;color:#123b62}.tag{float:right;color:#1769aa;font-size:8pt;font-weight:bold}header p{margin:0;color:#64748b}section{margin:0 0 6mm;break-inside:avoid}h2{font-size:11pt;color:#1769aa;border-bottom:1px solid #d7e2ec;padding-bottom:2mm;margin:0 0 3mm}.row{display:flex;gap:5mm;border-bottom:1px solid #edf1f5;padding:1.5mm 0}.row span{width:38%;color:#64748b}.row strong{flex:1;text-align:right;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:8pt;table-layout:fixed}th,td{border:1px solid #d7e2ec;padding:2mm;vertical-align:top;overflow-wrap:anywhere}th{background:#edf4fa}.sign{margin-top:10mm}.signature{display:flex;gap:20mm;margin-top:16mm}.signature span{flex:1;border-top:1px solid #64748b;padding-top:2mm;text-align:center;font-size:8pt}footer{border-top:1px solid #d7e2ec;padding-top:2mm;margin-top:8mm;color:#78899b;font-size:7.5pt}@page{size:A4;margin:0}@media print{.report{max-width:none;margin:0}table tr{break-inside:avoid}}</style></head><body>${docs}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`);w.document.close();
}
