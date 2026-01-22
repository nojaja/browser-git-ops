[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [virtualfs/storageBackend](../README.md) / StorageBackendConstructor

# Interface: StorageBackendConstructor

Defined in: [src/virtualfs/storageBackend.ts:49](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L49)

StorageBackend の "静的側"（コンストラクタ/クラス）を表現する型。
クラス実装はこの型を満たすことで `canUse()` の静的メソッドを持つことが保証されます。

## Constructors

### Constructor

> **new StorageBackendConstructor**(): [`StorageBackend`](StorageBackend.md)

Defined in: [src/virtualfs/storageBackend.ts:50](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L50)

#### Returns

[`StorageBackend`](StorageBackend.md)

## Methods

### canUse()

> **canUse**(): `boolean`

Defined in: [src/virtualfs/storageBackend.ts:51](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/storageBackend.ts#L51)

#### Returns

`boolean`
