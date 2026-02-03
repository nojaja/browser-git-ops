import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitHubAdapter from '../../src/git/githubAdapter'
import { configureFetchMock, clearFetchMock } from '../utils/fetchMock'

describe('GitHubAdapter edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    try { clearFetchMock() } catch (_) {}
  })
  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
    jest.resetAllMocks()
  })

  it('handles invalid JSON response for listCommits', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' }) as any
    configureFetchMock([{ response: { status: 200, body: 'not-json' } }])
    const res = await adapter.listCommits({ ref: 'main', perPage: 10, page: 1 })
    expect(Array.isArray(res.items)).toBe(true)
    expect(res.items.length).toBe(0)
  })

  it('createBlobs uses blob cache when available', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' }) as any
    // stub shaOf to return deterministic content hash
    adapter.shaOf = async (_: string) => 'content-hash-1'
    // seed blobCache with precomputed mapping
    adapter.blobCache.set('content-hash-1', 'BLOB_SHA_1')

    const changes = [{ type: 'create', path: 'a.txt', content: 'hello' }]
    const map = await adapter.createBlobs(changes, 2)
    expect(map['a.txt']).toBe('BLOB_SHA_1')
  })
})
