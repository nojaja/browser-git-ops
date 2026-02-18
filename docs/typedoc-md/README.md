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
- [CommitInput](interfaces/CommitInput.md)
- [CommitResult](interfaces/CommitResult.md)
- [GitAdapter](interfaces/GitAdapter.md)
- [GitChange](interfaces/GitChange.md)
- [IndexEntry](interfaces/IndexEntry.md)
- [IndexFile](interfaces/IndexFile.md)
- [Logger](interfaces/Logger.md)
- [StorageBackend](interfaces/StorageBackend.md)
- [StorageBackendConstructor](interfaces/StorageBackendConstructor.md)

### Type Aliases

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

[virtualfs/types.ts:55](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L55)

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

[virtualfs/types.ts:70](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L70)

___

### BranchListQuery

Ƭ **BranchListQuery**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `page?` | `number` |
| `perPage?` | `number` |

#### Defined in

[virtualfs/types.ts:65](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L65)

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

[git/adapter.ts:26](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/adapter.ts#L26)

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

[git/adapter.ts:12](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/adapter.ts#L12)

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

[git/adapter.ts:18](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/adapter.ts#L18)

___

### CreateBranchInput

Ƭ **CreateBranchInput**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `fromRef?` | `string` |
| `name` | `string` |

#### Defined in

[virtualfs/types.ts:83](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L83)

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

[virtualfs/types.ts:88](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L88)

___

### FileState

Ƭ **FileState**: ``"base"`` \| ``"modified"`` \| ``"added"`` \| ``"deleted"`` \| ``"conflict"``

#### Defined in

[virtualfs/types.ts:1](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L1)

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

[git/githubAdapter.ts:4](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L4)

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

[git/gitlabAdapter.ts:4](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/gitlabAdapter.ts#L4)

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

[virtualfs/virtualfs.ts:18](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L18)

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

[virtualfs/types.ts:76](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L76)

___

### Segment

Ƭ **Segment**: ``"workspace"`` \| ``"base"`` \| ``"conflict"`` \| ``"conflictBlob"`` \| ``"info"`` \| ``"info-workspace"`` \| ``"info-git"``

Storage セグメント

#### Defined in

[virtualfs/storageBackend.ts:6](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/storageBackend.ts#L6)

___

### VfsChange

Ƭ **VfsChange**: \{ `content`: `string` ; `path`: `string` ; `type`: ``"create"``  } \| \{ `baseSha`: `string` ; `content`: `string` ; `path`: `string` ; `type`: ``"update"``  } \| \{ `baseSha`: `string` ; `path`: `string` ; `type`: ``"delete"``  }

#### Defined in

[virtualfs/types.ts:40](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/types.ts#L40)

## Variables

### InMemoryStorage

• `Const` **InMemoryStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

テストや軽量動作検証用のインメモリ実装。
`StorageBackend` を実装し、アプリケーション側で差し替えて利用できます。

#### Defined in

[virtualfs/inmemoryStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/inmemoryStorage.ts#L14)

___

### IndexedDatabaseStorage

• `Const` **IndexedDatabaseStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

IndexedDB を用いた永続化実装

#### Defined in

[virtualfs/indexedDatabaseStorage.ts:7](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/indexedDatabaseStorage.ts#L7)

___

### OpfsStorage

• `Const` **OpfsStorage**: [`StorageBackendConstructor`](interfaces/StorageBackendConstructor.md)

OPFS (origin private file system) を利用する永続化実装

#### Defined in

[virtualfs/opfsStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/opfsStorage.ts#L14)
