import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor } from './storageBackend'

/**
 * テストや軽量動作検証用のインメモリ実装。
 * `StorageBackend` を実装し、アプリケーション側で差し替えて利用できます。
 */
export const InMemoryStorage: StorageBackendConstructor = class InMemoryStorage implements StorageBackend {
  private rootKey: string

  // shared storage across instances keyed by root name
  private static stores: Map<string, {
    index: IndexFile,
    workspaceBlobs: Map<string,string>,
    baseBlobs: Map<string,string>,
    conflictBlobs: Map<string,string>
  }> = new Map()

  /**
   * 静的: この実装が利用可能かを同期判定します。
   * テスト/インメモリなので常に true を返します。
   * @returns {boolean} 利用可能なら true
   */
  static canUse(): boolean {
    return true
  }
  /**
   * 利用可能なルート名を返します。
   * @returns {string[]} ルート名の配列
   */
  static availableRoots(): string[] {
    const keys = Array.from(InMemoryStorage.stores.keys())
    return keys.length ? keys : ['apigit_storage']
  }
  // legacy canUseOpfs removed; use static canUse() instead
  /**
   * コンストラクタ。互換性のために `dir` 引数を受け取るが無視する。
   * @param _dir 任意のディレクトリ文字列（使用しない）
   */
  constructor(dir?: string) {
    // If caller provides a dir, share storage by that name. If omitted, create isolated store per instance.
    this.rootKey = dir ?? `__inmem_${Math.random().toString(36).slice(2)}`
    if (!InMemoryStorage.stores.has(this.rootKey)) {
      InMemoryStorage.stores.set(this.rootKey, {
        index: { head: '', entries: {} },
        workspaceBlobs: new Map(),
        baseBlobs: new Map(),
        conflictBlobs: new Map()
      })
    }
  }

  /**
   * 初期化処理（インメモリでは何もしない）
   * @returns {Promise<void>} 解決時に初期化完了
   */
  async init(): Promise<void> {
    return
  }

  /**
   * 現在の `IndexFile` を返します。
   * @returns {Promise<IndexFile|null>} IndexFile（常に非null）
   */
  async readIndex(): Promise<IndexFile | null> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    return store.index
  }

  /**
   * IndexFile を設定します。
   * @param idx 書き込む IndexFile
   */
  async writeIndex(idx: IndexFile): Promise<void> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    store.index = idx
  }

  /**
   * 指定パスに対して文字列コンテンツを保存します。
   * @param filepath ファイルパス
   * @param content ファイル内容
   */
  async writeBlob(filepath: string, content: string, segment?: any): Promise<void> {
    const seg = segment || 'workspace'
    const store = InMemoryStorage.stores.get(this.rootKey)!
    if (seg === 'workspace') store.workspaceBlobs.set(filepath, content)
    else if (seg === 'base') store.baseBlobs.set(filepath, content)
    else if (seg === 'conflict') store.conflictBlobs.set(filepath, content)
    else throw new Error('unknown segment')
  }

  /**
   * 指定パスの内容を取得します。
   * @param filepath ファイルパス
   * @returns {Promise<string|null>} 内容、存在しなければ null
   */
  async readBlob(filepath: string, segment?: any): Promise<string | null> {
    const store = InMemoryStorage.stores.get(this.rootKey)!
    const segmentToStore = {
      workspace: store.workspaceBlobs,
      base: store.baseBlobs,
      conflict: store.conflictBlobs,
    } as Record<string, Map<string, string>>

    if (segment) {
      const m = segmentToStore[String(segment)]
      return m ? (m.has(filepath) ? m.get(filepath)! : null) : null
    }

    // fallback order
    for (const key of ['workspace', 'base', 'conflict']) {
      const m = segmentToStore[key]
      if (m.has(filepath)) return m.get(filepath)!
    }

    return null
  }

  /**
   * 指定パスのエントリを削除します。
   * @param filepath ファイルパス
   */
  async deleteBlob(filepath: string, segment?: any): Promise<void> {
    // If segment specified, delete only that segment
    const store = InMemoryStorage.stores.get(this.rootKey)!
    if (segment === 'workspace') { store.workspaceBlobs.delete(filepath); return }
    if (segment === 'base') { store.baseBlobs.delete(filepath); return }
    if (segment === 'conflict') { store.conflictBlobs.delete(filepath); return }
    // otherwise delete from all segments
    store.workspaceBlobs.delete(filepath)
    store.baseBlobs.delete(filepath)
    store.conflictBlobs.delete(filepath)
  }

}

export default InMemoryStorage
