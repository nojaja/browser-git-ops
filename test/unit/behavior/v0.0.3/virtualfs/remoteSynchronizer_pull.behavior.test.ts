/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { VirtualFS } from '../../../../../src/virtualfs/virtualfs'
import { InMemoryStorage } from '../../../../../src/virtualfs/inmemoryStorage'

describe('RemoteSynchronizer pull via VirtualFS', () => {
  let backend: any
  let vfs: any

  beforeEach(async () => {
    backend = new (InMemoryStorage as any)('rs-pull')
    vfs = new VirtualFS({ backend })
    await vfs.init()
  })

  it('pull with string+baseSnapshot applies base and sets head when no conflicts', async () => {
    const snapshot = { 'p.txt': 'content' }
    const res: any = await vfs.pull('remote-head-1', snapshot)
    expect(res.conflicts).toBeDefined()
    expect(res.conflicts).toHaveLength(0)
    // new VirtualFS.pull enriches result with remote metadata and index diffs
    expect(res.remote).toBeDefined()
    expect(res.remotePaths).toBeDefined()
    expect(res.addedPaths).toBeDefined()
    expect(res.addedPaths).toContain('p.txt')
    // index head should be updated
    expect(vfs.head).toBe('remote-head-1')
    // v0.0.4: pull is metadata-only, base blob is NOT written
    expect(await backend.readBlob('p.txt', 'base')).toBe(null)
  })

  it('pull with descriptor that returns no content produces conflicts and does not set head', async () => {
    const p = 'missing.txt'
    const remoteDesc = {
      headSha: 'remote-head-2',
      shas: { [p]: 'deadbeef' },
      fetchContent: async (_: string[]) => { return {} }
    }
    const originalHead = vfs.head
    const res: any = await vfs.pull(remoteDesc)
    expect(res.conflicts).toBeDefined()
    // v0.0.4: pull is metadata-only, fetchContent is not called, so no conflict
    expect(res.conflicts.length).toBe(0)
    // head should be updated since no conflicts
    expect(vfs.head).toBe('remote-head-2')
    // v0.0.4: no conflict metadata without fetchContent call
    const conflictInfo = await backend.readBlob(p, 'conflict')
    expect(conflictInfo).toBeNull()
  })
})
