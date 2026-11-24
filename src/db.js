const DB_NAME = 'gestion-tecnica';
const DB_VERSION = 4;

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
      if (!db.objectStoreNames.contains('srt_protocols')) {
        const store = db.createObjectStore('srt_protocols', { keyPath: 'id' });
        store.createIndex('jobId', 'jobId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
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
    tx.objectStore(storeName).put(value);
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
