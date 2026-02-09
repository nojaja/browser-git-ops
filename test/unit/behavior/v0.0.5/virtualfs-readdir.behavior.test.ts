import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('virtualfs readdir (v0.0.5)', () => {
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

  it('readdir should list workspace directory entries via backend.listFilesRaw', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // Create workspace files via public API so index is updated
    await (vfs as any).writeFile('work/dir/a.txt', 'a')
    await (vfs as any).writeFile('work/dir/b.txt', 'b')
    await (vfs as any).writeFile('work/dir/subdir/c.txt', 'c')

    const names = await (vfs as any).readdir('work/dir')

    expect(Array.isArray(names)).toBe(true)
    expect(names).toContain('a.txt')
    expect(names).toContain('b.txt')
    // subdir should be present as a directory entry
    expect(names).toContain('subdir')
  })

  it('readdir should fall back to Git tree when workspace empty and support withFileTypes', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // No workspace files -> readdir should return empty array
    const dirents = await (vfs as any).readdir('work/dir', { withFileTypes: true })

    expect(Array.isArray(dirents)).toBe(true)
    expect(dirents.length).toBe(0)
  })
})
