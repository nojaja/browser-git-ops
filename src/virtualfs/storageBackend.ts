import { IndexFile } from './types.ts'

/**
 * Storage セグメント
 */
export type Segment = 'workspace' | 'base' | 'conflict' | 'conflictBlob' | 'info' | 'info-workspace' | 'info-git'

/**
 * 永続化レイヤーの抽象インターフェース
 * Storage の具体実装はこの契約に従うこと
 */
export interface StorageBackend {
  /**
   * 初期化処理
   * @returns {Promise<void>}
   */
  init(): Promise<void>

  /**
   * index.json を読み込む
   * @returns {Promise<IndexFile|null>}
   */
  readIndex(): Promise<IndexFile | null>

  /**
  * index.json を書き込む
  * @param {IndexFile} _index
   * @returns {Promise<void>}
   */
  writeIndex(_index: IndexFile): Promise<void>

  /**
  * ファイルコンテンツを保存
  * @param {string} _filepath
  * @param {string} _content
  * @param {Segment} _segment 保存先セグメント
   * @returns {Promise<void>}
   */
  writeBlob(_filepath: string, _content: string, _segment?: Segment): Promise<void>

  /**
  * ファイルコンテンツを読み出す
  * @param {string} _filepath
  * @param {Segment} _segment 読み出すセグメント
   * @returns {Promise<string|null>}
   */
  readBlob(_filepath: string, _segment?: Segment): Promise<string | null>

  /**
  * ファイルを削除する
  * @param {string} _filepath
  * @param {Segment} [_segment] 削除するセグメント（省略時は全セグメント削除）
   * @returns {Promise<void>}
   */
  deleteBlob(_filepath: string, _segment?: Segment): Promise<void>

  /**
   * 指定プレフィックス配下のファイル一覧を取得します。
  * @param _prefix 取得対象のディレクトリプレフィックス（省略時はルート）
  * @param _segment 取得対象セグメント（省略時は 'workspace'）
  * @param _recursive サブディレクトリも含める場合は true（デフォルト true）
   * @returns Promise<Array<{path:string, info:string|null}>>
   */
  listFiles(_prefix?: string, _segment?: Segment, _recursive?: boolean): Promise<Array<{ path: string; info: string | null }>>

  /**
   * Raw listing that returns implementation-specific URIs and a normalized path.
   * @returns Promise<Array<{ uri: string; path: string; info?: string | null }>>
   */
  listFilesRaw?(_prefix?: string, _recursive?: boolean): Promise<Array<{ uri: string; path: string; info?: string | null }>>

  /**
   * Set the currently-active branch name for backends that scope data by branch.
   * Implementations may ignore this call if branch-scoped storage is unsupported.
  * @param _branch branch name or undefined to clear
   */
  setBranch?(_branch?: string | null): void
}

/**
 * StorageBackend の "静的側"（コンストラクタ/クラス）を表現する型。
 * クラス実装はこの型を満たすことで `canUse()` の静的メソッドを持つことが保証されます。
 */
export interface StorageBackendConstructor {
  /**
   * コンストラクタ。ルートパスやDB名などのオプション引数を受け取れるようにする。
   * 実装側はこの引数を利用して初期化を行うことができます。
   */
  new(_namespace: string, _root?: string): StorageBackend

  /**
   * このストレージ実装が利用可能かどうかを返す（例: 環境依存のチェック）。
   */
  canUse(): boolean
  
  /**
   * このストレージ実装で利用可能なルートパスあるいはDB名の一覧を返す。
   * 例えばローカルFS実装ならベースディレクトリ名、IndexedDB実装ならDB名候補を返す等。
   */
  availableRoots(_namespace: string): string[] | Promise<string[]>
}

export default StorageBackend
