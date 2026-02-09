import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('VirtualFS.createBranch (integration behavior)', () => {
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

  it('creates branch from current HEAD when fromRef is not specified', async () => {
    configureFetchMock([
      {
        match: /\/repository\/branches\/main$/,
        response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: 'mainHeadSha' } }) }
      },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify([]) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify({}) } },
      { match: /\/repository\/branches$/, response: { status: 201, body: JSON.stringify({ name: 'feature/new-branch', commit: { id: 'mainHeadSha' } }) } }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'owner/repo', host: 'https://gitlab.com', token: '***', branch: 'main' } })
    await vfs.pull()

    const result = await vfs.createBranch({ name: 'feature/new-branch' } as any)
    expect(result).toBeDefined()
    expect(result.name).toBe('feature/new-branch')
    expect(result.sha).toBe('mainHeadSha')
  })

  it('creates branch from specific SHA', async () => {
    configureFetchMock([
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify([]) } },
      { match: /\/repository\/branches$/, response: { status: 201, body: JSON.stringify({ name: 'hotfix/from-sha', commit: { id: 'specificSha123' } }) } }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'owner/repo', host: 'https://gitlab.com', token: '***', branch: 'main' } })
    await vfs.pull()

    const result = await vfs.createBranch({ name: 'hotfix/from-sha', fromRef: 'specificSha123' } as any)
    expect(result).toBeDefined()
    expect(result.sha).toBe('specificSha123')
  })

  it('throws when adapter is not set', async () => {
    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await expect(vfs.createBranch({ name: 'feature/test' } as any)).rejects.toThrow(/No adapter configured|Adapter/)
  })

  it('throws when branch already exists', async () => {
    configureFetchMock([
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify([]) } },
      { match: /\/repository\/branches$/, response: { status: 400, body: JSON.stringify({ message: 'Branch already exists' }) } }
    ])

    const backend = new lib.OpfsStorage('test-repo')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'owner/repo', host: 'https://gitlab.com', token: '***', branch: 'main' } })
    await vfs.pull()

    await expect(vfs.createBranch({ name: 'existing-branch' } as any)).rejects.toThrow(/already exists/)
  })
})
