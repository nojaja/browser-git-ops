[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [virtualfs/storageBackend](../README.md) / StorageBackend

# Interface: StorageBackend

Defined in: [src/virtualfs/storageBackend.ts:7](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L7)

永続化レイヤーの抽象インターフェース
Storage の具体実装はこの契約に従うこと

## Methods

### deleteBlob()

> **deleteBlob**(`_filepath`): `Promise`\<`void`\>

Defined in: [src/virtualfs/storageBackend.ts:42](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L42)

ファイルを削除する

#### Parameters

##### \_filepath

`string`

#### Returns

`Promise`\<`void`\>

***

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [src/virtualfs/storageBackend.ts:12](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L12)

初期化処理

#### Returns

`Promise`\<`void`\>

***

### readBlob()

> **readBlob**(`_filepath`): `Promise`\<`string` \| `null`\>

Defined in: [src/virtualfs/storageBackend.ts:36](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L36)

ファイルコンテンツを読み出す

#### Parameters

##### \_filepath

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### readIndex()

> **readIndex**(): `Promise`\<[`IndexFile`](../../types/interfaces/IndexFile.md) \| `null`\>

Defined in: [src/virtualfs/storageBackend.ts:17](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L17)

index.json を読み込む

#### Returns

`Promise`\<[`IndexFile`](../../types/interfaces/IndexFile.md) \| `null`\>

***

### writeBlob()

> **writeBlob**(`_filepath`, `_content`): `Promise`\<`void`\>

Defined in: [src/virtualfs/storageBackend.ts:30](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L30)

ファイルコンテンツを保存

#### Parameters

##### \_filepath

`string`

##### \_content

`string`

#### Returns

`Promise`\<`void`\>

***

### writeIndex()

> **writeIndex**(`_index`): `Promise`\<`void`\>

Defined in: [src/virtualfs/storageBackend.ts:23](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L23)

index.json を書き込む

#### Parameters

##### \_index

[`IndexFile`](../../types/interfaces/IndexFile.md)

#### Returns

`Promise`\<`void`\>
