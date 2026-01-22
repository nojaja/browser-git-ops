[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [git/gitlabAdapter](../README.md) / GitLabAdapter

# Class: GitLabAdapter

Defined in: [src/git/gitlabAdapter.ts:11](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L11)

GitLab 向けの GitAdapter 実装です。
GitLab の API をラップして、リポジトリスナップショットの取得や
commits API の呼び出しをサポートします。

## Implements

- [`GitAdapter`](../../adapter/interfaces/GitAdapter.md)

## Constructors

### Constructor

> **new GitLabAdapter**(`opts`): `GitLabAdapter`

Defined in: [src/git/gitlabAdapter.ts:22](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L22)

GitLabAdapter を初期化します。

#### Parameters

##### opts

`GLOpts`

設定オブジェクト

#### Returns

`GitLabAdapter`

## Properties

### baseBackoff

> `private` **baseBackoff**: `number` = `300`

Defined in: [src/git/gitlabAdapter.ts:16](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L16)

***

### baseUrl

> `private` **baseUrl**: `string`

Defined in: [src/git/gitlabAdapter.ts:12](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L12)

***

### headers

> `private` **headers**: `Record`\<`string`, `string`\>

Defined in: [src/git/gitlabAdapter.ts:13](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L13)

***

### maxRetries

> `private` **maxRetries**: `number` = `3`

Defined in: [src/git/gitlabAdapter.ts:15](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L15)

***

### opts

> `private` **opts**: `GLOpts`

Defined in: [src/git/gitlabAdapter.ts:22](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L22)

設定オブジェクト

***

### pendingActions

> `private` **pendingActions**: `object`[] \| `null` = `null`

Defined in: [src/git/gitlabAdapter.ts:14](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L14)

## Methods

### \_fetchFileRaw()

> `private` **\_fetchFileRaw**(`path`, `branch`): `Promise`\<`string` \| `null`\>

Defined in: [src/git/gitlabAdapter.ts:284](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L284)

ファイルの raw コンテンツを取得して返します。失敗時は null を返します。

#### Parameters

##### path

`string`

ファイルパス

##### branch

`string`

ブランチ名

#### Returns

`Promise`\<`string` \| `null`\>

ファイル内容または null

***

### backoffMs()

> `private` **backoffMs**(`attempt`): `number`

Defined in: [src/git/gitlabAdapter.ts:210](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L210)

バックオフ時間を計算します。

#### Parameters

##### attempt

`number`

試行回数（1..）

#### Returns

`number`

ミリ秒

***

### createBlobs()

> **createBlobs**(`changes`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [src/git/gitlabAdapter.ts:48](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L48)

変更一覧から blob sha のマップを作成します（疑似実装）。

#### Parameters

##### changes

`any`[]

変更一覧

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

path->sha マップ

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createBlobs`](../../adapter/interfaces/GitAdapter.md#createblobs)

***

### createCommit()

> **createCommit**(`message`, `parentSha`, `_treeSha`): `Promise`\<`any`\>

Defined in: [src/git/gitlabAdapter.ts:79](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L79)

createTree で保持した actions があればコミットし、なければ parentSha を返します。

#### Parameters

##### message

`string`

コミットメッセージ

##### parentSha

`string`

親コミット SHA

##### \_treeSha

`string`

ツリー SHA（未使用）

#### Returns

`Promise`\<`any`\>

新規コミット SHA または parentSha

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createCommit`](../../adapter/interfaces/GitAdapter.md#createcommit)

***

### createCommitWithActions()

> **createCommitWithActions**(`branch`, `message`, `changes`, `expectedParentSha?`): `Promise`\<`any`\>

Defined in: [src/git/gitlabAdapter.ts:114](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L114)

actions を用いて GitLab のコミット API を呼び出します。

#### Parameters

##### branch

`string`

ブランチ名

##### message

`string`

コミットメッセージ

##### changes

`object`[]

変更一覧

##### expectedParentSha?

`string`

#### Returns

`Promise`\<`any`\>

コミット応答（id など）

***

### createTree()

> **createTree**(`_changes`, `_baseTreeSha?`): `Promise`\<`string`\>

Defined in: [src/git/gitlabAdapter.ts:61](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L61)

互換用のツリー作成。実際には actions を保持しておき、マーカーを返します。

#### Parameters

##### \_changes

`any`[]

変更一覧

##### \_baseTreeSha?

`string`

ベースツリー（未使用）

#### Returns

`Promise`\<`string`\>

マーカー文字列

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`createTree`](../../adapter/interfaces/GitAdapter.md#createtree)

***

### fetchSnapshot()

> **fetchSnapshot**(`branch`, `concurrency`): `Promise`\<\{ `headSha`: `string`; `snapshot`: `Record`\<`string`, `string`\>; \}\>

Defined in: [src/git/gitlabAdapter.ts:250](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L250)

リポジトリのスナップショットを取得します。

#### Parameters

##### branch

`string` = `'main'`

ブランチ名 (default: 'main')

##### concurrency

`number` = `5`

#### Returns

`Promise`\<\{ `headSha`: `string`; `snapshot`: `Record`\<`string`, `string`\>; \}\>

***

### fetchWithRetry()

> `private` **fetchWithRetry**(`url`, `opts`, `retries?`): `Promise`\<`Response`\>

Defined in: [src/git/gitlabAdapter.ts:178](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L178)

fetch をリトライ付きで実行します。

#### Parameters

##### url

`string`

リクエスト URL

##### opts

`RequestInit`

fetch オプション

##### retries?

`number` = `...`

最大リトライ回数

#### Returns

`Promise`\<`Response`\>

レスポンス

***

### isRetryableStatus()

> `private` **isRetryableStatus**(`status`): `boolean`

Defined in: [src/git/gitlabAdapter.ts:201](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L201)

ステータスが再試行対象か判定します。

#### Parameters

##### status

`number`

ステータスコード

#### Returns

`boolean`

***

### mapWithConcurrency()

> `private` **mapWithConcurrency**\<`T`, `R`\>(`items`, `mapper`, `concurrency`): `Promise`\<`R`[]\>

Defined in: [src/git/gitlabAdapter.ts:225](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L225)

並列マッピングユーティリティ

#### Type Parameters

##### T

`T`

##### R

`R`

#### Parameters

##### items

`T`[]

入力配列

##### mapper

(`_t`) => `Promise`\<`R`\>

マッピング関数

##### concurrency

`number` = `5`

同時実行数

#### Returns

`Promise`\<`R`[]\>

***

### shaOf()

> `private` **shaOf**(`content`): `Promise`\<`string`\>

Defined in: [src/git/gitlabAdapter.ts:36](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L36)

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

> **updateRef**(`_ref`, `_commitSha`, `_force?`): `Promise`\<`void`\>

Defined in: [src/git/gitlabAdapter.ts:103](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/gitlabAdapter.ts#L103)

リファレンス更新は不要なため noop 実装です。

#### Parameters

##### \_ref

`string`

ref 名

##### \_commitSha

`string`

コミット SHA

##### \_force?

`boolean` = `false`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GitAdapter`](../../adapter/interfaces/GitAdapter.md).[`updateRef`](../../adapter/interfaces/GitAdapter.md#updateref)
