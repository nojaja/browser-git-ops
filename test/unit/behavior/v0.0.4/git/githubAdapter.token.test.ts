import { GitHubAdapter } from '../../../../../src/git/githubAdapter'
import { jest } from '@jest/globals'

describe('GitHubAdapter: Authorization header behavior', () => {
  it('sets Authorization when token is provided', () => {
    const opts: any = { owner: 'owner', repo: 'repo', token: 'ghp_VALID_TOKEN' }
    const adapter: any = new (GitHubAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'Authorization')).toBeTruthy()
    expect(adapter.headers.Authorization).toBe(`token ${opts.token}`)
  })

  it('does not set Authorization when token is missing', () => {
    const opts: any = { owner: 'owner', repo: 'repo' }
    const adapter: any = new (GitHubAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'Authorization')).toBeFalsy()
  })

  it('does not set Authorization when token is empty string', () => {
    const opts: any = { owner: 'owner', repo: 'repo', token: '' }
    const adapter: any = new (GitHubAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'Authorization')).toBeFalsy()
  })

  it('does not set Authorization when token is whitespace only', () => {
    const opts: any = { owner: 'owner', repo: 'repo', token: '   ' }
    const adapter: any = new (GitHubAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'Authorization')).toBeFalsy()
  })
})
