import type { StorageBackend } from './storageBackend'

/**
 * ローカルファイル操作のラッパー
 */
export class LocalFileManager {
  private backend: StorageBackend

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
  async deleteFile(filepath: string): Promise<void> {
    // Ensure we create a workspace-info tombstone when the file exists in git-base.
    // Do NOT modify git-scoped info; always write tombstones into workspace-info.
    // Read bases first
    const gitBase = await this.backend.readBlob(filepath, 'base')
    const wsBase = await this.backend.readBlob(filepath, 'workspace')

    // remove workspace cache first to avoid accidental deletion of newly written workspace-info
    await this.backend.deleteBlob(`${filepath}`, 'workspace')

    try {
      if (gitBase !== null) {
        // File exists in git base: derive tombstone from git-scoped info (if any)
        const gitInfoTxt = await this.backend.readBlob(filepath, 'info-git')
        let gitInfo: any = {}
        if (gitInfoTxt) {
          try { gitInfo = JSON.parse(gitInfoTxt) } catch (_) { gitInfo = {} }
        }
        gitInfo.state = 'remove'
        gitInfo.updatedAt = Date.now()
        await this.backend.writeBlob(filepath, JSON.stringify(gitInfo), 'info-workspace')
      } else {
        // No git base: if workspace-base existed, update/create workspace-info as tombstone
        if (wsBase !== null) {
          const existingWorkspaceInfoTxt = await this.backend.readBlob(filepath, 'info')
          let existingWorkspaceInfo: any = {}
          if (existingWorkspaceInfoTxt) {
            try { existingWorkspaceInfo = JSON.parse(existingWorkspaceInfoTxt) } catch (_) { existingWorkspaceInfo = {} }
          }
          existingWorkspaceInfo.state = 'remove'
          existingWorkspaceInfo.updatedAt = Date.now()
          await this.backend.writeBlob(filepath, JSON.stringify(existingWorkspaceInfo), 'info-workspace')
        } else {
          // no base anywhere: remove any info entries (best-effort)
          await this.backend.deleteBlob(filepath, 'info-workspace')
          await this.backend.deleteBlob(filepath, 'info')
        }
      }
    } catch (_error) {
      // best-effort: ignore and finish
    }
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
