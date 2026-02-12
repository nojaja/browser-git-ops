[browser-git-ops - v0.0.6](../README.md) / VirtualFS

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
| `options.backend?` | `StorageBackend` | ストレージバックエンド |
| `options.logger?` | `Logger` | ロガーインスタンス |

#### Returns

[`VirtualFS`](VirtualFS.md)

#### Defined in

[virtualfs/virtualfs.ts:48](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L48)

## Accessors

### head

• `get` **head**(): `string`

public-facing property accessors for backwards compatibility with tests

#### Returns

`string`

#### Defined in

[virtualfs/virtualfs.ts:65](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L65)

• `set` **head**(`h`): `void`

Setter for head

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `h` | `string` | head value |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:74](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L74)

___

### lastCommitKey

• `get` **lastCommitKey**(): `undefined` \| `string`

Get lastCommitKey

#### Returns

`undefined` \| `string`

#### Defined in

[virtualfs/virtualfs.ts:82](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L82)

• `set` **lastCommitKey**(`k`): `void`

Set lastCommitKey

#### Parameters

| Name | Type |
| :------ | :------ |
| `k` | `undefined` \| `string` |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:91](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L91)

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

[virtualfs/virtualfs.ts:1255](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1255)

___

### getAdapter

▸ **getAdapter**(): `Promise`\<`any`\>

Return persisted adapter metadata from the index (or cached meta).
This does not necessarily instantiate the adapter instance; use
`getAdapterInstance()` to obtain an instantiated adapter.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:166](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L166)

___

### getAdapterInstance

▸ **getAdapterInstance**(): `Promise`\<`any`\>

Return or lazily create the adapter instance based on persisted metadata.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:188](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L188)

___

### getAdapterMeta

▸ **getAdapterMeta**(): `any`

Return persisted adapter metadata (if any).

#### Returns

`any`

#### Defined in

[virtualfs/virtualfs.ts:541](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L541)

___

### getChangeSet

▸ **getChangeSet**(): `Promise`\<`any`[]\>

ワークスペースとインデックスから変更セットを生成します。

#### Returns

`Promise`\<`any`[]\>

変更リスト

#### Defined in

[virtualfs/virtualfs.ts:850](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L850)

___

### getDefaultBranch

▸ **getDefaultBranch**(): `Promise`\<``null`` \| `string`\>

Convenience to get default branch name from adapter repository metadata.
Returns null when adapter not available.

#### Returns

`Promise`\<``null`` \| `string`\>

#### Defined in

[virtualfs/virtualfs.ts:1323](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1323)

___

### getIndex

▸ **getIndex**(): `Promise`\<`IndexFile`\>

インデックス情報を返します。

#### Returns

`Promise`\<`IndexFile`\>

#### Defined in

[virtualfs/virtualfs.ts:824](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L824)

___

### getRemoteDiffs

▸ **getRemoteDiffs**(`remote?`): `Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| `RemoteSnapshotDescriptor` ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

Obtain remote snapshot (via persisted adapter if available) and
compute simple diffs against the current index.
Returns an object containing the resolved `remote` descriptor (or null),
`remoteShas` map and `diffs` array (strings like `added: path` / `updated: path`).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `remote?` | `string` \| `RemoteSnapshotDescriptor` \| \{ `fetchSnapshot`: () => `Promise`\<`RemoteSnapshotDescriptor`\>  } | remote descriptor |

#### Returns

`Promise`\<\{ `diffs`: `string`[] ; `remote`: ``null`` \| `RemoteSnapshotDescriptor` ; `remoteShas`: `Record`\<`string`, `string`\>  }\>

#### Defined in

[virtualfs/virtualfs.ts:1192](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1192)

___

### init

▸ **init**(): `Promise`\<`void`\>

VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:99](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L99)

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

[virtualfs/virtualfs.ts:1237](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1237)

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

[virtualfs/virtualfs.ts:1224](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1224)

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

[virtualfs/virtualfs.ts:665](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L665)

___

### pull

▸ **pull**(`remote`, `baseSnapshot?`): `Promise`\<`any`\>

リモートのスナップショットを取り込み、コンフリクト情報を返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `remote` | `string` \| `RemoteSnapshotDescriptor` \| \{ `fetchSnapshot`: () => `Promise`\<`RemoteSnapshotDescriptor`\>  } | リモート情報 |
| `baseSnapshot?` | `Record`\<`string`, `string`\> | path->content マップ |

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:989](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L989)

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

[virtualfs/virtualfs.ts:1460](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L1460)

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

[virtualfs/virtualfs.ts:606](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L606)

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

[virtualfs/virtualfs.ts:581](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L581)

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

[virtualfs/virtualfs.ts:727](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L727)

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

[virtualfs/virtualfs.ts:564](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L564)

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

[virtualfs/virtualfs.ts:796](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L796)

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

[virtualfs/virtualfs.ts:681](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L681)

___

### setAdapter

▸ **setAdapter**(`meta`): `Promise`\<`void`\>

Set adapter instance and persist adapter metadata into index file.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `meta` | `AdapterMeta` | metadata to persist (e.g. { type:'github', opts: {...} }) |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:124](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L124)

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

[virtualfs/virtualfs.ts:616](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L616)

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

[virtualfs/virtualfs.ts:650](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L650)

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

[virtualfs/virtualfs.ts:551](https://github.com/nojaja/browser-git-ops/blob/d5ba5a70b892587f2d189be2f3b77ed34b1af62f/src/virtualfs/virtualfs.ts#L551)
