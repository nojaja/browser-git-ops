import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor } from './storageBackend'
import { updateInfoForWrite } from './metadataManager'

/**
 * テストや軽量動作検証用のインメモリ実装。
 * `StorageBackend` を実装し、アプリケーション側で差し替えて利用できます。
 */
export const InMemoryStorage: StorageBackendConstructor = class InMemoryStorage implements StorageBackend {
  private rootKey: string
  private currentBranch: string | null = null

  // shared storage across instances keyed by root name
  private static stores: Map<string, {
    index: IndexFile,
    workspaceBlobs: Map<string,string>,
    baseBlobs: Map<string,string>,
    conflictBlobs: Map<string,string>,
    infoBlobs: Map<string,string>
  }> = new Map()
  private static BRANCH_SEP = '::'
  private static SEG_INFO_WORKSPACE = 'info-workspace'
  private static SEG_INFO_GIT = 'info-git'

  /**
   * 静的: この実装が利用可能かを同期判定します。
   * テスト/インメモリなので常に true を返します。
   * @returns {boolean} 利用可能なら true
   */
  static canUse(): boolean {
    return true
  }
  /**
   * 利用可能なルート名を返します。
   * @returns {string[]} ルート名の配列
   */
  static availableRoots(): string[] {
    const keys = Array.from(InMemoryStorage.stores.keys())
    return keys.length ? keys : ['apigit_storage']
  }
  // legacy canUseOpfs removed; use static canUse() instead
  /**
   * コンストラクタ。互換性のためにディレクトリ名を受け取るが無視する。
   * @param directory 任意のディレクトリ文字列（使用しない）
   */
  constructor(directory?: string) {
    // If caller provides a directory name, share storage by that name. If omitted, create isolated store per instance.
    this.rootKey = directory ?? `__inmem_${Math.random().toString(36).slice(2)}`
    if (!InMemoryStorage.stores.has(this.rootKey)) {
      InMemoryStorage.stores.set(this.rootKey, {
        index: { head: '', entries: {} },
        workspaceBlobs: new Map(),
        baseBlobs: new Map(),
          conflictBlobs: new Map(),
          infoBlobs: new Map()
      })
    }
  }

  /**
   *
   */
  /**
   * Set the current branch for this storage instance.
   * @param branch branch name or null
   * @returns {void}
   */
  setBranch(branch?: string | null): void {
    this.currentBranch = branch || null
  }

  /**
   * 初期化処理（インメモリでは何もしない）
   * @returns {Promise<void>} 解決時に初期化完了
   */
  async init(): Promise<void> {
    return
  }

  /**
   * 現在の `IndexFile` を返します。
   * @returns {Promise<IndexFile|null>} IndexFile（常に非null）
   */
  async readIndex(): Promise<IndexFile | null> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    // Reconstruct entries from infoBlobs map
    const result: IndexFile = { head: store.index.head || '', entries: {} }
    const branch = this.currentBranch || 'main'
    // Merge workspace-local info entries and branch-scoped info entries
    this._mergeWorkspaceInfoFromStore(store, result, branch)
    this._mergeBranchInfoFromStore(store, result, branch)
    if ((store.index as any).lastCommitKey) result.lastCommitKey = (store.index as any).lastCommitKey
    // Preserve adapter metadata if present
    if ((store.index as any).adapter) result.adapter = (store.index as any).adapter
    return result
  }

  /**
   * Merge unprefixed (workspace-local) info entries into result.
   */
  private _mergeWorkspaceInfoFromStore(store: any, result: IndexFile, branch: string): void {
    for (const [k, v] of store.infoBlobs.entries()) {
      if (k.startsWith(branch + InMemoryStorage.BRANCH_SEP)) continue
      try { result.entries[k] = JSON.parse(v) } catch (_) { continue }
    }
  }

  /**
   * Merge branch-prefixed info entries into result without overwriting workspace-local entries.
   */
  private _mergeBranchInfoFromStore(store: any, result: IndexFile, branch: string): void {
    for (const [k, v] of store.infoBlobs.entries()) {
      if (!k.startsWith(branch + InMemoryStorage.BRANCH_SEP)) continue
      const filepath = k.slice((branch + InMemoryStorage.BRANCH_SEP).length)
      if (result.entries[filepath]) continue
      try { result.entries[filepath] = JSON.parse(v) } catch (_) { continue }
    }
  }

  /**
   * IndexFile を設定します。
   * @param idx 書き込む IndexFile
   */
  /**
   * Persist IndexFile metadata and expose entries via in-memory info blobs.
   * @param idx 書き込む IndexFile
   * @returns {Promise<void>} resolved when write complete
   */
  async writeIndex(index: IndexFile): Promise<void> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    // write entries individually to infoBlobs, then persist meta
    const entries = index.entries || {}
    // Persist index entries into workspace-local info (unprefixed keys)
    // Write info entries for all index entries to ensure index metadata
    // is visible to ChangeTracker and other consumers.
    for (const filepath of Object.keys(entries)) {
      store.infoBlobs.set(filepath, JSON.stringify(entries[filepath]))
    }
    const meta: any = { head: index.head }
    if ((index as any).lastCommitKey) meta.lastCommitKey = (index as any).lastCommitKey
    if ((index as any).adapter) meta.adapter = (index as any).adapter
    store.index = Object.assign({}, meta, { entries: {} })
  }

  /**
   * 指定パスに対して文字列コンテンツを保存します。
   * @param filepath ファイルパス
   * @param content ファイル内容
   */
  /**
   * Persist a blob into the in-memory store for the given segment.
   * @param filepath ファイルパス
   * @param content ファイル内容
   * @returns {Promise<void>}
   */
  async writeBlob(filepath: string, content: string, segment?: any): Promise<void> {
    const seg = segment || 'workspace'
    const store = InMemoryStorage.stores.get(this.rootKey)!
    this._applyBlobToStore(store, seg, filepath, content)
    // update info metadata when writing to workspace/base/conflict
    // Delegate workspace-special handling to helper to reduce complexity
    const handled = await this._handleWorkspaceWriteIfNeeded(store, seg, filepath, content)
    if (handled) return

    // For explicit info-workspace/info-git writes, we've already stored
    // the provided content directly; skip the generic metadata updater
    if (seg === InMemoryStorage.SEG_INFO_WORKSPACE || seg === InMemoryStorage.SEG_INFO_GIT) return

    const wrapped = seg === 'workspace' ? this._wrapStoreForInfoNoPrefix(store) : this._wrapStoreForInfoPrefix(store)
    await updateInfoForWrite(wrapped, filepath, seg, content)
  }

  /**
   * Handle the special case when writing to workspace and a git base exists.
   * Returns true when the helper handled the update and caller should return early.
    * @returns {Promise<boolean>} true if handled
   */
  private async _handleWorkspaceWriteIfNeeded(store: any, seg: string, filepath: string, content: string): Promise<boolean> {
    if (seg !== 'workspace') return false
    const branch = this.currentBranch || 'main'
    const gitBaseKey = `${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`
    if (!store.baseBlobs.has(gitBaseKey)) return false
    // Build workspace info based on git-scoped info
    const gitInfoTxt = store.infoBlobs.has(gitBaseKey) ? store.infoBlobs.get(gitBaseKey)! : null
    let existing: any = undefined
    if (gitInfoTxt) {
      try { existing = JSON.parse(gitInfoTxt) } catch (_) { existing = undefined }
    }
    const sha = await this.shaOf(content)
    const now = Date.now()
    const entry = this._buildWorkspaceInfoEntry(existing, filepath, sha, now)
    store.infoBlobs.set(filepath, JSON.stringify(entry))
    return true
  }

  /**
   * Persist a blob into the appropriate in-memory map for the segment.
   * @returns {void}
   */
  /**
   * Persist a blob into the appropriate in-memory map for the segment.
   * @returns {void}
   */
  private _applyBlobToStore(store: any, seg: string, filepath: string, content: string): void {
    const branch = this.currentBranch || 'main'
    if (seg === 'workspace') store.workspaceBlobs.set(filepath, content)
    else if (seg === 'base') store.baseBlobs.set(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`, content)
    else if (seg === 'conflict') store.conflictBlobs.set(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`, content)
    else if (seg === 'info') store.infoBlobs.set(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`, content)
    else if (seg === InMemoryStorage.SEG_INFO_WORKSPACE) store.infoBlobs.set(filepath, content)
    else if (seg === 'info-git') store.infoBlobs.set(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`, content)
    else throw new Error('unknown segment')
  }

  /**
   * Build the info entry for a write into a given segment.
   * @returns {any} info entry object
   */
  /**
   * Build the info entry for a write into a given segment.
   * @returns {any} info entry object
   */
  private _buildInfoEntryForSeg(seg: string, existing: any, filepath: string, sha: string, now: number): any {
    if (seg === 'workspace') return this._buildWorkspaceInfoEntry(existing, filepath, sha, now)
    if (seg === 'base') return this._buildBaseInfoEntry(existing, filepath, sha, now)
    if (seg === 'conflict') return this._buildConflictInfoEntry(existing, filepath, now)
    return { path: filepath, updatedAt: now }
  }

  /**
   * Build info entry when writing to the workspace segment
   * @returns {any}
   */
  private _buildWorkspaceInfoEntry(existing: any, filepath: string, sha: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.baseSha) entry.baseSha = existing.baseSha
    entry.workspaceSha = sha
    entry.state = entry.baseSha ? 'modified' : 'added'
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    return entry
  }

  /**
   * Build info entry when writing to the base segment
   * @returns {any}
   */
  private _buildBaseInfoEntry(existing: any, filepath: string, sha: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.workspaceSha) entry.workspaceSha = existing.workspaceSha
    entry.baseSha = sha
    entry.state = 'base'
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    return entry
  }

  /**
   * Build info entry when writing to the conflict segment
   * @returns {any}
   */
  private _buildConflictInfoEntry(existing: any, filepath: string, now: number): any {
    const entry: any = { path: filepath, updatedAt: now }
    if (existing && existing.baseSha) entry.baseSha = existing.baseSha
    if (existing && existing.workspaceSha) entry.workspaceSha = existing.workspaceSha
    if (existing && existing.remoteSha) entry.remoteSha = existing.remoteSha
    entry.state = 'conflict'
    return entry
  }

  /**
   * 指定パスの内容を取得します。
   * @param filepath ファイルパス
   * @returns {Promise<string|null>} 内容、存在しなければ null
   */
  /**
   * Retrieve blob content for a path and optional segment.
   * @returns {Promise<string|null>} content or null
   */
  /**
   * Read a blob either from a specific segment or by default (workspace->base).
   * Delegates to helpers to keep complexity low.
   * @returns {Promise<string|null>}
   */
  async readBlob(filepath: string, segment?: any): Promise<string | null> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    if (segment !== undefined) return await this._readBlobForSegment(store, filepath, String(segment))
    return await this._readBlobDefault(store, filepath)
  }

  /**
   * Helper: read blob when a segment is specified.
   * @returns {Promise<string|null>}
   */
  private async _readBlobForSegment(store: any, filepath: string, seg: string): Promise<string | null> {
    if (seg === InMemoryStorage.SEG_INFO_WORKSPACE) return this._readInfoWorkspace(store, filepath)
    if (seg === InMemoryStorage.SEG_INFO_GIT) return this._readInfoGit(store, filepath)
    return this._readBlobForNonInfo(store, filepath, seg)
  }

  /**
   * Read from a branch-prefixed Map for seg types base/conflict/info.
   * @returns {string|null}
   */
  private _readFromPrefixedStore(m: Map<string,string>, filepath: string, branch: string, seg: string): string | null {
    if (seg === 'info') {
      if (m.has(filepath)) return m.get(filepath)!
      const key = `${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`
      return m.has(key) ? m.get(key)! : null
    }
    const key = `${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`
    return m.has(key) ? m.get(key)! : null
  }

  /**
   * Read a workspace-local info entry from the store.
   * @returns {string|null}
   */
  private _readInfoWorkspace(store: any, filepath: string): string | null {
    return store.infoBlobs.has(filepath) ? store.infoBlobs.get(filepath)! : null
  }

  /**
   * Read a branch-scoped info entry from the store for current branch.
   * @returns {string|null}
   */
  private _readInfoGit(store: any, filepath: string): string | null {
    const branch = this.currentBranch || 'main'
    const key = `${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`
    return store.infoBlobs.has(key) ? store.infoBlobs.get(key)! : null
  }

  /**
   * Read a blob for non-info segments (workspace/base/conflict), using branch-prefixed keys where appropriate.
   * @returns {string|null}
   */
  private _readBlobForNonInfo(store: any, filepath: string, seg: string): string | null {
    const segmentToStore = {
      workspace: store.workspaceBlobs,
      base: store.baseBlobs,
      conflict: store.conflictBlobs,
      info: store.infoBlobs,
    } as Record<string, Map<string, string>>
    const m = segmentToStore[seg]
    if (!m) return null
    const branch = this.currentBranch || 'main'
    if (seg === 'workspace') return m.has(filepath) ? m.get(filepath)! : null
    return this._readFromPrefixedStore(m, filepath, branch, seg)
  }

  /**
   * Helper: default read (workspace -> base)
   * @returns {Promise<string|null>}
   */
  private async _readBlobDefault(store: any, filepath: string): Promise<string | null> {
    const workspace = store.workspaceBlobs
    if (workspace && workspace.has(filepath)) return workspace.get(filepath)!
    const base = store.baseBlobs
    const branch = this.currentBranch || 'main'
    if (base && base.has(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`)) return base.get(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`)!
    return null
  }

  /**
   * 指定パスのエントリを削除します。
   * @param filepath ファイルパス
   */
  /**
   * Delete blob(s) for the given path and optional segment.
   * @returns {Promise<void>}
   */
  async deleteBlob(filepath: string, segment?: any): Promise<void> {
    // If segment specified, delete only that segment
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const branch = this.currentBranch || 'main'
    if (segment === 'workspace') { store.workspaceBlobs.delete(filepath); store.infoBlobs.delete(filepath); return }
    if (segment === 'base') { store.baseBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`); return }
    if (segment === 'conflict') { store.conflictBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`); return }
    if (segment === 'info') { store.infoBlobs.delete(filepath); store.infoBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`); return }
    if (segment === 'info-workspace') { store.infoBlobs.delete(filepath); return }
    if (segment === 'info-git') { store.infoBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`); return }
    // otherwise delete from all segments
    store.workspaceBlobs.delete(filepath)
    store.baseBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`)
    store.conflictBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`)
    store.infoBlobs.delete(`${branch}${InMemoryStorage.BRANCH_SEP}${filepath}`)
    store.infoBlobs.delete(filepath)
  }

  /**
   * 指定プレフィックス配下のファイル一覧を取得します。
   * @param prefix プレフィックス（例: 'dir/sub'）
   * @param segment セグメント（'workspace' 等）。省略時は 'workspace'
   * @param recursive サブディレクトリも含めるか。省略時は true
  * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  /**
   * List files under a prefix for a given segment.
   * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  async listFiles(prefix?: string, segment?: any, recursive = true): Promise<Array<{ path: string; info: string | null }>> {
    const seg = segment || 'workspace'
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const p = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    const keys = this._computeListKeys(store, String(seg), p, recursive)

    const out: Array<{ path: string; info: string | null }> = []
    for (const k of keys) {
      const branch = this.currentBranch || 'main'
      // prefer workspace-local info (unprefixed) then branch-prefixed info
      let info: string | null = null
      if (store.infoBlobs.has(k)) info = store.infoBlobs.get(k)!
      else if (store.infoBlobs.has(`${branch}${InMemoryStorage.BRANCH_SEP}${k}`)) info = store.infoBlobs.get(`${branch}${InMemoryStorage.BRANCH_SEP}${k}`)!
      out.push({ path: k, info })
    }
    return out
  }

  /**
   * Compute merged and filtered keys for listFiles to keep logic small.
    * @returns {string[]} merged keys
   */
  private _computeListKeys(store: any, seg: string, p: string, recursive: boolean): string[] {
    const segmentToStore = {
      workspace: store.workspaceBlobs,
      base: store.baseBlobs,
      conflict: store.conflictBlobs,
      info: store.infoBlobs,
    } as Record<string, Map<string, string>>
    const m = segmentToStore[String(seg)]
    if (!m) return []
    let keys = Array.from(m.keys())
    // For info store include both unprefixed (workspace-local) keys and branch-prefixed keys
    if (seg === 'info') {
      const branch = this.currentBranch || 'main'
      const unpref = keys.filter((k) => !k.startsWith(branch + InMemoryStorage.BRANCH_SEP))
      const pref = keys.filter((k) => k.startsWith(branch + InMemoryStorage.BRANCH_SEP)).map((k) => k.slice((branch + InMemoryStorage.BRANCH_SEP).length))
      keys = Array.from(new Set(unpref.concat(pref)))
    } else if (seg !== 'workspace') {
      const branch = this.currentBranch || 'main'
      keys = keys.filter((k) => k.startsWith(branch + InMemoryStorage.BRANCH_SEP)).map((k) => k.slice((branch + InMemoryStorage.BRANCH_SEP).length))
    }
    return this._filterKeys(keys, p, recursive)
  }

  /**
   * Filter keys by prefix and recursion flag for InMemoryStorage
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
   * Return a wrapper for store.infoBlobs that applies branch prefix for gets/sets.
   * @returns {any}
   */
  private _wrapStoreForInfoPrefix(store: any): any {
    const branch = this.currentBranch || 'main'
    // eslint-disable-next-line jsdoc/require-jsdoc
    const prefixKey = (k: string) => `${branch}${InMemoryStorage.BRANCH_SEP}${k}`
    return Object.assign({}, store, {
      infoBlobs: {
          // eslint-disable-next-line jsdoc/require-jsdoc
          has: (k: string) => store.infoBlobs.has(prefixKey(k)) || store.infoBlobs.has(k),
          // eslint-disable-next-line jsdoc/require-jsdoc
          get: (k: string) => {
          if (store.infoBlobs.has(prefixKey(k))) return store.infoBlobs.get(prefixKey(k))
          return store.infoBlobs.has(k) ? store.infoBlobs.get(k) : undefined
        },
          // eslint-disable-next-line jsdoc/require-jsdoc
          set: (k: string, v: string) => { store.infoBlobs.set(prefixKey(k), v); store.infoBlobs.delete(k) },
          // eslint-disable-next-line jsdoc/require-jsdoc
          delete: (k: string) => { store.infoBlobs.delete(prefixKey(k)); store.infoBlobs.delete(k) }
      }
    })
  }

  /**
   * Return a wrapper for store.infoBlobs that exposes raw (no-prefix) operations.
   * @returns {any}
   */
  private _wrapStoreForInfoNoPrefix(store: any): any {
    return Object.assign({}, store, {
      infoBlobs: {
        // eslint-disable-next-line jsdoc/require-jsdoc
        has: (k: string) => store.infoBlobs.has(k),
        // eslint-disable-next-line jsdoc/require-jsdoc
        get: (k: string) => store.infoBlobs.get(k),
        // eslint-disable-next-line jsdoc/require-jsdoc
        set: (k: string, v: string) => store.infoBlobs.set(k, v),
        // eslint-disable-next-line jsdoc/require-jsdoc
        delete: (k: string) => store.infoBlobs.delete(k)
      }
    })
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
   * 指定されたルート名を削除します
   * @param rootName 削除するルート名
   * @returns {void}
   */
  static delete(rootName: string): void {
    if (InMemoryStorage.stores.has(rootName)) {
      InMemoryStorage.stores.delete(rootName)
    } else {
      throw new Error(`InMemory root "${rootName}" not found`)
    }
  }

}

export default InMemoryStorage
