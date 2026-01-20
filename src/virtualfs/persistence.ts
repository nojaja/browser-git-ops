// Node builtins (fs/path) are imported dynamically to avoid bundling them into browser builds
import { IndexFile } from './types'

/**
 * 永続化レイヤーの抽象インターフェース
 * Storage の具体実装はこの契約に従うこと
 */
export interface StorageBackend {
  /**
   * 初期化処理
   * @returns {Promise<void>}
   */
  init(): Promise<void>
  /**
   * index.json を読み込む
   * @returns {Promise<IndexFile|null>}
   */
  readIndex(): Promise<IndexFile | null>
  /**
   * index.json を書き込む
   * @param {IndexFile} index
   * @returns {Promise<void>}
   */
  writeIndex(_index: IndexFile): Promise<void>
  /**
   * ファイルコンテンツを保存
   * @param {string} filepath
   * @param {string} content
   * @returns {Promise<void>}
   */
  writeBlob(_filepath: string, _content: string): Promise<void>
  /**
   * ファイルコンテンツを読み出す
   * @param {string} filepath
   * @returns {Promise<string|null>}
   */
  readBlob(_filepath: string): Promise<string | null>
  /**
   * ファイルを削除する
   * @param {string} filepath
   * @returns {Promise<void>}
   */
  deleteBlob(_filepath: string): Promise<void>
}

// BrowserStorage: use OPFS when available, otherwise IndexedDB
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

  /**
   * IndexedDB を開き、データベースインスタンスを返します。
   * @returns {Promise<IDBDatabase>}
   */
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const idb = (globalThis as any).indexedDB
      if (!idb) return reject(new Error('IndexedDB is not available'))
      const req = idb.open(this.dbName, 1)
      /**
       * データベーススキーマの初期化
       * @param ev イベントオブジェクト
       * @returns {void}
       */
      req.onupgradeneeded = (ev: any) => {
        const db = (ev.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
        if (!db.objectStoreNames.contains('index')) db.createObjectStore('index')
      }
      // 成功時ハンドラ
      /**
       * ハンドラ（成功時） - 戻り値なし
       * @returns {void}
       */
      req.onsuccess = () => {
        const db = req.result
        // 他のタブやアップグレードにより接続が closing 状態になることがある。
        // その場合は安全に close し、後続の操作時に再接続する。
        try {
          // 既存の onversionchange を上書きして close を行う
          /** @returns {void} */
          db.onversionchange = () => {
            try { db.close() } catch (_) { /* ignore */ }
          }
        } catch (_) {
          // ignore
        }
        resolve(db)
      }
      // エラー時ハンドラ
      /**
       * ハンドラ（エラー時） - 戻り値なし
       * @returns {void}
       */
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * IndexedDB トランザクションをラップしてコールバックを実行します。
   * @param {string} storeName ストア名
   * @param {IDBTransactionMode} mode トランザクションモード
   * @param {(store: IDBObjectStore)=>void|Promise<void>} cb 実行コールバック
   * @returns {Promise<void>}
   */
  private async tx(storeName: string, mode: IDBTransactionMode, cb: (_store: IDBObjectStore) => void | Promise<void>) {
    // Attempt transaction; if DB connection is closing (InvalidStateError), reopen DB and retry once.
    /**
     * Attempt transaction; returns when complete or rejects on error.
     * @returns {Promise<void>}
     */
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
          /** @returns {void} */
          tx.oncomplete = () => resolve()
          /** @returns {void} */
          tx.onerror = () => reject(tx.error)
        }).catch(reject)
      })
    }

    try {
      return await attempt()
    } catch (err: any) {
      // If the DB connection was closing, recreate the connection and retry once.
      const isInvalidState = err && (err.name === 'InvalidStateError' || /closing/i.test(String(err.message || '')))
      if (isInvalidState) {
        this.dbPromise = this.openDb()
        return await attempt()
      }
      throw err
    }
  }

  /**
   * OPFS 利用可否を判定します。
   * 基本は `navigator.storage.persist()` の結果を短時間で待ち、
   * それが真であれば true を返します。テスト互換性のため legacy な
   * `originPrivateFileSystem` が存在する場合はフォールバックで true を返します。
   * @returns {Promise<boolean>} OPFS を利用可能なら true
   */
  async canUseOpfs(): Promise<boolean> {
    // Use globalThis.navigator to avoid `no-undef` in non-browser environments
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

  /**
   * OPFS の root ディレクトリを取得します。`navigator.storage.getDirectory()` を優先し、
   * 無ければ legacy な `originPrivateFileSystem.getDirectory()` を返します。見つからなければ null。
   * @returns {Promise<any|null>} OPFSのルートハンドル、見つからなければ null
   */
  private async getOpfsRoot(): Promise<any | null> {
    try {
      // @ts-ignore
      const nav = (globalThis as any).navigator
      if (nav && nav.storage) {
        const r = await this.callStorageGetDirectory(nav.storage)
        if (r) return r
      }
      // legacy fallback if available
      // @ts-ignore
      if ((globalThis as any).originPrivateFileSystem && typeof (globalThis as any).originPrivateFileSystem.getDirectory === 'function') {
        // @ts-ignore
        return await (globalThis as any).originPrivateFileSystem.getDirectory()
      }
    } catch (_) {
      // fallthrough
    }
    return null
  }

  /**
   * storage.getDirectory を安全に呼び出すラッパ（テスト互換性考慮）。
   * @returns {Promise<any|null>} 成功すればディレクトリハンドル、失敗すれば null
   */
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

  /**
   * Try to write a file using OPFS APIs. Returns true if write succeeded.
   * @param filepath ファイルパス
   * @param content ファイル内容
   * @returns {Promise<boolean>} 書き込み成功なら true
   */
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

  /**
   * Try to read a file using OPFS APIs. Returns string content or null if not found.
   * @param filepath ファイルパス
   * @returns {Promise<string|null>} ファイル内容または null
   */
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

  /**
   * Try to delete a file using OPFS APIs. Returns true if deletion succeeded.
   * @param filepath ファイルパス
   * @returns {Promise<boolean>} 削除成功なら true
   */
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

  /**
   * index を IndexedDB から読み出します。
   * @returns {Promise<IndexFile|null>} 読み込んだ Index ファイル、または null
   */
  async readIndex() {
    const db = await this.dbPromise
    return new Promise<IndexFile | null>((resolve, reject) => {
      const tx = db.transaction('index', 'readonly')
      const store = tx.objectStore('index')
      const req = store.get('index')
      // onsuccess handler
      /**
       * onsuccess ハンドラ（内部処理） - 戻り値なし
       * @returns {void}
       */
      req.onsuccess = () => resolve(req.result ?? null)
      // onerror handler
      /**
       * onerror ハンドラ（内部処理） - 戻り値なし
       * @returns {void}
       */
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * index を IndexedDB に書き込みます。
   * @param {IndexFile} index 書き込むデータ
   * @returns {Promise<void>}
   */
  async writeIndex(index: IndexFile) {
    await this.tx('index', 'readwrite', (store) => { store.put(index, 'index') })
  }

  /**
   * blob を書き込みます。OPFS がある場合は OPFS を優先して使用します。
   * @param {string} filepath ファイルパス
   * @param {string} content ファイル内容
   * @returns {Promise<void>}
   */
  async writeBlob(filepath: string, content: string) {
    // Try OPFS first; if not available or fails, fall back to IndexedDB
    if (await this.canUseOpfs()) {
      const ok = await this.tryWriteOpfs(filepath, content)
      if (ok) return
    }

    await this.tx('blobs', 'readwrite', (store) => { store.put(content, filepath) })
  }

  /**
   * 指定パスの blob を読み出します。存在しなければ null を返します。
   * @param {string} filepath ファイルパス
   * @returns {Promise<string|null>} ファイル内容または null
   */
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
      // onsuccess handler
      /** @returns {void} */
      req.onsuccess = () => resolve(req.result ?? null)
      // onerror handler
      /** @returns {void} */
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * 指定パスの blob を削除します。
   * @param {string} filepath ファイルパス
   * @returns {Promise<void>}
   */
  async deleteBlob(filepath: string) {
    // Best-effort OPFS delete, then ensure removal from IndexedDB
    if (await this.canUseOpfs()) {
      await this.tryDeleteOpfs(filepath)
    }

    await this.tx('blobs', 'readwrite', (store) => { store.delete(filepath) })
  }
}
