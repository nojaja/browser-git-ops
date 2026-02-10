# `setAdapter` の `adapter` 引数削除（破壊的変更） - 詳細設計書

更新日: 2026-02-10
バージョン: v0.0.6

## 概要
- 目的: `VirtualFS#setAdapter(adapter, meta?)` の第一引数 `adapter` を廃止し、`setAdapter(meta)`（または `setAdapter()` の単純化）へ移行することでAPIを簡素化する。
- 破壊的変更であるため、呼び出し元・ドキュメント・テストの一括改修を行う。

## 背景と動機
- 現状: 外部コード（examples や README、UI）では `GitHubAdapter` / `GitLabAdapter` のインスタンスを生成して `setAdapter(instance, meta)` で登録する実装が混在している。
- 問題点: インスタンスの生成とメタ情報の登録が1メソッドで混在しているためAPIが曖昧で、ライフサイクル管理・DI が不明瞭になる。
- 期待効果: meta を中心とした登録に統一して `VirtualFS` 側で必要なら遅延インスタンス化を行うことで利用側の意図を明確化する。インスタンスを直接渡したいケースは明示的APIで扱う（下記参照）。

## 適用範囲（Scope）
- 影響ファイル:
  - `src/virtualfs/virtualfs.ts`（APIシグネチャ変更、内部呼び出しの修正）
  - `examples/src/app.ts`（呼び出し箇所の書き換え）
  - `README_ja.md`, `docs/spec/*`（使用例・仕様更新）
  - `examples/dist/bundle.js`（再ビルドで更新）
  - テスト: `test/unit/**` と E2E/例のテスト

## 破壊的変更の内容
1. `VirtualFS#setAdapter(adapter: any | null, meta?: any)` を廃止。
2. 新シグネチャ: `VirtualFS#setAdapter(meta: AdapterMeta): Promise<void>`
   - `meta` は必須とする。構造は本設計書に定義する `AdapterMeta` 型を準拠する。
   - 呼び出し側が `adapter` インスタンスを渡す仕様は廃止する。
3. 代替案: 明示的インスタンス登録は提供せず、meta による遅延生成を推奨
   - 呼び出し側は `meta` を渡し、`VirtualFS#getAdapterInstance()` による遅延インスタンス化を利用することを推奨する。

```ts
// 設計上の型定義（仕様）
interface AdapterMeta {
  type: 'github' | 'gitlab'
  opts: {
    // 共通オプション
    branch?: string
    defaultBranch?: string
    repositoryName?: string
    repositoryId?: number
    // GitHub specific
    owner?: string
    repo?: string
    // GitLab specific
    projectId?: number
    host?: string
    // 拡張用フィールド
    [key: string]: any
  }
}
```

## `VirtualFS` 側の実装要件
1. `setAdapter(meta)` の実装挙動（`meta` は必須）
   - `meta` が与えられた場合: 入力のバリデーションを行い（`meta.type` と `meta.opts` の存在を確認）、`this.adapterMeta = meta` を保存し、`await this._tryPersistAdapterMeta()` を呼ぶ。
   - `this.adapter` を上書きしない（既に `this.adapter` がある場合はそのままにする）。ただし、`meta.type` が指定され `this.adapter` が未設定の場合は内部で `this._instantiateAdapter(type, opts)` により遅延生成してもよい（実装ポリシーとして明示）。
   - アダプタの解除（登録解除）が必要な場合は別 API（例: `clearAdapter()`）を用意して実装することを想定する。
2. （注）インスタンス登録について
   - 本設計では `setAdapter(meta)` を中心に進め、明示的なインスタンス登録APIは導入しない方針を推奨する。
3. 内部呼び出しの修正例
   - 変更前（抜粋）:
     ```ts
     await this.setAdapter(this.adapter || adapterInstance, newMeta)
     ```
    - 変更後推奨:
       ```ts
       if (adapterInstance) this.adapter = adapterInstance
       await this.setAdapter(newMeta)
       ```
   - 目的: `setAdapter` はインスタンスを受け取らないため、インスタンス保持が必要な場合は直接 `this.adapter` を設定するか、別 API（例: `clearAdapter()`）で明示的に解除・設定を行う設計にする。
4. `getAdapterInstance()` の既存の遅延生成ロジックは残す（`this.adapter` が無ければ `this.adapterMeta` を元にインスタンス化する）。これにより、呼び出し側は meta のみを渡して動作する。

## `getAdapter()` の型強化（AdapterMeta を返す）

- 目的: 永続化された adapter メタ情報や `VirtualFS.getAdapter()` が返す型を明確化して型安全性を高める。
- 実装案:
   - `src/virtualfs/types.ts` に `AdapterMeta` を追加し、既存の `IndexFile.adapter` 型を `AdapterMeta | undefined` に切り替える。
   - `VirtualFS.getAdapter()` の戻り型を `Promise<AdapterMeta | null>` に変更する。
   - index 読み込み時にランタイム型ガード `isAdapterMeta(x): x is AdapterMeta` を用いて検証し、不正な形のデータは `null` にフォールバックする。

```ts
// src/virtualfs/types.ts の追記（例）
export interface AdapterMeta {
   type: 'github' | 'gitlab' | string
   opts: {
      branch?: string
      defaultBranch?: string
      repositoryName?: string
      repositoryId?: number
      owner?: string
      repo?: string
      projectId?: number
      host?: string
      [key: string]: any
   }
}

export interface IndexFile {
   head: string
   lastCommitKey?: string
   adapter?: AdapterMeta
   entries: Record<string, IndexEntry>
}
```

```ts
// src/virtualfs/virtualfs.ts の getAdapter 変更例（概要）
async getAdapter(): Promise<AdapterMeta | null> {
   try {
      const index = await this.indexManager.getIndex()
      const raw = (index as any).adapter
      this.adapterMeta = isAdapterMeta(raw) ? raw : null
      return this.adapterMeta
   } catch (e) {
      this.adapterMeta = null
      return null
   }
}

function isAdapterMeta(x: any): x is AdapterMeta {
   return x && typeof x.type === 'string' && x.opts && typeof x.opts === 'object'
}
```

変更により `getAdapter()` を利用する既存コードは `AdapterMeta | null` を扱うように更新が必要です（型注釈の追加、null チェックなど）。

## 呼び出し元（examples/README/tests）の変更ガイド
- 既存呼び出し:
  ```ts
  // 旧
  await currentVfs.setAdapter(adapterInstance, { type: 'github', opts: ghOpts })
  ```
- 新しい呼び出し（推奨: meta のみ渡す）:
  ```ts
  // 推奨
  await currentVfs.setAdapter({ type: 'github', opts: ghOpts })
  ```
- 呼び出し側が既に `adapterInstance` を保持している場合でも、まずは `meta` のみを渡すことを推奨する（`getAdapterInstance()` による遅延生成を利用する）。
- `null` を渡して meta のみ更新するケース:
  ```ts
  // 旧: await currentVfs.setAdapter(null, { type:'gitlab', opts: glOpts })
  await currentVfs.setAdapter({ type:'gitlab', opts: glOpts })
  ```

## ドキュメントとサンプル更新
- `README_ja.md`, `examples/src/app.ts` の `setAdapter` 呼び出しを全て置換。
- `docs/spec/*` で API のサンプルを更新。
- `examples/dist/bundle.js` は `examples` を再ビルドして生成する（bundle 中の呼び出しはソースを更新した上で自動的に変わる）。

## テスト戦略
1. 単体テスト
   - `VirtualFS` のユニットテスト: `setAdapter(meta)` の正常系・異常系
     - meta が null のときに index に適切に反映されること
     - meta が与えられたときに `getAdapterInstance()` が遅延で生成されること
   - 既存のテストで `setAdapter(adapter, meta)` を使っている箇所をすべて書き換える。
2. 統合テスト / E2E
   - `examples` の動作確認（アダプタ登録 → pull/push のワークフロー）
3. 回帰テスト
   - 既存のシナリオ（branch 作成、pull、push、listBranches）を実行して振る舞いが変わらないことを確認。

## マイグレーション手順
1. ブランチ作成: `feature/remove-setAdapter-adapter-arg`
2. コード変更（`src/virtualfs/virtualfs.ts`）
   - `setAdapter` のシグネチャを変更し、実装を上記ポリシーに従って修正
   - 内部呼び出し（`_persistAdapterBranchMeta` 等）を修正
3. 呼び出し元の修正
   - `examples/src/app.ts`、`README_ja.md`、`docs`、テストの修正
4. ビルドとテスト
   - `npm run build`（必要に応じて examples の再ビルド）
   - `npm run test`（unit + e2e）
5. ドキュメント更新
   - `CHANGELOG.md` に破壊的変更を記載
   - `docs/spec/v0.0.6/*` に本設計書と移行手順を置く
6. リリース
   - バージョンを v0.0.6 に更新し、タグ付け・リリースノート作成

## 受け入れ基準
- すべての unit テストがパスすること。
- `examples` の主要なシナリオ（接続・pull・push・branch操作）が動作することを確認する E2E テストをパスすること。
- ドキュメント（README, spec）に API 変更が反映されていること。

## リスクとロールバック
- リスク: 外部ユーザーコードや既存の bundle を壊すため、広範囲の修正が必要。
- ロールバック計画: 変更が問題を起こした場合、元の `setAdapter(adapter, meta)` シグネチャをラッパーとして再導入し、互換レイヤーを一時的に提供する。

## 代替案（短く）
- 後方互換レイヤーを残して `setAdapter` を暫定的にそのまま残しつつ `setAdapterMeta(meta)` と `setAdapterInstance(instance)` を追加する方法。段階的移行が可能だが、API が一時的に冗長になる。

## 作業見積もり
- 実装 + テスト + ドキュメント更新: 1〜2 日（小さな修正のみで済む場合）
- 大規模な呼び出し修正や examples の再設計が必要な場合は 2〜4 日

---

次のアクション候補:
- この設計で実装に進めてよいか承認をお願いします。

