import { GitAdapter } from './adapter.ts'
import AbstractGitAdapter, { fetchWithRetry, classifyStatus, getDelayForResponse, processResponseWithDelay, mapWithConcurrency, shaOf, NonRetryableError } from './abstractAdapter.ts'
// Use Web Crypto directly for SHA-1

type GHOptions = {
  owner: string
  repo: string
  token: string
  host?: string // optional GitHub Enterprise host
}

/**
 * 指定ミリ秒だけ sleep するユーティリティ
 * @param ms ミリ秒
 */
// helpers are provided by abstractAdapter

export class GitHubAdapter extends AbstractGitAdapter implements GitAdapter {
  private _fetchWithRetry: (_: RequestInfo, __: RequestInit, ___?: number, ____?: number) => Promise<Response>
  private repoMetadata: import('../virtualfs/types.ts').RepositoryMetadata | null = null
  // simple in-memory blob cache: contentSha -> blobSha
  private blobCache: Map<string, string> = new Map()

  /**
   * GitHubAdapter を初期化します。
   * @param {GHOptions} opts 設定オブジェクト
   */
  constructor(options: GHOptions) {
    super(options)
    const host = options.host || 'https://api.github.com'
    this.baseUrl = `${host}/repos/${options.owner}/${options.repo}`
    this.headers = {
      Authorization: `token ${options.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    }
    this._fetchWithRetry = fetchWithRetry
  }

  /**
   * List commits for a ref (GitHub commits API)
   * @param {{ref:string,perPage?:number,page?:number}} query
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
   * コンテンツから sha1 を算出します。
   * @param {string} content コンテンツ
   * @returns {string} sha1 ハッシュ
   */
  // shaOf is inherited from AbstractGitAdapter

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
   * ブロブ作成用のヘルパー（createBlobs から抽出）
   * @param {any} ch 変更エントリ
    * @returns {Promise<{path:string,sha:string}>}
   */
  private async _createBlobForChange(ch: any) {
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
    const parents = (typeof parentSha === 'string' && /^[0-9a-f]{40}$/.test(parentSha)) ? [parentSha] : []
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
   */
  async getRepositoryMetadata(): Promise<import('../virtualfs/types.ts').RepositoryMetadata> {
    if (this.repoMetadata) return this.repoMetadata
    try {
      const resp = await this._fetchWithRetry(`${this.baseUrl}`, { method: 'GET', headers: this.headers }, 4, 300)
      const data = await resp.json().catch(() => ({}))
      this.repoMetadata = {
        defaultBranch: data && data.default_branch ? data.default_branch : 'main',
        name: data && data.name ? data.name : '',
        id: data && data.id ? data.id : undefined,
      }
      return this.repoMetadata
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).error) (console as any).error('リポジトリメタデータの取得に失敗しました。デフォルトブランチを\'main\'として扱います', error)
      this.repoMetadata = { defaultBranch: 'main', name: '', id: undefined }
      return this.repoMetadata
    }
  }

  /**
   * List branches via GitHub API and map to BranchListPage.
   */
  async listBranches(query?: import('../virtualfs/types.ts').BranchListQuery) {
    const perPage = (query && query.perPage) || 30
    const page = (query && query.page) || 1
    const url = `${this.baseUrl}/branches?per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`
    const resp = await this._fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const text = await resp.text().catch(() => '[]')
    const parsed = this._parseJsonArray(text)
    const repoMeta = await this.getRepositoryMetadata().catch(() => ({ defaultBranch: 'main' }))

    const items = (Array.isArray(parsed) ? parsed : []).map((b: any) => ({
      name: b.name,
      commit: { sha: b.commit && b.commit.sha ? b.commit.sha : '', url: b.commit && b.commit.url ? b.commit.url : '' },
      protected: !!b.protected,
      isDefault: b.name === (repoMeta && repoMeta.defaultBranch ? repoMeta.defaultBranch : 'main'),
    }))

    const linkHdr = resp && (resp as any).headers && typeof (resp as any).headers.get === 'function' ? (resp as any).headers.get('link') : undefined
    const pages = this._parseLinkHeaderString(typeof linkHdr === 'string' ? linkHdr : undefined)
    return { items, nextPage: pages.nextPage, lastPage: pages.lastPage }
  }

  /**
   * 参照を更新します。
   * @param {string} ref 参照名（例: heads/main）
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
   * @param ref 例: `heads/main`
    * @returns {Promise<string>} 参照先のコミット SHA
   */
  async getRef(reference: string) {
    const response = await this._fetchWithRetry(`${this.baseUrl}/git/ref/${reference}`, { method: 'GET', headers: this.headers }, 4, 300)
    const index = await response.json()
    if (!index || !index.object || !index.object.sha) throw new NonRetryableError('getRef: sha not found')
    return index.object.sha as string
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
    let content: string
    if (enc === 'base64') {
      content = atob((index.content || '').replace(/\n/g, ''))
    } else {
      content = index.content
    }
    return { content, encoding: enc }
  }

  /**
   * Blob を取得して content を返す。取得失敗時は content=null を返す。
   * @param {{sha:string,path:string}} f blob 情報
   * @returns {Promise<{path:string,content:string|null}>}
   */
  private async _fetchBlobContentOrNull(f: any) {
    try {
      const b = await this.getBlob(f.sha)
      return { path: f.path, content: b.content }
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('fetchSnapshot blob failed', f.path, error)
      return { path: f.path, content: null }
    }
  }

  /**
   * リポジトリのスナップショットを取得します。
   * @param {string} branch ブランチ名 (default: 'main')
    * @returns {Promise<{headSha:string,shas:Record<string,string>,fetchContent:Function,snapshot:Record<string,string>}>}
   */
  async fetchSnapshot(branch = 'main', concurrency = 5) {
    const referenceResponse = await this._fetchWithRetry(`${this.baseUrl}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers }, 4, 300)
    const referenceJ = await referenceResponse.json()
    const headSha = (referenceJ && (referenceJ.object && referenceJ.object.sha ? referenceJ.object.sha : referenceJ.sha)) || branch

    const treeResponse = await this._fetchWithRetry(`${this.baseUrl}/git/trees/${headSha}${'?recursive=1'}`, { method: 'GET', headers: this.headers }, 4, 300)
    const treeJ = await treeResponse.json()
    const files = (treeJ && treeJ.tree) ? treeJ.tree.filter((t: any) => t.type === 'blob') : []

    const shas: Record<string, string> = {}
    const fileMap = new Map<string, any>()
    for (const f of files) {
      shas[f.path] = f.sha
      fileMap.set(f.path, f)
    }

    const contentCache = new Map<string, string>()
    const snapshot: Record<string, string> = {}
    // Fetch content wrapper that delegates to private helper.
    // 内部ラッパー
    /**
     * 指定パス配列から内容を取得するラッパー
     * @param {string[]} paths パス配列
     * @returns {Promise<Record<string,string>>} パス→内容 マップ
     */
    const fetchContent = (paths: string[]) => this._fetchContentFromMap(fileMap, contentCache, snapshot, paths, concurrency)

    return { headSha, shas, fetchContent, snapshot }
  }

  /**
   * Helper to fetch file contents from a file map with concurrency and caching.
    * @returns {Promise<Record<string,string>>} パス→内容 マップ
   */
  private async _fetchContentFromMap(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, paths: string[], concurrency: number) {
    const out: Record<string, string> = {}
    const unique = Array.from(new Set(paths)).filter((p) => fileMap.has(p))
    await mapWithConcurrency(unique, async (p: string) => {
      const content = await this._fetchContentForPath(fileMap, contentCache, snapshot, p)
      if (content !== null) out[p] = content
      return null
    }, concurrency)
    return out
  }

  /**
   * 指定パスのコンテンツを取得し、キャッシュと snapshot を更新します。
   * @param {Map<string, any>} fileMap ファイルメタ情報マップ
   * @param {Map<string, string>} contentCache キャッシュマップ
   * @param {Record<string,string>} snapshot スナップショット出力マップ
   * @param {string} p 取得対象パス
   * @returns {Promise<string|null>} ファイル内容または null
   */
  private async _fetchContentForPath(fileMap: Map<string, any>, contentCache: Map<string, string>, snapshot: Record<string, string>, p: string) {
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

// helper moved into class as a private method
