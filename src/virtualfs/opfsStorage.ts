import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor } from './storageBackend'

const ERR_OPFS_DIR_API = 'OPFS directory API not available'

/** OPFS (origin private file system) を利用する永続化実装 */
export const OpfsStorage: StorageBackendConstructor = class OpfsStorage implements StorageBackend {
  /**
   * 同期的に OPFS 利用可否を判定します（レガシーヒントも含む）。
   * @returns {boolean} 利用可能なら true
   */
  static canUse(): boolean {
    let ok = false
    try {
      const nav = (globalThis as any).navigator
      // If navigator.storage.persist exists, treat as OPFS-capable hint (legacy detection)
      if (nav && nav.storage && typeof nav.storage.persist === 'function') ok = true
      if (nav && nav.storage && typeof nav.storage.getDirectory === 'function') ok = true
    } catch (_) {
      void 0
    }
    if (!ok && (globalThis as any).originPrivateFileSystem && typeof (globalThis as any).originPrivateFileSystem.getDirectory === 'function') ok = true
    return ok
  }

  /** コンストラクタ（OPFS は初期化不要） */
  constructor() {}

  /**
   * 初期化（OPFS はランタイム判定のみ）
   * @returns {Promise<void>} 初期化完了時に解決
   */
  async init(): Promise<void> {
    void 0
  }

  // legacy canUseOpfs removed; use static canUse() instead

  /**
   * OPFS のルートディレクトリハンドルを取得します。失敗時は null を返す。
   * @returns {Promise<any|null>} ルートハンドルまたは null
   */
  private async getOpfsRoot(): Promise<any | null> {
    const nav = (globalThis as any).navigator
    if (nav && nav.storage && typeof nav.storage.getDirectory === 'function') {
      try {
        return await nav.storage.getDirectory()
      } catch (_) {
        // fallthrough to originPrivateFileSystem
      }
    }
    try {
      if ((globalThis as any).originPrivateFileSystem && typeof (globalThis as any).originPrivateFileSystem.getDirectory === 'function') {
        return await (globalThis as any).originPrivateFileSystem.getDirectory()
      }
    } catch (_) {
      return null
    }
    return null
  }

  /**
   * 指定パスのディレクトリを再帰的に作成して返す
   * @returns {Promise<any>} 生成されたディレクトリハンドル
   */
  private async ensureDir(root: any, parts: string[]): Promise<any> {
    let dir = root
    for (const p of parts) {
      if (dir && typeof dir.getDirectoryHandle === 'function') {
        dir = await dir.getDirectoryHandle(p, { create: true })
      } else if (dir && typeof dir.getDirectory === 'function') {
        dir = await dir.getDirectory(p, { create: true })
      } else {
        throw new Error(ERR_OPFS_DIR_API)
      }
    }
    return dir
  }

  /**
   * index を読み出す
   * @returns {Promise<IndexFile|null>} 読み出した IndexFile、存在しなければ null
   */
  async readIndex(): Promise<IndexFile | null> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return null
      const fh = await root.getFileHandle('index')
      const file = await fh.getFile()
      const txt = await file.text()
      return txt ? (JSON.parse(txt) as IndexFile) : null
    } catch (_) {
      return null
    }
  }

  /**
   * index を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeIndex(index: IndexFile): Promise<void> {
    const root = await this.getOpfsRoot()
    if (!root) throw new Error('OPFS not available')
    const fh = await root.getFileHandle('index', { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify(index))
    await writable.close()
  }

  /**
   * blob を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeBlob(filepath: string, content: string): Promise<void> {
    const root = await this.getOpfsRoot()
    if (!root) throw new Error('OPFS not available')
    const parts = filepath.split('/')
    if (parts.length > 1) {
      const dirParts = parts.slice(0, parts.length - 1)
      const parent = await this.ensureDir(root, dirParts)
      const fh = await parent.getFileHandle(parts[parts.length - 1], { create: true })
      const writable = await fh.createWritable()
      await writable.write(content)
      await writable.close()
      return
    }
    const fh = await root.getFileHandle(filepath, { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }

  /**
   * blob を読み出す
   * @returns {Promise<string|null>} ファイル内容、存在しなければ null
   */
  async readBlob(filepath: string): Promise<string | null> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return null
      const parts = filepath.split('/')
      const dir = await this.traverseDir(root, parts.slice(0, parts.length - 1))
      const fh = await dir.getFileHandle(parts[parts.length - 1])
      const file = await fh.getFile()
      const txt = await file.text()
      return txt ?? null
    } catch (_) {
      return null
    }
  }

  /**
   * blob を削除する
   * @returns {Promise<void>} 削除完了時に解決
   */
  async deleteBlob(filepath: string): Promise<void> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return
      const parts = filepath.split('/')
      const dir = await this.traverseDir(root, parts.slice(0, parts.length - 1))
      const name = parts[parts.length - 1]
      if (typeof dir.removeEntry === 'function') {
        await dir.removeEntry(name)
        return
      }
      if (typeof dir.getFileHandle === 'function') {
        await this.tryRemoveFileHandle(dir, name)
        return
      }
    } catch (_) {
      void 0
    }
  }

  /**
   * Traverse into nested directories without creating them.
   * @param root The starting directory handle
   * @param parts Path parts to traverse
   * @returns The final directory handle
   */
  private async traverseDir(root: any, parts: string[]): Promise<any> {
    let dir = root
    for (const p of parts) {
      if (dir && typeof dir.getDirectoryHandle === 'function') {
        dir = await dir.getDirectoryHandle(p)
      } else if (dir && typeof dir.getDirectory === 'function') {
        dir = await dir.getDirectory(p)
      } else {
        throw new Error(ERR_OPFS_DIR_API)
      }
    }
    return dir
  }

  /**
   * Try to remove a file via its file handle.
   * @returns {Promise<boolean>} true when removed, false otherwise
   */
  private async tryRemoveFileHandle(dir: any, name: string): Promise<boolean> {
    try {
      const fh = await dir.getFileHandle(name)
      if (fh && typeof (fh as any).remove === 'function') {
        await (fh as any).remove()
        return true
      }
    } catch (_) {
      // ignore
    }
    return false
  }
}

export default OpfsStorage
