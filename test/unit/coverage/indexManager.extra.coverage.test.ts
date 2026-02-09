/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/virtualfs/indexManager.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import { IndexManager } from '../../../src/virtualfs/indexManager'
import VirtualFS from '../../../src/virtualfs/virtualfs'

describe('IndexManager - extra coverage', () => {
  it('saveIndex removes lastCommitKey when undefined', async () => {
    const existing = { head: 'OLD', entries: {}, lastCommitKey: 'X' }
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue(existing),
      writeIndex: jest.fn().mockResolvedValue(undefined),
      listFiles: jest.fn()
    }
    const m = new IndexManager(backend)
    m.setHead('H')
    m.setLastCommitKey(undefined)
    await m.saveIndex()
    const written = backend.writeIndex.mock.calls[0][0]
    expect(written.head).toBe('H')
    expect(written.lastCommitKey).toBeUndefined()
  })

  it('getIndex proxy mutates underlying object for non-head props', async () => {
    const base = { head: 'H', entries: {}, foo: 'orig' }
    const backend: any = { readIndex: jest.fn().mockResolvedValue(base), writeIndex: jest.fn(), listFiles: jest.fn() }
    const m = new IndexManager(backend)
    const idx = await m.getIndex()
    idx.foo = 'changed'
    expect(base.foo).toBe('changed')
    // head proxy write updates manager
    idx.head = 'NEW'
    expect(m.getHead()).toBe('NEW')
  })

  it('listPaths returns empty array when no infos', async () => {
    const backend: any = { readIndex: jest.fn(), writeIndex: jest.fn(), listFiles: jest.fn().mockResolvedValue([]) }
    // use VirtualFS.readdir('.') to assert listing semantics
    const vfs = new VirtualFS({ backend })
    const out = await vfs.readdir('.')
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBe(0)
  })

  it('saveIndex propagates writeIndex error', async () => {
    const backend: any = { readIndex: jest.fn().mockResolvedValue({}), writeIndex: jest.fn().mockRejectedValue(new Error('writefail')), listFiles: jest.fn() }
    const m = new IndexManager(backend)
    m.setHead('H')
    await expect(m.saveIndex()).rejects.toThrow(/writefail/)
  })
})
