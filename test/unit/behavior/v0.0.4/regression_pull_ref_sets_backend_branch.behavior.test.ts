import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('regression: pull({ref}) should set backend branch scope', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    resetMockOPFS()
  })

  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
    try { resetMockOPFS() } catch (_) {}
  })

  it('pull({ref: "test"}) updates OpfsStorage branch scope and listFilesRaw shows .git/test/*', async () => {
    // Prepare mock responses for GitLab branch resolve and tree
    const branchSha = '3b2c317c562951aa5ecc375a3f5ddd0aaa21b971'
    configureFetchMock([
      // resolveRef -> GET /repository/branches/test
      {
        match: /\/repository\/branches\/test/, response: { status: 200, body: JSON.stringify({ name: 'test', commit: { id: branchSha } }) }
      },
      // fetchSnapshot -> GET /repository/tree?recursive=true&ref=<sha>
      {
        match: /\/repository\/tree\?recursive=true&ref=/,
        response: {
          status: 200,
          body: JSON.stringify([
            { id: '9af29826d6e11847f0cff8a17b7403cfb9f5596c', name: 'README.md', type: 'blob', path: 'README.md', mode: '100644' },
            { id: '6a7c0ceba11f5a9ce14b5650f1727a8789aa0986', name: 't1.txt', type: 'blob', path: 't1.txt', mode: '100644' }
          ])
        }
      }
    ])

    // Create backend and vfs
    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    // Persist adapter meta so getAdapterInstance will create GitLabAdapter
    await vfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', token: 'dummy-token', branch: 'main' } })

    // Perform pull by ref 'test'
    const res = await vfs.pull({ ref: 'test' })
    expect(res).toBeDefined()

    // listFilesRaw should show files under .git/test/*
    const files = await backend.listFilesRaw()
    const paths = files.map((f: any) => f.path)

    expect(paths).toContain('GitLab_test01/.git/test/info/README.md')
    expect(paths).toContain('GitLab_test01/.git/test/info/t1.txt')
  })
})
