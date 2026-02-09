/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitHubAdapter, { RetryableError, NonRetryableError } from '../../../../../src/git/githubAdapter'
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

beforeEach(() => {
  jest.clearAllMocks()
  try { clearFetchMock() } catch (_) {}
})

afterEach(() => { try { clearFetchMock() } catch (_) {} })

describe('GitHubAdapter basic flows', () => {
  it('createBlobs returns map of path->sha', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const changes = [
      { type: 'create', path: 'a.txt', content: 'a' },
      { type: 'update', path: 'b.txt', content: 'b' },
    ]

    const fm = configureFetchMock([{ response: { status: 200, body: JSON.stringify({ sha: 'sha1' }) } }])
    ;(fm as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ sha: 'sha1' }) })

    const res = await adapter.createBlobs(changes, 2)
    expect(res['a.txt']).toBe('sha1')
    expect(res['b.txt']).toBe('sha1')
    expect((fm as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('createTree throws when blobSha missing', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    await expect(adapter.createTree([{ type: 'create', path: 'x' }])).rejects.toThrow(NonRetryableError)
  })

  it('createTree returns sha on success', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm2 = configureFetchMock([{ response: { status: 200, body: JSON.stringify({ sha: 'treesha' }) } }])
    ;(fm2 as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ sha: 'treesha' }) })

    const sha = await adapter.createTree([{ type: 'create', path: 'x', blobSha: 'b' }])
    expect(sha).toBe('treesha')
    expect((fm2 as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('createCommit retries on 500 and succeeds', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm3 = configureFetchMock([])
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: async () => 'err' })
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: async () => 'err' })
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'commitsha' }) })

    const sha = await adapter.createCommit('msg', 'parentsha', 'treesha')
    expect(sha).toBe('commitsha')
    expect((fm3 as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('updateRef throws NonRetryableError on bad request', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm4 = configureFetchMock([])
    ;(fm4 as jest.Mock).mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' })

    await expect(adapter.updateRef('heads/main', 'sha', false)).rejects.toThrow(NonRetryableError)
  })
})
