import type { StorageBackend } from './storageBackend.ts'

/**
 *
 */
export class LocalChangeApplier {
  private backend: StorageBackend

  /**
   * LocalChangeApplier を初期化します
   * @param {StorageBackend} backend ストレージを辛子
   */
  constructor(backend: StorageBackend) {
    this.backend = backend
  }

  /**
   * 作成または更新を適用します
   * @param {any} ch 変更オブジェクト
   */
  async applyCreateOrUpdate(ch: any) {
    // Ensure workspace copy is removed first (delete may remove all segments),
    // then persist base blob so it remains.
    await this.backend.deleteBlob(ch.path, 'workspace')
    await this.backend.writeBlob(ch.path, ch.content, 'base')
  }

  /**
   * 削除を適用します
   * @param {any} ch 変更オブジェクト
   */
  async applyDelete(ch: any) {
    await this.backend.deleteBlob(ch.path, 'info')
    // Backend manages base segment; remove blobs from backend
    await this.backend.deleteBlob(ch.path)
    await this.backend.deleteBlob(ch.path, 'workspace')
  }
}

export default LocalChangeApplier
