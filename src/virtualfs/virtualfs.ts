import { IndexFile, AdapterMeta, AdapterOptions, AdapterOptionsBase } from './types.ts'
import { parseAdapterFromUrl, buildUrlFromAdapterOptions } from './utils/urlParser.ts'
import { StorageBackend } from './storageBackend.ts'
import { OpfsStorage } from './opfsStorage.ts'
import { GitHubAdapter } from '../git/githubAdapter.ts'
import { GitLabAdapter } from '../git/gitlabAdapter.ts'
import { Logger } from '../git/abstractAdapter.ts'
import type { CommitHistoryQuery, CommitHistoryPage } from '../git/adapter.ts'
import type { BranchListQuery, BranchListPage, RepositoryMetadata } from './types.ts'
import { shaOf } from './hashUtils.ts'
import { LocalChangeApplier } from './localChangeApplier.ts'
import { LocalFileManager } from './localFileManager.ts'
import { IndexManager } from './indexManager.ts'
import { ChangeTracker } from './changeTracker.ts'
import { ConflictManager } from './conflictManager.ts'
import { RemoteSynchronizer } from './remoteSynchronizer.ts'

export type RemoteSnapshotDescriptor = {
  headSha: string
  shas: Record<string, string>
  fetchContent: (_paths: string[]) => Promise<Record<string, string>>
}

/** Virtual file system - 永続化バックエンドを抽象化した仮想ファイルシステム */
export class VirtualFS {
  // adapter instance managed by VirtualFS
  private adapter: any | null = null
  // optional logger injected via constructor options; propagated to adapters when present
  private logger?: Logger
  // adapter metadata persisted in index
  private adapterMeta: AdapterMeta | null = null
  // `workspace` state moved to StorageBackend implementations; tombstones are
  // persisted in the backend as `info` entries with `state: 'deleted'.`.
  private indexManager: IndexManager
  private backend: StorageBackend
  private applier: LocalChangeApplier
  private localFileManager: LocalFileManager
  private changeTracker: ChangeTracker
  private conflictManager: ConflictManager
  private remoteSynchronizer: RemoteSynchronizer

  /**
   * VirtualFS のインスタンスを初期化します。
   * @param {Object} [options] - オプションセット
   * @param {StorageBackend} [options.backend] - ストレージバックエンド
   * @param {Logger} [options.logger] - ロガーインスタンス
   * @returns {void}
   */
  constructor(options?: { backend?: StorageBackend; logger?: Logger }) {
    if (options?.backend) this.backend = options.backend
    else this.backend = new OpfsStorage('default')
    // capture optional logger for adapter propagation
    if (options && options.logger) this.logger = options.logger
    this.applier = new LocalChangeApplier(this.backend)
    this.localFileManager = new LocalFileManager(this.backend)
    this.indexManager = new IndexManager(this.backend)
    this.changeTracker = new ChangeTracker(this.backend, this.indexManager)
    this.conflictManager = new ConflictManager(this.backend, this.indexManager)
    this.remoteSynchronizer = new RemoteSynchronizer(this.backend, this.indexManager, this.conflictManager, this.applier)
  }

  /**
   * public-facing property accessors for backwards compatibility with tests
   * @returns {string}
   */
  get head(): string {
    return this.indexManager.getHead()
  }

  /**
   * Setter for head
   * @param {string} h - head value
   * @returns {void}
   */
  set head(h: string) {
    this.indexManager.setHead(h)
  }

  /**
   * Get lastCommitKey
   * @returns {string|undefined}
   */
  get lastCommitKey(): string | undefined {
    return this.indexManager.getLastCommitKey()
  }

  /**
   * Set lastCommitKey
   * @param {string|undefined} k
   * @returns {void}
   */
  set lastCommitKey(k: string | undefined) {
    this.indexManager.setLastCommitKey(k)
  }

  /**
   * VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。
   * @returns {Promise<void>}
   */
  async init() {
    await this.backend.init()
    await this.loadIndex()
  }

  /**
   * 永続化レイヤーから index を読み込み、内部マップを初期化します。
   * @returns {Promise<void>}
   */
  private async loadIndex() {
    await this.indexManager.loadIndex()
    try {
      const index = await this.indexManager.getIndex()
      this.adapterMeta = (index as any).adapter || null
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('loadIndex getIndex failed', error)
      this.adapterMeta = null
    }
  }

  /**
   * Set adapter instance and persist adapter metadata into index file.
   * Supports overloads:
   * - setAdapter(meta: AdapterMeta)
   * - setAdapter(type: string, url: string, branch?: string, token?: string)
   * - setAdapter(url: string, branch?: string, token?: string)
   * @param {AdapterMeta|string} metaOrTypeOrUrl
   * @returns {Promise<void>}
   */
  async setAdapter(metaOrTypeOrUrl?: AdapterMeta | string) {
    // keep declared arity of 1 for backwards-compatible tests; use arguments for overloads
    const argument1 = (arguments as any)[1]
    const argument2 = (arguments as any)[2]
    const argument3 = (arguments as any)[3]
    const meta = this._parseAdapterArgs(metaOrTypeOrUrl as any, argument1, argument2, argument3)
    if (!meta || typeof meta.type !== 'string') throw new Error('Adapter meta is required')
    this.adapterMeta = meta
    await this._tryPersistAdapterMeta()
  }

  /**
   * Parse arguments for `setAdapter` and return a fully normalized AdapterMeta.
   * The result always has {type, url, branch, token, opts} at the top level.
   * Accepts AdapterMeta, (type, url, branch?, token?), or (url, branch?, token?).
   * @param metaOrTypeOrUrl AdapterMeta or type or url
   * @param argument1 url (when first is type) OR branch (when first is url) OR undefined
   * @param argument2 branch (when first is type) OR token (when first is url) OR undefined
   * @param argument3 token (when first is type) OR undefined
   * @returns normalized AdapterMeta
   */
  private _parseAdapterArgs(metaOrTypeOrUrl: AdapterMeta | string, argument1?: string, argument2?: string, argument3?: string): AdapterMeta {
    // Overload 1: object (AdapterMeta)
    if (typeof metaOrTypeOrUrl === 'object' && metaOrTypeOrUrl !== null) {
      return this._normalizeFromMeta(metaOrTypeOrUrl as AdapterMeta)
    }
    const firstArgument = metaOrTypeOrUrl as string
    // Distinguish "type + url" vs "url only": if argument1 looks like a URL (starts with http)
    // then firstArgument is a "type"; otherwise firstArgument is a URL itself.
    const isTypeUrlForm = typeof argument1 === 'string' && /^https?:\/\//i.test(argument1)
    if (isTypeUrlForm) {
      // Overload 2: setAdapter(type, url, branch?, token?)
      return this._normalizeFromTypeUrl(firstArgument, argument1!, argument2, argument3)
    }
    // Overload 3: setAdapter(url, branch?, token?)
    return this._normalizeFromUrl(firstArgument, argument1, argument2)
  }

  /**
   * Normalize from AdapterMeta object – generate url from opts if missing.
   * @param meta raw AdapterMeta input
   * @returns fully normalized AdapterMeta
   */
  private _normalizeFromMeta(meta: AdapterMeta): AdapterMeta {
    const type = meta.type
    const rawOptions = (meta as any).opts || (meta as any).options || {}
    const options = this._stripOptionsFields(rawOptions)
    let url = meta.url
    if (!url) {
      try { url = buildUrlFromAdapterOptions(type, options) } catch { url = undefined }
    }
    const branch = meta.branch || rawOptions.branch || 'main'
    const token = meta.token || rawOptions.token || undefined
    return { type, url, branch, token, opts: options }
  }

  /**
   * Normalize from (type, url, branch?, token?) arguments.
   * @param type adapter type
   * @param url repository url
   * @param branch optional branch (defaults to 'main')
   * @param token optional token
   * @returns fully normalized AdapterMeta
   */
  private _normalizeFromTypeUrl(type: string, url: string, branch?: string, token?: string): AdapterMeta {
    const parsed = parseAdapterFromUrl(url, token, type as any)
    const options = this._stripOptionsFields(parsed.opts || {})
    return { type: parsed.type, url, branch: branch || 'main', token, opts: options }
  }

  /**
   * Normalize from (url, branch?, token?) arguments.
   * @param url repository url
   * @param branch optional branch (defaults to 'main')
   * @param token optional token
   * @returns fully normalized AdapterMeta
   */
  private _normalizeFromUrl(url: string, branch?: string, token?: string): AdapterMeta {
    const parsed = parseAdapterFromUrl(url, token)
    const options = this._stripOptionsFields(parsed.opts || {})
    return { type: parsed.type, url, branch: branch || 'main', token, opts: options }
  }

  /**
   * Strip branch/token from options to avoid duplication (they live at the top level).
   * Returns a new object with only host, owner, repo, projectId, etc.
   * @param options raw adapter options
   * @returns cleaned options without branch/token
   */
  private _stripOptionsFields(options: any): AdapterOptions {
    if (!options || typeof options !== 'object') return {} as any
    const cleaned = { ...options }
    delete cleaned.branch
    delete cleaned.token
    delete cleaned.defaultBranch
    delete cleaned.repositoryName
    delete cleaned.repositoryId
    return cleaned as AdapterOptions
  }

  /**
   * Return the persisted branch name from adapterMeta (top-level or opts fallback).
   * Defaults to 'main' when not found.
   * @returns {string} persisted branch name
   */
  private _getPersistedBranch(): string {
    if (!this.adapterMeta) return 'main'
    return this.adapterMeta.branch || (this.adapterMeta.opts && this.adapterMeta.opts.branch) || 'main'
  }

  /**
   * Try to inject the configured logger into the adapter instance (best-effort).
   * @returns {Promise<void>}
   */
  private async _tryInjectLogger(): Promise<void> {
    try {
      if (this.adapter && this.logger && typeof (this.adapter as any).setLogger === 'function') {
        (this.adapter as any).setLogger(this.logger)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('adapter.setLogger failed', error)
    }
  }

  /**
   * Persist adapter metadata into the index file (best-effort).
   * @returns {Promise<void>}
   */
  private async _tryPersistAdapterMeta(): Promise<void> {
    try {
      const index = await this.indexManager.getIndex()
      if (this.adapterMeta) (index as any).adapter = this.adapterMeta
      else delete (index as any).adapter
      await this.backend.writeIndex(index)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('writeIndex failed', error)
    }
  }

  /**
   * Return persisted adapter metadata from the index (or cached meta).
   * This does not necessarily instantiate the adapter instance; use
   * `getAdapterInstance()` to obtain an instantiated adapter.
   * @returns {Promise<any|null>}
   */
  async getAdapter(): Promise<any | null> {
    if (this.adapterMeta) return this.adapterMeta
    try {
      const index = await this.indexManager.getIndex()
      const persisted = (index as any).adapter || null
      // validate persisted shape
      if (persisted && typeof persisted.type === 'string') {
        this.adapterMeta = persisted as AdapterMeta
        return this.adapterMeta
      }
      this.adapterMeta = null
      return null
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('getAdapter getIndex failed', error)
      return null
    }
  }

  /**
   * Return or lazily create the adapter instance based on persisted metadata.
   * @returns {Promise<any|null>}
   */
  async getAdapterInstance(): Promise<any | null> {
    if (this.adapter) return this.adapter
    // ensure adapterMeta populated from loaded index
    if (!this.adapterMeta) await this._ensureAdapterMetaLoaded()
    if (!this.adapterMeta || !this.adapterMeta.type) return null
    const type = this.adapterMeta.type
    const options = this.adapterMeta.opts || {}
    // instantiate via helper to reduce cognitive complexity for linter
    const created = this._instantiateAdapter(type, options)
    if (created) this.adapter = created
    return this.adapter || null
  }

  /**
   * Load adapterMeta from index if not present.
   * @returns {Promise<void>}
   */
  private async _ensureAdapterMetaLoaded(): Promise<void> {
    try {
      const index = await this.indexManager.getIndex()
      this.adapterMeta = (index as any).adapter || null
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('getAdapterInstance helper getIndex failed', error)
      this.adapterMeta = null
    }
  }

  /**
   * Create adapter instance for given type and options. Returns null on failure.
   * @param {string} type - adapter type string
   * @param {any} options - adapter options
   * @returns {any|null}
   */
  private _instantiateAdapter(type: string, options: any): any | null {
    try {
      // Merge in token from top-level adapterMeta (stripped from opts to avoid duplication)
      // and logger if available so created adapters receive it via DI
      const optionsWithLogger = { ...(options || {}) } as any
      if (this.adapterMeta && this.adapterMeta.token && !optionsWithLogger.token) {
        optionsWithLogger.token = this.adapterMeta.token
      }
      if (this.logger) optionsWithLogger.logger = this.logger
      if (type === 'github') return new GitHubAdapter(optionsWithLogger)
      if (type === 'gitlab') return new GitLabAdapter(optionsWithLogger)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('instantiate adapter failed', error)
      return null
    }
    return null
  }

  /**
   * Helper: obtain backend listFilesRaw in a safe manner.
   * @returns {Promise<any[]>}
   */
  private async _getBackendFilesRaw(): Promise<any[]> {
    try {
      if (this.backend && typeof (this.backend as any).listFilesRaw === 'function') {
        return await (this.backend as any).listFilesRaw()
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_getBackendFilesRaw failed', error)
    }
    return []
  }

  /**
   * Helper: apply parsed info text into stats object when possible.
   * @param infoTxt raw info text
   * @param stats stats object to mutate
   * @returns {void}
   */
  private _applyInfoTxtToStats(infoTxt: any, stats: any): void {
    if (!infoTxt) return
    try {
      const info = JSON.parse(infoTxt)
      if (typeof info.baseSha === 'string') stats.gitBlobSha = info.baseSha
      if (typeof info.updatedAt === 'number') stats.mtime = new Date(info.updatedAt)
      if (typeof info.size === 'number') stats.size = info.size
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('parse info failed', error)
    }
  }

  /**
   * Find a matched backend entry for the given filepath.
   * @param filepath target filepath
   * @param filesRaw backend raw listing
   * @returns {any|null}
   */
  private _findMatchedFile(filepath: string, filesRaw: Array<any>): any | null {
    if (!Array.isArray(filesRaw)) return null
    return filesRaw.find((f: any) => {
      if (!f || !f.path) return false
      return f.path === filepath || f.path.endsWith('/' + filepath) || f.path.endsWith('\/' + filepath)
    })
  }

  /**
   * Create default stats object with consistent shape.
   * @param now current Date
   * @returns {any}
   */
  private _createDefaultStats(now: Date): any {
    return {
      dev: 0,
      ino: 0,
      mode: 0o100644,
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      size: 0,
      blksize: undefined,
      blocks: undefined,
      atime: now,
      mtime: now,
      ctime: now,
      birthtime: now,
      /** @returns {boolean} */
      isFile: () => true,
      /** @returns {boolean} */
      isDirectory: () => false,
    }
  }
  /**
   * Populate stats.gitCommitSha from adapterMeta if available.
   * @param stats stats object to mutate
   * @returns {void}
   */
  private _populateCommitShaFromMeta(stats: any): void {
    const branch = this._getPersistedBranch()
    if (!stats.gitCommitSha && branch && branch !== 'main') {
      stats.gitCommitSha = branch
    }
  }

  /**
   * Try to resolve commit SHA from an instantiated adapter when needed.
   * @param stats stats object to mutate
   * @returns {Promise<void>}
   */
  private async _resolveCommitShaFromAdapter(stats: any): Promise<void> {
    const instAdapter = await this._safeGetAdapterInstance()
    if (!instAdapter || stats.gitCommitSha) return
    if (typeof instAdapter.resolveRef !== 'function') return
    try {
      const branch = this._getPersistedBranch()
      const resolved = await instAdapter.resolveRef(branch)
      if (resolved) stats.gitCommitSha = resolved
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_resolveCommitShaFromAdapter resolveRef failed', error)
    }
  }

  /**
   * Safely get adapter instance, returning null on error.
   * @returns {Promise<any|null>}
   */
  private async _safeGetAdapterInstance(): Promise<any | null> {
    try {
      return await this.getAdapterInstance()
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_safeGetAdapterInstance failed', error)
      return null
    }
  }

  /**
   * Helper: populate stats.gitCommitSha using adapterMeta or adapter.resolveRef when available.
   * @param stats stats object to mutate
   * @returns {Promise<void>}
   */
  private async _resolveAdapterCommitShaIfNeeded(stats: any): Promise<void> {
    this._populateCommitShaFromMeta(stats)
    if (!stats.gitCommitSha) await this._resolveCommitShaFromAdapter(stats)
  }

  /**
   * Determine whether a normalized path is an exact file entry in the provided entries.
   * @param normalizedDirectory normalized directory string
   * @param keys index keys array
   * @param entries index entries object
   * @returns {boolean}
   */
  private _isExactFile(normalizedDirectory: string, keys: string[], entries: any): boolean {
    return keys.includes(normalizedDirectory) && (entries as any)[normalizedDirectory] && (entries as any)[normalizedDirectory].state !== 'deleted'
  }

  /**
   * Collect immediate child names from index entries for given directory.
   * @param normalizedDirectory normalized directory string
   * @param entries index entries object
   * @returns {Set<string>} set of immediate child names
   */
  private _collectNamesFromIndex(normalizedDirectory: string, entries: any): Set<string> {
    const outNames = new Set<string>()
    const keys = Object.keys(entries || {})
    for (const k of keys) {
      const v = (entries as any)[k]
      if (v && v.state === 'deleted') continue

      if (normalizedDirectory === '.' || normalizedDirectory === '') {
        this._collectNamesFromIndexRoot(k, outNames)
        continue
      }

      this._processIndexKeyForDirectory(k, normalizedDirectory, outNames)
    }
    return outNames
  }

  /**
   * Process a single index key for a non-root directory and add immediate child when applicable.
   * @param key index key
   * @param normalizedDirectory normalized directory string
   * @param outNames set to mutate
   * @returns {void}
   */
  private _processIndexKeyForDirectory(key: string, normalizedDirectory: string, outNames: Set<string>): void {
    if (key === normalizedDirectory) return
    if (key.startsWith(normalizedDirectory + '/')) {
      const rest = key.slice(normalizedDirectory.length + 1)
      const first = rest.indexOf('/') === -1 ? rest : rest.slice(0, rest.indexOf('/'))
      outNames.add(first)
    }
  }

  /**
   * Safe wrapper for backend.listFiles returning [] on failure.
   * @param normalizedDirectory directory path
   * @returns {Promise<any[]>}
   */
  private async _getBackendList(normalizedDirectory: string): Promise<any[]> {
    try {
      return await (this.backend as any).listFiles(normalizedDirectory, undefined, false)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_getBackendList failed', error)
      return []
    }
  }

  /**
   * Helper for collecting names when scanning root directory entries.
   * @param key index key
   * @param outNames set to mutate
   * @returns {void}
   */
  private _collectNamesFromIndexRoot(key: string, outNames: Set<string>): void {
    const first = key.indexOf('/') === -1 ? key : key.slice(0, key.indexOf('/'))
    outNames.add(first)
  }

  /**
   * Check whether normalizedDirectory corresponds to an exact file entry.
   * @param normalizedDirectory normalized directory string
   * @param entries index entries object
   * @returns {boolean}
   */
  private _hasExactEntry(normalizedDirectory: string, entries: any): boolean {
    const keys = Object.keys(entries || {})
    return this._isExactFile(normalizedDirectory, keys, entries)
  }

  /**
   * Consult backend.listFiles to collect immediate child names for given directory.
  /**
   * Best-effort: logs and returns empty set on failure.
   * @param {string} normalizedDirectory - normalized directory string
   * @returns {Promise<Set<string>>}
   */
  private async _collectNamesFromBackend(normalizedDirectory: string): Promise<Set<string>> {
    const outNames = new Set<string>()
    if (!this._backendSupportsListFiles()) return outNames
    const backendList = await this._getBackendList(normalizedDirectory)
    if (!Array.isArray(backendList) || backendList.length === 0) return outNames
    for (const it of backendList) this._processBackendEntry(it, normalizedDirectory, outNames)
    return outNames
  }

  /**
   * Return true when backend supports listFiles
   * @returns {boolean}
   */
  private _backendSupportsListFiles(): boolean {
    return !!(this.backend && typeof (this.backend as any).listFiles === 'function')
  }

  /**
   * Process a single backend listFiles entry and add immediate child name to outNames when applicable.
   * @param it backend entry
   * @param normalizedDirectory normalized directory string
   * @param outNames set to mutate
   * @returns {void}
   */
  private _processBackendEntry(it: any, normalizedDirectory: string, outNames: Set<string>): void {
    try {
      if (!it || !it.path) return
      const p = it.path
      if (p === normalizedDirectory) return
      if (p.startsWith(normalizedDirectory + '/')) {
        const rest = p.slice(normalizedDirectory.length + 1)
        const first = rest.indexOf('/') === -1 ? rest : rest.slice(0, rest.indexOf('/'))
        outNames.add(first)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_processBackendEntry failed', error)
    }
  }

  /**
   * Build Dirent-like lightweight objects for given names.
   * @param names array of names
   * @param keys array of index keys
   * @param entries index entries object
   * @param normalizedDirectory normalized directory string
   * @returns {Array<any>} array of Dirent-like objects
   */
  private _buildDirentTypes(names: string[], keys: string[], entries: any, normalizedDirectory: string): Array<any> {
    const out: Array<any> = []
    for (const name of names) {
      const childPath = normalizedDirectory === '.' ? name : `${normalizedDirectory}/${name}`
      const { isFile, isDirectory } = this._determineChildType(childPath, keys, entries)
      /** @returns {boolean} */
      const _isFileFunction = function () { return isFile && !isDirectory }
      /** @returns {boolean} */
      const _isDirectoryFunction = function () { return isDirectory }
      out.push({ name, isFile: _isFileFunction, isDirectory: _isDirectoryFunction })
    }
    return out
  }

  /**
   * Determine whether a childPath corresponds to a file, directory, or both.
   * @param childPath path of child
   * @param keys index keys
   * @param entries index entries
   * @returns {{isFile:boolean,isDirectory:boolean}}
   */
  private _determineChildType(childPath: string, keys: string[], entries: any): { isFile: boolean; isDirectory: boolean } {
    let isDirectory = false
    let isFile = false
    for (const k of keys) {
      if (k === childPath && (entries as any)[k] && (entries as any)[k].state !== 'deleted') {
        isFile = true
      }
      if (k.startsWith(childPath + '/')) {
        isDirectory = true
        break
      }
    }
    return { isFile, isDirectory }
  }

  /**
   * Return persisted adapter metadata (if any).
   * @returns {any|null}
   */
  getAdapterMeta(): any | null {
    return this.adapterMeta
  }

  /**
   * ファイルを書き込みます（ローカル編集）。
   * @param {string} filepath ファイルパス
   * @param {string} content コンテンツ
   * @returns {Promise<void>}
   */
  async writeFile(filepath: string, content: string) {
    // delegate workspace write to LocalFileManager then reload index
    await this.localFileManager.writeFile(filepath, content)
    await this.loadIndex()
  }



  /**
   * rename を delete + create の合成で行うヘルパ
   * @param from 元パス
   * @param to 新パス
   */
  async renameFile(from: string, to: string) {
    // Use readFile to obtain actual content from workspace, backend blob, or base.
    const content = await this.readFile(from)
    if (content === null) throw new Error('source not found')

    // create new workspace entry with the same content
    await this.writeFile(to, content)

    // delete original path (creates tombstone if base existed)
    await this.unlink(from)
  }

  /**
   * ワークスペース/ベースからファイル内容を読み出します。
   * @param {string} filepath ファイルパス
   * @returns {Promise<string|null>} ファイル内容または null
   */
  async readFile(filepath: string) {
    // Try workspace/base first
    let content = await this.localFileManager.readFile(filepath)
    if (content !== null) return content

    // On-demand: attempt to fetch base via RemoteSynchronizer using adapter if available
    try {
      const adapter = await this.getAdapterInstance()
      if (adapter && this.remoteSynchronizer && typeof (this.remoteSynchronizer as any).fetchBaseIfMissing === 'function') {
        await (this.remoteSynchronizer as any).fetchBaseIfMissing(filepath, adapter)
        // re-check after on-demand fetch
        content = await this.localFileManager.readFile(filepath)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('readFile on-demand fetch failed', error)
    }

    return content
  }

  /**
   * 衝突ファイル（.git-conflict/配下）を取得します。
   * @param {string} filepath ファイルパス
   * @returns {Promise<string|null>} ファイル内容または null
   */
  async readConflict(filepath: string) {
    return await this.conflictManager.readConflict(filepath)
  }

  /**
   * fs.stat 互換: 指定ファイルのメタ情報を返す
   * ワークスペース上の情報を優先し、未取得時は Git のメタ情報で補完する。
   * @param {string} filepath - ファイルパス
   * @returns {Promise<any>} stats オブジェクト
   */
  async stat(filepath: string) {
    if (!filepath || typeof filepath !== 'string') throw new TypeError('filepath is required')

    // consult backend listing to determine workspace presence
    const filesRaw: Array<any> = await this._getBackendFilesRaw()
    const matched = this._findMatchedFile(filepath, filesRaw)

    const now = new Date()
    const stats: any = this._createDefaultStats(now)

    // try to read info blob to extract baseSha or other metadata
    try {
      const infoTxt = await (this.backend as any).readBlob(filepath, 'info')
      this._applyInfoTxtToStats(infoTxt, stats)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('stat readBlob failed', error)
    }

    // include workspace presence marker when matched
    if (matched) {
      stats.workspacePath = matched.path
    }

    // include adapter/commit/branch identifiers when possible
    await this._resolveAdapterCommitShaIfNeeded(stats)

    return stats
  }

  /**
   * fs.unlink 互換: ファイルを削除する
   * @param {string} filepath - ファイルパス
   * @returns {Promise<void>}
   */
  async unlink(filepath: string) {
    if (!filepath || typeof filepath !== 'string') throw new TypeError('filepath is required')
    // Delegate to LocalFileManager.deleteFile (workspace/internal)
    await this.localFileManager.deleteFile(filepath)
    await this.loadIndex()
  }

  /**
   * fs.mkdir 互換 (簡易実装): workspace 側にディレクトリ情報を書き込む
   * @param {string} dirpath - ディレクトリパス
   * @param {Object} [_options] - optional options
   * @param {boolean} [_options.recursive] - recursive flag
   * @param {number} [_options.mode] - mode flag
   * @returns {Promise<void>}
   */
  async mkdir(dirpath: string, _options?: { recursive?: boolean; mode?: number }) {
    if (!dirpath || typeof dirpath !== 'string') throw new TypeError('dirpath is required')
    // Best-effort: create an info entry to mark directory
    const info = { path: dirpath, state: 'dir', createdAt: Date.now() }
    if (this.backend && typeof (this.backend as any).writeBlob === 'function') {
      await (this.backend as any).writeBlob(dirpath, JSON.stringify(info), 'info-workspace').catch((error: any) => { throw Object.assign(new Error('ディレクトリ作成失敗'), { code: 'EEXIST', cause: error }) })
    }
  }

  /**
   * fs.rmdir 互換 (簡易実装)
   * @param {string} dirpath - ディレクトリパス
   * @param {Object} [options] - optional options
   * @param {boolean} [options.recursive] - recursive delete flag
   * @returns {Promise<void>}
   */
  async rmdir(dirpath: string, options?: { recursive?: boolean }) {
    if (!dirpath || typeof dirpath !== 'string') throw new TypeError('dirpath is required')
    // Build children list from the reconstructed index paths so that
    // workspace-local entries (as returned by listPaths) are accurately
    // detected regardless of backend-specific URI prefixes.
    const children = await this._listChildrenOfDir(dirpath)
    if (children.length > 0 && !(options && options.recursive)) {
      const errorObject: any = new Error('Directory not empty')
      errorObject.code = 'ENOTEMPTY'
      throw errorObject
    }
    if (options && options.recursive) await this._deleteChildrenRecursive(children)
  }

  /**
   * Return list of child paths for given dirpath based on index entries.
   * @param {string} dirpath - directory path
   * @returns {Promise<string[]>} array of child paths
   */
  private async _listChildrenOfDir(dirpath: string): Promise<string[]> {
    const paths = await this.listPaths()
    return paths.filter((p) => p === dirpath || p.startsWith(dirpath + '/'))
  }

  /**
   * Delete array of children using localFileManager, logging failures per-child.
   * @param {string[]} children - array of paths to delete
   * @returns {Promise<void>}
   */
  private async _deleteChildrenRecursive(children: string[]): Promise<void> {
    for (const p of children) {
      try {
        await this.localFileManager.deleteFile(p)
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('rmdir recursive delete failed for', p, error)
      }
    }
  }

  /**
   * fs.readdir 互換 (簡易実装)
   * @param {string} dirpath - ディレクトリパス
   * @param {Object} [options] - optional options
   * @param {boolean} [options.withFileTypes] - withFileTypes flag
   * @returns {Promise<string[]|Array<any>>} file names or Dirent array
   */
  async readdir(dirpath: string, options?: { withFileTypes?: boolean }) {
    if (!dirpath || typeof dirpath !== 'string') throw new TypeError('dirpath is required')

    // Fast-path: obtain index entries once and operate on keys array
    const index = await this.indexManager.getIndex()
    const entries = (index && (index as any).entries) || {}
    const keys = Object.keys(entries)

    const names = await this._gatherDirectoryNames(dirpath, entries, keys)
    const maybeEmpty = this._returnIfNoNames(names, options)
    if (maybeEmpty !== null) return maybeEmpty

    const normalizedDirectory = dirpath === '' ? '.' : dirpath
    if (options && options.withFileTypes) return this._buildDirentTypes(names, keys, entries, normalizedDirectory)
    return names
  }

  /**
   * Return an empty array when names is empty according to options, else null to continue.
   * @param {string[]|null|undefined} names - array of names
   * @param {Object} [options] - readdir options
   * @param {boolean} [options.withFileTypes] - withFileTypes flag
   * @returns {Array<any>|null} empty array or null
   */
  private _returnIfNoNames(names: string[] | null | undefined, options?: { withFileTypes?: boolean }): Array<any> | null {
    if (!names || names.length === 0) return options && options.withFileTypes ? [] : []
    return null
  }

  /**
   * Gather immediate child names for a directory using index and backend as fallback.
   * Throws ENOTDIR when the path represents a file.
   * @param {string} dirpath - original directory path
   * @param {any} entries - index entries object
   * @param {string[]} keys - array of index keys
   * @returns {Promise<string[]>} immediate child names
   */
  private async _gatherDirectoryNames(dirpath: string, entries: any, keys: string[]): Promise<string[]> {
    const normalizedDirectory = dirpath === '' ? '.' : dirpath
    const outNames = new Set<string>()

    const isExactFile = this._isExactFile(normalizedDirectory, keys, entries)

    // collect from index
    const indexNames = this._collectNamesFromIndex(normalizedDirectory, entries)
    for (const n of indexNames) outNames.add(n)

    // fallback to backend when index had no children
    if (outNames.size === 0 && normalizedDirectory !== '.' && !isExactFile) {
      const backendNames = await this._collectNamesFromBackend(normalizedDirectory)
      for (const n of backendNames) outNames.add(n)
    }

    if (isExactFile && outNames.size === 0) {
      const errorObject: any = new Error('ディレクトリではありません')
      errorObject.code = 'ENOTDIR'
      throw errorObject
    }

    if (outNames.size === 0) return []
    return Array.from(outNames)
  }

  /**
   * 指定パスのリモート衝突ファイル (.git-conflict/) を削除して
   * 競合を解消済とマークします。
   * @param {string} filepath ファイルパス
   * @returns {Promise<boolean>} 成功したら true
   */
  async resolveConflict(filepath: string) {
    return await this.conflictManager.resolveConflict(filepath)
  }

  /**
   * リモートのベーススナップショットを適用します。
   * @param {{[path:string]:string}} snapshot path->content のマップ
   * @param {string} headSha リモート HEAD
   * @returns {Promise<void>}
   */
  private async applyBaseSnapshot(snapshot: Record<string, string>, headSha: string) {
    return await this.remoteSynchronizer.applyBaseSnapshot(snapshot, headSha)
  }

  /**
   * 指定エラーが non-fast-forward を示すか判定します。
   * @param {any} error - 例外オブジェクト
   * @returns {boolean}
   */
  private _isNonFastForwardError(error: any) {
    const message = String(error && error.message ? error.message : error)
    return message.includes('422') || /fast\s*forward/i.test(message) || /not a fast forward/i.test(message)
  }

  /**
   * インデックス情報を返します。
   * @returns {Promise<IndexFile>}
   */
  async getIndex(): Promise<IndexFile> {
    return this.indexManager.getIndex()
  }

  /**
   * 登録されているパス一覧を返します。
   * @returns {string[]}
   */
  private async listPaths(): Promise<string[]> {
    // Build paths from the reconstructed index so that workspace-local
    // info (workspace/info) takes precedence over git-scoped info.
    const index = await this.indexManager.getIndex()
    const entries = (index && (index as any).entries) || {}
    const out: string[] = []
    for (const k of Object.keys(entries)) {
      const v = (entries as any)[k]
      if (v && v.state === 'deleted') continue
      out.push(k)
    }
    return out
  }

  /**
   * ワークスペースとインデックスから変更セットを生成します。
   * @returns {Promise<Array<{type:string,path:string,content?:string,baseSha?:string}>>} 変更リスト
   */
  async getChangeSet() {
    return await this.changeTracker.getChangeSet()
  }

  /**
   * ローカルに対する変更（create/update/delete）を適用するヘルパー
   * @param {any} ch 変更オブジェクト
   * @returns {Promise<void>}
   */
  private async _applyChangeLocally(ch: any) {
    if (ch.type === 'create' || ch.type === 'update') {
      const sha = await shaOf(ch.content)
      // Backend manages base segment persistence
      let entry: any = undefined
      const infoTxt = await this.backend.readBlob(ch.path, 'info')
      if (infoTxt) entry = JSON.parse(infoTxt)
      if (!entry) entry = { path: ch.path }
      entry.baseSha = sha
      entry.state = 'base'
      entry.updatedAt = Date.now()
      entry.workspaceSha = undefined
      await this.backend.writeBlob(ch.path, JSON.stringify(entry), 'info')

      // Delegate to LocalChangeApplier which will persist base and clean workspace in the correct order
      await this.applier.applyCreateOrUpdate(ch)
    } else if (ch.type === 'delete') {
      await this.applier.applyDelete(ch)
    }
  }

  /**
   * GitLab 風の actions ベースコミットフローで push を実行します。
   * @param {any} adapter - adapter instance
   * @param {any} input - push input
   * @param {string} branch - branch name
   * @returns {Promise<{commitSha:string}>}
   */
  private async _pushWithActions(adapter: any, input: any, branch: string) {
    const commitSha = await adapter.createCommitWithActions(branch, input.message, input.changes as any[], input.parentSha)
    await this._tryUpdateRef(adapter, branch, commitSha)
    return await this._applyChangesAndFinalize(commitSha, input)
  }

  /**
   * GitHub 風の blob/tree/commit フローで push を実行します。
   * @param {any} adapter - adapter instance
   * @param {any} input - push input
   * @param {string} branch - branch name
   * @returns {Promise<{commitSha:string}>}
   */
  private async _pushWithGitHubFlow(adapter: any, input: any, branch: string) {
    const blobMap = await adapter.createBlobs(input.changes as any[])
    const changesWithBlob = (input.changes as any[]).map((c) => ({ ...c, blobSha: blobMap[c.path] }))
    // Attempt to base the new tree on the parent commit's tree so we only modify diffs
    let baseTreeSha: string | undefined = undefined
    if (input.parentSha && typeof (adapter as any).getCommitTreeSha === 'function') {
      try {
        baseTreeSha = await (adapter as any).getCommitTreeSha(input.parentSha)
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('getCommitTreeSha failed, continuing without baseTree', error)
        baseTreeSha = undefined
      }
    }
    const treeSha = await adapter.createTree(changesWithBlob, baseTreeSha)
    const commitSha = await adapter.createCommit(input.message, input.parentSha, treeSha)
    await this._tryUpdateRef(adapter, branch, commitSha)
    return await this._applyChangesAndFinalize(commitSha, input)
  }

  /**
   * Try to update remote ref and handle common non-fast-forward errors.
   * Throws when the remote reports a non-fast-forward conflict.
   * @param {any} adapter - adapter instance
   * @param {string} branch - branch name
   * @param {string} commitSha - commit SHA
   * @returns {Promise<void>}
   */
  private async _tryUpdateRef(adapter: any, branch: string, commitSha: string) {
    if (typeof adapter.updateRef === 'function') {
      try {
        await adapter.updateRef(`heads/${branch}`, commitSha)
      } catch (error: any) {
        if (this._isNonFastForwardError(error)) {
          throw new Error('非互換な更新 (non-fast-forward): pull が必要です')
        }
        if (typeof console !== 'undefined' && (console as any).warn) (console as any).warn('updateRef failed (non-422), continuing locally:', error)
      }
    }
  }

  /**
   * Apply changes locally, update index head and persist index.
   * Returns the commit result object for callers.
   * @param {string} commitSha - commit SHA
   * @param {any} input - push input
   * @returns {Promise<{commitSha:string}>}
   */
  private async _applyChangesAndFinalize(commitSha: string, input: any) {
    for (const ch of input.changes as any[]) {
      await this._applyChangeLocally(ch)
    }
    this.indexManager.setHead(commitSha)
    await this.indexManager.saveIndex()
    return { commitSha }
  }

  /**
   * Handle push when an adapter is provided (delegates to _pushWithActions/_pushWithGitHubFlow).
   * Records commitKey in index metadata and returns the push result.
   * @param {any} input - push input
   * @param {any} adapter - adapter instance
   * @returns {Promise<{commitSha:string}>}
   */
  private async _handlePushWithAdapter(input: any, adapter: any) {
    const branch = (input as any).ref || this._getPersistedBranch()
    const messageWithKey = `${input.message}\n\napigit-commit-key:${input.commitKey}`
    // If adapter supports createCommitWithActions (GitLab style), use it directly
    if ((adapter as any).createCommitWithActions) {
      (input as any).message = messageWithKey
      const actionResult = await this._pushWithActions(adapter, input, branch)
      this.indexManager.setLastCommitKey(input.commitKey)
      await this.indexManager.saveIndex()
      return actionResult
    }

    // Fallback to GitHub-style flow
    (input as any).message = messageWithKey
    const gitHubFlowResult = await this._pushWithGitHubFlow(adapter, input, branch)
    this.indexManager.setLastCommitKey(input.commitKey)
    await this.indexManager.saveIndex()
    return gitHubFlowResult
  }

  /**
   * リモートのスナップショットを取り込み、コンフリクト情報を返します。
   * @param {RemoteSnapshotDescriptor|string|Object} remote - リモート情報
   * @param {Record<string,string>} [baseSnapshot] - path->content マップ
   * @returns {Promise<{conflicts:Array<import('./types').ConflictEntry>}>}
   */
  async pull(
    remote: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> },
    baseSnapshot?: Record<string, string>
  ) {
    // Support new v0.0.4 TDD-friendly option: allow calling `pull({ ref })`
    // or calling `pull()` to use persisted adapterMeta.opts.branch.
    const maybeOptions: any = remote as any
    if (maybeOptions && typeof maybeOptions.ref === 'string') {
      return await this._pullByRef(maybeOptions.ref, baseSnapshot)
    }
    if (remote === undefined || remote === null) {
      const noArgumentsResult = await this._handlePullNoArgs(baseSnapshot)
      if (noArgumentsResult) return noArgumentsResult
    }

    const descriptorRaw = await this._resolveDescriptor(remote, baseSnapshot)
    const normalized: RemoteSnapshotDescriptor =
      typeof descriptorRaw === 'string' ? await this._normalizeRemoteInput(descriptorRaw, baseSnapshot) : (descriptorRaw as RemoteSnapshotDescriptor)

    const preIndex = await this.getIndex()
    const preIndexKeys = Object.keys(preIndex.entries)

    const instAdapter = await this.getAdapterInstance()
    // v0.0.4: pull must NOT pass baseSnapshot to remoteSynchronizer
    // metadata-first: only fetch tree, base content deferred until on-demand
    const pullResult: any = await this.remoteSynchronizer.pull(normalized, undefined, instAdapter)

    const postIndex = await this.getIndex()
    const postIndexKeys = Object.keys(postIndex.entries)
    const preSet = new Set(preIndexKeys)
    const addedPaths = postIndexKeys.filter((k) => !preSet.has(k))
    const remotePaths = Object.keys(normalized.shas || {})

    return {
      ...pullResult,
      remote: normalized,
      remotePaths,
      preIndexKeys,
      postIndexKeys,
      addedPaths
    }
  }

  /**
   * Pull by a specified commit-ish reference. Resolves the ref, fetches snapshot and
   * delegates to remote synchronizer. Persists adapter branch meta on success.
   * @param {string} reference commit-ish to resolve
   * @param {Record<string,string>=} baseSnapshot optional base snapshot
   * @returns {Promise<any>} pull result
   */
  private async _pullByRef(reference: string, baseSnapshot?: Record<string, string>): Promise<any> {
    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter) throw new Error('Adapter instance not available')
    if (typeof instAdapter.resolveRef !== 'function') throw new Error('Adapter does not support resolveRef')
    const resolvedSha = await instAdapter.resolveRef(reference)
    const descriptor = await instAdapter.fetchSnapshot(resolvedSha)
    const normalized: RemoteSnapshotDescriptor = typeof descriptor === 'string' ? await this._normalizeRemoteInput(descriptor, baseSnapshot) : (descriptor as RemoteSnapshotDescriptor)
    // Ensure backend uses requested branch scope before writing base/index
    await this._trySetBackendBranch(reference)
    // v0.0.4: pull must NOT pass baseSnapshot to remoteSynchronizer
    const pullResult: any = await this.remoteSynchronizer.pull(normalized, undefined, instAdapter)
    // on success persist requested ref into adapter metadata (branch)
    await this._persistAdapterBranchMeta(reference, instAdapter).catch((error) => {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('persisting adapter metadata failed', error)
    })
    return { ...pullResult, remote: normalized, remotePaths: Object.keys(normalized.shas || {}) }
  }

  /**
   * Pull using the persisted adapterMeta.branch (or 'main').
   * @param {Record<string,string>=} baseSnapshot optional base snapshot
   * @returns {Promise<any>} pull result
   */
  private async _pullUsingPersistedBranch(baseSnapshot?: Record<string, string>): Promise<any> {
    const instAdapter = await this.getAdapterInstance()
    const branch = this._getPersistedBranch()
    await this._trySetBackendBranch(branch)
    const resolvedSha = await instAdapter!.resolveRef(branch)
    const descriptor = await instAdapter!.fetchSnapshot(resolvedSha)
    const normalized: RemoteSnapshotDescriptor = typeof descriptor === 'string' ? await this._normalizeRemoteInput(descriptor, baseSnapshot) : (descriptor as RemoteSnapshotDescriptor)
    // v0.0.4: pull must NOT pass baseSnapshot to remoteSynchronizer
    const pullResult: any = await this.remoteSynchronizer.pull(normalized, undefined, instAdapter)
    // do not persist branch change (we used existing branch)
    return { ...pullResult, remote: normalized, remotePaths: Object.keys(normalized.shas || {}) }
  }

  /**
   * Handle the case when pull() is called with no args: try persisted adapter branch if possible.
   * Returns the pull result when handled, or null to indicate caller should continue.
   * @param {Record<string,string>=} baseSnapshot optional base snapshot
   * @returns {Promise<any|null>}
   */
  private async _handlePullNoArgs(baseSnapshot?: Record<string, string>): Promise<any | null> {
    const instAdapter = await this.getAdapterInstance()
    if (instAdapter && typeof instAdapter.resolveRef === 'function') {
      try {
        return await this._pullUsingPersistedBranch(baseSnapshot)
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('pull using persisted branch failed, continuing with empty remote', error)
        return { remote: null, remotePaths: [], preIndexKeys: [], postIndexKeys: [], addedPaths: [] }
      }
    }
    return null
  }

  /**
   * Persist the requested branch into adapter metadata (best-effort).
   * @param {string} branch - branch name to persist
   * @param {any} [_adapterInstance] - optional adapter instance (unused)
   * @returns {Promise<void>}
   */
  private async _persistAdapterBranchMeta(branch: string, _adapterInstance: any): Promise<void> {
    const meta = (this.adapterMeta) ? { ...(this.adapterMeta) } : (await this.getAdapter())
    if (!meta) return
    const newMeta = { ...(meta || {}), branch, opts: { ...(meta.opts || {}) } }
    // persist only metadata (adapter instance not passed)
    await this.setAdapter(newMeta)
    // Also inform backend about branch scope when backend supports it
    await this._trySetBackendBranch(branch)

  }

  /**
   * Best-effort: set backend branch scope when backend supports it.
   * @param branch branch name to set
   * @returns {Promise<void>}
   */
  private async _trySetBackendBranch(branch: string): Promise<void> {
    try {
      if (this.backend && typeof (this.backend as any).setBranch === 'function') {
        ; (this.backend as any).setBranch(branch)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('backend.setBranch failed', error)
    }
  }

  /**
   * Ensure adapterMeta is loaded from index when missing.
   * @returns {Promise<boolean>} true when adapterMeta is available
   */
  private async _loadAdapterMetaIfNeeded(): Promise<boolean> {
    if (this.adapterMeta) return true
    try {
      const index = await this.indexManager.getIndex()
      this.adapterMeta = (index as any).adapter || null
      return !!this.adapterMeta
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('loading adapterMeta failed', error)
      this.adapterMeta = null
      return false
    }
  }

  /**
   * Persist current adapterMeta into the index file (best-effort).
   * @returns {Promise<void>}
   */
  private async _writeAdapterMetaToIndex(): Promise<void> {
    try {
      const index = await this.indexManager.getIndex()
        ; (index as any).adapter = this.adapterMeta
      await this.backend.writeIndex(index)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('writing index failed', error)
    }
  }

  /**
   * Normalize remote input which may be a headSha or a full descriptor.
   * @param {RemoteSnapshotDescriptor | string} remote remote descriptor or headSha
   * @param {Record<string,string>=} baseSnapshot optional snapshot when remote is a headSha
   * @returns {Promise<RemoteSnapshotDescriptor>} normalized descriptor
   */
  private async _normalizeRemoteInput(remote: RemoteSnapshotDescriptor | string, baseSnapshot?: Record<string, string>): Promise<RemoteSnapshotDescriptor> {
    if (typeof remote !== 'string') return remote
    const snapshot = baseSnapshot || {}
    const shas: Record<string, string> = {}
    for (const [p, c] of Object.entries(snapshot)) shas[p] = await shaOf(c)
    /**
     * Fetch content for the requested paths from the provided snapshot.
     * @param {string[]} paths requested paths
     * @returns {Promise<Record<string,string>>} path->content map
     */
    async function fetchContent(paths: string[]): Promise<Record<string, string>> {
      const out: Record<string, string> = {}
      for (const p of paths) {
        if (p in snapshot) out[p] = snapshot[p]
      }
      return out
    }
    return { headSha: remote, shas, fetchContent }
  }

  /**
   * Obtain remote snapshot (via persisted adapter if available) and
   * compute simple diffs against the current index.
   * Returns an object containing the resolved `remote` descriptor (or null),
   * `remoteShas` map and `diffs` array (strings like `added: path` / `updated: path`).
   * @param {RemoteSnapshotDescriptor|string|Object} [remote] - remote descriptor
   * @returns {Promise<{remote: RemoteSnapshotDescriptor|null, remoteShas: Record<string,string>, diffs: string[]}>}
   */
  async getRemoteDiffs(
    remote?: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> }
  ): Promise<{ remote: RemoteSnapshotDescriptor | null; remoteShas: Record<string, string>; diffs: string[] }> {
    let resolved: RemoteSnapshotDescriptor | string | null = null
    try {
      resolved = await this._resolveDescriptor(remote as any, undefined)
    } catch {
      resolved = null
    }

    const normalized = await this._toNormalizedDescriptor(resolved)
    const remoteShas: Record<string, string> = normalized?.shas || {}

    const diffs: string[] = []
    const index = await this.getIndex().catch(() => null)
    if (!index) return { remote: normalized, remoteShas, diffs }

    for (const [p, sha] of Object.entries(remoteShas)) {
      const entry = index.entries[p]
      if (!entry) diffs.push(`added: ${p}`)
      else if (entry.baseSha !== sha) diffs.push(`updated: ${p}`)
    }

    return { remote: normalized, remoteShas, diffs }
  }

  /**
   * Delegate commit history listing to the underlying adapter when available.
   * Thin passthrough used by UI/CLI to retrieve commit summaries and paging info.
   * @param {CommitHistoryQuery} query
   * @returns {Promise<CommitHistoryPage>}
   */
  async listCommits(query: CommitHistoryQuery): Promise<CommitHistoryPage> {
    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter || typeof instAdapter.listCommits !== 'function') {
      throw new Error('Adapter instance not available or does not support listCommits')
    }
    return await instAdapter.listCommits(query)
  }

  /**
   * Delegate branch listing to the underlying adapter when available.
   * @param {BranchListQuery} query
   * @returns {Promise<BranchListPage>}
   */
  async listBranches(query?: BranchListQuery): Promise<BranchListPage> {
    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter || typeof instAdapter.listBranches !== 'function') {
      throw new Error('Adapter instance not available or does not support listBranches')
    }
    const result = await instAdapter.listBranches(query)
    // Try to persist repository metadata when available (best-effort)
    await this._maybePersistRepositoryMetadata(instAdapter, result).catch((error) => {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('persist repository metadata failed', error)
    })
    return result
  }

  /**
   * Create a remote-only branch via the configured adapter.
   * @param {{name:string, fromRef?:string}} input
   * @returns {Promise<import('./types.ts').CreateBranchResult>}
   */
  async createBranch(input: import('./types.ts').CreateBranchInput): Promise<import('./types.ts').CreateBranchResult> {
    if (!input || !input.name || typeof input.name !== 'string' || input.name.trim() === '') {
      throw new Error('branch name is required')
    }

    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter) throw new Error('Adapter instance not available')
    if (typeof instAdapter.createBranch !== 'function') throw new Error('Adapter does not support createBranch')

    // Delegate resolution of the source ref to a helper to reduce complexity
    const resolvedFrom = await this._resolveCreateBranchFrom(input, instAdapter)

    const result = await instAdapter.createBranch(input.name, resolvedFrom)
    return result as import('./types.ts').CreateBranchResult
  }

  /**
   * Resolve a source reference for createBranch.
   * Preference order: explicit input.fromRef, index.head, adapter default branch.
   * Returns empty string when no resolution found.
   * @param {import('./types.ts').CreateBranchInput} input createBranch input
   * @param {any} instAdapter adapter instance
   * @returns {Promise<string>} resolved ref or empty string
   */
  private async _resolveCreateBranchFrom(input: import('./types.ts').CreateBranchInput, instAdapter: any): Promise<string> {
    // Prefer explicit input.fromRef
    if (input && input.fromRef && typeof input.fromRef === 'string' && input.fromRef.trim() !== '') return input.fromRef

    // Try persisted index head
    try {
      const index = await this.getIndex()
      if (index && (index as any).head) return (index as any).head
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('[createBranch] getIndex error: ' + String(error))
    }

    // Try adapter default branch resolution
    const adapterResolved = await this._resolveAdapterDefaultBranch(instAdapter)
    if (adapterResolved) return adapterResolved

    // fallback to empty string
    return ''
  }

  /**
   * Attempt to resolve the default branch via adapter metadata.
   * @param {any} instAdapter adapter instance
   * @returns {Promise<string|null>} resolved SHA or null when not found
   */
  private async _resolveAdapterDefaultBranch(instAdapter: any): Promise<string | null> {
    if (this.adapterMeta && this.adapterMeta.opts && typeof instAdapter.resolveRef === 'function') {
      try {
        const defaultBranch = this._getPersistedBranch()
        const resolved = await instAdapter.resolveRef(defaultBranch)
        return resolved || null
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('[createBranch] resolveRef error: ' + String(error))
        return null
      }
    }
    return null
  }

  /**
   * Convenience to get default branch name from adapter repository metadata.
   * Returns null when adapter not available.
   * @returns {Promise<string|null>}
   */
  async getDefaultBranch(): Promise<string | null> {
    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter || typeof instAdapter.getRepositoryMetadata !== 'function') return null
    try {
      const md: RepositoryMetadata = await instAdapter.getRepositoryMetadata()
      if (md) await this._persistRepositoryMetadata(md)
      return md && md.defaultBranch ? md.defaultBranch : null
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('getDefaultBranch failed', error)
      return null
    }
  }

  /**
   * Persist repository metadata into IndexFile.adapter.opts for session persistence.
  /**
   * Best-effort: failures are ignored.
   * @param {RepositoryMetadata} md - metadata to persist
   * @returns {Promise<void>}
   */
  private async _persistRepositoryMetadata(md: RepositoryMetadata): Promise<void> {
    try {
      const have = await this._loadAdapterMetaIfNeeded()
      if (!have) return
      const existing = (this.adapterMeta && this.adapterMeta.opts) as AdapterOptions | undefined
      const options: Partial<AdapterOptionsBase> = existing ? { ...existing } : {}
      options.defaultBranch = md.defaultBranch
      if (md.name) options.repositoryName = md.name
      if (md.id !== undefined) options.repositoryId = md.id
      this.adapterMeta!.opts = { ...existing, ...options } as AdapterOptions
      await this._writeAdapterMetaToIndex()
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('persist repository metadata aborted', error)
    }
  }

  /**
   * Try persisting repository metadata when available. Best-effort.
   * @param instAdapter adapter instance or null
   * @param result branch list result used for fallback default branch detection
   * @returns {Promise<void>}
   */
  private async _maybePersistRepositoryMetadata(instAdapter: any | null, result: any): Promise<void> {
    try {
      if (instAdapter && typeof instAdapter.getRepositoryMetadata === 'function') {
        const md = await instAdapter.getRepositoryMetadata().catch(() => null)
        if (md) await this._persistRepositoryMetadata(md)
      } else {
        await this._persistDefaultBranchCandidate(result)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('maybePersistRepositoryMetadata failed', error)
    }
  }

  /**
   * Extracted helper to persist default branch candidate derived from branch list.
   * @param result branch list result
   * @returns {Promise<void>}
   */
  private async _persistDefaultBranchCandidate(result: any): Promise<void> {
    try {
      const defaultBranchCandidate = Array.isArray(result.items) ? result.items.find((item: any) => item && item.isDefault) : undefined
      if (defaultBranchCandidate) {
        await this._persistRepositoryMetadata({ defaultBranch: defaultBranchCandidate.name, name: '', id: undefined })
      }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('persistDefaultBranchCandidate failed', error)
    }
  }

  /**
   * Normalize a resolved descriptor (string headSha or object) into a
   * RemoteSnapshotDescriptor or null.
   * @param {RemoteSnapshotDescriptor|string|null} resolved descriptor or headSha
   * @returns {Promise<RemoteSnapshotDescriptor|null>} 正規化された descriptor または null
   */
  private async _toNormalizedDescriptor(resolved: RemoteSnapshotDescriptor | string | null): Promise<RemoteSnapshotDescriptor | null> {
    if (!resolved) return null
    if (typeof resolved !== 'string') return resolved as RemoteSnapshotDescriptor
    try {
      return await this._normalizeRemoteInput(resolved, {})
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_toNormalizedDescriptor normalize failed', error)
      return null
    }
  }

  /**
   * Resolve the provided `remote` parameter into either a headSha string or a full
   * `RemoteSnapshotDescriptor`. Centralizes adapter fetching and fallback behavior
   * to keep `pull()` small and easier to lint.
   * @param remote remote descriptor or adapter-like object or headSha
   * @param baseSnapshot optional snapshot used when normalizing a headSha
   * @returns {Promise<RemoteSnapshotDescriptor|string>} resolved descriptor or headSha
   */
  private async _resolveDescriptor(
    remote: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> } | undefined,
    baseSnapshot?: Record<string, string>
  ): Promise<RemoteSnapshotDescriptor | string> {
    const remoteLike: any = remote as any
    const isAdapterLike = remoteLike && typeof remoteLike === 'object' && typeof remoteLike.fetchSnapshot === 'function' && !('headSha' in remoteLike)

    if (isAdapterLike) {
      const fromAdapter = await this._fetchSnapshotFromAdapterInstance()
      if (!fromAdapter) throw new Error('Adapter instance not available')
      return fromAdapter
    }

    if (remote === undefined || remote === null) {
      const fromAdapter = await this._fetchSnapshotFromAdapterInstance()
      if (fromAdapter) return fromAdapter
      return await this._normalizeRemoteInput('', baseSnapshot || {})
    }

    return remote as any
  }

  /**
   * Try to obtain a snapshot descriptor from the persisted adapter instance.
   * @returns {Promise<RemoteSnapshotDescriptor|null>} snapshot descriptor or null when unavailable
   */
  private async _fetchSnapshotFromAdapterInstance(): Promise<RemoteSnapshotDescriptor | null> {
    const adapterInstance = await this.getAdapterInstance()
    if (adapterInstance && typeof adapterInstance.fetchSnapshot === 'function') {
      // prefer branch configured in persisted adapter metadata, default to 'main'
      const branch = this._getPersistedBranch()
      return await adapterInstance.fetchSnapshot(branch)

    }
    return null
  }

  /**
   * 変更をコミットしてリモートへ反映します。adapter が無ければローカルシミュレーションします。
   * @param {import('./types').CommitInput} input コミット入力
   * @returns {Promise<{commitSha:string}>}
   */
  async push(input: import('./types.ts').CommitInput) {
    // Ensure parentSha defaults to current index head when not provided
    await this._ensureParentSha(input)

    // Ensure changes default to current workspace change set when not provided
    if (input.changes === undefined || input.changes === null) {
      input.changes = await this.getChangeSet()
    }

    // generate commitKey for idempotency if not provided (must be set for adapter flows)
    if (!input.commitKey) {
      input.commitKey = await shaOf((input.parentSha || '') + JSON.stringify(input.changes))
    }

    // Try to obtain a persisted/instantiated adapter from this VirtualFS.
    // If adapter resolution throws, let the exception bubble up (TDD expectation).
    const instAdapter = await this.getAdapterInstance()
    if (!instAdapter) {
      // remoteSynchronizer fallback removed: adapters are required for push in v0.0.4
      throw new Error('Adapter instance not available')
    }

    return await this._handlePushWithAdapter(input, instAdapter)
  }

  /**
   * Ensure `input.parentSha` is a string; prefer current index head when available.
   * @param input CommitInput
   */
  private async _ensureParentSha(input: import('./types.ts').CommitInput) {
    if (input.parentSha === undefined || input.parentSha === null) {
      try {
        const index = await this.getIndex()
        // `CommitInput.parentSha` is typed as string; use empty string when head is unavailable
        input.parentSha = (index && (index as any).head) || ''
      } catch (error) {
        // propagate as empty string to satisfy type expectations
        input.parentSha = ''
      }
    }
  }
}

export default VirtualFS

