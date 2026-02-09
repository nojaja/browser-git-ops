/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitLabAdapter from '../../../../../src/git/gitlabAdapter'
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

beforeEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

afterEach(() => {
  try { clearFetchMock() } catch (_) {}
  jest.resetAllMocks()
})

describe('GitLabAdapter final-retry response handling', () => {
  it('returns final retryable response (status 500) and causes invalid JSON error', async () => {
    const adapter = new GitLabAdapter({ projectId: '1', token: 't', host: 'http://example.com' })
    ;(adapter as any).maxRetries = 2
    ;(adapter as any).baseBackoff = 5

    // Simulate two retryable 500 responses followed by a final 200 with invalid JSON
    const make = (status: number, body: string, hdrs?: Record<string,string>) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status >= 200 && status < 300 ? 'OK' : 'ERR',
      headers: { get: (k: string) => (hdrs || {})[k.toLowerCase()] },
      text: async () => body,
      json: async () => JSON.parse(body),
      clone() { return this }
    })

    const fm = jest.fn()
    fm.mockResolvedValueOnce(make(500, 'err1'))
    fm.mockResolvedValueOnce(make(500, 'err2'))
    fm.mockResolvedValueOnce(make(200, 'not-json'))
    ;(global as any).fetch = fm

    await expect(
      adapter.createCommitWithActions('main', 'msg', [{ type: 'create', path: 'a', content: 'x' }])
    ).rejects.toThrow(/GitLab commit invalid JSON response/)
  }, 20000)
})
