# browser-git-ops

ブラウザネイティブで動作する Git 操作ライブラリです。`VirtualFS` とプラットフォームアダプタ（GitHub / GitLab）を提供し、永続化は OPFS、IndexedDB、インメモリの各バックエンドで実装されています。

主な機能
- `VirtualFS`：ローカルワークスペースのスナップショット化と変更セット（create/update/delete）の生成
- 複数バックエンド：`OpfsStorage`（OPFS）、`IndexedDatabaseStorage`（IndexedDB）、`InMemoryStorage`（テスト用）
- プラットフォームアダプタ：`GitHubAdapter`、`GitLabAdapter`

ステータス
- `VirtualFS` のコア機能（差分生成、index 管理、ローカル編集）を実装済み
- OPFS・IndexedDB 用の永続化バックエンドを実装
- `GitHubAdapter` は主要な push フローを含む。`GitLabAdapter` は追加の環境検証が推奨されます。

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

基本的な使い方

```ts
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  const vfs = new VirtualFS({ backend: new OpfsStorage() })
  await vfs.init()

  await vfs.writeFile('README.md', 'hello world')
  const changes = await vfs.getChangeSet()

  const gh = new GitHubAdapter({ owner: 'ORG', repo: 'REPO', token: process.env.GH_TOKEN })
  // VirtualFS とアダプタの API を組み合わせて push 等を実行します（詳細は src を参照）
}
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
