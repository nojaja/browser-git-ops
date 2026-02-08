[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nojaja/browser-git-ops) [![日本語ドキュメント](https://img.shields.io/badge/docs-日本語-blue.svg)](https://github.com/nojaja/browser-git-ops/blob/main/README_ja.md)

# browser-git-ops

A browser-native Git operations library that provides a VirtualFS and platform adapters for GitHub and GitLab. It implements multiple persistent backends (OPFS, IndexedDB, and an in-memory backend) and abstracts them behind a common VirtualFS API.

- **Live Demo**: https://nojaja.github.io/browser-git-ops/

**[English](./README.md)** | **[日本語](./README_ja.md)**

## Overview

![Architecture Overview](docs/asset/browser-git-ops-overview.png)

## Key Features

- **VirtualFS**: Local workspace snapshotting and change-set generation (create/update/delete)
- **Multiple Storage Backends**:
  - `OpfsStorage` - Origin Private File System (OPFS)
  - `IndexedDatabaseStorage` - IndexedDB for broader browser compatibility
  - `InMemoryStorage` - In-memory storage for testing
- **Platform Adapters**: `GitHubAdapter` and `GitLabAdapter` implementing common push/pull flows via Web APIs
- **CORS-Free Operations**: Direct API integration without proxy workarounds
- **TypeScript Support**: Fully typed API with TypeScript definitions

## Status

- ✅ Core VirtualFS functionality (delta generation, index management, local edits)
- ✅ Persistence backends for OPFS and IndexedDB
- ✅ GitHubAdapter with primary push/pull flows
- ✅ GitLabAdapter with primary push/pull flows

## Installation

### For Library Consumers (npm)

```bash
npm install browser-git-ops
```

### For Development

```bash
git clone https://github.com/nojaja/browser-git-ops.git
cd browser-git-ops
npm ci
```

## Usage

### Basic Example

```typescript
import { VirtualFS, OpfsStorage, GitHubAdapter } from 'browser-git-ops'

async function example() {
  // 1. Initialize VirtualFS with OPFS backend
  const backend = new OpfsStorage('my-workspace')
  const vfs = new VirtualFS({ backend })
  await vfs.init()

  // 2. Configure adapter (GitHub or GitLab)
  await vfs.setAdapter(null, {
    type: 'github',
    opts: {
      owner: 'your-username',
      repo: 'your-repo',
      token: 'your-github-token',
      branch: 'main'
    }
  })

  // 3. Pull latest content from remote
  await vfs.pull()

  // 4. List files
  const files = await vfs.listPaths()
  console.log('Files:', files)

  // 5. Make local changes
  await vfs.writeFile('README.md', '# Hello World')
  await vfs.writeFile('docs/guide.md', '## Getting Started')

  // 6. Get change set
  const changes = await vfs.getChangeSet()
  console.log('Changes:', changes)

  // 7. Push changes to remote
  const index = await vfs.getIndex()
  const result = await vfs.push({
    parentSha: index.head,
    message: 'Update documentation',
    changes: changes
  })
  console.log('Push result:', result)
}
```

### Using IndexedDB Backend

```typescript
import { VirtualFS, IndexedDatabaseStorage } from 'browser-git-ops'

const backend = new IndexedDatabaseStorage('my-workspace')
const vfs = new VirtualFS({ backend })
await vfs.init()
```

### Using GitLab Adapter

```typescript
await vfs.setAdapter(null, {
  type: 'gitlab',
  opts: {
    projectId: 'username/project',
    host: 'gitlab.com',
    token: 'your-gitlab-token',
    branch: 'main'
  }
})
```

## Development

### Build

```bash
npm run build       # Build browser bundles and TypeScript definitions
```

This generates:
- `dist/index.js` - IIFE bundle for browser (global `APIGitLib`)
- `dist/index.mjs` - ESM bundle
- `dist/index.d.ts` - TypeScript definitions

### Testing

```bash
npm run test        # Unit tests (Jest)
npm run test:spec   # Specification tests only
npm run test:coverage # Tests with coverage report
npm run test:e2e    # E2E tests (Playwright)
npm run lint        # ESLint
```

### Documentation

```bash
npm run docs        # Generate TypeDoc documentation
```

## Project Structure

```
src/
├── index.ts                     # Package entry point
├── virtualfs/
│   ├── virtualfs.ts            # VirtualFS core implementation
│   ├── opfsStorage.ts          # OPFS storage backend
│   ├── indexedDatabaseStorage.ts # IndexedDB storage backend
│   ├── inmemoryStorage.ts      # In-memory storage (for testing)
│   ├── changeTracker.ts        # Change detection and tracking
│   ├── conflictManager.ts      # Merge conflict resolution
│   ├── indexManager.ts         # Index file management
│   └── types.ts                # Type definitions
└── git/
    ├── abstractAdapter.ts      # Base adapter interface
    ├── githubAdapter.ts        # GitHub API adapter
    └── gitlabAdapter.ts        # GitLab API adapter

examples/                        # Browser demo application
test/
├── unit/                        # Jest unit tests
└── e2e/                         # Playwright E2E tests
```

## Configuration

### GitHub Adapter

To use the GitHub adapter, you need:
- **Personal Access Token** with `repo` scope
- Repository owner and name
- Target branch (default: `main`)

### GitLab Adapter

To use the GitLab adapter, you need:
- **Personal Access Token** or **Project Access Token**
- Project ID (format: `username/project` or numeric ID)
- GitLab instance host (default: `gitlab.com`)
- Target branch (default: `main`)

### Browser Compatibility

- **OPFS**: Requires modern browsers with OPFS support (Chrome 102+, Edge 102+)
- **IndexedDB**: Broader compatibility, works in most modern browsers
- **CORS**: No proxy required - uses direct API authentication

## API Reference

- See [docs/typedoc-md/README.md](docs/typedoc-md/README.md).

### VirtualFS

Main class for file system operations.

```typescript
class VirtualFS {
  constructor(options?: { backend?: StorageBackend; logger?: Logger })
  
  // Initialization
  async init(): Promise<void>
  
  // File Operations
  async writeFile(path: string, content: string): Promise<void>
  async readFile(path: string): Promise<string>
  async deleteFile(path: string): Promise<void>
  async renameFile(fromPath: string, toPath: string): Promise<void>
  async listPaths(): Promise<string[]>
  
  // Change Management
  async getChangeSet(): Promise<ChangeItem[]>
  async revertChanges(): Promise<void>
  
  // Remote Synchronization
  async setAdapter(adapter: any, meta?: any): Promise<void>
  async pull(reference?: string, baseSnapshot?: Record<string, string>): Promise<any>
  async push(input: CommitInput): Promise<any>
  
  // Conflict Resolution
  async getConflicts(): Promise<ConflictItem[]>
  async resolveConflict(path: string, resolution: 'local' | 'remote'): Promise<void>
  
  // Index Management
  async getIndex(): Promise<IndexFile>
  async saveIndex(): Promise<void>
}
```

### Storage Backends

```typescript
// OPFS Backend
class OpfsStorage implements StorageBackend {
  constructor(rootName?: string)
}

// IndexedDB Backend
class IndexedDatabaseStorage implements StorageBackend {
  constructor(rootName?: string)
}

// In-Memory Backend (for testing)
class InMemoryStorage implements StorageBackend {
  constructor()
}
```

### Platform Adapters

```typescript
// GitHub Adapter
class GitHubAdapter {
  constructor(options: {
    owner: string
    repo: string
    token: string
    branch: string
  })
}

// GitLab Adapter
class GitLabAdapter {
  constructor(options: {
    projectId: string
    host: string
    token: string
    branch: string
  })
}
```

## Examples

See the [`examples/`](examples/) directory for:
- Interactive browser demo with UI
- Playwright E2E test scenarios
- Multiple storage backend examples

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Open an Issue**: For significant changes, please open an issue first to discuss your proposal
2. **Follow Conventions**: 
   - Use TypeScript
   - Follow ESLint rules (`npm run lint`)
   - Write tests for new features
   - Update documentation as needed
3. **Testing**: Ensure all tests pass before submitting PR
   ```bash
   npm run lint
   npm run build
   npm run test
   npm run test:e2e
   ```

## Support

- **Issues**: https://github.com/nojaja/browser-git-ops/issues
- **Discussions**: https://github.com/nojaja/browser-git-ops/discussions
- **Documentation**: https://nojaja.github.io/browser-git-ops/

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Maintained by [nojaja](https://github.com/nojaja) ([free.riccia@gmail.com](mailto:free.riccia@gmail.com))

## Acknowledgments

This project uses:
- OPFS (Origin Private File System) for persistent storage
- GitHub and GitLab Web APIs for remote synchronization
- Jest for unit testing
- Playwright for E2E testing
