[browser-git-ops - v0.0.4](../README.md) / VirtualFS

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
| `options?` | `Object` | オプション |
| `options.backend?` | `StorageBackend` | - |
| `options.logger?` | `Logger` | - |

#### Returns

[`VirtualFS`](VirtualFS.md)

#### Defined in

[virtualfs/virtualfs.ts:46](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L46)

## Accessors

### head

• `get` **head**(): `string`

public-facing property accessors for backwards compatibility with tests

#### Returns

`string`

#### Defined in

[virtualfs/virtualfs.ts:63](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L63)

• `set` **head**(`h`): `void`

Setter for head

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `h` | `string` | head value |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:72](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L72)

___

### lastCommitKey

• `get` **lastCommitKey**(): `undefined` \| `string`

Get lastCommitKey

#### Returns

`undefined` \| `string`

#### Defined in

[virtualfs/virtualfs.ts:80](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L80)

• `set` **lastCommitKey**(`k`): `void`

Set lastCommitKey

#### Parameters

| Name | Type |
| :------ | :------ |
| `k` | `undefined` \| `string` |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:89](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L89)

## Methods

### createBranch

▸ **createBranch**(`input`): `Promise`\<`CreateBranchResult`\>

Create a remote-only branch via the configured adapter.

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `CreateBranchInput` |

#### Returns

`Promise`\<`CreateBranchResult`\>

#### Defined in

[virtualfs/virtualfs.ts:1216](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1216)

___

### getAdapter

▸ **getAdapter**(): `Promise`\<`any`\>

Return persisted adapter metadata from the index (or cached meta).
This does not necessarily instantiate the adapter instance; use
`getAdapterInstance()` to obtain an instantiated adapter.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:166](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L166)

___

### getAdapterInstance

▸ **getAdapterInstance**(): `Promise`\<`any`\>

Return or lazily create the adapter instance based on persisted metadata.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:182](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L182)

___

### getAdapterMeta

▸ **getAdapterMeta**(): `any`

Return persisted adapter metadata (if any).

#### Returns

`any`

#### Defined in

[virtualfs/virtualfs.ts:534](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L534)

___

### getChangeSet

▸ **getChangeSet**(): `Promise`\<`any`[]\>

ワークスペースとインデックスから変更セットを生成します。

#### Returns

`Promise`\<`any`[]\>

変更リスト

#### Defined in

[virtualfs/virtualfs.ts:827](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L827)

___

### getDefaultBranch

▸ **getDefaultBranch**(): `Promise`\<``null`` \| `string`\>

Convenience to get default branch name from adapter repository metadata.
Returns null when adapter not available.

#### Returns

`Promise`\<``null`` \| `string`\>

#### Defined in

[virtualfs/virtualfs.ts:1284](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1284)

___

### getIndex

▸ **getIndex**(): `Promise`\<`IndexFile`\>

インデックス情報を返します。

#### Returns

`Promise`\<`IndexFile`\>

#### Defined in

[virtualfs/virtualfs.ts:801](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L801)

___

### getRemoteDiffs

▸ **getRemoteDiffs**(`remote?`): `Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| `RemoteSnapshotDescriptor` ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

Obtain remote snapshot (via persisted adapter if available) and
compute simple diffs against the current index.
Returns an object containing the resolved `remote` descriptor (or null),
`remoteShas` map and `diffs` array (strings like `added: path` / `updated: path`).

#### Parameters

| Name | Type |
| :------ | :------ |
| `remote?` | `string` \| `RemoteSnapshotDescriptor` \| \{ `fetchSnapshot`: () => `Promise`\<`RemoteSnapshotDescriptor`\>  } |

#### Returns

`Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| `RemoteSnapshotDescriptor` ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

#### Defined in

[virtualfs/virtualfs.ts:1153](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1153)

___

### init

▸ **init**(): `Promise`\<`void`\>

VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:97](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L97)

___

### listBranches

▸ **listBranches**(`query?`): `Promise`\<`BranchListPage`\>

Delegate branch listing to the underlying adapter when available.

#### Parameters

| Name | Type |
| :------ | :------ |
| `query?` | `BranchListQuery` |

#### Returns

`Promise`\<`BranchListPage`\>

#### Defined in

[virtualfs/virtualfs.ts:1198](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1198)

___

### listCommits

▸ **listCommits**(`query`): `Promise`\<`CommitHistoryPage`\>

Delegate commit history listing to the underlying adapter when available.
Thin passthrough used by UI/CLI to retrieve commit summaries and paging info.

#### Parameters

| Name | Type |
| :------ | :------ |
| `query` | `CommitHistoryQuery` |

#### Returns

`Promise`\<`CommitHistoryPage`\>

#### Defined in

[virtualfs/virtualfs.ts:1185](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1185)

___

### mkdir

▸ **mkdir**(`dirpath`, `_options?`): `Promise`\<`void`\>

fs.mkdir 互換 (簡易実装): workspace 側にディレクトリ情報を書き込む

#### Parameters

| Name | Type |
| :------ | :------ |
| `dirpath` | `string` |
| `_options?` | `Object` |
| `_options.mode?` | `number` |
| `_options.recursive?` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:650](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L650)

___

### pull

▸ **pull**(`remote`, `baseSnapshot?`): `Promise`\<`any`\>

リモートのスナップショットを取り込み、コンフリクト情報を返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `remote` | `string` \| `RemoteSnapshotDescriptor` \| \{ `fetchSnapshot`: () => `Promise`\<`RemoteSnapshotDescriptor`\>  } | - |
| `baseSnapshot?` | `Record`\<`string`, `string`\> | path->content マップ |

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:952](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L952)

___

### push

▸ **push**(`input`): `Promise`\<\{ `commitSha`: `string`  }\>

変更をコミットしてリモートへ反映します。adapter が無ければローカルシミュレーションします。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `input` | `CommitInput` | コミット入力 |

#### Returns

`Promise`\<\{ `commitSha`: `string`  }\>

#### Defined in

[virtualfs/virtualfs.ts:1419](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L1419)

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

[virtualfs/virtualfs.ts:599](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L599)

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

[virtualfs/virtualfs.ts:574](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L574)

___

### readdir

▸ **readdir**(`dirpath`, `options?`): `Promise`\<`any`[]\>

fs.readdir 互換 (簡易実装)

#### Parameters

| Name | Type |
| :------ | :------ |
| `dirpath` | `string` |
| `options?` | `Object` |
| `options.withFileTypes?` | `boolean` |

#### Returns

`Promise`\<`any`[]\>

#### Defined in

[virtualfs/virtualfs.ts:705](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L705)

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

[virtualfs/virtualfs.ts:557](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L557)

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

[virtualfs/virtualfs.ts:773](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L773)

___

### rmdir

▸ **rmdir**(`dirpath`, `options?`): `Promise`\<`void`\>

fs.rmdir 互換 (簡易実装)

#### Parameters

| Name | Type |
| :------ | :------ |
| `dirpath` | `string` |
| `options?` | `Object` |
| `options.recursive?` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:662](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L662)

___

### setAdapter

▸ **setAdapter**(`adapter`, `meta?`): `Promise`\<`void`\>

Set adapter instance and persist adapter metadata into index file.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `adapter` | `any` | adapter instance (or null to clear) |
| `meta?` | `any` | metadata to persist (e.g. { type:'github', opts: {...} }) |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:123](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L123)

___

### stat

▸ **stat**(`filepath`): `Promise`\<`any`\>

fs.stat 互換: 指定ファイルのメタ情報を返す
ワークスペース上の情報を優先し、未取得時は Git のメタ情報で補完する。

#### Parameters

| Name | Type |
| :------ | :------ |
| `filepath` | `string` |

#### Returns

`Promise`\<`any`\>

stats オブジェクト

#### Defined in

[virtualfs/virtualfs.ts:608](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L608)

___

### unlink

▸ **unlink**(`filepath`): `Promise`\<`void`\>

fs.unlink 互換: ファイルを削除する

#### Parameters

| Name | Type |
| :------ | :------ |
| `filepath` | `string` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:640](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L640)

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

[virtualfs/virtualfs.ts:544](https://github.com/nojaja/browser-git-ops/blob/f7b01d46c673ea573b580e93c77bca9b7f1ac8ba/src/virtualfs/virtualfs.ts#L544)
