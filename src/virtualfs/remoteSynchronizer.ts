import { shaOf, shaOfGitBlob } from './hashUtils.ts'
import { StorageBackend } from './storageBackend.ts'
import { IndexManager } from './indexManager.ts'
import { ConflictManager } from './conflictManager.ts'
import { LocalChangeApplier } from './localChangeApplier.ts'

type RemoteSnapshotDescriptor = {
  headSha: string
  shas: Record<string, string>
  fetchContent: (_paths: string[]) => Promise<Record<string, string>>
}

/**
 * リモート同期を行うクラス
 */
export class RemoteSynchronizer {
  /**
   * コンストラクタ
   * @param {StorageBackend} backend - ストレージバックエンド
   * @param {IndexManager} indexManager - インデックス管理
   * @param {ConflictManager} conflictManager - コンフリクト管理
   * @param {LocalChangeApplier} applier - ローカル適用器
   */
  constructor(
    private _backend: StorageBackend,
    private _indexManager: IndexManager,
    private _conflictManager: ConflictManager,
    private _applier: LocalChangeApplier
  ) {}

  /**
   * リモートのスナップショットをpullしてローカルを同期する
   * @param {RemoteSnapshotDescriptor|string} remote - リモートスナップショットまたはheadSha
   * @param {Record<string,string>=} baseSnapshot - オプションのベーススナップショット
   * @returns {Promise<object>} conflicts, fetchedPaths, reconciledPaths を含む結果オブジェクト
   */
  async pull(remote: RemoteSnapshotDescriptor | string, baseSnapshot?: Record<string, string>, adapterInstance?: any): Promise<object> {
    const normalized = await this._normalizeRemoteInput(remote, baseSnapshot)

    const conflicts: Array<any> = []
    const pathsToFetch: string[] = []
    const reconciledPaths: string[] = []

    for (const [p, sha] of Object.entries(normalized.shas)) {
      const classified = await this._classifyRemotePathForPull(p, sha, normalized, pathsToFetch, reconciledPaths)
      if (!classified) pathsToFetch.push(p)
    }

    // Metadata-first: do not fetch contents during pull.
    const fetched: Record<string, string> = {}
    await this._processRemoteAddsAndUpdates(normalized.shas, fetched, normalized.headSha, conflicts, adapterInstance, normalized)
    await this._processRemoteDeletions(normalized.shas, conflicts)

    if (conflicts.length === 0) {
      this._indexManager.setHead(normalized.headSha)
        await this._indexManager.saveIndex()
      return { conflicts, fetchedPaths: Object.keys(fetched), reconciledPaths }
    }

    await this._conflictManager.promoteResolvedConflicts(conflicts, fetched, normalized.headSha)

    if (reconciledPaths.length > 0) await this._indexManager.saveIndex()

    return { conflicts, fetchedPaths: Object.keys(fetched), reconciledPaths }
  }

  /**
   * ローカルの変更をpushする（インデックス更新を行う）
   * @param {any} input - push 入力（parentSha, changes 等）
   * @param {any=} adapter - オプションのアダプタ
   * @returns {Promise<object>} commitSha を含むオブジェクト
   */
  async push(input: any, _adapter?: any): Promise<object> {
    if (input.parentSha === undefined || input.parentSha === null) {
      throw new Error('No parentSha set. pull required')
    }
    const currentIndex = await this._indexManager.getIndex()
    if (input.parentSha !== currentIndex.head) {
      throw new Error('非互換な更新 (non-fast-forward): pull が必要です')
    }
    if (!input.commitKey) {
      input.commitKey = await shaOf(input.parentSha + JSON.stringify(input.changes))
    }
    if (!input.changes || input.changes.length === 0) throw new Error('No changes to commit')

    const commitSha = await shaOf(input.parentSha + '|' + input.commitKey)
    for (const ch of input.changes as any[]) {
      await this._applyChangeLocally(ch)
    }
    this._indexManager.setHead(commitSha)
    this._indexManager.setLastCommitKey(input.commitKey)
    await this._indexManager.saveIndex()

    return { commitSha }
  }

  /**
   * ベーススナップショットを適用してローカルを置き換える
   * @param {Record<string,string>} snapshot - パス->内容のマップ
   * @param {string} headSha - 適用後のhead
   * @returns {Promise<void>}
   */
  async applyBaseSnapshot(snapshot: Record<string, string>, headSha: string): Promise<void> {
    const newShas: Record<string, string> = {}
    for (const [p, c] of Object.entries(snapshot)) newShas[p] = await shaOf(c)

    const toAddOrUpdate = await this._computeToAddOrUpdate(snapshot, newShas)
    const toRemove = await this._computeToRemove(snapshot)

    await this._applyRemovals(toRemove)
    await this._applyAddsOrUpdates(toAddOrUpdate, snapshot, newShas)

    this._indexManager.setHead(headSha)
    await this._indexManager.saveIndex()
  }

  /**
   * remote 引数を標準の RemoteSnapshotDescriptor に変換する
   * @returns {Promise<RemoteSnapshotDescriptor>}
   */
  private async _normalizeRemoteInput(remote: RemoteSnapshotDescriptor | string, baseSnapshot?: Record<string, string>): Promise<RemoteSnapshotDescriptor> {
    if (typeof remote !== 'string') return remote
    const snapshot = baseSnapshot || {}
    const shas: Record<string, string> = {}
    for (const [p, c] of Object.entries(snapshot)) shas[p] = await shaOf(c)
    /**
     * 指定パスの内容を snapshot から取得する（内部ユーティリティ）
     * @param {string[]} paths - 取得するパス一覧
     * @returns {Promise<Record<string,string>>} path->content マップ
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
   * 追加/更新対象のパス一覧を計算する
   * @returns {Promise<string[]>}
   */
  private async _computeToAddOrUpdate(snapshot: Record<string, string>, newShas: Record<string, string>): Promise<string[]> {
    const out: string[] = []
    for (const [p] of Object.entries(snapshot)) {
      const sha = newShas[p]
      let entry: any = undefined
      const infoTxt = await this._backend.readBlob(p, 'info')
      if (infoTxt) entry = JSON.parse(infoTxt)
      if (!entry || entry.baseSha !== sha) out.push(p)
    }
    return out
  }

  /**
   * 削除対象のパス一覧を計算する
   * @returns {Promise<string[]>}
   */
  private async _computeToRemove(snapshot: Record<string, string>): Promise<string[]> {
    const out: string[] = []
    const infos = await this._backend.listFiles(undefined, 'info')
    for (const it of infos) {
      const p = it.path
      if (!(p in snapshot)) out.push(p)
    }
    return out
  }

  /**
   * 指定パスの削除を適用する
   * @param {string[]} toRemove - 削除対象パス配列
   * @returns {Promise<void>}
   */
  private async _applyRemovals(toRemove: string[]): Promise<void> {
    for (const p of toRemove) {
      await this._backend.deleteBlob(p)
      let ie: any = undefined
      const infoTxt = await this._backend.readBlob(p, 'info')
      if (infoTxt) ie = JSON.parse(infoTxt)
      if (ie && ie.state === 'base') {
        await this._backend.deleteBlob(p, 'info')
      }
    }
  }

  /**
   * 追加/更新を適用する
   * @returns {Promise<void>}
   */
  private async _applyAddsOrUpdates(toAddOrUpdate: string[], snapshot: Record<string, string>, newShas: Record<string, string>): Promise<void> {
    for (const p of toAddOrUpdate) {
      const content = snapshot[p]
      const sha = newShas[p]
      await this._backend.writeBlob(p, content, 'base')
      let existing: any = undefined
      const infoTxt = await this._backend.readBlob(p, 'info')
      if (infoTxt) existing = JSON.parse(infoTxt)
      if (!existing) {
        const entry = { path: p, state: 'base', baseSha: sha, updatedAt: Date.now() }
        await this._backend.writeBlob(p, JSON.stringify(entry), 'info')
      } else if (existing.state === 'base') {
        existing.baseSha = sha
        existing.updatedAt = Date.now()
        await this._backend.writeBlob(p, JSON.stringify(existing), 'info')
      }
    }
  }

  /**
   * リモートの追加/更新を処理する
   * @returns {Promise<void>}
   */
  private async _processRemoteAddsAndUpdates(remoteShas: Record<string, string>, baseSnapshot: Record<string, string>, remoteHead: string, conflicts: Array<any>, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    for (const [p, remoteSha] of Object.entries(remoteShas)) {
      await this._handleRemotePath(p, remoteSha, baseSnapshot, conflicts, remoteHead, adapterInstance, normalized)
    }
  }

  /**
   * リモートの削除を処理する
   * @returns {Promise<void>}
   */
  private async _processRemoteDeletions(remoteShas: Record<string, string>, conflicts: Array<any>): Promise<void> {
    const infos = await this._backend.listFiles(undefined, 'info')
    for (const it of infos) {
      const p = it.path
      if (!(p in remoteShas)) {
        let indexEntry: any = undefined
        if (it.info) {
          indexEntry = JSON.parse(it.info)
        }
        await this._handleRemoteDeletion(p, indexEntry, remoteShas, conflicts)
      }
    }
  }

  /**
   * プル時に個別パスが既に整合済みか判定する
   * @returns {Promise<boolean>} 整合済みならtrue
   */
  private async _classifyRemotePathForPull(p: string, sha: string, normalized: RemoteSnapshotDescriptor, pathsToFetch: string[], reconciledPaths: string[]): Promise<boolean> {
    let entry: any = undefined
    const infoTxt = await this._backend.readBlob(p, 'info')
    if (infoTxt) entry = JSON.parse(infoTxt)
    if (!entry) return false
    if (entry.baseSha === sha) return true

    const baseContent = await this._backend.readBlob(p, 'base')
    if (baseContent !== null) {
      const gitSha = await shaOfGitBlob(baseContent)
      if (gitSha === sha) {
        entry.baseSha = sha
        entry.state = entry.state || 'base'
        entry.updatedAt = Date.now()
        await this._backend.writeBlob(p, JSON.stringify(entry), 'info')
        reconciledPaths.push(p)
        return true
      }
    }
    return false
  }

  /**
   * 個別のリモートパスを処理する（新規/既存の振り分けを行う）
   * @returns {Promise<void>}
   */
  private async _handleRemotePath(p: string, perFileRemoteSha: string, baseSnapshot: Record<string, string>, conflicts: Array<any>, remoteHeadSha: string, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    let indexEntry: any = undefined
    const infoTxt = await this._backend.readBlob(p, 'info')
    if (infoTxt) indexEntry = JSON.parse(infoTxt)
    let localWorkspace: { sha: string; content: string } | undefined = undefined
    const wsBlob = await this._backend.readBlob(p, 'workspace')
    if (wsBlob !== null) {
      const wsSha = indexEntry?.workspaceSha || await shaOf(wsBlob)
      localWorkspace = { sha: wsSha, content: wsBlob }
    }
    let localBase: { sha: string; content: string } | undefined = undefined
    const baseBlob = await this._backend.readBlob(p, 'base')
    if (baseBlob !== null && indexEntry?.baseSha) {
      localBase = { sha: indexEntry.baseSha, content: baseBlob }
    }

    if (!indexEntry) return await this._handleRemoteNew(p, perFileRemoteSha, baseSnapshot, conflicts, localWorkspace, localBase, remoteHeadSha, adapterInstance, normalized)
    return await this._handleRemoteExisting(p, indexEntry, perFileRemoteSha, baseSnapshot, conflicts, localWorkspace, remoteHeadSha, adapterInstance, normalized)
  }

  /**
   * 新規ファイルに対する処理（追加 or conflict）
   * @returns {Promise<void>}
   */
  private async _handleRemoteNew(p: string, perFileRemoteSha: string, baseSnapshot: Record<string, string>, conflicts: Array<any>, localWorkspace: { sha: string; content: string } | undefined, localBase: { sha: string; content: string } | undefined, remoteHeadSha: string, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    const workspaceSha = localWorkspace ? localWorkspace.sha : undefined
    if (localWorkspace) {
      await this._handleRemoteNewConflict(p, baseSnapshot[p], remoteHeadSha, conflicts, workspaceSha, localBase?.sha, normalized)
      return
    }
    await this._handleRemoteNewAdd(p, perFileRemoteSha, baseSnapshot, remoteHeadSha, conflicts, workspaceSha, localBase?.sha, adapterInstance, normalized)
  }

  /**
   * 新規でコンフリクトが発生した場合の処理
   * @returns {Promise<void>}
   */
  private async _handleRemoteNewConflict(p: string, content: string | undefined, remoteHeadSha: string, conflicts: Array<any>, workspaceSha: string | undefined, baseSha: string | undefined, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    await this._conflictManager.persistRemoteContentAsConflict(p, content)
    let ie: any = undefined
    const infoTxt = await this._backend.readBlob(p, 'info')
    if (infoTxt) ie = JSON.parse(infoTxt)
    if (!ie) ie = { path: p }
      await this._conflictManager.setIndexEntryToConflict(p, ie, remoteHeadSha)
      await this._indexManager.saveIndex()
    // v0.0.4: Store remote metadata (info) in conflict segment for on-demand fetching
    const remoteInfo = { path: p, baseSha: remoteHeadSha, state: 'conflict', updatedAt: Date.now() }
    await this._backend.writeBlob(p, JSON.stringify(remoteInfo), 'conflict')
    conflicts.push({ path: p, remoteSha: remoteHeadSha, workspaceSha, baseSha })
  }

  /**
   * 新規追加を処理する
   * @returns {Promise<void>}
   */
  private async _handleRemoteNewAdd(p: string, perFileRemoteSha: string, baseSnapshot: Record<string, string>, remoteHeadSha: string, conflicts: Array<any>, workspaceSha: string | undefined, baseSha: string | undefined, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    // Metadata-first: always record info with baseSha. Defer base blob write until on-demand fetch.
    const entry = { path: p, state: 'base', baseSha: perFileRemoteSha, updatedAt: Date.now() }
    await this._backend.writeBlob(p, JSON.stringify(entry), 'info')
    // Note: base content is NOT eagerly fetched here. On-demand fetch occurs when readBlob('base') is required.
  }

  /**
   * 既存ファイルに対する更新/競合処理
   * @returns {Promise<void>}
   */
  private async _handleRemoteExisting(p: string, indexEntry: any, perFileRemoteSha: string, baseSnapshot: Record<string, string>, conflicts: Array<any>, localWorkspace: { sha: string; content: string } | undefined, remoteHeadSha: string, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    const baseSha = indexEntry.baseSha
    if (baseSha === perFileRemoteSha) return
    if (!localWorkspace || localWorkspace.sha === baseSha) {
      await this._handleRemoteExistingUpdate(p, indexEntry, perFileRemoteSha, baseSnapshot, conflicts, remoteHeadSha, adapterInstance, normalized)
    } else {
      await this._handleRemoteExistingConflict(p, indexEntry, perFileRemoteSha, baseSnapshot, conflicts, localWorkspace, remoteHeadSha, adapterInstance, normalized)
    }
  }

  /**
   * 既存ファイルの更新処理
   * @returns {Promise<void>}
   */
  private async _handleRemoteExistingUpdate(p: string, indexEntry: any, perFileRemoteSha: string, baseSnapshot: Record<string, string>, conflicts: Array<any>, remoteHeadSha: string, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    const baseSha = indexEntry.baseSha
    // Metadata-first: update info to new baseSha; defer base blob write until requested.
    indexEntry.baseSha = perFileRemoteSha
    indexEntry.state = 'base'
    indexEntry.updatedAt = Date.now()
    await this._backend.writeBlob(p, JSON.stringify(indexEntry), 'info')
    // Note: base content is NOT eagerly fetched here. On-demand fetch occurs when readBlob('base') is required.
  }

  /**
   * 既存ファイルで競合が発生した場合の処理
   * @returns {Promise<void>}
   */
  private async _handleRemoteExistingConflict(p: string, indexEntry: any, perFileRemoteSha: string, baseSnapshot: Record<string, string>, conflicts: Array<any>, localWorkspace: { sha: string; content: string }, remoteHeadSha: string, adapterInstance?: any, normalized?: RemoteSnapshotDescriptor): Promise<void> {
    const baseSha = indexEntry.baseSha
    await this._conflictManager.persistRemoteContentAsConflict(p, baseSnapshot[p])
    this._conflictManager.setIndexEntryToConflict(p, indexEntry, remoteHeadSha)
    await this._indexManager.saveIndex()
    // v0.0.4: Store remote metadata (info) in conflict segment for on-demand fetching
    const remoteInfo = { path: p, baseSha: perFileRemoteSha, state: 'conflict', updatedAt: Date.now() }
    await this._backend.writeBlob(p, JSON.stringify(remoteInfo), 'conflict')
    conflicts.push({ path: p, baseSha, remoteSha: remoteHeadSha, workspaceSha: localWorkspace?.sha })
  }

  /**
   * リモートで削除されたパスの処理
   * @returns {Promise<void>}
   */
  private async _handleRemoteDeletion(p: string, indexEntry: any, _remoteShas: Record<string, string>, conflicts: Array<any>): Promise<void> {
    let localWorkspace: { sha: string; content: string } | undefined = undefined
    const wsBlob = await this._backend.readBlob(p, 'workspace')
    if (wsBlob !== null) {
      const wsSha = indexEntry?.workspaceSha || await shaOf(wsBlob)
      localWorkspace = { sha: wsSha, content: wsBlob }
    }
    if (!indexEntry || !indexEntry.baseSha) {
      return
    }

    if (!localWorkspace || localWorkspace.sha === indexEntry.baseSha) {
      await this._backend.deleteBlob(p, 'info')
      await this._backend.deleteBlob(p)
    } else {
      conflicts.push({ path: p, baseSha: indexEntry.baseSha, workspaceSha: localWorkspace?.sha })
    }
  }

  /**
   * 変更をローカルに適用する（create/update/delete）
   * @returns {Promise<void>}
   */
  private async _applyChangeLocally(ch: any): Promise<void> {
    if (ch.type === 'create' || ch.type === 'update') {
      const sha = await shaOf(ch.content)
      let entry: any = undefined
      const infoTxt = await this._backend.readBlob(ch.path, 'info')
      if (infoTxt) entry = JSON.parse(infoTxt)
      if (!entry) entry = { path: ch.path }
      entry.baseSha = sha
      entry.state = 'base'
      entry.updatedAt = Date.now()
      entry.workspaceSha = undefined
      await this._backend.writeBlob(ch.path, JSON.stringify(entry), 'info')
      await this._applier.applyCreateOrUpdate(ch)
    } else if (ch.type === 'delete') {
      await this._applier.applyDelete(ch)
    }
  }

  /**
   * On-demand: fetch and store base content for a single path when missing.
   * @param {string} path
   * @param {any=} adapterInstance optional adapter instance to fetch remote content
   * @returns {Promise<string|null>} fetched content or null
   */
  async fetchBaseIfMissing(path: string, adapterInstance?: any): Promise<string | null> {
    // return existing base if present
    const existing = await this._backend.readBlob(path, 'base')
    if (existing !== null) return existing

    // read info to find baseSha
    let infoTxt: string | null = null
    try {
      infoTxt = await this._backend.readBlob(path, 'info')
    } catch (e) {
      infoTxt = null
    }
    if (!infoTxt) return null
    let ie: any = null
    try { ie = JSON.parse(infoTxt) } catch (e) { ie = null }
    if (!ie || !ie.baseSha) return null

    const baseSha = ie.baseSha

    // Try GitHub-style adapter first
    if (adapterInstance && typeof adapterInstance.getBlob === 'function') {
      try {
        const b = await adapterInstance.getBlob(baseSha)
        if (b && typeof b.content !== 'undefined') {
          // decode base64 if needed; strip newlines which GitHub may include
          const enc = b.encoding || 'utf-8'
          let content: string
          if (enc === 'base64') {
            const safe = (b.content || '').replace(/\n/g, '')
            // universal base64 -> UTF-8 decoding: prefer Buffer (Node), fallback to atob+TextDecoder (browser)
            if (typeof Buffer !== 'undefined' && typeof (Buffer as any).from === 'function') {
              content = Buffer.from(safe, 'base64').toString('utf8')
            } else if (typeof atob === 'function') {
              const bin = atob(safe)
              const len = bin.length
              const bytes = new Uint8Array(len)
              for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
              content = (typeof TextDecoder !== 'undefined') ? new TextDecoder().decode(bytes) : String.fromCharCode.apply(null, Array.from(bytes))
            } else {
              // last resort: attempt to return raw content
              content = b.content
            }
          } else {
            content = b.content
          }
          await this._backend.writeBlob(path, content, 'base')
          return content
        }
      } catch (error) {
        return null
      }
    }

    // Fallback: adapter may expose a raw file fetch API (GitLab-style)
    if (adapterInstance && typeof adapterInstance._fetchFileRaw === 'function') {
      try {
        const raw = await adapterInstance._fetchFileRaw(path, ie.branch || 'main')
        if (typeof raw === 'string') {
          await this._backend.writeBlob(path, raw, 'base')
          return raw
        }
      } catch (error) {
        return null
      }
    }

    return null
  }
}

export default RemoteSynchronizer
