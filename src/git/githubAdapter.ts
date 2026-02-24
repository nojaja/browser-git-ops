import { GitAdapter } from './adapter.ts'
import AbstractGitAdapter, { fetchWithRetry, classifyStatus, getDelayForResponse, processResponseWithDelay, mapWithConcurrency, shaOf, NonRetryableError } from './abstractAdapter.ts'

export type GHOptions = {
  owner: string
  repo: string
  token: string
  host?: string // optional GitHub Enterprise host
}


/**
 * GitHub 向けの `GitAdapter` 実装。
 * GitHub API をラップしてリポジトリ操作（コミット作成、ブランチ一覧、ファイル取得等）を提供します。
 */
export class GitHubAdapter extends AbstractGitAdapter implements GitAdapter {
  private _fetchWithRetry: (_: RequestInfo, __: RequestInit, ___?: number, ____?: number) => Promise<Response>
  private repoMetadata: import('../virtualfs/types.ts').RepositoryMetadata | null = null
  // simple in-memory blob cache: contentSha -> blobSha
  private blobCache: Map<string, string> = new Map()

  /**
   * GitHubAdapter を初期化します。
   * @param {GHOptions} options 設定オブジェクト
   */
  constructor(options: GHOptions) {
    super(options)
    const host = options.host || 'https://api.github.com'
    this.baseUrl = `${host}/repos/${options.owner}/${options.repo}`
    // Only include Authorization header when a token is provided
    this.headers = {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    }
    const rawToken = options && typeof options.token === 'string' ? options.token.trim() : ''
    if (rawToken) {
      (this.headers as any).Authorization = `token ${rawToken}`
    }
    this._fetchWithRetry = fetchWithRetry
  }

  /**
   * List commits for a ref (GitHub commits API)
   * @param {Object} query query parameters
   * @param {string} query.ref reference name (branch/tag/SHA)
   * @param {number} [query.perPage] items per page
   * @param {number} [query.page] page number
   * @returns {Promise<import('./adapter').CommitHistoryPage>} ページ情報を返します
   */
  async listCommits(query: { ref: string; perPage?: number; page?: number }) {
    const reference = query.ref || 'main'
    const perPage = query.perPage || 30
    const page = query.page || 1
    const url = `${this.baseUrl}/commits?sha=${encodeURIComponent(reference)}&per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`
    const resp = await this._fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const text = await resp.text().catch(() => '[]')
    const parsed = this._parseJsonArray(text)

    const items = (Array.isArray(parsed) ? parsed : []).map((c: any) => this._mapGithubCommitToSummary(c))

    const linkHdr = resp && (resp as any).headers && typeof (resp as any).headers.get === 'function' ? (resp as any).headers.get('link') : undefined
    const pages = this._parseLinkHeaderString(typeof linkHdr === 'string' ? linkHdr : undefined)
    return { items, nextPage: pages.nextPage, lastPage: pages.lastPage }
  }

  /**
   * 応答テキストを JSON 配列として解析します（失敗時は空配列を返す）。
   * @param {string} text 応答テキスト
   * @returns {any[]}
   */
  private _parseJsonArray(text: string): any[] {
    try {
      return text ? JSON.parse(text) : []
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('parseJsonArray failed', error)
      return []
    }
  }

  /**
   * GitHub の Link ヘッダを解析して next/last ページを返します。
   * @param {string|undefined} linkHdr Link ヘッダ文字列
    * @returns {{nextPage?: number, lastPage?: number}} ページ番号情報
   */
  private _parseLinkHeaderString(linkHdr?: string): { nextPage?: number; lastPage?: number } {
    const out: { nextPage?: number; lastPage?: number } = {}
    if (!linkHdr) return out
    try {
      const mNext = linkHdr.match(/<[^>]*[?&]page=(\d+)[^>]*>\s*;\s*rel=\"?next\"?/) as RegExpMatchArray | null
      const mLast = linkHdr.match(/<[^>]*[?&]page=(\d+)[^>]*>\s*;\s*rel=\"?last\"?/) as RegExpMatchArray | null
      if (mNext) out.nextPage = Number(mNext[1])
      if (mLast) out.lastPage = Number(mLast[1])
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('parseLinkHeaderString failed', error)
    }
    return out
  }

  /**
   * Map a raw GitHub commit object to CommitSummary shape used by the adapter.
   * @param {any} c Raw commit object
   * @returns {import('./adapter').CommitSummary}
   */
  private _mapGithubCommitToSummary(c: any) {
    const parents = Array.isArray(c?.parents) ? c.parents.map((p: any) => p?.sha ?? '').filter((s: string) => !!s) : []
    return {
      sha: c?.sha ?? '',
      message: c?.commit?.message ?? '',
      author: c?.commit?.author?.name ?? c?.author?.login ?? '',
      date: c?.commit?.author?.date ?? '',
      parents,
    }
  }

  /**
   * ブロブを作成またはキャッシュから取得します。
   * @param {any[]} changes 変更一覧（create/update を含む）
   * @param {number} [concurrency=5] 同時実行数
   * @returns {Promise<Record<string,string>>} パス→blobSha のマップ
   */
  async createBlobs(changes: any[], concurrency = 5) {
    const tasks = changes.filter((c) => c.type === 'create' || c.type === 'update')
    const results = await mapWithConcurrency(tasks, this._createBlobForChange.bind(this), concurrency)
    const map: Record<string, string> = {}
    for (const r of results) map[r.path] = r.sha
    return map
  }

  /**
   * Create a blob for a change or return cached blobSha.
   * @param {any} ch change entry
   * @returns {Promise<{path:string,sha:string}>}
   */
  private async _createBlobForChange(ch: any) {
    /**
     * Create or return cached blob SHA for a change entry.
     * @param {any} ch change entry
     * @returns {Promise<{path:string,sha:string}>}
     */
    const contentHash = await this.shaOf(ch.content || '')
    const cached = this.blobCache.get(contentHash)
    if (cached) return { path: ch.path, sha: cached }
    const body = JSON.stringify({ content: ch.content, encoding: 'utf-8' })
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/blobs`, { method: 'POST', headers: this.headers, body }, 4, 300)
    const index = await response.json()
    if (!index.sha) throw new NonRetryableError('blob response missing sha')
    this.blobCache.set(contentHash, index.sha)
    return { path: ch.path, sha: index.sha }
  }

  /**
   * 互換用のツリー作成。
   * @param {any[]} changes 変更一覧
   * @param {string} [baseTreeSha] ベースツリー
   * @returns {Promise<string>} 作成されたツリーの sha
   */
  async createTree(changes: any[], baseTreeSha?: string) {
    const tree = [] as any[]
    for (const c of changes) {
      if (c.type === 'delete') {
        tree.push({ path: c.path, mode: '100644', sha: null })
      } else {
        if (!c.blobSha) throw new NonRetryableError(`missing blobSha for ${c.path}`)
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: c.blobSha })
      }
    }
    const body: any = { tree }
    if (baseTreeSha) body.base_tree = baseTreeSha
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/trees`, { method: 'POST', headers: this.headers, body: JSON.stringify(body) }, 4, 300)
    const index = await response.json()
    if (!index.sha) throw new NonRetryableError('createTree response missing sha')
    return index.sha as string
  }

  /**
   * コミットを作成します。
   * @param {string} message コミットメッセージ
   * @param {string} parentSha 親コミット SHA
   * @param {string} treeSha ツリー SHA
   * @returns {Promise<string>} 新規コミット SHA
   */
  async createCommit(message: string, parentSha: string, treeSha: string) {
    const parents = /^[0-9a-f]{40}$/.test(String(parentSha)) ? [parentSha] : []
    const body = JSON.stringify({ message, tree: treeSha, parents })
    // debug: log body for troubleshooting invalid parents
    /* istanbul ignore next */
    if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('GitHub.createCommit body:', body)
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/commits`, { method: 'POST', headers: this.headers, body }, 4, 300)
    const index = await response.json()
    if (!index.sha) throw new NonRetryableError('createCommit response missing sha')
    return index.sha as string
  }

  /**
   * Retrieve repository metadata (default branch, name, id) and cache it.
   * @returns {Promise<import('../virtualfs/types.ts').RepositoryMetadata>} repository metadata
   */
  async getRepositoryMetadata(): Promise<import('../virtualfs/types.ts').RepositoryMetadata> {
    if (this.repoMetadata) return this.repoMetadata
    try {
      const resp = await this._fetchWithRetry(`${this.baseUrl}`, { method: 'GET', headers: this.headers }, 4, 300)
      const data = await resp.json().catch(() => ({}))
      this.repoMetadata = this._makeRepoMetadata(data)
      return this.repoMetadata
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).error) (console as any).error('リポジトリメタデータの取得に失敗しました。デフォルトブランチを\'main\'として扱います', error)
      this.repoMetadata = { defaultBranch: 'main', name: '', id: undefined }
      return this.repoMetadata
    }
  }

  /**
   * Build repository metadata object from API response body.
   * @param data API response body
   * @returns {import('../virtualfs/types.ts').RepositoryMetadata}
   */
  private _makeRepoMetadata(data: any): import('../virtualfs/types.ts').RepositoryMetadata {
    return {
      defaultBranch: data && data.default_branch ? data.default_branch : 'main',
      name: data && data.name ? data.name : '',
      id: data && data.id ? data.id : undefined,
    }
  }

  /**
   * List branches via GitHub API and map to BranchListPage.
   * @param {import('../virtualfs/types.ts').BranchListQuery} [query] query parameters
   * @returns {Promise<{items:any[],nextPage?:number,lastPage?:number}>}
   */
  async listBranches(query?: import('../virtualfs/types.ts').BranchListQuery) {
    const perPage = (query && query.perPage) || 30
    const page = (query && query.page) || 1
    const url = `${this.baseUrl}/branches?per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`
    const resp = await this._fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const text = await resp.text().catch(() => '[]')
    const parsed = this._parseJsonArray(text)
    const repoMeta = await this.getRepositoryMetadata().catch(() => ({ defaultBranch: 'main' }))

    const items = this._mapBranchItems(Array.isArray(parsed) ? parsed : [], repoMeta)

    const linkHdr = resp && (resp as any).headers && typeof (resp as any).headers.get === 'function' ? (resp as any).headers.get('link') : undefined
    const pages = this._parseLinkHeaderString(typeof linkHdr === 'string' ? linkHdr : undefined)
    return { items, nextPage: pages.nextPage, lastPage: pages.lastPage }
  }

  /**
   * Map raw branch objects returned by API to adapter Branch item shape.
   * @param {any[]} parsed raw branch array
   * @param {any} repoMeta repository metadata
   * @returns {any[]}
   */
  private _mapBranchItems(parsed: any[], repoMeta: any) {
    return parsed.map((b: any) => ({
      name: b.name,
      commit: { sha: b.commit && b.commit.sha ? b.commit.sha : '', url: b.commit && b.commit.url ? b.commit.url : '' },
      protected: !!b.protected,
      isDefault: b.name === (repoMeta && repoMeta.defaultBranch ? repoMeta.defaultBranch : 'main'),
    }))
  }

  /**
   * 参照を更新します。
   * @param {string} reference 参照名（例: heads/main）
   * @param {string} commitSha コミット SHA
   * @param {boolean} force 強制更新フラグ
   */
  async updateRef(reference: string, commitSha: string, force = false) {
    const body = JSON.stringify({ sha: commitSha, force })
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/refs/${reference}`, { method: 'PATCH', headers: this.headers, body }, 4, 300)
    if (!response.ok) {
      const txt = await response.text().catch(() => '')
      throw new NonRetryableError(`updateRef failed: ${response.status} ${txt}`)
    }
  }

  /**
   * Create a branch (ref) on the remote repository.
   * @param {string} branchName branch name to create
   * @param {string} fromSha commit sha to point the new branch at
   * @returns {Promise<import('../virtualfs/types.ts').CreateBranchResult>} created branch info
   */
  async createBranch(branchName: string, fromSha: string): Promise<import('../virtualfs/types.ts').CreateBranchResult> {
    const referenceName = `refs/heads/${branchName}`
    const body = JSON.stringify({ ref: referenceName, sha: fromSha })
    try {
      const resp = await this._fetchWithRetry(`${this.baseUrl}/git/refs`, { method: 'POST', headers: this.headers, body }, 4, 300)
      const txt = await resp.text().catch(() => '')
      const data = txt ? JSON.parse(txt) : {}
      return { name: branchName, sha: fromSha, ref: (data && data.ref) ? data.ref : referenceName }
    } catch (error: any) {
      const message = String(error && error.message ? error.message : error)
      this._handleCreateBranchError(message, branchName)
    }
  }

  /**
   * Normalize common createBranch error messages into thrown NonRetryableError/Error.
   * @param {string} message error message text
   * @param {string} branchName branch attempted
   * @returns {never}
   */
  private _handleCreateBranchError(message: string, branchName: string): never {
    if (message.includes('422') || /Reference already exists/i.test(message)) {
      throw new NonRetryableError(`Branch '${branchName}' already exists.`)
    }
    if (/401|403|Bad credentials/i.test(message)) {
      throw new NonRetryableError(`Authentication failed: ${message}`)
    }
    throw new Error(message)
  }

  /**
   * 指定コミットの tree SHA を取得します。
   * @param commitSha コミット SHA
    * @returns {Promise<string>} tree の SHA
   */
  async getCommitTreeSha(commitSha: string) {
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/commits/${commitSha}`, { method: 'GET', headers: this.headers }, 4, 300)
    const index = await response.json()
    if (!index || !index.tree || !index.tree.sha) throw new NonRetryableError('getCommitTreeSha: tree sha not found')
    return index.tree.sha as string
  }

  /**
   * 指定 ref の先頭コミット SHA を取得します。
   * @param {string} reference 䉶: `heads/main`
   * @returns {Promise<string>} 参照先のコミット SHA
   */
  async getRef(reference: string) {
    // Try plural then singular path using a small helper to reduce cognitive complexity.
    const tryUrls = [
      `${this.baseUrl}/git/refs/${reference}`,
      `${this.baseUrl}/git/ref/${reference}`,
    ]

    for (const url of tryUrls) {
      try {
        const sha = await this._getRefShaFromUrl(url)
        if (sha) return sha
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('getRef attempt failed', error)
      }
    }

    throw new NonRetryableError('getRef: sha not found')
  }

  /**
   * Fetch a ref URL and extract a SHA if present.
   * @param {string} url API URL to fetch
   * @returns {Promise<string|null>} sha string when found, otherwise null
   */
  private async _getRefShaFromUrl(url: string): Promise<string | null> {
    const resp = await this._fetchWithRetry(url, { method: 'GET', headers: this.headers }, 4, 300)
    const index = await resp.json().catch(() => null)
    if (!index) return null
    if (typeof index.sha === 'string' && index.sha.length > 0) return index.sha as string
    if (index.object && typeof index.object.sha === 'string' && index.object.sha.length > 0) return index.object.sha as string
    return null
  }

  /**
   * Determine the head SHA for a branch; fallback to branch name if unavailable.
   * @param {string} branch branch name
   * @returns {Promise<string>} head SHA or branch
   */
  private async _determineHeadSha(branch: string): Promise<string> {
    // Attempt resolution via multiple strategies with small helpers to keep complexity low.
    // 1) refs API
    const referenceSha = await this.getRef(`heads/${branch}`).catch(() => null)
    if (referenceSha && typeof referenceSha === 'string' && referenceSha.length > 0) return referenceSha

    // 2) branches API
    const branchSha = await this._getBranchCommitSha(branch).catch((error) => {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('determineHeadSha branches API failed', error)
      return null
    })
    if (branchSha) return branchSha

    // 3) commits endpoint
    const commitSha = await this._getCommitEndpointSha(branch).catch((error) => {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('determineHeadSha commits endpoint failed', error)
      return null
    })
    if (commitSha) return commitSha

    // Fallback to returning branch name
    return branch
  }

  /**
   * Get commit SHA from the branches API for a branch name.
   * @param {string} branch branch name
   * @returns {Promise<string|null>} commit SHA or null when not found
   */
  private async _getBranchCommitSha(branch: string): Promise<string | null> {
    const resp = await this._fetchWithRetry(`${this.baseUrl}/branches/${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers }, 4, 300)
    if (!resp || !resp.ok) return null
    const bj = await resp.json().catch(() => null)
    const commit = bj && bj.commit ? (bj.commit.sha || bj.commit.id) : null
    return typeof commit === 'string' && commit.length > 0 ? commit : null
  }

  /**
   * Get commit SHA from the commits endpoint for a given reference.
   * @param {string} reference commit-ish reference
   * @returns {Promise<string|null>} commit SHA or null when not found
   */
  private async _getCommitEndpointSha(reference: string): Promise<string | null> {
    const resp = await this._fetchWithRetry(`${this.baseUrl}/commits/${encodeURIComponent(reference)}`, { method: 'GET', headers: this.headers }, 2, 200)
    if (!resp || !resp.ok) return null
    const body = await resp.json().catch(() => null)
    const maybe = body && (body.sha || body.id)
    return typeof maybe === 'string' && maybe.length > 0 ? maybe : null
  }

  /**
   * tree を取得します（必要なら再帰取得）。
   * @param treeSha tree の SHA
   * @param recursive 再帰フラグ
    * @returns {Promise<any[]>} tree の配列
   */
  async getTree(treeSha: string, recursive = false) {
    const url = `${this.baseUrl}/git/trees/${treeSha}` + (recursive ? '?recursive=1' : '')
    const response = await this._fetchWithRetry(url, { method: 'GET', headers: this.headers }, 4, 300)
    const index = await response.json()
    if (!index || !index.tree) throw new NonRetryableError('getTree: tree not found')
    return index.tree as any[]
  }

  /**
   * blob を取得してデコードして返します。
   * @param blobSha blob の SHA
    * @returns {Promise<{content:string,encoding:string}>} デコード済みコンテンツとエンコーディング
   */
  async getBlob(blobSha: string) {
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/blobs/${blobSha}`, { method: 'GET', headers: this.headers }, 4, 300)
    const index = await response.json()
    if (!index || typeof index.content === 'undefined') throw new NonRetryableError('getBlob: content not found')
    const enc = index.encoding || 'utf-8'
    // Return API content as-is (do not decode here). Decoding is responsibility
    // of the caller so that adapter remains a thin mapping over the remote API.
    return { content: index.content, encoding: enc }
  }

  /**
   * Resolve a commit-ish (branch, tag, or SHA) to a commit SHA.
   * Resolution order: branch -> tag -> commit endpoint -> treat as SHA
   * Throws if resolution fails.
   * @param {string} reference commit-ish to resolve
   * @returns {Promise<string>} resolved commit SHA
   */
  async resolveRef(reference: string): Promise<string> {
    if (typeof reference === 'string' && /^[0-9a-f]{40}$/.test(reference)) return reference

    const resolvers: Array<(_reference: string) => Promise<string | null>> = [
      this._tryResolveByBranch.bind(this),
      this._tryResolveByTag.bind(this),
      this._tryResolveByCommitEndpoint.bind(this),
    ]

    const resolved = await this._runResolvers(reference, resolvers)
    if (resolved) return resolved

    throw new Error(`resolveRef: ref '${reference}' not found`)
  }

  /**
   * Run resolver functions in order and return the first non-null result.
   * @param {string} reference commit-ish to resolve
   * @param {Array<(_reference: string) => Promise<string | null>>} resolvers resolver functions
   * @returns {Promise<string|null>} resolved sha or null
   */
  private async _runResolvers(reference: string, resolvers: Array<(_reference: string) => Promise<string | null>>): Promise<string | null> {
    for (const r of resolvers) {
      try {
        const v = await r(reference)
        if (v) return v
      } catch (error) {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('resolveRef resolver failed', error)
      }
    }
    return null
  }

  /**
   * Try to resolve a branch name to a commit SHA.
   * @param {string} reference branch name
   * @returns {Promise<string|null>}
   */
  private async _tryResolveByBranch(reference: string): Promise<string | null> {
    const sha = await this.getRef(`heads/${reference}`)
    return sha || null
  }

  /**
   * Try to resolve a tag name to a commit SHA.
   * @param {string} reference tag name
   * @returns {Promise<string|null>}
   */
  private async _tryResolveByTag(reference: string): Promise<string | null> {
    const sha = await this.getRef(`tags/${reference}`)
    return sha || null
  }

  /**
   * Try to resolve via commits endpoint (may accept SHA or other forms).
   * @param {string} reference commit-ish
   * @returns {Promise<string|null>}
   */
  private async _tryResolveByCommitEndpoint(reference: string): Promise<string | null> {
    const response = await this._fetchWithRetry(`${this.baseUrl}/commits/${encodeURIComponent(reference)}`, { method: 'GET', headers: this.headers }, 2, 200)
    if (response && response.ok) {
      const body = await response.json().catch(() => null)
      const maybe = body && (body.sha || body.id)
      if (typeof maybe === 'string' && maybe.length > 0) return maybe
    }
    return null
  }

  /**
   * Fetch a blob's content; return null content on failure.
   * @param {any} f blob metadata
   * @returns {Promise<{path:string,content:string|null}>}
   */
  private async _fetchBlobContentOrNull(f: any) {
    try {
      const b = await this.getBlob(f.sha)
      // If the adapter returned a base64 payload, decode here for
      // fetchSnapshot/fetchContent callers so they receive decoded text.
      if (b && b.encoding === 'base64' && typeof b.content === 'string') {
        const safe = (b.content || '').replace(/\n/g, '')
        return { path: f.path, content: this._decodeBase64ToString(safe) }
      }
      return { path: f.path, content: b.content }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('fetchSnapshot blob failed', f.path, error)
      return { path: f.path, content: null }
    }
  }

  /**
   * Decode a base64 string into UTF-8 text. Uses global Buffer when available,
   * falls back to atob/TextDecoder for browsers.
   * @param {string} safe base64 string to decode
   * @returns {string} decoded UTF-8 string
   */
  private _decodeBase64ToString(safe: string): string {
    const bufGlobal = (globalThis as any).Buffer
    if (typeof bufGlobal !== 'undefined' && typeof bufGlobal.from === 'function') {
      return bufGlobal.from(safe, 'base64').toString('utf8')
    }
    if (typeof atob === 'function') {
      const bin = atob(safe)
      const length_ = bin.length
      const bytes = new Uint8Array(length_)
      for (let index = 0; index < length_; index++) bytes[index] = bin.charCodeAt(index)
      return (typeof TextDecoder !== 'undefined') ? new TextDecoder().decode(bytes) : String.fromCharCode.apply(null, Array.from(bytes))
    }
    return safe
  }

  /**
   * Fetch repository snapshot: headSha, shas map and a fetchContent helper.
   * @param {string} branch branch name
   * @param {number} concurrency fetch concurrency
   * @returns {Promise<{headSha:string,shas:Record<string,string>,fetchContent:Function,snapshot:Record<string,string>}>}
   */
  async fetchSnapshot(branch = 'main', concurrency = 5): Promise<any> {
    const headSha = await this._determineHeadSha(branch)
    const { shas, fileMap } = await this._buildFileMapFromHead(headSha)

    const contentCache = new Map<string, string>()
    const snapshot: Record<string, string> = {}
    const fetchContent = this._fetchSnapshotForFileMap.bind(this, fileMap, contentCache, snapshot, concurrency)

    return { headSha, shas, fetchContent, snapshot }
  }

  /**
   * Bound helper used to construct the `fetchContent` function returned by `fetchSnapshot`.
   * @param {Map<string, any>} fileMap file metadata map
   * @param {Map<string,string>} contentCache cache map
   * @param {Record<string,string>} snapshot snapshot map to populate
   * @param {number} concurrency concurrency level
   * @param {string[]} paths requested paths
   * @returns {Promise<Record<string,string>>}
   */
  private async _fetchSnapshotForFileMap(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, concurrency: number, paths: string[]): Promise<Record<string, string>> {
    return this._fetchContentFromMap(fileMap, contentCache, snapshot, paths, concurrency)
  }

  /**
   * Build file map and shas from a head SHA by fetching the tree.
   * @param {string} headSha head commit SHA
   * @returns {Promise<{shas:Record<string,string>,fileMap:Map<string,any>}>}
   */
  private async _buildFileMapFromHead(headSha: string): Promise<{ shas: Record<string, string>; fileMap: Map<string, any> }> {
    const treeResponse = await this._fetchWithRetry(`${this.baseUrl}/git/trees/${headSha}${'?recursive=1'}`, { method: 'GET', headers: this.headers }, 4, 300)
    const treeJ = await treeResponse.json()

    if (treeJ && treeJ.truncated === true) {
      this.logWarn('GitHub tree response was truncated. Some files may be missing. Consider using non-recursive tree fetching for large repositories.')
    }

    const files = (treeJ && treeJ.tree) ? treeJ.tree.filter((t: any) => t.type === 'blob') : []
    const shas: Record<string, string> = {}
    const fileMap = new Map<string, any>()
    for (const f of files) {
      shas[f.path] = f.sha
      fileMap.set(f.path, f)
    }
    return { shas, fileMap }
  }

  /**
   * Fetch contents for given paths from a file map with caching and concurrency.
   * @param {Map<string, any>} fileMap map of file metadata
   * @param {Map<string,string>} contentCache cache map
   * @param {Record<string,string>} snapshot output snapshot
   * @param {string[]} paths requested paths
   * @param {number} concurrency concurrency level
   * @returns {Promise<Record<string,string>>}
   */
  private async _fetchContentFromMap(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, paths: string[], concurrency: number): Promise<Record<string, string>> {
    /**
     * Collect contents for the requested paths using concurrency helper.
     * @param {string[]} paths requested paths
     * @returns {Promise<Record<string,string>>} path->content map
     */
    const out: Record<string, string> = {}
    const unique = Array.from(new Set(paths)).filter((p) => fileMap.has(p))
    const mapper = this._mapperForFetch.bind(this, fileMap, contentCache, snapshot, out)
    await mapWithConcurrency(unique, mapper, concurrency)
    return out
  }

  /**
   * Mapper used by _fetchContentFromMap when fetching multiple files.
   * @param {Map<string, any>} fileMap file metadata map
   * @param {Map<string,string>} contentCache cache map
   * @param {Record<string,string>} snapshot snapshot map to populate
   * @param {Record<string,string>} out output map to collect results
   * @param {string} p requested path
   * @returns {Promise<null>}
   */
  private async _mapperForFetch(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, out: Record<string, string>, p: string): Promise<null> {
    const content = await this._fetchContentForPath(fileMap, contentCache, snapshot, p)
    if (content !== null) out[p] = content
    return null
  }

  /**
   * Fetch single path content, update cache and snapshot.
   * @param {Map<string, any>} fileMap file map
   * @param {Map<string,string>} contentCache cache map
   * @param {Record<string,string>} snapshot snapshot map
   * @param {string} p path to fetch
   * @returns {Promise<string|null>}
   */
  private async _fetchContentForPath(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, p: string): Promise<string | null> {
    if (contentCache.has(p)) {
      const v = contentCache.get(p) as string
      snapshot[p] = v
      return v
    }
    const f = fileMap.get(p)
    const r = await this._fetchBlobContentOrNull(f)
    if (r && r.content !== null) {
      contentCache.set(p, r.content)
      snapshot[p] = r.content
      return r.content
    }
    return null
  }
}
// re-export helpers for backward compatibility
export { fetchWithRetry, classifyStatus, getDelayForResponse, processResponseWithDelay, mapWithConcurrency, shaOf }
// re-export error classes for backward compatibility with tests
export { RetryableError, NonRetryableError } from './abstractAdapter.ts'
export default GitHubAdapter

