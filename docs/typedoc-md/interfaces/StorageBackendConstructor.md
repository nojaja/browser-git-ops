[browser-git-ops - v0.0.7](../README.md) / StorageBackendConstructor

# Interface: StorageBackendConstructor

StorageBackend の "静的側"（コンストラクタ/クラス）を表現する型。
クラス実装はこの型を満たすことで `canUse()` の静的メソッドを持つことが保証されます。

## Table of contents

### Constructors

- [constructor](StorageBackendConstructor.md#constructor)

### Methods

- [availableRoots](StorageBackendConstructor.md#availableroots)
- [canUse](StorageBackendConstructor.md#canuse)

## Constructors

### constructor

• **new StorageBackendConstructor**(`_namespace`, `_root?`): [`StorageBackend`](StorageBackend.md)

コンストラクタ。ルートパスやDB名などのオプション引数を受け取れるようにする。
実装側はこの引数を利用して初期化を行うことができます。

#### Parameters

| Name | Type |
| :------ | :------ |
| `_namespace` | `string` |
| `_root?` | `string` |

#### Returns

[`StorageBackend`](StorageBackend.md)

#### Defined in

[virtualfs/storageBackend.ts:89](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L89)

## Methods

### availableRoots

▸ **availableRoots**(`_namespace`): `string`[] \| `Promise`\<`string`[]\>

このストレージ実装で利用可能なルートパスあるいはDB名の一覧を返す。
例えばローカルFS実装ならベースディレクトリ名、IndexedDB実装ならDB名候補を返す等。

#### Parameters

| Name | Type |
| :------ | :------ |
| `_namespace` | `string` |

#### Returns

`string`[] \| `Promise`\<`string`[]\>

#### Defined in

[virtualfs/storageBackend.ts:100](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L100)

___

### canUse

▸ **canUse**(): `boolean`

このストレージ実装が利用可能かどうかを返す（例: 環境依存のチェック）。

#### Returns

`boolean`

#### Defined in

[virtualfs/storageBackend.ts:94](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/virtualfs/storageBackend.ts#L94)
