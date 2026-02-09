/**
 * @test-type behavior
 * @purpose FS 互換 API の振る舞い定義 (v0.0.5)
 * @policy TDD: tests describe expected behavior before implementation
 */

import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('virtualfs fs-compatible API (v0.0.5) - stat/unlink/migrations', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  it('stat should use Git info when workspace file is not present (backend.listFilesRaw returns empty)', async () => {
    // availableRoots を固定
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const treeJson = [
      { id: 'deadbeef00000000000000000000000000000001', name: 't1.txt', type: 'blob', path: 't1.txt' }
    ]

    // minimal fetch responses: branch & tree
    configureFetchMock([
      { match: /repository\/branches\/[\w-]+$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: 'commit-sha-1' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
    ])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // Simulate workspace absence
    const listSpy = jest.spyOn(backend, 'listFilesRaw').mockResolvedValue([])

    // Call stat - implementation should consult backend.listFilesRaw and fall back to Git
    const stats = await (vfs as any).stat('t1.txt')

    expect(listSpy).toHaveBeenCalled()
    expect(stats).toBeDefined()
    // design requires Git identifiers to be included even when using Git info
    expect(stats.gitBlobSha || stats.gitCommitSha).toBeDefined()
  })

  it('stat should consult backend.listFilesRaw and include git identifiers when workspace file exists', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const treeJson = [
      { id: 'cafebabe00000000000000000000000000000002', name: 't2.txt', type: 'blob', path: 't2.txt' }
    ]

    configureFetchMock([
      { match: /repository\/branches\/[\w-]+$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: 'commit-sha-2' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
    ])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // Simulate workspace presence by returning a listFilesRaw entry
    const listSpy = jest.spyOn(backend, 'listFilesRaw').mockResolvedValue([
      { path: 'GitLab_test01/.git/main/info/t2.txt', uri: 'opfs://GitLab_test01/.git/main/info/t2.txt' }
    ])

    const stats = await (vfs as any).stat('t2.txt')

    expect(listSpy).toHaveBeenCalled()
    expect(stats).toBeDefined()
    // design requires Git identifiers to be present even when workspace file exists
    expect(stats.gitBlobSha || stats.gitCommitSha).toBeDefined()
  })

  it('library should not export deleteFile (back-compat removed)', async () => {
    // ensure top-level export does not expose deleteFile
    expect((lib as any).deleteFile).toBeUndefined()

    // ensure VirtualFS prototype does not have deleteFile
    const VirtualFS = (lib as any).VirtualFS
    expect((VirtualFS as any).prototype.deleteFile).toBeUndefined()
  })
})
