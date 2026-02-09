[browser-git-ops - v0.0.5](../README.md) / VirtualFS

# Class: VirtualFS

Virtual file system - 永続化バックエンドを抽象化した仮想ファイルシステム

## Table of contents

### Constructors

- [constructor](VirtualFS.md#constructor)

### Accessors

- [head](VirtualFS.md#head)
- [lastCommitKey](VirtualFS.md#lastcommitkey)

### Methods

- [applyBaseSnapshot](VirtualFS.md#applybasesnapshot)
- [createBranch](VirtualFS.md#createbranch)
- [deleteFile](VirtualFS.md#deletefile)
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
- [listPaths](VirtualFS.md#listpaths)
- [pull](VirtualFS.md#pull)
- [push](VirtualFS.md#push)
- [readConflict](VirtualFS.md#readconflict)
- [readFile](VirtualFS.md#readfile)
- [renameFile](VirtualFS.md#renamefile)
- [resolveConflict](VirtualFS.md#resolveconflict)
- [setAdapter](VirtualFS.md#setadapter)
- [shaOf](VirtualFS.md#shaof)
- [shaOfGitBlob](VirtualFS.md#shaofgitblob)
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

[virtualfs/virtualfs.ts:46](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L46)

## Accessors

### head

• `get` **head**(): `string`

public-facing property accessors for backwards compatibility with tests

#### Returns

`string`

#### Defined in

[virtualfs/virtualfs.ts:63](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L63)

• `set` **head**(`h`): `void`

Setter for head

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `h` | `string` | head value |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:71](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L71)

___

### lastCommitKey

• `get` **lastCommitKey**(): `undefined` \| `string`

Get lastCommitKey

#### Returns

`undefined` \| `string`

#### Defined in

[virtualfs/virtualfs.ts:79](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L79)

• `set` **lastCommitKey**(`k`): `void`

Set lastCommitKey

#### Parameters

| Name | Type |
| :------ | :------ |
| `k` | `undefined` \| `string` |

#### Returns

`void`

#### Defined in

[virtualfs/virtualfs.ts:87](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L87)

## Methods

### applyBaseSnapshot

▸ **applyBaseSnapshot**(`snapshot`, `headSha`): `Promise`\<`void`\>

リモートのベーススナップショットを適用します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `snapshot` | `Record`\<`string`, `string`\> | path->content のマップ |
| `headSha` | `string` | リモート HEAD |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:342](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L342)

___

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

[virtualfs/virtualfs.ts:779](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L779)

___

### deleteFile

▸ **deleteFile**(`filepath`): `Promise`\<`void`\>

ファイルを削除します（トゥームストーン作成を含む）。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filepath` | `string` | ファイルパス |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:269](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L269)

___

### getAdapter

▸ **getAdapter**(): `Promise`\<`any`\>

Return persisted adapter metadata from the index (or cached meta).
This does not necessarily instantiate the adapter instance; use
`getAdapterInstance()` to obtain an instantiated adapter.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:181](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L181)

___

### getAdapterInstance

▸ **getAdapterInstance**(): `Promise`\<`any`\>

Return or lazily create the adapter instance based on persisted metadata.

#### Returns

`Promise`\<`any`\>

#### Defined in

[virtualfs/virtualfs.ts:197](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L197)

___

### getAdapterMeta

▸ **getAdapterMeta**(): `any`

Return persisted adapter metadata (if any).

#### Returns

`any`

#### Defined in

[virtualfs/virtualfs.ts:248](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L248)

___

### getChangeSet

▸ **getChangeSet**(): `Promise`\<`any`[]\>

ワークスペースとインデックスから変更セットを生成します。

#### Returns

`Promise`\<`any`[]\>

変更リスト

#### Defined in

[virtualfs/virtualfs.ts:390](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L390)

___

### getDefaultBranch

▸ **getDefaultBranch**(): `Promise`\<``null`` \| `string`\>

Convenience to get default branch name from adapter repository metadata.
Returns null when adapter not available.
 *

#### Returns

`Promise`\<``null`` \| `string`\>

#### Defined in

[virtualfs/virtualfs.ts:847](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L847)

___

### getIndex

▸ **getIndex**(): `Promise`\<`IndexFile`\>

インデックス情報を返します。

#### Returns

`Promise`\<`IndexFile`\>

#### Defined in

[virtualfs/virtualfs.ts:360](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L360)

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

[virtualfs/virtualfs.ts:716](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L716)

___

### init

▸ **init**(): `Promise`\<`void`\>

VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/virtualfs.ts:113](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L113)

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

[virtualfs/virtualfs.ts:761](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L761)

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

[virtualfs/virtualfs.ts:748](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L748)

___

### listPaths

▸ **listPaths**(): `Promise`\<`string`[]\>

登録されているパス一覧を返します。

#### Returns

`Promise`\<`string`[]\>

#### Defined in

[virtualfs/virtualfs.ts:368](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L368)

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

[virtualfs/virtualfs.ts:515](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L515)

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

[virtualfs/virtualfs.ts:988](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L988)

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

[virtualfs/virtualfs.ts:322](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L322)

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

[virtualfs/virtualfs.ts:297](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L297)

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

[virtualfs/virtualfs.ts:280](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L280)

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

[virtualfs/virtualfs.ts:332](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L332)

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

[virtualfs/virtualfs.ts:139](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L139)

___

### shaOf

▸ **shaOf**(`content`): `Promise`\<`string`\>

SHA-1 helper wrapper (delegates to ./hashUtils)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `content` | `string` | ハッシュ対象の文字列 |

#### Returns

`Promise`\<`string`\>

SHA-1 ハッシュの16進表現

#### Defined in

[virtualfs/virtualfs.ts:96](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L96)

___

### shaOfGitBlob

▸ **shaOfGitBlob**(`content`): `Promise`\<`string`\>

SHA helper for Git blob formatting

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `content` | `string` | blob コンテンツ |

#### Returns

`Promise`\<`string`\>

SHA-1 ハッシュの16進表現（git blob 用）

#### Defined in

[virtualfs/virtualfs.ts:105](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L105)

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

[virtualfs/virtualfs.ts:258](https://github.com/nojaja/browser-git-ops/blob/28f31867a4cf6f9f8fa821d855f4c82c07719ff7/src/virtualfs/virtualfs.ts#L258)
