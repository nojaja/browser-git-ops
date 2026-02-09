browser-git-ops

# browser-git-ops - v0.0.5

## Table of contents

### References

- [default](README.md#default)

### Classes

- [GitHubAdapter](classes/GitHubAdapter.md)
- [GitLabAdapter](classes/GitLabAdapter.md)
- [VirtualFS](classes/VirtualFS.md)

### Variables

- [InMemoryStorage](README.md#inmemorystorage)
- [IndexedDatabaseStorage](README.md#indexeddatabasestorage)
- [OpfsStorage](README.md#opfsstorage)

## References

### default

Renames and re-exports [VirtualFS](classes/VirtualFS.md)

## Variables

### InMemoryStorage

• `Const` **InMemoryStorage**: `StorageBackendConstructor`

テストや軽量動作検証用のインメモリ実装。
`StorageBackend` を実装し、アプリケーション側で差し替えて利用できます。

#### Defined in

[virtualfs/inmemoryStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/120a529ffcd2a0010aefcdc242162a73a943581e/src/virtualfs/inmemoryStorage.ts#L14)

___

### IndexedDatabaseStorage

• `Const` **IndexedDatabaseStorage**: `StorageBackendConstructor`

IndexedDB を用いた永続化実装

#### Defined in

[virtualfs/indexedDatabaseStorage.ts:7](https://github.com/nojaja/browser-git-ops/blob/120a529ffcd2a0010aefcdc242162a73a943581e/src/virtualfs/indexedDatabaseStorage.ts#L7)

___

### OpfsStorage

• `Const` **OpfsStorage**: `StorageBackendConstructor`

OPFS (origin private file system) を利用する永続化実装

#### Defined in

[virtualfs/opfsStorage.ts:14](https://github.com/nojaja/browser-git-ops/blob/120a529ffcd2a0010aefcdc242162a73a943581e/src/virtualfs/opfsStorage.ts#L14)
