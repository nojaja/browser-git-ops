# GitLabAdapter: PRIVATE-TOKEN ヘッダ取扱い 詳細設計書

## 概要
`GitLabAdapter` の `constructor(options: GLOptions)` において、`options.token` が未指定または空文字列の場合、HTTP ヘッダに `PRIVATE-TOKEN` フィールドを含めないようにするための設計書。

本設計は既存の動作を壊さず、テスト容易性とセキュリティ（不要な空ヘッダ送信の回避）を向上させることを目的とする。

## 背景
現在の `constructor` 実装では次のように `this.headers` を設定している：

```ts
this.headers = {
  'PRIVATE-TOKEN': options.token,
  'Content-Type': 'application/json'
}
```

この実装だと `options.token` が `undefined` や `''`（空文字）の場合でも `PRIVATE-TOKEN` キーが存在し、値が `undefined` または空文字として送信される可能性がある。テスト環境では `global.fetch` を jest の mock にするなど、ヘッダの有無を条件にした動作差分が出ることがあるため、ヘッダ自体を未設定にすることでより明確な挙動を実現する。

## 目的
- `options.token` が falsy（`undefined`, `null`, 空文字列）であれば `this.headers` に `PRIVATE-TOKEN` を含めない。
- `options.token` が文字列（長さ > 0）の場合のみ `PRIVATE-TOKEN` を `this.headers` に設定する。
- 既存コードの他の部分（`fetchWithRetry` や API 呼び出し）には影響を与えない。

## 変更方針（高水準）
- `constructor` 内で `this.headers` を組み立てる際に、`options.token` の存在チェックを行う。
- `Content-Type` は常に設定する。
- `this.headers` は不変オブジェクト（新しいオブジェクト）として設定する。

## 詳細実装案（擬似コード）
```ts
const headers: Record<string,string> = {
  'Content-Type': 'application/json'
}
if (typeof options.token === 'string' && options.token.length > 0) {
  headers['PRIVATE-TOKEN'] = options.token
}
this.headers = headers
```

### 判定ルール
- 文字列型であり、かつ `trim()` 後の長さが 0 より大きい → ヘッダを追加
- それ以外（`undefined`, `null`, 空文字列、空白文字列等）はヘッダを追加しない

判定はセキュリティ観点で厳格に行う。空白のみのトークンは無効とみなす。

## 互換性 / 副作用
- GitLab API に対する既存の呼び出しは、認証が必要なエンドポイントでは 401/403 などのエラーとなる可能性がある。これは期待される動作である。
- テストコードで `headers` の存在を前提にしている場合、テストの修正が必要になる可能性がある。特に `options.token` が未指定のケースのテストで `PRIVATE-TOKEN` ヘッダの有無を期待している場合は更新が必要。

## テスト計画
### 単体テスト（`test/unit/git/gitlabAdapter.constructor.test.ts`）
- Test 1: `options.token` が有効な文字列のとき
  - Setup: `const opts = { host: 'https://gitlab.com', projectId: '1', token: 'abc' }`
  - Expect: `new GitLabAdapter(opts).headers` に `PRIVATE-TOKEN: 'abc'` と `Content-Type: 'application/json'` が含まれる。

- Test 2: `options.token` が `undefined` のとき
  - Setup: `const opts = { host: 'https://gitlab.com', projectId: '1' }`
  - Expect: `headers` に `Content-Type` のみ存在し、`PRIVATE-TOKEN` キーが存在しないこと。

- Test 3: `options.token` が空文字 (`''`) のとき
  - Setup: `const opts = { host: 'https://gitlab.com', projectId: '1', token: '' }`
  - Expect: `PRIVATE-TOKEN` キーが存在しない。

- Test 4: `options.token` が空白文字列 (`'  '`) のとき
  - Setup: `token: '   '`
  - Expect: `PRIVATE-TOKEN` キーが存在しない。

- Test 5: 実際の API 呼び出しシナリオにおける振る舞い（モック fetch）
  - Setup: `options.token` 未指定、`global.fetch` を jest mock にしてエンドポイント呼び出しを検証
  - Expect: 呼び出し時の `RequestInit.headers` に `PRIVATE-TOKEN` が含まれていないことをアサート

### E2E / 統合テスト
- 既存の E2E は影響を受ける可能性があるが、この変更は API レベルの認証挙動のみを変えるため、E2E の意図した振る舞いが変わらないかを確認する。特に認証必須の操作を行うケースでは明確な 401/403 を期待するようにする。

## 受け入れ基準
- 単体テストの 5 ケースが全て通過すること
- `options.token` が falsy のとき `PRIVATE-TOKEN` ヘッダが存在しないことを確認できるテストがあること

## 実装タスク（後続、今回実行しない）
1. `src/git/gitlabAdapter.ts` の `constructor` を上記ロジックで改修
2. ユニットテスト `test/unit/git/gitlabAdapter.constructor.test.ts` を追加/修正
3. CI で全テストを実行し、通過を確認
4. ドキュメント（CHANGELOG 等）に変更点を追記

## セキュリティ考慮
- トークンがログに出力されないよう注意すること（今回の変更でログ出力は行わない想定）。
- 空文字ヘッダを送ることで不要な情報漏洩や誤認識を防ぐ。

## 参考実装箇所
- `src/git/gitlabAdapter.ts` の `constructor`
- `src/git/abstractAdapter.ts`（`fetchWithRetry` 等の挙動確認）

---
作業はここまで。実装の許可をいただければ、次に `src/git/gitlabAdapter.ts` を修正し、ユニットテストを追加して実行します。