browser-git-ops

# browser-git-ops - v0.0.7

## Table of contents

### References

- [default](README.md#default)

### Classes

- [GitHubAdapter](classes/GitHubAdapter.md)
- [GitLabAdapter](classes/GitLabAdapter.md)
- [VirtualFS](classes/VirtualFS.md)

### Interfaces

- [AdapterMeta](interfaces/AdapterMeta.md)
- [AdapterOptionsBase](interfaces/AdapterOptionsBase.md)
- [CommitInput](interfaces/CommitInput.md)
- [CommitResult](interfaces/CommitResult.md)
- [GitAdapter](interfaces/GitAdapter.md)
- [GitChange](interfaces/GitChange.md)
- [GitHubAdapterOptions](interfaces/GitHubAdapterOptions.md)
- [GitLabAdapterOptions](interfaces/GitLabAdapterOptions.md)
- [IndexEntry](interfaces/IndexEntry.md)
- [IndexFile](interfaces/IndexFile.md)
- [Logger](interfaces/Logger.md)
- [StorageBackend](interfaces/StorageBackend.md)
- [StorageBackendConstructor](interfaces/StorageBackendConstructor.md)

### Type Aliases

- [AdapterOptions](README.md#adapteroptions)
- [BranchInfo](README.md#branchinfo)
- [BranchListPage](README.md#branchlistpage)
- [BranchListQuery](README.md#branchlistquery)
- [CommitHistoryPage](README.md#commithistorypage)
- [CommitHistoryQuery](README.md#commithistoryquery)
- [CommitSummary](README.md#commitsummary)
- [CreateBranchInput](README.md#createbranchinput)
- [CreateBranchResult](README.md#createbranchresult)
- [FileState](README.md#filestate)
- [GHOptions](README.md#ghoptions)
- [GLOptions](README.md#gloptions)
- [RemoteSnapshotDescriptor](README.md#remotesnapshotdescriptor)
- [RepositoryMetadata](README.md#repositorymetadata)
- [Segment](README.md#segment)
- [VfsChange](README.md#vfschange)

### Variables

- [InMemoryStorage](README.md#inmemorystorage)
- [IndexedDatabaseStorage](README.md#indexeddatabasestorage)
- [OpfsStorage](README.md#opfsstorage)

## References

### default

Renames and re-exports [VirtualFS](classes/VirtualFS.md)

## Type Aliases

### AdapterOptions

Ƭ **AdapterOptions**: [`GitHubAdapterOptions`](interfaces/GitHubAdapterOptions.md) \| [`GitLabAdapterOptions`](interfaces/GitLabAdapterOptions.md)

#### Defined in

[virtualfs/types.ts:40](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L40)

___

### BranchInfo

Ƭ **BranchInfo**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `commit` | \{ `sha`: `string` ; `url`: `string`  } |
| `commit.sha` | `string` |
| `commit.url` | `string` |
| `isDefault` | `boolean` |
| `name` | `string` |
| `protected` | `boolean` |

#### Defined in

[virtualfs/types.ts:75](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L75)

___

### BranchListPage

Ƭ **BranchListPage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `items` | [`BranchInfo`](README.md#branchinfo)[] |
| `lastPage?` | `number` |
| `nextPage?` | `number` |

#### Defined in

[virtualfs/types.ts:90](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L90)

___

### BranchListQuery

Ƭ **BranchListQuery**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `page?` | `number` |
| `perPage?` | `number` |

#### Defined in

[virtualfs/types.ts:85](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L85)

___

### CommitHistoryPage

Ƭ **CommitHistoryPage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `items` | [`CommitSummary`](README.md#commitsummary)[] |
| `lastPage?` | `number` |
| `nextPage?` | `number` |

#### Defined in

[git/adapter.ts:26](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/git/adapter.ts#L26)

___

### CommitHistoryQuery

Ƭ **CommitHistoryQuery**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `page?` | `number` |
| `perPage?` | `number` |
| `ref` | `string` |

#### Defined in

[git/adapter.ts:12](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/git/adapter.ts#L12)

___

### CommitSummary

Ƭ **CommitSummary**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `author` | `string` |
| `date` | `string` |
| `message` | `string` |
| `parents` | `string`[] |
| `sha` | `string` |

#### Defined in

[git/adapter.ts:18](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/git/adapter.ts#L18)

___

### CreateBranchInput

Ƭ **CreateBranchInput**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `fromRef?` | `string` |
| `name` | `string` |

#### Defined in

[virtualfs/types.ts:103](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L103)

___

### CreateBranchResult

Ƭ **CreateBranchResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `ref` | `string` |
| `sha` | `string` |

#### Defined in

[virtualfs/types.ts:108](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L108)

___

### FileState

Ƭ **FileState**: ``"base"`` \| ``"modified"`` \| ``"added"`` \| ``"deleted"`` \| ``"conflict"``

#### Defined in

[virtualfs/types.ts:1](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L1)

___

### GHOptions

Ƭ **GHOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `host?` | `string` |
| `owner` | `string` |
| `repo` | `string` |
| `token` | `string` |

#### Defined in

[git/githubAdapter.ts:4](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/git/githubAdapter.ts#L4)

___

### GLOptions

Ƭ **GLOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `host?` | `string` |
| `projectId` | `string` |
| `token` | `string` |

#### Defined in

[git/gitlabAdapter.ts:4](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/git/gitlabAdapter.ts#L4)

___

### RemoteSnapshotDescriptor

Ƭ **RemoteSnapshotDescriptor**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `fetchContent` | (`_paths`: `string`[]) => `Promise`\<`Record`\<`string`, `string`\>\> |
| `headSha` | `string` |
| `shas` | `Record`\<`string`, `string`\> |

#### Defined in

[virtualfs/virtualfs.ts:18](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/virtualfs.ts#L18)

___

### RepositoryMetadata

Ƭ **RepositoryMetadata**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `defaultBranch` | `string` |
| `id?` | `string` \| `number` |
| `name` | `string` |

#### Defined in

[virtualfs/types.ts:96](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L96)

___

### Segment

Ƭ **Segment**: ``"workspace"`` \| ``"base"`` \| ``"conflict"`` \| ``"conflictBlob"`` \| ``"info"`` \| ``"info-workspace"`` \| ``"info-git"``

Storage セグメント

#### Defined in

[virtualfs/storageBackend.ts:6](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/storageBackend.ts#L6)

___

### VfsChange

Ƭ **VfsChange**: \{ `content`: `string` ; `path`: `string` ; `type`: ``"create"``  } \| \{ `baseSha`: `string` ; `content`: `string` ; `path`: `string` ; `type`: ``"update"``  } \| \{ `baseSha`: `string` ; `path`: `string` ; `type`: ``"delete"``  }

#### Defined in

[virtualfs/types.ts:60](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/types.ts#L60)

## Variables

### InMemoryStorage

• `Const` **InMemoryStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

テストや軽量動作検証用のインメモリ実装。
`StorageBackend` を実装し、アプリケーション側で差し替えて利用できます。

#### Defined in

[virtualfs/inmemoryStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/inmemoryStorage.ts#L14)

___

### IndexedDatabaseStorage

• `Const` **IndexedDatabaseStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

IndexedDB を用いた永続化実装

#### Defined in

[virtualfs/indexedDatabaseStorage.ts:7](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/indexedDatabaseStorage.ts#L7)

___

### OpfsStorage

• `Const` **OpfsStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

OPFS (origin private file system) を利用する永続化実装

#### Defined in

[virtualfs/opfsStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/c51cf29673a6f5165e49aea29ccb5792f2611947/src/virtualfs/opfsStorage.ts#L14)
