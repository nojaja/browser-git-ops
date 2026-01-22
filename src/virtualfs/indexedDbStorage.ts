import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor, Segment } from './storageBackend'

/**
 * IndexedDB を用いた永続化実装
 */
export const IndexedDbStorage: StorageBackendConstructor = class IndexedDbStorage implements StorageBackend {
  /**
   * 環境に IndexedDB が存在するかを同期検査します。
    * @returns {boolean} 利用可能なら true
   */
  static canUse(): boolean {
    try {
      return !!(globalThis as any).indexedDB
    } catch (_) {
      return false
    }
  }
  private dbName: string
  private dbPromise: Promise<IDBDatabase>
  private static VAR_WORKSPACE = 'workspace'
  private static VAR_BASE = 'git-base'
  private static VAR_CONFLICT = 'git-conflict'
  private static DEFAULT_DB_NAME = 'apigit_storage'

  /** 利用可能な DB 名の一覧を返す
   * @returns {string[]} available root names
   */
  static availableRoots(): string[] {
    return [IndexedDbStorage.DEFAULT_DB_NAME]
  }

  /** コンストラクタ */
  constructor(root?: string) {
    this.dbName = root ?? IndexedDbStorage.DEFAULT_DB_NAME
    // Kick off DB open immediately so dbPromise is always defined
    this.dbPromise = this.openDb()
  }

  /**
   * 初期化: DB をオープンするまで待つ
   * @returns {Promise<void>} 初期化完了時に解決
   */
  async init(): Promise<void> {
    await this.dbPromise
  }

  /**
   * DB を開いて objectStore を初期化する
   * @returns {Promise<IDBDatabase>} Opened IDBDatabase
   */
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const idb = (globalThis as any).indexedDB
      if (!idb) return reject(new Error('IndexedDB is not available'))
      const req = idb.open(this.dbName, 1)
      /**
       * Handle DB upgrade event
       * @param {Event} ev Upgrade event
       * @returns {void}
       */
      req.onupgradeneeded = (ev: any) => this._handleUpgrade(ev)
      /**
       * Handle open success
       * @returns {void}
       */
      req.onsuccess = () => this._onOpenSuccess(req, resolve)
      /**
       * Handle open error
       * @returns {void}
       */
      req.onerror = () => this._onOpenError(req, reject)
    })
  }

  /**
   * DB スキーマの初期化/アップグレードを行うハンドラ
   */
  /**
   * Handle DB upgrade event and create required object stores.
   * @param ev Upgrade event
   * @returns {void}
   */
  private _handleUpgrade(ev: any) {
    const db = (ev.target as IDBOpenDBRequest).result
    if (!db.objectStoreNames.contains(IndexedDbStorage.VAR_WORKSPACE)) db.createObjectStore(IndexedDbStorage.VAR_WORKSPACE)
    if (!db.objectStoreNames.contains(IndexedDbStorage.VAR_BASE)) db.createObjectStore(IndexedDbStorage.VAR_BASE)
    if (!db.objectStoreNames.contains(IndexedDbStorage.VAR_CONFLICT)) db.createObjectStore(IndexedDbStorage.VAR_CONFLICT)
    if (!db.objectStoreNames.contains('index')) db.createObjectStore('index')
  }

  /**
   * 指定 DB に対する onversionchange ハンドラを生成します。
   */
  /**
   * Create a handler to close DB on version change.
   * @param dbParam Target DB
   * @returns {() => void}
   */
  private _makeVersionChangeHandler(dbParam: IDBDatabase) {
    return () => { try { dbParam.close() } catch (_) { void 0 } }
  }

  /**
   * DB open の成功ハンドラ
   */
  /**
   * Called when DB open succeeds.
   * @param req IDB open request
   * @param resolve Resolver for the open promise
   * @returns {void}
   */
  private _onOpenSuccess(req: IDBOpenDBRequest, resolve: (_db: IDBDatabase) => void) {
    const db = req.result
    try { db.onversionchange = this._makeVersionChangeHandler(db) } catch (_) { void 0 }
    resolve(db)
  }

  /**
   * DB open のエラーハンドラ
   */
  /**
   * Called when DB open errors.
   * @param req IDB open request
   * @param reject Reject function for the open promise
   * @returns {void}
   */
  private _onOpenError(req: IDBOpenDBRequest, reject: (_err?: any) => void) {
    reject(req.error)
  }

  /**
   * トランザクションラッパー。cb 内の処理をトランザクションで実行し、
   * 必要なら再試行します。
   */
  /**
   * トランザクションラッパー。cb 内の処理をトランザクションで実行し、必要なら再試行します。
   * @returns {Promise<void>} トランザクション処理完了時に解決
   */
  private async tx(storeName: string, mode: IDBTransactionMode, cb: (_store: IDBObjectStore) => void | Promise<void>): Promise<void> {
    try { return await this._performTxAttempt(storeName, mode, cb) } catch (err: any) {
      const isInvalidState = err && (err.name === 'InvalidStateError' || /closing/i.test(String(err.message || '')))
      if (isInvalidState) { this.dbPromise = this.openDb(); return await this._performTxAttempt(storeName, mode, cb) }
      throw err
    }
  }

  /**
   * 単一トランザクション試行実行を行います。
   * @returns {Promise<void>} トランザクション処理完了時に解決
   */
  private async _performTxAttempt(storeName: string, mode: IDBTransactionMode, cb: (_store: IDBObjectStore) => void | Promise<void>): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction
      try { tx = db.transaction(storeName, mode) } catch (err) { return reject(err) }
      const storeObj = tx.objectStore(storeName)

      /**
       * Transaction complete handler
       * @returns {void}
       */
      const handleTxComplete = () => { resolve() }
      /**
       * Transaction error handler
       * @returns {void}
       */
      const handleTxError = () => { reject(tx.error) }

      Promise.resolve(cb(storeObj)).then(() => {
        tx.oncomplete = handleTxComplete
        tx.onerror = handleTxError
      }).catch(reject)
    })
  }

  // legacy canUseOpfs removed; use static canUse() instead

  /**
   * index を読み出す
   * @returns {Promise<IndexFile|null>} 読み出した IndexFile、存在しなければ null
   */
  async readIndex(): Promise<IndexFile | null> {
    const db = await this.dbPromise
    return new Promise<IndexFile | null>((resolve, reject) => {
      const tx = db.transaction('index', 'readonly')
      const store = tx.objectStore('index')
      const req = store.get('index')

      /** index 取得成功ハンドラ */
      const handleIndexSuccess = () => { resolve(req.result ?? null) }

      /** index 取得エラーハンドラ */
      const handleIndexError = () => { reject(req.error) }

      req.onsuccess = handleIndexSuccess
      req.onerror = handleIndexError
    })
  }

  /**
   * index を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeIndex(index: IndexFile): Promise<void> {
    await this.tx('index', 'readwrite', (store) => { store.put(index, 'index') })
  }

  /**
   * blob を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeBlob(filepath: string, content: string, segment?: Segment): Promise<void> {
    const seg = segment || IndexedDbStorage.VAR_WORKSPACE
    const storeName = seg === IndexedDbStorage.VAR_WORKSPACE ? IndexedDbStorage.VAR_WORKSPACE : seg === 'base' ? IndexedDbStorage.VAR_BASE : IndexedDbStorage.VAR_CONFLICT
    await this.tx(storeName, 'readwrite', (store) => { store.put(content, filepath) })
  }

  /**
   * blob を読み出す
   * @returns {Promise<string|null>} ファイル内容、存在しなければ null
   */
  async readBlob(filepath: string, segment?: Segment): Promise<string | null> {
    // If segment explicitly provided, read only that store.
    if (segment) {
      const storeName = segment === IndexedDbStorage.VAR_WORKSPACE ? IndexedDbStorage.VAR_WORKSPACE : segment === 'base' ? IndexedDbStorage.VAR_BASE : IndexedDbStorage.VAR_CONFLICT
      return await this._getFromStore(storeName, filepath)
    }
    // Fallback: check workspace, then base, then conflict
    const fromWorkspace = await this._getFromStore(IndexedDbStorage.VAR_WORKSPACE, filepath)
    if (fromWorkspace !== null) return fromWorkspace
    const fromBase = await this._getFromStore(IndexedDbStorage.VAR_BASE, filepath)
    if (fromBase !== null) return fromBase
    return await this._getFromStore(IndexedDbStorage.VAR_CONFLICT, filepath)
  }

  /**
   * blob を削除する
   * @returns {Promise<void>} 削除完了時に解決
   */
  async deleteBlob(filepath: string, segment?: Segment): Promise<void> {
    if (segment === IndexedDbStorage.VAR_WORKSPACE) { await this._deleteFromStore(IndexedDbStorage.VAR_WORKSPACE, filepath); return }
    if (segment === 'base') { await this._deleteFromStore(IndexedDbStorage.VAR_BASE, filepath); return }
    if (segment === 'conflict') { await this._deleteFromStore(IndexedDbStorage.VAR_CONFLICT, filepath); return }
    await this._deleteFromStore(IndexedDbStorage.VAR_WORKSPACE, filepath)
    await this._deleteFromStore(IndexedDbStorage.VAR_BASE, filepath)
    await this._deleteFromStore(IndexedDbStorage.VAR_CONFLICT, filepath)
  }

  /**
   * Read a value from a specific object store.
   * @param storeName Object store name
   * @param filepath Key to read
   * @returns {Promise<string|null>} value or null
   */
  private async _getFromStore(storeName: string, filepath: string): Promise<string | null> {
    const db = await this.dbPromise
    return new Promise<string | null>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.get(filepath)
        /**
         * Index get success handler
         * @returns {void}
         */
        req.onsuccess = function () { resolve(req.result ?? null) }
        /**
         * Index get error handler
         * @returns {void}
         */
        req.onerror = function () { resolve(null) }
      } catch (_) { resolve(null) }
    })
  }

  /**
   * Delete a key from a specific object store.
   * @param storeName Object store name
   * @param filepath Key to delete
   * @returns {Promise<void>}
   */
  private async _deleteFromStore(storeName: string, filepath: string): Promise<void> {
    return this.tx(storeName, 'readwrite', (store) => { store.delete(filepath) })
  }

}

export default IndexedDbStorage
