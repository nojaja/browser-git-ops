import { IndexFile } from './types'

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
   * @param {IndexFile} index
   * @returns {Promise<void>}
   */
  writeIndex(_index: IndexFile): Promise<void>
  /**
   * ファイルコンテンツを保存
   * @param {string} filepath
   * @param {string} content
   * @returns {Promise<void>}
   */
  writeBlob(_filepath: string, _content: string): Promise<void>
  /**
   * ファイルコンテンツを読み出す
   * @param {string} filepath
   * @returns {Promise<string|null>}
   */
  readBlob(_filepath: string): Promise<string | null>
  /**
   * ファイルを削除する
   * @param {string} filepath
   * @returns {Promise<void>}
   */
  deleteBlob(_filepath: string): Promise<void>
}

/**
 * StorageBackend の "静的側"（コンストラクタ/クラス）を表現する型。
 * クラス実装はこの型を満たすことで `canUse()` の静的メソッドを持つことが保証されます。
 */
export interface StorageBackendConstructor {
  new (): StorageBackend
  canUse(): boolean
}

export default StorageBackend
