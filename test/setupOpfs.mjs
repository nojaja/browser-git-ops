// ESM Jest setup: initialize opfs-mock
import { mockOPFS } from 'opfs-mock';

// initialize OPFS mock (sets globalThis.navigator.storage.getDirectory)
mockOPFS();

// provide originPrivateFileSystem shim expected by some code
if (typeof globalThis.originPrivateFileSystem === 'undefined') {
  globalThis.originPrivateFileSystem = {
    getDirectory: async () => {
      return globalThis.navigator?.storage?.getDirectory();
    }
  };
}
