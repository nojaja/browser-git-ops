[browser-git-ops - v0.0.7](../README.md) / StorageBackend

# Interface: StorageBackend

永続化レイヤーの抽象インターフェース
Storage の具体実装はこの契約に従うこと

## Table of contents

### Methods

- [deleteBlob](StorageBackend.md#deleteblob)
- [init](StorageBackend.md#init)
- [listFiles](StorageBackend.md#listfiles)
- [listFilesRaw](StorageBackend.md#listfilesraw)
- [readBlob](StorageBackend.md#readblob)
- [readIndex](StorageBackend.md#readindex)
- [setBranch](StorageBackend.md#setbranch)
- [writeBlob](StorageBackend.md#writeblob)
- [writeIndex](StorageBackend.md#writeindex)

## Methods

### deleteBlob

▸ **deleteBlob**(`_filepath`, `_segment?`): `Promise`\<`void`\>

ファイルを削除する

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_filepath` | `string` |  |
| `_segment?` | [`Segment`](../README.md#segment) | 削除するセグメント（省略時は全セグメント削除） * |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/storageBackend.ts:55](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L55)

___

### init

▸ **init**(): `Promise`\<`void`\>

初期化処理

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/storageBackend.ts:17](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L17)

___

### listFiles

▸ **listFiles**(`_prefix?`, `_segment?`, `_recursive?`): `Promise`\<\{ `info`: ``null`` \| `string` ; `path`: `string`  }[]\>

指定プレフィックス配下のファイル一覧を取得します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_prefix?` | `string` | 取得対象のディレクトリプレフィックス（省略時はルート） |
| `_segment?` | [`Segment`](../README.md#segment) | 取得対象セグメント（省略時は 'workspace'） |
| `_recursive?` | `boolean` | サブディレクトリも含める場合は true（デフォルト true） |

#### Returns

`Promise`\<\{ `info`: ``null`` \| `string` ; `path`: `string`  }[]\>

Promise<Array<{path:string, info:string|null}>>

#### Defined in

[virtualfs/storageBackend.ts:64](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L64)

___

### listFilesRaw

▸ **listFilesRaw**(`_prefix?`, `_recursive?`): `Promise`\<\{ `info?`: ``null`` \| `string` ; `path`: `string` ; `uri`: `string`  }[]\>

Raw listing that returns implementation-specific URIs and a normalized path.

#### Parameters

| Name | Type |
| :------ | :------ |
| `_prefix?` | `string` |
| `_recursive?` | `boolean` |

#### Returns

`Promise`\<\{ `info?`: ``null`` \| `string` ; `path`: `string` ; `uri`: `string`  }[]\>

Promise<Array<{ uri: string; path: string; info?: string | null }>>

#### Defined in

[virtualfs/storageBackend.ts:70](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L70)

___

### readBlob

▸ **readBlob**(`_filepath`, `_segment?`): `Promise`\<``null`` \| `string`\>

ファイルコンテンツを読み出す

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_filepath` | `string` |  |
| `_segment?` | [`Segment`](../README.md#segment) | 読み出すセグメント * |

#### Returns

`Promise`\<``null`` \| `string`\>

#### Defined in

[virtualfs/storageBackend.ts:47](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L47)

___

### readIndex

▸ **readIndex**(): `Promise`\<``null`` \| [`IndexFile`](IndexFile.md)\>

index.json を読み込む

#### Returns

`Promise`\<``null`` \| [`IndexFile`](IndexFile.md)\>

#### Defined in

[virtualfs/storageBackend.ts:23](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L23)

___

### setBranch

▸ **setBranch**(`_branch?`): `void`

Set the currently-active branch name for backends that scope data by branch.
Implementations may ignore this call if branch-scoped storage is unsupported.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_branch?` | ``null`` \| `string` | branch name or undefined to clear |

#### Returns

`void`

#### Defined in

[virtualfs/storageBackend.ts:77](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L77)

___

### writeBlob

▸ **writeBlob**(`_filepath`, `_content`, `_segment?`): `Promise`\<`void`\>

ファイルコンテンツを保存

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_filepath` | `string` |  |
| `_content` | `string` |  |
| `_segment?` | [`Segment`](../README.md#segment) | 保存先セグメント * |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/storageBackend.ts:39](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L39)

___

### writeIndex

▸ **writeIndex**(`_index`): `Promise`\<`void`\>

index.json を書き込む

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_index` | [`IndexFile`](IndexFile.md) | * |

#### Returns

`Promise`\<`void`\>

#### Defined in

[virtualfs/storageBackend.ts:30](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L30)
