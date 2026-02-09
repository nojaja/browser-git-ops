import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('behavior/v0.0.4 - GitHub blob / readFile handling', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  it('GitHubAdapter.getBlob should return API content and encoding unchanged (base64)', async () => {
    const blobSha = 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0'
    const apiBody = JSON.stringify({ sha: blobSha, size: 5, content: 'aGVsbG8=\n', encoding: 'base64' })

    configureFetchMock([
      { match: /\/git\/blobs\//, response: { status: 200, body: apiBody } }
    ])

    const adapter = new lib.GitHubAdapter({ owner: 'nojaja', repo: 'testrep', token: '' })
    const res = await adapter.getBlob(blobSha)

    // Expect the adapter to return the raw API `content` and `encoding` (not decoded)
    expect(res).toBeDefined()
    expect(res.encoding).toBe('base64')
    expect(res.content).toBe('aGVsbG8=\n')
  })

  it('VirtualFS.readFile triggers on-demand fetch and writes decoded base content to backend', async () => {
    const path = 't1.txt'
    const blobSha = 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0'

    // Mock GitHub blob response (base64 encoded 'hello')
    const apiBody = JSON.stringify({ sha: blobSha, size: 5, content: 'aGVsbG8=\n', encoding: 'base64' })
    configureFetchMock([
      { match: /\/git\/blobs\//, response: { status: 200, body: apiBody } }
    ])

    // create backend and vfs
    const backend = new lib.OpfsStorage('GitHub_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    // create info entry that indicates a baseSha exists but base content not present
    const info = { path, state: 'base', baseSha: blobSha, updatedAt: Date.now() }
    await backend.writeBlob(path, JSON.stringify(info), 'info')

    // set adapter metadata so adapter instance will be created lazily
    await vfs.setAdapter(null, { type: 'github', opts: { owner: 'nojaja', repo: 'testrep', token: '', branch: 'main' } })

    // attempt to read file -> should trigger on-demand fetch and write to 'base'
    const content = await vfs.readFile(path)

    // read base from backend to verify it was written and decoded
    const base = await backend.readBlob(path, 'base')

    expect(content).toBe('hello')
    expect(base).toBe('hello')
  })
})
