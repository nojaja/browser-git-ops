import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor, Segment } from './storageBackend'

/**
 * IndexedDB を用いた永続化実装
 */
export const IndexedDatabaseStorage: StorageBackendConstructor = class IndexedDatabaseStorage implements StorageBackend {
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
  private currentBranch: string | null = null
  private static VAR_WORKSPACE_BASE = 'workspace-base'
  private static VAR_WORKSPACE_INFO = 'workspace-info'
  private static VAR_BASE = 'git-base'
  private static VAR_CONFLICT = 'git-conflict'
  private static VAR_INFO = 'git-info'
  private static DEFAULT_DB_NAME = 'apigit_storage'
  

  /** 利用可能な DB 名の一覧を返す
   * @returns {string[]} available root names
   */
  static async availableRoots(): Promise<string[]> {
    const g: any = globalThis as any
    const idb = g.indexedDB
    if (!idb) return []

    // If indexedDB.databases is not supported, return empty list
    if (typeof idb.databases !== 'function') return []

    // Delegate the actual retrieval to a helper to keep cognitive complexity low
    try {
      return await IndexedDatabaseStorage._namesFromDatabases(idb)
    } catch (error) {
      return []
    }
  }

  /**
   * Retrieve unique database names from `indexedDB.databases()` result.
   * @param idb IndexedDB global object
   * @returns {Promise<string[]>} unique database names
   */
  private static async _namesFromDatabases(idb: any): Promise<string[]> {
    const databases = await idb.databases()
    const names: string[] = []
    for await (const entry of (databases as any)) {
      if (entry && typeof entry.name === 'string') names.push(entry.name)
    }
    return Array.from(new Set(names))
  }
 

  /** コンストラクタ */
  constructor(root?: string) {
    this.dbName = root ?? IndexedDatabaseStorage.DEFAULT_DB_NAME
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
      const request = idb.open(this.dbName, 1)
      // Do not include test-only fallbacks in library code. If `open()`
      // returns a falsy value, treat it as an unsupported environment
      // and reject; test suites should provide a proper `indexedDB` shim
      // in their setup (e.g. `test/setupIndexedDB.js`).
      if (!request) return reject(new Error('indexedDB.open returned falsy request'))
      /**
       * Handle DB upgrade event
       * @param {Event} ev Upgrade event
       * @returns {void}
       */
      request.onupgradeneeded = (event: any) => this._handleUpgrade(event)
      /**
       * Handle open success
       * @returns {void}
       */
      request.onsuccess = () => this._onOpenSuccess(request, resolve)
      /**
       * Handle open error
       * @returns {void}
       */
      request.onerror = () => this._onOpenError(request, reject)
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
  private _handleUpgrade(event: any) {
    const database = (event.target as IDBOpenDBRequest).result
    if (!database.objectStoreNames.contains(IndexedDatabaseStorage.VAR_WORKSPACE_BASE)) database.createObjectStore(IndexedDatabaseStorage.VAR_WORKSPACE_BASE)
    if (!database.objectStoreNames.contains(IndexedDatabaseStorage.VAR_WORKSPACE_INFO)) database.createObjectStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO)
    if (!database.objectStoreNames.contains(IndexedDatabaseStorage.VAR_BASE)) database.createObjectStore(IndexedDatabaseStorage.VAR_BASE)
    if (!database.objectStoreNames.contains(IndexedDatabaseStorage.VAR_CONFLICT)) database.createObjectStore(IndexedDatabaseStorage.VAR_CONFLICT)
    if (!database.objectStoreNames.contains(IndexedDatabaseStorage.VAR_INFO)) database.createObjectStore(IndexedDatabaseStorage.VAR_INFO)
    if (!database.objectStoreNames.contains('index')) database.createObjectStore('index')
  }

  /**
   * 指定 DB に対する onversionchange ハンドラを生成します。
   */
  /**
   * Create a handler to close DB on version change.
   * @param dbParam Target DB
   * @returns {() => void}
   */
  private _makeVersionChangeHandler(databaseParameter: IDBDatabase) {
    return () => { databaseParameter.close() }
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
  private _onOpenSuccess(request: IDBOpenDBRequest, resolve: (_database: IDBDatabase) => void) {
    const database = request.result
    database.onversionchange = this._makeVersionChangeHandler(database)
    resolve(database)
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
  private _onOpenError(request: IDBOpenDBRequest, reject: (_error?: any) => void) {
    reject(request.error)
  }

  /**
   * トランザクションラッパー。cb 内の処理をトランザクションで実行し、
   * 必要なら再試行します。
   */
  /**
   * トランザクションラッパー。cb 内の処理をトランザクションで実行し、必要なら再試行します。
   * @returns {Promise<void>} トランザクション処理完了時に解決
   */
  private async tx(storeName: string, mode: IDBTransactionMode, callback: (_store: IDBObjectStore) => void | Promise<void>): Promise<void> {
    try { return await this._performTxAttempt(storeName, mode, callback) } catch (error: any) {
      const isInvalidState = error && (error.name === 'InvalidStateError' || /closing/i.test(String(error.message || '')))
      if (isInvalidState) { this.dbPromise = this.openDb(); return await this._performTxAttempt(storeName, mode, callback) }
      throw error
    }
  }

  /**
   * 単一トランザクション試行実行を行います。
   * @returns {Promise<void>} トランザクション処理完了時に解決
   */
  private async _performTxAttempt(storeName: string, mode: IDBTransactionMode, callback: (_store: IDBObjectStore) => void | Promise<void>): Promise<void> {
    const database = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction
      try {
        tx = database.transaction(storeName, mode)
      } catch (error) {
        return reject(error)
      }
      const storeObject = tx.objectStore(storeName)
      // Track whether any request-producing methods are invoked on the store.
      // If no requests are created, some fake IndexedDB implementations
      // never fire transaction.oncomplete; provide a safe fallback.
      let hasRequests = false
      const requestProducing = new Set(['put', 'get', 'delete', 'add', 'openCursor', 'openKeyCursor', 'clear'])

      // Create proxy store via helper to keep cognitive complexity down
      /**
       * Mark that request-producing calls were observed in the proxy.
       * @param {boolean} value flag
       * @returns {void}
       */
      function setHasRequests(value: boolean): void { hasRequests = value }
      const proxyStore = this._createProxyForStore(storeObject as any, requestProducing, setHasRequests)

      /** Transaction complete handler */
      const handleTxComplete = () => { resolve() }
      /** Transaction error handler */
      const handleTxError = () => { reject(tx.error) }

      Promise.resolve(callback(proxyStore)).then(() => {
        tx.oncomplete = handleTxComplete
        tx.onerror = handleTxError
        // If callback did not create any request-producing calls, many fake
        // IndexedDB implementations may not fire oncomplete. Schedule a
        // microtask to complete the transaction to avoid hanging tests.
        if (!hasRequests) {
          try {
            this._scheduleTxComplete(tx)
          } catch (error) {
            console.debug('scheduling tx completion failed', error)
          }
        }
      }).catch(reject)
    })
  }

  /**
   * Create a proxy wrapper for an IDBObjectStore that detects whether
   * request-producing methods were invoked.
   * @returns {Proxy<any>} proxied store object
   */
  private _createProxyForStore(storeObject: any, requestProducing: Set<string>, setHasRequests: (_value: boolean) => void) {
    return new Proxy(storeObject, {
      /**
       * Proxy get handler. Detect calls to request-producing methods.
       * @returns {any}
       */
      get: (target: any, property: string | symbol, _receiver: any) => {
        const orig = target[property]
        if (typeof orig === 'function') {
          /**
           * Wrapped function for original store method.
           * @returns {any}
           */
          return function (...arguments_: any[]) {
            try {
              if (typeof property === 'string' && requestProducing.has(property)) setHasRequests(true)
            } catch (error) {
              console.debug('proxy property detection failed', error)
            }
            return orig.apply(target, arguments_)
          }
        }
        return orig
      }
    })
  }

  /**
   * Schedule a microtask to invoke tx.oncomplete in case fake IndexedDB
   * implementations never fire it.
   */
  /**
   * Schedule a microtask to invoke tx.oncomplete in case fake IndexedDB
   * implementations never fire it.
   * @returns {void}
   */
  private _scheduleTxComplete(tx: IDBTransaction) {
    setTimeout(() => {
      try {
        if (typeof tx.oncomplete === 'function') tx.oncomplete(new Event('complete'))
      } catch (error) {
        console.debug('tx.oncomplete invocation failed', error)
      }
    }, 0)
  }

  // legacy canUseOpfs removed; use static canUse() instead

  /**
   * index を読み出す
   * @returns {Promise<IndexFile|null>} 読み出した IndexFile、存在しなければ null
   */
  async readIndex(): Promise<IndexFile | null> {
    const database = await this.dbPromise
    // Read meta from 'index' store then reconstruct entries from VAR_INFO
    const meta: IndexFile | null = await this._readIndexMeta(database)
    const result: IndexFile = { head: '', entries: {} }
    if (meta) {
      result.head = meta.head || ''
      if ((meta as any).lastCommitKey) result.lastCommitKey = (meta as any).lastCommitKey
      // Preserve adapter metadata if present
      if ((meta as any).adapter) result.adapter = (meta as any).adapter
      // set current branch from persisted adapter metadata so we only load info for that branch
      try {
        this.currentBranch = (meta as any).adapter && (meta as any).adapter.opts && (meta as any).adapter.opts.branch ? (meta as any).adapter.opts.branch : null
      } catch (_e) {
        this.currentBranch = null
      }
    }

    // Load workspace-local info first (workspace-info), then merge git-scoped info (.git/{branch}/info)
    try {
      const wsKeys = await this._listKeysFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO)
      for (const k of wsKeys) {
        const txt = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, k)
        if (!txt) continue
        try { result.entries[k] = JSON.parse(txt) } catch (_) { continue }
      }
    } catch (_) { /* ignore */ }
    // Then load git-scoped info entries for current branch, but do not overwrite workspace-local entries
    const keys = await this._listKeysFromStore(IndexedDatabaseStorage.VAR_INFO)
    const branch = this.currentBranch || 'main'
    for (const k of keys) {
      if (!k.startsWith(branch + '::')) continue
      const filepath = k.slice((branch + '::').length)
      if (result.entries[filepath]) continue
      const txt = await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, k)
      if (!txt) continue
      try { result.entries[filepath] = JSON.parse(txt) } catch (_) { continue }
    }

    return result
  }

  /**
   * Read the index metadata entry from the 'index' object store.
   * @param database open IDBDatabase instance
   * @returns {Promise<IndexFile|null>} parsed index metadata or null on error
   */
  private async _readIndexMeta(database: IDBDatabase): Promise<IndexFile | null> {
    return await new Promise<IndexFile | null>((resolve) => {
      try {
        const tx = database.transaction('index', 'readonly')
        const store = tx.objectStore('index')
        const request = store.get('index')
        /** Success handler for index get. @returns {void} */
        request.onsuccess = () => { resolve(request.result ?? null) }
        /** Error handler for index get. @returns {void} */
        request.onerror = () => { resolve(null) }
      } catch (_) { resolve(null) }
    })
  }

  /**
   * index を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeIndex(index: IndexFile): Promise<void> {
    // Write entries individually into info store, then write metadata into 'index'
    const entries = index.entries || {}
    // Only persist workspace-info for files that exist in workspace-base
    const toWrite: Array<{ k: string; v: any }> = []
    for (const filepath of Object.keys(entries)) {
      const exists = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_BASE, filepath).catch(() => null)
      if (exists === null) continue
      toWrite.push({ k: filepath, v: entries[filepath] })
    }
    if (toWrite.length > 0) {
      await this.tx(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, 'readwrite', async (store) => {
        for (const item of toWrite) store.put(JSON.stringify(item.v), item.k)
      })
    }
    await this.tx('index', 'readwrite', (store) => {
      const payload: any = { head: index.head }
      if ((index as any).lastCommitKey) payload.lastCommitKey = (index as any).lastCommitKey
      if ((index as any).adapter) payload.adapter = (index as any).adapter
      store.put(payload, 'index')
    })
  }

  /**
   * blob を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeBlob(filepath: string, content: string, segment?: Segment): Promise<void> {
    const seg: Segment = segment ?? 'workspace'
    // treat info-workspace specially
    if (seg === 'info-workspace') {
      await this.tx(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, 'readwrite', (store) => { store.put(content, filepath) })
      return
    }
    const storeName = seg === 'workspace' ? IndexedDatabaseStorage.VAR_WORKSPACE_BASE : seg === 'base' ? IndexedDatabaseStorage.VAR_BASE : seg === 'info' ? IndexedDatabaseStorage.VAR_INFO : IndexedDatabaseStorage.VAR_CONFLICT
    const branch = this.currentBranch || 'main'
    const key = seg === 'workspace' ? filepath : `${branch}::${filepath}`
    await this.tx(storeName, 'readwrite', (store) => { store.put(content, key) })

    // Do not recursively create info entry when writing into info store itself
    if (seg === 'info') return

    // Create/merge info metadata
    const sha = await this.shaOf(content)
    const now = Date.now()
    await this._updateInfoForWrite(filepath, seg, sha, now)
  }

  /**
   * Update info store entry for a written blob.
   * @returns {Promise<void>}
   */
  private async _updateInfoForWrite(filepath: string, seg: Segment, sha: string, now: number): Promise<void> {
    const branch = this.currentBranch || 'main'
    const infoKey = seg === 'workspace' ? filepath : `${branch}::${filepath}`
    // For workspace writes: if a git base exists, use git-scoped info as existing
    let existingTxt: string | null = null
    if (seg === 'workspace') {
      const gitBase = await this._getFromStore(IndexedDatabaseStorage.VAR_BASE, `${branch}::${filepath}`).catch(() => null)
      if (gitBase !== null) {
        existingTxt = await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${filepath}`).catch(() => null)
      } else {
        existingTxt = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, infoKey).catch(() => null)
      }
    } else {
      existingTxt = await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, infoKey).catch(() => null)
    }
    const existing: any = existingTxt ? JSON.parse(existingTxt) : {}
    let entry: any = { path: filepath, updatedAt: now }
    if (seg === 'workspace') entry = this._buildWorkspaceEntry(existing, filepath, sha, now)
    else if (seg === 'base') entry = this._buildBaseEntry(existing, filepath, sha, now)
    else if (seg === 'conflict') entry = this._buildConflictEntry(existing, filepath, now)
    if (seg === 'workspace') {
      await this.tx(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, 'readwrite', (store) => { store.put(JSON.stringify(entry), infoKey) })
    } else {
      await this.tx(IndexedDatabaseStorage.VAR_INFO, 'readwrite', (store) => { store.put(JSON.stringify(entry), infoKey) })
    }
  }

  /**
   * Build info entry for workspace writes.
   * @returns {any}
   */
  private _buildWorkspaceEntry(existing: any, filepath: string, sha: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.baseSha) entry.baseSha = existing.baseSha
    entry.workspaceSha = sha
    entry.state = entry.baseSha ? 'modified' : 'added'
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    return entry
  }

  /**
   * Build info entry for base writes.
   * @returns {any}
   */
  private _buildBaseEntry(existing: any, filepath: string, sha: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.workspaceSha) entry.workspaceSha = existing.workspaceSha
    entry.baseSha = sha
    entry.state = 'base'
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    return entry
  }

  /**
   * Build info entry for conflict writes.
   * @returns {any}
   */
  private _buildConflictEntry(existing: any, filepath: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.baseSha) entry.baseSha = existing.baseSha
    if (existing && existing.workspaceSha) entry.workspaceSha = existing.workspaceSha
    entry.state = 'conflict'
    return entry
  }
  /**
   * blob を読み出す
   * @returns {Promise<string|null>} ファイル内容、存在しなければ null
   */
  async readBlob(filepath: string, segment?: Segment): Promise<string | null> {
    const branch = this.currentBranch || 'main'
    if (segment !== undefined) {
      if (segment === 'info-git') {
        return await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${filepath}`)
      }
      if (segment === 'info-workspace') {
        return await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, filepath)
      }
      if (segment === 'info') {
        // prefer workspace-local info, then git-scoped
        const ws = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, filepath)
        if (ws !== null) return ws
        return await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${filepath}`)
      }
      const storeName = segment === 'workspace' ? IndexedDatabaseStorage.VAR_WORKSPACE_BASE : segment === 'base' ? IndexedDatabaseStorage.VAR_BASE : segment === 'conflict' ? IndexedDatabaseStorage.VAR_CONFLICT : IndexedDatabaseStorage.VAR_BASE
      const key = segment === 'workspace' ? filepath : `${branch}::${filepath}`
      return await this._getFromStore(storeName, key)
    }

    // segment未指定の場合はworkspace-base→git-baseの順で参照
    const workspaceContent = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_BASE, filepath)
    if (workspaceContent !== null) return workspaceContent
    return await this._getFromStore(IndexedDatabaseStorage.VAR_BASE, `${branch}::${filepath}`)
  }

  /**
           * blob を削除する
   * @returns {Promise<void>} 削除完了時に解決
   */
  async deleteBlob(filepath: string, segment?: Segment): Promise<void> {
    const branch = this.currentBranch || 'main'
    if (segment === 'workspace') { await this._deleteFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_BASE, filepath); await this._deleteFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, filepath); return }
    if (segment === 'base') { await this._deleteFromStore(IndexedDatabaseStorage.VAR_BASE, `${branch}::${filepath}`); return }
    if (segment === 'conflict') { await this._deleteFromStore(IndexedDatabaseStorage.VAR_CONFLICT, `${branch}::${filepath}`); return }
    if (segment === 'info') {
      // remove both workspace-local info and git-scoped info for current branch
      await this._deleteFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, filepath)
      await this._deleteFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${filepath}`)
      return
    }
    // segment未指定の場合はすべてのセグメントから削除
    await this._deleteFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_BASE, filepath)
    await this._deleteFromStore(IndexedDatabaseStorage.VAR_BASE, `${branch}::${filepath}`)
    await this._deleteFromStore(IndexedDatabaseStorage.VAR_CONFLICT, `${branch}::${filepath}`)
    await this._deleteFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${filepath}`)
    await this._deleteFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, filepath)
  }

  /**
   * Read a value from a specific object store.
   * @param storeName Object store name
   * @param filepath Key to read
   * @returns {Promise<string|null>} value or null
   */
  private async _getFromStore(storeName: string, filepath: string): Promise<string | null> {
    const database = await this.dbPromise
    return new Promise<string | null>((resolve) => {
      try {
        const tx = database.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const request = store.get(filepath)
        /**
         * Index get success handler
         * @returns {void}
         */
        request.onsuccess = function () { resolve(request.result ?? null) }
        /**
         * Index get error handler
         * @returns {void}
         */
        request.onerror = function () { resolve(null) }
      } catch (_) { resolve(null) }
    })
  }

  /**
   * List all keys in an object store.
   * @returns {Promise<string[]>} Array of keys contained in the store
   */
  private async _listKeysFromStore(storeName: string): Promise<string[]> {
    const database = await this.dbPromise
    return new Promise<string[]>((resolve) => {
      try {
        const tx = database.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const keys: string[] = []
        const request = store.openKeyCursor()
        /**
         * Cursor success handler: collect keys.
         * @param ev Event from cursor
         * @returns {void}
         */
        request.onsuccess = function (event: any) {
          const current = event.target.result
            if (!current) { resolve(keys); return }
            if (current.key !== undefined) {
              keys.push(current.key as string)
            }
            current.continue()
        }
        /**
         * Cursor error handler: resolve with collected keys so far.
         * @returns {void}
         */
        request.onerror = function () { resolve(keys) }
      } catch (_) { resolve([]) }
    })
  }

  /**
   * 指定プレフィックス配下のファイル一覧を取得します。
   * @param prefix プレフィックス（省略時はルート）
   * @param segment セグメント（省略時は workspace）
   * @param recursive サブディレクトリも含めるか。省略時は true
    * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  async listFiles(prefix?: string, segment?: Segment, recursive = true): Promise<Array<{ path: string; info: string | null }>> {
    const seg: Segment = segment ?? 'workspace'
    const storeName = seg === 'workspace' ? IndexedDatabaseStorage.VAR_WORKSPACE_BASE : seg === 'base' ? IndexedDatabaseStorage.VAR_BASE : seg === 'info' ? IndexedDatabaseStorage.VAR_INFO : IndexedDatabaseStorage.VAR_CONFLICT

    let keys: string[]
    try {
      keys = await this._listKeysFromStore(storeName)
    } catch (_) {
      keys = []
    }

    const p = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    // For non-workspace stores, keys include branch prefix. Filter and strip it.
    if (seg !== 'workspace') {
      const branch = this.currentBranch || 'main'
      keys = keys.filter((k) => k.startsWith(branch + '::')).map((k) => k.slice((branch + '::').length))
    }
    keys = this._filterKeys(keys, p, recursive)
    return await this._collectFiles(keys, seg)
  }

  /**
   * Filter keys by prefix and recursion flag.
   * @returns {string[]}
   */
  private _filterKeys(keys: string[], p: string, recursive: boolean): string[] {
    if (p) keys = keys.filter((k) => k === p || k.startsWith(p + '/'))
    if (!recursive) {
      keys = keys.filter((k) => {
        const rest = p ? k.slice(p.length + (p ? 1 : 0)) : k
        return !rest.includes('/')
      })
    }
    return keys
  }

  /**
   * Collect file info objects for keys array.
   * @returns {Promise<Array<{path:string, info:string|null}>>}
   */
  private async _collectFiles(keys: string[], seg: Segment): Promise<Array<{ path: string; info: string | null }>> {
    const out: Array<{ path: string; info: string | null }> = []
    const branch = this.currentBranch || 'main'
    for (const k of keys) {
      // Prefer workspace-local info, then git-scoped info
      let info: string | null = await this._getFromStore(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, k)
      if (info === null) info = await this._getFromStore(IndexedDatabaseStorage.VAR_INFO, `${branch}::${k}`)
      out.push({ path: k, info })
    }
    return out
  }

  /**
   * Calculate SHA-1 hex digest of given content.
   * @param content Input string
   * @returns {Promise<string>} Hex encoded SHA-1 digest
   */
  private async shaOf(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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

  /**
  * 指定された DB 名を削除します
  * @param databaseName 削除する DB 名
  * @returns {Promise<void>}
  */
  static async delete(databaseName: string): Promise<void> {
    try {
      const idb = (globalThis as any).indexedDB
      if (!idb) throw new Error('IndexedDB is not available')
      
      return new Promise((resolve, reject) => {
        const request = idb.deleteDatabase(databaseName)
        if (!request) return reject(new Error('indexedDB.deleteDatabase returned falsy request'))
        
        /** Success handler for deleteDatabase. @returns {void} */
        request.onsuccess = function () { resolve() }
        /** Error handler for deleteDatabase. @returns {void} */
        request.onerror = function () { reject(new Error(`Failed to delete IndexedDB: ${request.error?.message}`)) }
        /** Blocked handler for deleteDatabase. @returns {void} */
        request.onblocked = function () {
          // DB is still in use, but allow the deletion to proceed
          console.warn(`IndexedDB deletion is blocked for "${databaseName}", but proceeding`)
        }
      })
    } catch (error) {
      throw new Error(`Failed to delete IndexedDB "${databaseName}": ${String(error)}`)
    }
  }
}

export default IndexedDatabaseStorage
