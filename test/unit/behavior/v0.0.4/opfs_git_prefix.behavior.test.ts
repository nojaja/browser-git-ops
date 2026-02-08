import '../../../setupOpfs.js'
import { resetMockOPFS } from 'opfs-mock'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'

// テスト対象: OpfsStorage を使い、ブランチ作成・切替時に .git/{branch}/ プレフィックスでファイルが配置されることを検証

describe('OpfsStorage .git branch prefix behavior', () => {
  beforeEach(() => {
    resetMockOPFS()
    configureFetchMock()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    try { await (lib as any).OpfsStorage.delete('TestRepo') } catch (e) { /* ignore */ }
    try { clearFetchMock() } catch (_) {}
  })

  it('creates branch and switches branch placing files under .git/{branch}/ segments', async () => {
    // OpfsStorage を作成し、backend として使用
    const backend = new lib.OpfsStorage('TestRepo')
    await backend.init()

    // 初期ブランチ 'main' にファイルを書き込む（workspaceではなくbaseとして）
    await backend.setBranch('main')
    await backend.writeBlob('README.md', 'main-readme', 'base')
    await backend.writeBlob('dir/a.txt', 'main-a', 'base')

    // ブランチ 'feature' を作成して切り替え
    await backend.setBranch('feature')
    await backend.writeBlob('README.md', 'feature-readme', 'base')
    await backend.writeBlob('dir/b.txt', 'feature-b', 'base')

    // listFilesRaw を使って全ファイル列挙
    const all = await backend.listFilesRaw()
    const paths = all.map((e: any) => e.path)

    // main ブランチのファイルは .git/main/base/ に存在
    expect(paths).toContain('TestRepo/.git/main/base/README.md')
    expect(paths).toContain('TestRepo/.git/main/base/dir/a.txt')

    // feature ブランチのファイルは .git/feature/base/ に存在
    expect(paths).toContain('TestRepo/.git/feature/base/README.md')
    expect(paths).toContain('TestRepo/.git/feature/base/dir/b.txt')

    // workspace 領域は workspace/base プレフィックスに格納されないこと（このテストでは未使用なので存在しない）
    expect(paths.some((p: string) => p.startsWith('TestRepo/workspace/'))).toBe(false)
  })
})
