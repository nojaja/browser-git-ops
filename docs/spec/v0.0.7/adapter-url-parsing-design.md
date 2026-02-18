# Adapter URL Parsing and setAdapter(type, url) — Design (v0.0.7)

Version: 0.0.7

Author: generated-design

目的
- `examples/src/app.ts` の接続処理（URL から adapter 情報を決定し `setAdapter({ type, opts })` に渡す流れ）をライブラリ側（VirtualFS）で再利用可能にする。
- VirtualFS に URL を解析して `setAdapter` の引数となる `{ type, opts }` を返す関数を追加し、`setAdapter(type, url)` オーバーロードを実装する。

ゴール
- `VirtualFS.parseAdapterFromUrl(url: string, token?: string, platformOverride?: 'github'|'gitlab'|'auto')` を実装して、URL から adapter メタ情報を返す。
- `VirtualFS.setAdapter(type: string, url: string)` を追加（内部で `parseAdapterFromUrl` を呼び、既存の `setAdapter({ type, opts })` 実装を再利用する）。
- 既存の `setAdapter(meta)` との互換性を保ちつつ、UI 側で `setAdapter('github', 'https://github.com/owner/repo')` のように簡潔に呼べるようにする。

設計概要

1) 新規関数: `parseAdapterFromUrl`

- シグネチャ（提案）
  - `parseAdapterFromUrl(url: string, token?: string, platformOverride?: 'github'|'gitlab'|'auto'): { type: 'github'|'gitlab', opts: Record<string, any> }`

- 振る舞い（`examples/src/app.ts` のロジックをライブラリ移植）
  - URL を `new URL(url)` でパース。失敗すれば例外を投げる（呼び出し側でハンドリング）。
  - pathname を正規化して先頭/末尾のスラッシュを削除し、`/` で分割。各セグメントから末尾の `.git` を削る。
  - ホスト名小文字化して解析。
  - プラットフォーム判定ヒューリスティクス（優先順）:
    1. `platformOverride` が `github` または `gitlab` の場合はそれを採用
    2. hostname に `gitlab` が含まれる -> `gitlab`
    3. hostname に `github` が含まれる -> `github`
    4. `token` が与えられ、接頭辞 `glpat_` -> `gitlab`, `ghp_` -> `github`
    5. パスのセグメント数 >= 3 -> `gitlab`（グループ/サブグループを想定）
    6. セグメント数 === 2 -> `github`
    7. 上記に該当しない場合は例外または `null` を返す（実装方針で例外推奨）

  - プラットフォーム別 `opts` 構築:
    - GitHub
      - owner = segments[0]
      - repo = segments[1]
      - token = 引数 `token` が与えられれば設定
      - branch = `branch` を URL のクエリパラメータ（`?branch=...`）から取る、無ければ `'main'` をデフォルト
      - self-hosted の場合（hostname が `github.com` でない） -> `host = `${origin}/api/v3``（`examples` の挙動準拠）
    - GitLab
      - projectId = segments.join('/')
      - token = 引数 `token` が与えられれば設定
      - branch = URL の `?branch=` または `'main'`
      - self-hosted の場合 -> `host = origin`（`examples` の挙動準拠）

  - 戻り値: `{ type: 'github'|'gitlab', opts }`

  - エラー
    - URL が不正、パスから必要情報が抽出できない（owner/repo、projectId など）場合は `Error` を投げる。

  - 備考
    - token/branch を URL で受け渡す場合はクエリ文字列をサポートする（`?token=...&branch=...`）。ただしセキュリティ観点から token を URL に直書きする方法は推奨されないことをドキュメントに明記する。

2) `setAdapter(type, url)` のオーバーロード

- シグネチャ（提案）
  - `async setAdapter(meta: { type: string, opts?: Record<string,any> } | string, url?: string): Promise<void>`
  - 既存呼び出し `setAdapter({ type, opts })` はそのまま動作。
  - 新規呼び出し `setAdapter('github', 'https://github.com/owner/repo')` をサポートする。

- 振る舞い
  - 引数が `(type: string, url: string)` の形で呼ばれたら、内部で `parseAdapterFromUrl(url, /* token: undefined */, /* platformOverride: type */)` を呼ぶ（`type` を `platformOverride` に渡す）。
  - `parseAdapterFromUrl` が返す `{ type, opts }` を使い、既存の `setAdapter({ type, opts })` の経路を実行する。つまり処理は最終的に同じ `setAdapter({ type, opts })` ロジックに委譲される。
  - 返り値/副作用は既存 `setAdapter` と同じにする（例: VFS 内の adapter 情報を永続化、`this.adapter = instance` の作成、`PENDING_ADAPTER` による保留挙動など）。

- 互換性
  - 既存コードは `setAdapter({ type, opts })` のままで変更不要。
  - `examples/src/app.ts` など UI 側で `setAdapter('github', url)` を呼べば内部で解析されて同等の metadata が登録される。

3) 実装の細部（VirtualFS 側）

- モジュール配置
  - VirtualFS のソースファイル（例: `src/virtualfs/virtualfs.ts` または既存のクラス定義ファイル）に `static` / インスタンスメソッドとして `parseAdapterFromUrl` を追加可能。
  - 推奨: ライブラリのユーティリティ領域（`src/virtualfs/utils/urlParser.ts`）に純関数として実装し、VirtualFS からインポートして利用する。

- 型定義（TypeScript）
  ```ts
  export type AdapterType = 'github' | 'gitlab'
  export interface AdapterOpts { [key: string]: any }
  export interface AdapterMeta { type: AdapterType; opts: AdapterOpts }

  export function parseAdapterFromUrl(url: string, token?: string, platformOverride?: 'github'|'gitlab'|'auto'): AdapterMeta
  ```

- 既存 `setAdapter` との接続
  - `setAdapter(arg1: any, arg2?: any)` のオーバーロードを設け、次の分岐を実装する：
    - arg1 がオブジェクト（`{ type, opts }`） -> 既存処理
    - arg1 が文字列（`type`）かつ arg2 が文字列（`url`） -> `parseAdapterFromUrl(arg2, /* token: undefined */ , arg1)` を実行し、得られた meta を既存処理に渡す
    - arg1 が文字列（`url`）かつ arg2 が undefined であれば `parseAdapterFromUrl(arg1)` としても良い（拡張性）

4) エッジケースと例外処理

- URL の末尾に `.git` が付いているケースも考慮（`/.git$/s` の置換で除去して処理を継続）
- パスが期待値に満たない（GitHub: 2 セグメント未満、GitLab: 2 セグメント未満）の場合は `Error('invalid repository path')`
- 不正な URL 文字列 -> `TypeError('invalid url')`
- token を URL のクエリ文字列で受け取る場合、長さやフォーマット検証（`glpat_` / `ghp_`）は任意で行う
- Self-hosted でのホスト名判定は正規表現で `github.com` / `gitlab.com` を除外して処理する

5) テスト計画（ユニット）

- `parseAdapterFromUrl` のテストケース
  - GitHub 正常: `https://github.com/owner/repo` -> `{ type: 'github', opts: { owner: 'owner', repo: 'repo', branch: 'main' } }`
  - GitHub .git: `https://github.com/owner/repo.git` -> 同上
  - GitHub Enterprise: `https://git.example.com/owner/repo` -> `host` が `https://git.example.com/api/v3`
  - GitLab 正常: `https://gitlab.com/group/subgroup/project` -> `{ type: 'gitlab', opts: { projectId: 'group/subgroup/project', branch: 'main' } }`
  - Token ヒント: token='glpat_xxx' を与えた場合、hostname が明確でないときに `gitlab` を選択
  - platformOverride: override='github' を与えると host 名に関係なく github 扱い
  - invalid URL -> throws
  - insufficient path segments -> throws
  - branch in query: `https://github.com/owner/repo?branch=dev` -> branch='dev'

- `setAdapter(type, url)` のテスト
  - `setAdapter('github', 'https://github.com/owner/repo')` が内部で `parseAdapterFromUrl` を呼び、その結果で既存 `setAdapter({ type, opts })` ロジックを実行するモック検査
  - `setAdapter('gitlab', 'https://gitlab.example.com/group/proj')` の自ホストケース
  - `setAdapter` がエラーを返す/投げる場合の正常ハンドリング（既存の `PENDING_ADAPTER` 保留ロジックに従うこと）

6) ドキュメント・移行ガイド

- 既存ユーザーは何も変更しなくても良い。
- 新しい呼び方:
  - `await vfs.setAdapter('github', 'https://github.com/owner/repo')` をサポート。
  - 必要に応じて URL に `?branch=xxx` や `?token=...` を付与できるが、推奨は UI で token を別途安全に渡す方法。

7) セキュリティ注意事項

- URL のクエリにトークンを含めるとログや履歴に残る可能性があるため、ドキュメントで注意喚起する。
- parse 関数は入力を正規化するが、トークンの保護は呼び出し側で担保する。

8) 互換性と例外フロー

- 既存 `setAdapter({type, opts})` と同じ永続化処理・出力（ログ・trace）を行う。
- `setAdapter(type, url)` 呼び出しは、`parseAdapterFromUrl` が `Error` を投げる場合はそのエラーを再スローするか、Promise を reject する。

実装の流れ（次のステップ）
1. `parseAdapterFromUrl` をユーティリティとして実装（`src/virtualfs/utils/urlParser.ts`）
2. VirtualFS に `setAdapter(type:string, url:string)` のオーバーロードを追加し、内部で `parseAdapterFromUrl` を呼ぶ
3. 単体テストを追加
4. examples 側で必要なら UI を `setAdapter('github', url)` を使うように差し替え（任意）

付録: 例（擬似コード）
```ts
const meta = parseAdapterFromUrl('https://github.com/owner/repo', undefined, 'github')
// => { type: 'github', opts: { owner: 'owner', repo: 'repo', branch: 'main' } }

await vfs.setAdapter(meta)            // 既存経路
await vfs.setAdapter('github', url)  // 新規経路（内部で parseAdapterFromUrl を呼ぶ）
```

以上。実装はこの設計に従って行います。実装開始の指示をください。