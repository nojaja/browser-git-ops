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
try {
  if (globalThis.indexedDB && typeof globalThis.indexedDB.open === 'function') {
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
              evts.forEach((e) => { try { onsuccess(e) } catch (_) {} });
            }
          },
          get() { return onsuccess }
        });
        Object.defineProperty(wrapper, 'onerror', {
          set(fn) {
            onerror = fn
            if (onerror && buf.error.length) {
              const evts = buf.error.splice(0);
              evts.forEach((e) => { try { onerror(e) } catch (_) {} });
            }
          },
          get() { return onerror }
        });
        Object.defineProperty(wrapper, 'onupgradeneeded', {
          set(fn) {
            onupgradeneeded = fn
            if (onupgradeneeded && buf.upgrade.length) {
              const evts = buf.upgrade.splice(0);
              evts.forEach((e) => { try { onupgradeneeded(e) } catch (_) {} });
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
              try { onsuccess(e) } catch (_) {}
            } else buf.success.push(e)
          } else if (type === 'error') {
            if (typeof onerror === 'function') {
              try { onerror(e) } catch (_) {}
            } else buf.error.push(e)
          } else if (type === 'upgrade') {
            if (typeof onupgradeneeded === 'function') {
              try { onupgradeneeded(e) } catch (_) {}
            } else buf.upgrade.push(e)
          }
        }

        // no-op helper (avoid console logging from fake-indexeddb callbacks)
        const _dbgBuf = () => {}

        if (origReq) {
          // prefer addEventListener if available so we don't clobber other handlers
          try {
            if (typeof origReq.addEventListener === 'function') {
              origReq.addEventListener('success', (e) => deliverOrBuffer('success', e));
              origReq.addEventListener('error', (e) => deliverOrBuffer('error', e));
              origReq.addEventListener('upgradeneeded', (e) => deliverOrBuffer('upgrade', e));
            } else {
              // fallback to property assignment
              const prevSuccess = origReq.onsuccess;
              origReq.onsuccess = (e) => { try { if (typeof prevSuccess === 'function') prevSuccess(e) } catch(_){}; _dbgBuf('success', e); deliverOrBuffer('success', e) };
              const prevError = origReq.onerror;
              origReq.onerror = (e) => { try { if (typeof prevError === 'function') prevError(e) } catch(_){}; _dbgBuf('error', e); deliverOrBuffer('error', e) };
              const prevUpgrade = origReq.onupgradeneeded;
              origReq.onupgradeneeded = (e) => { try { if (typeof prevUpgrade === 'function') prevUpgrade(e) } catch(_){}; _dbgBuf('upgrade', e); deliverOrBuffer('upgrade', e) };
            }
          } catch (err) {
            // ignore attach handler errors
            void err
          }
        } else {
          // If origReq absent (rare), synthesize minimal async events so consumers waiting on onsuccess/onupgradeneeded proceed
          // Use next microtask to simulate realistic timing
          Promise.resolve().then(() => {
            try {
              const ev = { target: wrapper };
              // fire upgradeneeded then success to mirror browser behavior when DB is created
              deliverOrBuffer('upgrade', ev);
              deliverOrBuffer('success', ev);
            } catch (_) {}
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
} catch (e) {
  // ignore if jest not available here
}

// Ensure each test starts with an IndexedDB mock available. Some tests delete
// the global indexedDB in their afterEach; restore it before each test.
try {
  // `beforeEach` from Jest globals may be available here
  if (typeof beforeEach !== 'undefined') {
    beforeEach(() => {
      if (typeof globalThis.indexedDB === 'undefined' || globalThis.indexedDB === null) {
        // Re-initialize fake-indexeddb auto shim
        try { require('fake-indexeddb/auto'); } catch (_) { /* ignore */ }
        if (typeof globalThis.indexedDB === 'undefined' && typeof global.indexedDB !== 'undefined') {
          globalThis.indexedDB = global.indexedDB;
        }
      }
    });
  }
} catch (e) {
  // ignore when running outside Jest
}
