/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/git/githubAdapter.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import GitHubAdapter from '../../../src/git/githubAdapter.ts'

describe('githubAdapter - coverage focused tests', () => {
  it('resolveRef returns input when given full 40-char sha', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    const sha = '0123456789abcdef0123456789abcdef01234567'
    expect(await a.resolveRef(sha)).toBe(sha)
  })

  it('resolveRef resolves branch via refs heads endpoint', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/git/refs/heads/feature')) {
        return { json: async () => ({ object: { sha: 'BR-SHA' } }) }
      }
      return { ok: false }
    })
    expect(await a.resolveRef('feature')).toBe('BR-SHA')
  })

  it('resolveRef falls back to tag when branch not found', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/git/refs/heads/doesnotexist')) {
        // simulate not found
        throw new Error('not found')
      }
      if (url.includes('/git/refs/tags/v1.0.0')) {
        return { json: async () => ({ object: { sha: 'TAG-SHA' } }) }
      }
      return { ok: false }
    })
    expect(await a.resolveRef('v1.0.0')).toBe('TAG-SHA')
  })

  it('resolveRef falls back to commits endpoint when refs/tags fail', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async (url: string) => {
      if (url.includes('/commits/other-ref')) {
        return { ok: true, json: async () => ({ sha: 'COMMIT-SHA' }) }
      }
      // otherwise simulate failure
      return { ok: false, json: async () => null }
    })
    expect(await a.resolveRef('other-ref')).toBe('COMMIT-SHA')
  })

  it('resolveRef throws when unable to resolve', async () => {
    const a: any = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' } as any)
    a._fetchWithRetry = jest.fn(async () => ({ ok: false }))
    await expect(a.resolveRef('nonexistent')).rejects.toThrow(/not found/)
  })
})
