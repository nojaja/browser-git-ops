[browser-git-ops - v0.0.7](../README.md) / GitHubAdapter

# Class: GitHubAdapter

GitHub 向けの `GitAdapter` 実装。
GitHub API をラップしてリポジトリ操作（コミット作成、ブランチ一覧、ファイル取得等）を提供します。

## Hierarchy

- `AbstractGitAdapter`

  ↳ **`GitHubAdapter`**

## Implements

- [`GitAdapter`](../interfaces/GitAdapter.md)

## Table of contents

### Constructors

- [constructor](GitHubAdapter.md#constructor)

### Properties

- [baseBackoff](GitHubAdapter.md#basebackoff)
- [baseUrl](GitHubAdapter.md#baseurl)
- [headers](GitHubAdapter.md#headers)
- [logger](GitHubAdapter.md#logger)
- [maxRetries](GitHubAdapter.md#maxretries)
- [options](GitHubAdapter.md#options)

### Methods

- [backoffMs](GitHubAdapter.md#backoffms)
- [createBlobs](GitHubAdapter.md#createblobs)
- [createBranch](GitHubAdapter.md#createbranch)
- [createCommit](GitHubAdapter.md#createcommit)
- [createTree](GitHubAdapter.md#createtree)
- [fetchSnapshot](GitHubAdapter.md#fetchsnapshot)
- [fetchWithRetry](GitHubAdapter.md#fetchwithretry)
- [getBlob](GitHubAdapter.md#getblob)
- [getCommitTreeSha](GitHubAdapter.md#getcommittreesha)
- [getRef](GitHubAdapter.md#getref)
- [getRepositoryMetadata](GitHubAdapter.md#getrepositorymetadata)
- [getTree](GitHubAdapter.md#gettree)
- [isRetryableStatus](GitHubAdapter.md#isretryablestatus)
- [listBranches](GitHubAdapter.md#listbranches)
- [listCommits](GitHubAdapter.md#listcommits)
- [logDebug](GitHubAdapter.md#logdebug)
- [logError](GitHubAdapter.md#logerror)
- [logInfo](GitHubAdapter.md#loginfo)
- [logWarn](GitHubAdapter.md#logwarn)
- [mapWithConcurrency](GitHubAdapter.md#mapwithconcurrency)
- [resolveRef](GitHubAdapter.md#resolveref)
- [setLogger](GitHubAdapter.md#setlogger)
- [shaOf](GitHubAdapter.md#shaof)
- [updateRef](GitHubAdapter.md#updateref)

## Constructors

### constructor

• **new GitHubAdapter**(`options`): [`GitHubAdapter`](GitHubAdapter.md)

GitHubAdapter を初期化します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`GHOptions`](../README.md#ghoptions) | 設定オブジェクト |

#### Returns

[`GitHubAdapter`](GitHubAdapter.md)

#### Overrides

AbstractGitAdapter.constructor

#### Defined in

[git/githubAdapter.ts:26](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L26)

## Properties

### baseBackoff

• `Protected` **baseBackoff**: `number` = `300`

#### Inherited from

AbstractGitAdapter.baseBackoff

#### Defined in

[git/abstractAdapter.ts:157](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L157)

___

### baseUrl

• `Protected` **baseUrl**: `string` = `''`

#### Inherited from

AbstractGitAdapter.baseUrl

#### Defined in

[git/abstractAdapter.ts:152](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L152)

___

### headers

• `Protected` **headers**: `Record`\<`string`, `string`\> = `{}`

#### Inherited from

AbstractGitAdapter.headers

#### Defined in

[git/abstractAdapter.ts:153](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L153)

___

### logger

• `Protected` `Optional` **logger**: [`Logger`](../interfaces/Logger.md)

#### Inherited from

AbstractGitAdapter.logger

#### Defined in

[git/abstractAdapter.ts:155](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L155)

___

### maxRetries

• `Protected` **maxRetries**: `number` = `4`

#### Inherited from

AbstractGitAdapter.maxRetries

#### Defined in

[git/abstractAdapter.ts:156](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L156)

___

### options

• `Protected` **options**: `any` = `{}`

#### Inherited from

AbstractGitAdapter.options

#### Defined in

[git/abstractAdapter.ts:154](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L154)

## Methods

### backoffMs

▸ **backoffMs**(`attempt`): `number`

Compute backoff milliseconds for attempt

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `attempt` | `number` | attempt number (1..) |

#### Returns

`number`

milliseconds to wait

#### Inherited from

AbstractGitAdapter.backoffMs

#### Defined in

[git/abstractAdapter.ts:358](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L358)

___

### createBlobs

▸ **createBlobs**(`changes`, `concurrency?`): `Promise`\<`Record`\<`string`, `string`\>\>

ブロブを作成またはキャッシュから取得します。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `changes` | `any`[] | `undefined` | 変更一覧（create/update を含む） |
| `concurrency?` | `number` | `5` | 同時実行数 |

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

パス→blobSha のマップ

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[createBlobs](../interfaces/GitAdapter.md#createblobs)

#### Defined in

[git/githubAdapter.ts:121](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L121)

___

### createBranch

▸ **createBranch**(`branchName`, `fromSha`): `Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

Create a branch (ref) on the remote repository.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `branchName` | `string` | branch name to create |
| `fromSha` | `string` | commit sha to point the new branch at |

#### Returns

`Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

created branch info

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[createBranch](../interfaces/GitAdapter.md#createbranch)

#### Defined in

[git/githubAdapter.ts:282](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L282)

___

### createCommit

▸ **createCommit**(`message`, `parentSha`, `treeSha`): `Promise`\<`string`\>

コミットを作成します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `message` | `string` | コミットメッセージ |
| `parentSha` | `string` | 親コミット SHA |
| `treeSha` | `string` | ツリー SHA |

#### Returns

`Promise`\<`string`\>

新規コミット SHA

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[createCommit](../interfaces/GitAdapter.md#createcommit)

#### Defined in

[git/githubAdapter.ts:182](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L182)

___

### createTree

▸ **createTree**(`changes`, `baseTreeSha?`): `Promise`\<`string`\>

互換用のツリー作成。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `changes` | `any`[] | 変更一覧 |
| `baseTreeSha?` | `string` | ベースツリー |

#### Returns

`Promise`\<`string`\>

作成されたツリーの sha

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[createTree](../interfaces/GitAdapter.md#createtree)

#### Defined in

[git/githubAdapter.ts:157](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L157)

___

### fetchSnapshot

▸ **fetchSnapshot**(`branch?`, `concurrency?`): `Promise`\<`any`\>

Fetch repository snapshot: headSha, shas map and a fetchContent helper.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `branch` | `string` | `'main'` | branch name |
| `concurrency` | `number` | `5` | fetch concurrency |

#### Returns

`Promise`\<`any`\>

#### Defined in

[git/githubAdapter.ts:569](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L569)

___

### fetchWithRetry

▸ **fetchWithRetry**(`input`, `init`, `attempts?`, `baseDelay?`): `Promise`\<`Response`\>

Proxy to shared `fetchWithRetry` implementation while emitting
minimal request/response logs for debugging and test inspection.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `input` | `RequestInfo` | `undefined` | fetch input |
| `init` | `RequestInit` | `undefined` | fetch init |
| `attempts` | `number` | `4` | retry attempts |
| `baseDelay` | `number` | `300` | base delay ms |

#### Returns

`Promise`\<`Response`\>

Promise resolving to Response

#### Inherited from

AbstractGitAdapter.fetchWithRetry

#### Defined in

[git/abstractAdapter.ts:317](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L317)

___

### getBlob

▸ **getBlob**(`blobSha`): `Promise`\<\{ `content`: `any` = index.content; `encoding`: `any` = enc }\>

blob を取得してデコードして返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `blobSha` | `string` | blob の SHA * |

#### Returns

`Promise`\<\{ `content`: `any` = index.content; `encoding`: `any` = enc }\>

デコード済みコンテンツとエンコーディング

#### Defined in

[git/githubAdapter.ts:436](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L436)

___

### getCommitTreeSha

▸ **getCommitTreeSha**(`commitSha`): `Promise`\<`string`\>

指定コミットの tree SHA を取得します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `commitSha` | `string` | コミット SHA * |

#### Returns

`Promise`\<`string`\>

tree の SHA

#### Defined in

[git/githubAdapter.ts:317](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L317)

___

### getRef

▸ **getRef**(`reference`): `Promise`\<`string`\>

指定 ref の先頭コミット SHA を取得します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `reference` | `string` | 䉶: `heads/main` |

#### Returns

`Promise`\<`string`\>

参照先のコミット SHA

#### Defined in

[git/githubAdapter.ts:329](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L329)

___

### getRepositoryMetadata

▸ **getRepositoryMetadata**(): `Promise`\<[`RepositoryMetadata`](../README.md#repositorymetadata)\>

Retrieve repository metadata (default branch, name, id) and cache it.

#### Returns

`Promise`\<[`RepositoryMetadata`](../README.md#repositorymetadata)\>

repository metadata

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[getRepositoryMetadata](../interfaces/GitAdapter.md#getrepositorymetadata)

#### Defined in

[git/githubAdapter.ts:198](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L198)

___

### getTree

▸ **getTree**(`treeSha`, `recursive?`): `Promise`\<`any`[]\>

tree を取得します（必要なら再帰取得）。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `treeSha` | `string` | `undefined` | tree の SHA |
| `recursive` | `boolean` | `false` | 再帰フラグ * |

#### Returns

`Promise`\<`any`[]\>

tree の配列

#### Defined in

[git/githubAdapter.ts:423](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L423)

___

### isRetryableStatus

▸ **isRetryableStatus**(`status`): `boolean`

Determine if a status code is retryable

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `status` | `number` | HTTP status code |

#### Returns

`boolean`

boolean

#### Inherited from

AbstractGitAdapter.isRetryableStatus

#### Defined in

[git/abstractAdapter.ts:349](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L349)

___

### listBranches

▸ **listBranches**(`query?`): `Promise`\<\{ `items`: \{ `commit`: \{ `sha`: `any` ; `url`: `any`  } ; `isDefault`: `boolean` ; `name`: `any` = b.name; `protected`: `boolean` = !!b.protected }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

List branches via GitHub API and map to BranchListPage.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query?` | [`BranchListQuery`](../README.md#branchlistquery) | query parameters |

#### Returns

`Promise`\<\{ `items`: \{ `commit`: \{ `sha`: `any` ; `url`: `any`  } ; `isDefault`: `boolean` ; `name`: `any` = b.name; `protected`: `boolean` = !!b.protected }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[listBranches](../interfaces/GitAdapter.md#listbranches)

#### Defined in

[git/githubAdapter.ts:230](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L230)

___

### listCommits

▸ **listCommits**(`query`): `Promise`\<\{ `items`: \{ `author`: `any` ; `date`: `any` ; `message`: `any` ; `parents`: `any` ; `sha`: `any`  }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

List commits for a ref (GitHub commits API)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `Object` | query parameters |
| `query.page?` | `number` | page number |
| `query.perPage?` | `number` | items per page |
| `query.ref` | `string` | reference name (branch/tag/SHA) |

#### Returns

`Promise`\<\{ `items`: \{ `author`: `any` ; `date`: `any` ; `message`: `any` ; `parents`: `any` ; `sha`: `any`  }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

ページ情報を返します

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[listCommits](../interfaces/GitAdapter.md#listcommits)

#### Defined in

[git/githubAdapter.ts:50](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L50)

___

### logDebug

▸ **logDebug**(`..._messages`): `void`

Log debug messages when a logger is present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `..._messages` | `any`[] | messages to log (unused when no logger) |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logDebug

#### Defined in

[git/abstractAdapter.ts:192](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L192)

___

### logError

▸ **logError**(`..._messages`): `void`

Log an error message if a logger is present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `..._messages` | `any`[] | items to log |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logError

#### Defined in

[git/abstractAdapter.ts:234](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L234)

___

### logInfo

▸ **logInfo**(`..._messages`): `void`

Log an informational message if a logger is present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `..._messages` | `any`[] | items to log |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logInfo

#### Defined in

[git/abstractAdapter.ts:206](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L206)

___

### logWarn

▸ **logWarn**(`..._messages`): `void`

Log a warning message if a logger is present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `..._messages` | `any`[] | items to log |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logWarn

#### Defined in

[git/abstractAdapter.ts:220](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L220)

___

### mapWithConcurrency

▸ **mapWithConcurrency**\<`T`, `R`\>(`items`, `mapper`, `concurrency?`): `Promise`\<`R`[]\>

Map items with limited concurrency by delegating to the shared helper.

#### Type parameters

| Name |
| :------ |
| `T` |
| `R` |

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `items` | `T`[] | `undefined` | items to map |
| `mapper` | (`_t`: `T`) => `Promise`\<`R`\> | `undefined` | async mapper |
| `concurrency` | `number` | `5` | concurrency limit |

#### Returns

`Promise`\<`R`[]\>

Promise resolving to mapped results

#### Inherited from

AbstractGitAdapter.mapWithConcurrency

#### Defined in

[git/abstractAdapter.ts:372](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L372)

___

### resolveRef

▸ **resolveRef**(`reference`): `Promise`\<`string`\>

Resolve a commit-ish (branch, tag, or SHA) to a commit SHA.
Resolution order: branch -> tag -> commit endpoint -> treat as SHA
Throws if resolution fails.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `reference` | `string` | commit-ish to resolve |

#### Returns

`Promise`\<`string`\>

resolved commit SHA

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[resolveRef](../interfaces/GitAdapter.md#resolveref)

#### Defined in

[git/githubAdapter.ts:453](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L453)

___

### setLogger

▸ **setLogger**(`logger`): `void`

Replace or set the logger at runtime.
Use this if DI happens after construction.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `logger` | `undefined` \| [`Logger`](../interfaces/Logger.md) | optional logger instance to set (or undefined to clear) |

#### Returns

`void`

void

#### Inherited from

AbstractGitAdapter.setLogger

#### Defined in

[git/abstractAdapter.ts:184](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L184)

___

### shaOf

▸ **shaOf**(`content`): `Promise`\<`string`\>

Delegate to shared shaOf implementation

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `content` | `string` | input string |

#### Returns

`Promise`\<`string`\>

hex sha1

#### Inherited from

AbstractGitAdapter.shaOf

#### Defined in

[git/abstractAdapter.ts:174](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/abstractAdapter.ts#L174)

___

### updateRef

▸ **updateRef**(`reference`, `commitSha`, `force?`): `Promise`\<`void`\>

参照を更新します。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `reference` | `string` | `undefined` | 参照名（例: heads/main） |
| `commitSha` | `string` | `undefined` | コミット SHA |
| `force` | `boolean` | `false` | 強制更新フラグ |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[GitAdapter](../interfaces/GitAdapter.md).[updateRef](../interfaces/GitAdapter.md#updateref)

#### Defined in

[git/githubAdapter.ts:267](https://github.com/nojaja/browser-git-ops/blob/1228446eacc9318b5d275629b41f577a4d75037a/src/git/githubAdapter.ts#L267)
