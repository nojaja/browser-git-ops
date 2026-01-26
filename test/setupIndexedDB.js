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
      // origOpen may throw or return undefined; always return a wrapper object
      let origReq = undefined
      try {
        origReq = origOpen(...args)
      } catch (err) {
        origReq = undefined
      }

      // buffers for events that may fire before handler attached
      const buf = { success: [], error: [], upgrade: [] };

      // keep handler refs local to wrapper
      let onsuccess = undefined;
      let onerror = undefined;
      let onupgradeneeded = undefined;

      const wrapper = {};
      // (no-op) open called - avoid logging during tests to prevent post-test console errors
      Object.defineProperty(wrapper, 'onsuccess', {
        set(fn) {
          onsuccess = fn
          // flush any buffered success events async
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

      // Utility to deliver or buffer events
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

      // no-op helper (avoid console logging from fake-indexeddb callbacks)
      const _dbgBuf = () => {}

      if (origReq) {
        // prefer addEventListener if available so we don't clobber other handlers
        if (typeof origReq.addEventListener === 'function') {
          origReq.addEventListener('success', (e) => deliverOrBuffer('success', e));
          origReq.addEventListener('error', (e) => deliverOrBuffer('error', e));
          origReq.addEventListener('upgradeneeded', (e) => deliverOrBuffer('upgrade', e));
        } else {
          // fallback to property assignment
          const prevSuccess = origReq.onsuccess;
          origReq.onsuccess = (e) => { if (typeof prevSuccess === 'function') prevSuccess(e); _dbgBuf('success', e); deliverOrBuffer('success', e) };
          const prevError = origReq.onerror;
          origReq.onerror = (e) => { if (typeof prevError === 'function') prevError(e); _dbgBuf('error', e); deliverOrBuffer('error', e) };
          const prevUpgrade = origReq.onupgradeneeded;
          origReq.onupgradeneeded = (e) => { if (typeof prevUpgrade === 'function') prevUpgrade(e); _dbgBuf('upgrade', e); deliverOrBuffer('upgrade', e) };
        }
      } else {
        // If origReq absent (rare), synthesize minimal async events so consumers waiting on onsuccess/onupgradeneeded proceed
        // Use next microtask to simulate realistic timing
        Promise.resolve().then(() => {
          const ev = { target: wrapper };
          // fire upgradeneeded then success to mirror browser behavior when DB is created
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
  // NOTE: Do not wrap IDBDatabase.prototype.transaction here - many unit tests
  // provide custom fake DB/transaction implementations. Wrapping transaction
  // semantics can interfere with test-provided behavior and cause timeouts.
}

// Ensure each test starts with an IndexedDB mock available. Some tests delete
// the global indexedDB in their afterEach; restore it before each test.
if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    if (typeof globalThis.indexedDB === 'undefined' || globalThis.indexedDB === null) {
      // Re-initialize fake-indexeddb auto shim
      try { require('fake-indexeddb/auto'); } catch (err) { console.error(err) }
      if (typeof globalThis.indexedDB === 'undefined' && typeof global.indexedDB !== 'undefined') {
        globalThis.indexedDB = global.indexedDB;
      }
    }
  });
}
