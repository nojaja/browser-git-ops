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
