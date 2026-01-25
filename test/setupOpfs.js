// Jest setup: enable OPFS mock using opfs-mock
const opfs = require('opfs-mock');

// Initialize navigator.storage.getDirectory mock
if (opfs && typeof opfs.mockOPFS === 'function') {
  try {
    opfs.mockOPFS();
  } catch (e) {
    // ignore
  }
}

// Ensure global originPrivateFileSystem points to same storage factory
try {
  if (!globalThis.originPrivateFileSystem) {
    const sf = opfs.storageFactory ? opfs.storageFactory() : null;
    if (sf && typeof sf.getDirectory === 'function') {
      Object.defineProperty(globalThis, 'originPrivateFileSystem', {
        value: { getDirectory: sf.getDirectory.bind(sf) },
        writable: true
      });
    } else {
      // Fallback: mirror navigator.storage.getDirectory
      if (globalThis.navigator && globalThis.navigator.storage && typeof globalThis.navigator.storage.getDirectory === 'function') {
        Object.defineProperty(globalThis, 'originPrivateFileSystem', {
          value: { getDirectory: () => globalThis.navigator.storage.getDirectory() },
          writable: true
        });
      }
    }
  }
} catch (e) {
  // ignore
}
