import VirtualFS from '../../../src/virtualfs/virtualfs'

describe('VirtualFS extra3 coverage targets', () => {
  it('_handleRemoteNew with undefined content creates conflict', async () => {
    const backend = {
      init: async () => {},
      readIndex: async () => null,
      writeIndex: async () => {},
      readBlob: async () => null,
      writeBlob: async () => {},
      deleteBlob: async () => {},
    }
    const v = new VirtualFS({ backend: backend as any })
    const conflicts: any[] = []
    await (v as any)._handleRemoteNew('p', 'sha1', {}, conflicts, undefined, undefined, 'h1')
    expect(conflicts.length).toBeGreaterThan(0)
    expect((v as any).index.entries['p'].state).toBe('conflict')
  })

  it('_handleRemoteExistingUpdate sets conflict when content undefined', async () => {
    const backend = { init: async () => {}, readIndex: async () => null, writeIndex: async () => {}, readBlob: async () => null, writeBlob: async () => {}, deleteBlob: async () => {} }
    const v = new VirtualFS({ backend: backend as any })
    const idx = { path: 'q', baseSha: 'b' }
    ;(v as any).index.entries['q'] = idx
    const conflicts: any[] = []
    await (v as any)._handleRemoteExistingUpdate('q', idx, 'remoteX', {}, conflicts, 'h2')
    expect((v as any).index.entries['q'].state).toBe('conflict')
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('_tryUpdateRef swallows non-422 errors and logs warn', async () => {
    const v = new VirtualFS({} as any)
    const adapter = { updateRef: async () => { throw new Error('network') } }
    // should not throw
    await expect((v as any)._tryUpdateRef(adapter, 'main', 'c1')).resolves.toBeUndefined()
  })

  it('_promoteResolvedConflicts returns early when not all resolved', async () => {
    const v = new VirtualFS({} as any)
    // index entry not matching remoteSha -> not resolved
    ;(v as any).index.entries['a'] = { path: 'a', baseSha: 'b', remoteSha: 'r' }
    const conflicts = [{ path: 'a', remoteSha: 'r' }]
    const beforeHead = (v as any).index.head
    await (v as any)._promoteResolvedConflicts(conflicts, {}, 'newhead')
    expect((v as any).index.head).toBe(beforeHead)
  })
})
