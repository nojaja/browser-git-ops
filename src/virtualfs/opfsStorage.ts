import { IndexFile } from './types'
import { StorageBackend, StorageBackendConstructor } from './storageBackend'

const ERR_OPFS_DIR_API = 'OPFS directory API not available'
const VAR_WORKSPACE = 'workspace'
const VAR_BASE = '.git-base'
const VAR_CONFLICT = '.git-conflict'

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

  /** 利用可能なサブディレクトリ名の候補を返す
   * @returns {string[]} available root directories
   */
  static availableRoots(): string[] {
    return ['apigit_storage']
  }

  /**
   * Returns the known segment variants in search order.
   * @returns {string[]} segment directory names
   */
  private getVariants(): string[] {
    return [VAR_WORKSPACE, VAR_BASE, VAR_CONFLICT]
  }

  private rootDir = 'apigit_storage'

  /** コンストラクタ（OPFS は初期化不要）。`root` は OPFS ルート直下に作成するサブディレクトリ名です。 */
  constructor(root?: string) {
    if (root) this.rootDir = root
  }

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
      // If root exposes directory API, read from scoped subdir; otherwise operate on root directly
      const hasDirApi = typeof (root as any).getDirectoryHandle === 'function' || typeof (root as any).getDirectory === 'function'
      if (hasDirApi) {
        try {
          const scoped = await this.traverseDir(root, this.rootDir.split('/').filter(Boolean))
          const fh = await scoped.getFileHandle('index')
          const file = await fh.getFile()
          const txt = await file.text()
          return txt ? (JSON.parse(txt) as IndexFile) : null
        } catch (_) {
          return null
        }
      }
      // fallback: root supports getFileHandle directly
      try {
        const fh = await (root as any).getFileHandle('index')
        const file = await fh.getFile()
        const txt = await file.text()
        return txt ? (JSON.parse(txt) as IndexFile) : null
      } catch (_) {
        return null
      }
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
    const hasDirApi = typeof (root as any).getDirectoryHandle === 'function' || typeof (root as any).getDirectory === 'function'
    if (hasDirApi) {
      const parts = this.rootDir.split('/').filter(Boolean)
      const parent = await this.ensureDir(root, parts)
      const fh = await parent.getFileHandle('index', { create: true })
      const writable = await fh.createWritable()
      await writable.write(JSON.stringify(index))
      await writable.close()
      return
    }
    // fallback: root supports getFileHandle directly
    const fh = await (root as any).getFileHandle('index', { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify(index))
    await writable.close()
  }

  /**
   * blob を書き込む
   * @returns {Promise<void>} 書込完了時に解決
   */
  async writeBlob(filepath: string, content: string, segment?: any): Promise<void> {
    const seg = segment || VAR_WORKSPACE
    const root = await this.getOpfsRoot()
    if (!root) throw new Error('OPFS not available')
    const prefix = seg === VAR_WORKSPACE ? VAR_WORKSPACE : seg === 'base' ? VAR_BASE : VAR_CONFLICT
    await this._writeToPrefix(root, prefix, filepath, content)
  }

  /**
   * Write content to a file under given prefix, creating directories as needed.
   */
  private async _writeToPrefix(root: any, prefix: string, filepath: string, content: string): Promise<void> {
    const fullPath = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
    const parts = fullPath.split('/').filter(Boolean)
    const dirParts = parts.slice(0, parts.length - 1)
    const parent = await this.ensureDir(root, dirParts)
    const fh = await parent.getFileHandle(parts[parts.length - 1], { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }

  /**
   * Read text from a file handle returning null on failure.
   * @param fh File handle
   * @returns {Promise<string|null>} file text or null
   */
  private async _readFileFromHandle(fh: any): Promise<string | null> {
    try {
      const file = await fh.getFile()
      const txt = await file.text()
      return txt ?? null
    } catch (_) {
      return null
    }
  }

  /**
   * blob を読み出す
   * @returns {Promise<string|null>} ファイル内容、存在しなければ null
   */
  async readBlob(filepath: string, segment?: any): Promise<string | null> {
    const root = await this.getOpfsRoot()
    if (!root) return null
    return await this._readBlobFromRoot(root, segment, filepath)
  }

  /**
   * Read blob from a resolved root. Extracted to reduce cognitive complexity of public entry.
   * @returns {Promise<string|null>}
   */
  private async _readBlobFromRoot(root: any, segment: any | undefined, filepath: string): Promise<string | null> {
    if (segment) return await this._readFromSegment(root, segment, filepath)
    return await this._readFromVariants(root, filepath)
  }

  /**
   * Read from a specific segment prefix.
    * @returns {Promise<string|null>} file text or null
    */
  private async _readFromSegment(root: any, segment: any, filepath: string): Promise<string | null> {
    const prefix = segment === VAR_WORKSPACE ? VAR_WORKSPACE : segment === 'base' ? VAR_BASE : VAR_CONFLICT
    try {
      return await this.readFromPrefix(root, prefix, filepath)
    } catch (_) {
      return null
    }
  }

  /**
   * Read by trying each variant in order and returning first match.
    * @returns {Promise<string|null>} file text or null
    */
  private async _readFromVariants(root: any, filepath: string): Promise<string | null> {
    for (const v of this.getVariants()) {
      try {
        const txt = await this.readFromPrefix(root, v, filepath)
        if (txt !== null) return txt
      } catch (_) {
        // try next
      }
    }
    return null
  }

  /**
   * blob を削除する
   * @returns {Promise<void>} 削除完了時に解決
   */
  async deleteBlob(filepath: string, segment?: any): Promise<void> {
    try {
      const root = await this.getOpfsRoot()
      if (!root) return

      if (segment === VAR_WORKSPACE) { await this.removeAtPrefix(root, VAR_WORKSPACE, filepath); return }
      if (segment === 'base') { await this.removeAtPrefix(root, VAR_BASE, filepath); return }
      if (segment === 'conflict') { await this.removeAtPrefix(root, VAR_CONFLICT, filepath); return }

      for (const v of this.getVariants()) await this.removeAtPrefix(root, v, filepath)
    } catch (_) {
      void 0
    }
  }

  /**
   * Read a file at a given prefix (does not create directories)
   * @returns {Promise<string|null>} file text or null
   */
  // NOTE: kept a single guarded `readFromPrefix` implementation below.

  /**
    * Remove a file at a given prefix (does not create directories)
    * @param root root directory handle
    * @param prefix prefix dir
    * @param filepath path relative to prefix
    * @returns {Promise<void>} resolves when removal attempted (errors are ignored)
    */
  private async removeAtPrefix(root: any, prefix: string, filepath: string): Promise<void> {
    try {
      const full = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
      const parts = full.split('/').filter(Boolean)
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
      // ignore per-variant errors
    }
  }

  /**
   * Read a file under a prefix without throwing. Returns null when not found.
   * @param root root directory handle
   * @param prefix prefix dir
   * @param filepath path relative to prefix
    * @returns {Promise<string|null>} file contents or null when not found
    */
  private async readFromPrefix(root: any, prefix: string, filepath: string): Promise<string | null> {
    // reuse existing traversal logic but guard errors
    try {
      const fullPath = this.rootDir ? `${this.rootDir}/${prefix}/${filepath}` : `${prefix}/${filepath}`
      const parts = fullPath.split('/').filter(Boolean)
      const dir = await this.traverseDir(root, parts.slice(0, parts.length - 1))
      const fh = await dir.getFileHandle(parts[parts.length - 1])
      return await this._readFileFromHandle(fh)
    } catch (_) {
      return null
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
