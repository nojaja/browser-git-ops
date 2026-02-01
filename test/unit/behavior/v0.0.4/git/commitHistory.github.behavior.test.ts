/**
 * @test-type behavior
 * @purpose Requirement guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitHubAdapter from '../../../../../src/git/githubAdapter'
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

describe('GitHubAdapter.listCommits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    try { clearFetchMock() } catch (_) {}
  })

  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
    jest.resetAllMocks()
  })

  it('maps commit list to CommitSummary and keeps order', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' }) as any
    const apiResponse = [
      {
        sha: 'REMOTE_HEAD_SHA_A',
        commit: {
          message: 'fix: correct calculation',
          author: { name: 'Alice', email: 'alice@example.com', date: '2026-02-01T10:12:00Z' }
        },
        parents: [{ sha: 'REMOTE_HEAD_SHA_B' }]
      },
      {
        sha: 'REMOTE_HEAD_SHA_B',
        commit: {
          message: 'feat: add new API',
          author: { name: 'Bob', email: 'bob@example.com', date: '2026-01-30T08:00:00Z' }
        },
        parents: [{ sha: 'REMOTE_HEAD_SHA_C' }]
      }
    ]

    configureFetchMock([
      { response: { status: 200, body: JSON.stringify(apiResponse) } }
    ])

    const res = await adapter.listCommits({ ref: 'main', perPage: 30, page: 1 })
    expect(res.items).toEqual([
      {
        sha: 'REMOTE_HEAD_SHA_A',
        message: 'fix: correct calculation',
        author: 'Alice',
        date: '2026-02-01T10:12:00Z',
        parents: ['REMOTE_HEAD_SHA_B']
      },
      {
        sha: 'REMOTE_HEAD_SHA_B',
        message: 'feat: add new API',
        author: 'Bob',
        date: '2026-01-30T08:00:00Z',
        parents: ['REMOTE_HEAD_SHA_C']
      }
    ])
  })

  it('parses Link header and returns nextPage/lastPage', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' }) as any
    configureFetchMock([
      {
        response: {
          status: 200,
          body: JSON.stringify([]),
          headers: {
            link: '<https://api.github.com/repos/o/r/commits?page=2>; rel="next", <https://api.github.com/repos/o/r/commits?page=10>; rel="last"'
          }
        }
      }
    ])

    const res = await adapter.listCommits({ ref: 'main', perPage: 30, page: 1 })
    expect(res.nextPage).toBe(2)
    expect(res.lastPage).toBe(10)
  })

  it('requests correct query parameters for ref/perPage/page', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' }) as any
    const fm = configureFetchMock([
      { response: { status: 200, body: JSON.stringify([]) } }
    ])

    await adapter.listCommits({ ref: 'develop', perPage: 50, page: 3 })
    const url = String((fm as jest.Mock).mock.calls[0][0])
    expect(url).toContain('/commits')
    expect(url).toContain('sha=develop')
    expect(url).toContain('per_page=50')
    expect(url).toContain('page=3')
  })
})
