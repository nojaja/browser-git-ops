import VirtualFS from '../../../src/virtualfs/virtualfs'

describe('VirtualFS extra coverage targets', () => {
  it('_persistRemoteContentAsConflict ignores undefined and swallows backend errors', async () => {
    const backend = {
      init: async () => {},
      readIndex: async () => null,
      writeIndex: async () => {},
      readBlob: async () => null,
      writeBlob: async (p: string, c: string, seg?: string) => { if (p === 'err') throw new Error('boom') },
      deleteBlob: async () => {},
    }
    const fs = new VirtualFS({ backend: backend as any })
    const ref = fs as any
    // undefined content -> early return
    await ref._persistRemoteContentAsConflict('a', undefined)
    // content but backend throws -> should not throw
    await expect(ref._persistRemoteContentAsConflict('err', 'x')).resolves.toBeUndefined()
  })

  it('_promoteResolvedConflictEntry writes base and deletes conflict, updates index', async () => {
    const calls: Array<{m:string,args:any[]}> = []
    const backend = {
      init: async () => {},
      readIndex: async () => null,
      writeIndex: async () => {},
      readBlob: async () => null,
      writeBlob: async (p: string, c: string, seg?: string) => { calls.push({ m: 'writeBlob', args: [p, c, seg] }); },
      deleteBlob: async (p: string, seg?: string) => { calls.push({ m: 'deleteBlob', args: [p, seg] }) },
    }
    const fs = new VirtualFS({ backend: backend as any })
    const ref = fs as any
    // create index entry for conflict
    ref.index.entries['z'] = { path: 'z', remoteSha: 'r1', state: 'conflict' }
    const baseSnapshot = { z: 'payload' }
    await ref._promoteResolvedConflictEntry({ path: 'z', remoteSha: 'r1' }, baseSnapshot)
    // verify that base was written and conflict deleted
    expect(calls.find(c => c.m === 'writeBlob')).toBeDefined()
    expect(calls.find(c => c.m === 'deleteBlob')).toBeDefined()
    expect((fs as any).index.entries['z'].state).toBe('base')
    expect((fs as any).index.entries['z'].baseSha).toBe('r1')
  })

  it('_applyCreateOrUpdate handles backend errors and clears workspace', async () => {
    const backend = {
      init: async () => {},
      readIndex: async () => null,
      writeIndex: async () => {},
      readBlob: async () => null,
      writeBlob: async () => { throw new Error('write fail') },
      deleteBlob: async () => { throw new Error('del fail') },
    }
    const fs = new VirtualFS({ backend: backend as any })
    const ref = fs as any
    // prepare: base and workspace entry
    ref.workspace.set('p', { sha: 's', content: 'c' })
    const ch = { type: 'update', path: 'p', content: 'c' }
    // Should not throw even if backend methods throw
    await expect(ref._applyCreateOrUpdate(ch)).resolves.toBeUndefined()
    expect(ref.workspace.get('p')).toBeUndefined()
    // also ensure index entry set to base by _applyChangeLocally when called
    await ref._applyChangeLocally({ type: 'create', path: 'q', content: 'q' })
    expect(ref.index.entries['q'].state).toBe('base')
  })

  it('_ensureWorkspaceBlobForEntry swallows backend read errors and returns undefined', async () => {
    const backend = {
      init: async () => {},
      readIndex: async () => null,
      writeIndex: async () => {},
      readBlob: async () => { throw new Error('read fail') },
      writeBlob: async () => {},
      deleteBlob: async () => {},
    }
    const fs = new VirtualFS({ backend: backend as any })
    const ref = fs as any
    ref.index.entries['x'] = { path: 'x', workspaceSha: 'ws', state: 'modified' }
    const res = await ref._ensureWorkspaceBlobForEntry('x', ref.index.entries['x'])
    expect(res).toBeUndefined()
  })

  it('_areAllResolved true/false cases', async () => {
    const fs = new VirtualFS({} as any)
    // false: no index entry
    expect((fs as any)._areAllResolved([{ path: 'nope' }])).toBe(false)
    // true: entry with matching baseSha and remoteSha
    ;(fs as any).index.entries['a'] = { path: 'a', baseSha: 's', remoteSha: 's' }
    expect((fs as any)._areAllResolved([{ path: 'a' }])).toBe(true)
  })
})
