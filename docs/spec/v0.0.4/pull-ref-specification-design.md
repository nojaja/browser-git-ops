# pull()でcommit-ish直接指定機能 詳細設計書

## 1. 目的
VirtualFSの`pull()`メソッドを拡張し、ブランチ名やコミットSHA等の`commit-ish`を直接指定して、そのバージョンへの切り替えを一度の操作で実現する。現在のsetBranch()→pull()の2段階フローを統合し、pull()内で処理成功時に自動的にブランチ/HEADを更新する。

## 2. スコープ
- `pull()`メソッドのシグネチャ拡張と実装変更
- commit-ish探索ロジックの実装（リモートブランチ→タグ→その他の順）
- Adapter層での`resolveRef()`メソッド追加
- 既存コード（例：examples/src/app.ts）の移行
- エラーハンドリングの統一
- setAdapterとの競合回避テスト

## 3. 前提条件
- ローカルブランチ概念なし
- workspaceはbaseに対する差分レイヤ
- IndexManagerはhead（現在のHEAD SHA）を管理
- adapterMetaはadapter.opts.branchでブランチ名を保持
- StorageBackend（OpfsStorage等）はsetBranch()でブランチスコープを管理

## 4. 既存コードの調査結果

### 4.1 pull()の現在の呼び出しパターン
```typescript
// examples/src/app.ts line 794
const res = await currentVfs.pull()

// test/unit/design/gitlab_full_flow.design.test.ts line 63
const pullRes = await currentVfs.pull()

// test/e2e/virtualfs.spec.ts line 241, 262, 279, ...
await page.evaluate(() => window.vfs.pull());
```

**結論**: 現在、pull()は**引数なし**で呼び出されている。全ての呼び出しがパラメータ無しなので、後方互換性破壊の影響は小さい。

### 4.2 現在のブランチ管理メカニズム
1. **adapterMetaでのブランチ保持**
   - `adapterMeta.opts.branch` にブランチ名を保存（例: 'main', 'develop'）
   - setAdapter()時にこのメタデータがIndexFileに保存される

2. **StorageBackendでのブランチスコープ**
   - OpfsStorage/IndexedDbStorageは`setBranch()`メソッドを実装
   - `currentBranch: string | null`を内部に保持
   - ファイルパスに`.git/{branch}/`プレフィックスを付与してセグメント化

3. **AdapterのfetchSnapshot()**
   - `fetchSnapshot(branch: string)`をGitHubAdapter/GitLabAdapterが実装
   - ブランチ名からGit APIを使用してツリー全体を取得

### 4.3 pull()の現在の実装フロー（line 471-498）
```
1. _resolveDescriptor()で入力を正規化
   - remote === undefined → getAdapterInstance()で自動取得
   - remote === string（headSha） → 正規化
   - remote === RemoteSnapshotDescriptor → そのまま使用
   - remote === { fetchSnapshot } → 呼び出し

2. RemoteSynchronizer.pull()に処理委譲
   - パス単位の同期判定（追加/更新/削除）
   - 衝突検出
   - indexを再構築

3. indexManager.loadIndex()で再読み込み

4. リターン: conflicts, fetchedPaths, reconciledPaths等
```

**note**: 現在は引数なし呼び出しの場合、adapterMetaのbranchをデフォルト値として使用していない。引数なし→adapter自動取得→当該ブランチの最新スナップショット取得という流れ。

## 5. 新仕様設計

### 5.1 pull()のシグネチャ拡張

#### 現在のシグネチャ
```typescript
async pull(
  remote?: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> },
  baseSnapshot?: Record<string, string>
): Promise<{
  conflicts: ConflictEntry[]
  fetchedPaths: string[]
  reconciledPaths: string[]
  remote: RemoteSnapshotDescriptor
  remotePaths: string[]
  preIndexKeys: string[]
  postIndexKeys: string[]
  addedPaths: string[]
}>
```

#### 新シグネチャ
```typescript
async pull(options?: {
  ref?: string              // 指定するcommit-ish（ブランチ名、タグ、SHA等）
  remote?: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> }
  baseSnapshot?: Record<string, string>
}): Promise<{
  conflicts: ConflictEntry[]
  fetchedPaths: string[]
  reconciledPaths: string[]
  remote: RemoteSnapshotDescriptor
  remotePaths: string[]
  preIndexKeys: string[]
  postIndexKeys: string[]
  addedPaths: string[]
  resolvedSha?: string      // 新規: 実際に解決されたコミットSHA
  resolvedRef?: string      // 新規: 実際に解決されたref（例: refs/remotes/origin/main）
}>
```

#### 後方互換性への対応
**破壊的変更**。既存コード（pull(remote, baseSnapshot)）は移行が必要。

移行例：
```typescript
// 旧
await vfs.pull(remoteSnapshot, baseSnapshot)

// 新（互換的な呼び出し）
await vfs.pull({ remote: remoteSnapshot, baseSnapshot })

// 新（ref指定）
await vfs.pull({ ref: 'develop' })

// 新（引数なし、getBranch()の値を使用）
await vfs.pull()
```

### 5.2 ref指定時のfetch-on-demand フロー

```
1. options.ref が指定されている場合：
   a. resolveRef(ref) を呼び出してcommit-ish → SHA解決
      - リモートブランチ（refs/remotes/<remote>/<ref>） を探索
      - タグ（refs/tags/<ref>） を探索
      - その他（refs/<ref>） を探索
      - 最初に見つかったものをSHAに解決
   
   b. remote（RemoteSnapshotDescriptor）を指定しない場合：
      - getAdapterInstance()から adapter を取得
      - adapter.fetchSnapshot(resolvedRef) でスナップショット取得
      （または fetchContent機能付きの RemoteSnapshotDescriptor構築）
   
   c. remote指定がある場合：
      - remote使用時でもresolvedRefを記録
      - スナップショットの取得はremote.fetchContent()を使用

2. ref指定なし、options === undefined の場合：
   a. getBranch()（新メソッド）で current branch 取得
   b. Adapterのデフォルトブランチが設定されていれば使用
   c. それ以外は 'main'にフォールバック
   d. 上記と同じfetch-on-demand フロー

3. RemoteSynchronizer.pull()で同期処理

4. 成功時：
   a. indexManager.setHead(resolvedSha) で HEAD更新
   b. adapterMeta.opts.branch = resolvedRef で ブランチメタデータ更新
   c. setAdapter()で変更をIndexFileに保存

5. 例外：
   a. resolveRef()失敗 → エラーをthrow
   b. RemoteSynchronizer.pull()失敗 → エラーをthrow
      （HEADは更新しない）
```

### 5.3 getBranch()メソッド（新規）

StorageBackendからブランチスコープを取得するヘルパメソッド。

```typescript
/**
 * 現在のブランチを取得します。Adapter層の cached branch または
 * StorageBackendのscoped branch を返します。
 * @returns {string} ブランチ名（デフォルト: 'main'）
 */
async getBranch(): Promise<string> {
  // 優先順序：
  // 1. adapterMeta.opts.branch（Adapter層のメタデータ）
  if (this.adapterMeta && this.adapterMeta.opts && this.adapterMeta.opts.branch) {
    return this.adapterMeta.opts.branch
  }
  
  // 2. StorageBackendのcurrentBranch（scoped storage向け）
  // 注: StorageBackendは getBranch() を提供していないため、代わりに adapterMeta を優先
  // StorageBackendでブランチスコープを管理する場合は、別途実装検討
  
  // 3. indexFile.adapter.opts.branch（保存済メタデータ）
  try {
    const index = await this.indexManager.getIndex()
    if ((index as any).adapter && (index as any).adapter.opts && (index as any).adapter.opts.branch) {
      return (index as any).adapter.opts.branch
    }
  } catch {
    // ignore
  }
  
  // 4. デフォルト値
  return 'main'
}
```

### 5.4 resolveRef()の実装（Adapter層）

#### AbstractGitAdapter への契約追加
```typescript
export interface GitAdapter {
  // 既存メソッド...
  
  /**
   * commit-ish をSHAに解決します。
   * 探索順序: リモートブランチ → タグ → その他
   * @param ref commit-ish （ブランチ名、タグ、SHA等）
   * @returns {Promise<string>} 解決されたコミットSHA
   * @throws {Error} 解決失敗時
   */
  resolveRef(ref: string): Promise<string>
}
```

#### GitHubAdapter での実装例
```typescript
async resolveRef(ref: string): Promise<string> {
  // 1. リモートブランチ探索
  // GET /repos/{owner}/{repo}/git/refs/heads/{ref}
  try {
    const res = await this._fetch(`/repos/${this.owner}/${this.repo}/git/refs/heads/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      return obj.object.sha
    }
  } catch {
    // 続行
  }
  
  // 2. タグ探索
  // GET /repos/{owner}/{repo}/git/refs/tags/{ref}
  try {
    const res = await this._fetch(`/repos/${this.owner}/${this.repo}/git/refs/tags/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      // annoated tag の場合は object.type === 'tag' なので、
      // commit を取得する必要があるかもしれない
      return obj.object.sha
    }
  } catch {
    // 続行
  }
  
  // 3. その他のref
  // GET /repos/{owner}/{repo}/git/refs/{ref}
  try {
    const res = await this._fetch(`/repos/${this.owner}/${this.repo}/git/refs/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      return obj.object.sha
    }
  } catch {
    // 続行
  }
  
  // 4. SHAそのもの（フォールバック）
  if (/^[0-9a-f]{40}$/.test(ref)) {
    return ref
  }
  
  throw new Error(`ref '${ref}' を解決できませんでした`)
}
```

#### GitLabAdapter での実装例
```typescript
async resolveRef(ref: string): Promise<string> {
  // 1. リモートブランチ探索
  // GET /projects/{projectId}/repository/branches/{ref}
  try {
    const res = await this._fetch(`/projects/${this.projectId}/repository/branches/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      return obj.commit.id
    }
  } catch {
    // 続行
  }
  
  // 2. タグ探索
  // GET /projects/{projectId}/repository/tags/{ref}
  try {
    const res = await this._fetch(`/projects/${this.projectId}/repository/tags/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      return obj.commit.id
    }
  } catch {
    // 続行
  }
  
  // 3. その他のref（全refs取得して探索）
  try {
    const res = await this._fetch(`/projects/${this.projectId}/repository/commits/${encodeURIComponent(ref)}`)
    if (res.ok) {
      const obj = await res.json()
      return obj.id
    }
  } catch {
    // 続行
  }
  
  // 4. SHAそのもの（フォールバック）
  if (/^[0-9a-f]{40}$/.test(ref)) {
    return ref
  }
  
  throw new Error(`ref '${ref}' を解決できませんでした`)
}
```

## 6. pull()実装の詳細フロー

### 6.1 _resolveDescriptor()の拡張

現在は入力を`remote`として取得しているが、新仕様では options.ref の処理を追加。

```typescript
/**
 * options.ref が指定されている場合、commit-ish をSHAに解決し、
 * 対応するsnapshotを取得する。
 */
private async _resolveDescriptorWithRef(
  options: { ref?: string; remote?: ...; baseSnapshot?: ... }
): Promise<RemoteSnapshotDescriptor | string> {
  const ref = options.ref
  
  // ref が指定されている場合は必ず解決
  if (ref && typeof ref === 'string') {
    const adapter = await this.getAdapterInstance()
    if (!adapter || typeof adapter.resolveRef !== 'function') {
      throw new Error('Adapterが利用できないため、refを解決できません')
    }
    
    const resolvedSha = await adapter.resolveRef(ref)
    
    // remote が指定されていない場合、Adapter経由でsnapshotを取得
    if (!options.remote) {
      // fetchSnapshot() を呼び出す（または fetchContent付き RemoteSnapshotDescriptor）
      return await adapter.fetchSnapshot(ref)
    } else {
      // remote が指定されている場合も remote を使用（ref は記録のみ）
      // ただし resolvedSha を戻り値に含める必要があるため、
      // 戻り値型を拡張するか、別途記録する
      return options.remote as any
    }
  }
  
  // ref 指定なし → 現在のブランチを取得
  if (!options.remote) {
    const currentBranch = await this.getBranch()
    const adapter = await this.getAdapterInstance()
    if (adapter && typeof adapter.fetchSnapshot === 'function') {
      return await adapter.fetchSnapshot(currentBranch)
    }
  }
  
  return options.remote as any
}
```

### 6.2 pull()の新実装スケルトン

```typescript
async pull(options?: {
  ref?: string
  remote?: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> }
  baseSnapshot?: Record<string, string>
}): Promise<PullResult> {
  const opts = options || {}
  const ref = opts.ref
  let resolvedSha: string | undefined = undefined
  let resolvedRef: string | undefined = undefined
  
  // ref 解決（存在する場合）
  if (ref && typeof ref === 'string') {
    const adapter = await this.getAdapterInstance()
    if (!adapter || typeof adapter.resolveRef !== 'function') {
      throw new Error('Adapter instance not available or does not support resolveRef')
    }
    resolvedSha = await adapter.resolveRef(ref)
    resolvedRef = ref
  } else if (!opts.remote) {
    // ref指定なく、remote指定もない場合 → 現在ブランチを使用
    const currentBranch = await this.getBranch()
    const adapter = await this.getAdapterInstance()
    if (!adapter || typeof adapter.resolveRef !== 'function') {
      throw new Error('Adapter instance not available')
    }
    resolvedSha = await adapter.resolveRef(currentBranch)
    resolvedRef = currentBranch
  }
  
  // RemoteSnapshotDescriptor の取得
  const descriptorRaw = await this._resolveDescriptor(opts.remote, opts.baseSnapshot)
  const normalized = await this._toNormalizedDescriptor(descriptorRaw)
  
  // RemoteSynchronizer での同期処理
  const pullResult = await this.remoteSynchronizer.pull(normalized, opts.baseSnapshot)
  
  // 成功時：HEAD更新とメタデータ保存
  if (resolvedSha) {
    this.indexManager.setHead(resolvedSha)
    
    // adapterMeta の branch 更新
    if (resolvedRef) {
      if (!this.adapterMeta) this.adapterMeta = {}
      if (!this.adapterMeta.opts) this.adapterMeta.opts = {}
      this.adapterMeta.opts.branch = resolvedRef
      
      // setAdapter() で IndexFile に保存
      await this.setAdapter(this.adapter, this.adapterMeta)
    }
    
    await this.indexManager.saveIndex()
  }
  
  return {
    ...pullResult,
    resolvedSha,
    resolvedRef
  }
}
```

## 7. StorageBackendのブランチ管理との統合

### 現状
- OpfsStorage/IndexedDbStorageは`setBranch()`で内部の`currentBranch`を更新
- ファイルパスに`.git/{branch}/`プレフィックスを付与

### 新仕様での扱い
- pull()成功後、`getBranch()`で取得したブランチをStorageBackendにも反映させるべきか？

#### 案1: VirtualFS層で統一管理（推奨）
- adapterMeta.opts.branch で統一
- StorageBackendの setBranch() は使用しない（後方互換性のみ）
- メリット: ブランチ管理が単一化、テストしやすい
- デメリット: StorageBackendのsetBranch()が活用されない

#### 案2: 同期的に管理
- pull()成功時に `this.backend.setBranch(resolvedRef)` も呼び出す
- メリット: StorageBackendのbranchスコープ機能を活用
- デメリット: 同期タイミングが複雑、テストが増える

**推奨**: 案1（VirtualFS層で統一）

理由：
- adapterMeta はIndexFile（永続化）に保存される
- StorageBackendのsetBranch()は一時的な状態変更で、IndexFileに保存されない
- setAdapter()との組み合わせで十分な永続性が確保できる

## 8. 既存コードの移行

### 8.1 examples/src/app.ts

**現在の呼び出し（line 794）**
```typescript
const res = await currentVfs.pull()
```

**移行後**
```typescript
const res = await currentVfs.pull()  // 引数なし → getBranch()を使用
```

**追加機能**
```typescript
// ブランチ指定での切り替え
const res = await currentVfs.pull({ ref: 'develop' })

// commit-ish（SHA、タグ等）での切り替え
const res = await currentVfs.pull({ ref: 'v1.0.0' })
const res = await currentVfs.pull({ ref: 'abc123def456...' })
```

### 8.2 テストコード

**gitlab_full_flow.design.test.ts, listFilesRaw.test.ts**

現在の呼び出し：
```typescript
const pullRes = await currentVfs.pull()
```

移行後は同じ（引数なし）

**e2e/virtualfs.spec.ts**

E2Eテストでの呼び出しも同様に引数なしで OK。

## 9. エラーハンドリング方針

### 9.1 resolveRef() 失敗時
- **例外をthrow**: `Error('ref "<ref>" を解決できませんでした')`
- 呼び出し側（pull()）は例外を伝搬
- テストケース：
  - 存在しないブランチ名
  - 存在しないタグ
  - 無効なSHA（40文字でない等）
  - API通信失敗

### 9.2 RemoteSynchronizer.pull() 失敗時
- RemoteSynchronizer が既に例外をthrow
- pull() はそれを伝搬
- **重要**: resolvedShaを取得済みでも、RemoteSynchronizer失敗時はHEADを更新しない

### 9.3 setAdapter() 失敗時
- best-effort（無視）
- ローカルのindexManager は更新されているため、最小限の一貫性は保持

## 10. setAdapterとの競合対策

### 10.1 現状
- `setAdapter(adapter, meta)` はadapterMetaを更新し、IndexFileに保存
- pull()成功後も同じメカニズムで更新

### 10.2 競合シナリオ
1. pull()がresolvedRefを取得中に setAdapter()が呼ばれる
2. setAdapter()が IndexFile を上書き
3. pull()が setAdapter()を呼び出す → resolvedRefが反映されない

### 10.3 対策
#### 方案A: ロック機構（複雑）
- asyncロック実装
- パフォーマンス低下

#### 方案B: 最後の書き込みが優先（現在のパターン）
- pull()内の setAdapter() を最後に呼び出す
- 同時実行を避ける（テスト/ドキュメントで注記）

#### 方案C: メソッド呼び出し順序の強制（推奨）
- pull()とsetAdapter()を同時に呼ばないことをドキュメントに明記
- テストで検証：pull()が成功 → adapterMetaが更新されていることを確認

**推奨**: 案C（テストで検証）

テストケース例：
```typescript
describe('pull() with ref', () => {
  it('should update adapterMeta.opts.branch after successful pull', async () => {
    await vfs.setAdapter(adapter, { type: 'github', opts: { branch: 'main' } })
    const result = await vfs.pull({ ref: 'develop' })
    
    const meta = await vfs.getAdapter()
    expect(meta.opts.branch).toBe('develop')
  })
  
  it('should NOT update adapterMeta if pull fails', async () => {
    await vfs.setAdapter(adapter, { type: 'github', opts: { branch: 'main' } })
    
    // resolveRef() 失敗させる
    jest.spyOn(adapter, 'resolveRef').mockRejectedValue(new Error('ref not found'))
    
    await expect(vfs.pull({ ref: 'nonexistent' })).rejects.toThrow()
    
    const meta = await vfs.getAdapter()
    expect(meta.opts.branch).toBe('main')  // 変更されない
  })
  
  it('should NOT update adapterMeta if setAdapter is called after pull starts', async () => {
    // 複数並行pull()をシミュレート
    const promise1 = vfs.pull({ ref: 'develop' })
    const promise2 = vfs.pull({ ref: 'feature' })
    
    // どちらが勝つか確定的ではない → テストスキップまたはドキュメント注記
    // 「同時実行禁止」を明記
  })
})
```

## 11. 型定義の変更

### 11.1 types.ts への追加

```typescript
/**
 * pull() の入力オプション（新仕様）
 */
export interface PullOptions {
  /** 指定するcommit-ish（ブランチ名、タグ、SHA等） */
  ref?: string
  /** リモートスナップショット or その取得方法 */
  remote?: RemoteSnapshotDescriptor | string | { fetchSnapshot: () => Promise<RemoteSnapshotDescriptor> }
  /** ベーススナップショット（baseSnapshot） */
  baseSnapshot?: Record<string, string>
}

/**
 * pull() の戻り値（拡張）
 */
export interface PullResult {
  conflicts: ConflictEntry[]
  fetchedPaths: string[]
  reconciledPaths: string[]
  remote: RemoteSnapshotDescriptor
  remotePaths: string[]
  preIndexKeys: string[]
  postIndexKeys: string[]
  addedPaths: string[]
  /** 新規: 実際に解決されたコミットSHA */
  resolvedSha?: string
  /** 新規: 実際に解決されたref（例: 'develop'） */
  resolvedRef?: string
}
```

### 11.2 adapter.ts への追加

```typescript
export interface GitAdapter {
  // 既存メソッド...
  
  /**
   * commit-ish をコミットSHAに解決します。
   * 探索順序:
   *   1. リモートブランチ（refs/remotes/<remote>/<ref>）
   *   2. タグ（refs/tags/<ref>）
   *   3. その他（refs/<ref>）
   *   4. SHAそのもの（フォールバック）
   * @param ref commit-ish （例: 'main', 'v1.0.0', 'abc123'）
   * @returns コミットSHA（40文字16進数）
   * @throws ref が解決できない場合
   */
  resolveRef?(ref: string): Promise<string>
}
```

## 12. テスト設計

### 12.1 単体テスト（Adapter）

#### GitHubAdapter.resolveRef()
- リモートブランチ → SHA 解決
- タグ → SHA 解決（annotated tag対応）
- その他のref → SHA 解決
- SHA パススルー
- 存在しないref → エラーthrow
- API通信失敗 → エラーthrow

#### GitLabAdapter.resolveRef()
- リモートブランチ（branches API） → SHA 解決
- タグ（tags API） → SHA 解決
- commits API へのフォールバック
- SHA パススルー
- 存在しないref → エラーthrow
- API通信失敗 → エラーthrow

### 12.2 統合テスト（VirtualFS）

#### getBranch()
- adapterMeta.opts.branch が返される
- adapterMeta が undefined の場合は 'main'
- IndexFile.adapter.opts.branch を取得

#### pull({ ref: '...' })
- ref が解決される
- snapshotが取得される
- HEAD が更新される
- adapterMeta.opts.branch が更新される

#### pull() （引数なし）
- getBranch() の値が使用される
- snapshot取得 → 同期処理

#### エラーハンドリング
- resolveRef() 失敗 → pull() は例外をthrow
- HEAD は更新されない
- adapterMeta は変更されない

### 12.3 競合テスト

#### setAdapterとの競合
- pull()成功後、adapterMetaが正しく更新されている
- pull()失敗時、adapterMetaが変更されない
- テスト注：並行実行は禁止

#### 既存コードとの互換性
- 引数なし pull() が機能する
- examples/src/app.ts が動作する

## 13. ドキュメント・マイグレーションガイド

### 13.1 API ドキュメント更新

#### pull()
```typescript
/**
 * リモート snapshot を取得して、ローカルに適用します。
 * ref が指定されている場合、そのcommit-ish に HEAD を切り替えます。
 * ref が指定されていない場合、getBranch()の値を使用します。
 * 
 * @param options - pull 設定
 * @param options.ref - 指定するcommit-ish（ブランチ名、タグ、SHA）
 *                       例: 'main', 'v1.0.0', 'abc123def456'
 * @param options.remote - リモート記述子（省略時はAdapter経由で取得）
 * @param options.baseSnapshot - ベーススナップショット（通常は省略）
 * 
 * @returns pull結果（conflicts, fetchedPaths, resolvedSha, resolvedRef等を含む）
 * 
 * @throws ref解決失敗時、通信エラー時等
 * 
 * @example
 * // 現在のブランチでpull
 * const res = await vfs.pull()
 * 
 * // 指定ブランチでpull
 * const res = await vfs.pull({ ref: 'develop' })
 * 
 * // タグでpull
 * const res = await vfs.pull({ ref: 'v1.0.0' })
 * 
 * @note ref と remote を同時に指定した場合、remote が優先されます
 * @note setAdapter() との並行実行は避けてください
 */
async pull(options?: PullOptions): Promise<PullResult>
```

### 13.2 マイグレーション手順

1. **Adapter実装の更新**
   - githubAdapter.ts に resolveRef() を追加
   - gitlabAdapter.ts に resolveRef() を追加

2. **VirtualFS実装の更新**
   - pull() のシグネチャを変更
   - getBranch() メソッドを追加
   - _resolveDescriptor() を拡張

3. **型定義の更新**
   - PullOptions, PullResult を types.ts に追加
   - GitAdapter に resolveRef() を追加

4. **既存コードの更新**
   - examples/src/app.ts: pull() 呼び出しは引数なしで OK
   - テストコード: pull() 呼び出しは引数なしで OK
   - UI側: refパラメータ指定の新機能を活用可能

5. **テストの追加**
   - resolveRef() 単体テスト
   - pull({ ref }) 統合テスト
   - getBranch() テスト
   - 競合シナリオテスト

## 14. 実装順序（提案）

1. 型定義追加（types.ts, adapter.ts）
2. getBranch() メソッド実装
3. Adapter.resolveRef() 実装（GitHub/GitLab）
4. VirtualFS.pull() 実装
5. テストコード作成
6. 既存コード移行
7. ドキュメント更新

## 15. 未決事項

- [ ] StorageBackend.setBranch() と adapterMeta.opts.branch の統合方針を確定
- [ ] ref解決失敗時のエラーメッセージフォーマット
- [ ] resolvedRef の形式：'develop' vs 'refs/remotes/origin/develop' vs 'refs/heads/develop'
  - 推奨: 短形式（'develop'）で保存、内部的に正規化
- [ ] タグ取得時、annotated tag の場合の commit 解決ロジック詳細
- [ ] API レート制限時の リトライ戦略
