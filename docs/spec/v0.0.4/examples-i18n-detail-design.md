# examples 多言語対応 詳細設計（i18n）

## 1. 目的
`examples` は本ライブラリのデモ兼導入サンプルであるため、UI表示文言とログ文言を **日本語/英語** で切替できるようにする。実装の理解性と動作理解性を高めるため、コメントも英語併記へ更新する。

## 2. 前提・制約
- 既存の **動作・構成は変更しない**（機能の追加/削除は禁止）。
- 表示文言は i18n 対応（日本語・英語）。
- **言語切替は URL クエリで設定**する。
- ログ文言（`appendOutput`/`appendTrace`/`console`）は **全件翻訳**する。
- 依存パッケージは追加しない（既存の examples 構成を維持）。

## 3. 対象範囲
- [examples/src/app.ts](examples/src/app.ts): UI描画、ログ/エラー文言、`prompt`/`confirm` 文字列、コメントの英語併記。
- [examples/src/index.html](examples/src/index.html): `<html lang>` と `<title>` を i18n 反映。
- [examples/README.md](examples/README.md): i18n の利用方法と URL クエリ指定方法の追記（英語併記）。

## 4. 言語切替仕様
### 4.1 言語判定の優先順位
1. URL クエリ: `?lang=ja` / `?lang=en`
2. 未指定時の既定値: `ja`

> 既定値は **日本語** とし、URL クエリがない場合の挙動は現状の日本語表示と整合する。

### 4.2 URL クエリ仕様
- パラメータ名: `lang`
- 許可値: `ja`, `en`（大小区別なし）
- 不正値の場合: 既定値 `ja` にフォールバック

## 5. i18n 実装方式（設計）
### 5.1 辞書構造
- `const I18N = { ja: {...}, en: {...} }` の **静的辞書**を `app.ts` に定義。
- 文字列は **キーで参照**する。
- キーは `section.action.label` 形式で命名し、用途を明確化。

例（構造イメージ）:
- `ui.title`
- `ui.description`
- `ui.storage.opfs.add`
- `log.connect.start`
- `prompt.branch.switch`

### 5.2 翻訳取得関数
- `t(key: string, params?: Record<string, string | number>)` を用意。
- 未定義キーは **キー文字列自体を返す**（デバッグ容易性）。
- 簡易パラメータ埋め込み: `t('log.x', { value })` → `${value}` に置換。

### 5.3 UI更新
- `renderUI()` で **全ての表示文言を `t()` 経由**に置換。
- プレースホルダー、ボタン、見出し、空表示 `(なし)` なども対象。

### 5.4 ログ/メッセージ更新
- `appendOutput` / `appendTrace` / `console` で出力される文言を `t()` に置換。
- `prompt` / `confirm` 文言も `t()` に置換。
- 文字列内の変数部分は `t()` の `params` で埋め込む。

### 5.5 コメント英語併記
- 既存コメントを削除せず、**英語コメントを追加**する。
- 形式例:
  ```ts
  // 既存の日本語コメント
  // English: explanation in English
  ```

## 6. 文字列一覧（キー設計）
> 実装時は実際の全出力文言を洗い出し、このキーにマッピングする。

### 6.1 UIラベル系
- `ui.title`
- `ui.description`
- `ui.storage.title`
- `ui.storage.opfs`
- `ui.storage.indexeddb`
- `ui.storage.inmemory`
- `ui.storage.opfs.add`
- `ui.storage.opfs.refresh`
- `ui.storage.opfs.delete`
- `ui.storage.opfs.close`
- `ui.storage.indexeddb.add`
- `ui.storage.indexeddb.refresh`
- `ui.storage.indexeddb.delete`
- `ui.storage.indexeddb.close`
- `ui.storage.inmemory.add`
- `ui.storage.inmemory.refresh`
- `ui.storage.inmemory.delete`
- `ui.storage.inmemory.close`
- `ui.form.repo`
- `ui.form.token`
- `ui.form.platform`
- `ui.form.branch`
- `ui.form.connect`
- `ui.actions.title`
- `ui.actions.showSnapshot`
- `ui.actions.revertChange`
- `ui.actions.fetchRemote`
- `ui.actions.resolveConflict`
- `ui.actions.remoteChanges`
- `ui.actions.addLocalFile`
- `ui.actions.localChanges`
- `ui.actions.pushLocal`
- `ui.actions.editAndPush`
- `ui.actions.deleteAndPush`
- `ui.actions.rename`
- `ui.actions.listFilesRaw`
- `ui.actions.listCommits`
- `ui.actions.nextCommitsPage`
- `ui.actions.listBranches`
- `ui.actions.createBranch`
- `ui.actions.switchBranch`
- `ui.results.title`
- `ui.results.clear`
- `ui.results.clearTrace`
- `ui.empty`

### 6.2 ログ/トレース/ダイアログ系
- `log.connect.start`
- `log.connect.input`
- `log.connect.invalidUrl`
- `log.connect.unsupportedRepo`
- `log.vfs.notConnected`
- `log.vfs.close.start`
- `log.vfs.close.done`
- `log.vfs.close.error`
- `log.pull.start`
- `log.pull.done`
- `log.pull.error`
- `log.conflict.details`
- `prompt.branch.switch`
- `prompt.opfs.root`
- `prompt.indexeddb.db`
- `prompt.inmemory.root`
- `prompt.file.create.path`
- `prompt.file.create.content`
- `prompt.file.edit.path`
- `prompt.file.edit.content`
- `prompt.file.delete.path`
- `confirm.file.delete`
- `prompt.file.rename.from`
- `prompt.file.rename.to`
- `prompt.branch.create.name`
- `prompt.branch.create.from`

> 上記は設計上のキー例であり、実装時に **全件** を網羅する。

## 7. HTML 反映方針
- `<html lang>` を `lang` クエリに合わせて更新する。
- `<title>` も `t('ui.title')` に合わせる。
- 既存構成（IIFE + `main.ts` 起動）は維持。

## 8. README 追記方針
- `examples` の起動方法はそのまま。
- **言語切替方法**（`?lang=ja` / `?lang=en`）を追記し、英語併記する。

## 9. 非機能要件
- パフォーマンス影響は最小（静的辞書 + 単純置換）。
- 既存 UI レイアウト・ボタン配置は変更しない。

## 10. 受け入れ基準
1. `?lang=ja` で全 UI 文言が日本語になる。
2. `?lang=en` で全 UI 文言が英語になる。
3. `appendOutput` / `appendTrace` / `prompt` / `confirm` の **全件** が i18n 文字列を使用。
4. URL クエリ未指定時は日本語が表示される。
5. コメントに英語併記が追加されている。
6. 既存機能（接続/操作/ログ/ストレージ切替等）は挙動が変わらない。

## 11. 実装メモ（非実装）
- 実装は **この設計書の承認後** に着手する。
- 追加ファイルは不要（`app.ts` に辞書と `t()` を内包）。
