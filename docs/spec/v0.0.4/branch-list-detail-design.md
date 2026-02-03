# ブランチ一覧取得機能 詳細設計書

## 1. 目的
リモートリポジトリのブランチ一覧を取得し、ブランチ切り替え・マージ・比較等の入口情報として利用する。

## 2. スコープ
- ブランチ一覧の取得はリモートAPIから行う。
- 取得対象は「ブランチの要約情報（BranchInfo）」。
- デフォルトブランチ判定のためのリポジトリメタデータ取得を含む。
- 実装は開始しない（設計のみ）。

## 3. 期待する入出力
### 3.1 入力（最小）
- 1ページあたり件数（`perPage`）
- ページ指定（`page`）

### 3.2 出力（最小モデル）
```ts
export type BranchInfo = {
  name: string              // ブランチ名（例: 'main', 'develop'）
  commit: {
    sha: string            // ブランチHEADのコミットSHA
    url: string            // コミットのAPI URL
  }
  protected: boolean       // 保護ブランチか
  isDefault: boolean       // デフォルトブランチか
}

export type BranchListQuery = {
  perPage?: number         // 1ページあたり件数（デフォルト: 30）
  page?: number            // ページ番号（デフォルト: 1）
}

export type BranchListPage = {
  items: BranchInfo[]      // ブランチ情報の配列
  nextPage?: number        // 次ページ番号（存在しない場合はundefined）
  lastPage?: number        // 最終ページ番号（存在しない場合はundefined）
}

export type RepositoryMetadata = {
  defaultBranch: string    // デフォルトブランチ名（例: 'main'）
  name: string             // リポジトリ名
  id?: string | number     // リポジトリID（GitLab用）
}
```

## 4. 仕様概要
### 4.1 GitHub API
#### 4.1.1 ブランチ一覧取得
- エンドポイント: `GET /repos/{owner}/{repo}/branches?per_page=30&page=1`
- ページング: `Link`ヘッダで`next`/`last`を取得

#### 4.1.2 リポジトリメタデータ取得
- エンドポイント: `GET /repos/{owner}/{repo}`
- 取得目的: `default_branch`フィールドからデフォルトブランチ名を取得

### 4.2 GitLab API
#### 4.2.1 ブランチ一覧取得
- エンドポイント: `GET /projects/{projectId}/repository/branches?per_page=30&page=1`
- ページング: `X-Next-Page`, `X-Total-Pages`ヘッダを利用

#### 4.2.2 プロジェクトメタデータ取得
- エンドポイント: `GET /projects/{projectId}`
- 取得目的: `default_branch`フィールドからデフォルトブランチ名を取得

### 4.3 取得順
- APIの返却順はアルファベット順等の実装依存（GitHub/GitLabの仕様に準拠）

## 5. アーキテクチャ配置（設計方針）
### 5.1 層の責務
- Adapter層: プロバイダ差分の吸収・HTTP処理・ページング処理・デフォルトブランチ判定
- VirtualFS層: Adapterへの委譲インターフェース提供・メタデータキャッシュ管理
- 型定義: 共有型として集約

### 5.2 追加・拡張先（設計上の配置）
- Adapter契約: [src/git/adapter.ts](../../src/git/adapter.ts)
- Adapter実装: [src/git/githubAdapter.ts](../../src/git/githubAdapter.ts), [src/git/gitlabAdapter.ts](../../src/git/gitlabAdapter.ts)
- VirtualFS委譲: [src/virtualfs/virtualfs.ts](../../src/virtualfs/virtualfs.ts)
- 共有型定義: [src/virtualfs/types.ts](../../src/virtualfs/types.ts)
- 公開API: [src/index.ts](../../src/index.ts)

## 6. インターフェース設計
### 6.1 Adapterインターフェース（案）
```ts
export type BranchInfo = {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
  isDefault: boolean
}

export type BranchListQuery = {
  perPage?: number
  page?: number
}

export type BranchListPage = {
  items: BranchInfo[]
  nextPage?: number
  lastPage?: number
}

export type RepositoryMetadata = {
  defaultBranch: string
  name: string
  id?: string | number
}

export interface GitAdapter {
  // 既存メソッド...
  listCommits?(query: CommitHistoryQuery): Promise<CommitHistoryPage>
  
  // 新規追加メソッド
  listBranches?(query?: BranchListQuery): Promise<BranchListPage>
  getRepositoryMetadata?(): Promise<RepositoryMetadata>
}
```

### 6.2 VirtualFS API（案）
```ts
class VirtualFS {
  // 既存メソッド...
  async listCommits(query: CommitHistoryQuery): Promise<CommitHistoryPage>
  
  // 新規追加メソッド
  async listBranches(query?: BranchListQuery): Promise<BranchListPage>
  async getDefaultBranch(): Promise<string | null>
}
```

## 7. マッピング設計（API→モデル）
### 7.1 GitHubレスポンス→BranchInfo
#### 7.1.1 ブランチ一覧（GET /repos/{owner}/{repo}/branches）
| 取得元 | マッピング先 |
| --- | --- |
| `name` | `name` |
| `commit.sha` | `commit.sha` |
| `commit.url` | `commit.url` |
| `protected` | `protected` |
| `name` と `defaultBranch` の比較 | `isDefault` |

#### 7.1.2 リポジトリメタデータ（GET /repos/{owner}/{repo}）
| 取得元 | マッピング先 |
| --- | --- |
| `default_branch` | `defaultBranch` |
| `name` | `name` |
| `id` | `id` |

### 7.2 GitLabレスポンス→BranchInfo
#### 7.2.1 ブランチ一覧（GET /projects/{projectId}/repository/branches）
| 取得元 | マッピング先 |
| --- | --- |
| `name` | `name` |
| `commit.id` | `commit.sha` |
| `commit.web_url` | `commit.url` |
| `protected` | `protected` |
| `name` と `defaultBranch` の比較 | `isDefault` |

#### 7.2.2 プロジェクトメタデータ（GET /projects/{projectId}）
| 取得元 | マッピング先 |
| --- | --- |
| `default_branch` | `defaultBranch` |
| `name` | `name` |
| `id` | `id` |

## 8. ページング仕様
### 8.1 GitHub
- `Link`ヘッダを既存メソッド`_parseLinkHeaderString()`で解析
- `rel="next"`から`nextPage`を抽出
- `rel="last"`から`lastPage`を抽出

### 8.2 GitLab
- 既存メソッド`_parsePagingHeaders()`でヘッダ解析
- `X-Next-Page`から`nextPage`を抽出
- `X-Total-Pages`から`lastPage`を抽出
- 未提供時は`nextPage`/`lastPage`を`undefined`とする

### 8.3 ページング全件取得ヘルパー
- **対象外**: 初期実装では考慮しない
- 将来拡張として`listAllBranches()`等の実装を検討可能

## 9. デフォルトブランチ判定仕様
### 9.1 取得フロー
1. `getRepositoryMetadata()`を呼び出してデフォルトブランチ名を取得
2. 取得した`defaultBranch`をAdapter層のインスタンス変数にキャッシュ
3. `listBranches()`内で各ブランチ名と`defaultBranch`を比較し、`isDefault`フラグを設定

### 9.2 キャッシング戦略（Adapter層）
- `getRepositoryMetadata()`初回呼び出し時にメタデータを取得
- 結果を`private repoMetadata: RepositoryMetadata | null`に格納
- 2回目以降はキャッシュを返却（追加のHTTPリクエストなし）

### 9.3 エラー時のフォールバック
- `getRepositoryMetadata()`が失敗した場合、`defaultBranch`を`'main'`とする
- エラーはログ出力し、処理は継続
- `isDefault`判定は`'main'`を基準に実施

## 10. メタデータキャッシュ戦略
### 10.1 VirtualFS層でのキャッシュ
- `getRepositoryMetadata()`で取得したメタデータを`IndexFile`の`adapter.opts`に保存
- 保存フィールド: `adapter.opts.defaultBranch`, `adapter.opts.repositoryName`, `adapter.opts.repositoryId`

### 10.2 キャッシュの利用
- VirtualFS初期化時に`IndexFile`から読み込み
- Adapterインスタンス生成時に`opts`として渡す
- Adapter側でキャッシュ値があればそれを優先利用（追加リクエスト抑制）

### 10.3 キャッシュの更新タイミング
- `getRepositoryMetadata()`が明示的に呼び出された場合のみ更新
- VirtualFS起動時の自動更新は行わない（リモート変更検知は将来拡張）

### 10.4 キャッシュの無効化
- ユーザーが明示的に`getRepositoryMetadata(force: true)`を呼び出した場合（将来拡張）
- IndexFileの手動削除時は自動的に再取得

## 11. エラーハンドリング方針
### 11.1 Adapter層
- HTTPステータスを判定し、4xx/5xxを適切にハンドリング
- 401/403は「認証・権限エラー」として明示
- `getRepositoryMetadata()`失敗時は`defaultBranch: 'main'`をフォールバック値として設定

### 11.2 VirtualFS層
- Adapter非対応の場合は`Error('Adapter instance not available or does not support listBranches')`をthrow
- 委譲先のエラーはそのまま伝搬

## 12. ログ方針
### 12.1 Adapter層
- API呼び出しの失敗をログ出力（日本語メッセージ）
- デフォルトブランチ取得失敗時のフォールバック利用をログ出力
- 例: `「リポジトリメタデータの取得に失敗しました。デフォルトブランチを'main'として扱います」`

### 12.2 VirtualFS層
- 委譲のみのためログ不要（Adapter層に委譲）

## 13. セキュリティ・ガード
### 13.1 入力検証
- `perPage`, `page`は正の整数のみ許容（負数・0・小数はバリデーション）
- ブランチ名のURLエンコードは不要（一覧取得APIはクエリパラメータを使用しない）

### 13.2 パストラバーサル対策
- 不要（ファイルパスを扱わない）

## 14. 影響範囲
### 14.1 既存機能への影響
- 既存の`pull`/`push`/`listCommits`の挙動には影響なし
- 新規オプショナルメソッドのため、後方互換性を保持

### 14.2 新規機能の利用
- UI側は新APIに依存してブランチ一覧表示を実装可能
- ブランチ切り替え・マージ・比較機能の前提条件として利用可能

## 15. テスト設計（概要）
### 15.1 Adapter単体テスト
#### 15.1.1 `listBranches()`
- HTTPレスポンスのマッピング検証（GitHub/GitLab）
- ページング（Link/X-Next-Page）解析の正常系・異常系
- `protected`フィールドの正しいマッピング
- `isDefault`フラグの正しい判定（デフォルトブランチ名との比較）
- クエリパラメータ（`perPage`, `page`）の正しい送信

#### 15.1.2 `getRepositoryMetadata()`
- HTTPレスポンスのマッピング検証（GitHub/GitLab）
- キャッシング動作の検証（2回目呼び出しで追加リクエストなし）
- エラー時のフォールバック動作（`defaultBranch: 'main'`）

### 15.2 VirtualFS統合テスト
- Adapter委譲の透過性確認
- `getDefaultBranch()`が正しくAdapterから取得した値を返すか
- Adapter非対応時のエラーハンドリング

### 15.3 動作テスト（Behavior Tests）
- 実際のGitHub/GitLab APIを使用した動作確認
- ページネーションの動作確認（複数ページの取得）
- デフォルトブランチ判定の動作確認

## 16. 未決事項
### 16.1 型定義の配置
- `BranchInfo`/`BranchListQuery`/`BranchListPage`を`src/virtualfs/types.ts`に配置するか、`src/git/adapter.ts`に配置するか
- 推奨: `src/virtualfs/types.ts`（`CommitSummary`等の既存パターンに合わせる）

### 16.2 デフォルト値
- `perPage`のデフォルト値を30とするか、100とするか
- 推奨: 30（`listCommits()`と統一）

### 16.3 メソッド名称
- `listBranches`で統一するか、`getBranches`案との比較
- 推奨: `listBranches`（`listCommits()`と統一）

### 16.4 将来拡張
- ブランチ作成（`createBranch()`）
- ブランチ削除（`deleteBranch()`）
- ブランチ切り替え（`checkoutBranch()`）
- これらは本設計の対象外とし、将来拡張として検討
