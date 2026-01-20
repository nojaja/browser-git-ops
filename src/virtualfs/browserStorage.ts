// BrowserStorage: use OPFS when available, otherwise IndexedDB
import { IndexFile } from './types'
import { StorageBackend } from './storageBackend'

/**
 * ブラウザ環境向けの永続化実装: OPFS を優先し、無ければ IndexedDB を使用する
 */
export class BrowserStorage implements StorageBackend {
  private dbName = 'apigit_storage'
  private dbPromise: Promise<IDBDatabase>

  /**
   * BrowserStorage を初期化します。内部で IndexedDB 接続を開始します。
   */
  constructor() {
    this.dbPromise = this.openDb()
  }

  /**
   * 初期化を待機します（IndexedDB の準備完了を待つ）。
   * @returns {Promise<void>}
   */
  async init() {
    await this.dbPromise
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const idb = (globalThis as any).indexedDB
      if (!idb) return reject(new Error('IndexedDB is not available'))
      const req = idb.open(this.dbName, 1)
      req.onupgradeneeded = (ev: any) => {
        const db = (ev.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
        if (!db.objectStoreNames.contains('index')) db.createObjectStore('index')
      }
      req.onsuccess = () => {
        const db = req.result
        try {
          db.onversionchange = () => {
            try { db.close() } catch (_) { /* ignore */ }
          }
        } catch (_) {
          // ignore
        }
        resolve(db)
      }
      req.onerror = () => reject(req.error)
    })
  }

  private async tx(storeName: string, mode: IDBTransactionMode, cb: (_store: IDBObjectStore) => void | Promise<void>) {
    const attempt = async () => {
      const db = await this.dbPromise
      return new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction
        try {
          tx = db.transaction(storeName, mode)
        } catch (err) {
          return reject(err)
        }
        const storeObj = tx.objectStore(storeName)
        Promise.resolve(cb(storeObj)).then(() => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }).catch(reject)
      })
    }

    try {
      return await attempt()
    } catch (err: any) {
      const isInvalidState = err && (err.name === 'InvalidStateError' || /closing/i.test(String(err.message || '')))
      if (isInvalidState) {
        this.dbPromise = this.openDb()
        return await attempt()
      }
      throw err
    }
  }

  async canUseOpfs(): Promise<boolean> {
    try {
      const nav = (globalThis as any).navigator
      if (nav && nav.storage && typeof nav.storage.persist === 'function') {
        return true
      }
    } catch (_) {
      // fallthrough
    }

    return false
  }

  private async getOpfsRoot(): Promise<any | null> {
    try {
      const nav = (globalThis as any).navigator
      if (nav && nav.storage) {
        const r = await this.callStorageGetDirectory(nav.storage)
        if (r) return r
      }
      if ((globalThis as any).originPrivateFileSystem && typeof (globalThis as any).originPrivateFileSystem.getDirectory === 'function') {
        return await (globalThis as any).originPrivateFileSystem.getDirectory()
      }
    } catch (_) {
      // fallthrough
    }
    return null
  }

  private async callStorageGetDirectory(storage: any): Promise<any | null> {
    try {
      if (typeof storage.getDirectory === 'function') return await storage.getDirectory()
      if (storage.getDirectory) {
        try {
          return await storage.getDirectory()
        } catch (_) {
          return null
        }
      }
    } catch (_) {
      return null
    }
    return null
  }

  private async tryWriteOpfs(filepath: string, content: string): Promise<boolean> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return false
      const parts = filepath.split('/')
      let dir = root
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectory(parts[i])
      }
      const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true })
      const writable = await fh.createWritable()
      await writable.write(content)
      await writable.close()
      return true
    } catch (_) {
      return false
    }
  }

  private async tryReadOpfs(filepath: string): Promise<string | null> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return null
      const parts = filepath.split('/')
      let dir = root
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectory(parts[i])
      }
      const fh = await dir.getFileHandle(parts[parts.length - 1])
      const file = await fh.getFile()
      const txt = await file.text()
      return txt ?? null
    } catch (_) {
      return null
    }
  }

  private async tryDeleteOpfs(filepath: string): Promise<boolean> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return false
      const parts = filepath.split('/')
      let dir = root
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectory(parts[i])
      }
      const name = parts[parts.length - 1]
      if (typeof dir.removeEntry === 'function') {
        await dir.removeEntry(name)
        return true
      }
      if (typeof dir.getFileHandle === 'function') {
        try {
          const fh = await dir.getFileHandle(name)
          if (fh && typeof (fh as any).remove === 'function') {
            await (fh as any).remove()
            return true
          }
        } catch (_) {
          return false
        }
      }
      return false
    } catch (_) {
      return false
    }
  }

  async readIndex() {
    const db = await this.dbPromise
    return new Promise<IndexFile | null>((resolve, reject) => {
      const tx = db.transaction('index', 'readonly')
      const store = tx.objectStore('index')
      const req = store.get('index')
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async writeIndex(index: IndexFile) {
    await this.tx('index', 'readwrite', (store) => { store.put(index, 'index') })
  }

  async writeBlob(filepath: string, content: string) {
    if (await this.canUseOpfs()) {
      const ok = await this.tryWriteOpfs(filepath, content)
      if (ok) return
    }

    await this.tx('blobs', 'readwrite', (store) => { store.put(content, filepath) })
  }

  async readBlob(filepath: string) {
    if (await this.canUseOpfs()) {
      const txt = await this.tryReadOpfs(filepath)
      if (txt !== null) return txt
    }

    const db = await this.dbPromise
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly')
      const store = tx.objectStore('blobs')
      const req = store.get(filepath)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async deleteBlob(filepath: string) {
    if (await this.canUseOpfs()) {
      await this.tryDeleteOpfs(filepath)
    }

    await this.tx('blobs', 'readwrite', (store) => { store.delete(filepath) })
  }
}

export default BrowserStorage
