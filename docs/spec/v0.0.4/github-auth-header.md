# GitHub Adapter: Authorization ヘッダ取り扱い（詳細設計）

## 概要
`src/git/githubAdapter.ts` のコンストラクタに渡される `options.token` が未定義または空のとき、HTTP リクエスト用の `headers` に `Authorization` ヘッダが一切含まれないようにするための設計書。

本設計は実装着手前の詳細設計であり、実装とテストはユーザーの承認後に行う。

## 背景と目的
- 現状：`Authorization` ヘッダが常にセットされる実装であるとテストや一部環境で不要なヘッダが送信される恐れがある。
- 目的：`options.token` が存在する場合のみ `Authorization` を追加し、存在しない場合はヘッダに含めないことで不要な認証ヘッダ送信を防ぐ。

## 適用範囲
- 対象ファイル: `src/git/githubAdapter.ts`
- 対象コンポーネント: GitHub API 呼び出し時に使用する `this.headers` の初期化ロジック

## 要件
1. `options.token` が truthy（非空文字列）である場合、`headers.Authorization` をセットする。値は `token <トークン>`（またはプロジェクト規約に合わせて `Bearer <トークン>`）とする。※プロジェクトで使用している既存の慣習に従うこと。
2. `options.token` が `undefined`, `null`, 空文字列 `''` の場合、`headers` に `Authorization` キーを一切含めない。
3. 既存のヘッダ（例: `Content-Type`, `Accept` 等）は従来どおり常にセットされる。
4. 単体テストでトークン有無の振る舞いを検証する。

## 設計詳細
- コンストラクタ内の `this.headers` 初期化は、オブジェクトスプレッドや条件式を用いて `Authorization` を動的に付与する。実装例（設計書用、実装はまだ行わない）：

```ts
// 設計用サンプル（ここでは実装しない）
this.headers = {
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  ...(options.token ? { Authorization: `token ${options.token}` } : {}),
}
```

- トークンの形式（`token` vs `Bearer`）は既存コードベースの慣習に合わせる。リポジトリ内に既存の GitHub 呼び出し箇所があれば、その記述と整合させること。

## API/外部挙動の影響
- GitHub API へのリクエストヘッダが変わることにより、匿名アクセス（トークンなし）時は認証が不要なエンドポイントでのみ動作する。保護されたエンドポイントは 401/403 を返す可能性があるが、これは仕様どおり。

## テストケース（単体テスト）
テストは Jest（既存プロジェクト構成に合わせる）で実装する。テストは `test/unit/...` 配下に追加する想定。

1. トークンあり
   - 入力: `options.token = 'abc123'`
   - 期待: `githubAdapter.headers.Authorization` が存在し、値が `token abc123`（または規約の値）である。

2. トークン undefined
   - 入力: `options.token = undefined`
   - 期待: `githubAdapter.headers` に `Authorization` キーが存在しない。

3. トークン null
   - 入力: `options.token = null`
   - 期待: `Authorization` キーが存在しない。

4. トークン 空文字列
   - 入力: `options.token = ''`
   - 期待: `Authorization` キーが存在しない。

5. 既存ヘッダ保持
   - 入力: トークンがない場合でも `Content-Type` 等の必須ヘッダが存在すること。

テスト実装の注意点:
- `githubAdapter` のコンストラクタを呼ぶ際、外部 HTTP 呼び出しが発生しないようにモックするか、ヘッダ初期化のみを検査するユニットに限定する。

## 実装手順（承認後に実行）
1. `src/git/githubAdapter.ts` のコンストラクタを修正する（上記設計どおり）。
2. 単体テストを追加してトークン有無のケースを網羅する。
3. CI でテストを実行し、既存テストに影響がないことを確認する。
4. 変更内容を CHANGELOG に追記する。

## ロールバック／互換性
- 既存のコードで `Authorization` の自動付与に依存している箇所がないかを確認すること。もし依存箇所があれば、該当箇所をトークン必須の使い方に改めるか、呼び出し側で明示的に `Authorization` を追加する実装へ移行する。

## 例（期待されるヘッダの差分）
- トークンあり:

```
Accept: application/vnd.github.v3+json
Content-Type: application/json
Authorization: token abc123
```

- トークンなし:

```
Accept: application/vnd.github.v3+json
Content-Type: application/json
```

## 備考 / 相談事項
- トークンのプレフィックスを `token` にするか `Bearer` にするか、既存の慣習を確認して統一する必要あり。実装時にプロジェクト内を検索して整合性を確認すること。

---
作成日: 2026-02-05
作成者: 自動生成（設計担当）

※ ここまでが詳細設計書です。実装はユーザーの承認を受けてから行います。
