/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/git/githubAdapter.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import GitHubAdapter from '../../../src/git/githubAdapter.ts'

describe('GitHubAdapter extra coverage', () => {
  it('getRef returns sha from plural response.sha', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async (url: string) => {
      return { json: async () => ({ sha: 'PLURAL-SHA' }) }
    })
    const res = await a.getRef('heads/feature')
    expect(res).toBe('PLURAL-SHA')
  })

  it('getRef falls back to singular when plural throws', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/git/refs/')) throw new Error('network')
      return { json: async () => ({ object: { sha: 'SINGULAR-SHA' } }) }
    })
    const res = await a.getRef('heads/x')
    expect(res).toBe('SINGULAR-SHA')
  })

  it('_determineHeadSha returns getRef when available', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a.getRef = jest.fn(async () => 'REF-SHA')
    const s = await a._determineHeadSha('main')
    expect(s).toBe('REF-SHA')
  })

  it('_determineHeadSha falls back to branches API when getRef fails', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a.getRef = jest.fn(async () => { throw new Error('nope') })
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/branches/')) return { ok: true, json: async () => ({ commit: { sha: 'BR-SHA' } }) }
      return { ok: false, json: async () => null }
    })
    const s = await a._determineHeadSha('main')
    expect(s).toBe('BR-SHA')
  })

  it('_determineHeadSha falls back to commits endpoint when branches API fails', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a.getRef = jest.fn(async () => { throw new Error('nope') })
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/branches/')) return { ok: false }
      if (url.includes('/commits/')) return { ok: true, json: async () => ({ sha: 'COM-SHA' }) }
      return { ok: false }
    })
    const s = await a._determineHeadSha('v1.2.3')
    expect(s).toBe('COM-SHA')
  })

  it('_determineHeadSha returns branch when all resolution fails', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a.getRef = jest.fn(async () => { throw new Error('nope') })
    a._fetchWithRetry = jest.fn(async () => { throw new Error('notfound') })
    const s = await a._determineHeadSha('feature-x')
    expect(s).toBe('feature-x')
  })
})
