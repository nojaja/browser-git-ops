// Jest setup: provide Node-side IndexedDB implementation for tests
// fake-indexeddb/auto sets up global.indexedDB and IDBKeyRange
require('fake-indexeddb/auto');

// Ensure globalThis has indexedDB and IDBKeyRange
if (typeof globalThis.indexedDB === 'undefined' && typeof global.indexedDB !== 'undefined') {
  globalThis.indexedDB = global.indexedDB;
}
if (typeof globalThis.IDBKeyRange === 'undefined' && typeof global.IDBKeyRange !== 'undefined') {
  globalThis.IDBKeyRange = global.IDBKeyRange;
}

// Wrap indexedDB.open with a jest mock so tests can mock/spy on it via jest
if (typeof globalThis !== 'undefined' && globalThis.indexedDB && typeof globalThis.indexedDB.open === 'function') {
  const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);

  const makeWrappedOpen = (origOpen) => {
    return (...args) => {
      let origReq = undefined
      try {
        origReq = origOpen(...args)
      } catch (err) {
        origReq = undefined
      }

      const buf = { success: [], error: [], upgrade: [] };

      let onsuccess = undefined;
      let onerror = undefined;
      let onupgradeneeded = undefined;

      const wrapper = {};
      Object.defineProperty(wrapper, 'onsuccess', {
        set(fn) {
          onsuccess = fn
          if (onsuccess && buf.success.length) {
            const evts = buf.success.splice(0);
            evts.forEach((e) => { if (typeof onsuccess === 'function') onsuccess(e) });
          }
        },
        get() { return onsuccess }
      });
      Object.defineProperty(wrapper, 'onerror', {
        set(fn) {
          onerror = fn
          if (onerror && buf.error.length) {
            const evts = buf.error.splice(0);
            evts.forEach((e) => { if (typeof onerror === 'function') onerror(e) });
          }
        },
        get() { return onerror }
      });
      Object.defineProperty(wrapper, 'onupgradeneeded', {
        set(fn) {
          onupgradeneeded = fn
          if (onupgradeneeded && buf.upgrade.length) {
            const evts = buf.upgrade.splice(0);
            evts.forEach((e) => { if (typeof onupgradeneeded === 'function') onupgradeneeded(e) });
          }
        },
        get() { return onupgradeneeded }
      });
      Object.defineProperty(wrapper, 'result', {
        get() { return origReq && origReq.result }
      });

      const deliverOrBuffer = (type, e) => {
        if (type === 'success') {
          if (typeof onsuccess === 'function') {
            onsuccess(e)
          } else buf.success.push(e)
        } else if (type === 'error') {
          if (typeof onerror === 'function') {
            onerror(e)
          } else buf.error.push(e)
        } else if (type === 'upgrade') {
          if (typeof onupgradeneeded === 'function') {
            onupgradeneeded(e)
          } else buf.upgrade.push(e)
        }
      }

      const _dbgBuf = () => {}

      if (origReq) {
        if (typeof origReq.addEventListener === 'function') {
          origReq.addEventListener('success', (e) => deliverOrBuffer('success', e));
          origReq.addEventListener('error', (e) => deliverOrBuffer('error', e));
          origReq.addEventListener('upgradeneeded', (e) => deliverOrBuffer('upgrade', e));
        } else {
          const prevSuccess = origReq.onsuccess;
          origReq.onsuccess = (e) => { if (typeof prevSuccess === 'function') prevSuccess(e); _dbgBuf('success', e); deliverOrBuffer('success', e) };
          const prevError = origReq.onerror;
          origReq.onerror = (e) => { if (typeof prevError === 'function') prevError(e); _dbgBuf('error', e); deliverOrBuffer('error', e) };
          const prevUpgrade = origReq.onupgradeneeded;
          origReq.onupgradeneeded = (e) => { if (typeof prevUpgrade === 'function') prevUpgrade(e); _dbgBuf('upgrade', e); deliverOrBuffer('upgrade', e) };
        }
      } else {
        Promise.resolve().then(() => {
          const ev = { target: wrapper };
          deliverOrBuffer('upgrade', ev);
          deliverOrBuffer('success', ev);
        })
      }

      return wrapper
    }
  }

  const wrapped = makeWrappedOpen(realOpen)
  if (typeof jest !== 'undefined') globalThis.indexedDB.open = jest.fn(wrapped)
  else globalThis.indexedDB.open = wrapped
}

if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    if (typeof globalThis.indexedDB === 'undefined' || globalThis.indexedDB === null) {
      try { require('fake-indexeddb/auto'); } catch (err) { console.error(err) }
      if (typeof globalThis.indexedDB === 'undefined' && typeof global.indexedDB !== 'undefined') {
        globalThis.indexedDB = global.indexedDB;
      }
    }
  });
}
