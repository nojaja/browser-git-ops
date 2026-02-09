import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { resetMockOPFS } from 'opfs-mock'
import { clearFetchMock } from '../../../utils/fetchMock'

describe('virtualfs mkdir/rmdir (v0.0.5)', () => {
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

  it('mkdir should create a directory info marker in backend', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    await (vfs as any).mkdir('work/newdir')

    // backend.writeBlob for mkdir writes to a segment named 'info-workspace'
    const infoTxt = await (backend as any).readBlob('work/newdir', 'info-workspace')
    expect(infoTxt).toBeDefined()
    const info = JSON.parse(infoTxt)
    expect(info.path).toBe('work/newdir')
    expect(info.state).toBe('dir')
  })

  it('rmdir should throw ENOTEMPTY when children exist (non-recursive) and remove children when recursive', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // create workspace files under work/dir
    await (vfs as any).writeFile('work/dir/a.txt', 'a')
    await (vfs as any).writeFile('work/dir/b.txt', 'b')

    // non-recursive rmdir should reject with ENOTEMPTY
    await expect((vfs as any).rmdir('work/dir')).rejects.toHaveProperty('code', 'ENOTEMPTY')

    // recursive rmdir should remove children
    await (vfs as any).rmdir('work/dir', { recursive: true })

    const files = await (backend as any).listFilesRaw()
    // ensure no remaining entries under work/dir
    expect(files.some((f: any) => f && f.path && f.path.startsWith('work/dir/'))).toBe(false)
  })
})
