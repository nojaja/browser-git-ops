[browser-git-ops - v0.0.4](../README.md) / GitHubAdapter

# Class: GitHubAdapter

GitHub 向けの `GitAdapter` 実装。
GitHub API をラップしてリポジトリ操作（コミット作成、ブランチ一覧、ファイル取得等）を提供します。

## Hierarchy

- `AbstractGitAdapter`

  ↳ **`GitHubAdapter`**

## Implements

- `GitAdapter`

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

| Name | Type |
| :------ | :------ |
| `options` | `GHOptions` |

#### Returns

[`GitHubAdapter`](GitHubAdapter.md)

#### Overrides

AbstractGitAdapter.constructor

#### Defined in

[git/githubAdapter.ts:26](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L26)

## Properties

### baseBackoff

• `Protected` **baseBackoff**: `number` = `300`

#### Inherited from

AbstractGitAdapter.baseBackoff

#### Defined in

[git/abstractAdapter.ts:156](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L156)

___

### baseUrl

• `Protected` **baseUrl**: `string` = `''`

#### Inherited from

AbstractGitAdapter.baseUrl

#### Defined in

[git/abstractAdapter.ts:151](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L151)

___

### headers

• `Protected` **headers**: `Record`\<`string`, `string`\> = `{}`

#### Inherited from

AbstractGitAdapter.headers

#### Defined in

[git/abstractAdapter.ts:152](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L152)

___

### logger

• `Protected` `Optional` **logger**: `Logger`

#### Inherited from

AbstractGitAdapter.logger

#### Defined in

[git/abstractAdapter.ts:154](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L154)

___

### maxRetries

• `Protected` **maxRetries**: `number` = `4`

#### Inherited from

AbstractGitAdapter.maxRetries

#### Defined in

[git/abstractAdapter.ts:155](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L155)

___

### options

• `Protected` **options**: `any` = `{}`

#### Inherited from

AbstractGitAdapter.options

#### Defined in

[git/abstractAdapter.ts:153](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L153)

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

[git/abstractAdapter.ts:352](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L352)

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

GitAdapter.createBlobs

#### Defined in

[git/githubAdapter.ts:118](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L118)

___

### createBranch

▸ **createBranch**(`branchName`, `fromSha`): `Promise`\<`CreateBranchResult`\>

Create a branch (ref) on the remote repository.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `branchName` | `string` | branch name to create |
| `fromSha` | `string` | commit sha to point the new branch at |

#### Returns

`Promise`\<`CreateBranchResult`\>

created branch info

#### Implementation of

GitAdapter.createBranch

#### Defined in

[git/githubAdapter.ts:278](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L278)

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

GitAdapter.createCommit

#### Defined in

[git/githubAdapter.ts:179](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L179)

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

GitAdapter.createTree

#### Defined in

[git/githubAdapter.ts:154](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L154)

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

[git/githubAdapter.ts:564](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L564)

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

[git/abstractAdapter.ts:311](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L311)

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

[git/githubAdapter.ts:432](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L432)

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

[git/githubAdapter.ts:313](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L313)

___

### getRef

▸ **getRef**(`reference`): `Promise`\<`string`\>

指定 ref の先頭コミット SHA を取得します。

#### Parameters

| Name | Type |
| :------ | :------ |
| `reference` | `string` |

#### Returns

`Promise`\<`string`\>

参照先のコミット SHA

#### Defined in

[git/githubAdapter.ts:325](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L325)

___

### getRepositoryMetadata

▸ **getRepositoryMetadata**(): `Promise`\<`RepositoryMetadata`\>

Retrieve repository metadata (default branch, name, id) and cache it.

#### Returns

`Promise`\<`RepositoryMetadata`\>

repository metadata

#### Implementation of

GitAdapter.getRepositoryMetadata

#### Defined in

[git/githubAdapter.ts:195](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L195)

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

[git/githubAdapter.ts:419](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L419)

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

[git/abstractAdapter.ts:343](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L343)

___

### listBranches

▸ **listBranches**(`query?`): `Promise`\<\{ `items`: \{ `commit`: \{ `sha`: `any` ; `url`: `any`  } ; `isDefault`: `boolean` ; `name`: `any` = b.name; `protected`: `boolean` = !!b.protected }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

List branches via GitHub API and map to BranchListPage.
 *

#### Parameters

| Name | Type |
| :------ | :------ |
| `query?` | `BranchListQuery` |

#### Returns

`Promise`\<\{ `items`: \{ `commit`: \{ `sha`: `any` ; `url`: `any`  } ; `isDefault`: `boolean` ; `name`: `any` = b.name; `protected`: `boolean` = !!b.protected }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

#### Implementation of

GitAdapter.listBranches

#### Defined in

[git/githubAdapter.ts:226](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L226)

___

### listCommits

▸ **listCommits**(`query`): `Promise`\<\{ `items`: \{ `author`: `any` ; `date`: `any` ; `message`: `any` ; `parents`: `any` ; `sha`: `any`  }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

List commits for a ref (GitHub commits API)

#### Parameters

| Name | Type |
| :------ | :------ |
| `query` | `Object` |
| `query.page?` | `number` |
| `query.perPage?` | `number` |
| `query.ref` | `string` |

#### Returns

`Promise`\<\{ `items`: \{ `author`: `any` ; `date`: `any` ; `message`: `any` ; `parents`: `any` ; `sha`: `any`  }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

ページ情報を返します

#### Implementation of

GitAdapter.listCommits

#### Defined in

[git/githubAdapter.ts:47](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L47)

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

[git/abstractAdapter.ts:191](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L191)

___

### logError

▸ **logError**(`..._messages`): `void`

Log an error message if a logger is present.

#### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logError

#### Defined in

[git/abstractAdapter.ts:233](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L233)

___

### logInfo

▸ **logInfo**(`..._messages`): `void`

Log an informational message if a logger is present.

#### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logInfo

#### Defined in

[git/abstractAdapter.ts:205](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L205)

___

### logWarn

▸ **logWarn**(`..._messages`): `void`

Log a warning message if a logger is present.

#### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

#### Returns

`void`

#### Inherited from

AbstractGitAdapter.logWarn

#### Defined in

[git/abstractAdapter.ts:219](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L219)

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

[git/abstractAdapter.ts:366](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L366)

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

GitAdapter.resolveRef

#### Defined in

[git/githubAdapter.ts:449](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L449)

___

### setLogger

▸ **setLogger**(`logger`): `void`

Replace or set the logger at runtime.
Use this if DI happens after construction.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `logger` | `undefined` \| `Logger` | optional logger instance to set (or undefined to clear) |

#### Returns

`void`

void

#### Inherited from

AbstractGitAdapter.setLogger

#### Defined in

[git/abstractAdapter.ts:183](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L183)

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

[git/abstractAdapter.ts:173](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/abstractAdapter.ts#L173)

___

### updateRef

▸ **updateRef**(`reference`, `commitSha`, `force?`): `Promise`\<`void`\>

参照を更新します。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `reference` | `string` | `undefined` | - |
| `commitSha` | `string` | `undefined` | コミット SHA |
| `force` | `boolean` | `false` | 強制更新フラグ |

#### Returns

`Promise`\<`void`\>

#### Implementation of

GitAdapter.updateRef

#### Defined in

[git/githubAdapter.ts:263](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/githubAdapter.ts#L263)
