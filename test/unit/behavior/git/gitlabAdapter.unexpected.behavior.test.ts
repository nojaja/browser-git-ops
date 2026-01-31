/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import GitLabAdapter from '../../../../src/git/gitlabAdapter'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'

beforeEach(() => {
  jest.clearAllMocks()
  try { clearFetchMock() } catch (_) {}
})

afterEach(() => {
  try { clearFetchMock() } catch (_) {}
  jest.resetAllMocks()
})

describe('GitLabAdapter unexpected commit responses', () => {
  it('createCommitWithActions throws when JSON lacks id/commit', async () => {
    const adapter = new GitLabAdapter({ projectId: '1', token: 't' })
    configureFetchMock([{ response: { status: 200, body: JSON.stringify({}) } }])

    await expect(adapter.createCommitWithActions('main', 'm', [{ type: 'create', path: 'a', content: 'c' }])).rejects.toThrow(/unexpected response/)
  })
})
