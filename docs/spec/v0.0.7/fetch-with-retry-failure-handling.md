# Fetch-with-retry Failure Handling

## Purpose

この設計書は、リポジトリ内で`fetchWithRetry`を繰り返し呼び出す処理において、ある呼び出しがリトライ上限に達して失敗した場合に、以降の`fetchWithRetry`呼び出しを行わずに例外を発生させて処理全体を中断するための詳細設計を定義します。実装はこの設計書承認後に行います。

## 背景

現状、`gitlabAdapter.ts`などで複数の`fetchWithRetry`が順次または並列に実行されます。途中の一つがリトライ上限で失敗しても他の呼び出しが続行されると、部分的な副作用（不完全なコミット、欠損データ等）や不要なAPI呼び出しが発生する恐れがあります。本設計はその防止を目的とします。

## 要求（必須）

- ある`fetchWithRetry`呼び出しが「リトライ上限到達による失敗」（以降 `RetryExhausted` と呼ぶ）を検出した場合、同一の高位処理（同一ユースケース実行単位）で実行中または以降に予定されている他の`fetchWithRetry`呼び出しを行わず、直ちに例外を発生させて処理全体を中断すること。
- シーケンシャル実行の場合は即時中断し、戻り値としてエラーを伝播すること。
- 並列/同時実行（mapWithConcurrency 等）では、1つの`RetryExhausted`が発生した時点で残りの未開始タスクは起動せず、既に開始済みの他タスクは可能な範囲で中止または最終的に破棄され、最終的に`RetryExhausted`エラーを上位に返すこと。
- `RetryExhausted` を示すエラーは、識別可能な形（エラー名または`code`プロパティ）で提供すること。具体的には `name: 'RetryExhaustedError'` もしくは `code: 'RETRY_EXHAUSTED'` を含める。

## 非要求（除外）

- ここでは `fetchWithRetry` の内部アルゴリズム（バックオフ戦略、リトライ回数）の変更は扱わない。挙動は既存の`fetchWithRetry`に依存する。
- 完全な中断のためのOSレベルの強制終了は対象外。

## 用語

- 高位処理（unit-of-work）: あるAPI操作を完了するための呼び出しシーケンス（例: `createCommitWithActions` の実行）。
- RetryExhausted: `fetchWithRetry` が内部リトライ回数を使い果たして失敗した状態。

## 設計方針（概要）

1. `fetchWithRetry` が `RetryExhausted` を検出したら、明示的なエラーオブジェクト（`RetryExhaustedError`）を throw する。
2. `fetchWithRetry` を複数回呼ぶ高位関数（順次・並列の両方）は、`RetryExhaustedError` を捕捉せずにそのまま上位へ伝播させる（特別な処理を行わず即時中断させる）。
3. 並列実行ユーティリティ（`mapWithConcurrency` 等）は、内部で共有キャンセル機構（共有フラグまたは`AbortController`）をサポートし、いずれかのタスクが `RetryExhaustedError` を投げたときに残りのタスクを開始しない・可能なら実行中のタスクへ中止要求を送ることで早期終了を目指す。
4. エラーの識別可能性を担保するため、`RetryExhaustedError` は少なくとも以下を持つ:
   - `name: 'RetryExhaustedError'`
   - `message: string`
   - `code?: 'RETRY_EXHAUSTED'`
   - 必要なら元の `Response`/`Error` を `cause` に格納

## 具体的な振る舞い（順次呼び出し）

例: 以下は擬似シーケンス

1. A = await fetchWithRetry(urlA)
2. B = await fetchWithRetry(urlB)

挙動: もし step 1 の `fetchWithRetry(urlA)` が `RetryExhaustedError` を throw した場合、step 2 は実行されず、そのエラーが呼び出し元へ伝播する。

理由: 不要なAPI呼び出しの抑止、部分的成功による不整合防止。

## 具体的な振る舞い（並列 / mapWithConcurrency）

前提: `mapWithConcurrency(items, fn, concurrency)` の内部で `fn` が `fetchWithRetry` を呼ぶケース。

要求振る舞い:

- いずれかの `fn` 実行で `RetryExhaustedError` が発生した場合、次の措置を取る。
  - 未開始のタスクは起動しない。
  - 実行中タスクへは可能ならキャンセルリクエストを送る（`AbortController` を受け渡す設計推奨）。
  - `mapWithConcurrency` は最終的に `RetryExhaustedError` を throw する（もしくは reject する Promise を返す）。

注意点: JavaScript の Promise には組込みのキャンセルが無いため、完全即時停止は難しい。よって実装では「短期的に実行中タスクは最後まで走るが、結果は破棄して最終的に `RetryExhaustedError` を返す」か、「`AbortSignal` を使い、fetch が中止できる場合は中止する」方針のいずれかを採用する。

## エラー仕様

- `RetryExhaustedError` の型（例）:

```ts
class RetryExhaustedError extends Error {
  name = 'RetryExhaustedError'
  code = 'RETRY_EXHAUSTED'
  constructor(message: string, public cause?: any) { super(message) }
}
```

- 呼び出し側は `instanceof RetryExhaustedError` または `err.code === 'RETRY_EXHAUSTED'` で判別可能とする。

## API / 実装インタフェース（設計時の指針）

- `fetchWithRetry(input, init, maxAttempts?, backoffMs?)` は既存サインを出来るだけ尊重しつつ、`RetryExhaustedError` を投げること。
- 可能なら `fetchWithRetry` へ `AbortSignal` を透過し、外部の `AbortController` で中止できる設計を推奨。
- `mapWithConcurrency` はオプション引数で `AbortController` または `signal` を受け取り、共有キャンセルをサポートする。

## テストケース（必須）

1. 順次実行: 最初の `fetchWithRetry` が `RetryExhausted` の場合、以降の `fetchWithRetry` は呼ばれない。最終的に `RetryExhaustedError` が返る/throwされる。
2. 並列実行: N 個のタスクを `mapWithConcurrency` で実行し、そのうち1つが `RetryExhausted` を返した場合、`mapWithConcurrency` は `RetryExhaustedError` で失敗する。未開始タスクは起動しない。
3. 並列実行 with AbortSignal: `AbortController` を用いた場合、1 つの `RetryExhausted` 発生時に `AbortController.abort()` が呼ばれることを確認し、fetch が中止される挙動を検証する（fetch が `AbortError` を返すことを期待）。
4. 正常系: すべての `fetchWithRetry` が成功する場合は従来通りの戻り値を返す。

## 影響範囲

- `gitlabAdapter.ts` の順次呼び出し箇所（例: `createCommitWithActions` 内の複数fetch）
- `mapWithConcurrency` を利用する並列取得処理（例: `_fetchContentFromFileSet`）
- 他のアダプタやユーティリティが `fetchWithRetry` を利用している箇所

変更は振る舞いの強化（失敗時に早期中断）であり、正常系のAPIは破壊しないことを目標とするが、呼び出し側で失敗例外を捕捉しているコードがある場合、挙動が変わる可能性がある点に注意する。

## ロールアウト計画

1. 本設計書レビュー・承認
2. `RetryExhaustedError` 型の追加（共通ユーティリティ）
3. `fetchWithRetry` のエラー送出仕様を明確化
4. `mapWithConcurrency` にキャンセルオプションを追加
5. `gitlabAdapter.ts` 等の呼び出し箇所を順次修正・単体テスト追加
6. 結合テスト（既存ユニットテスト & e2e）を実行し問題ないことを確認

## 実装に関する注意事項

- 既存テストが `global.fetch` を jest の mock にしている場合、`AbortSignal` の中断を検証するテストはモック側で `signal` の扱いを再現する必要がある。
- 並列処理の早期終了は Promise のキャンセルがない JavaScript の特性上、「結果を破棄して早期拒絶する」方式が最も現実的。

---

以上。実装は本設計の承認を得てから開始してください。

## 該当箇所と修正案

下記はワークスペース内で `fetchWithRetry` を繰り返し呼び出している主な箇所と、各箇所に対する具体的な修正案です。実装時はこの一覧を参照して変更を適用してください。

- `src/git/abstractAdapter.ts`
  - 役割: グローバルな `fetchWithRetry` 実装（共通関数）および `AbstractGitAdapter.prototype.fetchWithRetry` のプロキシ実装。
  - 修正案:
    - 既存の `fetchWithRetry` 実装がリトライ上限到達で失敗した際に、`RetryExhaustedError` を投げること。
    - `AbstractGitAdapter.prototype.fetchWithRetry`（protected proxy）がエラーを捕捉してログ出力する場合、`RetryExhaustedError` を握りつぶさずそのまま伝播させる（つまり再throwするか捕捉しない）。

- `src/git/gitlabAdapter.ts` の主な呼び出し箇所（一覧）:
  - `listCommits`（行付近: 呼び出し例）: `const resp = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers })`
  - `getRepositoryMetadata`（行付近）: `await this.fetchWithRetry(`${this.baseUrl}`, { method: 'GET', headers: this.headers })`
  - `listBranches`（行付近）: `await this.fetchWithRetry(url, { method: 'GET', headers: this.headers })`
  - `createBranch`（行付近）: `await this.fetchWithRetry(url, { method: 'POST', headers: this.headers, body }, 4, 300)`
  - `createCommitWithActions` → `postCommit`（行付近）: `await this.fetchWithRetry(url, { method: 'POST', headers: this.headers, body })`
  - `verifyParent`（行付近）: `await this.fetchWithRetry(...branches...)`
  - `_fetchTreeAndBuildShas`（tree取得; 行付近）: `await this.fetchWithRetry(.../repository/tree...)`
  - `_fetchFileRaw`（ファイルraw取得; 行付近）: `await this.fetchWithRetry(.../repository/files/.../raw...)`
  - `resolveRef` 系（`_tryResolveBranch`, `_tryResolveTag`, `_tryResolveCommit`）: 各 `fetchWithRetry` 呼び出し

  - 修正案（共通）:
    - 順次呼び出し箇所については `fetchWithRetry` が `RetryExhaustedError` を投げた場合、以降の呼び出しは行わずそのままエラーを上位に伝播する（通常の await のままで良い）。
    - 既存コード内で `fetchWithRetry` の結果を try/catch している箇所は、`RetryExhaustedError` を補足するときに再throwするか、`if (err instanceof RetryExhaustedError) throw err` のようにして意図せず処理継続しないように変更する。

- 並列実行箇所:
  - `src/git/abstractAdapter.ts` にある `mapWithConcurrency`（ユーティリティ）を確認し、共有の `AbortController`/`signal` を受け渡すオプションを追加することを推奨。
  - `src/git/gitlabAdapter.ts` の `_fetchContentFromFileSet`（ファイル複数取得で `mapWithConcurrency` を使用）に対しては、`mapWithConcurrency` が `RetryExhaustedError` を受け取った際に未開始タスクを起動しないロジック、及び可能なら `AbortController.abort()` を呼ぶフローを追加する。

## 変更の適用手順（実装時のチェックリスト）

1. `RetryExhaustedError` を `src/git/abstractAdapter.ts` 近傍（共通ユーティリティ）に追加。
2. 既存の `fetchWithRetry` 実装を変更して、リトライ上限時に `RetryExhaustedError` を投げるようにする（既存の throw/return ロジックを置換）。
3. `AbstractGitAdapter.prototype.fetchWithRetry` がエラーを握りつぶしていないことを確認し、必要なら再throwを追加。
4. `mapWithConcurrency` にキャンセルオプション（共有 `AbortSignal`）を追加し、`RetryExhaustedError` 発生時に未開始タスクを起動しない実装にする。
5. `gitlabAdapter.ts` 内の並列処理呼び出し（例: `_fetchContentFromFileSet`）を修正して共有 `AbortController` を渡す。
6. ユニットテストを追加: 順次・並列・AbortSignal パターンの 4 ケースを検証する。

---

