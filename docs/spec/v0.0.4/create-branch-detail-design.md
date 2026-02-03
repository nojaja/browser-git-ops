# ブランチ作成機能 詳細設計書

## 1. 目的
リモートリポジトリに新しいブランチ（ref）を作成する機能を提供し、ブランチベースの開発ワークフローを支援する。本機能はGitHub/GitLab APIを利用してリモートリポジトリ上でrefを作成し、ローカルにはブランチ概念を持たない。

## 2. スコープ
- リモートリポジトリへのブランチ（ref）作成機能の実装
- 基準コミットSHAからの新規ブランチ作成（HEAD指定および任意SHA指定の両対応）
- GitHub API / GitLab API の差分吸収
- エラーハンドリング（重複ブランチ、認証エラー等）
- checkout機能は**含まない**（今回はブランチ作成のみ）

## 3. 前提条件
- **ローカルブランチ概念なし**: VirtualFSはローカルにブランチを管理せず、workspaceはbaseに対する差分レイヤとして機能
- **リモート操作のみ**: GitHub/GitLab上でrefを作成するだけで、workspace/base構成には影響しない
- **既存インフラ活用**: `listBranches()`、`resolveRef()`等の既存メソッドを活用
- **エラーメッセージ**: 英語で記述

## 4. 期待する入出力
### 4.1 入力
```ts
export type CreateBranchInput = {
  name: string              // 作成するブランチ名（例: 'feature/new-feature'）
  fromRef?: string          // 基準参照（ブランチ名、タグ、SHA）。未指定時は現在のHEAD
}
```

### 4.2 出力
```ts
export type CreateBranchResult = {
  name: string              // 作成されたブランチ名
  sha: string               // 作成時に参照したコミットSHA
  ref: string               // 完全なref名（例: 'refs/heads/feature/new-feature'）
}
```

## 5. ユースケース
### 5.1 HEADから新規ブランチ作成
```typescript
// 現在のHEADから新しいブランチを作成
const result = await vfs.createBranch({ name: 'feature/new-ui' })
// result: { name: 'feature/new-ui', sha: 'abc123...', ref: 'refs/heads/feature/new-ui' }
```

### 5.2 特定SHAから新規ブランチ作成
```typescript
// 過去のコミットSHAから新しいブランチを作成
const result = await vfs.createBranch({ 
  name: 'hotfix/bugfix', 
  fromRef: 'a1b2c3d4e5...' 
})
```

### 5.3 特定ブランチから新規ブランチ作成
```typescript
// 別のブランチ（develop）から新しいブランチを作成
const result = await vfs.createBranch({ 
  name: 'feature/from-develop', 
  fromRef: 'develop' 
})
```

## 6. アーキテクチャ配置（設計方針）
### 6.1 層の責務
- **Adapter層**: プロバイダ差分の吸収・HTTP処理・エラーハンドリング
  - GitHub: `POST /repos/{owner}/{repo}/git/refs` でref作成
  - GitLab: `POST /projects/{projectId}/repository/branches` でブランチ作成
- **VirtualFS層**: Adapterへの委譲・fromRef解決・結果の正規化
- **型定義**: 共有型として集約

### 6.2 追加・拡張先
- Adapter契約: [src/git/abstractAdapter.ts](../../src/git/abstractAdapter.ts)
- Adapter実装: [src/git/githubAdapter.ts](../../src/git/githubAdapter.ts), [src/git/gitlabAdapter.ts](../../src/git/gitlabAdapter.ts)
- VirtualFS委譲: [src/virtualfs/virtualfs.ts](../../src/virtualfs/virtualfs.ts)
- 共有型定義: [src/virtualfs/types.ts](../../src/virtualfs/types.ts)
- 公開API: [src/index.ts](../../src/index.ts)

## 7. GitHub API 仕様
### 7.1 ref作成エンドポイント
```
POST /repos/{owner}/{repo}/git/refs
```

### 7.2 リクエストボディ
```json
{
  "ref": "refs/heads/feature/new-branch",
  "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd"
}
```

### 7.3 レスポンス（成功時 201 Created）
```json
{
  "ref": "refs/heads/feature/new-branch",
  "node_id": "MDM6UmVmMjczMDI3Njg6cmVmcy9oZWFkcy9mZWF0dXJl",
  "url": "https://api.github.com/repos/owner/repo/git/refs/heads/feature/new-branch",
  "object": {
    "type": "commit",
    "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd",
    "url": "https://api.github.com/repos/owner/repo/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
  }
}
```

### 7.4 エラーレスポンス
#### 422 Unprocessable Entity（ブランチ既存）
```json
{
  "message": "Reference already exists",
  "documentation_url": "https://docs.github.com/rest/git/refs#create-a-reference"
}
```

#### 401 Unauthorized（認証失敗）
```json
{
  "message": "Bad credentials",
  "documentation_url": "https://docs.github.com/rest"
}
```

#### 404 Not Found（リポジトリが存在しない）
```json
{
  "message": "Not Found",
  "documentation_url": "https://docs.github.com/rest"
}
```

### 7.5 HEAD SHA取得（fromRef未指定時）
```
GET /repos/{owner}/{repo}/git/ref/heads/{branch}
```

レスポンス例:
```json
{
  "ref": "refs/heads/main",
  "node_id": "REF_kwDOAaVsA69yZWZzL2hlYWRzL21haW4",
  "url": "https://api.github.com/repos/owner/repo/git/refs/heads/main",
  "object": {
    "sha": "aa218f56b14c9653891f9e74264a383fa43fefbd",
    "type": "commit",
    "url": "https://api.github.com/repos/owner/repo/git/commits/aa218f56b14c9653891f9e74264a383fa43fefbd"
  }
}
```

## 8. GitLab API 仕様
### 8.1 ブランチ作成エンドポイント
```
POST /projects/{projectId}/repository/branches
```

### 8.2 リクエストパラメータ（Query or Body）
```json
{
  "branch": "feature/new-branch",
  "ref": "main"
}
```
または
```
POST /projects/{projectId}/repository/branches?branch=feature/new-branch&ref=main
```

**注意**: GitLabは`ref`パラメータに**ブランチ名、タグ名、またはSHA**を指定可能

### 8.3 レスポンス（成功時 201 Created）
```json
{
  "name": "feature/new-branch",
  "commit": {
    "id": "aa218f56b14c9653891f9e74264a383fa43fefbd",
    "short_id": "aa218f56",
    "created_at": "2023-01-01T12:00:00.000Z",
    "parent_ids": ["parent_sha"],
    "title": "Commit title",
    "message": "Commit message",
    "author_name": "Author Name",
    "author_email": "author@example.com",
    "authored_date": "2023-01-01T12:00:00.000Z",
    "committer_name": "Committer Name",
    "committer_email": "committer@example.com",
    "committed_date": "2023-01-01T12:00:00.000Z"
  },
  "merged": false,
  "protected": false,
  "developers_can_push": false,
  "developers_can_merge": false,
  "can_push": true,
  "default": false,
  "web_url": "https://gitlab.example.com/owner/repo/-/tree/feature/new-branch"
}
```

### 8.4 エラーレスポンス
#### 400 Bad Request（ブランチ既存）
```json
{
  "message": "Branch already exists"
}
```

#### 401 Unauthorized（認証失敗）
```json
{
  "message": "401 Unauthorized"
}
```

#### 404 Not Found（参照が存在しない）
```json
{
  "message": "404 Project Not Found"
}
```

## 9. インターフェース設計
### 9.1 型定義（src/virtualfs/types.ts）
```typescript
/**
 * ブランチ作成時の入力パラメータ
 */
export type CreateBranchInput = {
  /** 作成するブランチ名（例: 'feature/new-feature'） */
  name: string
  /** 基準参照（ブランチ名、タグ、SHA）。未指定時は現在のHEAD */
  fromRef?: string
}

/**
 * ブランチ作成結果
 */
export type CreateBranchResult = {
  /** 作成されたブランチ名 */
  name: string
  /** 作成時に参照したコミットSHA */
  sha: string
  /** 完全なref名（例: 'refs/heads/feature/new-feature'） */
  ref: string
}
```

### 9.2 Adapterインターフェース（src/git/abstractAdapter.ts）
```typescript
export interface GitAdapter {
  // 既存メソッド...
  
  /**
   * リモートリポジトリに新しいブランチ（ref）を作成する
   * @param branchName 作成するブランチ名
   * @param fromSha 基準となるコミットSHA
   * @returns 作成されたブランチ情報
   * @throws NonRetryableError ブランチが既に存在する場合（422/400）
   * @throws NonRetryableError 認証エラー（401/403）
   * @throws RetryableError サーバーエラー（5xx）
   */
  createBranch?(branchName: string, fromSha: string): Promise<CreateBranchResult>
}
```

### 9.3 VirtualFSメソッド（src/virtualfs/virtualfs.ts）
```typescript
/**
 * リモートリポジトリに新しいブランチを作成する
 * 
 * @param input ブランチ作成パラメータ
 * @param input.name 作成するブランチ名（例: 'feature/new-feature'）
 * @param input.fromRef 基準参照（ブランチ名、タグ、SHA）。未指定時は現在のHEAD
 * @returns 作成されたブランチ情報
 * @throws Error Adapterが設定されていない場合
 * @throws Error Adapterがcreateブランチをサポートしていない場合
 * @throws Error fromRefの解決に失敗した場合
 * @throws Error ブランチが既に存在する場合
 * 
 * @example
 * // HEADから新規ブランチ作成
 * const result = await vfs.createBranch({ name: 'feature/new-ui' })
 * 
 * @example
 * // 特定SHAから新規ブランチ作成
 * const result = await vfs.createBranch({ 
 *   name: 'hotfix/bugfix', 
 *   fromRef: 'a1b2c3d4e5...' 
 * })
 * 
 * @example
 * // 別のブランチから新規ブランチ作成
 * const result = await vfs.createBranch({ 
 *   name: 'feature/from-develop', 
 *   fromRef: 'develop' 
 * })
 */
async createBranch(input: CreateBranchInput): Promise<CreateBranchResult>
```

## 10. 実装フロー
### 10.1 VirtualFS.createBranch() のフロー
```
1. 入力検証
   - input.name が空文字列でないことを確認
   - input.name に不正な文字（例: '..', '\0'）が含まれていないことを確認

2. Adapter取得
   - getAdapterInstance() でAdapterインスタンスを取得
   - Adapterが存在しない場合はエラー
   - createBranch メソッドが実装されていない場合はエラー

3. fromRef解決
   - input.fromRef が指定されている場合:
     - adapter.resolveRef(input.fromRef) でSHAに解決
   - input.fromRef が未指定の場合:
     - indexManager.loadIndex() で現在のindex.headを取得
     - index.head が存在しない場合:
       - adapter.opts.branch からデフォルトブランチ名を取得
       - adapter.resolveRef(defaultBranch) でHEAD SHAを取得

4. ブランチ作成
   - adapter.createBranch(input.name, resolvedSha) を呼び出し
   - 結果を返却

5. エラーハンドリング
   - ブランチ既存エラー（422/400）: "Branch '{name}' already exists"
   - 認証エラー（401/403）: "Authentication failed"
   - その他: 元のエラーメッセージを伝播
```

### 10.2 GitHubAdapter.createBranch() のフロー
```
1. ref名の構築
   - 'refs/heads/' + branchName

2. リクエストボディの作成
   - { ref: refName, sha: fromSha }

3. POST /repos/{owner}/{repo}/git/refs
   - _fetchWithRetry() を使用（既存パターン踏襲）
   - リトライ: 4回、ベース遅延: 300ms

4. レスポンス処理
   - 201 Created: 成功
     - response.json() でボディ取得
     - { name: branchName, sha: fromSha, ref: response.ref } を返却
   - 422 Unprocessable Entity: NonRetryableError
     - "Branch already exists"
   - 401/403: NonRetryableError
     - "Authentication failed"
   - 5xx/429: RetryableError
     - 自動リトライ

5. エラーハンドリング
   - NonRetryableError をそのまま伝播
   - RetryableError は _fetchWithRetry() が処理
```

### 10.3 GitLabAdapter.createBranch() のフロー
```
1. リクエストボディの作成
   - { branch: branchName, ref: fromSha }
   - GitLabはSHAを直接 'ref' パラメータで受け入れる

2. POST /projects/{projectId}/repository/branches
   - _fetchWithRetry() を使用（既存パターン踏襲）
   - リトライ: 4回、ベース遅延: 300ms

3. レスポンス処理
   - 201 Created: 成功
     - response.json() でボディ取得
     - { name: data.name, sha: data.commit.id, ref: 'refs/heads/' + data.name } を返却
   - 400 Bad Request: NonRetryableError
     - レスポンスボディに "already exists" が含まれる場合: "Branch already exists"
     - その他: レスポンスボディをそのまま伝播
   - 401/403: NonRetryableError
     - "Authentication failed"
   - 5xx/429: RetryableError
     - 自動リトライ

4. エラーハンドリング
   - NonRetryableError をそのまま伝播
   - RetryableError は _fetchWithRetry() が処理
```

## 11. エラーハンドリング戦略
### 11.1 エラー分類
| エラー種別 | HTTPステータス | 処理 | 例外型 |
|-----------|--------------|-----|--------|
| ブランチ既存 | 422 (GitHub)<br>400 (GitLab) | 即座に失敗 | NonRetryableError |
| 認証失敗 | 401, 403 | 即座に失敗 | NonRetryableError |
| リポジトリ/プロジェクト不在 | 404 | 即座に失敗 | NonRetryableError |
| レート制限 | 429 | 指数バックオフでリトライ | RetryableError |
| サーバーエラー | 5xx | 指数バックオフでリトライ | RetryableError |
| ネットワークエラー | - | リトライ | RetryableError |

### 11.2 エラーメッセージ
```typescript
// VirtualFS層
"No adapter configured. Call setAdapter() first."
"Adapter does not support branch creation."
"Failed to resolve reference '{fromRef}': {error}"
"Branch name cannot be empty."
"Invalid branch name: '{name}'."

// Adapter層（GitHub）
"Branch '{branchName}' already exists."
"Authentication failed: {statusText}"
"Repository not found."
"Failed to create branch: HTTP {status} {responseText}"

// Adapter層（GitLab）
"Branch '{branchName}' already exists."
"Authentication failed: {statusText}"
"Project not found."
"Failed to create branch: HTTP {status} {responseText}"
```

## 12. テスト戦略
### 12.1 単体テスト（test/unit/git/）
#### GitHubAdapter
```typescript
describe('GitHubAdapter.createBranch', () => {
  it('should POST to /git/refs with correct body', async () => {
    configureFetchMock([{
      match: /\/git\/refs$/,
      response: { 
        status: 201, 
        body: JSON.stringify({
          ref: 'refs/heads/feature/test',
          object: { sha: 'abc123', type: 'commit' }
        })
      }
    }])
    
    const adapter = new GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' })
    const result = await adapter.createBranch('feature/test', 'abc123')
    
    expect(result).toEqual({
      name: 'feature/test',
      sha: 'abc123',
      ref: 'refs/heads/feature/test'
    })
  })
  
  it('should throw NonRetryableError when branch already exists (422)', async () => {
    configureFetchMock([{
      match: /\/git\/refs$/,
      response: { 
        status: 422, 
        body: JSON.stringify({ message: 'Reference already exists' })
      }
    }])
    
    const adapter = new GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' })
    
    await expect(adapter.createBranch('existing-branch', 'abc123'))
      .rejects.toThrow('Branch \'existing-branch\' already exists')
  })
  
  it('should throw NonRetryableError on authentication failure (401)', async () => {
    configureFetchMock([{
      match: /\/git\/refs$/,
      response: { 
        status: 401, 
        body: JSON.stringify({ message: 'Bad credentials' })
      }
    }])
    
    const adapter = new GitHubAdapter({ repo: 'owner/repo', token: 'invalid', branch: 'main' })
    
    await expect(adapter.createBranch('feature/test', 'abc123'))
      .rejects.toThrow(/Authentication failed/)
  })
  
  it('should retry on 5xx errors', async () => {
    let callCount = 0
    configureFetchMock([{
      match: /\/git\/refs$/,
      response: () => {
        callCount++
        if (callCount < 3) {
          return { status: 503, body: 'Service Unavailable' }
        }
        return {
          status: 201,
          body: JSON.stringify({
            ref: 'refs/heads/feature/test',
            object: { sha: 'abc123', type: 'commit' }
          })
        }
      }
    }])
    
    const adapter = new GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' })
    const result = await adapter.createBranch('feature/test', 'abc123')
    
    expect(callCount).toBeGreaterThanOrEqual(3)
    expect(result.name).toBe('feature/test')
  })
})
```

#### GitLabAdapter
```typescript
describe('GitLabAdapter.createBranch', () => {
  it('should POST to /repository/branches with correct body', async () => {
    configureFetchMock([{
      match: /\/repository\/branches$/,
      response: { 
        status: 201, 
        body: JSON.stringify({
          name: 'feature/test',
          commit: { id: 'abc123' },
          protected: false
        })
      }
    }])
    
    const adapter = new GitLabAdapter({ 
      projectId: 'owner/repo', 
      host: 'https://gitlab.com', 
      token: '***', 
      branch: 'main' 
    })
    const result = await adapter.createBranch('feature/test', 'abc123')
    
    expect(result).toEqual({
      name: 'feature/test',
      sha: 'abc123',
      ref: 'refs/heads/feature/test'
    })
  })
  
  it('should throw NonRetryableError when branch already exists (400)', async () => {
    configureFetchMock([{
      match: /\/repository\/branches$/,
      response: { 
        status: 400, 
        body: JSON.stringify({ message: 'Branch already exists' })
      }
    }])
    
    const adapter = new GitLabAdapter({ 
      projectId: 'owner/repo', 
      host: 'https://gitlab.com', 
      token: '***', 
      branch: 'main' 
    })
    
    await expect(adapter.createBranch('existing-branch', 'abc123'))
      .rejects.toThrow('Branch \'existing-branch\' already exists')
  })
})
```

### 12.2 統合テスト（test/unit/design/）
```typescript
describe('VirtualFS.createBranch integration', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  it('should create branch from current HEAD when fromRef is not specified', async () => {
    // Setup: リモートツリーとファイル
    const treeJson = [
      { id: 'sha1', name: 'README.md', type: 'blob', path: 'README.md' }
    ]
    
    configureFetchMock([
      { 
        match: /\/repository\/branches\/main$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            name: 'main', 
            commit: { id: 'mainHeadSha' } 
          }) 
        } 
      },
      { 
        match: /repository\/tree/, 
        response: { status: 200, body: JSON.stringify(treeJson) } 
      },
      { 
        match: /repository\/files\/.+?\/raw/, 
        response: { status: 200, body: '# README' } 
      },
      { 
        match: /\/repository\/branches$/, 
        response: { 
          status: 201, 
          body: JSON.stringify({
            name: 'feature/new-branch',
            commit: { id: 'mainHeadSha' },
            protected: false
          })
        } 
      }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await vfs.setAdapter(null, { 
      type: 'gitlab', 
      opts: { 
        projectId: 'owner/repo', 
        host: 'https://gitlab.com', 
        token: '***', 
        branch: 'main' 
      } 
    })
    
    // Initial pull
    await vfs.pull()
    
    // Create branch from current HEAD
    const result = await vfs.createBranch({ name: 'feature/new-branch' })
    
    expect(result).toEqual({
      name: 'feature/new-branch',
      sha: 'mainHeadSha',
      ref: 'refs/heads/feature/new-branch'
    })
  })
  
  it('should create branch from specific SHA', async () => {
    configureFetchMock([
      { 
        match: /\/repository\/branches\/main$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            name: 'main', 
            commit: { id: 'mainHeadSha' } 
          }) 
        } 
      },
      { 
        match: /repository\/tree/, 
        response: { status: 200, body: JSON.stringify([]) } 
      },
      { 
        match: /\/repository\/branches$/, 
        response: { 
          status: 201, 
          body: JSON.stringify({
            name: 'hotfix/from-sha',
            commit: { id: 'specificSha123' },
            protected: false
          })
        } 
      }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await vfs.setAdapter(null, { 
      type: 'gitlab', 
      opts: { 
        projectId: 'owner/repo', 
        host: 'https://gitlab.com', 
        token: '***', 
        branch: 'main' 
      } 
    })
    
    await vfs.pull()
    
    // Create branch from specific SHA
    const result = await vfs.createBranch({ 
      name: 'hotfix/from-sha', 
      fromRef: 'specificSha123' 
    })
    
    expect(result.sha).toBe('specificSha123')
  })
  
  it('should create branch from another branch name', async () => {
    configureFetchMock([
      { 
        match: /\/repository\/branches\/main$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            name: 'main', 
            commit: { id: 'mainHeadSha' } 
          }) 
        } 
      },
      { 
        match: /\/git\/ref\/heads\/develop$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            ref: 'refs/heads/develop',
            object: { sha: 'developSha', type: 'commit' }
          }) 
        } 
      },
      { 
        match: /repository\/tree/, 
        response: { status: 200, body: JSON.stringify([]) } 
      },
      { 
        match: /\/git\/refs$/, 
        response: { 
          status: 201, 
          body: JSON.stringify({
            ref: 'refs/heads/feature/from-develop',
            object: { sha: 'developSha', type: 'commit' }
          })
        } 
      }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await vfs.setAdapter(null, { 
      type: 'github', 
      opts: { 
        repo: 'owner/repo', 
        token: '***', 
        branch: 'main' 
      } 
    })
    
    await vfs.pull()
    
    // Create branch from 'develop' branch
    const result = await vfs.createBranch({ 
      name: 'feature/from-develop', 
      fromRef: 'develop' 
    })
    
    expect(result.sha).toBe('developSha')
  })
  
  it('should throw error when adapter is not set', async () => {
    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await expect(vfs.createBranch({ name: 'feature/test' }))
      .rejects.toThrow('No adapter configured')
  })
  
  it('should throw error when branch already exists', async () => {
    configureFetchMock([
      { 
        match: /\/repository\/branches\/main$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            name: 'main', 
            commit: { id: 'mainHeadSha' } 
          }) 
        } 
      },
      { 
        match: /repository\/tree/, 
        response: { status: 200, body: JSON.stringify([]) } 
      },
      { 
        match: /\/repository\/branches$/, 
        response: { 
          status: 400, 
          body: JSON.stringify({ message: 'Branch already exists' })
        } 
      }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await vfs.setAdapter(null, { 
      type: 'gitlab', 
      opts: { 
        projectId: 'owner/repo', 
        host: 'https://gitlab.com', 
        token: '***', 
        branch: 'main' 
      } 
    })
    
    await vfs.pull()
    
    await expect(vfs.createBranch({ name: 'existing-branch' }))
      .rejects.toThrow('already exists')
  })
  
  it('should verify created branch appears in listBranches()', async () => {
    configureFetchMock([
      { 
        match: /\/repository\/branches\/main$/, 
        response: { 
          status: 200, 
          body: JSON.stringify({ 
            name: 'main', 
            commit: { id: 'mainHeadSha' } 
          }) 
        } 
      },
      { 
        match: /repository\/tree/, 
        response: { status: 200, body: JSON.stringify([]) } 
      },
      { 
        match: /\/repository\/branches$/, 
        response: (url) => {
          if (url.includes('per_page')) {
            // listBranches() call
            return {
              status: 200,
              body: JSON.stringify([
                { name: 'main', commit: { id: 'mainHeadSha' }, protected: false, default: true },
                { name: 'feature/new-branch', commit: { id: 'mainHeadSha' }, protected: false, default: false }
              ])
            }
          } else {
            // createBranch() call
            return {
              status: 201,
              body: JSON.stringify({
                name: 'feature/new-branch',
                commit: { id: 'mainHeadSha' },
                protected: false
              })
            }
          }
        }
      }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    
    await vfs.setAdapter(null, { 
      type: 'gitlab', 
      opts: { 
        projectId: 'owner/repo', 
        host: 'https://gitlab.com', 
        token: '***', 
        branch: 'main' 
      } 
    })
    
    await vfs.pull()
    
    // Create branch
    await vfs.createBranch({ name: 'feature/new-branch' })
    
    // Verify it appears in listBranches()
    const branches = await vfs.listBranches()
    const createdBranch = branches.items.find(b => b.name === 'feature/new-branch')
    
    expect(createdBranch).toBeDefined()
    expect(createdBranch?.name).toBe('feature/new-branch')
    expect(createdBranch?.commit.sha).toBe('mainHeadSha')
  })
})
```

### 12.3 E2Eテスト（test/e2e/）
```typescript
test('create branch from UI', async ({ page }) => {
  await page.goto('http://localhost:8080')
  
  // Setup adapter and pull
  await page.evaluate(async () => {
    await window.vfs.setAdapter(null, {
      type: 'github',
      opts: {
        repo: 'test-owner/test-repo',
        token: '***',
        branch: 'main'
      }
    })
    await window.vfs.pull()
  })
  
  // Create branch via UI
  await page.click('[data-testid="create-branch-button"]')
  await page.fill('[data-testid="branch-name-input"]', 'feature/ui-test')
  await page.click('[data-testid="create-button"]')
  
  // Verify success message
  await expect(page.locator('[data-testid="success-message"]'))
    .toHaveText(/Branch 'feature\/ui-test' created successfully/)
  
  // Verify branch appears in branch list
  await page.click('[data-testid="branch-list-button"]')
  await expect(page.locator('[data-branch="feature/ui-test"]')).toBeVisible()
})
```

## 13. セキュリティ考慮事項
### 13.1 ブランチ名のバリデーション
```typescript
/**
 * ブランチ名の検証ルール
 * - 空文字列禁止
 * - NUL文字（\0）禁止
 * - '..'（パストラバーサル）禁止
 * - スペースのみ禁止
 * - 先頭/末尾のスラッシュ禁止（'/feature' や 'feature/' はNG）
 * - 連続スラッシュ禁止（'feature//test' はNG）
 */
function validateBranchName(name: string): void {
  if (!name || name.trim() === '') {
    throw new Error('Branch name cannot be empty.')
  }
  
  if (name.includes('\0')) {
    throw new Error('Invalid branch name: contains NUL character.')
  }
  
  if (name.includes('..')) {
    throw new Error('Invalid branch name: contains \'..\'.')
  }
  
  if (name.startsWith('/') || name.endsWith('/')) {
    throw new Error('Invalid branch name: cannot start or end with \'/\'.')
  }
  
  if (name.includes('//')) {
    throw new Error('Invalid branch name: contains consecutive slashes.')
  }
}
```

### 13.2 トークン・認証情報の扱い
- トークンはメモリ上でのみ保持（永続化しない）
- エラーメッセージにトークンを含めない
- ログ出力時はトークンをマスク

### 13.3 レート制限対策
- 429エラー時は`Retry-After`ヘッダを尊重
- 指数バックオフで自動リトライ（最大4回）
- ベース遅延: 300ms

## 14. 非機能要件
### 14.1 パフォーマンス
- ブランチ作成APIコール: 1回
- fromRef解決（必要時）: 最大1回の追加APIコール
- 合計APIコール数: 1〜2回

### 14.2 互換性
- Node.js 18以上
- ブラウザ（ES2020以上）
- GitHub API v3
- GitLab API v4

### 14.3 可用性
- 一時的なネットワークエラー: 自動リトライ
- サーバーエラー（5xx）: 自動リトライ
- レート制限（429）: 自動リトライ

## 15. 将来拡張
### 15.1 ローカルブランチ管理
現在は対象外だが、将来的にローカルブランチ概念を導入する場合：
- `OpfsStorage.setBranch()` との連携
- `VirtualFS.checkout()` の実装
- workspace未コミット変更のstash機能

### 15.2 ブランチ削除
```typescript
async deleteBranch(branchName: string, options?: { force?: boolean }): Promise<void>
```

### 15.3 ブランチ保護設定
```typescript
async protectBranch(branchName: string, rules: ProtectionRules): Promise<void>
```

### 15.4 マージ機能
```typescript
async mergeBranch(sourceBranch: string, targetBranch: string): Promise<MergeResult>
```

## 16. 参考資料
### 16.1 API ドキュメント
- [GitHub REST API - Create a reference](https://docs.github.com/rest/git/refs#create-a-reference)
- [GitLab API - Branches](https://docs.gitlab.com/ee/api/branches.html#create-repository-branch)

### 16.2 関連設計書
- [docs/spec/v0.0.4/branch-list-detail-design.md](./branch-list-detail-design.md)
- [docs/spec/v0.0.4/pull-ref-specification-design.md](./pull-ref-specification-design.md)
- [docs/spec/v0.0.4/commit-history-detail-design.md](./commit-history-detail-design.md)

### 16.3 既存実装
- [src/git/abstractAdapter.ts](../../src/git/abstractAdapter.ts)
- [src/git/githubAdapter.ts](../../src/git/githubAdapter.ts)
- [src/git/gitlabAdapter.ts](../../src/git/gitlabAdapter.ts)
- [src/virtualfs/virtualfs.ts](../../src/virtualfs/virtualfs.ts)

## 17. 変更履歴
| 日付 | バージョン | 変更内容 | 作成者 |
|-----|----------|---------|--------|
| 2026-02-03 | 1.0.0 | 初版作成 | GitHub Copilot |

---
**注意**: 本設計書はブランチ作成機能の詳細設計を定義したものであり、実装は別途行う。実装時は本設計書に準拠すること。
