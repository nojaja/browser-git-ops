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
  // ensure deterministic timing in tests
  jest.restoreAllMocks()
})

afterEach(() => {
  try { clearFetchMock() } catch (_) {}
  jest.resetAllMocks()
})

describe('GitLabAdapter fetch error handling', () => {
  it('retries when fetch throws then succeeds', async () => {
    const adapter = new GitLabAdapter({ projectId: '1', token: 't', host: 'http://example.com' })
    ;(adapter as any).maxRetries = 3
    ;(adapter as any).baseBackoff = 10

    configureFetchMock([])
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => { throw new Error('network') })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200, ok: true, text: async () => JSON.stringify({ id: 'ok-123' }) })

    const res = await adapter.createCommitWithActions('main', 'msg', [{ type: 'create', path: 'a', content: 'x' }])
    expect(res).toBe('ok-123')
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('throws when fetch always fails', async () => {
    const adapter = new GitLabAdapter({ projectId: '1', token: 't', host: 'http://example.com' })
    ;(adapter as any).maxRetries = 2
    ;(adapter as any).baseBackoff = 5
    const fm2 = configureFetchMock([])
    ;(fm2 as jest.Mock).mockImplementation(() => { throw new Error('network') })

    await expect(
      adapter.createCommitWithActions('main', 'msg', [{ type: 'create', path: 'a', content: 'x' }])
    ).rejects.toThrow()
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})
