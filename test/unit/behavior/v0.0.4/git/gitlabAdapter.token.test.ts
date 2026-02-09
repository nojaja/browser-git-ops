import { GitLabAdapter } from '../../../../../src/git/gitlabAdapter'
import { jest } from '@jest/globals'

describe('GitLabAdapter: PRIVATE-TOKEN header behavior', () => {
  it('sets PRIVATE-TOKEN when token is provided', () => {
    const opts: any = { projectId: 'group/repo', token: 'glpat_VALID_TOKEN', host: 'https://gitlab.com' }
    const adapter: any = new (GitLabAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'PRIVATE-TOKEN')).toBeTruthy()
    expect(adapter.headers['PRIVATE-TOKEN']).toBe('glpat_VALID_TOKEN')
  })

  it('does not set PRIVATE-TOKEN when token is missing', () => {
    const opts: any = { projectId: 'group/repo' }
    const adapter: any = new (GitLabAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'PRIVATE-TOKEN')).toBeFalsy()
  })

  it('does not set PRIVATE-TOKEN when token is empty string', () => {
    const opts: any = { projectId: 'group/repo', token: '' }
    const adapter: any = new (GitLabAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'PRIVATE-TOKEN')).toBeFalsy()
  })

  it('does not set PRIVATE-TOKEN when token is whitespace only', () => {
    const opts: any = { projectId: 'group/repo', token: '   ' }
    const adapter: any = new (GitLabAdapter as any)(opts)
    expect(adapter.headers).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(adapter.headers, 'PRIVATE-TOKEN')).toBeFalsy()
  })
})
