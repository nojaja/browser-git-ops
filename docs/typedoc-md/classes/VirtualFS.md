[browser-git-ops - v0.0.7](../README.md) / VirtualFS

# Class: VirtualFS

Virtual file system - 永続化バックエンドを抽象化した仮想ファイルシステム

## Table of contents

### Constructors

- [constructor](VirtualFS.md#constructor)

### Accessors

- [head](VirtualFS.md#head)
- [lastCommitKey](VirtualFS.md#lastcommitkey)

### Methods

- [createBranch](VirtualFS.md#createbranch)
- [getAdapter](VirtualFS.md#getadapter)
- [getAdapterInstance](VirtualFS.md#getadapterinstance)
- [getAdapterMeta](VirtualFS.md#getadaptermeta)
- [getChangeSet](VirtualFS.md#getchangeset)
- [getDefaultBranch](VirtualFS.md#getdefaultbranch)
- [getIndex](VirtualFS.md#getindex)
- [getRemoteDiffs](VirtualFS.md#getremotediffs)
- [init](VirtualFS.md#init)
- [listBranches](VirtualFS.md#listbranches)
- [listCommits](VirtualFS.md#listcommits)
- [mkdir](VirtualFS.md#mkdir)
- [pull](VirtualFS.md#pull)
- [push](VirtualFS.md#push)
- [readConflict](VirtualFS.md#readconflict)
- [readFile](VirtualFS.md#readfile)
- [readdir](VirtualFS.md#readdir)
- [renameFile](VirtualFS.md#renamefile)
- [resolveConflict](VirtualFS.md#resolveconflict)
- [rmdir](VirtualFS.md#rmdir)
- [setAdapter](VirtualFS.md#setadapter)
- [stat](VirtualFS.md#stat)
- [unlink](VirtualFS.md#unlink)
- [writeFile](VirtualFS.md#writefile)

## Constructors

### constructor

• **new VirtualFS**(`options?`): [`VirtualFS`](VirtualFS.md)

VirtualFS のインスタンスを初期化します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options?` | `Object` | オプションセット |
| `options.backend?` | [`StorageBackend`](../interfaces/StorageBackend.md) | ストレージバックエンド |
| `options.logger?` | [`Logger`](../interfaces/Logger.md) | ロガーインスタンス |

#### Returns

[`VirtualFS`](VirtualFS.md)

#### Defined in

[virtualfs/virtualfs.ts:49](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L49)

## Accessors

### head

• `get` **head**(): `string`

public-facing property accessors for backwards compatibility with tests

#### Returns

`string`

#### Defined in

[virtualfs/virtualfs.ts:66](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L66)

• `set` **head**(`h`): `void`

Setter for head

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `h` | `string` | head value |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:75](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L75)

___

### lastCommitKey

• `get` **lastCommitKey**(): `undefined` \| `string`

Get lastCommitKey

#### Returns

`undefined` \| `string`

#### Defined in

[virtualfs/virtualfs.ts:83](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L83)

• `set` **lastCommitKey**(`k`): `void`

Set lastCommitKey

#### Parameters

| Name | Type |
| :------ | :------ |
| `k` | `undefined` \| `string` |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:92](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L92)

## Methods

### createBranch

▸ **createBranch**(`input`): `Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

Create a remote-only branch via the configured adapter.

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`CreateBranchInput`](../README.md#createbranchinput) |

#### Returns

`Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

#### Defined in

[virtualfs/virtualfs.ts:1297](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1297)

___

### getAdapter

▸ **getAdapter**(): `Promise`\<`any`\>

Return persisted adapter metadata from the index (or cached meta).
This does not necessarily instantiate the adapter instance; use
`getAdapterInstance()` to obtain an instantiated adapter.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:208](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L208)

___

### getAdapterInstance

▸ **getAdapterInstance**(): `Promise`\<`any`\>

Return or lazily create the adapter instance based on persisted metadata.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:230](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L230)

___

### getAdapterMeta

▸ **getAdapterMeta**(): `any`

Return persisted adapter metadata (if any).

#### Returns

`any`

#### Defined in

[virtualfs/virtualfs.ts:583](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L583)

___

### getChangeSet

▸ **getChangeSet**(): `Promise`\<`any`[]\>

ワークスペースとインデックスから変更セットを生成します。

#### Returns

`Promise`\<`any`[]\>

変更リスト

#### Defined in

[virtualfs/virtualfs.ts:892](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L892)

___

### getDefaultBranch

▸ **getDefaultBranch**(): `Promise`\<``null`` \| `string`\>

Convenience to get default branch name from adapter repository metadata.
Returns null when adapter not available.

#### Returns

`Promise`\<``null`` \| `string`\>

#### Defined in

[virtualfs/virtualfs.ts:1365](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1365)

___

### getIndex

▸ **getIndex**(): `Promise`\<[`IndexFile`](../interfaces/IndexFile.md)\>

インデックス情報を返します。

#### Returns

`Promise`\<[`IndexFile`](../interfaces/IndexFile.md)\>

#### Defined in

[virtualfs/virtualfs.ts:866](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L866)

___

### getRemoteDiffs

▸ **getRemoteDiffs**(`remote?`): `Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| [`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor) ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

Obtain remote snapshot (via persisted adapter if available) and
compute simple diffs against the current index.
Returns an object containing the resolved `remote` descriptor (or null),
`remoteShas` map and `diffs` array (strings like `added: path` / `updated: path`).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `remote?` | `string` \| [`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor) \| \{ `fetchSnapshot`: () => `Promise`\<[`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor)\>  } | remote descriptor |

#### Returns

`Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| [`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor) ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

#### Defined in

[virtualfs/virtualfs.ts:1234](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1234)

___

### init

▸ **init**(): `Promise`\<`void`\>

VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:100](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L100)

___

### listBranches

▸ **listBranches**(`query?`): `Promise`\<[`BranchListPage`](../README.md#branchlistpage)\>

Delegate branch listing to the underlying adapter when available.

#### Parameters

| Name | Type |
| :------ | :------ |
| `query?` | [`BranchListQuery`](../README.md#branchlistquery) |

#### Returns

`Promise`\<[`BranchListPage`](../README.md#branchlistpage)\>

#### Defined in

[virtualfs/virtualfs.ts:1279](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1279)

___

### listCommits

▸ **listCommits**(`query`): `Promise`\<[`CommitHistoryPage`](../README.md#commithistorypage)\>

Delegate commit history listing to the underlying adapter when available.
Thin passthrough used by UI/CLI to retrieve commit summaries and paging info.

#### Parameters

| Name | Type |
| :------ | :------ |
| `query` | [`CommitHistoryQuery`](../README.md#commithistoryquery) |

#### Returns

`Promise`\<[`CommitHistoryPage`](../README.md#commithistorypage)\>

#### Defined in

[virtualfs/virtualfs.ts:1266](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1266)

___

### mkdir

▸ **mkdir**(`dirpath`, `_options?`): `Promise`\<`void`\>

fs.mkdir 互換 (簡易実装): workspace 側にディレクトリ情報を書き込む

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `dirpath` | `string` | ディレクトリパス |
| `_options?` | `Object` | optional options |
| `_options.mode?` | `number` | mode flag |
| `_options.recursive?` | `boolean` | recursive flag |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:707](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L707)

___

### pull

▸ **pull**(`remote`, `baseSnapshot?`): `Promise`\<`any`\>

リモートのスナップショットを取り込み、コンフリクト情報を返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `remote` | `string` \| [`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor) \| \{ `fetchSnapshot`: () => `Promise`\<[`RemoteSnapshotDescriptor`](../README.md#remotesnapshotdescriptor)\>  } | リモート情報 |
| `baseSnapshot?` | `Record`\<`string`, `string`\> | path->content マップ |

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:1031](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1031)

___

### push

▸ **push**(`input`): `Promise`\<\{ `commitSha`: `string`  }\>

変更をコミットしてリモートへ反映します。adapter が無ければローカルシミュレーションします。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `input` | [`CommitInput`](../interfaces/CommitInput.md) | コミット入力 |

#### Returns

`Promise`\<\{ `commitSha`: `string`  }\>

#### Defined in

[virtualfs/virtualfs.ts:1502](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L1502)

___

### readConflict

▸ **readConflict**(`filepath`): `Promise`\<``null`` \| `string`\>

衝突ファイル（.git-conflict/配下）を取得します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<``null`` \| `string`\>

ファイル内容または null

#### Defined in

[virtualfs/virtualfs.ts:648](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L648)

___

### readFile

▸ **readFile**(`filepath`): `Promise`\<``null`` \| `string`\>

ワークスペース/ベースからファイル内容を読み出します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<``null`` \| `string`\>

ファイル内容または null

#### Defined in

[virtualfs/virtualfs.ts:623](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L623)

___

### readdir

▸ **readdir**(`dirpath`, `options?`): `Promise`\<`any`[]\>

fs.readdir 互換 (簡易実装)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `dirpath` | `string` | ディレクトリパス |
| `options?` | `Object` | optional options |
| `options.withFileTypes?` | `boolean` | withFileTypes flag |

#### Returns

`Promise`\<`any`[]\>

file names or Dirent array

#### Defined in

[virtualfs/virtualfs.ts:769](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L769)

___

### renameFile

▸ **renameFile**(`from`, `to`): `Promise`\<`void`\>

rename を delete + create の合成で行うヘルパ

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `from` | `string` | 元パス |
| `to` | `string` | 新パス |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:606](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L606)

___

### resolveConflict

▸ **resolveConflict**(`filepath`): `Promise`\<`boolean`\>

指定パスのリモート衝突ファイル (.git-conflict/) を削除して
競合を解消済とマークします。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<`boolean`\>

成功したら true

#### Defined in

[virtualfs/virtualfs.ts:838](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L838)

___

### rmdir

▸ **rmdir**(`dirpath`, `options?`): `Promise`\<`void`\>

fs.rmdir 互換 (簡易実装)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `dirpath` | `string` | ディレクトリパス |
| `options?` | `Object` | optional options |
| `options.recursive?` | `boolean` | recursive delete flag |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:723](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L723)

___

### setAdapter

▸ **setAdapter**(`metaOrTypeOrUrl?`): `Promise`\<`void`\>

Set adapter instance and persist adapter metadata into index file.
Supports overloads:
- setAdapter(meta: AdapterMeta)
- setAdapter(type: string, url: string, token?: string)
- setAdapter(url: string)

#### Parameters

| Name | Type |
| :------ | :------ |
| `metaOrTypeOrUrl?` | `string` \| [`AdapterMeta`](../interfaces/AdapterMeta.md) |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:129](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L129)

___

### stat

▸ **stat**(`filepath`): `Promise`\<`any`\>

fs.stat 互換: 指定ファイルのメタ情報を返す
ワークスペース上の情報を優先し、未取得時は Git のメタ情報で補完する。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<`any`\>

stats オブジェクト

#### Defined in

[virtualfs/virtualfs.ts:658](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L658)

___

### unlink

▸ **unlink**(`filepath`): `Promise`\<`void`\>

fs.unlink 互換: ファイルを削除する

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:692](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L692)

___

### writeFile

▸ **writeFile**(`filepath`, `content`): `Promise`\<`void`\>

ファイルを書き込みます（ローカル編集）。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |
| `content` | `string` | コンテンツ |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:593](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/virtualfs/virtualfs.ts#L593)
