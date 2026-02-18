import { IndexFile } from './types.ts'
import { StorageBackend, StorageBackendConstructor } from './storageBackend.ts'

const ERR_OPFS_DIR_API = 'OPFS directory API not available'
const VAR_WORKSPACE = 'workspace'
// For branch-scoped storage, we store git-managed segments under
// `.git/{branch}/{segment}` while workspace remains under `workspace`.
const SEG_BASE = 'base'
const SEG_CONFLICT = 'conflict'
const SEG_CONFLICT_BLOB = 'conflictBlob'
const SEG_INFO = 'info'

/** OPFS (origin private file system) を利用する永続化実装 */
export const OpfsStorage: StorageBackendConstructor = class OpfsStorage implements StorageBackend {
  /**
   * 同期的に OPFS 利用可否を判定します（レガシーヒントも含む）。
   * @returns {boolean} 利用可能なら true
   */
  static canUse(): boolean {
    let ok = false
    const nav = (globalThis as any).navigator
    // If navigator.storage.persist exists, treat as OPFS-capable hint (legacy detection)
    if (nav && nav.storage && typeof nav.storage.persist === 'function') ok = true
    if (nav && nav.storage && typeof nav.storage.getDirectory === 'function') ok = true

    if (!ok && (globalThis as any).originPrivateFileSystem && typeof (globalThis as any).originPrivateFileSystem.getDirectory === 'function') ok = true
    return ok
  }

  /**
   * Return available root folder names for OPFS. This method is synchronous
   * to satisfy the StorageBackendConstructor contract; it returns a cached
   * hint if available and kicks off an async probe to populate the cache.
   * If no information is available synchronously an empty array is returned.
   * @param {string} namespace Namespace to filter
   * @returns {Promise<string[]>} available root directories
   */
  static async availableRoots(namespace: string): Promise<string[]> {
    try {
      const root = await OpfsStorage._getNavigatorStorageRoot()
      if (!root) return []
      // Find the namespace folder under OPFS root and list its children
      for await (const handle of (root as any).values()) {
        const name = OpfsStorage._extractHandleName(handle)
        if (name === namespace && OpfsStorage._isDirectoryHandle(handle)) {
          return await OpfsStorage._collectDirectoryNames(handle)
        }
      }
      return []
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('availableRoots probe failed', error)
      return []
    }
  }

  /**
   * Get OPFS root from navigator.storage.getDirectory()
   * @returns {Promise<any|null>}
   */
  private static async _getNavigatorStorageRoot(): Promise<any | null> {
    const nav = (globalThis as any).navigator
    if (!nav || !nav.storage || typeof nav.storage.getDirectory !== 'function') return null
    return await nav.storage.getDirectory()
  }

  /**
   * Collect directory names from OPFS root handle
   * @param {any} root Directory handle
   * @returns {Promise<string[]>}
   */
  private static async _collectDirectoryNames(root: any): Promise<string[]> {
    const names: string[] = []
    for await (const handle of (root as any).values()) {
      const name = OpfsStorage._extractHandleName(handle)
      if (name && OpfsStorage._isDirectoryHandle(handle)) {
        names.push(name)
      }
    }
    return names
  }

  /**
   * Extract name from directory handle
   * @param {any} handle File/directory handle
   * @returns {string}
   */
  private static _extractHandleName(handle: any): string {
    return handle && handle.name ? handle.name : ''
  }

  /**
   * Check if handle represents a directory
   * @param {any} handle File/directory handle
   * @returns {boolean}
   */
  private static _isDirectoryHandle(handle: any): boolean {
    return (
      (handle && handle.kind === 'directory') ||
      typeof (handle && handle.getDirectoryHandle) === 'function' ||
      typeof (handle && handle.getDirectory) === 'function'
    )
  }

  /**
   * Returns the known segment variants in search order.
   * @returns {string[]} segment directory names
   */
  private getVariants(): string[] {
    return [VAR_WORKSPACE, SEG_BASE, SEG_CONFLICT, SEG_CONFLICT_BLOB]
  }

  private rootDir = 'apigit_storage'
  private currentBranch: string | null = null
  private namespace: string = ''

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
   * コンストラクタ（OPFS は初期化不要）。
   * `namespace` は必須。挙動:
   * - `new(namespace)` のみの場合は OPFS ルートとして `namespace` を使う（テストの期待値に合わせる）。
   * - `new(namespace, root)` の場合は `namespace/root` を使う。
   * @param {string} namespace Namespace
   * @param {string} [root] Optional root directory name
   */
  constructor(namespace: string, root?: string) {
    this.namespace = namespace || ''
    if (root) {
      this.rootDir = this.namespace ? `${this.namespace}/${root}` : root
    } else if (this.namespace) {
      // When only namespace provided, treat it as the root directory to match
      // existing test expectations where availableRoots returns a top-level
      // folder name (e.g. 'GitLab_test01').
      this.rootDir = this.namespace
    } else {
      // Fallback to default
      this.rootDir = this.rootDir
    }
  }

  /**
   * 初期化（OPFS はランタイム判定のみ）
   * @returns {Promise<void>} 初期化完了時に解決
   */
  async init(): Promise<void> {
    const root = await this.getOpfsRoot()
    if (!root) return

    // If index metadata doesn't exist, create an empty index to initialize the root
    const metaTxt = await this._readIndexMetadata(root)
    if (!metaTxt) {
      const canWriteIndex = typeof (root as any).getDirectoryHandle === 'function' || typeof (root as any).getDirectory === 'function' || typeof (root as any).getFileHandle === 'function'
      if (canWriteIndex) await this.writeIndex({ head: '', entries: {} })
    }
  }

  /**
   * Set active branch for storage scoping. Backends that support branch scoping
   * should honor this to isolate base/conflict/info data per branch.
   * @param {string | undefined | null} branch branch name or null
   * @returns {void}
   */
  setBranch(branch?: string | null): void {
    this.currentBranch = branch || null
  }

  /**
   * Map logical segment to concrete prefix used on OPFS.
   * @param {string} segment Segment identifier
   * @returns {string} concrete prefix path for the given segment
   */
  private _segmentToPrefix(segment: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info'): string {
    // Workspace content is now stored under workspace/base
    if (segment === 'workspace') return `${VAR_WORKSPACE}/base`
    // info for git-managed segments remains under .git/{branch}/info
    const segName = segment === 'base' ? SEG_BASE : segment === 'info' ? SEG_INFO : segment === 'conflictBlob' ? SEG_CONFLICT_BLOB : SEG_CONFLICT
    const branch = this.currentBranch || 'main'
    return `.git/${branch}/${segName}`
  }

  /**
   * Try to get OPFS root from navigator.storage.getDirectory().
   * @returns {Promise<any|null>}
   */
  private async _tryNavigatorStorage(): Promise<any | null> {
    const nav = (globalThis as any).navigator
    if (!nav || !nav.storage || typeof nav.storage.getDirectory !== 'function') {
      return null
    }
    try {
      const maybe = nav.storage.getDirectory()
      const d = await Promise.resolve(maybe)
      return d || null
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_tryNavigatorStorage failed', error)
      return null
    }
  }

  /**
   * Try to get OPFS root from originPrivateFileSystem.getDirectory().
   * @returns {Promise<any|null>}
   */
  private async _tryOriginPrivateFileSystem(): Promise<any | null> {
    const opfs = (globalThis as any).originPrivateFileSystem
    if (!opfs || typeof opfs.getDirectory !== 'function') {
      return null
    }
    try {
      return await opfs.getDirectory()
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_tryOriginPrivateFileSystem failed', error)
      return null
    }
  }

  /**
   * OPFS のルートディレクトリハンドルを取得します。失敗時は null を返す。
   * @returns {Promise<any|null>} ルートハンドルまたは null
   */
  private async getOpfsRoot(): Promise<any | null> {
    const fromNav = await this._tryNavigatorStorage()
    if (fromNav) return fromNav
    return await this._tryOriginPrivateFileSystem()
  }

  /**
   * 指定パスのディレクトリを再帰的に作成して返す
   * @param {any} root Root directory handle
   * @param {string[]} parts Directory path parts
   * @returns {Promise<any>} 生成されたディレクトリハンドル
   */
  private async ensureDir(root: any, parts: string[]): Promise<any> {
    let directory = root
    for (const part of parts) {
      if (directory && typeof directory.getDirectoryHandle === 'function') {
        directory = await directory.getDirectoryHandle(part, { create: true })
      } else if (directory && typeof directory.getDirectory === 'function') {
        directory = await directory.getDirectory(part, { create: true })
      } else {
        throw new Error(ERR_OPFS_DIR_API)
      }
    }
    return directory
  }

  /**
   * Read index metadata file from OPFS.
   * @param {any} root Root directory handle
   * @returns {Promise<string|null>}
   */
  private async _readIndexMetadata(root: any): Promise<string | null> {
    try {
      const hasDirectoryApi = typeof (root as any).getDirectoryHandle === 'function' || typeof (root as any).getDirectory === 'function'
      if (hasDirectoryApi) {
        const scoped = await this.traverseDir(root, this.rootDir.split('/').filter(Boolean))
        const fh = await scoped.getFileHandle('index')
        const file = await fh.getFile()
        return await file.text()
      }
      const fh = await (root as any).getFileHandle('index')
      const file = await fh.getFile()
      return await file.text()
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('_readIndexMetadata failed', error)
      return null
    }
  }

  /**
   * index を読み出す
   * @returns {Promise<IndexFile|null>} 読み出した IndexFile、存在しなければ null
   */
  async readIndex(): Promise<IndexFile | null> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return null

      const metaTxt = await this._readIndexMetadata(root)

      const result: IndexFile = { head: '', entries: {} }
      if (metaTxt) {
        const parsed = JSON.parse(metaTxt) as any
        result.head = parsed.head || ''
        if (parsed.lastCommitKey) result.lastCommitKey = parsed.lastCommitKey
        if (parsed.adapter) result.adapter = parsed.adapter
      }

      // Reconstruct entries by reading all files under the 'info' segment
      await this._readInfoEntries(root, result)

      return result
    } catch (error) {
      return { head: '', entries: {} }
    }
  }

  /**
   * Read all info entries under VAR_INFO and populate the given IndexFile.entries map.
   * @param {any} root Root directory handle
   * @param {IndexFile} result Result IndexFile to populate
   * @returns {Promise<void>}
   */
  private async _readInfoEntries(root: any, result: IndexFile): Promise<void> {
    // Load workspace-local info first (workspace/info), then merge git-scoped info (.git/{branch}/info)
    const workspaceInfoPrefix = `${VAR_WORKSPACE}/info`
    await this._readFilesIntoEntries(root, workspaceInfoPrefix, result, true)

    // Load git-scoped info, but do not overwrite workspace-local entries
    const gitInfoPrefix = this._segmentToPrefix('info')
    await this._readFilesIntoEntries(root, gitInfoPrefix, result, false)
  }

  /**
   * Read files at the given prefix and populate result.entries.
   * If `overwrite` is true, entries will be overwritten; otherwise existing entries are preserved.
   * @param {any} root Root directory handle
   * @param {string} prefix Prefix path
   * @param {IndexFile} result Result IndexFile
   * @param {boolean} overwrite Whether to overwrite existing entries
   * @returns {Promise<void>}
   */
  private async _readFilesIntoEntries(root: any, prefix: string, result: IndexFile, overwrite: boolean): Promise<void> {
    const files = await this.listFilesAtPrefix(root, prefix).catch(() => [])
    for (const fp of files) {
      if (!overwrite && result.entries[fp]) continue
      const txt = await this.readFromPrefix(root, prefix, fp).catch(() => null)
      if (!txt) continue
      try {
        result.entries[fp] = JSON.parse(txt) as any
      } catch (error) {
        console.warn('無視されたエラー', error)
        continue
      }
    }
  }

  /**
   * index を書き込む
   * @param {IndexFile} index - インデックスファイル
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeIndex(index: IndexFile): Promise<void> {
    const root = await this.getOpfsRoot()
    if (!root) throw new Error('OPFS not available')

    // Write each entry separately to the 'info' segment
    const entries = index.entries || {}
    // Persist index entries into workspace-local info (workspace/info)
    // Only create workspace/info entries for files that actually exist in workspace/base
    for (const filepath of Object.keys(entries)) {
      const entry = entries[filepath]
      const existsWorkspace = await this.readFromPrefix(root, `${VAR_WORKSPACE}/base`, filepath).catch(() => null)
      if (existsWorkspace !== null) {
        // store each IndexEntry JSON under workspace/info using the filepath as key
        await this._writeToPrefix(root, `${VAR_WORKSPACE}/info`, filepath, JSON.stringify(entry))
        continue
      }
      // If workspace base absent, persist into git-scoped info so readIndex
      // can reconstruct entries (tests expect entries persisted even when
      // workspace copies are not present).
      const gitInfoPrefix = this._segmentToPrefix('info')
      await this._writeToPrefix(root, gitInfoPrefix, filepath, JSON.stringify(entry))
    }

    // Persist index metadata (without entries), include adapter meta when present
    const meta: any = { head: index.head }
    if (index.lastCommitKey) meta.lastCommitKey = index.lastCommitKey
    if ((index as any).adapter) meta.adapter = (index as any).adapter

    const hasDirectoryApi = typeof (root as any).getDirectoryHandle === 'function' || typeof (root as any).getDirectory === 'function'
    const payload = JSON.stringify(meta)
    if (hasDirectoryApi) {
      const parts = this.rootDir.split('/').filter(Boolean)
      const parent = await this.ensureDir(root, parts)
      const fh = await parent.getFileHandle('index', { create: true })
      const writable = await fh.createWritable()
      await writable.write(payload)
      await writable.close()
      return
    }
    // fallback: root supports getFileHandle directly
    const fh = await (root as any).getFileHandle('index', { create: true })
    const writable = await fh.createWritable()
    await writable.write(payload)
    await writable.close()
  }

  /**
   * blob を書き込む
   * @param {string} filepath File path
   * @param {string} content File content
   * @param {string} [segment] Storage segment
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeBlob(filepath: string, content: string, segment?: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info'): Promise<void> {
    // Support special pseudo-segments to persist/read info explicitly
    const seg: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info' | 'info-workspace' | 'info-git' = (segment ?? 'workspace') as any
    const root = await this.getOpfsRoot()
    if (!root) throw new Error('OPFS not available')
    // Determine destination for actual blob write
    if (seg === 'info-workspace') {
      // writing index entry into workspace/info
      await this._writeToPrefix(root, `${VAR_WORKSPACE}/info`, filepath, content)
      return
    }
    const prefix = this._segmentToPrefix(seg as any)
    // write actual blob
    await this._writeToPrefix(root, prefix, filepath, content)

    // if writing to info segment itself, do not create recursive info entry
    if (seg === 'info' || seg === 'conflictBlob') return

    // create/update corresponding info entry summarizing this file
    const sha = await this.shaOf(content)
    const now = Date.now()
    await this._updateInfoForWrite(root, seg as any, filepath, sha, now)
  }

  /**
   * Build and persist info metadata for a file written to a segment.
   * @param {any} root Root directory handle
   * @param {string} seg Segment name
   * @param {string} filepath File path
   * @param {string} sha SHA hash
   * @param {number} now Current timestamp
   * @returns {Promise<void>}
   */
  private async _updateInfoForWrite(root: any, seg: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info', filepath: string, sha: string, now: number): Promise<void> {
    if (seg === 'conflictBlob') return
    const existing = await this._getExistingInfo(root, seg, filepath)

    let entry: any = { path: filepath, updatedAt: now }
    if (seg === 'workspace') entry = this._buildWorkspaceEntry(existing, filepath, sha, now)
    else if (seg === 'base') entry = this._buildBaseEntry(existing, filepath, sha, now)
    else if (seg === 'conflict') entry = this._buildConflictEntry(existing, filepath, now)

    // Persist info: workspace writes go to workspace/info, other segments to git-scoped info
    const targetPrefix = seg === 'workspace' ? `${VAR_WORKSPACE}/info` : this._segmentToPrefix('info')
    await this._writeToPrefix(root, targetPrefix, filepath, JSON.stringify(entry))
  }

  /**
   * Attempt to load existing info metadata used as basis when updating info.
   * @param {any} root Root directory handle
   * @param {string} seg Segment name
   * @param {string} filepath File path
   * @returns {Promise<any>} parsed existing info object or empty object
   */
  private async _getExistingInfo(root: any, seg: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info', filepath: string): Promise<any> {
    try {
      if (seg === 'workspace') {
        const gitBase = await this.readFromPrefix(root, this._segmentToPrefix('base'), filepath).catch(() => null)
        if (gitBase !== null) {
          const existingTxt = await this.readFromPrefix(root, this._segmentToPrefix('info'), filepath).catch(() => null)
          return existingTxt ? JSON.parse(existingTxt) : {}
        }
        const existingTxt = await this.readFromPrefix(root, `${VAR_WORKSPACE}/info`, filepath).catch(() => null)
        return existingTxt ? JSON.parse(existingTxt) : {}
      }
      const existingTxt = await this.readFromPrefix(root, this._segmentToPrefix('info'), filepath).catch(() => null)
      return existingTxt ? JSON.parse(existingTxt) : {}
    } catch {
      return {}
    }
  }

  /**
   * Build info entry for workspace writes.
   * @param {any} existing Existing info entry
   * @param {string} filepath File path
   * @param {string} sha SHA hash
   * @param {number} now Current timestamp
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
   * @param {any} existing Existing info entry
   * @param {string} filepath File path
   * @param {string} sha SHA hash
   * @param {number} now Current timestamp
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
   * @param {any} existing Existing info entry
   * @param {string} filepath File path
   * @param {number} now Current timestamp
   * @returns {any}
   */
  private _buildConflictEntry(existing: any, filepath: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.baseSha) entry.baseSha = existing.baseSha
    if (existing && existing.workspaceSha) entry.workspaceSha = existing.workspaceSha
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    entry.state = 'conflict'
    return entry
  }

  /**
   * Write content to a file under given prefix, creating directories as needed.
   * @param {any} root Root directory handle
   * @param {string} prefix Prefix path
   * @param {string} filepath File path
   * @param {string} content File content
   * @returns {Promise<void>}
   */
  private async _writeToPrefix(root: any, prefix: string, filepath: string, content: string): Promise<void> {
    const fullPath = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
    const parts = fullPath.split('/').filter(Boolean)
    const directoryParts = parts.slice(0, parts.length - 1)
    const parent = await this.ensureDir(root, directoryParts)
    const fh = await parent.getFileHandle(parts[parts.length - 1], { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }

  /**
   * Read text from a file handle returning null on failure.
   * @param {any} fh File handle
   * @returns {Promise<string|null>} file text or null
   */
  private async _readFileFromHandle(fh: any): Promise<string | null> {
    try {
      const file = await fh.getFile()
      const txt = await file.text()
      return txt ?? null
    } catch {
      return null
    }
  }

  /**
   * blob を読み出す
   * @param {string} filepath File path
   * @param {any} [segment] Storage segment
   * @returns {Promise<string|null>} ファイル内容、存在しなければ null
   */
  async readBlob(filepath: string, segment?: any): Promise<string | null> {
    const root = await this.getOpfsRoot()
    if (!root) return null
    return await this._readBlobFromRoot(root, segment, filepath)
  }

  /**
   * Read blob from a resolved root. Extracted to reduce cognitive complexity of public entry.
   * @param {any} root Root directory handle
   * @param {string} segment Segment name
   * @param {string} filepath File path
   * @returns {Promise<string|null>}
   */
  private async _readBlobFromRoot(root: any, segment: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info' | undefined, filepath: string): Promise<string | null> {
    // segment指定がある場合はそのまま返却
    if (segment !== undefined) {
      return await this._readFromSegment(root, segment, filepath)
    }

    // segment未指定の場合はworkspace→baseの順で参照
    const workspaceContent = await this._readFromSegment(root, 'workspace', filepath)
    if (workspaceContent !== null) return workspaceContent
    return await this._readFromSegment(root, 'base', filepath)
  }

  /**
   * Read from a specific segment prefix.
   * @param {any} root Root directory handle
   * @param {string} segment Segment name
   * @param {string} filepath File path
   * @returns {Promise<string|null>} file text or null
   */
  private async _readFromSegment(root: any, segment: 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info' | 'info-git' | 'info-workspace', filepath: string): Promise<string | null> {
    try {
      if (segment === 'info') {
        // prefer workspace-local info first, then git-scoped info
        const ws = await this.readFromPrefix(root, `${VAR_WORKSPACE}/info`, filepath).catch(() => null)
        if (ws !== null) return ws
        return await this.readFromPrefix(root, this._segmentToPrefix('info'), filepath).catch(() => null)
      }
      // read git-only info
      if (segment === 'info-git') {
        return await this.readFromPrefix(root, this._segmentToPrefix('info'), filepath).catch(() => null)
      }
      // read workspace-only info
      if (segment === 'info-workspace') {
        return await this.readFromPrefix(root, `${VAR_WORKSPACE}/info`, filepath).catch(() => null)
      }
      const prefix = this._segmentToPrefix(segment)
      return await this.readFromPrefix(root, prefix, filepath)
    } catch {
      return null
    }
  }

  /**
   * Read by trying each variant in order and returning first match.
   * @param {any} root Root directory handle
   * @param {string} filepath File path
   * @returns {Promise<string|null>} file text or null
   */
  private async _readFromVariants(root: any, filepath: string): Promise<string | null> {
    for (const v of this.getVariants()) {
      const prefix = v === VAR_WORKSPACE ? this._segmentToPrefix('workspace') : this._segmentToPrefix(v as any)
      const txt = await this.readFromPrefix(root, prefix, filepath)
      if (txt !== null) return txt
    }
    return null
  }

  /**
   * blob を削除する
   * @param {string} filepath File path
   * @param {any} [segment] Storage segment
   * @returns {Promise<void>} 削除完了時に解決
   */
  async deleteBlob(filepath: string, segment?: any): Promise<void> {
    const root = await this.getOpfsRoot()
    if (!root) return
    if (segment === 'workspace') {
      // remove workspace blob and corresponding workspace/info entry
      await this.removeAtPrefix(root, this._segmentToPrefix('workspace'), filepath)
      await this.removeAtPrefix(root, `${VAR_WORKSPACE}/info`, filepath)
      return
    }
    if (segment === 'base') { await this.removeAtPrefix(root, this._segmentToPrefix('base'), filepath); return }
    if (segment === 'conflict') { await this.removeAtPrefix(root, this._segmentToPrefix('conflict'), filepath); return }
    if (segment === 'conflictBlob') { await this.removeAtPrefix(root, this._segmentToPrefix('conflictBlob'), filepath); return }
    if (segment === 'info') {
      // delete workspace-local info and git-scoped info for this branch
      await this.removeAtPrefix(root, `${VAR_WORKSPACE}/info`, filepath)
      await this.removeAtPrefix(root, this._segmentToPrefix('info'), filepath)
      return
    }

    for (const v of this.getVariants()) {
      const prefix = v === VAR_WORKSPACE ? this._segmentToPrefix('workspace') : this._segmentToPrefix(v as any)
      await this.removeAtPrefix(root, prefix, filepath)
    }
    // also remove any info entries (workspace-local and git-scoped)
    await this.removeAtPrefix(root, `${VAR_WORKSPACE}/info`, filepath)
    await this.removeAtPrefix(root, this._segmentToPrefix('info'), filepath)
  }

  /**
   * Remove a file at a given prefix (does not create directories)
   * @param {any} root root directory handle
   * @param {string} prefix prefix dir
   * @param {string} filepath path relative to prefix
   * @returns {Promise<void>} resolves when removal attempted (errors are ignored)
   */
  private async removeAtPrefix(root: any, prefix: string, filepath: string): Promise<void> {
    const full = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
    const parts = full.split('/').filter(Boolean)
    let directory: any
    // ディレクトリが存在しない場合（NotFound）は削除対象なしとして終了
    try {
      directory = await this.traverseDir(root, parts.slice(0, parts.length - 1))
    } catch {
      return
    }
    const name = parts[parts.length - 1]
    if (typeof directory.removeEntry === 'function') {
      try {
        await directory.removeEntry(name)
      } catch {
        // removeEntryが失敗しても無視（存在しない等）
      }
      return
    }
    if (typeof directory.getFileHandle === 'function') {
      await this.tryRemoveFileHandle(directory, name)

    }
  }

  /**
   * Read a file under a prefix without throwing. Returns null when not found.
   * @param {any} root root directory handle
   * @param {string} prefix prefix dir
   * @param {string} filepath path relative to prefix
   * @returns {Promise<string|null>} file contents or null when not found
   */
  private async readFromPrefix(root: any, prefix: string, filepath: string): Promise<string | null> {
    // reuse existing traversal logic but guard errors
    try {
      const fullPath = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
      const parts = fullPath.split('/').filter(Boolean)
      const directory = await this.traverseDir(root, parts.slice(0, parts.length - 1))
      const fh = await directory.getFileHandle(parts[parts.length - 1])
      return await this._readFileFromHandle(fh)
    } catch {
      return null
    }
  }

  /**
   * Traverse into nested directories without creating them.
   * @param {any} root The starting directory handle
   * @param {string[]} parts Path parts to traverse
   * @returns {Promise<any>} The final directory handle
   */
  private async traverseDir(root: any, parts: string[]): Promise<any> {
    let directory = root
    for (const part of parts) {
      if (directory && typeof directory.getDirectoryHandle === 'function') {
        directory = await directory.getDirectoryHandle(part)
      } else if (directory && typeof directory.getDirectory === 'function') {
        directory = await directory.getDirectory(part)
      } else {
        throw new Error(ERR_OPFS_DIR_API)
      }
    }
    return directory
  }

  /**
   * List all file paths under given prefix (relative paths).
   * @param {any} root Root directory handle
   * @param {string} prefix Prefix path
   * @returns {Promise<string[]>} Array of relative file paths; empty array on failure
   */
  private async listFilesAtPrefix(root: any, prefix: string): Promise<string[]> {
    try {
      const prefixParts = prefix ? prefix.split('/').filter(Boolean) : []
      const parts = this.rootDir ? this.rootDir.split('/').filter(Boolean).concat(prefixParts) : prefixParts
      const directory = await this.traverseDir(root, parts)
      const results: string[] = []
      await this._recurseListDir(directory, '', results)
      return results
    } catch {
      return []
    }
  }

  /**
   * Helper to recursively walk directory handles and collect file paths.
   * @param {any} d Directory handle
   * @param {string} base Base path
   * @param {string[]} results Results array
   * @returns {Promise<void>}
   */
  private async _recurseListDir(d: any, base: string, results: string[]): Promise<void> {
    // Prefer entries() async iterator; if unavailable, delegate to fallback.
    try {
      for await (const pair of (d as any).entries()) {
        await this._processEntryPair(pair, base, results)
      }
      return
    } catch {
      return
    }
  }

  /**
   * Process a single entry returned by entries(): push files or recurse into directories.
   * @param {any} pair Entry pair from iterator
   * @param {string} base Base path
   * @param {string[]} results Results array
   * @returns {Promise<void>}
   */
  private async _processEntryPair(pair: any, base: string, results: string[]): Promise<void> {
    const name = Array.isArray(pair) ? pair[0] : (pair.name || '')
    const handle = Array.isArray(pair) ? pair[1] : (pair[1] || pair)
    const childPath = base ? `${base}/${name}` : name
    if ((handle as any).kind === 'file' || typeof (handle as any).getFile === 'function') {
      results.push(childPath)
    } else {
      await this._recurseListDir(handle, childPath, results)
    }
  }

  /**
   * Fallback recursion over directory when entries() iterator unavailable.
   * @param {any} d Directory handle
   * @param {string} base Base path
   * @param {string[]} results Results array
   * @returns {Promise<void>}
   */
  private async _recurseListDirFallback(d: any, base: string, results: string[]): Promise<void> {
    for await (const name of (d as any).keys()) {
      await this._handleChildEntry(d, name, base, results)
    }
  }
  
  /**
   * Handle a single child entry from directory listing.
   * @param {any} d Directory handle
   * @param {string} name Entry name
   * @param {string} base Base path
   * @param {string[]} results Results array
   * @returns {Promise<void>}
   */
  private async _handleChildEntry(d: any, name: string, base: string, results: string[]): Promise<void> {
    const childPath = base ? `${base}/${name}` : name
    if (typeof d.getFileHandle === 'function') {
      try {
        const fh = await d.getFileHandle(name)
        if (fh) { results.push(childPath); return }
      } catch {
        return
      }
    }
    if (typeof d.getDirectoryHandle === 'function') {
      try {
        const childDirectory = await d.getDirectoryHandle(name)
        await this._recurseListDir(childDirectory, childPath, results)
      } catch {
        return
      }
    }
  }

  /**
   * Safely list files at prefix, returning an empty array on error.
   * @param {any} root Root directory handle
   * @param {string} segPrefix Segment prefix
   * @returns {Promise<string[]>}
   */
  private async _safeListFilesAtPrefix(root: any, segPrefix: string): Promise<string[]> {
    return this.listFilesAtPrefix(root, segPrefix).catch(() => [])
  }

  /**
   * Collect info objects for given keys under VAR_INFO
   * @param {any} root Root directory handle
   * @param {string[]} keys Array of keys
   * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  private async _collectInfoForKeys(root: any, keys: string[]): Promise<Array<{ path: string; info: string | null }>> {
    const out: Array<{ path: string; info: string | null }> = []
    const infoPrefix = this._segmentToPrefix('info') // existing line
    const wsInfoPrefix = `${VAR_WORKSPACE}/info` // new line
    for (const k of keys) {
      let info: string | null = await this.readFromPrefix(root, wsInfoPrefix, k).catch(() => null)
      if (info === null) info = await this.readFromPrefix(root, infoPrefix, k).catch(() => null)
      out.push({ path: k, info }) // existing line
    }
    return out
  }

  /**
   * 指定プレフィックス配下のファイル一覧を取得します。
   * @param {string} [prefix] プレフィックス（例: 'dir/sub'）。省略時はルート
   * @param {any} [segment] セグメント（'workspace' 等）。省略時は 'workspace'
   * @param {boolean} [recursive] サブディレクトリも含めるか。省略時は true
   * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  async listFiles(prefix?: string, segment?: any, recursive = true): Promise<Array<{ path: string; info: string | null }>> {
    const root = await this.getOpfsRoot()
    if (!root) return []
    const seg: 'workspace' | 'base' | 'conflict' | 'info' = segment ?? 'workspace'
    const segPrefix = this._segmentToPrefix(seg)

    // Return a plain array of relative file path strings; tests for OpfsStorage expect strings
    const keys = await this._safeListFilesAtPrefix(root, segPrefix)
    const p = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    const filtered = this._filterKeys(keys, p, recursive)
    // Return array of objects { path, info } as required by StorageBackend interface
    return await this._collectInfoForKeys(root, filtered)
  }

  /**
   * Raw listing that returns implementation-specific URIs and a normalized path.
   * @param {string} [prefix] optional prefix to filter
   * @param {boolean} [recursive] whether to include subdirectories
   * @returns {Promise<Array<{uri:string,path:string,info?:string|null}>>} array of entries with uri/path/info
   */
  async listFilesRaw(prefix?: string, recursive = true): Promise<Array<{ uri: string; path: string; info?: string | null }>> {
    const navRoot = await OpfsStorage._getNavigatorStorageRoot()
    if (!navRoot) return []

    const storageDirectory = await this._findStorageDirectory(navRoot)
    if (!storageDirectory) return []

    const results: string[] = []
    await this._recurseListDir(storageDirectory, '', results)

    const p = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    const keys = this._filterKeys(results, p, recursive)

    const out: Array<{ uri: string; path: string; info?: string | null }> = []
    for (const k of keys) {
      const uri = `${this.rootDir}/${k}`
      const info = await this._getInfoForOpfsKey(navRoot, k)
      out.push({ uri, path: uri, info })
    }
    return out
  }

  /**
   * Locate the configured storage root directory handle under navigator.storage root.
   * @param {any} navRoot Navigator storage root
   * @returns {Promise<any|null>} directory handle or null when not found
   */
  private async _findStorageDirectory(navRoot: any): Promise<any | null> {
    try {
      const parts = this.rootDir.split('/').filter(Boolean)
      const directoryHandle = await this.traverseDir(navRoot, parts)
      return directoryHandle
    } catch {
      return null
    }
  }

  /**
   * Read info metadata for a given key from workspace-local info or git-scoped info.
   * @param {any} navRoot Navigator storage root
   * @param {string} key Key to lookup
   * @returns {Promise<string|null>} JSON string or null when absent
   */
  private async _getInfoForOpfsKey(navRoot: any, key: string): Promise<string | null> {
    try {
      const ws = await this.readFromPrefix(navRoot, `${VAR_WORKSPACE}/info`, key).catch(() => null)
      if (ws !== null) return ws
      return await this.readFromPrefix(navRoot, this._segmentToPrefix('info'), key).catch(() => null)
    } catch {
      return null
    }
  }

  /**
   * Filter keys by prefix and recursion flag for OPFS listing
   * @param {string[]} keys Array of keys
   * @param {string} p Path prefix
   * @param {boolean} recursive Whether to include subdirectories
   * @returns {string[]}
   */
  private _filterKeys(keys: string[], p: string, recursive: boolean): string[] {
    let out = keys
    if (p) out = out.filter((k) => k === p || k.startsWith(p + '/'))
    if (!recursive) {
      out = out.filter((k) => {
        const rest = p ? k.slice(p.length + 1) : k
        return !rest.includes('/')
      })
    }
    return out
  }

  /**
   * Try to remove a file via its file handle.
   * @param {any} directory Directory handle
   * @param {string} name File name
   * @returns {Promise<boolean>} true when removed, false otherwise
   */
  private async tryRemoveFileHandle(directory: any, name: string): Promise<boolean> {
    try {
      const fh = await directory.getFileHandle(name)
      if (fh && typeof (fh as any).remove === 'function') {
        await (fh as any).remove()
        return true
      }
      return false
    } catch {
      // getFileHandle/remove が例外を投げた場合は削除できなかったと扱う
      return false
    }
  }

  /**
   * 指定されたルート名のディレクトリを削除します
   * @param {string} rootName 削除するルート名
   * @returns {Promise<void>}
   */
  static async delete(rootName: string): Promise<void> {
    try {
      const root = await OpfsStorage._getNavigatorStorageRoot()
      if (!root) throw new Error('OPFS root not available')

      if (typeof (root as any).removeEntry === 'function') {
        await (root as any).removeEntry(rootName, { recursive: true })
      } else {
        throw new Error('removeEntry not supported')
      }
    } catch (error) {
      throw new Error(`Failed to delete OPFS root "${rootName}": ${String(error)}`)
    }
  }
}

export default OpfsStorage

