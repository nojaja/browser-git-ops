[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [git/adapter](../README.md) / GitAdapter

# Interface: GitAdapter

Defined in: [src/git/adapter.ts:12](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/adapter.ts#L12)

## Methods

### createBlobs()

> **createBlobs**(`_changes`, `_concurrency?`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [src/git/adapter.ts:14](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/adapter.ts#L14)

#### Parameters

##### \_changes

[`Change`](Change.md)[]

##### \_concurrency?

`number`

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### createCommit()

> **createCommit**(`_message`, `_parentSha`, `_treeSha`): `Promise`\<`string`\>

Defined in: [src/git/adapter.ts:18](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/adapter.ts#L18)

#### Parameters

##### \_message

`string`

##### \_parentSha

`string`

##### \_treeSha

`string`

#### Returns

`Promise`\<`string`\>

***

### createTree()

> **createTree**(`_changes`, `_baseTreeSha?`): `Promise`\<`string`\>

Defined in: [src/git/adapter.ts:16](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/adapter.ts#L16)

#### Parameters

##### \_changes

[`Change`](Change.md)[]

##### \_baseTreeSha?

`string`

#### Returns

`Promise`\<`string`\>

***

### updateRef()

> **updateRef**(`_ref`, `_commitSha`, `_force?`): `Promise`\<`void`\>

Defined in: [src/git/adapter.ts:20](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/adapter.ts#L20)

#### Parameters

##### \_ref

`string`

##### \_commitSha

`string`

##### \_force?

`boolean`

#### Returns

`Promise`\<`void`\>
