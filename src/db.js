const DB_NAME = 'gestion-tecnica';
const DB_VERSION = 8;

// Normaliza los valores numéricos persistidos a un decimal. Se conserva la
// precisión geográfica para que las coordenadas sigan siendo útiles en mapas.
export function normalizeStoredValue(value, key = '') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (/^(lat|latitude|lng|lon|long|longitude)$/i.test(key)) return value;
    return Math.round((value + Number.EPSILON) * 10) / 10;
  }
  if (Array.isArray(value)) return value.map(item => normalizeStoredValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeStoredValue(v, k)]));
  }
  return value;
}

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('clients')) {
        const store = db.createObjectStore('clients', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('properties')) {
        const store = db.createObjectStore('properties', { keyPath: 'id' });
        store.createIndex('clientId', 'clientId', { unique: false });
      }
      if (!db.objectStoreNames.contains('jobs')) {
        const store = db.createObjectStore('jobs', { keyPath: 'id' });
        store.createIndex('clientId', 'clientId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('dpms_calculations')) {
        const store = db.createObjectStore('dpms_calculations', { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('measurements')) {
        const store = db.createObjectStore('measurements', { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('instruments')) {
        const store = db.createObjectStore('instruments', { keyPath: 'id' });
        store.createIndex('active', 'active', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('labor_regions')) db.createObjectStore('labor_regions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('labor_custom_items')) db.createObjectStore('labor_custom_items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('labor_quotes')) {
        const store = db.createObjectStore('labor_quotes', { keyPath: 'id' });
        store.createIndex('clientId', 'clientId', { unique: false });
        store.createIndex('propertyId', 'propertyId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('srt_protocols')) {
        const store = db.createObjectStore('srt_protocols', { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Migra los registros existentes sin eliminar ni recrear almacenes.
      for (const name of Array.from(db.objectStoreNames)) {
        const store = request.transaction.objectStore(name);
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const normalized = normalizeStoredValue(cursor.value);
          if (JSON.stringify(normalized) !== JSON.stringify(cursor.value)) cursor.update(normalized);
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function all(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(normalizeStoredValue(value));
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

export async function remove(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function get(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
