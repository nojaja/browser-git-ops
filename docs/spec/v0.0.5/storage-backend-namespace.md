# StorageBackend 名前空間対応 詳細設計

## 概要
この設計は `StorageBackendConstructor` のコンストラクタと `availableRoots` に `namespace` 引数を追加し、ストレージのルートパスをこれまでの `{
_root}/.git/` から `{namespace}/{_root}/.git/` に変更するための詳細設計です。

目的：同一FQDN内で複数のアプリケーションが当ライブラリを利用する場合に、ストレージ（ファイル/OPFS/IndexedDB）が混在する問題を解決するために、アプリ固有の `namespace` を導入します。

> 注意: まだ実装を行わず、本設計のレビュー・合意の後に実装フェーズへ進んでください。

---

## 変更サマリ

- `StorageBackendConstructor` のコンストラクタシグネチャを変更
  - 変更前: `new(_root?: string): StorageBackend`
  - 変更後: `new(namespace: string, _root?: string): StorageBackend`
- `StorageBackendConstructor.availableRoots()` に `namespace` 引数を追加
  - 変更後シグネチャ案: `availableRoots(namespace: string): string[] | Promise<string[]>`
- ストレージ内の全てのパス操作は `namespace` をルートに持つように正規化される
  - 例: `{namespace}/{_root}/.git/index.json`、`{namespace}/{_root}/workspace/path/to/file` など
- OPFS実装はフォルダ階層を `{namespace}/{_root}/...` に変更
- IndexedDB実装は `namespace` をDB名、`_root` をテーブル名プレフィクス/ネームスペースとして扱う

---

## API設計（詳細）

### 1) TypeScript 型変更（インターフェース抜粋）

```ts
// 変更前（抜粋）
export interface StorageBackendConstructor {
  new(_root?: string): StorageBackend
  canUse(): boolean
  availableRoots(): string[] | Promise<string[]>
}

// 変更後（抜粋）
export interface StorageBackendConstructor {
  // namespace は必須（アプリ固有ID）、_root は従来のルート名（任意）
  new(namespace: string, _root?: string): StorageBackend
  canUse(): boolean
  // namespace 配下のルート（_root 候補）を返す
  availableRoots(namespace: string): string[] | Promise<string[]>
}
```

- `namespace` は文字列で必須とする方針。
  - 理由：ユーザアプリが必ずアプリ固有IDを渡す設計にすると、混在の防止が確実になるため。
  - 将来的に後方互換性のためのラッパーを設ける場合は別途検討する（実装段階で検討）。

### 2) StorageBackend のパス正規化
- すべての内部パスは `join(namespace, _root || DEFAULT_ROOT, ...)` で構築する。
- `_root` が未指定の場合は従来の既定値（例: `default`）にフォールバックする実装が必要。
- `safeJoin(base, target)` 的なユーティリティは"namespace を含んだ base" を受け取り、パストラバーサル検出を行うこと。

例:
- index ファイル: `{namespace}/{_root}/.git/index.json`
- workspace blob: `{namespace}/{_root}/workspace/src/app.ts`

---

## 実装方針（各ストレージ別）

### A. OPFS / ローカルFS 実装
- フォルダ構成をそのまま `{namespace}/{_root}/...` にする。
- 既存実装で `root` を受け取ってフォルダを決めている箇所は、`namespace` を先頭に付与してからディレクトリ作成/参照を行う。
- 具体的対応点:
  - コンストラクタ受け取り引数の順序を `namespace, _root` に変更
  - `init()` で `namespace` フォルダの存在チェック・作成を行う
  - `listFiles`, `readBlob`, `writeBlob`, `deleteBlob` の内部で `namespace` を先頭にしたパスに変換
- セキュリティ: `safeJoin` を利用して `..` による脱出を阻止

### B. IndexedDB 実装
- 設計案:
  - `namespace` -> IndexedDB の DB 名
  - `_root` -> object store（テーブル）名のプレフィクスあるいは store 名そのもの
- 挙動:
  - `availableRoots(namespace)` は、指定した DB（namespace）を開いて、ルートを識別するためのメタ情報（例: `roots` ストアや `__meta__`）を読み取り、ルート一覧を返す。
  - もし `namespace` に該当する DB が存在しない場合は空配列を返す。
- マイグレーション: 既存の DB レイアウトを使っているケース向けに、移行ツールまたは読み取り時の互換ロジックを検討する（別途）。

### C. その他（外部ストレージアダプタ）
- すべての実装で `StorageBackendConstructor.new(namespace, _root?)` に合わせて変更。
- `listFilesRaw` を持つ実装は `uri` 生成時に `namespace` を反映させる（例: `opfs://{namespace}/{_root}/...` や `idb://{namespace}/{store}/{key}`）。

---

## パス正規化と安全性

- すべてのユーザ入力経由のパスは `path.normalize`（あるいは同等ロジック）で正規化し、ルート（`namespace` を含む base path）から外れる場合はエラーとする。
- `safeJoin(base, target)` を共通ユーティリティとして配置し、各実装で利用する。
- IndexedDB 実装では、キー名／store名に `namespace` をプリフィックスするか、DB 名に `namespace` を付けることで物理分離を確実にする。

---

## テスト影響（修正箇所と追加ケース）

### 影響を受けるテスト群
- `test/unit/**` 内で `new SomeStorage(root)` を直接呼んでいるテスト
  - 例: `opfsStorage` や `indexedDatabaseStorage` を生成しているテスト
- `availableRoots()` を呼んでいるテスト
- パスに依存するユニットテスト（index.json のパス検証、listFiles の挙動確認 等）

### 必要な修正
- テストでのコンストラクタ呼び出しを `new(namespace, root)` に変更
- `availableRoots()` の呼び出しを `availableRoots(namespace)` に変更
- path 期待値を `{namespace}/{_root}/...` に合わせて修正

### 追加テストケース（推奨）
- 同一 `_root` で異なる `namespace` を指定した場合、互いに干渉しないこと
- `availableRoots(namespace)` が namespace ごとのルート一覧のみ返すこと
- `safeJoin` が `..` 導入による脱出を防ぐこと
- OPFS: 実際に `{namespace}` フォルダが作成されること（モック/実環境両方で）
- IndexedDB: `namespace` をDB名として object store が分離されていること

---

## マイグレーションと後方互換性

- 本変更は破壊的変更として扱う。フォールバック処理や互換レイヤーは一切実装しない。
- `namespace` は必須とし、従来の `new(root)` の呼び出しをサポートしない。
- 移行ツールや自動マイグレーションは提供しない。既存データの移行が必要な場合は利用者側で手動で行うか、個別対応とする。
- 実装・テスト・ドキュメントは "フォールバックなし、破壊的変更" の前提で行うこと。

---

## 実装時のチェックリスト

- [ ] `StorageBackendConstructor` の型定義を更新
- [ ] 全ストレージ実装（OPFS, IndexedDB, ローカルFSなど）のコンストラクタを更新
- [ ] `availableRoots(namespace)` の実装を各バックエンドで追加/更新
- [ ] すべてのパス操作を `namespace` を含むように正規化（共通ユーティリティ化）
- [ ] ユニットテストを修正し、新しいケースを追加
- [ ] ドキュメント（README, spec）を更新
- [ ] マイグレーションポリシーを記述（破壊的変更としてリリース）

---

## 実装上の注意点 / アンチパターン

- namespace を無視してルートだけでファイルアクセスを行うことは避ける（混在の原因になる）。
- `namespace` をファイル名に埋め込むような安易な設計（例: `filename = namespace + '_' + name`）は避け、物理的に分離する方が安全。
- IndexedDB で store 名を過剰に増やすと DB 設計が煩雑になるため、`__meta__` 管理やルート管理用の store を整備すること。

---

## 参考例

### パス例（OPFS/FS）
- index.json: `myapp-123/projectA/.git/index.json` (namespace=`myapp-123`, _root=`projectA`)
- workspace blob: `myapp-123/projectA/workspace/src/index.ts`

### IndexedDB 例
- DB 名: `myapp-123` (namespace)
- object store: `projectA_blobs`（`_root` をプレフィクス）
- index.json は `__meta__` store の `projectA:index` key に保存

---

## 次のステップ（実装に進む前）
1. 本設計のレビューと合意（設計上の疑問点を解消）
2. 互換性ポリシー（破壊的変更であるか否か）の決定
3. 実装チケットの作成と担当割り当て

---

作成者: GitHub Copilot（ドラフト）
作成日: 2026-02-09
