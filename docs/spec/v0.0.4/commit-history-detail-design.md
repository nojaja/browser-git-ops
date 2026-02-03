# コミット履歴参照機能 詳細設計書

## 1. 目的
ブランチの履歴一覧（新→古）を取得し、rebase / cherry-pick / checkout / diff の入口情報として利用する。

## 2. スコープ
- 履歴の取得はリモートAPIから行う。
- 取得対象は「コミット一覧の要約情報（CommitSummary）」。
- 実装は開始しない（設計のみ）。

## 3. 期待する入出力
### 3.1 入力（最小）
- ブランチ/タグ/コミットSHA（例: `main`）
- 1ページあたり件数（`per_page`）
- ページ指定（`page`）

### 3.2 出力（最小モデル）
```ts
export type CommitSummary = {
  sha: string
  message: string
  author: string
  date: string
  parents: string[]
}
```

## 4. 仕様概要
### 4.1 GitHub API
- エンドポイント: `GET /repos/{owner}/{repo}/commits?sha=main&per_page=30&page=1`
- ページング: `Link`ヘッダで`next`/`last`を取得

### 4.2 GitLab API
- エンドポイント: `GET /projects/{projectId}/repository/commits?ref_name=main&per_page=30&page=1`
- ページング: `X-Next-Page`等（GitLab仕様）を利用

### 4.3 取得順
- APIの返却順は「新→古」を維持

## 5. アーキテクチャ配置（設計方針）
### 5.1 層の責務
- Adapter層: プロバイダ差分の吸収・HTTP処理・ページング処理
- VirtualFS層: Adapterへの委譲インターフェース提供
- 型定義: 共有型として集約

### 5.2 追加・拡張先（設計上の配置）
- Adapter契約: [src/git/abstractAdapter.ts](../../src/git/abstractAdapter.ts)
- Adapter実装: [src/git/githubAdapter.ts](../../src/git/githubAdapter.ts), [src/git/gitlabAdapter.ts](../../src/git/gitlabAdapter.ts)
- VirtualFS委譲: [src/virtualfs/virtualfs.ts](../../src/virtualfs/virtualfs.ts)
- 共有型定義: [src/virtualfs/types.ts](../../src/virtualfs/types.ts)
- 公開API: [src/index.ts](../../src/index.ts)

## 6. インターフェース設計
### 6.1 Adapterインターフェース（案）
```ts
export type CommitHistoryQuery = {
  ref: string
  perPage?: number
  page?: number
}

export type CommitHistoryPage = {
  items: CommitSummary[]
  nextPage?: number
  lastPage?: number
}

export interface GitAdapter {
  listCommits(query: CommitHistoryQuery): Promise<CommitHistoryPage>
}
```

### 6.2 VirtualFS API（案）
```ts
export type CommitHistoryQuery = {
  ref: string
  perPage?: number
  page?: number
}

export type CommitHistoryPage = {
  items: CommitSummary[]
  nextPage?: number
  lastPage?: number
}

class VirtualFS {
  async listCommits(query: CommitHistoryQuery): Promise<CommitHistoryPage>
}
```

## 7. マッピング設計（API→モデル）
### 7.1 GitHubレスポンス→CommitSummary
| 取得元 | マッピング先 |
| --- | --- |
| `sha` | `sha` |
| `commit.message` | `message` |
| `commit.author.name` | `author` |
| `commit.author.date` | `date` |
| `parents[].sha` | `parents` |

### 7.2 GitLabレスポンス→CommitSummary
| 取得元 | マッピング先 |
| --- | --- |
| `id` | `sha` |
| `message` | `message` |
| `author_name` | `author` |
| `created_at` | `date` |
| `parent_ids[]` | `parents` |

## 8. ページング仕様
### 8.1 GitHub
- `Link`ヘッダを解析し`rel="next"`/`rel="last"`を抽出
- `nextPage`/`lastPage`に数値を格納

### 8.2 GitLab
- `X-Next-Page`, `X-Total-Pages` を優先利用
- 未提供時は`nextPage`を`undefined`とする

## 9. エラーハンドリング方針
- Adapter層でHTTPステータスを判定
- 4xx/5xxは共通エラー型へ変換
- 401/403は「認証・権限エラー」として区別

## 10. ログ方針
- Adapter層でAPI呼び出しの失敗をログ
- メッセージは日本語

## 11. セキュリティ・ガード
- 入力`ref`はURLエンコード
- パストラバーサル対策不要（ファイルパスを扱わない）

## 12. 影響範囲
- 既存`pull`/`push`の挙動には影響なし
- UI側は新APIに依存して履歴表示を実装可能

## 13. テスト設計（概要）
- Adapter単体テストでHTTPレスポンスのマッピングを検証
- ページング（Link/X-Next-Page）解析の正常系・異常系
- VirtualFSは委譲結果の透過性のみ確認

## 14. 未決事項
- 返却モデルに`email`を含めるか
- `perPage`のデフォルト値（例: 30）
- `listCommits`名称の統一（`getCommitHistory`案との比較）
