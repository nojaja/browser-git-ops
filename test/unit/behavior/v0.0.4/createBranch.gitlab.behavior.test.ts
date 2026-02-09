import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('GitLabAdapter.createBranch (behavior)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(() => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  it('creates branch via POST /repository/branches and returns normalized result', async () => {
    configureFetchMock([
      {
        match: /\/repository\/branches$/,
        response: {
          status: 201,
          body: JSON.stringify({ name: 'feature/test', commit: { id: 'abc123' }, protected: false })
        }
      }
    ])

    const adapter = new lib.GitLabAdapter({ projectId: 'owner/repo', host: 'https://gitlab.com', token: '***', branch: 'main' } as any)
    const res = await adapter.createBranch('feature/test', 'abc123')

    expect(res).toBeDefined()
    expect(res.name).toBe('feature/test')
    expect(res.sha).toBe('abc123')
    expect(res.ref).toBe('refs/heads/feature/test')
  })

  it('throws when branch already exists (400)', async () => {
    configureFetchMock([
      {
        match: /\/repository\/branches$/,
        response: { status: 400, body: JSON.stringify({ message: 'Branch already exists' }) }
      }
    ])

    const adapter = new lib.GitLabAdapter({ projectId: 'owner/repo', host: 'https://gitlab.com', token: '***', branch: 'main' } as any)

    await expect(adapter.createBranch('existing-branch', 'abc123'))
      .rejects.toThrow(/already exists/)
  })
})
