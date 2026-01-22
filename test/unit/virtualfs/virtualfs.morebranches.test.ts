import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import VirtualFS from '../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS more branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('_ensureWorkspaceBlobForEntry swallows backend.readBlob errors and returns undefined', async () => {
    const badBackend = {
      init: async () => {},
      readIndex: async () => ({ head: '', entries: {} }),
      writeIndex: async () => {},
      writeBlob: async () => {},
      readBlob: async () => { throw new Error('fail read') },
      deleteBlob: async () => {},
    }
    const v = new VirtualFS({ backend: badBackend as any })
    await v.init()

    const entry = { path: 'x.txt', workspaceSha: 'ws1' }
    const res = await (v as any)._ensureWorkspaceBlobForEntry('x.txt', entry)
    expect(res).toBeUndefined()
  })

  // Additional cases covered in other tests; keep focused conflict/delete coverage here.

  it('_handleRemoteDeletion pushes conflict when workspace modified, deletes when safe', async () => {
    const storage = new InMemoryStorage()
    const v = new VirtualFS({ backend: storage })
    await v.init()

    // case 1: entry created locally (no baseSha) -> no delete
    v.getIndex().entries['local.txt'] = { path: 'local.txt', state: 'added' }
    const conflicts1: any[] = []
    await (v as any)._handleRemoteDeletion('local.txt', v.getIndex().entries['local.txt'], {}, conflicts1)
    expect(conflicts1.length).toBe(0)

    // case 2: base exists and workspace equals base -> delete
    await v.applyBaseSnapshot({ 'del.txt': 'b' }, 'h1')
    const e = v.getIndex().entries['del.txt']
    const conflicts2: any[] = []
    await (v as any)._handleRemoteDeletion('del.txt', e, {}, conflicts2)
    expect(conflicts2.length).toBe(0)
    expect(v.listPaths().includes('del.txt')).toBe(false)

    // case 3: base exists but workspace modified -> conflict
    await v.applyBaseSnapshot({ 'conf.txt': 'b2' }, 'h2')
    await v.writeFile('conf.txt', 'modified')
    const e2 = v.getIndex().entries['conf.txt']
    const conflicts3: any[] = []
    await (v as any)._handleRemoteDeletion('conf.txt', e2, {}, conflicts3)
    expect(conflicts3.length).toBe(1)
    expect(conflicts3[0].path).toBe('conf.txt')
  })

})
