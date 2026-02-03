/**
 * @test-type behavior
 * @purpose Requirement guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitLabAdapter from '../../../../../src/git/gitlabAdapter'
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

describe('GitLabAdapter.listCommits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    try { clearFetchMock() } catch (_) {}
  })

  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
    jest.resetAllMocks()
  })

  it('maps commit list to CommitSummary and keeps order', async () => {
    const adapter = new GitLabAdapter({ projectId: 'root/test-repo', token: 't', host: 'http://localhost:8929' }) as any
    const apiResponse = [
      {
        id: 'REMOTE_HEAD_SHA_A',
        short_id: 'ea140932',
        title: 'Fix calculation',
        message: 'fix: correct calculation',
        author_name: 'Alice',
        created_at: '2026-02-01T16:52:56.000+00:00',
        parent_ids: ['REMOTE_HEAD_SHA_B']
      },
      {
        id: 'REMOTE_HEAD_SHA_B',
        short_id: '7ba8085b',
        title: 'Add API',
        message: 'feat: add new API',
        author_name: 'Bob',
        created_at: '2026-01-30T17:03:16.000+00:00',
        parent_ids: ['REMOTE_HEAD_SHA_C']
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
        date: '2026-02-01T16:52:56.000+00:00',
        parents: ['REMOTE_HEAD_SHA_B']
      },
      {
        sha: 'REMOTE_HEAD_SHA_B',
        message: 'feat: add new API',
        author: 'Bob',
        date: '2026-01-30T17:03:16.000+00:00',
        parents: ['REMOTE_HEAD_SHA_C']
      }
    ])
  })

  it('uses GitLab paging headers for next/last page', async () => {
    const adapter = new GitLabAdapter({ projectId: 'root/test-repo', token: 't', host: 'http://localhost:8929' }) as any
    configureFetchMock([
      {
        response: {
          status: 200,
          body: JSON.stringify([]),
          headers: {
            'link': '<http://localhost:8929/api/v4/projects/root%2Ftest-repo/repository/commits?id=root%2Ftest-repo&order=default&page=2&per_page=20&ref_name=main&trailers=false>; rel="next", <http://localhost:8929/api/v4/projects/root%2Ftest-repo/repository/commits?id=root%2Ftest-repo&order=default&page=1&per_page=20&ref_name=main&trailers=false>; rel="first"',
            'x-next-page': '2',
            'x-page': '1',
            'x-per-page': '20'
          }
        }
      }
    ])

    const res = await adapter.listCommits({ ref: 'main', perPage: 30, page: 1 })
    expect(res.nextPage).toBe(2)
    // real server log did not include a total-pages header, so lastPage may be undefined
    expect(res.lastPage).toBeUndefined()
  })

  it('requests correct query parameters for ref/perPage/page', async () => {
    const adapter = new GitLabAdapter({ projectId: 'root/test-repo', token: 't', host: 'http://localhost:8929' }) as any
    const fm = configureFetchMock([
      { response: { status: 200, body: JSON.stringify([]) } }
    ])

    await adapter.listCommits({ ref: 'develop', perPage: 50, page: 3 })
    const url = String((fm as jest.Mock).mock.calls[0][0])
    expect(url).toContain('/repository/commits')
    expect(url).toContain('ref_name=develop')
    expect(url).toContain('per_page=50')
    expect(url).toContain('page=3')
  })
})
