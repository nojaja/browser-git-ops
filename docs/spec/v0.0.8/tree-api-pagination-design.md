# Tree API ページネーション対応 詳細設計書

## 1. 目的

- GitLab の `/repository/tree` API がページネーションされたレスポンスを返す問題に対応する。
- 現状の実装ではレスポンスの1ページ目のみを取得しており、20件（GitLab デフォルト）を超えるファイルを持つリポジトリで **pull 時にファイルが欠落する**。
- GitHub の `git/trees` API についても同様の調査を行い、必要に応じて対応する。

## 2. 背景

### 2.1 現状の問題点

GitLabAdapter の `_fetchTreeAndBuildShas` メソッド（`src/git/gitlabAdapter.ts` L464 付近）では、以下のように1回のリクエストのみでツリーを取得している:

```typescript
const treeResponse = await this.fetchWithRetry(
  `${this.baseUrl}/repository/tree?recursive=true&ref=${encodeURIComponent(branch)}`,
  { method: 'GET', headers: this.headers }
)
const treeJ = await treeResponse.json()
const files = Array.isArray(treeJ) ? treeJ.filter((t: any) => t.type === 'blob') : []
```

GitLab の `/repository/tree` API は **デフォルトで `per_page=20`** のページネーションを行うため、ファイルが21件以上のリポジトリでは2ページ目以降のファイルが取得されない。

### 2.2 影響範囲

- `GitLabAdapter.fetchSnapshot()` → `_fetchTreeAndBuildShas()` がツリー一覧を取得する箇所
- `VirtualFS.pull()` → `_fetchSnapshotFromAdapterInstance()` → `adapter.fetchSnapshot()` の流れで呼ばれる
- **ファイルが20件以下のリポジトリでは問題は顕在化しない**

## 3. API 仕様調査

### 3.1 GitLab `/repository/tree` API

**エンドポイント**: `GET /projects/:id/repository/tree`

**参照**: https://docs.gitlab.com/api/repositories/#list-repository-tree

#### パラメータ（ページネーション関連）

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `per_page` | integer | No | 1ページあたりの件数。デフォルト: **20**、最大: **100** |
| `page` | integer | No | ページ番号（1始まり）。デフォルト: 1 |
| `recursive` | boolean | No | `true` で再帰的にツリーを取得 |
| `ref` | string | No | ブランチ名またはタグ名 |
| `pagination` | string | No | `keyset` でキーセットページネーションを有効化 |
| `page_token` | string | No | キーセットページネーション時の次ページトークン |

#### レスポンス形式

レスポンスはツリーエントリの **JSON 配列** を返す:

```json
[
  {
    "id": "a1e8f8d745cc87e3a9248358d9352bb7f9a0aeba",
    "name": "html",
    "type": "tree",
    "path": "files/html",
    "mode": "040000"
  },
  {
    "id": "4535904260b1082e14f867f7a24fd8c21495bde3",
    "name": "images",
    "type": "tree",
    "path": "files/images",
    "mode": "040000"
  }
]
```

#### ページネーション方式

GitLab は2種類のページネーションをサポートする:

##### (A) オフセットベース（デフォルト）

- `page` と `per_page` パラメータで制御
- レスポンスヘッダにページ情報が含まれる

**レスポンスヘッダ**:

| ヘッダ | 説明 |
|---|---|
| `x-next-page` | 次のページ番号（最終ページの場合は空文字） |
| `x-page` | 現在のページ番号 |
| `x-per-page` | 1ページあたりの件数 |
| `x-prev-page` | 前のページ番号 |
| `x-total` | 総件数 |
| `x-total-pages` | 総ページ数 |

**リクエスト例**:
```
GET /api/v4/projects/:id/repository/tree?recursive=true&ref=main&per_page=100&page=1
```

**注意**: GitLab.com では10,000件を超える結果に対して `x-total`、`x-total-pages` ヘッダが返されない。

**注意**: offset pagination には `max offset` の制限があり、大量のレコードに対しては keyset pagination の使用が推奨される。

##### (B) キーセットベース（GitLab 17.1 以降で `/repository/tree` に対応）

- `pagination=keyset` パラメータで有効化
- レスポンスの `Link` ヘッダに次ページの URL が含まれる
- `page_token` パラメータで次ページを指定
- `x-total` / `x-total-pages` ヘッダは返されない

**リクエスト例**:
```
GET /api/v4/projects/:id/repository/tree?recursive=true&ref=main&per_page=100&pagination=keyset
```

**レスポンスヘッダ**:
```http
Link: <https://gitlab.example.com/api/v4/projects/13083/repository/tree?pagination=keyset&per_page=100&page_token=xxxx>; rel="next"
```

**キーセットページネーションの利点**:
- コレクションサイズに依存しない一定のパフォーマンス
- オフセットベースの制限（max offset）を回避

**キーセットページネーションの注意点**:
- GitLab 17.1 以降が必要
- `Link` ヘッダが空の場合（または `rel="next"` がない場合）が最終ページ
- 古い GitLab バージョンではサポートされない可能性がある

#### `Link` ヘッダの形式

```
<https://gitlab.example.com/api/v4/projects/8/issues/8/notes?page=1&per_page=3>; rel="prev",
<https://gitlab.example.com/api/v4/projects/8/issues/8/notes?page=3&per_page=3>; rel="next",
<https://gitlab.example.com/api/v4/projects/8/issues/8/notes?page=1&per_page=3>; rel="first",
<https://gitlab.example.com/api/v4/projects/8/issues/8/notes?page=3&per_page=3>; rel="last"
```

### 3.2 GitHub `git/trees` API

**エンドポイント**: `GET /repos/{owner}/{repo}/git/trees/{tree_sha}`

**参照**: https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#get-a-tree

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `tree_sha` | string | Yes | ツリーの SHA1 値またはブランチ/タグ名 |
| `recursive` | string | No | 任意の値を設定すると再帰的にツリーを取得 |

#### レスポンス形式

レスポンスは単一の JSON オブジェクトで、`tree` 配列にツリーエントリが含まれる:

```json
{
  "sha": "9fb037999f264ba9a7fc6274d15fa3ae2ab98312",
  "url": "https://api.github.com/repos/octocat/Hello-World/trees/9fb037999f264ba9a7fc6274d15fa3ae2ab98312",
  "tree": [
    {
      "path": "file.rb",
      "mode": "100644",
      "type": "blob",
      "size": 30,
      "sha": "44b4fc6d56897b048c772eb4087f854f46256132",
      "url": "https://api.github.com/repos/octocat/Hello-World/git/blobs/44b4fc6d56897b048c772eb4087f854f46256132"
    }
  ],
  "truncated": false
}
```

#### ページネーションの仕組み

**GitHub の `git/trees` API はページネーションパラメータ（`page` / `per_page`）を持たない。**

代わりに以下の仕組みで大規模ツリーに対応する:

- `recursive` パラメータ使用時、`tree` 配列は **最大 100,000 エントリ**、**最大 7MB** の制限がある
- 制限を超えた場合、レスポンスの `truncated` フィールドが **`true`** になる
- `truncated: true` の場合、**非再帰モードで各サブツリーを個別に取得**する必要がある

**GitHub 公式ドキュメントからの引用**:
> If `truncated` is `true` in the response then the number of items in the `tree` array exceeded our maximum limit. If you need to fetch more items, use the non-recursive method of fetching trees, and fetch one sub-tree at a time.

> Note: The limit for the `tree` array is 100,000 entries with a maximum size of 7 MB when using the `recursive` parameter.

### 3.3 API 比較まとめ

| 項目 | GitLab | GitHub |
|---|---|---|
| **エンドポイント** | `GET /projects/:id/repository/tree` | `GET /repos/{owner}/{repo}/git/trees/{sha}` |
| **レスポンス形式** | JSON 配列 | JSON オブジェクト（`tree` 配列を内包） |
| **デフォルト件数** | 20件/ページ | 全件（制限なし、ただしサイズ制限あり） |
| **最大件数 (per_page)** | 100件/ページ | N/A |
| **ページネーション方式** | offset / keyset | なし（`truncated` フラグ） |
| **全件取得の制限** | max offset 制限 | 100,000 エントリ / 7MB |
| **ページ情報** | レスポンスヘッダ | `truncated` フィールド |
| **対応の緊急度** | **高** — 21件以上で欠落 | **低** — 100,000件未満では問題なし |

## 4. 設計方針

### 4.1 GitLab: オフセットベースページネーション対応

キーセットページネーションは GitLab 17.1+ で `/repository/tree` に対応したが、古いバージョンのサポートを考慮して **オフセットベース** を第一選択とする。

#### 理由

1. オフセットベースはすべての GitLab バージョンで動作する
2. ツリー取得は一般的に数千ファイル以内であり、max offset の上限に達することは稀
3. 既存コードの `_parsePagingHeaders` メソッドが `x-next-page` / `x-total-pages` をパースしており、再利用できる
4. キーセットベースは将来のオプションとして考慮する

#### 実装概要

`_fetchTreeAndBuildShas` メソッドを修正し、全ページを取得するまでループする:

```typescript
private async _fetchTreeAndBuildShas(branch: string): Promise<{ shas: Record<string, string>; fileSet: Set<string> }> {
  const allFiles: any[] = []
  let page = 1
  const perPage = 100 // 最大値を指定してリクエスト回数を最小化

  while (true) {
    const url = `${this.baseUrl}/repository/tree?recursive=true&ref=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`
    const treeResponse = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers })
    const treeJ = await treeResponse.json()
    const entries = Array.isArray(treeJ) ? treeJ : []
    allFiles.push(...entries.filter((t: any) => t.type === 'blob'))

    const paging = this._parsePagingHeaders(treeResponse)
    if (!paging.nextPage) break
    page = paging.nextPage
  }

  return this._buildShasAndFileSet(allFiles)
}
```

#### per_page の選定

- `per_page=100` を使用（GitLab の上限値）
- リクエスト回数を最小化しつつ、レスポンスサイズを許容範囲に収める
- 1000ファイルのリポジトリで 10 リクエスト、100ファイルで 1 リクエストに収まる

### 4.2 GitHub: `truncated` フィールドの検知

現状 GitHubAdapter の `_buildFileMapFromHead` では `truncated` フラグを確認していない。
100,000 エントリ / 7MB 以下のリポジトリでは問題にならないが、安全策として以下を実装する:

#### 実装概要

`_buildFileMapFromHead` に `truncated` の検知とワーニングログを追加する:

```typescript
private async _buildFileMapFromHead(headSha: string): Promise<{ shas: Record<string, string>; fileMap: Map<string, any> }> {
  const treeResponse = await this._fetchWithRetry(
    `${this.baseUrl}/git/trees/${headSha}?recursive=1`,
    { method: 'GET', headers: this.headers }, 4, 300
  )
  const treeJ = await treeResponse.json()

  if (treeJ && treeJ.truncated === true) {
    this.logWarn('GitHub tree response was truncated. Some files may be missing. Consider using non-recursive tree fetching for large repositories.')
  }

  const files = (treeJ && treeJ.tree) ? treeJ.tree.filter((t: any) => t.type === 'blob') : []
  // ... existing logic
}
```

**本バージョンでは `truncated: true` の場合のサブツリー再帰取得は実装しない**（スコープ外）。理由:
- 100,000ファイル超のリポジトリは現実的に非常に稀
- サブツリー個別取得の実装は複雑であり、別バージョンで対応する
- ワーニングログにより問題が発生した場合の認知が可能

### 4.3 既存メソッドの再利用

GitLabAdapter の `_parsePagingHeaders` メソッドは既に `x-next-page` / `x-total-pages` をパースしており、ツリーページネーションにそのまま再利用できる:

```typescript
private _parsePagingHeaders(resp: Response): { nextPage?: number; lastPage?: number } {
  const out: { nextPage?: number; lastPage?: number } = {}
  try {
    const hdrNext = resp?.headers?.get('x-next-page')
    const hdrTotal = resp?.headers?.get('x-total-pages')
    if (hdrNext) out.nextPage = Number(hdrNext)
    if (hdrTotal) out.lastPage = Number(hdrTotal)
  } catch (error) { /* ... */ }
  return out
}
```

## 5. 変更対象ファイルと影響範囲

### 5.1 変更対象

| ファイル | メソッド | 変更内容 |
|---|---|---|
| `src/git/gitlabAdapter.ts` | `_fetchTreeAndBuildShas` | ページネーションループの追加 |
| `src/git/githubAdapter.ts` | `_buildFileMapFromHead` | `truncated` フラグの検知・ワーニング追加 |

### 5.2 影響を受ける呼び出しチェーン

```
VirtualFS.pull()
  → _fetchSnapshotFromAdapterInstance()
    → adapter.fetchSnapshot(branch)
      → [GitLab] _determineHeadSha(branch) + _fetchTreeAndBuildShas(branch) ← ★変更箇所
      → [GitHub] _determineHeadSha(branch) + _buildFileMapFromHead(headSha) ← ★変更箇所
```

### 5.3 変更しないファイル

- `src/git/adapter.ts` — インターフェース変更なし
- `src/git/abstractAdapter.ts` — 共通ロジック変更なし
- `src/virtualfs/virtualfs.ts` — pull フロー変更なし
- `src/virtualfs/remoteSynchronizer.ts` — 変更なし

## 6. テスト計画

### 6.1 単体テスト（GitLabAdapter）

| テストケース | 説明 | 確認ポイント |
|---|---|---|
| 1ページ分のレスポンス | ファイル数 ≤ 100 件 | 1回のリクエストで全件取得、`x-next-page` 空 |
| 複数ページのレスポンス | ファイル数 > 100 件（2ページ） | 2回リクエストし、結果をマージ |
| 3ページ以上のレスポンス | ファイル数 > 200 件（3ページ） | 3回リクエストし、結果をマージ |
| 空レスポンス | ファイル数 0 件 | 空の shas/fileSet を返す |
| `x-next-page` ヘッダなし | ヘッダが存在しない場合 | 1ページで停止 |
| tree + blob 混在 | `type: "tree"` と `type: "blob"` | blob のみが fileSet に含まれる |
| ページネーション中のエラー | 2ページ目で HTTP エラー | RetryExhaustedError がスローされる |

### 6.2 単体テスト（GitHubAdapter）

| テストケース | 説明 | 確認ポイント |
|---|---|---|
| `truncated: false` | 通常のレスポンス | 既存動作と同一であること |
| `truncated: true` | 大規模リポジトリ | ワーニングログが出力され、取得分のファイルは返されること |
| `truncated` 未定義 | フィールドなし（旧 API 互換） | 既存動作と同一であること |

### 6.3 テストファイル配置

```
test/unit/v0.0.8/
  gitlabAdapter.treePagination.test.ts
  githubAdapter.treeTruncated.test.ts
```

## 7. 確認ポイント・チェックリスト

### 7.1 実装時の確認事項

- [ ] `_fetchTreeAndBuildShas` のループで無限ループが発生しないこと（`x-next-page` が空または `0` でループ終了）
- [ ] `per_page=100` がクエリパラメータとして正しくエンコードされること
- [ ] `_parsePagingHeaders` が `x-next-page` の空文字列を `nextPage: undefined` として返すこと（Number('') は 0 となりフォールバックが必要）
- [ ] `_parsePagingHeaders` で `x-next-page` が `"0"` や空文字の場合の挙動を確認（`Number('')` → `0`、`Number('0')` → `0`）
- [ ] GitHub の `truncated` フィールドが `boolean` 型であること（文字列ではない）
- [ ] 既存の `listCommits` / `listBranches` のページネーション処理に影響がないこと
- [ ] `fetchWithRetry` のリトライ挙動がページネーションループ内で正しく動作すること

### 7.2 `_parsePagingHeaders` の注意点

現在の `_parsePagingHeaders` 実装での要注意箇所:

```typescript
if (hdrNext) out.nextPage = Number(hdrNext)
```

- `hdrNext` が **空文字列 `""`** の場合: `if ("")` は falsy → `nextPage` は設定されない → **OK**
- `hdrNext` が **`"0"`** の場合: `if ("0")` は truthy → `Number("0")` → `nextPage = 0` → **ループ条件 `!paging.nextPage` が true（0 は falsy）→ OK**
- `hdrNext` が **`"3"`** の場合: `if ("3")` は truthy → `Number("3")` → `nextPage = 3` → **ループ継続 → OK**

**結論**: 既存の `_parsePagingHeaders` はそのまま再利用可能。

### 7.3 パフォーマンス考慮事項

- `per_page=100` でリクエスト数を最小化
- 各ページのレスポンスを `allFiles` 配列に `push` で蓄積（メモリ効率）
- 一般的なリポジトリ（数百〜数千ファイル）では 1〜数十リクエストで完了
- **非常に大規模なリポジトリ**（10万ファイル超）の場合は GitLab の max offset 制限に注意（将来的にキーセットページネーションへの移行を検討）

### 7.4 後方互換性

- GitLab API の `per_page` / `page` パラメータはすべてのバージョンでサポートされている
- レスポンスヘッダ `x-next-page` / `x-total-pages` は標準的なページネーションヘッダ
- `per_page` を明示的に指定しない場合のデフォルト値（20）が変わらない前提

## 8. 将来の拡張

### 8.1 GitLab キーセットページネーション対応

GitLab 17.1+ では `/repository/tree` に対してキーセットページネーションが利用可能:

```
GET /api/v4/projects/:id/repository/tree?pagination=keyset&per_page=100&recursive=true&ref=main
```

利点:
- コレクションサイズに依存しない一定のパフォーマンス
- max offset の制限を回避
- GitLab 公式が推奨する方式

対応方針（将来バージョン）:
- コンストラクタオプションまたは自動検知で keyset / offset を切り替え
- `Link` ヘッダの `rel="next"` から次ページ URL を取得

### 8.2 GitHub `truncated` 対応（サブツリー再帰取得）

`truncated: true` の場合に非再帰モードでルートツリーを取得し、各サブツリーを再帰的に個別取得する:

```
GET /repos/{owner}/{repo}/git/trees/{sha}          # ルート（非再帰）
GET /repos/{owner}/{repo}/git/trees/{subtree_sha}   # 各サブツリー
```

対応方針（将来バージョン）:
- `truncated: true` を検知した場合にフォールバック処理を実行
- サブツリーごとに並列リクエスト（`mapWithConcurrency` を利用）

## 9. 参考資料

- GitLab Repository Tree API: https://docs.gitlab.com/api/repositories/#list-repository-tree
- GitLab REST API Pagination: https://docs.gitlab.com/api/rest/#pagination
- GitHub Get a Tree API: https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28#get-a-tree
- 既存設計書: `docs/spec/v0.0.4/ondemand-fetching-detail-design.md`
