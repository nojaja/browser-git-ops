[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nojaja/browser-git-ops) [![日本語ドキュメント](https://img.shields.io/badge/docs-日本語-blue.svg)](https://github.com/nojaja/browser-git-ops/blob/main/README_ja.md)

# browser-git-ops

ブラウザネイティブで動作する Git 操作ライブラリです。`VirtualFS` とプラットフォームアダプタ（GitHub / GitLab）を提供し、永続化は OPFS、IndexedDB、インメモリの各バックエンドで実装されています。

- **Live Demo**: https://nojaja.github.io/browser-git-ops/

**[English](./README.md)** | **[日本語](./README_ja.md)

## 概要

![アーキテクチャ概要](docs/asset/browser-git-ops-overview.png)

## 主な機能

- **VirtualFS**: ローカルワークスペースのスナップショット化と変更セット（create/update/delete）の生成
- **複数のストレージバックエンド**:
  - `OpfsStorage` - Origin Private File System（OPFS）
  - `IndexedDatabaseStorage` - より広いブラウザ互換性を持つ IndexedDB
  - `InMemoryStorage` - テスト用インメモリストレージ
- **プラットフォームアダプタ**: `GitHubAdapter` と `GitLabAdapter` が Web API 経由で push/pull フローを実装
- **CORS フリー**: プロキシなしで直接 API 連携
- **TypeScript サポート**: 完全な型定義付き API

## v0.0.5: FS 互換 API

- `VirtualFS` に Node ライクなファイル操作メソッドを追加しました: `stat`, `unlink`, `mkdir`, `rmdir`, `readdir`。
- `Stats` に Git 識別子（`gitBlobSha`, `gitCommitSha`）を含めるようになりました。
- public な `deleteFile` は削除され、`unlink` を使用してください。

## ステータス

- ✅ VirtualFS コア機能（差分生成、index 管理、ローカル編集）
- ✅ OPFS・IndexedDB 用の永続化バックエンド
- ✅ GitHubAdapter の push/pull フロー
- ✅ GitLabAdapter の push/pull フロー

## インストール

### ライブラリ利用者向け（npm）

```bash
npm install browser-git-ops
```

### 開発者向け

```bash
git clone https://github.com/nojaja/browser-git-ops.git
cd browser-git-ops
npm ci
```

## 使い方

### 基本的な例

```typescript
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  // 1. OPFS バックエンドで VirtualFS を初期化
  const backend = new OpfsStorage('appname','my-workspace')
  const vfs = new VirtualFS({ backend })
  await vfs.init()

  // 2. アダプタを設定（GitHub または GitLab）
  await vfs.setAdapter({
    type: 'github',
    opts: {
      owner: 'your-username',
      repo: 'your-repo',
      token: 'your-github-token',
      branch: 'main'
    }
  })

  // 3. リモートから最新の内容を取得
  await vfs.pull({ ref: 'main' })

  // 4. ファイル一覧を取得
  const files = await vfs.readdir('.')
  console.log('ファイル:', files)

  // 5. ローカルで変更を行う
  await vfs.writeFile('README.md', '# Hello World')
  await vfs.writeFile('docs/guide.md', '## はじめに')

  // Stat（可能なら gitBlobSha/gitCommitSha を含む）
  // Stat: Node の fs.Stats に類似したオブジェクトを返します。
  // Git 管理下のファイルでは `gitBlobSha` / `gitCommitSha` / `gitRef` が追加されることがあります。
  const s = await vfs.stat('README.md')
  console.log('size=', s.size, 'isFile=', s.isFile())
  // Git 固有フィールド (追跡外ファイルでは undefined になる可能性があります)
  console.log('gitBlobSha=', s.gitBlobSha, 'gitCommitSha=', s.gitCommitSha, 'gitRef=', s.gitRef)

  // ファイル削除（deleteFile の代わりに unlink を使用）
  await vfs.unlink('docs/guide.md')

  // ディレクトリ作成 / 削除
  await vfs.mkdir('notes')
  await vfs.rmdir('notes', { recursive: true })

  // 6. 変更セットを取得
  const changes = await vfs.getChangeSet()
  console.log('変更:', changes)

  // 7. 変更をリモートにプッシュ
  const index = await vfs.getIndex()
  const result = await vfs.push({
    message: 'ドキュメントを更新'
  })
  console.log('プッシュ結果:', result)
}
```

### IndexedDB バックエンドの使用

```typescript
import { VirtualFS, IndexedDatabaseStorage } from 'browser-git-ops'

const backend = new IndexedDatabaseStorage('appname','my-workspace')
const vfs = new VirtualFS({ backend })
await vfs.init()
```

### GitLab アダプタの使用

```typescript
await vfs.setAdapter({
  type: 'gitlab',
  opts: {
    projectId: 'username/project',
    host: 'gitlab.com',
    token: 'your-gitlab-token',
    branch: 'main'
  }
})
```

### アダプタ設定 (`setAdapter`)

`VirtualFS` のアダプタは、以下のいずれかの呼び出し形式で設定できます。

- `await vfs.setAdapter({ type: 'github' | 'gitlab' | string, opts: { ... } })`

例:

```typescript
await vfs.setAdapter({
  type: 'github',
  opts: { owner: 'your-username', repo: 'your-repo', token: 'your-token', branch: 'main' }
})
```

- `await vfs.setAdapter(type: string, url: string, token?: string)`

例:

```typescript
await vfs.setAdapter('github', 'https://github.com/owner/repo', 'your-token')
```

- `await vfs.setAdapter(url: string)`

例:

```typescript
await vfs.setAdapter('https://gitlab.com/owner/project')
```

`url` 形式を与えた場合、ライブラリが URL を解析してアダプタ種別とオプションを決定します。`(type, url, token?)` 形式では `token` を第3引数で渡せます。

## 開発

### ビルド

```bash
npm run build       # ブラウザ向けバンドルと TypeScript 型定義を生成
```

以下が生成されます:
- `dist/index.js` - ブラウザ用 IIFE バンドル（グローバル `APIGitLib`）
- `dist/index.mjs` - ESM バンドル
- `dist/index.d.ts` - TypeScript 型定義

### テスト

```bash
npm run test        # ユニットテスト (Jest)
npm run test:spec   # 仕様テストのみ
npm run test:coverage # カバレッジレポート付きテスト
npm run test:e2e    # E2E テスト (Playwright)
npm run lint        # ESLint
```

### ドキュメント生成

```bash
npm run docs        # TypeDoc ドキュメントを生成
```

## プロジェクト構成

```
src/
├── index.ts                     # パッケージエントリポイント
├── virtualfs/
│   ├── virtualfs.ts            # VirtualFS コア実装
│   ├── opfsStorage.ts          # OPFS ストレージバックエンド
│   ├── indexedDatabaseStorage.ts # IndexedDB ストレージバックエンド
│   ├── inmemoryStorage.ts      # インメモリストレージ（テスト用）
│   ├── changeTracker.ts        # 変更検出・追跡
│   ├── conflictManager.ts      # マージ競合解決
│   ├── indexManager.ts         # インデックスファイル管理
│   └── types.ts                # 型定義
└── git/
    ├── abstractAdapter.ts      # ベースアダプタインターフェース
    ├── githubAdapter.ts        # GitHub API アダプタ
    └── gitlabAdapter.ts        # GitLab API アダプタ

examples/                        # ブラウザデモアプリケーション
test/
├── unit/                        # Jest ユニットテスト
└── e2e/                         # Playwright E2E テスト
```

## 設定

### GitHub アダプタ

GitHub アダプタを使用するには以下が必要です:
- **Personal Access Token**（`repo` スコープ付き）
- リポジトリのオーナーと名前
- 対象ブランチ（デフォルト: `main`）

### GitLab アダプタ

GitLab アダプタを使用するには以下が必要です:
- **Personal Access Token** または **Project Access Token**
- プロジェクト ID（形式: `username/project` または数値 ID）
- GitLab インスタンスホスト（デフォルト: `gitlab.com`）
- 対象ブランチ（デフォルト: `main`）

### ブラウザ互換性

- **OPFS**: OPFS をサポートするモダンブラウザが必要（Chrome 102+, Edge 102+）
- **IndexedDB**: より広い互換性、ほとんどのモダンブラウザで動作
- **CORS**: プロキシ不要 - 直接 API 認証を使用

## API リファレンス

- [docs/typedoc-md/README.md](docs/typedoc-md/README.md) を参照してください。

### VirtualFS

ファイルシステム操作のメインクラス。

```typescript
class VirtualFS {
  constructor(options?: { backend?: StorageBackend; logger?: Logger })
  
  // 初期化
  async init(): Promise<void>
  
  // ファイル操作
  async writeFile(path: string, content: string): Promise<void>
  async readFile(path: string): Promise<string>
  async unlink(path: string): Promise<void>
  async renameFile(fromPath: string, toPath: string): Promise<void>
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>
  
  // 変更管理
  async getChangeSet(): Promise<ChangeItem[]>
  async revertChanges(): Promise<void>
  
  // リモート同期
  async setAdapter(meta: { type: 'github' | 'gitlab' | string, opts?: any}): Promise<void>
  async getAdapter(): Promise<{ type: string, opts?: any } | null>
  async getAdapterInstance(): Promise<any | null>
  getAdapterMeta(): { type: string, opts?: any } | null
  async pull(reference?: string, baseSnapshot?: Record<string, string>): Promise<any>
  async push(input: CommitInput): Promise<any>
  
  // 競合解決
  async getConflicts(): Promise<ConflictItem[]>
  async resolveConflict(path: string, resolution: 'local' | 'remote'): Promise<void>
  
  // インデックス管理
  async getIndex(): Promise<IndexFile>
  async saveIndex(): Promise<void>
}

// `vfs.stat(path)` が返す Stats 相当オブジェクトは Node.js の `fs.Stats` に類似した標準フィールドを持ち、
// 必要に応じて Git 固有の識別子を含みます（実装参照）。情報例:
// interface FsStatsLike {
//   dev: number; ino: number; mode: number; nlink: number; uid: number; gid: number;
//   size: number; atime: Date; mtime: Date; ctime: Date; birthtime: Date;
//   isFile(): boolean; isDirectory(): boolean;
//   // Git 固有（任意）:
//   gitBlobSha?: string; // トラッキングされているファイルの blob SHA
//   gitCommitSha?: string; // そのパスに対する最新コミット SHA
//   gitRef?: string; // 参照（branch 等）を示す文字列
// }
```

#### アダプタ取得と管理

```typescript
// アダプタメタデータを取得（インスタンスではなく設定情報）
async getAdapter(): Promise<{ type: string, opts?: any } | null>
// 例：
const meta = await vfs.getAdapter()
if (meta) {
  console.log('Adapter type:', meta.type)
  console.log('Branch:', meta.opts?.branch)
  console.log('Owner:', meta.opts?.owner) // GitHub の場合
}

// キャッシュされたアダプタメタデータを同期的に取得
getAdapterMeta(): { type: string, opts?: any } | null
// 例：
const meta = vfs.getAdapterMeta()

// アダプタインスタンスを取得または作成（遅延初期化）
async getAdapterInstance(): Promise<any | null>
// 例：
const adapter = await vfs.getAdapterInstance()
if (adapter) {
  // adapter.resolveRef、adapter.push 等のメソッドを利用可能
}
```

**注**: 
- `getAdapter()` と `getAdapterInstance()` は異なります
- `getAdapter()` は永続化されたメタデータ（type と opts）を返します
- `getAdapterInstance()` はメタデータからアダプタインスタンスを作成・取得します
- `getAdapterMeta()` はキャッシュされたメタデータを同期的に返します（Promise なし）

### ストレージバックエンド

```typescript
// OPFS バックエンド
class OpfsStorage implements StorageBackend {
  constructor(namespace: string, rootName?: string)
}

// IndexedDB バックエンド
class IndexedDatabaseStorage implements StorageBackend {
  constructor(namespace: string, rootName?: string)
}

// インメモリバックエンド（テスト用）
class InMemoryStorage implements StorageBackend {
  constructor(namespace: string, rootName?: string)
}
```

### プラットフォームアダプタ

```typescript
// GitHub アダプタ
class GitHubAdapter {
  constructor(options: {
    owner: string
    repo: string
    token: string
    branch: string
  })
}

// GitLab アダプタ
class GitLabAdapter {
  constructor(options: {
    projectId: string
    host: string
    token: string
    branch: string
  })
}
```

## 例

[`examples/`](examples/) ディレクトリには以下が含まれます:
- UI 付きインタラクティブなブラウザデモ
- Playwright E2E テストシナリオ
- 複数のストレージバックエンドの例

## 貢献

貢献を歓迎します！以下のガイドラインに従ってください:

1. **Issue を開く**: 大きな変更の場合は、まず Issue を開いて提案を議論してください
2. **規約に従う**: 
   - TypeScript を使用
   - ESLint ルールに従う（`npm run lint`）
   - 新機能にはテストを書く
   - ドキュメントを必要に応じて更新
3. **テスト**: PR を送信する前にすべてのテストが通ることを確認
   ```bash
   npm run lint
   npm run build
   npm run test
   npm run test:e2e
   ```

## サポート

- **Issue**: https://github.com/nojaja/browser-git-ops/issues
- **ディスカッション**: https://github.com/nojaja/browser-git-ops/discussions
- **ドキュメント**: https://nojaja.github.io/browser-git-ops/

## ライセンス

MIT ライセンス - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 作者

[nojaja](https://github.com/nojaja) が管理（[free.riccia@gmail.com](mailto:free.riccia@gmail.com)）

## 謝辞

このプロジェクトは以下を使用しています:
- OPFS（Origin Private File System）による永続化ストレージ
- GitHub および GitLab Web API によるリモート同期
- Jest によるユニットテスト
- Playwright による E2E テスト
