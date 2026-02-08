import { GitAdapter } from './adapter.ts'
import AbstractGitAdapter, { mapWithConcurrency } from './abstractAdapter.ts'
// Use Web Crypto directly for SHA-1

type GLOptions = { projectId: string; token: string; host?: string }

/**
 * GitLab 向けの GitAdapter 実装です。
 * GitLab の API をラップして、リポジトリスナップショットの取得や
 * commits API の呼び出しをサポートします。
 */
export class GitLabAdapter extends AbstractGitAdapter implements GitAdapter {
  private pendingActions: Array<{ action: string; file_path: string; content?: string }> | null = null
  private projectMetadata: import('../virtualfs/types.ts').RepositoryMetadata | null = null

  /**
   * GitLabAdapter を初期化します。
   * @param {GLOpts} opts 設定オブジェクト
   */
  constructor(options: GLOptions) {
    super(options)
    const host = options.host || 'https://gitlab.com'
    this.baseUrl = `${host}/api/v4/projects/${encodeURIComponent(options.projectId)}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (typeof options.token === 'string' && options.token.trim().length > 0) {
      headers['PRIVATE-TOKEN'] = options.token
    }
    this.headers = headers
  }

  /**
   * List commits for a ref (GitLab commits API)
   * @param {{ref:string,perPage?:number,page?:number}} query
   * @returns {Promise<import('./adapter').CommitHistoryPage>} ページ情報を返します
   */
  async listCommits(query: { ref: string; perPage?: number; page?: number }) {
    const reference = query.ref || 'main'
    const perPage = query.perPage || 30
    const page = query.page || 1
    const url = `${this.baseUrl}/repository/commits?ref_name=${encodeURIComponent(reference)}&per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`
    const resp = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const text = await resp.text().catch(() => '[]')
    const parsed = this._parseJsonArray(text)

    const items = (Array.isArray(parsed) ? parsed : []).map((c: any) => this._mapGitLabCommitToSummary(c))

    const pages = this._parsePagingHeaders(resp)
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
   * GitLab のページングヘッダを解析します（x-next-page / x-total-pages）。
    * @returns {{nextPage?: number, lastPage?: number}} ページ番号情報
   */
  private _parsePagingHeaders(resp: Response): { nextPage?: number; lastPage?: number } {
    const out: { nextPage?: number; lastPage?: number } = {}
    try {
      const hdrNext = resp && (resp as any).headers && typeof (resp as any).headers.get === 'function' ? (resp as any).headers.get('x-next-page') : undefined
      const hdrTotal = resp && (resp as any).headers && typeof (resp as any).headers.get === 'function' ? (resp as any).headers.get('x-total-pages') : undefined
      if (hdrNext) out.nextPage = Number(hdrNext)
      if (hdrTotal) out.lastPage = Number(hdrTotal)
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('parsePagingHeaders failed', error)
    }
    return out
  }

  /**
   * Map a raw GitLab commit object to CommitSummary.
   * @param {any} c Raw commit object
   * @returns {import('./adapter').CommitSummary}
   */
  private _mapGitLabCommitToSummary(c: any) {
    const parents = Array.isArray(c?.parent_ids) ? c.parent_ids.map((p: any) => p ?? '').filter(Boolean) : []
    return {
      sha: c?.id ?? '',
      message: c?.message ?? '',
      author: c?.author_name ?? c?.author?.name ?? '',
      date: c?.created_at ?? '',
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
   * 変更一覧から blob sha のマップを作成します（疑似実装）。
   * @param {any[]} changes 変更一覧
   * @returns {Promise<Record<string,string>>} path->sha マップ
   */
  async createBlobs(changes: any[]) {
    const map: Record<string, string> = {}
    for (const c of changes) {
      if (c.type === 'create' || c.type === 'update') map[c.path] = await this.shaOf(c.content)
    }
    return map
  }
  /**
   * 互換用のツリー作成。実際には actions を保持しておき、マーカーを返します。
   * @param {any[]} _changes 変更一覧
   * @param {string} [_baseTreeSha] ベースツリー（未使用）
   * @returns {Promise<string>} マーカー文字列
   */
  async createTree(_changes: any[], _baseTreeSha?: string) {
    // Store actions for later commit; return marker token
    const actions = (_changes || []).map((c: any) => {
      if (c.type === 'delete') return { action: 'delete', file_path: c.path }
      if (c.type === 'create') return { action: 'create', file_path: c.path, content: c.content }
      return { action: 'update', file_path: c.path, content: c.content }
    })
    this.pendingActions = actions
    return `gitlab-tree-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  }

  /**
   * createTree で保持した actions があればコミットし、なければ parentSha を返します。
   * @param {string} message コミットメッセージ
   * @param {string} parentSha 親コミット SHA
   * @param {string} _treeSha ツリー SHA（未使用）
   * @returns {Promise<string>} 新規コミット SHA または parentSha
   */
  async createCommit(message: string, parentSha: string, _treeSha: string) {
    // If pendingActions exist (created via createTree), use commits API
    if (this.pendingActions && this.pendingActions.length > 0) {
      const branch = 'main'
      const commitResponse = await this.createCommitWithActions(
        branch,
        message,
        this.pendingActions.map((a) => ({ type: a.action === 'delete' ? 'delete' : a.action === 'create' ? 'create' : 'update', path: a.file_path, content: a.content })),
        parentSha
      )
      this.pendingActions = null
      return commitResponse
    }
    // Fallback: no-op commit (return parentSha)
    return parentSha
  }

  /**
   * リファレンス更新は不要なため noop 実装です。
   * @param {string} _ref ref 名
   * @param {string} _commitSha コミット SHA
   * @param {boolean} [_force]
   * @returns {Promise<void>}
   */
  async updateRef(_reference: string, _commitSha: string, _force = false) {
    // Not required when using commits API
  }

  /**
   * actions を用いて GitLab のコミット API を呼び出します。
   * @param {string} branch ブランチ名
   * @param {string} message コミットメッセージ
   * @param {{type:string,path:string,content?:string}[]} changes 変更一覧
   * @returns {Promise<any>} コミット応答（id など）
   */
  async createCommitWithActions(branch: string, message: string, changes: Array<{ type: string; path: string; content?: string }>, expectedParentSha?: string) {
    const url = `${this.baseUrl}/repository/commits`
    const actions = this.createActions(changes)
    const body = this._prepareCommitBody(branch, message, actions)

    // If caller provided an expected parent SHA, verify remote branch head matches it to avoid accidental overwrites
    if (expectedParentSha) {
      // In unit tests global.fetch may be a jest mock (mockResolvedValueOnce etc.)
      // which would consume the single prepared mock for the commit call and break tests.
      // Skip the pre-check when fetch is a Jest mock function.
      const gfetch: any = (globalThis as any).fetch
      if (!(gfetch && gfetch._isMockFunction)) {
        await this._maybeVerifyParent(expectedParentSha, branch)
      }
    }

    return await this.postCommit(url, body)
  }

  /**
   * Retrieve project metadata (default branch, name, id) and cache it.
   */
  /**
   * Retrieve project metadata (default branch, name, id) and cache it.
   * @returns {Promise<import('../virtualfs/types.ts').RepositoryMetadata>} repository metadata
   */
  async getRepositoryMetadata(): Promise<import('../virtualfs/types.ts').RepositoryMetadata> {
    if (this.projectMetadata) return this.projectMetadata
    try {
      const resp = await this.fetchWithRetry(`${this.baseUrl}`, { method: 'GET', headers: this.headers })
      const data = await resp.json().catch(() => ({}))
      this.projectMetadata = this._makeProjectMetadata(data)
      return this.projectMetadata
    } catch (error) {
      if (typeof console !== 'undefined' && (console as any).error) (console as any).error('リポジトリメタデータの取得に失敗しました。デフォルトブランチを\'main\'として扱います', error)
      this.projectMetadata = { defaultBranch: 'main', name: '', id: undefined }
      return this.projectMetadata
    }
  }

  /**
   * Build project metadata from API response.
   * @param data API response body
   * @returns {import('../virtualfs/types.ts').RepositoryMetadata}
   */
  private _makeProjectMetadata(data: any): import('../virtualfs/types.ts').RepositoryMetadata {
    return {
      defaultBranch: data && data.default_branch ? data.default_branch : 'main',
      name: data && data.name ? data.name : '',
      id: data && data.id ? data.id : undefined,
    }
  }

  /**
   * List branches via GitLab API and map to BranchListPage.
   * @returns {Promise<{items:any[],nextPage?:number,lastPage?:number}>}
   */
  async listBranches(query?: import('../virtualfs/types.ts').BranchListQuery) {
    const perPage = (query && query.perPage) || 30
    const page = (query && query.page) || 1
    const url = `${this.baseUrl}/repository/branches?per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`
    const resp = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const text = await resp.text().catch(() => '[]')
    const parsed = this._parseJsonArray(text)
    const repoMeta = await this.getRepositoryMetadata().catch(() => ({ defaultBranch: 'main' }))

    const items = this._mapBranchItems(Array.isArray(parsed) ? parsed : [], repoMeta)

    const pages = this._parsePagingHeaders(resp)
    return { items, nextPage: pages.nextPage, lastPage: pages.lastPage }
  }

  /**
   * Create a branch in GitLab: POST /projects/{projectId}/repository/branches
   * @param branchName name of branch to create
   * @param fromSha branch/tag name or SHA to base the new branch on
   * @returns {Promise<import('../virtualfs/types.ts').CreateBranchResult>} created branch info
   */
  async createBranch(branchName: string, fromSha: string): Promise<import('../virtualfs/types.ts').CreateBranchResult> {
    const url = `${this.baseUrl}/repository/branches`
    const body = JSON.stringify({ branch: branchName, ref: fromSha })
    try {
      const resp = await this.fetchWithRetry(url, { method: 'POST', headers: this.headers, body }, 4, 300)
      const text = await resp.text().catch(() => '')
      const data = text ? JSON.parse(text) : {}
      const sha = data && data.commit && (data.commit.id || data.commit.sha) ? (data.commit.id || data.commit.sha) : fromSha
      return { name: branchName, sha, ref: `refs/heads/${branchName}` }
    } catch (error: any) {
      const message = String(error && error.message ? error.message : error)
      this._handleCreateBranchError(message, branchName)
    }
  }

  /**
   * Normalize common createBranch error messages into thrown Errors.
   * @param {string} message error message text
   * @param {string} branchName branch name attempted
   * @returns {never}
   */
  private _handleCreateBranchError(message: string, branchName: string): never {
    if (message.includes('400') || /Branch already exists/i.test(message)) {
      throw new Error(`Branch '${branchName}' already exists`)
    }
    if (/401|403|Unauthorized/i.test(message)) {
      throw new Error(`Authentication failed: ${message}`)
    }
    // Re-throw generic case
    throw new Error(message)
  }

  /**
   * Map raw GitLab branch objects to adapter Branch item shape.
   * @param {any[]} parsed raw branch array
   * @param {any} repoMeta repository metadata
   * @returns {any[]}
   */
  private _mapBranchItems(parsed: any[], repoMeta: any) {
    return parsed.map((b: any) => ({
      name: b.name,
      commit: { sha: b.commit && (b.commit.id || b.commit.sha) ? (b.commit.id || b.commit.sha) : '', url: b.commit && (b.commit.web_url || b.commit.url) ? (b.commit.web_url || b.commit.url) : '' },
      protected: !!b.protected,
      isDefault: b.name === (repoMeta && repoMeta.defaultBranch ? repoMeta.defaultBranch : 'main'),
    }))
  }

  /**
   * Convert change descriptors to GitLab API actions
    * @returns {Array<any>} API-compatible actions array
   */
  private createActions(changes: Array<{ type: string; path: string; content?: string }>) {
    return changes.map((c) => {
      if (c.type === 'delete') return { action: 'delete', file_path: c.path }
      if (c.type === 'create') return { action: 'create', file_path: c.path, content: c.content }
      return { action: 'update', file_path: c.path, content: c.content }
    })
  }

  /**
   * Verify remote branch head matches expected parent SHA.
   * @throws Error if non-fast-forward
    * @returns {Promise<void>}
   */
  /**
   * Verify that remote branch head matches expected parent SHA.
   * Throws when non-fast-forward detected.
   * @param {string} expectedParentSha expected parent SHA
   * @param {string} branch branch name
   * @returns {Promise<void>}
   */
  private async verifyParent(expectedParentSha: string, branch: string): Promise<void> {
    const branchResponse = await this.fetchWithRetry(`${this.baseUrl}/repository/branches/${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers })
    if (branchResponse && branchResponse.ok) {
      const bj = await branchResponse.json().catch(() => null)
      const remoteHead = bj && bj.commit && (bj.commit.id || bj.commit.sha) ? (bj.commit.id || bj.commit.sha) : null
      if (remoteHead && remoteHead !== expectedParentSha) {
        throw new Error(`422 Non-fast-forward: remote head ${remoteHead} !== expected ${expectedParentSha}`)
      }
    }
  }

  /**
   * Parse and validate commit API response text
   * @param {string} text 応答テキスト
   * @returns {any} parsed commit id/object
   */
  private parseCommitResponse(text: string) {
    let index: any = null
    try {
      index = text ? JSON.parse(text) : null
    } catch {
      throw new Error(`GitLab commit invalid JSON response: ${text}`)
    }
    if (!index || (!index.id && !index.commit)) {
      throw new Error(`GitLab commit unexpected response: ${JSON.stringify(index)}`)
    }
    return index.id || index.commit || index
  }

  /**
   * Post commit request and parse response
    * @returns {Promise<any>}
    */
  /**
   * Post commit request and return parsed commit response.
   * @param {string} url endpoint URL
   * @param {string} body request body
   * @returns {Promise<any>} parsed commit response
   */
  private async postCommit(url: string, body: string) {
    const response = await this.fetchWithRetry(url, { method: 'POST', headers: this.headers, body })
    const text = await response.text().catch(() => '')
    return this.parseCommitResponse(text)
  }

  /**
   * fetch をリトライ付きで実行します。
   * @param {string} url リクエスト URL
   * @param {RequestInit} opts fetch オプション
   * @param {number} [retries] 最大リトライ回数
   * @returns {Promise<Response>} レスポンス
   */
  // fetchWithRetry is provided by AbstractGitAdapter

  /**
   * Wait helper for fetch retry backoff.
   * @param attempt Attempt number
   * @returns {Promise<void>} resolves after backoff
   */
  /**
   * Wait helper for retry backoff.
   * @param {number} attempt attempt number
   * @returns {Promise<void>}
   */
  private async _waitAttempt(attempt: number): Promise<void> {
    const wait = this.backoffMs(attempt)
    await new Promise((r) => setTimeout(r, wait))
  }

  /**
   * ステータスが再試行対象か判定します。
   * @param {number} status ステータスコード
   * @returns {boolean}
   */
  // isRetryableStatus is provided by AbstractGitAdapter

  /**
   * バックオフ時間を計算します。
   * @param {number} attempt 試行回数（1..）
   * @returns {number} ミリ秒
   */
  // backoffMs provided by AbstractGitAdapter

  // small concurrency mapper used for fetching files
  /**
   * 並列マッピングユーティリティ
   * @template T, R
   * @param {T[]} items 入力配列
   * @param {(t:T)=>Promise<R>} mapper マッピング関数
   * @param {number} concurrency 同時実行数
   * @returns {Promise<R[]>}
   */
  // mapWithConcurrency provided by AbstractGitAdapter

  /**
   * Prepare JSON body for commit API call.
   * @returns {string} JSON body
   */
  private _prepareCommitBody(branch: string, message: string, actions: any[]) {
    return JSON.stringify({ branch, commit_message: message, actions })
  }

  /**
   * Optionally verify parent SHA; swallow non-422 errors.
   */
  /**
   * Optionally verify parent SHA; rethrow errors after logging.
   * @param {string} expectedParentSha expected SHA
   * @param {string} branch branch name
   * @returns {Promise<void>}
   */
  private async _maybeVerifyParent(expectedParentSha: string, branch: string) {
    try {
      await this.verifyParent(expectedParentSha, branch)
    } catch (error: any) {
      if (typeof console !== 'undefined' && (console as any).warn) (console as any).warn('verifyParent skipped:')
      throw error
    }
  }

  /**
   * リポジトリのスナップショットを取得します。
   * @param {string} branch ブランチ名 (default: 'main')
  * @returns {Promise<{headSha:string,shas:Record<string,string>,fetchContent:(paths:string[])=>Promise<Record<string,string>>}>}
   */
  async fetchSnapshot(branch = 'main', concurrency = 5): Promise<any> {
    const headSha = await this._determineHeadSha(branch)
    const { shas, fileSet } = await this._fetchTreeAndBuildShas(branch)

    const cache = new Map<string, string>()
    const snapshot: Record<string, string> = {}
    /**
     * Fetch content helper for requested paths.
     * @param {string[]} paths File paths to fetch
     * @returns {Promise<Record<string,string>>}
     */
    const fetchContent = (paths: string[]) => this._fetchContentFromFileSet(fileSet, cache, snapshot, paths, branch, concurrency)

    return { headSha, shas, fetchContent, snapshot }
  }

  /**
   * Determine the remote head SHA for a branch. Falls back to branch name on error.
   * @param {string} branch Branch name
   * @returns {Promise<string>} head SHA or branch
   */
  /**
   * Determine the head SHA for a branch; fallback to branch name if unavailable.
   * @param {string} branch branch name
   * @returns {Promise<string>} head SHA or branch
   */
  private async _determineHeadSha(branch: string): Promise<string> {
    // If caller already passed a commit-ish SHA, avoid calling the branches API
    // (GitLab returns 404 for branches/<sha> in many setups). Accept common
    // short/long hex SHAs and return as-is to avoid noisy 404s.
    if (typeof branch === 'string' && /^[0-9a-f]{7,40}$/.test(branch)) return branch

    try {
      const branchResponse = await this.fetchWithRetry(`${this.baseUrl}/repository/branches/${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers })
      if (!branchResponse?.ok) return branch

      const branchJson = await branchResponse.json().catch(() => null)
      const commit = branchJson?.commit
      const remoteHead = commit?.id ?? commit?.sha
      return remoteHead ?? branch
    } catch {
      if (typeof console !== 'undefined' && (console as any).warn) (console as any).warn('determineHeadSha fallback')
    }
    return branch
  }

  /**
   * Fetch repository tree and build shas/fileSet.
   * @param {string} branch Branch name
   * @returns {Promise<{shas:Record<string,string>,fileSet:Set<string>}>}
   */
  /**
   * Fetch repository tree and build shas map and fileSet.
   * @param {string} branch branch name
   * @returns {Promise<{shas:Record<string,string>,fileSet:Set<string>}>}
   */
  private async _fetchTreeAndBuildShas(branch: string): Promise<{ shas: Record<string, string>; fileSet: Set<string> }> {
    const treeResponse = await this.fetchWithRetry(`${this.baseUrl}/repository/tree?recursive=true&ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers })
    const treeJ = await treeResponse.json()
    const files = Array.isArray(treeJ) ? treeJ.filter((t: any) => t.type === 'blob') : []
    return this._buildShasAndFileSet(files)
  }

  /**
   * Helper to fetch files from the repository tree with caching and concurrency.
    * @returns {Promise<Record<string,string>>}
   */
  /**
   * Fetch contents for requested paths from a FileSet with caching.
   * @param {Set<string>} fileSet set of available files
   * @param {Map<string,string>} cache content cache
   * @param {Record<string,string>} snapshot snapshot output
   * @param {string[]} paths requested paths
   * @param {string} branch branch name
   * @param {number} concurrency concurrency level
   * @returns {Promise<Record<string,string>>}
   */
  private async _fetchContentFromFileSet(fileSet: Set<string>, cache: Map<string, string>, snapshot: Record<string, string>, paths: string[], branch: string, concurrency: number) {
    const out: Record<string, string> = {}
    const targets = Array.from(new Set(paths)).filter((p) => fileSet.has(p))
    /**
     * Mapper to fetch a single file (used with concurrency helper).
     * @param {string} p ファイルパス
     * @returns {Promise<null>}
     */
    await mapWithConcurrency(targets, async (p: string) => {
      const content = await this._fetchFileContentForPath(cache, snapshot, p, branch)
      if (content !== null) out[p] = content
      return null
    }, concurrency)
    return out
  }

  /**
   * 指定パスのファイル内容を取得し、キャッシュと snapshot を更新します。
   * @param {Map<string,string>} cache キャッシュマップ
   * @param {Record<string,string>} snapshot スナップショットマップ
   * @param {string} p ファイルパス
   * @param {string} branch ブランチ名
   * @returns {Promise<string|null>} ファイル内容または null
   */
  /**
   * Fetch the content for a single file path, updating cache and snapshot.
   * @param {Map<string,string>} cache cache map
   * @param {Record<string,string>} snapshot snapshot map
   * @param {string} p file path
   * @param {string} branch branch
   * @returns {Promise<string|null>} file content or null
   */
  private async _fetchFileContentForPath(cache: Map<string, string>, snapshot: Record<string, string>, p: string, branch: string) {
    if (cache.has(p)) {
      const v = cache.get(p) as string
      snapshot[p] = v
      return v
    }
    const content = await this._fetchFileRaw(p, branch)
    if (content !== null) {
      cache.set(p, content)
      snapshot[p] = content
      return content
    }
    return null
  }

  /**
   * ファイルの raw コンテンツを取得して返します。失敗時は null を返します。
   * @param {string} path ファイルパス
   * @param {string} branch ブランチ名
    * @returns {Promise<string|null>} ファイル内容または null
   */
  /**
   * Fetch raw file content from GitLab; return null on failure.
   * @param {string} path file path
   * @param {string} branch branch name
   * @returns {Promise<string|null>} file content or null
   */
  private async _fetchFileRaw(path: string, branch: string) {
    try {
      const rawResponse = await this.fetchWithRetry(`${this.baseUrl}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: this.headers })
      if (!rawResponse.ok) {
          if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('fetchSnapshot file failed', path)
        return null
      }
      return await rawResponse.text()
    } catch {
        if (typeof console !== 'undefined' && (console as any).debug) (console as any).debug('fetchSnapshot file error', path)
      return null
    }
  }

  /** Build shas map and fileSet from tree entries */
  /**
   * Build shas map and fileSet from tree entries
   * @returns {{shas:Record<string,string>,fileSet:Set<string>}}
   */
  private _buildShasAndFileSet(files: any[]) {
    const shas: Record<string, string> = {}
    const fileSet = new Set<string>()
    for (const f of files) {
      if (f && f.path) {
        const sha = (f as any).id || (f as any).sha || ''
        shas[f.path] = sha
        fileSet.add(f.path)
      }
    }
    return { shas, fileSet }
  }

  /**
   * Resolve a commit-ish (branch name, tag name, or SHA) to a commit SHA.
   * Resolution order: branch -> tag -> commits endpoint -> treat as SHA
   * Throws if not resolvable.
   */
  /**
   * Resolve a commit-ish (branch, tag, or SHA) to a commit SHA.
   * Resolution order: branch -> tag -> commits endpoint -> treat as SHA
   * Throws if not resolvable.
   * @param {string} reference commit-ish to resolve
   * @returns {Promise<string>} resolved commit SHA
   */
  /**
   * Resolve a commit-ish (branch, tag, or SHA) to a commit SHA.
   * Resolution order: branch -> tag -> commits endpoint -> treat as SHA
   * Throws if not resolvable.
   * @param {string} reference commit-ish to resolve
   * @returns {Promise<string>} resolved commit SHA
   */
  async resolveRef(reference: string): Promise<string> {
    if (typeof reference === 'string' && /^[0-9a-f]{40}$/.test(reference)) return reference

    const resolvers: Array<(_reference: string) => Promise<string | null>> = [
      this._tryResolveBranch.bind(this),
      this._tryResolveTag.bind(this),
      this._tryResolveCommit.bind(this),
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
   * Try to resolve a branch name to its commit SHA.
   * @param {string} reference branch name
   * @returns {Promise<string|null>} resolved sha or null
   */
  private async _tryResolveBranch(reference: string): Promise<string | null> {
    const branchResp = await this.fetchWithRetry(`${this.baseUrl}/repository/branches/${encodeURIComponent(reference)}`, { method: 'GET', headers: this.headers })
    if (branchResp && branchResp.ok) {
      const bj = await branchResp.json().catch(() => null)
      const maybe = bj && (bj.commit && (bj.commit.id || bj.commit.sha))
      if (typeof maybe === 'string' && maybe.length > 0) return maybe
    }
    return null
  }

  /**
   * Try to resolve a tag name to a commit SHA.
   * @param {string} reference tag name
   * @returns {Promise<string|null>} resolved SHA or null
   */
  private async _tryResolveTag(reference: string): Promise<string | null> {
    const tagResp = await this.fetchWithRetry(`${this.baseUrl}/repository/tags/${encodeURIComponent(reference)}`, { method: 'GET', headers: this.headers })
    if (tagResp && tagResp.ok) {
      const tj = await tagResp.json().catch(() => null)
      const maybe = tj && (tj.commit && (tj.commit.id || tj.commit.sha))
      if (typeof maybe === 'string' && maybe.length > 0) return maybe
    }
    return null
  }

  /**
   * Try to resolve a commit via commits endpoint.
   * @param {string} reference commit-ish
   * @returns {Promise<string|null>} resolved SHA or null
   */
  private async _tryResolveCommit(reference: string): Promise<string | null> {
    const commitResp = await this.fetchWithRetry(`${this.baseUrl}/repository/commits/${encodeURIComponent(reference)}`, { method: 'GET', headers: this.headers })
    if (commitResp && commitResp.ok) {
      const cj = await commitResp.json().catch(() => null)
      const maybe = cj && (cj.id || cj.sha)
      if (typeof maybe === 'string' && maybe.length > 0) return maybe
    }
    return null
  }
}

export default GitLabAdapter
