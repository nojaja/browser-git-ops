// Minimal IndexedDB shim for Jest/node tests (very small subset)
 (function () {
    if (typeof globalThis.indexedDB !== 'undefined') return;

    function createDB() {
      const stores = new Map();

      function ensureStore(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name);
      }

      function makeDirectStore(map) {
        return {
          put(value, key) {
            const req = { onsuccess: null, onerror: null, result: null };
            setTimeout(() => {
              map.set(key, value);
              req.result = value;
              if (req.onsuccess) req.onsuccess({ target: req });
            }, 0);
            return req;
          },
          get(key) {
            const req = { onsuccess: null, onerror: null, result: map.get(key) };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess({ target: req });
            }, 0);
            return req;
          },
          delete(key) {
            const req = { onsuccess: null, onerror: null };
            setTimeout(() => {
              map.delete(key);
              if (req.onsuccess) req.onsuccess({ target: req });
            }, 0);
            return req;
          },
          openKeyCursor() {
            const keys = Array.from(map.keys());
            let idx = 0;
            const req = { onsuccess: null };
            const callNext = () => {
              setTimeout(() => {
                if (idx >= keys.length) {
                  if (req.onsuccess) req.onsuccess({ target: { result: null } });
                  return;
                }
                const key = keys[idx++];
                const cursor = { key, continue: callNext };
                if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
              }, 0);
            };
            callNext();
            return req;
          },
          openCursor() {
            const entries = Array.from(map.entries()).map(([k, v]) => ({ key: k, value: v }));
            let idx = 0;
            const req = { onsuccess: null };
            const callNext = () => {
              setTimeout(() => {
                if (idx >= entries.length) {
                  if (req.onsuccess) req.onsuccess({ target: { result: null } });
                  return;
                }
                const e = entries[idx++];
                const cursor = { key: e.key, value: e.value, continue: callNext };
                if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
              }, 0);
            };
            callNext();
            return req;
          }
        };
      }

      const db = {
        _stores: stores,
        objectStoreNames: {
          contains(name) {
            return stores.has(name);
          },
          item(i) {
            return Array.from(stores.keys())[i];
          },
          get length() {
            return stores.size;
          }
        },
        createObjectStore(name) {
          ensureStore(name);
          return {};
        },
        transaction(storeNames) {
          const tx = { oncomplete: null, onerror: null };
          const pending = { count: 0 };

          function makeStoreAccessor(name) {
            const map = ensureStore(name);
            return {
              put(value, key) {
                pending.count++;
                const req = { onsuccess: null, onerror: null, result: null };
                setTimeout(() => {
                  map.set(key, value);
                  req.result = value;
                  if (req.onsuccess) req.onsuccess({ target: req });
                  pending.count--;
                  if (pending.count === 0 && typeof tx.oncomplete === 'function') tx.oncomplete({ target: tx });
                }, 0);
                return req;
              },
              get(key) {
                pending.count++;
                const req = { onsuccess: null, onerror: null, result: map.get(key) };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess({ target: req });
                  pending.count--;
                  if (pending.count === 0 && typeof tx.oncomplete === 'function') tx.oncomplete({ target: tx });
                }, 0);
                return req;
              },
              delete(key) {
                pending.count++;
                const req = { onsuccess: null, onerror: null };
                setTimeout(() => {
                  map.delete(key);
                  if (req.onsuccess) req.onsuccess({ target: req });
                  pending.count--;
                  if (pending.count === 0 && typeof tx.oncomplete === 'function') tx.oncomplete({ target: tx });
                }, 0);
                return req;
              },
              openKeyCursor() {
                const keys = Array.from(map.keys());
                let idx = 0;
                const req = { onsuccess: null };
                const callNext = () => {
                  setTimeout(() => {
                    if (idx >= keys.length) {
                      if (req.onsuccess) req.onsuccess({ target: { result: null } });
                      if (pending.count === 0 && typeof tx.oncomplete === 'function') tx.oncomplete({ target: tx });
                      return;
                    }
                    const key = keys[idx++];
                    const cursor = { key, continue: callNext };
                    if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
                  }, 0);
                };
                callNext();
                return req;
              },
              openCursor() {
                const entries = Array.from(map.entries()).map(([k, v]) => ({ key: k, value: v }));
                let idx = 0;
                const req = { onsuccess: null };
                const callNext = () => {
                  setTimeout(() => {
                    if (idx >= entries.length) {
                      if (req.onsuccess) req.onsuccess({ target: { result: null } });
                      if (pending.count === 0 && typeof tx.oncomplete === 'function') tx.oncomplete({ target: tx });
                      return;
                    }
                    const e = entries[idx++];
                    const cursor = { key: e.key, value: e.value, continue: callNext };
                    if (req.onsuccess) req.onsuccess({ target: { result: cursor } });
                  }, 0);
                };
                callNext();
                return req;
              }
            };
          }

          tx.objectStore = (name) => makeStoreAccessor(name);
          return tx;
        },
        objectStore(name) {
          const map = ensureStore(name);
          return makeDirectStore(map);
        },
        close() {}
      };

      return db;
    }

    globalThis.indexedDB = {
      open(dbName, version) {
        const req = { onsuccess: null, onupgradeneeded: null, onerror: null, result: null };
        setTimeout(() => {
          const db = createDB();
          req.result = db;
          if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded({ target: { result: db } });
          if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
        }, 0);
        return req;
      }
    };
  })();
