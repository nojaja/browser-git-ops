/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitHubAdapter, { NonRetryableError } from '../../../../../src/git/githubAdapter'
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

beforeEach(() => {
  jest.clearAllMocks()
  try { clearFetchMock() } catch (_) {}
})

afterEach(() => { try { clearFetchMock() } catch (_) {} })

describe('GitHubAdapter missing-sha branches', () => {
  it('createCommit throws NonRetryableError when response missing sha', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm = configureFetchMock([{ response: { status: 200, body: JSON.stringify({}) } }])
    ;(fm as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    await expect(adapter.createCommit('m', 'p', 't')).rejects.toThrow(NonRetryableError)
  })

  it('createTree throws NonRetryableError when response missing sha', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm2 = configureFetchMock([{ response: { status: 200, body: JSON.stringify({}) } }])
    ;(fm2 as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    await expect(adapter.createTree([{ type: 'create', path: 'x', blobSha: 'b' }])).rejects.toThrow(NonRetryableError)
  })
})
