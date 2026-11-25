import { all, put, remove } from './db.js';
import { openJob } from './jobs.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientName = c => c.type === 'company' ? (c.legalName || c.tradeName || 'Empresa sin nombre') : `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Cliente sin nombre';
const typeName = t => ({house:'Vivienda', apartment:'Departamento / unidad funcional', ph:'PH', building:'Edificio', commercial:'Local comercial', office:'Oficina', industrial:'Industrial', land:'Terreno', other:'Otro'}[t] || 'Sin tipo');

export async function renderProperties(root, goHome = () => {}, clientFilter = null, backToClient = null) {
  const [properties, clients] = await Promise.all([all('properties'), all('clients')]);
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const heading = clientFilter ? `Inmuebles de ${clientName(clientMap.get(clientFilter) || {})}` : 'Inmuebles';
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GESTIÓN</p><h1>${esc(heading)}</h1><p class="muted">Domicilios y propiedades vinculados a tus clientes.</p></div><div class="heading-actions"><button class="secondary" id="back-properties">${clientFilter ? '← Cliente' : '← Inicio'}</button><button class="primary" id="new-property">＋ Nuevo inmueble</button></div></div>
  <section class="panel"><div class="list-toolbar"><div class="search-wrap"><input id="property-search" type="search" placeholder="Buscar por inmueble, cliente, dirección o localidad…" aria-label="Buscar inmuebles"></div><span class="count-label" id="property-count"></span></div><div id="property-list" class="client-list"></div></section>`;
  root.querySelector('#back-properties').onclick = clientFilter && backToClient ? backToClient : goHome;
  const list = root.querySelector('#property-list'), count = root.querySelector('#property-count'), search = root.querySelector('#property-search');
  const paint = (term = '') => {
    const q = term.trim().toLocaleLowerCase('es');
    const filtered = properties.filter(p => (!clientFilter || p.clientId === clientFilter) && [p.name,p.address,p.locality,p.province,p.cadastralReference,clientName(clientMap.get(p.clientId) || {})].join(' ').toLocaleLowerCase('es').includes(q));
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'inmueble' : 'inmuebles'}`;
    list.innerHTML = filtered.length ? filtered.map(p => `<button class="client-row client-row-button" data-id="${esc(p.id)}"><div class="avatar">⌂</div><div class="client-info"><strong>${esc(p.name)}</strong><small>${esc(clientName(clientMap.get(p.clientId) || {}))} · ${esc([p.address,p.locality].filter(Boolean).join(', ') || 'Sin dirección')}</small></div><span class="client-email">${esc(typeName(p.type))}</span><span class="row-arrow">›</span></button>`).join('') : `<div class="empty"><div class="empty-icon">⌂</div><strong>${q ? 'No hay coincidencias' : 'Todavía no hay inmuebles'}</strong><p>${q ? 'Probá con otro término.' : 'Agregá un inmueble y vinculalo con uno de tus clientes.'}</p></div>`;
    list.querySelectorAll('[data-id]').forEach(row => row.addEventListener('click', () => showPropertyDetail(root, properties, clients, row.dataset.id, () => renderProperties(root, goHome, clientFilter, backToClient), goHome, clientFilter, backToClient)));
  };
  paint(); search.addEventListener('input', e => paint(e.target.value));
  root.querySelector('#new-property').onclick = () => showPropertyForm(root, null, clients, clientFilter, async p => { await put('properties', p); properties.push(p); paint(search.value); });
}

export async function showPropertyDetail(root, properties, clients, id, refresh, goHome, clientFilter = null, backToClient = null) {
  const p = properties.find(x => x.id === id); if (!p) return;
  const client = clients.find(c => c.id === p.clientId);
  const jobs = (await all('jobs')).filter(j => j.propertyId === id);
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">FICHA DEL INMUEBLE</p><h1>${esc(p.name)}</h1><p class="muted">${esc(client ? clientName(client) : 'Cliente no disponible')} · ${esc(typeName(p.type))}</p></div><div class="heading-actions"><button class="secondary" id="back-property-list">← Inmuebles</button><button class="primary" id="edit-property">Editar ficha</button></div></div>
  <section class="detail-grid"><article class="panel detail-panel"><h2>Datos del inmueble</h2>${line('Tipo',typeName(p.type))}${line('Dirección',p.address)}${line('Localidad',p.locality)}${line('Provincia',p.province)}${line('Referencia catastral',p.cadastralReference)}${line('Superficie cubierta',p.coveredArea ? `${p.coveredArea} m²` : '')}${line('Superficie semicubierta',p.semiCoveredArea ? `${p.semiCoveredArea} m²` : '')}${line('Superficie por unidad cubierta',p.unitCoveredArea ? `${p.unitCoveredArea} m²` : '')}${line('Superficie por unidad semicubierta',p.unitSemiCoveredArea ? `${p.unitSemiCoveredArea} m²` : '')}${line('Plantas',p.floors)}${line('Unidad / sector',p.unitLabel)}${line('Cantidad de unidades',p.unitCount)}${line('Observaciones',p.notes)}${locationDetail(p)}</article><article class="panel detail-panel"><h2>Cliente asociado</h2><div class="related-stat"><strong>${esc(client ? clientName(client) : '—')}</strong></div>${line('Teléfono',client?.phone)}${line('Email',client?.email)}<h2 style="margin-top:22px">Actividad asociada</h2><div class="related-stat"><strong>${jobs.length}</strong><span>Trabajos</span></div><div class="related-properties">${jobs.length ? jobs.map(j => `<button class="related-property-row" data-job-id="${esc(j.id)}"><span><strong>${esc(j.code)} · ${esc(j.name)}</strong><small>${esc(({pending:'Pendiente',in_progress:'En proceso',paused:'Pausado',completed:'Finalizado',cancelled:'Cancelado'})[j.status]||'Pendiente')}</small></span><span>›</span></button>`).join('') : '<p class="muted">Todavía no hay trabajos asociados.</p>'}</div></article></section>
  <div class="detail-footer"><small>Alta: ${fmt(p.createdAt)}${p.updatedAt ? ` · Última modificación: ${fmt(p.updatedAt)}` : ''}</small><button class="danger" id="delete-property">Eliminar inmueble</button></div>`;
  root.querySelector('#back-property-list').onclick = refresh;
  root.querySelectorAll('[data-job-id]').forEach(row => row.addEventListener('click', () => openJob(root, row.dataset.jobId, () => showPropertyDetail(root, properties, clients, id, refresh, goHome, clientFilter, backToClient), goHome)));
  root.querySelector('#edit-property').onclick = () => showPropertyForm(root, p, clients, p.clientId, async updated => { Object.assign(p,updated); await put('properties',p); await showPropertyDetail(root,properties,clients,id,refresh,goHome,clientFilter,backToClient); });
  root.querySelector('#delete-property').onclick = async () => { if (jobs.length) { alert(`No se puede eliminar este inmueble porque tiene ${jobs.length} trabajo(s) asociado(s).`); return; } if (!confirm(`¿Eliminar definitivamente el inmueble «${p.name}»?`)) return; await remove('properties',id); const i=properties.findIndex(x=>x.id===id); if(i>=0) properties.splice(i,1); refresh(); };
}

function locationDetail(p) {
  if (p.latitude == null || p.longitude == null || !Number.isFinite(Number(p.latitude)) || !Number.isFinite(Number(p.longitude))) return '<div class="detail-line"><span>Ubicación en mapa</span><strong>Sin registrar</strong></div>';
  const lat = Number(p.latitude), lon = Number(p.longitude);
  const query = `${lat},${lon}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
  return `<div class="detail-line"><span>Coordenadas</span><strong>${esc(lat.toFixed(6))}, ${esc(lon.toFixed(6))}</strong></div><div class="detail-line"><span>Google Maps</span><strong><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir ubicación ↗</a></strong></div><div class="detail-line"><span>Navegación</span><strong><a href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Cómo llegar ↗</a></strong></div><div class="detail-line"><span>Alternativa</span><strong><a href="${osmUrl}" target="_blank" rel="noopener noreferrer">Abrir en OpenStreetMap ↗</a></strong></div>`;
}
function line(label,value){return value?`<div class="detail-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`:'';}
function fmt(value){return value?new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(value)):'—';}

function showPropertyForm(root, existing, clients, selectedClientId, onSave) {
  if (!clients.length) { alert('Primero tenés que crear un cliente para poder asociarle un inmueble.'); return; }
  const v=existing||{}; const overlay=document.createElement('div'); overlay.className='modal-backdrop';
  overlay.innerHTML=`<form class="modal" id="property-form"><div class="modal-head"><div><p class="eyebrow">${existing?'ACTUALIZAR REGISTRO':'NUEVO REGISTRO'}</p><h2>${existing?'Editar inmueble':'Agregar inmueble'}</h2></div><button type="button" class="icon-button" id="close-property" aria-label="Cerrar">✕</button></div>
  <label>Cliente asociado<select name="clientId" required ${existing?'disabled':''}>${clients.map(c=>`<option value="${esc(c.id)}" ${(v.clientId||selectedClientId)===c.id?'selected':''}>${esc(clientName(c))}</option>`).join('')}</select></label>
  <label>Nombre identificador<input name="name" required maxlength="120" placeholder="Ej.: Casa principal, local del centro…" value="${esc(v.name)}"></label>
  <label>Tipo de inmueble<select name="type"><option value="house" ${v.type==='house'?'selected':''}>Vivienda</option><option value="apartment" ${v.type==='apartment'?'selected':''}>Departamento / unidad funcional</option><option value="ph" ${v.type==='ph'?'selected':''}>PH</option><option value="building" ${v.type==='building'?'selected':''}>Edificio</option><option value="commercial" ${v.type==='commercial'?'selected':''}>Local comercial</option><option value="office" ${v.type==='office'?'selected':''}>Oficina</option><option value="industrial" ${v.type==='industrial'?'selected':''}>Industrial</option><option value="land" ${v.type==='land'?'selected':''}>Terreno</option><option value="other" ${v.type==='other'?'selected':''}>Otro</option></select></label>
  <label>Dirección<input name="address" maxlength="180" value="${esc(v.address)}"></label><div class="form-grid"><label>Localidad<input name="locality" maxlength="100" value="${esc(v.locality)}"></label><label>Provincia<input name="province" maxlength="100" value="${esc(v.province)}"></label></div>
  <fieldset class="property-location"><legend>Ubicación en el mapa <span class="optional">(opcional)</span></legend><p class="muted">Podés buscar una dirección, marcar el punto manualmente en el mapa o usar el GPS. La ubicación no es obligatoria.</p><label>Buscar dirección o lugar<input id="property-address-search" type="search" placeholder="Ej.: Av. Corrientes 1234, CABA"></label><div class="location-search-actions"><button type="button" class="secondary" id="search-property-address">⌕ Buscar dirección</button><span class="local-note" id="address-search-status" aria-live="polite"></span></div><div id="address-search-results" class="address-search-results" hidden></div><div class="property-map-help">Cuando aparezca el mapa, tocá o hacé clic en el punto deseado. También podés arrastrar el marcador.</div><div id="property-location-map" class="property-location-map" role="application" aria-label="Mapa para seleccionar la ubicación del inmueble"><div class="map-loading">El mapa se carga cuando hay conexión a Internet.</div></div><div class="form-grid"><label>Latitud<input name="latitude" type="number" step="any" min="-90" max="90" value="${esc(v.latitude)}" placeholder="Ej. -42.0000"></label><label>Longitud<input name="longitude" type="number" step="any" min="-180" max="180" value="${esc(v.longitude)}" placeholder="Ej. -71.5000"></label></div><div class="location-search-actions"><button type="button" class="secondary" id="use-current-location">◎ Obtener ubicación actual</button><button type="button" class="secondary" id="sync-map-coordinates">Ubicar coordenadas</button></div><span class="local-note" id="location-status" aria-live="polite"></span></fieldset>
  <label>Referencia catastral <span class="optional">(opcional)</span><input name="cadastralReference" maxlength="120" value="${esc(v.cadastralReference)}"></label><div class="form-grid"><label>Superficie cubierta (m²)<input name="coveredArea" type="number" min="0" step="0.01" value="${esc(v.coveredArea)}" placeholder="Ej. 120"></label><label>Superficie semicubierta (m²)<input name="semiCoveredArea" type="number" min="0" step="0.01" value="${esc(v.semiCoveredArea)}" placeholder="Opcional"></label></div><div class="form-grid"><label>Superficie cubierta por unidad (m²) <span class="optional">(si corresponde)</span><input name="unitCoveredArea" type="number" min="0" step="0.01" value="${esc(v.unitCoveredArea)}"></label><label>Superficie semicubierta por unidad (m²)<input name="unitSemiCoveredArea" type="number" min="0" step="0.01" value="${esc(v.unitSemiCoveredArea)}"></label></div><div class="form-grid"><label>Cantidad de plantas<input name="floors" type="number" min="1" step="1" value="${esc(v.floors||1)}"></label><label>Cantidad de unidades funcionales<input name="unitCount" type="number" min="1" step="1" value="${esc(v.unitCount)}" placeholder="Si corresponde"></label></div><label>Unidad / sector identificado <span class="optional">(ej. UF 2, PB, local 3)</span><input name="unitLabel" maxlength="100" value="${esc(v.unitLabel)}"></label><label>Observaciones <span class="optional">(opcional)</span><textarea name="notes" rows="3">${esc(v.notes)}</textarea></label>
  <div class="modal-actions"><button type="button" class="secondary" id="cancel-property">Cancelar</button><button class="primary" type="submit">${existing?'Guardar cambios':'Guardar inmueble'}</button></div></form>`;
  root.append(overlay); const form=overlay.querySelector('form'),close=()=>overlay.remove(); overlay.querySelector('#close-property').onclick=close; overlay.querySelector('#cancel-property').onclick=close;
  const latInput = form.elements.latitude, lonInput = form.elements.longitude;
  const mapElement = form.querySelector('#property-location-map');
  const status = form.querySelector('#location-status');
  let propertyMap = null, propertyMarker = null, leafletReady = null;
  const setCoordinates = (lat, lon, message = 'Punto seleccionado. Guardá el inmueble para conservarlo.') => {
    latInput.value = Number(lat).toFixed(7); lonInput.value = Number(lon).toFixed(7);
    if (propertyMap && propertyMarker) { propertyMarker.setLatLng([Number(lat), Number(lon)]); propertyMap.setView([Number(lat), Number(lon)], Math.max(propertyMap.getZoom(), 16)); }
    status.textContent = message;
  };
  const loadLeaflet = () => {
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((resolve, reject) => {
      if (window.L) { resolve(window.L); return; }
      if (!document.querySelector('#leaflet-css')) { const link=document.createElement('link'); link.id='leaflet-css'; link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.append(link); }
      const script=document.createElement('script'); script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload=()=>resolve(window.L); script.onerror=()=>reject(new Error('No se pudo cargar el mapa')); document.head.append(script);
    });
    return leafletReady;
  };
  const initializeMap = async (center = null) => {
    try {
      const L = await loadLeaflet();
      if (!propertyMap) {
        const initial = center || (latInput.value && lonInput.value ? [Number(latInput.value),Number(lonInput.value)] : [-38.4161,-63.6167]);
        propertyMap = L.map(mapElement).setView(initial, center || (latInput.value && lonInput.value) ? 16 : 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap contributors'}).addTo(propertyMap);
        propertyMap.on('click', event => { if(!propertyMarker) propertyMarker=L.marker(event.latlng,{draggable:true}).addTo(propertyMap); propertyMarker.setLatLng(event.latlng).off('dragend').on('dragend',e=>{const pt=e.target.getLatLng();setCoordinates(pt.lat,pt.lng,'Marcador desplazado. Guardá el inmueble para conservarlo.');}); setCoordinates(event.latlng.lat,event.latlng.lng,'Punto marcado en el mapa. Guardá el inmueble para conservarlo.'); });
      }
      if (latInput.value && lonInput.value) {
        const point=[Number(latInput.value),Number(lonInput.value)];
        if (!propertyMarker) propertyMarker=L.marker(point,{draggable:true}).addTo(propertyMap);
        propertyMarker.setLatLng(point); propertyMarker.off('dragend').on('dragend',e=>{const pt=e.target.getLatLng();setCoordinates(pt.lat,pt.lng,'Marcador desplazado. Guardá el inmueble para conservarlo.');});
        if (center) propertyMap.setView(center,16);
      }
      setTimeout(()=>propertyMap.invalidateSize(),150);
      mapElement.querySelector('.map-loading')?.remove();
    } catch (error) { mapElement.innerHTML='<div class="map-loading">No se pudo cargar el mapa. Podés buscar una dirección o ingresar las coordenadas manualmente.</div>'; status.textContent='El mapa requiere conexión a Internet.'; }
  };
  const syncMapButton = form.querySelector('#sync-map-coordinates');
  syncMapButton.onclick = () => { if (!latInput.value || !lonInput.value) { status.textContent='Ingresá latitud y longitud para ubicar el punto.'; return; } initializeMap([Number(latInput.value),Number(lonInput.value)]).then(()=>{ if (propertyMap) { const pt=[Number(latInput.value),Number(lonInput.value)]; if(!propertyMarker) propertyMarker=window.L.marker(pt,{draggable:true}).addTo(propertyMap); propertyMarker.setLatLng(pt).off('dragend').on('dragend',e=>{const p=e.target.getLatLng();setCoordinates(p.lat,p.lng,'Marcador desplazado.');}); propertyMap.setView(pt,16); } }); };
  const searchAddressButton = form.querySelector('#search-property-address');
  searchAddressButton.onclick = async () => {
    const query=[form.querySelector('#property-address-search').value,form.elements.locality.value,form.elements.province.value,'Argentina'].filter(Boolean).join(', ');
    const searchStatus=form.querySelector('#address-search-status'), results=form.querySelector('#address-search-results');
    if (!form.querySelector('#property-address-search').value.trim()) { searchStatus.textContent='Escribí una dirección o lugar para buscar.'; return; }
    searchStatus.textContent='Buscando dirección…'; results.hidden=true; results.innerHTML=''; searchAddressButton.disabled=true;
    try {
      const response=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&q=${encodeURIComponent(query)}`,{headers:{'Accept':'application/json'}});
      if(!response.ok) throw new Error('Servicio de búsqueda no disponible');
      const matches=await response.json();
      if(!matches.length){searchStatus.textContent='No encontramos esa dirección. Probá agregar localidad y provincia o marcá el punto en el mapa.';return;}
      results.innerHTML=matches.map((item,index)=>`<button type="button" class="address-result" data-result="${index}">${esc(item.display_name)}</button>`).join(''); results.hidden=false;
      results.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>{const item=matches[Number(button.dataset.result)];if(item.name && !form.elements.address.value) form.elements.address.value=item.name;setCoordinates(Number(item.lat),Number(item.lon),'Dirección localizada. Podés ajustar el punto moviendo el marcador.');initializeMap([Number(item.lat),Number(item.lon)]);results.hidden=true;searchStatus.textContent='Dirección seleccionada.';});
      searchStatus.textContent=`Se encontraron ${matches.length} resultado(s). Elegí el correcto.`;
    } catch(error){searchStatus.textContent='No se pudo realizar la búsqueda. Revisá tu conexión o marcá el punto manualmente.';}
    finally{searchAddressButton.disabled=false;}
  };
  // El mapa es opcional y se inicializa al abrir la ficha; la búsqueda externa sólo se ejecuta a pedido.
  initializeMap();
  [latInput,lonInput].forEach(input=>input.addEventListener('change',()=>{if(latInput.value&&lonInput.value) syncMapButton.click();}));
  const locationButton = form.querySelector('#use-current-location');
  locationButton.onclick = () => {
    const status = form.querySelector('#location-status');
    if (!navigator.geolocation) { status.textContent = 'Este navegador no permite obtener la ubicación.'; return; }
    status.textContent = 'Solicitando permiso de ubicación…';
    navigator.geolocation.getCurrentPosition(position => {
      form.elements.latitude.value = String(position.coords.latitude);
      form.elements.longitude.value = String(position.coords.longitude);
      setCoordinates(position.coords.latitude,position.coords.longitude,'Ubicación GPS cargada. Guardá el inmueble para conservarla.');
      initializeMap([position.coords.latitude,position.coords.longitude]);
    }, error => {
      status.textContent = error.code === 1 ? 'Permiso denegado. Podés ingresar las coordenadas manualmente.' : 'No se pudo obtener la ubicación. Intentá nuevamente o ingresá las coordenadas.';
    }, {enableHighAccuracy:true, timeout:15000, maximumAge:60000});
  };
  form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));if(existing)data.clientId=existing.clientId;const now=new Date().toISOString();const property={...(existing||{}),...data,coveredArea:data.coveredArea===''?null:Number(data.coveredArea),semiCoveredArea:data.semiCoveredArea===''?null:Number(data.semiCoveredArea),unitCoveredArea:data.unitCoveredArea===''?null:Number(data.unitCoveredArea),unitSemiCoveredArea:data.unitSemiCoveredArea===''?null:Number(data.unitSemiCoveredArea),latitude:data.latitude===''?null:Number(data.latitude),longitude:data.longitude===''?null:Number(data.longitude),floors:data.floors===''?1:Number(data.floors),unitCount:data.unitCount===''?null:Number(data.unitCount),id:existing?.id||crypto.randomUUID(),createdAt:existing?.createdAt||now,updatedAt:now};await onSave(property);close();});
  form.elements.name.focus();
}
