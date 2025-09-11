import type { BaseStorage, ValueOrUpdate } from './types';

/**
 * Updates a value with either a new value or the result of an update function.
 */
async function updateValue<D>(valueOrUpdate: ValueOrUpdate<D>, current: D): Promise<D> {
  if (typeof valueOrUpdate === 'function') {
    return (valueOrUpdate as (prev: D) => D | Promise<D>)(current);
  }
  return valueOrUpdate;
}

/**
 * Creates an IndexedDB storage area with the same interface as Chrome storage
 * but with support for larger data storage and reactivity.
 */
export function createIndexedDBStorage<D>(dbName: string, storeName: string, fallback: D): BaseStorage<D> {
  let cache: D | null = null;
  let initedCache = false;
  let listeners: Array<() => void> = [];
  let db: IDBDatabase | null = null;

  // For cross-context reactivity - simulate Chrome storage onChanged behavior
  const storageEventKey = `indexeddb-${dbName}-${storeName}`;
  let lastChangeId = Date.now();

  const _emitChange = () => {
    listeners.forEach(listener => listener());
  };

  const _notifyOtherContexts = () => {
    // Use Chrome runtime messaging for cross-context notifications
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const changeId = Date.now() + Math.random();
      lastChangeId = changeId;

      // Send message to all contexts
      try {
        chrome.runtime
          .sendMessage({
            type: 'INDEXEDDB_CHANGE',
            key: storageEventKey,
            changeId: changeId,
          })
          .catch(() => {
            // Ignore errors - other contexts might not be listening
          });
      } catch (error) {
        // Ignore - runtime might not be available in some contexts
      }
    }
  };

  const _handleCrossContextMessage = async (message: any) => {
    if (message.type === 'INDEXEDDB_CHANGE' && message.key === storageEventKey) {
      const changeId = message.changeId;
      if (changeId !== lastChangeId) {
        // Another context made a change, reload our cache
        try {
          const newData = await get();
          if (JSON.stringify(newData) !== JSON.stringify(cache)) {
            cache = newData;
            lastChangeId = changeId;
            _emitChange();
          }
        } catch (error) {
          console.error('Error handling cross-context change:', error);
        }
      }
    }
  };

  const _openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;

        // Handle unexpected closes
        db.onclose = () => {
          console.warn('IndexedDB connection closed unexpectedly');
          db = null;
        };

        db.onerror = event => {
          console.error('IndexedDB error:', event);
        };

        resolve(db);
      };

      request.onupgradeneeded = event => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
    });
  };

  const get = async (): Promise<D> => {
    try {
      const database = await _openDB();
      const transaction = database.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get('data');

      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result : fallback);
        };
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return fallback;
    }
  };

  const set = async (valueOrUpdate: ValueOrUpdate<D>, retryCount = 0): Promise<void> => {
    try {
      if (!initedCache) {
        cache = await get();
        initedCache = true;
      }

      cache = await updateValue(valueOrUpdate, cache as D);

      const database = await _openDB();
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise<void>((resolve, reject) => {
        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };

        transaction.onabort = () => {
          console.error('Transaction aborted');
          reject(new Error('Transaction aborted'));
        };

        const request = store.put(cache, 'data');
        request.onerror = () => {
          console.error('Put request error:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          _emitChange();
          _notifyOtherContexts();
          resolve();
        };
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);

      // Retry once if it's a connection issue
      if (retryCount === 0 && error instanceof DOMException) {
        console.log('Retrying IndexedDB operation...');
        db = null; // Force reconnection
        return set(valueOrUpdate, retryCount + 1);
      }

      throw error;
    }
  };

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  const getSnapshot = () => {
    return cache;
  };

  // Initialize cache
  get()
    .then(data => {
      cache = data;
      initedCache = true;
      _emitChange();
    })
    .catch(error => {
      console.error('Failed to initialize IndexedDB cache:', error);
      cache = fallback;
      initedCache = true;
      _emitChange();
    });

  // Listen for cross-context changes via Chrome runtime messages
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_handleCrossContextMessage);
  }

  return {
    get,
    set,
    getSnapshot,
    subscribe,
  };
}
