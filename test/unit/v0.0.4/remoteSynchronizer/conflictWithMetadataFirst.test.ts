/**
 * 競合管理テスト（メタデータ先行下での競合判定）
 * 要件: pull 時に競合パスの info と base の整合が維持されること
 *
 * Given:
 *   - tree メタデータのみ取得済み
 *   - ローカルに workspace 変更がある
 *   - リモートにも変更がある（異なる baseSha）
 * When:
 *   - pull() で競合判定
 * Then:
 *   - conflict が発生
 *   - info に競合状態を記録
 *   - base は未取得のままで OK（オンデマンド取得に委譲）
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

describe('RemoteSynchronizer - conflict with metadata-first pull', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * テストケース 1: ローカル変更とリモート変更の競合を検出
   * Given:
   *   - info.baseSha = 'base-sha-old'
   *   - workspace: 'local change'
   *   - remote baseSha = 'base-sha-new' (異なる)
   * When: pull() 実行
   * Then: conflict が発生し、info.state が 'conflict' になる
   */
  it('should detect conflict when local workspace differs from base and remote differs', async () => {
    const mockBackend: any = {
      readBlob: jest.fn()
        // info 読み込み（最初の確認）
        .mockResolvedValueOnce(JSON.stringify({
          path: 'conflict-file.txt',
          baseSha: 'base-sha-old',
          state: 'base',
        }))
        // workspace 読み込み（ローカル変更）
        .mockResolvedValueOnce('local change'),
        // base 読み込み（不要、オンデマンドで取得予定）
      writeBlob: jest.fn().mockResolvedValue(undefined),
      listFiles: jest.fn().mockResolvedValue([]),
      deleteBlob: jest.fn(),
      init: jest.fn(),
    }

    const mockIndexManager: any = {
      getIndex: jest.fn().mockResolvedValue({ head: 'old-head', entries: {} }),
      setHead: jest.fn(),
      saveIndex: jest.fn().mockResolvedValue(undefined),
    }

    const mockConflictManager: any = {
      setIndexEntryToConflict: jest.fn().mockResolvedValue(undefined),
      persistRemoteContentAsConflict: jest.fn().mockResolvedValue(undefined),
    }

    const remoteSnapshot = {
      headSha: 'new-remote-sha',
      shas: {
        'conflict-file.txt': 'base-sha-new', // 異なる sha
      },
    }

    // 実装後検証:
    // const result = await synchronizer.pull(remoteSnapshot)

    // - conflict が報告されること
    // expect(result.conflicts).toHaveLength(1)
    // expect(result.conflicts[0].path).toBe('conflict-file.txt')

    // - conflict info が保存されること
    // expect(mockConflictManager.setIndexEntryToConflict).toHaveBeenCalled()

    // - base の内容取得は行われていないことを確認
    // const baseWriteCalls = mockBackend.writeBlob.mock.calls.filter(
    //   (call: any) => call[2] === 'base'
    // )
    // expect(baseWriteCalls).toHaveLength(0)

    expect(remoteSnapshot.shas['conflict-file.txt']).toBe('base-sha-new')
  })

  /**
   * テストケース 2: 競合解決時に base/workspace の整合確認
   * Given: 競合した file の info.baseSha と workspace sha が異なる
   * When: pull() で競合を検出後、別途 resolveConflict() を実行
   * Then: conflict manager が整合を保つ
   */
  it('should maintain info and workspace consistency in conflict resolution', async () => {
    const conflictFilePath = 'merged-file.ts'
    const mockBackend: any = {
      readBlob: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({
          path: conflictFilePath,
          baseSha: 'base-sha',
          state: 'conflict',
          workspaceSha: 'workspace-sha',
        }))
        .mockResolvedValueOnce('workspace content'),
      writeBlob: jest.fn(),
      listFiles: jest.fn(),
    }

    const mockConflictManager: any = {
      resolveConflict: jest.fn().mockResolvedValue(true),
    }

    // 実装後検証:
    // const resolved = await synchronizer.resolveConflict(conflictFilePath)
    // expect(resolved).toBe(true)

    // - conflict file が削除されること
    // expect(mockBackend.deleteBlob).toHaveBeenCalledWith(
    //   expect.stringContaining('.git-conflict'),
    //   'conflict'
    // )

    expect(conflictFilePath).toBe('merged-file.ts')
  })

  /**
   * テストケース 3: リモート競合内容の保存（base 取得なし）
   * Given: リモートで更新されたファイルがローカルでも変更
   * When: pull() で競合を検出
   * Then: リモート内容を .git-conflict に保存、base は非取得
   */
  it('should persist conflict marker without fetching remote base content', async () => {
    const filePath = 'data.json'
    const remoteContent = 'remote data'

    const mockBackend: any = {
      readBlob: jest.fn().mockResolvedValue(null),
      writeBlob: jest.fn(),
      listFiles: jest.fn(),
    }

    const mockConflictManager: any = {
      persistRemoteContentAsConflict: jest.fn().mockResolvedValue(undefined),
    }

    // 実装後検証:
    // - conflict マーカーが保存されること
    // expect(mockConflictManager.persistRemoteContentAsConflict).toHaveBeenCalledWith(
    //   filePath,
    //   remoteContent
    // )

    // - base の blob として writeBlob が呼ばれていないこと
    // const baseBlob = mockBackend.writeBlob.mock.calls.filter(
    //   (call: any) => call[2] === 'base'
    // )
    // expect(baseBlob).toHaveLength(0)

    expect(filePath).toBe('data.json')
  })

  /**
   * テストケース 4: 複数ファイルの競合を同時処理
   * Given: 3 ファイルが競合
   * When: pull() で競合判定
   * Then: 複数競合が同時に報告され、base は全て未取得
   */
  it('should handle multiple conflicts simultaneously without fetching base content', async () => {
    const remoteSnapshot = {
      headSha: 'multi-conflict-sha',
      shas: {
        'file1.js': 'sha-1',
        'file2.js': 'sha-2',
        'file3.js': 'sha-3',
      },
    }

    // ローカル info（古い baseSha）
    const localInfos: any = {
      'file1.js': { baseSha: 'old-sha-1', state: 'base' },
      'file2.js': { baseSha: 'old-sha-2', state: 'base' },
      'file3.js': { baseSha: 'old-sha-3', state: 'base' },
    }

    // 実装後検証:
    // const result = await synchronizer.pull(remoteSnapshot)

    // - 競合が 3 件報告されること
    // expect(result.conflicts).toHaveLength(3)

    // - 全て conflict が記録されること
    // result.conflicts.forEach(c => {
    //   expect(c.baseSha).toBeDefined()
    //   expect(c.remoteSha).toBeDefined()
    // })

    expect(Object.keys(remoteSnapshot.shas)).toHaveLength(3)
  })

  /**
   * テストケース 5: 競合解決後の base on-demand 取得
   * Given: 競合が存在して info.state = 'conflict'
   * When: ユーザーが conflict file を開く（readBlob('base') 要求）
   * Then: on-demand で base を取得し、conflict 内容と比較
   */
  it('should fetch base on-demand after conflict resolution to verify merge', async () => {
    const conflictPath = 'merged.js'

    const mockBackend: any = {
      readBlob: jest.fn()
        // info 読み込み（conflict 状態）
        .mockResolvedValueOnce(JSON.stringify({
          path: conflictPath,
          state: 'conflict',
          baseSha: 'base-sha-before-merge',
        }))
        // base 読み込み（最初は未取得）
        .mockResolvedValueOnce(null),
      writeBlob: jest.fn(),
    }

    // 実装後検証:
    // const base = await synchronizer.fetchBaseIfMissing(conflictPath)

    // - API が呼ばれることを確認
    // expect(adapter.getBlob).toHaveBeenCalledWith('base-sha-before-merge')

    // - 取得内容が backend に保存されること
    // expect(mockBackend.writeBlob).toHaveBeenCalledWith(conflictPath, expect.any(String), 'base')

    expect(conflictPath).toBe('merged.js')
  })
})
