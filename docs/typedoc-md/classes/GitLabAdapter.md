[browser-git-ops - v0.0.5](../README.md) / GitLabAdapter

# Class: GitLabAdapter

GitLab 向けの GitAdapter 実装です。
GitLab の API をラップして、リポジトリスナップショットの取得や
commits API の呼び出しをサポートします。

## Hierarchy

- `AbstractGitAdapter`

  ↳ **`GitLabAdapter`**

## Implements

- `GitAdapter`

## Table of contents

### Constructors

- [constructor](GitLabAdapter.md#constructor)

### Properties

- [baseBackoff](GitLabAdapter.md#basebackoff)
- [baseUrl](GitLabAdapter.md#baseurl)
- [headers](GitLabAdapter.md#headers)
- [logger](GitLabAdapter.md#logger)
- [maxRetries](GitLabAdapter.md#maxretries)
- [options](GitLabAdapter.md#options)

### Methods

- [backoffMs](GitLabAdapter.md#backoffms)
- [createBlobs](GitLabAdapter.md#createblobs)
- [createBranch](GitLabAdapter.md#createbranch)
- [createCommit](GitLabAdapter.md#createcommit)
- [createCommitWithActions](GitLabAdapter.md#createcommitwithactions)
- [createTree](GitLabAdapter.md#createtree)
- [fetchSnapshot](GitLabAdapter.md#fetchsnapshot)
- [fetchWithRetry](GitLabAdapter.md#fetchwithretry)
- [getRepositoryMetadata](GitLabAdapter.md#getrepositorymetadata)
- [isRetryableStatus](GitLabAdapter.md#isretryablestatus)
- [listBranches](GitLabAdapter.md#listbranches)
- [listCommits](GitLabAdapter.md#listcommits)
- [logDebug](GitLabAdapter.md#logdebug)
- [logError](GitLabAdapter.md#logerror)
- [logInfo](GitLabAdapter.md#loginfo)
- [logWarn](GitLabAdapter.md#logwarn)
- [mapWithConcurrency](GitLabAdapter.md#mapwithconcurrency)
- [resolveRef](GitLabAdapter.md#resolveref)
- [setLogger](GitLabAdapter.md#setlogger)
- [shaOf](GitLabAdapter.md#shaof)
- [updateRef](GitLabAdapter.md#updateref)

## Constructors

### constructor

• **new GitLabAdapter**(`options`): [`GitLabAdapter`](GitLabAdapter.md)

GitLabAdapter を初期化します。

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | `GLOptions` |

#### Returns

[`GitLabAdapter`](GitLabAdapter.md)

#### Overrides

AbstractGitAdapter.constructor

#### Defined in

[git/gitlabAdapter.ts:19](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L19)

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

▸ **createBlobs**(`changes`): `Promise`\<`Record`\<`string`, `string`\>\>

変更一覧から blob sha のマップを作成します（疑似実装）。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `changes` | `any`[] | 変更一覧 |

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

path->sha マップ

#### Implementation of

GitAdapter.createBlobs

#### Defined in

[git/gitlabAdapter.ts:104](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L104)

___

### createBranch

▸ **createBranch**(`branchName`, `fromSha`): `Promise`\<`CreateBranchResult`\>

Create a branch in GitLab: POST /projects/{projectId}/repository/branches

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `branchName` | `string` | name of branch to create |
| `fromSha` | `string` | branch/tag name or SHA to base the new branch on |

#### Returns

`Promise`\<`CreateBranchResult`\>

created branch info

#### Implementation of

GitAdapter.createBranch

#### Defined in

[git/gitlabAdapter.ts:246](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L246)

___

### createCommit

▸ **createCommit**(`message`, `parentSha`, `_treeSha`): `Promise`\<`any`\>

createTree で保持した actions があればコミットし、なければ parentSha を返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `message` | `string` | コミットメッセージ |
| `parentSha` | `string` | 親コミット SHA |
| `_treeSha` | `string` | ツリー SHA（未使用） |

#### Returns

`Promise`\<`any`\>

新規コミット SHA または parentSha

#### Implementation of

GitAdapter.createCommit

#### Defined in

[git/gitlabAdapter.ts:136](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L136)

___

### createCommitWithActions

▸ **createCommitWithActions**(`branch`, `message`, `changes`, `expectedParentSha?`): `Promise`\<`any`\>

actions を用いて GitLab のコミット API を呼び出します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `branch` | `string` | ブランチ名 |
| `message` | `string` | コミットメッセージ |
| `changes` | \{ `content?`: `string` ; `path`: `string` ; `type`: `string`  }[] | 変更一覧 |
| `expectedParentSha?` | `string` | - |

#### Returns

`Promise`\<`any`\>

コミット応答（id など）

#### Defined in

[git/gitlabAdapter.ts:171](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L171)

___

### createTree

▸ **createTree**(`_changes`, `_baseTreeSha?`): `Promise`\<`string`\>

互換用のツリー作成。実際には actions を保持しておき、マーカーを返します。

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `_changes` | `any`[] | 変更一覧 |
| `_baseTreeSha?` | `string` | ベースツリー（未使用） |

#### Returns

`Promise`\<`string`\>

マーカー文字列

#### Implementation of

GitAdapter.createTree

#### Defined in

[git/gitlabAdapter.ts:118](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L118)

___

### fetchSnapshot

▸ **fetchSnapshot**(`branch?`, `concurrency?`): `Promise`\<`any`\>

リポジトリのスナップショットを取得します。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `branch` | `string` | `'main'` | ブランチ名 (default: 'main') |
| `concurrency` | `number` | `5` | - |

#### Returns

`Promise`\<`any`\>

#### Defined in

[git/gitlabAdapter.ts:391](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L391)

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

### getRepositoryMetadata

▸ **getRepositoryMetadata**(): `Promise`\<`RepositoryMetadata`\>

Retrieve project metadata (default branch, name, id) and cache it.

#### Returns

`Promise`\<`RepositoryMetadata`\>

repository metadata

#### Implementation of

GitAdapter.getRepositoryMetadata

#### Defined in

[git/gitlabAdapter.ts:194](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L194)

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

List branches via GitLab API and map to BranchListPage.

#### Parameters

| Name | Type |
| :------ | :------ |
| `query?` | `BranchListQuery` |

#### Returns

`Promise`\<\{ `items`: \{ `commit`: \{ `sha`: `any` ; `url`: `any`  } ; `isDefault`: `boolean` ; `name`: `any` = b.name; `protected`: `boolean` = !!b.protected }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

#### Implementation of

GitAdapter.listBranches

#### Defined in

[git/gitlabAdapter.ts:225](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L225)

___

### listCommits

▸ **listCommits**(`query`): `Promise`\<\{ `items`: \{ `author`: `any` ; `date`: `any` ; `message`: `any` ; `parents`: `any` ; `sha`: `any`  }[] ; `lastPage`: `undefined` \| `number` = pages.lastPage; `nextPage`: `undefined` \| `number` = pages.nextPage }\>

List commits for a ref (GitLab commits API)

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

[git/gitlabAdapter.ts:37](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L37)

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
Resolution order: branch -> tag -> commits endpoint -> treat as SHA
Throws if not resolvable.

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

[git/gitlabAdapter.ts:537](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L537)

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

▸ **updateRef**(`_reference`, `_commitSha`, `_force?`): `Promise`\<`void`\>

リファレンス更新は不要なため noop 実装です。

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `_reference` | `string` | `undefined` | - |
| `_commitSha` | `string` | `undefined` | コミット SHA |
| `_force?` | `boolean` | `false` |  |

#### Returns

`Promise`\<`void`\>

#### Implementation of

GitAdapter.updateRef

#### Defined in

[git/gitlabAdapter.ts:160](https://github.com/nojaja/browser-git-ops/blob/ab0ff00e25c19fea34702fafaff2fcb271f7c6d9/src/git/gitlabAdapter.ts#L160)
