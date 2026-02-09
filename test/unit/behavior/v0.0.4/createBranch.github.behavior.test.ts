import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('GitHubAdapter.createBranch (behavior)', () => {
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

  it('creates branch via POST /git/refs and returns normalized result', async () => {
    configureFetchMock([
      {
        match: /\/git\/refs$/,
        response: {
          status: 201,
          body: JSON.stringify({
            ref: 'refs/heads/feature/test',
            object: { sha: 'abc123', type: 'commit' }
          })
        }
      }
    ])

    const adapter = new lib.GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' } as any)
    const res = await adapter.createBranch('feature/test', 'abc123')

    expect(res).toBeDefined()
    expect(res.name).toBe('feature/test')
    expect(res.sha).toBe('abc123')
    expect(res.ref).toBe('refs/heads/feature/test')
  })

  it('throws when branch already exists (422)', async () => {
    configureFetchMock([
      {
        match: /\/git\/refs$/,
        response: { status: 422, body: JSON.stringify({ message: 'Reference already exists' }) }
      }
    ])

    const adapter = new lib.GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' } as any)

    await expect(adapter.createBranch('existing-branch', 'abc123'))
      .rejects.toThrow(/already exists/)
  })

  it('retries on 5xx and eventually succeeds', async () => {
    let calls = 0
    configureFetchMock([
      {
        match: /\/git\/refs$/,
        response: () => {
          calls++
          if (calls < 3) return { status: 503, body: 'Service Unavailable' }
          return {
            status: 201,
            body: JSON.stringify({ ref: 'refs/heads/retry-branch', object: { sha: 'abc123', type: 'commit' } })
          }
        }
      }
    ])

    const adapter = new lib.GitHubAdapter({ repo: 'owner/repo', token: '***', branch: 'main' } as any)
    const res = await adapter.createBranch('retry-branch', 'abc123')

    expect(calls).toBeGreaterThanOrEqual(3)
    expect(res.name).toBe('retry-branch')
    expect(res.sha).toBe('abc123')
  })
})
