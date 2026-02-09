/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/virtualfs/virtualfs.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import VirtualFS from '../../../src/virtualfs/virtualfs.ts'

describe('virtualfs - coverage focused tests', () => {
  it('pull({ref}) resolves ref, fetches snapshot and persists branch in adapter meta', async () => {
    const vfs: any = new VirtualFS()
    vfs.indexManager.getIndex = jest.fn(async () => ({ entries: {}, head: '' }))
    vfs.indexManager.saveIndex = jest.fn(async () => {})
    vfs.backend = { writeIndex: jest.fn(async () => {}), init: jest.fn(async () => {}) }

    const adapter = {
      resolveRef: jest.fn(async (r: string) => 'RESOLVED-SHA'),
      fetchSnapshot: jest.fn(async (sha: string) => ({ headSha: sha, shas: { 'a.txt': 's1' }, fetchContent: async () => ({}) }))
    }
    vfs.remoteSynchronizer = { pull: jest.fn(async () => ({ conflicts: [] })) }
    await vfs.setAdapter(adapter, { type: 'github', opts: {} })

    const res = await vfs.pull({ ref: 'feature' })

    expect(adapter.resolveRef).toHaveBeenCalledWith('feature')
    expect(vfs.getAdapterMeta().opts.branch).toBe('feature')
    expect(vfs.remoteSynchronizer.pull).toHaveBeenCalled()
    expect(res.remote.headSha).toBe('RESOLVED-SHA')
  })

  it('pull() without args uses persisted branch via getAdapterInstance', async () => {
    const vfs: any = new VirtualFS()
    vfs.indexManager.getIndex = jest.fn(async () => ({ entries: {}, head: '' }))
    vfs.backend = { writeIndex: jest.fn(async () => {}), init: jest.fn(async () => {}) }

    const adapter = {
      resolveRef: jest.fn(async (r: string) => 'BR-SHA'),
      fetchSnapshot: jest.fn(async (sha: string) => ({ headSha: sha, shas: {}, fetchContent: async () => ({}) }))
    }
    vfs.remoteSynchronizer = { pull: jest.fn(async () => ({ conflicts: [] })) }
    await vfs.setAdapter(adapter, { type: 'github', opts: { branch: 'feature' } })

    const res = await vfs.pull()

    expect(adapter.resolveRef).toHaveBeenCalledWith('feature')
    expect(vfs.getAdapterMeta().opts.branch).toBe('feature')
    expect(res.remote.headSha).toBe('BR-SHA')
  })

  it('pull({ref}) throws when adapter missing resolveRef', async () => {
    const vfs: any = new VirtualFS()
    vfs.indexManager.getIndex = jest.fn(async () => ({ entries: {}, head: '' }))
    vfs.backend = { writeIndex: jest.fn(async () => {}), init: jest.fn(async () => {}) }

    const adapter = {
      fetchSnapshot: jest.fn(async () => ({ headSha: 'x', shas: {}, fetchContent: async () => ({}) }))
    }
    vfs.remoteSynchronizer = { pull: jest.fn() }
    await vfs.setAdapter(adapter, { type: 'github', opts: {} })

    await expect(vfs.pull({ ref: 'f' })).rejects.toThrow(/does not support resolveRef/)
  })
})
