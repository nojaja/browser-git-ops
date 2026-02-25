# setAdapter に `branch` を追加する詳細設計書

作成日: 2026-02-25

## **目的**
- `setAdapter` API に `branch` を追加し、どの呼び出し方法でも `indexManager` に保存される接続情報が同一の構造になるようにする。
- `branch` を省略した場合は `main` をデフォルト値として設定する。

## **要件（ユーザ要求）**
- 既存の `setAdapter` 呼び出しシグネチャを以下のように変更する。
  - `setAdapter(meta: AdapterMeta)` → `setAdapter(meta: AdapterMeta)` （`AdapterMeta` に `branch` 追加）
  - `setAdapter(type: string, url: string, token?: string)` → `setAdapter(type: string, url: string, branch?: string, token?: string)`
  - `setAdapter(url: string)` → `setAdapter(url: string, branch?: string, token?: string)`
- `branch` を省略した場合は `main` を使う。
- `setAdapter` のいずれの呼び出し方法でも、`indexManager` に保存する接続情報は同じ構造であること。

## **保存されるデータ構造（indexManager に入る形）**
保存形式は必ず次の形にする：

```json
{
  "adapter": {
    "type": "github|gitlab|selfhost|...",
    "url": "https://.../owner/repo.git",
    "branch": "main",
    "token": "...", 
    "opts": {
      "host": "github.com",
      "owner": "owner",
      "projectId": "projectId-or-empty",
      "repo": "repo"
    }
  }
}
```

- 備考：`url` にはリポジトリ（リソース）を指す標準化された URL を格納し、`branch` は別フィールドに保持する。

## **API シグネチャ（新）**
- TypeScript 風に表現すると：

```ts
type AdapterMeta = {
  type: string;
  url?: string; // 省略可能（optsから生成できる）
  branch?: string; // 省略時は 'main'
  token?: string;
  opts?: {
    host?: string;
    owner?: string;
    projectId?: string;
    repo?: string;
    [k: string]: any;
  };
};

// オーバーロード
function setAdapter(meta: AdapterMeta): void;
function setAdapter(type: string, url: string, branch?: string, token?: string): void;
function setAdapter(url: string, branch?: string, token?: string): void;

// 実装上は共通の内部ハンドラに集約する
function setAdapterInternal(normalized: AdapterMeta): void;
```

## **正規化ルール**
1. 呼び出しごとに `AdapterMeta` 相当の正規化オブジェクトを作成する。
   - `branch` が未指定なら `'main'` をセットする。
   - `token` が未指定なら `undefined` のまま保存する。
2. `url` が与えられている場合は `parseAdapterFromUrl(url)` を使い `type` と `opts` を抽出する。
3. `opts` のみが与えられている場合は `buildUrlFromAdapterOpts(opts)` を使い `url` を生成する。
4. 明示的な値（引数や `meta` オブジェクト）を優先し、URL 解析結果で補完する。優先順位は以下の通り：
   - 明示的な `branch` 引数 / `meta.branch` があればそれを使う。
   - それ以外は URL にブランチ情報が含まれている場合はそれを使う（ただし URL のブランチ構文をサポートする場合のみ）。
   - 最終的に未定義なら `main` をセットする。

## **parseAdapterFromUrl の仕様**
- 入力: repository を指す URL（例: `https://github.com/owner/repo`、`git@gitlab.example.com:owner/repo.git`、自己ホストのパターン）
- 出力: `AdapterMeta.opts` のベースになるオブジェクト（`host`, `owner`, `projectId`, `repo` 等）と `type` を返す。
- 期待される解析例（非網羅）:
  - GitHub: `https://github.com/owner/repo` → `{ type: 'github', opts:{ host:'github.com', owner:'owner', repo:'repo' } }`
  - GitLab (SaaS): `https://gitlab.com/group/subgroup/project` → `{ type: 'gitlab', opts:{ host:'gitlab.com', owner:'group/subgroup', repo:'project' } }`
  - Self-host (Azure DevOps / other): パターン毎に正規化する（実装時に既存パーサを拡張）

## **buildUrlFromAdapterOpts の仕様**
- 入力: `opts`（上のキーを含む）と `type`。
- 出力: canonical な `url`（リポジトリ URL）。
- 注意点:
  - ホスト名、owner、repo などを組み合わせて、既存実装と整合する URL を生成する。
  - `type` ごとに URL 生成ルールを定義する（GitHub, GitLab, SelfHost で異なる）。
  - `url` は branch を含めない（branch は別フィールドで管理）。

## **優先順位（入力の衝突時）**
- `AdapterMeta`（オブジェクト）で渡された明示値が最優先。
- `type/url/branch/token` が引数で渡された場合はそれらを優先。
- URL の解析結果は、明示値がない場合にのみ補完に使う。

## **例（期待される正規化結果）**

1) `setAdapter({ type:'github', opts:{ host:'github.com', owner:'octocat', repo:'Hello-World' }, branch:'develop' })`

正規化後:

```json
{
  "type":"github",
  "url":"https://github.com/octocat/Hello-World",
  "branch":"develop",
  "token":null,
  "opts":{"host":"github.com","owner":"octocat","repo":"Hello-World"}
}
```

2) `setAdapter('github', 'https://github.com/octocat/Hello-World', undefined, 'TOKEN123')`

正規化後（branchが未指定なので`main`）:

```json
{
  "type":"github",
  "url":"https://github.com/octocat/Hello-World",
  "branch":"main",
  "token":"TOKEN123",
  "opts":{"host":"github.com","owner":"octocat","repo":"Hello-World"}
}
```

3) `setAdapter('https://gitlab.example.com/group/project', 'feature/xyz')`（URL + branch）

正規化後:

```json
{
  "type":"gitlab",
  "url":"https://gitlab.example.com/group/project",
  "branch":"feature/xyz",
  "token":null,
  "opts":{"host":"gitlab.example.com","owner":"group","repo":"project"}
}
```

## **テストケース（設計段階で定義）**
- 要件で指定された主要チェック項目を含める。

- 1) `setAdapter(meta: AdapterMeta)` で値をセットし、`getAdapter` が意図した `url` を返すか（github/gitlab/selfhost の 3 パターン）
  - 準備: `meta` に `type` と `opts` を与え `branch`、`token` を与える/省略するケース
  - 検証: `getAdapter()` で返るオブジェクトの `adapter.url` が期待通りであること

- 2) `setAdapter(type: string, url: string, branch?: string, token?: string)` でセットして `getAdapter` が期待する `AdapterMeta` を返すか
  - `branch` 指定あり/なし、`token` 指定あり/なしで確認

- 3) `getAdapter` 時に `branch` と `token` が期待する階層（`adapter.branch`, `adapter.token`）に存在しているか

- 4) `setAdapter` で `branch` を指定しなかった場合に `getAdapter` で `main` が取得できるか

- 追加テスト（エッジ）:
  - URL に余計なスラッシュや `.git` が付いている場合の正規化
  - `opts` から `url` を生成するケース（`buildUrlFromAdapterOpts` の検証）
  - `branch` にスラッシュや特殊文字が含まれるケース（許容ルール）
  - 優先順位テスト：`meta.opts` と `url` の矛盾がある場合、どちらを使うか

テストファイル例（設計段階の提案）:
- `test/unit/behavior/v0.0.8/setAdapter-branch.behavior.test.ts` — 振る舞いテスト（既存ファイルに追加）
- `test/unit/git/adapter.setAdapter.spec.ts` — 単体での正規化ロジックテスト

各テストは `setAdapter(...)` → `getAdapter()` の流れでアサーションを行う。

## **実装時の注意点 / 確認ポイント**
- 既存コードの影響範囲を確認するファイル（実装段で検討）：
  - `src/git/adapter.ts`
  - `src/git/abstractAdapter.ts`
  - `src/git/githubAdapter.ts`
  - `src/git/gitlabAdapter.ts`
  - `src/virtualfs/indexManager.ts`（保存ロジック）

- 変更は以下の観点で最小限に留める。
  - 外部公開 API の互換性（オーバーロードを維持）
  - 内部での正規化ロジックを一箇所に集約 (`setAdapterInternal` のような) してテストしやすくする

- `parseAdapterFromUrl` / `buildUrlFromAdapterOpts` は既存のパーサ/ビルダを拡張する。既存挙動（特に self-host パターン）のテストを必ず実行する。

- `branch` のデフォルト値は保存時点で決定し、常に `indexManager` に書き込む（`getAdapter()` は保存された値を返す）。

- トークンの取り扱い: セキュリティ面の考慮からテストではトークンはダミー文字列を使用し、ログ/例外にはトークンを出力しない。

## **移行 / 互換性**
- 既存の保存済みデータに `branch` がない場合の読み取り処理:
  - `getAdapter()` 実行時に `adapter.branch` が未定義であれば `main` を返すか、または初回再保存で `main` を補完する方針を決める。
  - 実装フェーズで決めるオプション：読み取り時のみ補完 vs 保存時に永続化してしまう。

## **実装タスク（次フェーズ、概要）**
1. 正規化ユーティリティの追加/拡張：`parseAdapterFromUrl`, `buildUrlFromAdapterOpts`
2. `setAdapter` のオーバーロード処理を `setAdapterInternal` に統合
3. `indexManager` の保存ロジック確認・単体テスト追加
4. 既存テストの修正/追加（上記 テストケース を反映）

## **確認チェックリスト（実装前に必ず確認）**
- [ ] 上記シグネチャとオーバーロードが TypeScript 定義に反映可能か
- [ ] `parseAdapterFromUrl` が現在の URL パターンを全てカバーするか（github/gitlab/selfhost）
- [ ] `buildUrlFromAdapterOpts` の出力フォーマットが既存コードと整合するか
- [ ] デフォルト `branch` を `main` にする影響範囲の確認
- [ ] テストの雛形が作成済みであること

---

以上が設計書（詳細）案です。修正点や追加で盛り込みたい例があれば指示ください。実装はこの設計書承認後に進めます。
