/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { GitHubAdapter } from '../../../../src/git/githubAdapter'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'

describe('GitHubAdapter cache simple test', () => {
  it('fetchSnapshot reuses blob content for duplicate SHAs', async () => {
    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })
    const fm = configureFetchMock([
      { match: /\/git\/refs\/heads\//, response: { status: 200, body: JSON.stringify({ object: { sha: 'commit-sha' } }) } },
      { match: /\/git\/commits\//, response: { status: 200, body: JSON.stringify({ tree: { sha: 'tree-sha' } }) } },
      { match: /\/git\/trees\//, response: { status: 200, body: JSON.stringify({ tree: [
        { path: 'a.txt', type: 'blob', sha: 'sha-1' },
        { path: 'b.txt', type: 'blob', sha: 'sha-2' },
        { path: 'c.txt', type: 'blob', sha: 'sha-1' }
      ] }) } },
      { match: /\/git\/blobs\/sha-1/, response: { status: 200, body: JSON.stringify({ content: Buffer.from('one').toString('base64'), encoding: 'base64' }) } },
      { match: /\/git\/blobs\/sha-2/, response: { status: 200, body: JSON.stringify({ content: Buffer.from('two').toString('base64'), encoding: 'base64' }) } },
    ])

    const res = await adapter.fetchSnapshot('main')

    // first fetch: populate cache for all files
    const first = await res.fetchContent(['a.txt', 'b.txt', 'c.txt'])
    expect(first['a.txt']).toBe('one')
    expect(first['b.txt']).toBe('two')
    expect(first['c.txt']).toBe('one')

    // record blob calls and call again to exercise cache-hit early return
    const callsAfterFirst = (fm as jest.Mock).mock.calls.filter((c: any) => String(c[0]).includes('/git/blobs/')).length
    const second = await res.fetchContent(['a.txt', 'b.txt'])
    expect(second['a.txt']).toBe('one')
    expect(second['b.txt']).toBe('two')
    // blobCalls should not increase on cached hits
    const callsAfterSecond = (fm as jest.Mock).mock.calls.filter((c: any) => String(c[0]).includes('/git/blobs/')).length
    expect(callsAfterSecond).toBe(callsAfterFirst)
    try { clearFetchMock() } catch (_) {}
  })
})
