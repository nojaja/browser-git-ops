# オンデマンド取得（メタデータ先行 + 詳細遅延取得）詳細設計書

## 1. 目的
- 初期の一覧表示を軽量化し、ネットワーク負荷と描画コストを削減する。
- ファイル内容はユーザーが必要とするタイミングでのみ取得する。

## 2. 背景
- 現状の pull フローでは `fetchContent()` がリスト取得時に全件内容を取得しており、一覧描画が重い。
- リモート API は tree/一覧のメタ情報取得と blob/raw 取得を分離できるため、段階的取得が可能。

## 3. スコープ
- GitHub/GitLab 両アダプタの `fetchSnapshot()` と `fetchContent()` の挙動を見直す。
- `RemoteSynchronizer.pull()` をメタデータ（tree）中心で動作させる。
- `readBlob(p, 'base')` のタイミングで必要なファイルのみを on-demand 取得する。
- 実装は本設計合意後に行う。

## 4. 用語
- **メタデータ**: tree API で得られるパス・blob sha 等の情報。
- **詳細データ**: blob/raw API で得られるファイル内容。
- **オンデマンド取得**: `readBlob(p, 'base')` 要求時に未取得の内容を取得する方式。

## 5. 要件（新仕様）
### 5.1 fetchTree（メタデータ先行）
- 一覧取得（pull）時は tree 取得のみを行う。
- 取得した file tree 情報を `readBlob(p, 'info')` に書き込む。
  - `info` には `path`, `baseSha`, `state`, `updatedAt` 等を保存。

**GitHub**
- `GET /repos/{owner}/{repo}/git/trees/{headSha}?recursive=1`
- 実装例: `https://api.github.com/repos/owner/repo/git/trees/abc123...?recursive=1`
- ベースパス: `https://api.github.com` または GitHub Enterprise URL
- 詳細: `src/git/githubAdapter.ts` の L633 参照

**GitLab**
- `GET /api/v4/projects/{projectId}/repository/tree?recursive=true&ref={branch}`
- 実装例: `https://gitlab.com/api/v4/projects/root%2Ftest-repo/repository/tree?recursive=true&ref=main`
- ベースパス: `https://gitlab.com` または GitLab CE/EE URL
- 詳細: `src/git/gitlabAdapter.ts` の tree 取得箇所参照

### 5.2 fetchContent（オンデマンド・単一ファイル）
- 既存の `fetchContent(paths[])` は廃止。
- `readBlob(p, 'base')` 実行時に内容が未取得の場合のみ、対象ファイルを 1 件取得する。

**GitHub**
- `GET /repos/{owner}/{repo}/git/blobs/{blobSha}`
- 実装例: `https://api.github.com/repos/owner/repo/git/blobs/9af29826d6e11847f0cff8a17b7403cfb9f5596c`
- ベースパス: `https://api.github.com` または GitHub Enterprise URL
- 詳細: `src/git/githubAdapter.ts` の L451 参照（getBlob メソッド）

**GitLab**
- `GET /api/v4/projects/{projectId}/repository/files/{path}/raw?ref={branch}`
- 実装例: `https://gitlab.com/api/v4/projects/root%2Ftest-repo/repository/files/README.md/raw?ref=000d90d44fca4b41652b9fa5c69d89d205824532`
- ベースパス: `https://gitlab.com` または GitLab CE/EE URL
- 注意: `{path}` は URL エンコードが必要（例: `README.md` → `README%2Emd`）
- 詳細: `src/git/gitlabAdapter.ts` の `_fetchFileRaw` メソッド参照

## 6. 責務配置（RemoteSynchronizer責務案）
### 6.1 方針
- オンデマンド取得の責務は **RemoteSynchronizer** に集約する。
- `StorageBackend` からは通常の `readBlob()` を呼ぶが、`RemoteSynchronizer` から提供するラッパ（または `readBaseWithOnDemand` のような API）経由で遅延取得を行う。
- `VirtualFS` は「同期/取得の詳細」を持たず、`RemoteSynchronizer` の提供する API に委譲する。

### 6.2 理由
- 同期処理（pull）と整合性ロジック（conflict 解決）を同一レイヤで統合できる。
- `readBlob('base')` で不足した場合の取得・`info` 更新・キャッシュ更新を一貫して管理できる。

### 6.3 メリット
- 同期フローの一貫性: tree メタデータと on-demand 内容取得が同じ責務境界に置かれる。
- 競合管理との整合性が取りやすい（pull 由来の `info` 更新と同じ層で実施）。
- アダプタ依存処理を `RemoteSynchronizer` で管理できる。

### 6.4 デメリット／対策
- `RemoteSynchronizer` が `readBlob()` の利用箇所へアクセスしづらい。
  - 対策: `RemoteSynchronizer` に `fetchBaseIfMissing(path)` のような API を追加し、`VirtualFS` から呼び出す。
- `RemoteSynchronizer` が肥大化する可能性。
  - 対策: `fetchTree` / `fetchContent` を小さな private helper に分割し、責務の境界を明確化する。

## 7. 新フロー概要
### 7.1 pull フロー（メタデータ先行）
1. アダプタで tree API を呼び出し、パス・sha 一覧を取得。
2. `RemoteSynchronizer.pull()` は `info` のみ更新し、`base` は未取得のままにする。
3. 一覧 UI は `info` を参照して表示する。

### 7.2 詳細取得フロー（オンデマンド）
1. `readBlob(p, 'base')` 要求が発生。
2. `RemoteSynchronizer` の on-demand API を通じて内容取得。
3. 取得内容を `base` に保存し、必要に応じて `info` の `baseSha` を更新。
4. 取得後は通常の `readBlob()` と同じ挙動。

## 8. インターフェース設計（案）
- `RemoteSnapshotDescriptor.fetchContent(paths: string[])` は廃止。
- `RemoteSynchronizer` に on-demand 取得用 API を追加（実装は後続）。
  - 例: `fetchBaseIfMissing(path: string): Promise<string | null>`
  - 例: `readBaseWithOnDemand(path: string): Promise<string | null>`
- `VirtualFS` は `readBlob` を直接呼ばず、上記 API 経由で base 取得を行う。

## 9. データ永続化
- `info`
  - `path`, `baseSha`, `state`, `updatedAt` を保存。
- `base`
  - on-demand 取得後に保存。

## 10. エラーハンドリング
- 取得失敗時は `base` を更新しない。
- API エラーは `NonRetryableError`/`RetryableError` に準拠（既存方針踏襲）。

## 11. 互換性
- 既存の pull 結果と index 形式は維持する。
- `fetchContent` の廃止は内部利用に限定し、外部 API 仕様の破壊は回避する。

## 12. テスト観点
- tree 取得のみで pull が完了すること。
- `readBlob('base')` で初回のみ on-demand 取得されること。
- 取得済みの `base` は再取得されないこと。
- 競合パスの `info` と `base` の整合が維持されること。

## 13. 影響範囲
- `GitHubAdapter.fetchSnapshot()`
- `GitLabAdapter.fetchSnapshot()`
- `RemoteSynchronizer.pull()`
- `VirtualFS.readFile()` / `StorageBackend.readBlob()` 呼び出し経路

## 14. 未決事項
- `RemoteSynchronizer` へ追加する API 名称の最終決定。
- `readBlob('base')` の on-demand をどのタイミングでトリガーするか（readFile か backend read か）。
- 取得失敗時の UI 通知方針。

## 15. Conflict Storage Change（v0.0.4）

### 15.1 概要
v0.0.3 では、コンフリクト発生時にリモート側の **完全なファイルコンテンツ**（Blob）を `'conflict'` セグメントに保存していました。
v0.0.4 では、**メタデータ先行パターン**に合わせて、conflict セグメント保存モデルを変更します。

### 15.2 v0.0.3 → v0.0.4 の変更

#### v0.0.3（現在）
```
conflict 発生時の処理フロー:
├─ RemoteSynchronizer._handleRemoteNewConflict(p, content)
│  └─ conflictManager.persistRemoteContentAsConflict(p, content)  ← content = リモート blob
│     └─ backend.writeBlob(p, content, 'conflict')  ← 完全なコンテンツを保存
├─ ConflictManager.readConflict(p)
│  └─ backend.readBlob(p, 'conflict')  ← リモート blob を返却
└─ ConflictManager.resolveConflict(p)
   ├─ remoteContent = backend.readBlob(p, 'conflict')  ← リモート blob を取得
   └─ backend.writeBlob(p, remoteContent, 'base')  ← base に複製

Storage: conflict セグメント = リモート blob フルコンテンツ
```

#### v0.0.4（予定）
```
conflict 発生時の処理フロー:
├─ RemoteSynchronizer._handleRemoteNewConflict(p, content)
│  ├─ (古) conflictManager.persistRemoteContentAsConflict(p, content)  ← 廃止予定
│  └─ (新) remoteInfo = { path: p, baseSha: remoteHeadSha, state: 'conflict', updatedAt: Date.now() }
│     └─ backend.writeBlob(p, JSON.stringify(remoteInfo), 'conflict')  ← メタデータのみ保存
├─ ConflictManager.readConflict(p)  ← 変更必要
│  ├─ conflictInfoJson = backend.readBlob(p, 'conflict')  ← メタデータ取得
│  └─ return JSON.parse(conflictInfoJson)  ← メタデータ返却
├─ ConflictManager.resolveConflict(p)  ← 変更必要
│  ├─ conflictInfo = backend.readBlob(p, 'conflict')  ← メタデータ取得
│  ├─ remoteContent = await backend.readBlob(p, 'conflictBlob')  ← on-demand fetch
│  │  または RemoteSynchronizer.fetchContent([p])  ← リモート fetch
│  └─ backend.writeBlob(p, remoteContent, 'base')  ← base に複製
└─ promoteResolvedConflictEntry(c, baseSnapshot)  ← 変更必要
   └─ 同様に conflictBlob から取得

Storage: 
  - conflict セグメント = メタデータ JSON（小容量）
  - conflictBlob セグメント = リモート blob フルコンテンツ（on-demand）
```

### 15.3 Segment 型の変更

**ファイル**: `src/virtualfs/storageBackend.ts`

```typescript
// v0.0.3 (現在)
export type Segment = 'workspace' | 'base' | 'conflict' | 'info' | 'info-workspace' | 'info-git'

// v0.0.4（変更）
export type Segment = 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info' | 'info-workspace' | 'info-git'
```

### 15.4 影響範囲（修正必須ファイル）

#### HIGH 優先度（コア機能変更）
1. **`src/virtualfs/conflictManager.ts`** 
   - `readConflict()`: メタデータ JSON 読み取りに変更
   - `resolveConflict()`: conflictBlob or on-demand fetch 後に base へ複製
   - `persistRemoteContentAsConflict()`: 仕様廃止 or 引数型変更（Blob → Info JSON）
   - `promoteResolvedConflictEntry()`: 同様に conflictBlob から取得

2. **`src/virtualfs/remoteSynchronizer.ts`**
   - `_handleRemoteNewConflict()` (L310): 既にコメント記載あり、実装を完成
   - `_handleRemoteExistingConflict()` (L410): 既にコメント記載あり、実装を完成
   - 両メソッド内: `remoteInfo` JSON を conflict へ、blob を conflictBlob or fetchable に

3. **`src/virtualfs/storageBackend.ts`**
   - Segment 型に `'conflictBlob'` を追加

#### HIGH 優先度（ストレージ実装）
4. **`src/virtualfs/inmemoryStorage.ts`**
   - `conflictBlobs` Map の現状維持 ✓（既に定義あり）
   - `readBlob(filepath, segment)` で segment === 'conflictBlob' 対応
   - `writeBlob(filepath, content, segment)` で segment === 'conflictBlob' 対応（既に実装）
   - `deleteBlob(filepath, segment)` で segment === 'conflictBlob' 対応（既に実装）
   - `_readInMemoryBlobWithSegment()` に 'conflictBlob' ケース追加

5. **`src/virtualfs/indexedDatabaseStorage.ts`**
   - readBlob/writeBlob/deleteBlob で 'conflictBlob' サポート追加
   - Segment 型の更新に対応

6. **`src/virtualfs/opfsStorage.ts`**
   - `_readBlobFromRoot()` 関数署名型を `Segment` に統一（現在不完全）
   - `_readFromSegment()` で 'conflictBlob' ケース追加
   - writeBlob でも 'conflictBlob' ケース追加

7. **`src/virtualfs/localFileManager.ts`**（実装確認必要）
   - readBlob/writeBlob で 'conflictBlob' サポート追加

#### MEDIUM 優先度（テスト・スナップショット）
8. **`test/unit/behavior/v0.0.3/virtualfs/targetedBranches.behavior.test.ts`** (L55, 88)
   - `readBlob(p, 'conflict')` → メタデータ JSON 期待に変更
   - `readBlob(p, 'conflictBlob')` → 実際のコンテンツ期待（既に記載）

9. **その他 behavior テスト**
   - conflict 関連テストの期待値更新（20+ マッチ）
   - 特に `v0.0.3/virtualfs/` 配下のテスト群

#### LOW 優先度（型チェック・補助）
10. **`src/virtualfs/types.ts`**
    - IndexEntry.state に 'conflict' 既に存在 ✓
    - 特に追加修正なし（ただし remote Info 構造の定義推奨）

### 15.5 修正順序とポイント

1. **Segment 型定義** → storageBackend.ts に 'conflictBlob' 追加
2. **ストレージ実装** → inmemoryStorage / indexedDatabaseStorage / opfsStorage / localFileManager
3. **ConflictManager** → readConflict / resolveConflict / persistRemoteContentAsConflict
4. **RemoteSynchronizer** → _handleRemoteNewConflict / _handleRemoteExistingConflict
5. **テスト修正** → behavior テスト群の期待値更新

### 15.6 実装時の懸念事項

#### 問題 1: persistRemoteContentAsConflict() の処理が混在
**現状**: remoteSynchronizer で以下が連続実行
```typescript
await this._conflictManager.persistRemoteContentAsConflict(p, content)  // v0.0.3 style
// ... 
const remoteInfo = { path: p, baseSha: remoteHeadSha, state: 'conflict', updatedAt: Date.now() }
await this._backend.writeBlob(p, JSON.stringify(remoteInfo), 'conflict')  // v0.0.4 style
```

**対応**: persistRemoteContentAsConflict を廃止するか、Info JSON 版に変更

#### 問題 2: conflictBlob の取得タイミング
**選択肢**:
- A) resolveConflict で conflictBlob segment から読む（現在の storage に依存）
- B) RemoteSynchronizer から on-demand fetch して conflictBlob に書き込む

**推奨**: B) RemoteSynchronizer が中央で管理し、fetchContent or adapter.getBlob() を呼び出す

#### 問題 3: テスト群の更新箇所が多数（20+）
**対応**: behavior テスト群を一括更新する必要あり

### 15.7 Segment 型定義の拡張例

conflict と conflictBlob を区別するため、同じマップを使うなら segmentToStore の修正が必要。

```typescript
// inmemoryStorage.ts の _applyBlobToStore 例
private _applyBlobToStore(store: any, seg: string, filepath: string, content: string): void {
  const branch = this.currentBranch || 'main'
  if (seg === SEG_WORKSPACE) store.workspaceBlobs.set(filepath, content)
  else if (seg === 'base') store.baseBlobs.set(`${branch}${BRANCH_SEP}${filepath}`, content)
  else if (seg === 'conflict') store.conflictBlobs.set(`${branch}${BRANCH_SEP}${filepath}`, content)  // メタデータ JSON
  else if (seg === 'conflictBlob') store.conflictBlobs.set(`${branch}${BRANCH_SEP}${filepath}`, content)  // 実際の blob
  // ...
}
```

※ 同じマップ `conflictBlobs` を使う場合、キー衝突を避けるため別マップに分割するか、プレフィックスで区別する必要あり。

## 16. 変更履歴
- 2026-02-06: 初版（オンデマンド取得設計）
- 2026-02-06: セクション 15 追加（Conflict Storage Change 仕様）
