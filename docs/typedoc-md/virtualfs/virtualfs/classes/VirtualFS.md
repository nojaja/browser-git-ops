[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [virtualfs/virtualfs](../README.md) / VirtualFS

# Class: VirtualFS

Defined in: [src/virtualfs/virtualfs.ts:6](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L6)

Virtual file system - 永続化バックエンドを抽象化した仮想ファイルシステム

## Constructors

### Constructor

> **new VirtualFS**(`options?`): `VirtualFS`

Defined in: [src/virtualfs/virtualfs.ts:19](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L19)

VirtualFS のインスタンスを初期化します。

#### Parameters

##### options?

オプション

###### backend?

[`StorageBackend`](../../storageBackend/interfaces/StorageBackend.md)

###### storageDir?

`string`

#### Returns

`VirtualFS`

## Properties

### backend

> `private` **backend**: [`StorageBackend`](../../storageBackend/interfaces/StorageBackend.md)

Defined in: [src/virtualfs/virtualfs.ts:12](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L12)

***

### base

> `private` **base**: `Map`\<`string`, \{ `content`: `string`; `sha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:8](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L8)

***

### index

> `private` **index**: [`IndexFile`](../../types/interfaces/IndexFile.md)

Defined in: [src/virtualfs/virtualfs.ts:11](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L11)

***

### storageDir

> `private` **storageDir**: `string` \| `undefined`

Defined in: [src/virtualfs/virtualfs.ts:7](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L7)

***

### tombstones

> `private` **tombstones**: `Map`\<`string`, [`TombstoneEntry`](../../types/interfaces/TombstoneEntry.md)\>

Defined in: [src/virtualfs/virtualfs.ts:10](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L10)

***

### workspace

> `private` **workspace**: `Map`\<`string`, \{ `content`: `string`; `sha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:9](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L9)

## Methods

### \_applyAddsOrUpdates()

> `private` **\_applyAddsOrUpdates**(`toAddOrUpdate`, `snapshot`, `newShas`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:306](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L306)

指定パス群を base に追加/更新し、backend に書き込みます。

#### Parameters

##### toAddOrUpdate

`string`[]

追加/更新するパス

##### snapshot

`Record`\<`string`, `string`\>

path->content マップ

##### newShas

`Record`\<`string`, `string`\>

path->sha マップ

#### Returns

`Promise`\<`void`\>

***

### \_applyChangeLocally()

> `private` **\_applyChangeLocally**(`ch`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:565](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L565)

ローカルに対する変更（create/update/delete）を適用するヘルパー

#### Parameters

##### ch

`any`

変更オブジェクト

#### Returns

`Promise`\<`void`\>

***

### \_applyChangesAndFinalize()

> `private` **\_applyChangesAndFinalize**(`commitSha`, `input`): `Promise`\<\{ `commitSha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:711](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L711)

Apply changes locally, update index head and persist index.
Returns the commit result object for callers.

#### Parameters

##### commitSha

`string`

##### input

`any`

#### Returns

`Promise`\<\{ `commitSha`: `string`; \}\>

***

### \_applyCreateOrUpdate()

> `private` **\_applyCreateOrUpdate**(`ch`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:599](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L599)

create/update 変更をローカルに適用します。

#### Parameters

##### ch

`any`

変更オブジェクト

#### Returns

`Promise`\<`void`\>

***

### \_applyDelete()

> `private` **\_applyDelete**(`ch`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:619](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L619)

delete 変更をローカルに適用します。

#### Parameters

##### ch

`any`

変更オブジェクト

#### Returns

`Promise`\<`void`\>

***

### \_applyRemovals()

> `private` **\_applyRemovals**(`toRemove`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:286](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L286)

指定パス群を削除として backend に反映します。

#### Parameters

##### toRemove

`string`[]

削除するパスの配列

#### Returns

`Promise`\<`void`\>

***

### \_areAllResolved()

> `private` **\_areAllResolved**(`conflicts`): `boolean`

Defined in: [src/virtualfs/virtualfs.ts:837](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L837)

conflicts が全て解決済みかどうかを判定する

#### Parameters

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

#### Returns

`boolean`

***

### \_changesFromAddedEntries()

> `private` **\_changesFromAddedEntries**(): `Promise`\<`object`[]\>

Defined in: [src/virtualfs/virtualfs.ts:407](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L407)

追加状態のエントリから create 変更を生成します。

#### Returns

`Promise`\<`object`[]\>

***

### \_changesFromIndexEntries()

> `private` **\_changesFromIndexEntries**(): `Promise`\<`object`[]\>

Defined in: [src/virtualfs/virtualfs.ts:396](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L396)

index entries から create/update の変更リストを生成します。

#### Returns

`Promise`\<`object`[]\>

***

### \_changesFromModifiedEntries()

> `private` **\_changesFromModifiedEntries**(): `Promise`\<`object`[]\>

Defined in: [src/virtualfs/virtualfs.ts:422](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L422)

変更状態のエントリから update 変更を生成します。

#### Returns

`Promise`\<`object`[]\>

***

### \_changesFromTombstones()

> `private` **\_changesFromTombstones**(): `object`[]

Defined in: [src/virtualfs/virtualfs.ts:386](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L386)

tombstone からの削除変更リストを生成します。

#### Returns

`object`[]

***

### \_computeRemoteShas()

> `private` **\_computeRemoteShas**(`baseSnapshot`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [src/virtualfs/virtualfs.ts:774](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L774)

snapshot から remote shas を計算して返す

#### Parameters

##### baseSnapshot

`Record`\<`string`, `string`\>

スナップショット
 *

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### \_computeToAddOrUpdate()

> `private` **\_computeToAddOrUpdate**(`snapshot`, `newShas`): `string`[]

Defined in: [src/virtualfs/virtualfs.ts:261](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L261)

指定スナップショットから追加・更新対象のパス一覧を計算します。

#### Parameters

##### snapshot

`Record`\<`string`, `string`\>

path->content マップ

##### newShas

`Record`\<`string`, `string`\>

path->sha マップ

#### Returns

`string`[]

追加/更新すべきパスの配列

***

### \_computeToRemove()

> `private` **\_computeToRemove**(`snapshot`): `string`[]

Defined in: [src/virtualfs/virtualfs.ts:275](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L275)

指定スナップショットから削除対象のパス一覧を計算します。

#### Parameters

##### snapshot

`Record`\<`string`, `string`\>

リモートの path->content マップ

#### Returns

`string`[]

削除すべきパスの配列

***

### \_ensureWorkspaceBlobForEntry()

> `private` **\_ensureWorkspaceBlobForEntry**(`p`, `e`): `Promise`\<\{ `content`: `string`; `sha`: `string`; \} \| `undefined`\>

Defined in: [src/virtualfs/virtualfs.ts:461](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L461)

workspace キャッシュがなければ backend から読み出して補完します。

#### Parameters

##### p

`string`

パス

##### e

`any`

インデックスエントリ

#### Returns

`Promise`\<\{ `content`: `string`; `sha`: `string`; \} \| `undefined`\>

workspace blob を返す

***

### \_handlePushWithAdapter()

> `private` **\_handlePushWithAdapter**(`input`, `adapter`): `Promise`\<\{ `commitSha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:725](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L725)

Handle push when an adapter is provided (delegates to _pushWithActions/_pushWithGitHubFlow).
Records commitKey in index metadata and returns the push result.

#### Parameters

##### input

`any`

##### adapter

`any`

#### Returns

`Promise`\<\{ `commitSha`: `string`; \}\>

***

### \_handleRemoteDeletion()

> `private` **\_handleRemoteDeletion**(`p`, `e`, `_remoteShas`, `conflicts`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:633](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L633)

リモート側で削除されたエントリをローカルに反映します。

#### Parameters

##### p

`string`

##### e

`any`

##### \_remoteShas

`Record`\<`string`, `string`\>

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

#### Returns

`Promise`\<`void`\>

***

### \_handleRemoteExisting()

> `private` **\_handleRemoteExisting**(`p`, `idxEntry`, `perFileRemoteSha`, `baseSnapshot`, `conflicts`, `localWorkspace`, `remoteHeadSha`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:530](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L530)

リモートに存在し、かつローカルにエントリがあるパスを処理します。

#### Parameters

##### p

`string`

##### idxEntry

`any`

##### perFileRemoteSha

`string`

##### baseSnapshot

`Record`\<`string`, `string`\>

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

##### localWorkspace

\{ `content`: `string`; `sha`: `string`; \} | `undefined`

##### remoteHeadSha

`string`

#### Returns

`Promise`\<`void`\>

***

### \_handleRemoteNew()

> `private` **\_handleRemoteNew**(`p`, `perFileRemoteSha`, `baseSnapshot`, `conflicts`, `localWorkspace`, `localBase`, `remoteHeadSha`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:499](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L499)

リモートに存在するがローカルにないパスを処理します。

#### Parameters

##### p

`string`

##### perFileRemoteSha

`string`

##### baseSnapshot

`Record`\<`string`, `string`\>

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

##### localWorkspace

\{ `content`: `string`; `sha`: `string`; \} | `undefined`

##### localBase

\{ `content`: `string`; `sha`: `string`; \} | `undefined`

##### remoteHeadSha

`string`

#### Returns

`Promise`\<`void`\>

***

### \_handleRemotePath()

> `private` **\_handleRemotePath**(`p`, `perFileRemoteSha`, `baseSnapshot`, `conflicts`, `remoteHeadSha`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:486](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L486)

リモートスナップショットからの差分取り込み時に、単一パスを評価して
必要なら conflicts に追加、もしくは base を更新します。

#### Parameters

##### p

`string`

##### perFileRemoteSha

`string`

##### baseSnapshot

`Record`\<`string`, `string`\>

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

##### remoteHeadSha

`string`

#### Returns

`Promise`\<`void`\>

***

### \_isNonFastForwardError()

> `private` **\_isNonFastForwardError**(`err`): `boolean`

Defined in: [src/virtualfs/virtualfs.ts:330](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L330)

指定エラーが non-fast-forward を示すか判定します。

#### Parameters

##### err

`any`

例外オブジェクト

#### Returns

`boolean`

***

### \_processRemoteAddsAndUpdates()

> `private` **\_processRemoteAddsAndUpdates**(`remoteShas`, `baseSnapshot`, `remoteHead`, `conflicts`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:786](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L786)

リモートの追加/更新を処理して conflicts を蓄積する
 *

#### Parameters

##### remoteShas

`Record`\<`string`, `string`\>

##### baseSnapshot

`Record`\<`string`, `string`\>

##### remoteHead

`string`

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

#### Returns

`Promise`\<`void`\>

***

### \_processRemoteDeletions()

> `private` **\_processRemoteDeletions**(`remoteShas`, `conflicts`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:796](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L796)

リモートの削除を処理して conflicts を蓄積する
 *

#### Parameters

##### remoteShas

`Record`\<`string`, `string`\>

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

#### Returns

`Promise`\<`void`\>

***

### \_promoteResolvedConflicts()

> `private` **\_promoteResolvedConflicts**(`conflicts`, `baseSnapshot`, `remoteHead`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:808](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L808)

conflicts の中で解決済みのものを base に昇格させる
 *

#### Parameters

##### conflicts

[`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]

##### baseSnapshot

`Record`\<`string`, `string`\>

##### remoteHead

`string`

#### Returns

`Promise`\<`void`\>

***

### \_pushChangeForModifiedEntry()

> `private` **\_pushChangeForModifiedEntry**(`out`, `p`, `e`, `w`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:447](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L447)

modified エントリを変更リストに追加する補助

#### Parameters

##### out

`any`[]

変更リスト

##### p

`string`

パス

##### e

`any`

エントリ

##### w

`any`

workspace blob

#### Returns

`Promise`\<`void`\>

***

### \_pushWithActions()

> `private` **\_pushWithActions**(`adapter`, `input`, `branch`): `Promise`\<\{ `commitSha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:656](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L656)

GitLab 風の actions ベースコミットフローで push を実行します。

#### Parameters

##### adapter

`any`

##### input

`any`

##### branch

`string`

#### Returns

`Promise`\<\{ `commitSha`: `string`; \}\>

***

### \_pushWithGitHubFlow()

> `private` **\_pushWithGitHubFlow**(`adapter`, `input`, `branch`): `Promise`\<\{ `commitSha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:666](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L666)

GitHub 風の blob/tree/commit フローで push を実行します。

#### Parameters

##### adapter

`any`

##### input

`any`

##### branch

`string`

#### Returns

`Promise`\<\{ `commitSha`: `string`; \}\>

***

### \_tryUpdateRef()

> `private` **\_tryUpdateRef**(`adapter`, `branch`, `commitSha`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:689](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L689)

Try to update remote ref and handle common non-fast-forward errors.
Throws when the remote reports a non-fast-forward conflict.

#### Parameters

##### adapter

`any`

##### branch

`string`

##### commitSha

`string`

#### Returns

`Promise`\<`void`\>

***

### applyBaseSnapshot()

> **applyBaseSnapshot**(`snapshot`, `headSha`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:241](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L241)

リモートのベーススナップショットを適用します。

#### Parameters

##### snapshot

`Record`\<`string`, `string`\>

path->content のマップ

##### headSha

`string`

リモート HEAD

#### Returns

`Promise`\<`void`\>

***

### deleteFile()

> **deleteFile**(`filepath`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:111](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L111)

ファイルを削除します（トゥームストーン作成を含む）。

#### Parameters

##### filepath

`string`

ファイルパス

#### Returns

`Promise`\<`void`\>

***

### getChangeSet()

> **getChangeSet**(): `Promise`\<`Change`[]\>

Defined in: [src/virtualfs/virtualfs.ts:368](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L368)

ワークスペースとインデックスから変更セットを生成します。

#### Returns

`Promise`\<`Change`[]\>

変更リスト

***

### getIndex()

> **getIndex**(): [`IndexFile`](../../types/interfaces/IndexFile.md)

Defined in: [src/virtualfs/virtualfs.ts:339](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L339)

インデックス情報を返します。

#### Returns

[`IndexFile`](../../types/interfaces/IndexFile.md)

***

### getTombstones()

> **getTombstones**(): [`TombstoneEntry`](../../types/interfaces/TombstoneEntry.md)[]

Defined in: [src/virtualfs/virtualfs.ts:355](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L355)

tombstone を返します。

#### Returns

[`TombstoneEntry`](../../types/interfaces/TombstoneEntry.md)[]

***

### init()

> **init**(): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:43](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L43)

VirtualFS の初期化を行います（バックエンド初期化と index 読み込み）。

#### Returns

`Promise`\<`void`\>

***

### listPaths()

> **listPaths**(): `string`[]

Defined in: [src/virtualfs/virtualfs.ts:347](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L347)

登録されているパス一覧を返します。

#### Returns

`string`[]

***

### loadIndex()

> `private` **loadIndex**(): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:52](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L52)

永続化レイヤーから index を読み込み、内部マップを初期化します。

#### Returns

`Promise`\<`void`\>

***

### pull()

> **pull**(`remoteHead`, `baseSnapshot`): `Promise`\<\{ `conflicts`: [`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]; \}\>

Defined in: [src/virtualfs/virtualfs.ts:749](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L749)

リモートのスナップショットを取り込み、コンフリクト情報を返します。

#### Parameters

##### remoteHead

`string`

リモート HEAD

##### baseSnapshot

`Record`\<`string`, `string`\>

path->content マップ

#### Returns

`Promise`\<\{ `conflicts`: [`ConflictEntry`](../../types/interfaces/ConflictEntry.md)[]; \}\>

***

### push()

> **push**(`input`, `adapter?`): `Promise`\<\{ `commitSha`: `string`; \}\>

Defined in: [src/virtualfs/virtualfs.ts:852](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L852)

変更をコミットしてリモートへ反映します。adapter が無ければローカルシミュレーションします。

#### Parameters

##### input

[`CommitInput`](../../types/interfaces/CommitInput.md)

コミット入力

##### adapter?

[`GitAdapter`](../../../git/adapter/interfaces/GitAdapter.md)

任意のアダプタ

#### Returns

`Promise`\<\{ `commitSha`: `string`; \}\>

***

### readConflict()

> **readConflict**(`filepath`): `Promise`\<`string` \| `null`\>

Defined in: [src/virtualfs/virtualfs.ts:179](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L179)

衝突ファイル（.git-conflict/配下）を取得します。

#### Parameters

##### filepath

`string`

ファイルパス

#### Returns

`Promise`\<`string` \| `null`\>

ファイル内容または null

***

### readFile()

> **readFile**(`filepath`): `Promise`\<`string` \| `null`\>

Defined in: [src/virtualfs/virtualfs.ts:160](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L160)

ワークスペース/ベースからファイル内容を読み出します。

#### Parameters

##### filepath

`string`

ファイルパス

#### Returns

`Promise`\<`string` \| `null`\>

ファイル内容または null

***

### renameFile()

> **renameFile**(`from`, `to`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:143](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L143)

rename を delete + create の合成で行うヘルパ

#### Parameters

##### from

`string`

元パス

##### to

`string`

新パス

#### Returns

`Promise`\<`void`\>

***

### resolveConflict()

> **resolveConflict**(`filepath`): `Promise`\<`boolean`\>

Defined in: [src/virtualfs/virtualfs.ts:191](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L191)

指定パスのリモート衝突ファイル (.git-conflict/) を削除して
競合を解消済とマークします。

#### Parameters

##### filepath

`string`

ファイルパス

#### Returns

`Promise`\<`boolean`\>

成功したら true

***

### saveIndex()

> `private` **saveIndex**(): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:75](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L75)

内部インデックスを永続化します。

#### Returns

`Promise`\<`void`\>

***

### shaOf()

> `private` **shaOf**(`content`): `Promise`\<`string`\>

Defined in: [src/virtualfs/virtualfs.ts:31](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L31)

コンテンツから SHA1 を計算します。

#### Parameters

##### content

`string`

コンテンツ

#### Returns

`Promise`\<`string`\>

計算された SHA

***

### writeFile()

> **writeFile**(`filepath`, `content`): `Promise`\<`void`\>

Defined in: [src/virtualfs/virtualfs.ts:88](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/virtualfs.ts#L88)

ファイルを書き込みます（ローカル編集）。

#### Parameters

##### filepath

`string`

ファイルパス

##### content

`string`

コンテンツ

#### Returns

`Promise`\<`void`\>
