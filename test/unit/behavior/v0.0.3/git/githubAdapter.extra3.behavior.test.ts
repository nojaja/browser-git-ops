/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as gh from '../../../../../src/git/githubAdapter'
const GitHubAdapter = (gh as any).default
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

beforeEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

afterEach(() => { try { clearFetchMock() } catch (_) {} })

describe('GitHubAdapter extra branches', () => {
  it('createTree includes base_tree when provided', async () => {
    let lastBody: any = null
    const fm = configureFetchMock([])
    ;(fm as jest.Mock).mockImplementation((input, init) => {
      lastBody = init && init.body
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ sha: 'tree-sha' }) })
    })

    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const sha = await adapter.createTree([{ type: 'create', path: 'a', blobSha: 'b' }], 'base123')
    expect(sha).toBe('tree-sha')
    expect(String(lastBody)).toContain('base_tree')
    expect(String(lastBody)).toContain('base123')
  })

  it('createCommit throws NonRetryableError when response text() rejects', async () => {
    // simulate a response where text() throws
    const fm2 = configureFetchMock([])
    ;(fm2 as jest.Mock).mockResolvedValue({ ok: false, status: 400, text: async () => { throw new Error('boom') } })

    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    await expect(adapter.createCommit('m', 'p', 't')).rejects.toThrow(/HTTP 400/)
  })

  it('createTree handles delete entries (sha null)', async () => {
    let lastBody: any = null
    const fm3 = configureFetchMock([])
    ;(fm3 as jest.Mock).mockImplementation((input, init) => {
      lastBody = init && init.body
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ sha: 'tree-sha' }) })
    })

    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const sha = await adapter.createTree([{ type: 'delete', path: 'deleted.txt' }])
    expect(sha).toBe('tree-sha')
    expect(String(lastBody)).toContain('"sha":null')
    expect(String(lastBody)).toContain('deleted.txt')
  })

  it('updateRef handles non-ok response with text() rejecting (via instance override)', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    // override the instance _fetchWithRetry to return a non-ok response
    ;(adapter as any)._fetchWithRetry = jest.fn().mockResolvedValue({ ok: false, status: 400, /**
     *
     */
    text: async () => { throw new Error('boom') } })
    await expect(adapter.updateRef('heads/main', 'deadbeef')).rejects.toThrow(/updateRef failed|HTTP 400/)
    expect((adapter as any)._fetchWithRetry).toHaveBeenCalled()
  })
})
