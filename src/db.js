import { DB_NAME, DB_VERSION, PROJECT_STORE, RECOVERY_STORE } from './constants.js';
import { clone, timestamp } from './utils.js';

let dbPromise;
function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function transaction(storeName, mode, action) {
  return db().then(database => new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

export const projectDB = {
  async list() {
    const rows = await transaction(PROJECT_STORE, 'readonly', store => store.getAll());
    return rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },
  get: id => transaction(PROJECT_STORE, 'readonly', store => store.get(id)),
  async save(project) {
    const copy = clone(project); copy.updatedAt = timestamp();
    await transaction(PROJECT_STORE, 'readwrite', store => store.put(copy)); return copy;
  },
  delete: id => transaction(PROJECT_STORE, 'readwrite', store => store.delete(id)),
  async duplicate(project) {
    const copy = clone(project); copy.id = crypto.randomUUID(); copy.name += ' Copy'; copy.createdAt = copy.updatedAt = timestamp();
    await transaction(PROJECT_STORE, 'readwrite', store => store.put(copy)); return copy;
  },
  recovery: {
    put(project) { return transaction(RECOVERY_STORE, 'readwrite', store => store.put({ id: project.id, savedAt: timestamp(), project: clone(project) })); },
    get(id) { return transaction(RECOVERY_STORE, 'readonly', store => store.get(id)); },
    delete(id) { return transaction(RECOVERY_STORE, 'readwrite', store => store.delete(id)); }
  }
};
