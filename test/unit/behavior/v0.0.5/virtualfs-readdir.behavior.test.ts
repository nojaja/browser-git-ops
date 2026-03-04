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
    await vfs.setAdapter({ type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

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
    await vfs.setAdapter({ type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    // No workspace files -> readdir should return empty array
    const dirents = await (vfs as any).readdir('work/dir', { withFileTypes: true })

    expect(Array.isArray(dirents)).toBe(true)
    expect(dirents.length).toBe(0)
  })

  it('readdir should list entries from workspace/base via backend fallback when index is empty', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()

    // Write directly to workspace/base (without creating info/index entries)
    await (backend as any).writeBlob('work/dir/direct.txt', 'direct-content', 'workspace')

    const names = await (vfs as any).readdir('work/dir')

    expect(Array.isArray(names)).toBe(true)
    expect(names).toContain('direct.txt')
  })

  it('readdir should list second-level directory entries after pull', async () => {
    jest.spyOn((lib as any).OpfsStorage, 'availableRoots').mockResolvedValue(['GitLab_test01'])

    const backend = new (lib as any).OpfsStorage('GitLab_test01')
    const vfs = new (lib as any).VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter({ type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    const treeJson = [
      { id: 'a1', name: 'README.md', type: 'blob', path: 'README.md' },
      { id: 'a2', name: 'guide.md', type: 'blob', path: 'docs/guide.md' },
      { id: 'a3', name: 'intro.md', type: 'blob', path: 'docs/sub/intro.md' },
    ]
    const fileContents: Record<string, string> = {
      'README.md': '# root',
      'docs/guide.md': 'guide',
      'docs/sub/intro.md': 'intro',
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: 'sha-main' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const pullRes = await (vfs as any).pull()
    expect(pullRes).toBeDefined()

    const docsNames = await (vfs as any).readdir('docs')

    expect(Array.isArray(docsNames)).toBe(true)
    expect(docsNames).toContain('guide.md')
    expect(docsNames).toContain('sub')
  })
})
