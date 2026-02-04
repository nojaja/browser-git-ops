[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nojaja/browser-git-ops)

# browser-git-ops

ブラウザネイティブで動作する Git 操作ライブラリです。`VirtualFS` とプラットフォームアダプタ（GitHub / GitLab）を提供し、永続化は OPFS、IndexedDB、インメモリの各バックエンドで実装されています。

- Live Demo: https://nojaja.github.io/browser-git-ops/

主な機能
- `VirtualFS`：ローカルワークスペースのスナップショット化と変更セット（create/update/delete）の生成
- 複数バックエンド：`OpfsStorage`（OPFS）、`IndexedDatabaseStorage`（IndexedDB）、`InMemoryStorage`（テスト用）
- プラットフォームアダプタ：`GitHubAdapter`、`GitLabAdapter`（Web API 経由で動作し、他の Git クライアントで課題になりがちな CORS を Proxy なしで回避）

ステータス
- `VirtualFS` のコア機能（差分生成、index 管理、ローカル編集）を実装済み
- OPFS・IndexedDB 用の永続化バックエンドを実装
- `GitHubAdapter` は主要な push フローを含む。`GitLabAdapter` は追加の環境検証が推奨されます。

ライブラリ利用者向け（npm）

```bash
npm i browser-git-ops
```

基本的な使い方

```ts
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  const backend = new lib.OpfsStorage('test01')
  const vfs = new VirtualFS({ backend })
  await vfs.init()
  await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'ORG', host: 'HOST', token: 'token', branch: 'main' } })

  await vfs.pull()
  const list = await vfs.listPaths()
  await vfs.writeFile('README.md', 'hello world')
  const changes = await vfs.getChangeSet()

  const idx = await vfs.getIndex()
  const pushInput = { parentSha: idx.head, message: 'Example push', changes: changes }
  const pushRes = await vfs.push(pushInput as any)
}
```

インストール（クローン）

```bash
git clone https://github.com/nojaja/browser-git-ops.git
cd browser-git-ops
npm ci
```

ビルド & テスト

```bash
npm run build       # ブラウザ向けバンドルと型定義を出力
npm run test        # ユニットテスト (Jest)
npm run test:e2e    # Playwright E2E（事前に build が必要）
npm run lint        # ESLint
```

プロジェクト構成（抜粋）

- `src/` — ソース
  - `virtualfs/virtualfs.ts` — `VirtualFS` 本体
  - `virtualfs/opfsStorage.ts` — OPFS バックエンド
  - `virtualfs/indexedDatabaseStorage.ts` — IndexedDB バックエンド
  - `virtualfs/inmemoryStorage.ts` — インメモリ（テスト用）
  - `git/githubAdapter.ts` — GitHub アダプタ
  - `git/gitlabAdapter.ts` — GitLab アダプタ
- `examples/` — ブラウザサンプルと Playwright シナリオ
- `test/` — Jest ユニットテスト、Playwright E2E

設定

- プラットフォームアダプタ使用時は `GH_TOKEN` 等の認証情報を設定してください。
- OPFS はブラウザ依存のため、実ブラウザでの動作確認を推奨します（テストでは polyfill/mocks を使用）。

例

- `examples/` ディレクトリにブラウザ実行サンプルと Playwright テストが含まれます。

API 概要

- `new VirtualFS(options?)` — options: `{ storageDir?: string, backend?: StorageBackend }`
- `init()` — バックエンド初期化と index 読み込み
- `writeFile(path, content)`, `deleteFile(path)`, `renameFile(from,to)` — ローカル編集
- `getChangeSet()` — create/update/delete の変更一覧を返す
- `applyBaseSnapshot(snapshot, headSha)` — リモートスナップショットを適用し、競合があれば返す

テスト & CI

- ローカルのユニットテスト: `npm run test`
- E2E 実行前に `npm run build` を実行してください。

貢献

- Issue / PR を歓迎します。設計上の大きな変更についてはまず Issue で相談してください。
- TypeScript + ESLint に従い、変更にはテスト追加を推奨します。

サポート / 問い合わせ

- Issue: https://github.com/nojaja/browser-git-ops/issues

ライセンス

- MIT — 詳細は `LICENSE` を参照してください。

TODO
- push/pull のエンドツーエンド例を README に追加する。
- CONTRIBUTING.md を追加して貢献フローを明確化する。
