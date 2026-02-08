# GitHub blob 取得時のコンテンツ取り扱いに関する詳細設計

作成日: 2026-02-08
作成者: 自動生成（調査フェーズ）

## 概要

`VirtualFS` の `readFile()` を通じて GitHub 上のファイルをオンデマンド取得した際に、ファイル内容が正しく返らない問題が報告されました。原因は GitHub REST API の `GET /repos/{owner}/{repo}/git/blobs/{file_sha}` のレスポンスに含まれる `content` が **base64 エンコード済み** である点の扱い違いにあります。

本設計では現状の動作を整理し、根本原因、修正方針、互換性、安全な実装手順、及びテスト項目を記述します。実装は行わず、設計書のみ作成します。

---

## 現状（リポジトリ確認結果）

関連ファイル:
- `src/git/githubAdapter.ts`
  - `getBlob(blobSha)` は GitHub API を呼び出し、レスポンス JSON の `content` を受け取っている。
  - 実装では `encoding === 'base64'` の場合に `atob()` でデコードして `content` に代入し、同時に `encoding` フィールドは `base64` のまま返している。
- `src/virtualfs/remoteSynchronizer.ts`
  - `fetchBaseIfMissing()` では adapter の `getBlob()` を呼び、戻り値 `b` の `encoding` を確認して、`encoding === 'base64'` の場合に `Buffer.from(b.content, 'base64').toString('utf8')` でデコードしている。
- `src/virtualfs/localFileManager.ts` と `virtualfs` 側のフローは、`backend.readBlob(...,'base')` に書き込まれた文字列（`base` セグメント）を `readFile` として返す仕組み。

このため現在のフローでは `GitHubAdapter.getBlob` が既にデコード済みの文字列を返し、かつ `encoding` が `'base64'` のままであるため、`RemoteSynchronizer.fetchBaseIfMissing` が `Buffer.from(...,'base64')` を実行すると **二重デコード** となり結果が破損するか、場合によっては例外になる可能性があります。また、`atob` は Node.js の実行環境では存在しないため実行時エラーを起こす可能性がある箇所でもあります。

---

## GitHub API 仕様確認（要点）

API: `GET /repos/{owner}/{repo}/git/blobs/{file_sha}`
- 公式レスポンスの重要部分（例）:

```json
{
  "sha": "...",
  "size": 5,
  "content": "aGVsbG8=\n",
  "encoding": "base64"
}
```

- `content` フィールドは **base64 でエンコードされた文字列**（改行を含む場合あり）で返される。
- クライアントは `encoding` を見て必要に応じて base64 デコードする必要がある。

参考: GitHub REST API ドキュメント（Blobs）

---

## 根本原因

- `GitHubAdapter.getBlob()` が API の `content` をデコードして返している（`atob` を使用）。しかし呼び出し側（`RemoteSynchronizer.fetchBaseIfMissing`）は `getBlob()` の返り値がまだ base64 のままであることを期待し、自身で `Buffer.from(...,'base64')` によるデコードを行っている。
- その結果、二重デコードや文字化け、または Node 実行環境での `atob` 未定義によるエラーが発生する。

---

## 修正方針（確定案）

設計方針は一貫性と明示性を重視します。

1. Adapter レイヤ（`GitHubAdapter`）は「API の生のレスポンス（`content` と `encoding`）をそのまま返す」責務とする。
   - 具体的には `getBlob()` は API レスポンスの `content` をデコードせずにそのまま `content` フィールドとして返す。
   - `encoding` には API の `encoding` 値（例: `base64`）をそのまま渡す。
   - これにより Adapter は外部 API の契約を単純に反映する役割に限定される。

2. `RemoteSynchronizer.fetchBaseIfMissing()`（利用側）は `encoding` を見て必要なデコードを行う責務を持つ。
   - 既に実装されている `Buffer.from(b.content, 'base64').toString('utf8')` のような分岐はこのまま利用できる。
   - ただし `b.content` に改行が含まれる場合があるため `replace(/\n/g,'')` 等で改行除去してから `Buffer.from(...,'base64')` に渡すことを明記する。

3. Node / ブラウザの互換性
   - `atob` を使わない（`atob` はブラウザグローバル）。サーバ側実行（Node）では `Buffer` を使うことを前提とする。Adapter 側でのデコードを行わないため `atob` は排除してよい。

  本設計では 1-3 を採用する。

---

## 変更対象（実装作業時の指示）

実装は本タスクでは行いませんが、実装時の具体的変更点は下記。

- 修正ファイル
  - `src/git/githubAdapter.ts`
    - `getBlob()` 内での `atob` によるデコードを削除する。
    - API の `index.content` をそのまま `content` フィールドとして返す。
    - （例: `return { content: index.content, encoding: index.encoding || 'utf-8' }` ）
  - `src/virtualfs/remoteSynchronizer.ts`
    - 既に `fetchBaseIfMissing()` にデコード処理があるため、そのまま利用する。ただし `b.content` の改行除去を追加する（`b.content.replace(/\n/g,'')`）してから `Buffer.from(...,'base64')` を呼ぶことを推奨。

- ユニットテストの追加/修正
  - `test/unit` 配下に `RemoteSynchronizer.fetchBaseIfMissing` と `GitHubAdapter.getBlob` のモックを用いたテストを用意する。
  - テストケース:
    - GitHub API が `content` を base64 で返す場合、`fetchBaseIfMissing` は正しいデコード済みの文字列を `backend.writeBlob(...,'base')` に渡すこと。
    - `GitHubAdapter.getBlob` が base64 の生データ（改行含む）を返した場合でも正しく処理されること。
    - 既存で `getBlob` がデコード済みを返すとき（もし存在するなら）の後方互換ガード（オプション）を検証する。

---

## 具体的なコード例（設計例）

GitHubAdapter.getBlob の想定変更（疑似コード）:

```ts
async getBlob(blobSha: string) {
  const response = await this._fetchWithRetry(`${this.baseUrl}/git/blobs/${blobSha}`, { method: 'GET', headers: this.headers }, 4, 300)
  const index = await response.json()
  if (!index || typeof index.content === 'undefined') throw new Error('getBlob: content not found')
  const enc = index.encoding || 'utf-8'
  // 変更点: デコードしない。API の content と encoding をそのまま返す。
  return { content: index.content, encoding: enc }
}
```

`RemoteSynchronizer.fetchBaseIfMissing()` の該当部（既に近い実装あり）:

```ts
const b = await adapterInstance.getBlob(baseSha)
if (b && typeof b.content !== 'undefined') {
  const enc = b.encoding || 'utf-8'
  let content: string
  if (enc === 'base64') {
    // 改行を除去してから decode
    const safeBase64 = (b.content || '').replace(/\n/g, '')
    content = Buffer.from(safeBase64, 'base64').toString('utf8')
  } else {
    content = b.content
  }
  await this._backend.writeBlob(path, content, 'base')
  return content
}
```

---

## テスト計画（単体テスト）

対象:
- `GitHubAdapter.getBlob()` の返り値検証（モック化した fetch レスポンスで `content` が base64 のまま返ること）
- `RemoteSynchronizer.fetchBaseIfMissing()` が `getBlob()` の返り値（base64 を含む）を正しくデコードして backend に書き込むこと

ケース:
1. 正常系: API が `content`=`aGVsbG8=\n`, `encoding`=`base64` を返す -> backend に `hello` が書き込まれる
2. 異常系: `getBlob()` が例外を投げる -> `fetchBaseIfMissing()` は null を返す
3. 互換性ケース（オプション）: `getBlob()` が既にデコード済みテキストを返す場合でも `fetchBaseIfMissing()` が同様に動作する（必要なら）

モック戦略:
- `adapterInstance.getBlob` を jest のモック関数で差し替え、返却値を制御する
- `StorageBackend` はテスト用のインメモリ実装を使用して `writeBlob` による書き込みを検証する

---

## 互換性と移行リスク

- 変更は主に `GitHubAdapter.getBlob()` の実装を API 生データ返却に変更するもので、外部に `getBlob()` を直接使っているコードがあれば影響を受ける可能性がある。
- 既存コードで `getBlob()` の返り値が "既にデコード済みの文字列" を前提としている箇所がないか検索・確認する必要がある。
- もしそのような箇所が存在する場合は、当該呼び出し側を `encoding` を見てデコードするように修正する（または `GitHubAdapter` に互換ラッパーを残す）。

---

## 実施手順（実装作業時のチェックリスト）

1. `src/git/githubAdapter.ts` の `getBlob()` を修正（デコード除去）。
2. `src/virtualfs/remoteSynchronizer.ts` の `fetchBaseIfMissing()` で `b.content.replace(/\n/g,'')` を使ったデコードを行うことを確認。不要な二重デコードのチェックを追加する場合は最小限に留める。
3. 単体テストを追加/修正し、`npm run test` を実行してパスすることを確認。
4. 影響範囲検索: `getBlob()` を直接呼ぶ他箇所がないか grep で確認し、あれば同様の対応をする。
5. 変更内容を CHANGELOG と `docs/spec/v0.0.4` に記録する。

---

## まとめ

- 問題は `getBlob()` における早期デコード（`atob`）が原因で、呼び出し側が生の base64 を期待しているため不整合が生じている点にある。
- 推奨修正は `GitHubAdapter` を API の生レスポンス返却に戻し、`RemoteSynchronizer` 側で明示的に改行除去と Buffer を使った base64 デコードを行うこと。
- 本設計に基づき実装を行えば、Node/ブラウザ環境での互換性が明確になり、二重デコードや atob 未定義によるランタイムエラーを防げる。


<!-- End of design doc -->
