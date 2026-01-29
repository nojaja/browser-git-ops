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
    // First, load workspace-local info entries (unprefixed keys)
    for (const [k, v] of store.infoBlobs.entries()) {
      if (k.startsWith(branch + '::')) continue
      try {
        const parsed = JSON.parse(v)
        // Preserve workspace-local entries (including tombstones) so they
        // shadow branch-scoped info entries loaded later.
        result.entries[k] = parsed
      } catch (_) { continue }
    }
    // Then load branch-scoped info entries (keys prefixed with `${branch}::`), but do not overwrite workspace-local
    for (const [k, v] of store.infoBlobs.entries()) {
      if (!k.startsWith(branch + '::')) continue
      const filepath = k.slice((branch + '::').length)
      if (result.entries[filepath]) continue
      try {
        const parsed = JSON.parse(v)
        if (parsed && parsed.state === 'deleted') continue
        result.entries[filepath] = parsed
      } catch (_) { continue }
    }
    if ((store.index as any).lastCommitKey) result.lastCommitKey = (store.index as any).lastCommitKey
    // Preserve adapter metadata if present
    if ((store.index as any).adapter) result.adapter = (store.index as any).adapter
    return result
  }

  /**
   * IndexFile を設定します。
   * @param idx 書き込む IndexFile
   */
  async writeIndex(index: IndexFile): Promise<void> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    // write entries individually to infoBlobs, then persist meta
    const entries = index.entries || {}
    const branch = this.currentBranch || 'main'
    // Persist index entries into workspace-local info (unprefixed keys)
    // Only write info entries for files that exist in workspaceBlobs
    for (const filepath of Object.keys(entries)) {
      if (!store.workspaceBlobs.has(filepath)) continue
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
  async writeBlob(filepath: string, content: string, segment?: any): Promise<void> {
    const seg = segment || 'workspace'
    const store = InMemoryStorage.stores.get(this.rootKey)!
    this._applyBlobToStore(store, seg, filepath, content)
    // update info metadata when writing to workspace/base/conflict
    // For workspace writes, if a git base exists for this file, treat this
    // update as coming from the git base and build workspace/info based on
    // the git-scoped info; otherwise fall back to the default helper.
    const branch = this.currentBranch || 'main'
    if (seg === 'workspace') {
      const gitBaseKey = `${branch}::${filepath}`
      if (store.baseBlobs.has(gitBaseKey)) {
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
        return
      }
    }
    // For explicit info-workspace/info-git writes, we've already stored
    // the provided content directly; skip the generic metadata updater
    if (seg === 'info-workspace' || seg === 'info-git') return

    const wrapped = seg === 'workspace' ? this._wrapStoreForInfoNoPrefix(store) : this._wrapStoreForInfoPrefix(store)
    await updateInfoForWrite(wrapped, filepath, seg, content)
  }

  /**
   * Persist a blob into the appropriate in-memory map for the segment.
   * @returns {void}
   */
  private _applyBlobToStore(store: any, seg: string, filepath: string, content: string): void {
    const branch = this.currentBranch || 'main'
    if (seg === 'workspace') store.workspaceBlobs.set(filepath, content)
    else if (seg === 'base') store.baseBlobs.set(`${branch}::${filepath}`, content)
    else if (seg === 'conflict') store.conflictBlobs.set(`${branch}::${filepath}`, content)
    else if (seg === 'info') store.infoBlobs.set(`${branch}::${filepath}`, content)
    else if (seg === 'info-workspace') store.infoBlobs.set(filepath, content)
    else if (seg === 'info-git') store.infoBlobs.set(`${branch}::${filepath}`, content)
    else throw new Error('unknown segment')
  }

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
  async readBlob(filepath: string, segment?: any): Promise<string | null> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const segmentToStore = {
      workspace: store.workspaceBlobs,
      base: store.baseBlobs,
      conflict: store.conflictBlobs,
      info: store.infoBlobs,
    } as Record<string, Map<string, string>>

    // segment指定がある場合はそのまま返却
    if (segment !== undefined) {
      const seg = String(segment)
      const branch = this.currentBranch || 'main'
      // Explicit workspace-only info
      if (seg === 'info-workspace') {
        return store.infoBlobs.has(filepath) ? store.infoBlobs.get(filepath)! : null
      }
      // Explicit git-scoped info
      if (seg === 'info-git') {
        const key = `${branch}::${filepath}`
        return store.infoBlobs.has(key) ? store.infoBlobs.get(key)! : null
      }
      // Map to underlying storage maps for other segments
      const m = segmentToStore[seg]
      if (!m) return null
      if (seg === 'workspace') return m.has(filepath) ? m.get(filepath)! : null
      // For info segment, prefer workspace-local info (unprefixed), then branch-prefixed
      if (seg === 'info') {
        if (m.has(filepath)) return m.get(filepath)!
        const key = `${branch}::${filepath}`
        return m.has(key) ? m.get(key)! : null
      }
      const key = `${branch}::${filepath}`
      return m.has(key) ? m.get(key)! : null
    }

    // segment未指定の場合はworkspace→baseの順で参照
    const workspace = segmentToStore.workspace
    if (workspace && workspace.has(filepath)) {
      return workspace.get(filepath)!
    }
    const base = segmentToStore.base
    const branch = this.currentBranch || 'main'
    if (base && base.has(`${branch}::${filepath}`)) {
      return base.get(`${branch}::${filepath}`)!
    }
    return null
  }

  /**
   * 指定パスのエントリを削除します。
   * @param filepath ファイルパス
   */
  async deleteBlob(filepath: string, segment?: any): Promise<void> {
    // If segment specified, delete only that segment
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const branch = this.currentBranch || 'main'
    if (segment === 'workspace') { store.workspaceBlobs.delete(filepath); store.infoBlobs.delete(filepath); return }
    if (segment === 'base') { store.baseBlobs.delete(`${branch}::${filepath}`); return }
    if (segment === 'conflict') { store.conflictBlobs.delete(`${branch}::${filepath}`); return }
    if (segment === 'info') { store.infoBlobs.delete(filepath); store.infoBlobs.delete(`${branch}::${filepath}`); return }
    if (segment === 'info-workspace') { store.infoBlobs.delete(filepath); return }
    if (segment === 'info-git') { store.infoBlobs.delete(`${branch}::${filepath}`); return }
    // otherwise delete from all segments
    store.workspaceBlobs.delete(filepath)
    store.baseBlobs.delete(`${branch}::${filepath}`)
    store.conflictBlobs.delete(`${branch}::${filepath}`)
    store.infoBlobs.delete(`${branch}::${filepath}`)
    store.infoBlobs.delete(filepath)
  }

  /**
   * 指定プレフィックス配下のファイル一覧を取得します。
   * @param prefix プレフィックス（例: 'dir/sub'）
   * @param segment セグメント（'workspace' 等）。省略時は 'workspace'
   * @param recursive サブディレクトリも含めるか。省略時は true
  * @returns {Promise<Array<{ path: string; info: string | null }>>}
   */
  async listFiles(prefix?: string, segment?: any, recursive = true): Promise<Array<{ path: string; info: string | null }>> {
    const seg = segment || 'workspace'
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const segmentToStore = {
      workspace: store.workspaceBlobs,
      base: store.baseBlobs,
      conflict: store.conflictBlobs,
      info: store.infoBlobs,
    } as Record<string, Map<string, string>>

    const m = segmentToStore[String(seg)]
    if (!m) return []

    const p = prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
    let keys = Array.from(m.keys())
    // For info store include both unprefixed (workspace-local) keys and branch-prefixed keys
    if (seg === 'info') {
      const branch = this.currentBranch || 'main'
      const unpref = keys.filter((k) => !k.startsWith(branch + '::'))
      const pref = keys.filter((k) => k.startsWith(branch + '::')).map((k) => k.slice((branch + '::').length))
      // merge with workspace-local keys first (they take precedence)
      const merged = Array.from(new Set(unpref.concat(pref)))
      keys = merged
    } else if (seg !== 'workspace') {
      const branch = this.currentBranch || 'main'
      keys = keys.filter((k) => k.startsWith(branch + '::')).map((k) => k.slice((branch + '::').length))
    }
    keys = this._filterKeys(keys, p, recursive)

    const out: Array<{ path: string; info: string | null }> = []
    for (const k of keys) {
      const branch = this.currentBranch || 'main'
      // prefer workspace-local info (unprefixed) then branch-prefixed info
      let info: string | null = null
      if (store.infoBlobs.has(k)) info = store.infoBlobs.get(k)!
      else if (store.infoBlobs.has(`${branch}::${k}`)) info = store.infoBlobs.get(`${branch}::${k}`)!
      out.push({ path: k, info })
    }
    return out
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

  private _wrapStoreForInfoPrefix(store: any): any {
    const branch = this.currentBranch || 'main'
    const prefixKey = (k: string) => `${branch}::${k}`
    return Object.assign({}, store, {
      infoBlobs: {
        has: (k: string) => store.infoBlobs.has(prefixKey(k)),
        get: (k: string) => store.infoBlobs.get(prefixKey(k)),
        set: (k: string, v: string) => store.infoBlobs.set(prefixKey(k), v),
        delete: (k: string) => store.infoBlobs.delete(prefixKey(k))
      }
    })
  }

  private _wrapStoreForInfoNoPrefix(store: any): any {
    return Object.assign({}, store, {
      infoBlobs: {
        has: (k: string) => store.infoBlobs.has(k),
        get: (k: string) => store.infoBlobs.get(k),
        set: (k: string, v: string) => store.infoBlobs.set(k, v),
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
