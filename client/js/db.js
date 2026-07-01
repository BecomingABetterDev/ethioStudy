/**
 * db.js — IndexedDB wrapper for EthioStudy offline storage
 *
 * Stores:
 *   tasks      — local task cache (synced from server or created offline)
 *   syncQueue  — pending operations to replay when online
 *
 * All functions exposed as globals (window.TaskStore, window.SyncQueue)
 * so they work with plain <script> loading (no ES modules needed in HTML).
 */

const DB_NAME    = 'EthioStudyDB';
const DB_VERSION = 1;

let _db = null;

/* ─── Open DB ────────────────────────────────────────────────────────────── */
function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      return reject(new Error('IndexedDB unavailable: ' + (e && e.message ? e.message : String(e))));
    }

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: '_id' });
        taskStore.createIndex('status',     'status',     { unique: false });
        taskStore.createIndex('dueDate',    'dueDate',    { unique: false });
        taskStore.createIndex('isArchived', 'isArchived', { unique: false });
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    // Always reject with an Error object, never with a raw DOM Event
    req.onerror = (e) => {
      const cause = (e && e.target && e.target.error) || req.error;
      reject(new Error('IDB open failed: ' + (cause && cause.message ? cause.message : String(cause))));
    };

    req.onblocked = () => {
      reject(new Error('IDB open blocked — please close other tabs using this app.'));
    };
  });
}

/* ─── Generic helpers ────────────────────────────────────────────────────── */
function getTx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    // Always reject with a proper Error so callers never receive a raw DOM Event
    req.onerror = (e) => {
      const cause = (e && e.target && e.target.error) || (req && req.error);
      reject(new Error('IDB operation failed: ' + (cause && cause.message ? cause.message : String(cause))));
    };
  });
}

/* ─── TaskStore ──────────────────────────────────────────────────────────── */
const TaskStore = {
  /** Replace the entire local task cache with fresh server data */
  async setAll(tasks) {
    try {
      const store = await getTx('tasks', 'readwrite');
      await promisify(store.clear());
      for (const t of tasks) { store.put(t); }
    } catch { /* IDB unavailable — skip local cache */ }
  },

  /** Get all non-archived tasks */
  async getAll() {
    try {
      const store = await getTx('tasks', 'readonly');
      const all   = await promisify(store.getAll());
      return all.filter((t) => !t.isArchived);
    } catch { return []; }
  },

  /** Get archived tasks */
  async getArchived() {
    try {
      const store = await getTx('tasks', 'readonly');
      const all   = await promisify(store.getAll());
      return all.filter((t) => t.isArchived);
    } catch { return []; }
  },

  /** Upsert a single task */
  async put(task) {
    try {
      const store = await getTx('tasks', 'readwrite');
      return promisify(store.put(task));
    } catch { /* skip */ }
  },

  /** Delete a task record by _id */
  async delete(id) {
    try {
      const store = await getTx('tasks', 'readwrite');
      return promisify(store.delete(id));
    } catch { /* skip */ }
  },
};

/* ─── SyncQueue ──────────────────────────────────────────────────────────── */
const SyncQueue = {
  /**
   * Add an operation to the queue.
   * @param {'CREATE_TASK'|'UPDATE_TASK'|'ARCHIVE_TASK'|'UPDATE_STATUS'} action
   * @param {object} payload
   */
  async enqueue(action, payload) {
    try {
      const store = await getTx('syncQueue', 'readwrite');
      return promisify(store.add({ action, payload, timestamp: Date.now(), retries: 0 }));
    } catch { /* IDB unavailable */ }
  },

  /** Return all queued items in insertion order */
  async getAll() {
    try {
      const store = await getTx('syncQueue', 'readonly');
      return promisify(store.getAll());
    } catch { return []; }
  },

  /** Remove a processed item from the queue */
  async remove(id) {
    try {
      const store = await getTx('syncQueue', 'readwrite');
      return promisify(store.delete(id));
    } catch { /* skip */ }
  },

  /** Increment retry count for a failed item */
  async incrementRetry(item) {
    try {
      const store  = await getTx('syncQueue', 'readwrite');
      item.retries = (item.retries || 0) + 1;
      return promisify(store.put(item));
    } catch { /* skip */ }
  },

  /** Count pending items */
  async count() {
    try {
      const store = await getTx('syncQueue', 'readonly');
      return promisify(store.count());
    } catch { return 0; }
  },

  /** Clear entire queue */
  async clear() {
    try {
      const store = await getTx('syncQueue', 'readwrite');
      return promisify(store.clear());
    } catch { /* skip */ }
  },
};

/* ─── Expose as globals ──────────────────────────────────────────────────── */
window.openDB    = openDB;
window.TaskStore = TaskStore;
window.SyncQueue = SyncQueue;
