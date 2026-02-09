# VirtualFS - fs 互換 API 詳細設計 (v0.0.5)

作成日: 2026-02-09

本設計書は、既存の `virtualfs` に下記の fs 互換メソッドを追加するための詳細設計を記述する。

- `stat(filePath)`
- `unlink(filePath)`  // 既存の `deleteFile` に代わる名称（フォールバック不要）
- `mkdir(filePath)`
- `rmdir(filePath[, options])`
- `readdir(filePath)`

本設計のゴール:
- Node.js の `fs` API と互換のある呼び出しインターフェースを提供する。
- 戻り値・エラー挙動は `fs` の慣習に合わせる。
- Git 管理下のファイルについては、**ワークスペース上に実ファイルが存在する場合はその情報を優先**し、ファイルが未取得（ワークスペース上に存在しない）場合は Git 側の情報（最終コミット時刻 / blob サイズ / 存在フラグ等）で `Stats` を上書きする。どちらの場合でも Git 固有の識別子（例: blob SHA / commit SHA / ref）を `Stats` に含める。
- 既存の内部 API（virtualfs の metadata / storage 層）を呼び出して実装する想定だが、ここでは設計のみを記述する。

---

**前提定義**

- パス記法はプロジェクト内で既存の virtualfs が受け付ける相対パス/絶対パス規則に従う。
- すべてのメソッドは Promise ベース（async）で実装される想定。
- エラーコードは Node.js の `errno`/`code`（例: `ENOENT`, `EEXIST`, `ENOTDIR`, `ENOTEMPTY`, `EPERM`）に従う。

---

## 1. 共通ルール

- パスの正規化は内部で行う（例: path.normalize 相当）。
- 存在確認やアクセス権限は、virtualfs の既存ストレージ/メタデータ層を参照する。
- 返却する `Stats` オブジェクトは Node.js の `fs.Stats` 互換 API を満たす（少なくとも `isFile()`, `isDirectory()`, `size`, `mtime`, `ctime`, `birthtime` を提供）。
- Git 管理対象ファイルの場合、可能な限り Git のメタ情報（最後のコミット日時、blob サイズ、mode）で `Stats` を上書きする。ただし OS 上の実ファイルが存在する場合は既存の物理情報と整合するようにする。
- シンボリックリンクの扱いは現状の virtualfs の仕様に合わせる（将来的に `lstat` を追加する余地を残す）。

---

## 2. API 仕様詳細

### 2.1 stat(filePath)

- 概要: 指定された `filePath` のメタ情報を返す。戻り値は `fs.Stats` 互換オブジェクト。
- シグネチャ: `async function stat(filePath: string): Promise<Stats>`
- 挙動:
  - 引数が未指定または空文字列 → `TypeError` を投げる。
  - 対象が存在しない場合 → `Error` を `code = 'ENOENT'` で reject。
  - 対象がファイルまたはディレクトリであるかを判定し、`isFile()` / `isDirectory()` を正しく返す。
  - Git 管理対象であれば、以下の優先ルールで `Stats` を構成する:
    1. ワークスペース上に該当ファイルが存在する場合は、ワークスペース側のファイル情報（ファイルシステムの `mtime`/`size` 等）を優先して使用する。
    2. ワークスペースにファイルが存在しない（未取得）の場合は、Git 側のメタ情報（blob サイズ、最新コミット日時など）を用いて `Stats` を作成する。
    3. いずれの場合でも、可能な限り以下の Git 固有情報を `Stats` に含める（オプションフィールド）: `gitBlobSha`, `gitCommitSha`, `gitRef`。
    - `size` : ワークスペース情報または Git blob のサイズ
    - `mtime`/`ctime` : ワークスペースのタイムスタンプまたは最終コミット日時（author/committer時刻のうち妥当なもの）
    - 権限/モード情報は可能な範囲で反映する（不足時はデフォルト値を設定）
  - Git 情報が得られない場合や管理対象外の場合は、内部ストレージのメタデータまたは仮想ファイルシステムのタイムスタンプを使用する。
- 返却オブジェクト（TypeScript 型案）:
```ts
interface FsStatsLike {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  blksize?: number;
  blocks?: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink?(): boolean;
  // Git固有の識別子（存在する場合にのみ追加する）
  gitBlobSha?: string;
  gitCommitSha?: string;
  gitRef?: string;
}
```

### 2.2 unlink(filePath)

- 概要: 指定したファイルを削除する。既存の `deleteFile` と同等の機能を持ち、名前だけ `unlink` に変更する。`deleteFile` のフォールバックや互換保持は不要。
- シグネチャ: `async function unlink(filePath: string): Promise<void>`
- 挙動:
  - 指定がない/空 → `TypeError`。
  - 対象が存在しない → `Error` を `code = 'ENOENT'` で reject。
  - 対象がディレクトリの場合 → `Error` を `code = 'EISDIR'` で reject（`rmdir` を使うべきという挙動）。
  - Git 管理下であれば、削除操作は virtualfs の既存の削除ワークフロー（ローカル変更キュー、index 更新、commit/プッシュは別レイヤ）に従う。ここではファイルを仮想的に削除（local change を追加）する。
  - 成功時は Promise を resolve。

### 2.3 mkdir(filePath)

- 概要: 指定したパスにディレクトリを作成する（親ディレクトリが無い場合の挙動は `recursive` オプションをサポートしない限り `ENOENT` を返す）。
- シグネチャ: `async function mkdir(filePath: string, options?: { recursive?: boolean, mode?: number }): Promise<void>`
- 挙動:
  - 既に同名のディレクトリが存在する場合 → `EEXIST` または Node の `fs` と同様に `recursive` が true の場合は no-op とする設計を選択できる（推奨: `recursive: false` で `EEXIST` を返す、`recursive: true` で存在していれば成功）。
  - 親ディレクトリが無い状態で `recursive` が false → `ENOENT`。
  - 成功時は Promise を resolve。

### 2.4 rmdir(filePath[, options])

- 概要: 指定ディレクトリを削除する。オプションで `recursive` をサポートする（空ディレクトリ以外を削除する場合）。
- シグネチャ: `async function rmdir(filePath: string, options?: { recursive?: boolean }): Promise<void>`
- 挙動:
  - 対象が存在しない → `ENOENT`。
  - 対象がファイルの場合 → `ENOTDIR`。
  - 対象ディレクトリが空でない場合:
    - `recursive: true` → ディレクトリ以下を再帰的に削除（virtualfs の削除ワークフローを用いる）
    - `recursive: false` or undefined → `ENOTEMPTY` を返す
  - 成功時は Promise resolve。

### 2.5 readdir(filePath)

- 概要: 指定ディレクトリのエントリ一覧（ファイル名配列）を返す。オプションで `withFileTypes` をサポート可能だが、まずは名前一覧を返す実装。
- シグネチャ: `async function readdir(filePath: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>`
- 挙動:
  - 存在しないパス → `ENOENT`。
  - 対象がファイル → `ENOTDIR`。
  - 成功時: ディレクトリ直下のファイル名（string[]）を返す。
  - 可能であれば `withFileTypes: true` の場合に `Dirent` 互換オブジェクト（`isFile()`, `isDirectory()` を持つ）を返す。

---

## 3. エラー設計 & 例外メッセージ

- すべての拒否は `Error` を reject し、`code` プロパティに Node.js 標準のエラーコード（`ENOENT`, `EEXIST`, `ENOTDIR`, `EISDIR`, `ENOTEMPTY`, `EPERM` 等）をセットする。
- メッセージは日本語で要点を簡潔に含める（内部ログは詳細、ユーザー向けは簡潔）。例: `Error('ファイルが見つかりません'); err.code = 'ENOENT'`。

---

## 4. 同期・競合・トランザクション考慮

- virtualfs はローカル変更をキュー化して管理している場合があるため、削除や mkdir/rmdir のような書き込み操作は必ず内部の変更キュー経由で行う。
- 複数操作が競合した場合の整合性は内部の conflictManager や changeTracker に委譲する。設計では外側にトランザクション API は公開しないが、内部は idempotent かつ再試行可能にする。

---

## 5. 互換性と移行

- 下位互換は切り捨てる。`deleteFile` はリポジトリに残さず削除する方針とする。既存の呼び出し箇所は `unlink` への移行が必要であり、移行手順と影響範囲の一覧を別途ドキュメント化すること。
- 新 API `unlink` は Promise ベースで統一し、呼び出し側は `await vfs.unlink(path)` を利用する。
- テスト要件として、移行後に旧 API が存在しないことを確認する自動テストを追加する（詳細は下記のテストケース参照）。

---

## 6. テストケース（ユニット）

- `stat`
  - 存在するファイル（Git 管理下）の `size`, `mtime` が Git 情報で反映されること。
  - 存在しないパス → `ENOENT`。

- `unlink`
  - 存在するファイルが削除されること（その後 `stat` が `ENOENT` を返す）
  - ディレクトリを `unlink` すると `EISDIR` を返す

- `mkdir`
  - 新規ディレクトリ作成が成功すること
  - 既存ディレクトリで `recursive:false` の場合 `EEXIST` を返す

- `rmdir`
  - 空ディレクトリ削除で成功
  - 非空で `recursive:false` の場合 `ENOTEMPTY`
  - `recursive:true` で再帰削除が成功

- `readdir`
  - 正常なディレクトリでエントリ一覧が返る
  - ファイルを渡すと `ENOTDIR`

- 旧API削除確認
  - `deleteFile` がライブラリからエクスポートされていないことを検証するテスト（`typeof vfs.deleteFile === 'undefined'` 等）
  - もし `deleteFile` が存在した場合は明示的にエラー/非推奨扱いとするテストを追加すること

---

## 7. セキュリティ/バリデーション

- パスの正規化を必須とし、パストラバーサル（`..` 等）やベースディレクトリ外参照を防止する。必要なら safeJoin 相当のヘルパを使用する。
- 操作権限に関しては、virtualfs の既存のアクセス制御方式に従う。

---

## 8. 実装メモ（後続の実装フェーズ用）

- `stat` は内部でメタデータレイヤ（metadataManager）への問い合わせ + Git 情報取得を組み合わせる。
- 書き込み系 (`unlink`, `mkdir`, `rmdir`) は changeTracker/localChangeApplier を経由して仮想的な変更を登録する。
- `readdir` は indexManager または storageBackend の一覧取得 API を用いる。
- すべてのメソッドは `async` で実装し、Jest のユニットテストを `test/unit/` に追加する。

---

## 9. 開発時チェックリスト

- [ ] 仕様に沿った TypeScript の型定義追加
- [ ] `stat` 用の `Stats` 互換クラス/ファクトリ実装
- [ ] 各 API のユニットテスト作成（正常系・異常系）
- [ ] 既存の internal API（changeTracker, metadataManager, indexManager）との統合テスト

---

## 10. 参考: 既存リポジトリとの関連

実装時には `src/virtualfs` 配下の既存モジュール（`changeTracker.ts`, `metadataManager.ts`, `indexManager.ts`, `localFileManager.ts` 等）を参照して実装を行うこと。

---

以上。次はこの設計に対するレビューを受けて、実装計画（タスク分解）に移行する。
