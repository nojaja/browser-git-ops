# browser-git-ops

軽量なブラウザ向け Git 操作用ライブラリ（VirtualFS + GitHub/GitLab アダプタ）。
ブラウザの永続化レイヤは OPFS と IndexedDB を個別のバックエンド実装として提供し、VirtualFS が抽象化して利用します。

---

**主要ポイント**
- `VirtualFS`：ローカルワークスペースとベーススナップショットを管理し、create/update/delete の変更セットを生成します。
 - ストレージ分離：`OpfsStorage`（OPFS 対応）、`IndexedDatabaseStorage`（IndexedDB 対応）および `InMemoryStorage` を個別実装として提供。
- `GitHubAdapter` / `GitLabAdapter`：各プラットフォーム向けのアダプタ実装（HTTP 再試行や blob/tree/commit フローを含む）。

---

**変更履歴（最近の重要な変更点）**
 - ブラウザ永続化を `BrowserStorage` から分離し、`OpfsStorage` と `IndexedDatabaseStorage`、`InMemoryStorage` を新規追加しました。
- `VirtualFS` の既定バックエンドを `OpfsStorage` に切替え、従来の `canUseOpfs`（インスタンス委譲）は廃止しました。
 - ルートエクスポートに `IndexedDatabaseStorage` / `OpfsStorage` / `InMemoryStorage` を追加し、examples と E2E ヘルパーを OPFS 検出の新 API に合わせて更新しました。
- 単体テストを複数更新・追加し、OPFS / IndexedDB の分岐やトランザクションエラー経路のカバレッジを強化しました。

---

**公開 API（ライブラリエントリ）**
ライブラリはバンドル／パッケージとして次をエクスポートします（`src/index.ts` を参照）：

- `VirtualFS` (default exportと命名エクスポート)
- `OpfsStorage` — OPFS（origin private file system）用バックエンド
 - `OpfsStorage` — OPFS（origin private file system）用バックエンド
 - `IndexedDatabaseStorage` — IndexedDB 用バックエンド
 - `InMemoryStorage` — テスト/メモリ用バックエンド
 - `GitHubAdapter`, `GitLabAdapter` — 各プラットフォーム向けアダプタ

例：基本的な利用

```ts
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  const vfs = new VirtualFS({ backend: new OpfsStorage() })
  await vfs.init()

  await vfs.writeFile('README.md', 'hello world')
  const changes = await vfs.getChangeSet()

  const gh = new GitHubAdapter({ owner: 'ORG', repo: 'REPO', token: process.env.GH_TOKEN })
  // push の呼び出しは VirtualFS の API に依存（詳細は src/virtualfs/virtualfs.ts）
}
```

---

## プロジェクト構成（抜粋）

# browser-git-ops

A browser-native Git operations library that provides a VirtualFS and platform adapters for GitHub and GitLab. It implements multiple persistent backends (OPFS, IndexedDB, and an in-memory backend) and abstracts them behind a common VirtualFS API.

Key features
- VirtualFS: local workspace snapshoting and change-set generation (create/update/delete).
- Multiple backends: `OpfsStorage` (OPFS), `IndexedDatabaseStorage` (IndexedDB), and `InMemoryStorage` (testing).
- Platform adapters: `GitHubAdapter` and `GitLabAdapter` implementing common push/fetch flows.

Status summary
- Core VirtualFS functionality implemented (delta generation, index management, local edits).
- Persistence backends for OPFS and IndexedDB implemented.
- GitHubAdapter includes primary push flow; GitLab adapter exists but may require extra environment verification.

Quick install

```bash
git clone https://github.com/nojaja/browser-git-ops.git
cd browser-git-ops
npm ci
```

Build & test

```bash
npm run build       # build browser bundles and types
npm run test        # unit tests (Jest)
npm run test:e2e    # Playwright E2E (runs after build)
npm run lint        # ESLint
```

Usage (basic)

```ts
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  const vfs = new VirtualFS({ backend: new OpfsStorage() })
  await vfs.init()

  await vfs.writeFile('README.md', 'hello world')
  const changes = await vfs.getChangeSet()

  const gh = new GitHubAdapter({ owner: 'ORG', repo: 'REPO', token: process.env.GH_TOKEN })
  // Use VirtualFS + adapter APIs to push changes (see src/virtualfs/virtualfs.ts for details)
}
```

Project layout (excerpt)

- `src/` — source
  - `virtualfs/virtualfs.ts` — `VirtualFS` core
  - `virtualfs/opfsStorage.ts` — OPFS backend
  - `virtualfs/indexedDatabaseStorage.ts` — IndexedDB backend
  - `virtualfs/inmemoryStorage.ts` — In-memory backend (tests)
  - `git/githubAdapter.ts` — GitHub adapter
  - `git/gitlabAdapter.ts` — GitLab adapter
- `examples/` — browser sample UI and Playwright scenarios
- `test/` — Jest unit tests and Playwright E2E tests

Configuration

- Set `GH_TOKEN` or appropriate credentials when using platform adapters.
- OPFS availability depends on the browser; polyfills/mocks are used in tests.

Examples

- See the `examples/` directory for a browser sample and Playwright scenarios.

API surface (overview)

- `new VirtualFS(options?)` — options: `{ storageDir?: string, backend?: StorageBackend }`
- `init()` — initialize backend and load index
- `writeFile(path, content)`, `deleteFile(path)`, `renameFile(from,to)` — local edits
- `getChangeSet()` — returns list of create/update/delete changes
- `applyBaseSnapshot(snapshot, headSha)` — apply remote snapshot, returns conflicts if any

Testing & CI

- Run unit tests locally with `npm run test`.
- `npm run test:e2e` requires a build (`npm run build`) before execution.

Contributing

- Issues and PRs are welcome. Please open an Issue first to discuss design when appropriate.
- Follow TypeScript + ESLint conventions; include tests for new behavior.

Support / Getting help

- Report issues at: https://github.com/nojaja/browser-git-ops/issues

License

- Licensed under the MIT License — see the `LICENSE` file for details.

Maintainers

- Maintained by `nojaja` (https://github.com/nojaja). See repository for contributors and history.

TODO
- Add code examples that demonstrate push/pull flows end-to-end.
- Add a CONTRIBUTING.md with contributor guidelines and PR checklist.
