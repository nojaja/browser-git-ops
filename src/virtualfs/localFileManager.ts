import type { StorageBackend, Segment } from './storageBackend'

/**
 * ローカルファイル操作のラッパー
 */
export class LocalFileManager {
  private backend: StorageBackend
  private static SEG_INFO_WORKSPACE: Segment = 'info-workspace'
  private static SEG_INFO_GIT: Segment = 'info-git'
  private static SEG_INFO: Segment = 'info'

  /**
   * コンストラクタ
   * @param {StorageBackend} backend - ストレージバックエンド
   */
  constructor(backend: StorageBackend) {
    this.backend = backend
  }

  /**
   * ファイルを書き込む（workspace領域）
   * @param {string} filepath - ファイルパス
   * @param {string} content - 書き込む内容
   * @returns {Promise<void>}
   */
  async writeFile(filepath: string, content: string): Promise<void> {
    await this.backend.writeBlob(`${filepath}`, content, 'workspace')
  }

  /**
   * ファイルを削除する（workspace と info をクリア）
   * @param {string} filepath - ファイルパス
   * @returns {Promise<void>}
   */
  /**
   * Delete a file and ensure appropriate workspace-info tombstone behavior.
   * @returns {Promise<void>}
   */
  async deleteFile(filepath: string): Promise<void> {
    // Read relevant blobs to decide behavior
    const gitBase = await this.backend.readBlob(filepath, 'base')
    await this.backend.readBlob(filepath, 'workspace')
    const wsInfoTxt = await this.backend.readBlob(filepath, LocalFileManager.SEG_INFO_WORKSPACE)
    const gitInfoTxt = await this.backend.readBlob(filepath, LocalFileManager.SEG_INFO_GIT)

    // remove workspace cache first
    await this.backend.deleteBlob(`${filepath}`, 'workspace')

    try {
      const existingInfo = this._parseExistingInfo(wsInfoTxt, gitInfoTxt)
      const shouldWriteTombstone = Boolean((existingInfo && existingInfo.baseSha) || gitBase !== null)
      if (shouldWriteTombstone) {
        await this._writeTombstone(gitInfoTxt || wsInfoTxt || null, filepath)
      } else {
        await this._clearInfoEntries(filepath)
      }
    } catch (_error) {
      // best-effort: ignore and finish
    }
  }

  /**
   * Parse existing info preference: workspace-info first, then git-scoped info.
   * @returns {any} parsed info object or undefined
   */
  private _parseExistingInfo(wsInfoTxt: string | null, gitInfoTxt: string | null): any {
    if (wsInfoTxt) {
      try { return JSON.parse(wsInfoTxt) } catch (_) { return undefined }
    }
    if (gitInfoTxt) {
      try { return JSON.parse(gitInfoTxt) } catch (_) { return undefined }
    }
    return undefined
  }

  /**
   * Write a workspace-info tombstone derived from basis text.
   * @returns {Promise<void>}
   */
  private async _writeTombstone(basisTxt: string | null, filepath: string): Promise<void> {
    let basis: any = {}
    if (basisTxt) {
      try { basis = JSON.parse(basisTxt) } catch (_) { basis = {} }
    }
    basis.state = 'deleted'
    basis.updatedAt = Date.now()
    await this.backend.writeBlob(filepath, JSON.stringify(basis), LocalFileManager.SEG_INFO_WORKSPACE)
  }

  /**
   * Remove workspace-local info entries for the filepath.
   * @returns {Promise<void>}
   */
  private async _clearInfoEntries(filepath: string): Promise<void> {
    await this.backend.deleteBlob(filepath, LocalFileManager.SEG_INFO_WORKSPACE)
    await this.backend.deleteBlob(filepath, LocalFileManager.SEG_INFO)
  }

  /**
   * ワークスペースまたはベースからファイルを読み出す
   * @param {string} filepath - ファイルパス
   * @returns {Promise<string|null>} ファイル内容または null
   */
  async readFile(filepath: string): Promise<string | null> {
    const wsBlob = await this.backend.readBlob(filepath, 'workspace')
    if (wsBlob !== null) return wsBlob
    const baseBlob = await this.backend.readBlob(filepath, 'base')
    if (baseBlob !== null) return baseBlob
    return null
  }

  /**
   * ファイルをリネームする（内容をコピーして元を削除）
   * @param {string} from - 元パス
   * @param {string} to - 先パス
   * @returns {Promise<void>}
   */
  async renameFile(from: string, to: string): Promise<void> {
    const content = await this.readFile(from)
    if (content === null) throw new Error('Source file not found')
    await this.writeFile(to, content)
    await this.deleteFile(from)
  }
}

export default LocalFileManager
