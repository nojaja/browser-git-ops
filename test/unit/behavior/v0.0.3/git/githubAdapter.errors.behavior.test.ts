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

describe('GitHubAdapter error branches', () => {
  it('createBlobs throws NonRetryableError when response missing sha', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm = configureFetchMock([{ response: { status: 200, body: JSON.stringify({}) } }])
    ;(fm as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    await expect(adapter.createBlobs([{ type: 'create', path: 'x', content: 'c' }])).rejects.toThrow(NonRetryableError)
  })

  it('createCommit throws RetryableError when network always fails', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm2 = configureFetchMock([])
    ;(fm2 as jest.Mock).mockRejectedValue(new Error('network'))

    await expect(adapter.createCommit('m', 'p', 't')).rejects.toThrow(RetryableError)
  })

  it('updateRef retries on 500 and eventually succeeds', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm3 = configureFetchMock([])
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: async () => 'err' })
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: async () => 'err' })
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

    await expect(adapter.updateRef('heads/main', 'sha')).resolves.toBeUndefined()
    expect((fm3 as jest.Mock).mock.calls.length).toBe(3)
  })
})
