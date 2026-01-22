[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [git/githubAdapter](../README.md) / GitHubAdapter

# Class: GitHubAdapter

Defined in: [src/git/githubAdapter.ts:97](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L97)

## Implements

- [`GitAdapter`](../../adapter/interfaces/GitAdapter.md)

## Constructors

### Constructor

> **new GitHubAdapter**(`opts`): `GitHubAdapter`

Defined in: [src/git/githubAdapter.ts:108](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L108)

GitHubAdapter を初期化します。

#### Parameters

##### opts

`GHOptions`

設定オブジェクト

#### Returns

`GitHubAdapter`

## Properties

### \_fetchWithRetry()

> `private` **\_fetchWithRetry**: (`_`, `__`, `___?`, `____?`) => `Promise`\<`Response`\>

Defined in: [src/git/githubAdapter.ts:100](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L100)

#### Parameters

##### \_

`RequestInfo`

##### \_\_

`RequestInit`

##### \_\_\_?

`number`

##### \_\_\_\_?

`number`

#### Returns

`Promise`\<`Response`\>

***

### baseUrl

> `private` **baseUrl**: `string`

Defined in: [src/git/githubAdapter.ts:98](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L98)

***

### blobCache

> `private` **blobCache**: `Map`\<`string`, `string`\>

Defined in: [src/git/githubAdapter.ts:102](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L102)

***

### headers

> `private` **headers**: `Record`\<`string`, `string`\>

Defined in: [src/git/githubAdapter.ts:99](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L99)

***

### opts

> `private` **opts**: `GHOptions`

Defined in: [src/git/githubAdapter.ts:108](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L108)

設定オブジェクト

## Methods

### \_fetchBlobContentOrNull()

> `private` **\_fetchBlobContentOrNull**(`f`): `Promise`\<\{ `content`: `string`; `path`: `any`; \} \| \{ `content`: `null`; `path`: `any`; \}\>

Defined in: [src/git/githubAdapter.ts:267](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L267)

Blob を取得して content を返す。取得失敗時は content=null を返す。

#### Parameters

##### f

`any`

blob 情報

#### Returns

`Promise`\<\{ `content`: `string`; `path`: `any`; \} \| \{ `content`: `null`; `path`: `any`; \}\>

***

### createBlobs()

> **createBlobs**(`changes`, `concurrency`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [src/git/githubAdapter.ts:131](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L131)

#### Parameters

##### changes

`any`[]

##### concurrency

`number` = `5`

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createBlobs`](../../adapter/interfaces/GitAdapter.md#createblobs)

***

### createCommit()

> **createCommit**(`message`, `parentSha`, `treeSha`): `Promise`\<`string`\>

Defined in: [src/git/githubAdapter.ts:182](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L182)

コミットを作成します。

#### Parameters

##### message

`string`

コミットメッセージ

##### parentSha

`string`

親コミット SHA

##### treeSha

`string`

ツリー SHA

#### Returns

`Promise`\<`string`\>

新規コミット SHA

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createCommit`](../../adapter/interfaces/GitAdapter.md#createcommit)

***

### createTree()

> **createTree**(`changes`, `baseTreeSha?`): `Promise`\<`string`\>

Defined in: [src/git/githubAdapter.ts:157](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L157)

互換用のツリー作成。

#### Parameters

##### changes

`any`[]

変更一覧

##### baseTreeSha?

`string`

ベースツリー

#### Returns

`Promise`\<`string`\>

作成されたツリーの sha

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createTree`](../../adapter/interfaces/GitAdapter.md#createtree)

***

### fetchSnapshot()

> **fetchSnapshot**(`branch`, `concurrency`): `Promise`\<\{ `headSha`: `any`; `snapshot`: `Record`\<`string`, `string`\>; \}\>

Defined in: [src/git/githubAdapter.ts:281](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L281)

リポジトリのスナップショットを取得します。

#### Parameters

##### branch

`string` = `'main'`

ブランチ名 (default: 'main')

##### concurrency

`number` = `5`

#### Returns

`Promise`\<\{ `headSha`: `any`; `snapshot`: `Record`\<`string`, `string`\>; \}\>

***

### getBlob()

> **getBlob**(`blobSha`): `Promise`\<\{ `content`: `string`; `encoding`: `any`; \}\>

Defined in: [src/git/githubAdapter.ts:248](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L248)

blob を取得してデコードして返します。

#### Parameters

##### blobSha

`string`

blob の SHA

#### Returns

`Promise`\<\{ `content`: `string`; `encoding`: `any`; \}\>

***

### getCommitTreeSha()

> **getCommitTreeSha**(`commitSha`): `Promise`\<`string`\>

Defined in: [src/git/githubAdapter.ts:213](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L213)

指定コミットの tree SHA を取得します。

#### Parameters

##### commitSha

`string`

コミット SHA

#### Returns

`Promise`\<`string`\>

***

### getRef()

> **getRef**(`ref`): `Promise`\<`string`\>

Defined in: [src/git/githubAdapter.ts:224](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L224)

指定 ref の先頭コミット SHA を取得します。

#### Parameters

##### ref

`string`

例: `heads/main`

#### Returns

`Promise`\<`string`\>

***

### getTree()

> **getTree**(`treeSha`, `recursive`): `Promise`\<`any`[]\>

Defined in: [src/git/githubAdapter.ts:236](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L236)

tree を取得します（必要なら再帰取得）。

#### Parameters

##### treeSha

`string`

tree の SHA

##### recursive

`boolean` = `false`

再帰フラグ

#### Returns

`Promise`\<`any`[]\>

***

### shaOf()

> `private` **shaOf**(`content`): `Promise`\<`string`\>

Defined in: [src/git/githubAdapter.ts:124](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L124)

コンテンツから sha1 を算出します。

#### Parameters

##### content

`string`

コンテンツ

#### Returns

`Promise`\<`string`\>

sha1 ハッシュ

***

### updateRef()

> **updateRef**(`ref`, `commitSha`, `force`): `Promise`\<`void`\>

Defined in: [src/git/githubAdapter.ts:200](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L200)

参照を更新します。

#### Parameters

##### ref

`string`

参照名（例: heads/main）

##### commitSha

`string`

コミット SHA

##### force

`boolean` = `false`

強制更新フラグ

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`updateRef`](../../adapter/interfaces/GitAdapter.md#updateref)
