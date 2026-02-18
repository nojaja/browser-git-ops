[browser-git-ops - v0.0.7](../README.md) / GitAdapter

# Interface: GitAdapter

## Implemented by

- [`GitHubAdapter`](../classes/GitHubAdapter.md)
- [`GitLabAdapter`](../classes/GitLabAdapter.md)

## Table of contents

### Methods

- [createBlobs](GitAdapter.md#createblobs)
- [createBranch](GitAdapter.md#createbranch)
- [createCommit](GitAdapter.md#createcommit)
- [createTree](GitAdapter.md#createtree)
- [getRepositoryMetadata](GitAdapter.md#getrepositorymetadata)
- [listBranches](GitAdapter.md#listbranches)
- [listCommits](GitAdapter.md#listcommits)
- [resolveRef](GitAdapter.md#resolveref)
- [updateRef](GitAdapter.md#updateref)

## Methods

### createBlobs

▸ **createBlobs**(`_changes`, `_concurrency?`): `Promise`\<`Record`\<`string`, `string`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_changes` | [`GitChange`](GitChange.md)[] |
| `_concurrency?` | `number` |

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

#### Defined in

[git/adapter.ts:34](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L34)

___

### createBranch

▸ **createBranch**(`_branchName`, `_fromSha`): `Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_branchName` | `string` |
| `_fromSha` | `string` |

#### Returns

`Promise`\<[`CreateBranchResult`](../README.md#createbranchresult)\>

#### Defined in

[git/adapter.ts:50](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L50)

___

### createCommit

▸ **createCommit**(`_message`, `_parentSha`, `_treeSha`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_message` | `string` |
| `_parentSha` | `string` |
| `_treeSha` | `string` |

#### Returns

`Promise`\<`string`\>

#### Defined in

[git/adapter.ts:38](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L38)

___

### createTree

▸ **createTree**(`_changes`, `_baseTreeSha?`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_changes` | [`GitChange`](GitChange.md)[] |
| `_baseTreeSha?` | `string` |

#### Returns

`Promise`\<`string`\>

#### Defined in

[git/adapter.ts:36](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L36)

___

### getRepositoryMetadata

▸ **getRepositoryMetadata**(): `Promise`\<[`RepositoryMetadata`](../README.md#repositorymetadata)\>

#### Returns

`Promise`\<[`RepositoryMetadata`](../README.md#repositorymetadata)\>

#### Defined in

[git/adapter.ts:46](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L46)

___

### listBranches

▸ **listBranches**(`_query?`): `Promise`\<[`BranchListPage`](../README.md#branchlistpage)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_query?` | [`BranchListQuery`](../README.md#branchlistquery) |

#### Returns

`Promise`\<[`BranchListPage`](../README.md#branchlistpage)\>

#### Defined in

[git/adapter.ts:44](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L44)

___

### listCommits

▸ **listCommits**(`_query`): `Promise`\<[`CommitHistoryPage`](../README.md#commithistorypage)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_query` | [`CommitHistoryQuery`](../README.md#commithistoryquery) |

#### Returns

`Promise`\<[`CommitHistoryPage`](../README.md#commithistorypage)\>

#### Defined in

[git/adapter.ts:42](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L42)

___

### resolveRef

▸ **resolveRef**(`_reference`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_reference` | `string` |

#### Returns

`Promise`\<`string`\>

#### Defined in

[git/adapter.ts:48](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L48)

___

### updateRef

▸ **updateRef**(`_reference`, `_commitSha`, `_force?`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `_reference` | `string` |
| `_commitSha` | `string` |
| `_force?` | `boolean` |

#### Returns

`Promise`\<`void`\>

#### Defined in

[git/adapter.ts:40](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/adapter.ts#L40)
