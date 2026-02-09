import { jest } from '@jest/globals'
import { IndexManager } from '../../../src/virtualfs/indexManager'

describe('IndexManager (coverage)', () => {
  it('loadIndex -> updates head and lastCommitKey on normal read', async () => {
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue({ head: 'H', lastCommitKey: 'K' }),
      writeIndex: jest.fn(),
      listFiles: jest.fn()
    }
    const mgr = new IndexManager(backend)
    await mgr.loadIndex()
    expect(mgr.getHead()).toBe('H')
    expect(mgr.getLastCommitKey()).toBe('K')
  })

  it('loadIndex -> on readIndex throw, saveIndex is invoked and writeIndex called', async () => {
    const backend: any = {
      readIndex: jest.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({}),
      writeIndex: jest.fn().mockResolvedValue(undefined),
      listFiles: jest.fn()
    }
    const mgr = new IndexManager(backend)
    await mgr.loadIndex()
    // after failure, head should be reset and writeIndex should have been called during saveIndex()
    expect(mgr.getHead()).toBe('')
    expect(backend.writeIndex).toHaveBeenCalled()
  })

  it('saveIndex preserves existing top-level fields', async () => {
    const existing = { adapter: { type: 'gitlab' }, head: 'OLD' }
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue(existing),
      writeIndex: jest.fn().mockResolvedValue(undefined),
      listFiles: jest.fn()
    }
    const mgr = new IndexManager(backend)
    mgr.setHead('NEW_HEAD')
    mgr.setLastCommitKey('LAST123')
    await mgr.saveIndex()
    expect(backend.writeIndex).toHaveBeenCalled()
    const written = backend.writeIndex.mock.calls[0][0]
    expect(written.adapter).toBeDefined()
    expect(written.head).toBe('NEW_HEAD')
    expect(written.lastCommitKey).toBe('LAST123')
  })

  it('getIndex proxy delegates head read/write to manager', async () => {
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue({ head: 'TARGET', entries: {} }),
      writeIndex: jest.fn(),
      listFiles: jest.fn()
    }
    const mgr = new IndexManager(backend)
    mgr.setHead('MGR_HEAD')
    const idx = await mgr.getIndex()
    expect(idx.head).toBe('MGR_HEAD')
    // setting via proxy should update manager head
    idx.head = 'SET_VIA_PROXY'
    expect(mgr.getHead()).toBe('SET_VIA_PROXY')
  })

  it('listPaths excludes items with info.state === "deleted" and includes parse errors', async () => {
    const infos = [
      { path: 'a.txt', info: JSON.stringify({ state: 'ok' }) },
      { path: 'b.txt', info: JSON.stringify({ state: 'deleted' }) },
      { path: 'c.txt', info: '{badjson' }
    ]
    const backend: any = {
      readIndex: jest.fn(),
      writeIndex: jest.fn(),
      listFiles: jest.fn().mockResolvedValue(infos)
    }
    const mgr = new IndexManager(backend)
    const out = await mgr.listPaths()
    expect(out).toEqual(expect.arrayContaining(['a.txt','c.txt']))
    expect(out).not.toEqual(expect.arrayContaining(['b.txt']))
  })
})

export {}
/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/virtualfs/indexManager.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import IndexManager from '../../../src/virtualfs/indexManager.ts'

describe('IndexManager - coverage focused tests', () => {
  it('loadIndex normal path updates head and lastCommitKey', async () => {
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue({ head: 'H', lastCommitKey: 'K' }),
      writeIndex: jest.fn(),
      listFiles: jest.fn()
    }
    const m = new IndexManager(backend)
    await m.loadIndex()
    expect(m.getHead()).toBe('H')
    expect(m.getLastCommitKey()).toBe('K')
  })

  it('loadIndex exception path calls saveIndex (readIndex fails once then returns null)', async () => {
    const backend: any = {
      readIndex: jest.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(null),
      writeIndex: jest.fn(),
      listFiles: jest.fn()
    }
    const m = new IndexManager(backend)
    await m.loadIndex()
    expect(backend.writeIndex).toHaveBeenCalled()
  })

  it('saveIndex preserves top-level fields and writes head/lastCommitKey', async () => {
    const existing = { head: 'old', entries: {}, adapterMeta: { foo: 'bar' } }
    const backend: any = {
      readIndex: jest.fn().mockResolvedValue(existing),
      writeIndex: jest.fn(),
      listFiles: jest.fn()
    }
    const m = new IndexManager(backend)
    m.setHead('NEW')
    m.setLastCommitKey('LC')
    await m.saveIndex()
    const written = backend.writeIndex.mock.calls[0][0]
    expect(written.adapterMeta).toEqual({ foo: 'bar' })
    expect(written.head).toBe('NEW')
    expect((written as any).lastCommitKey).toBe('LC')
  })

  it('getIndex proxy delegates head and allows setting head via proxy', async () => {
    const backend: any = { readIndex: jest.fn().mockResolvedValue({ head: 'X', entries: {} }), writeIndex: jest.fn(), listFiles: jest.fn() }
    const m = new IndexManager(backend)
    m.setHead('H1')
    const idx = await m.getIndex()
    expect(idx.head).toBe('H1')
    idx.head = 'H2'
    expect(m.getHead()).toBe('H2')
  })

  it('listPaths excludes deleted state and keeps invalid JSON entries', async () => {
    const list = [
      { path: 'a.txt', info: JSON.stringify({ state: 'active' }) },
      { path: 'b.txt', info: JSON.stringify({ state: 'deleted' }) },
      { path: 'c.txt', info: 'not-json' },
      { path: 'd.txt', info: undefined }
    ]
    const backend: any = { readIndex: jest.fn(), writeIndex: jest.fn(), listFiles: jest.fn().mockResolvedValue(list) }
    const m = new IndexManager(backend)
    const out = await m.listPaths()
    expect(out).toContain('a.txt')
    expect(out).not.toContain('b.txt')
    expect(out).toContain('c.txt')
    expect(out).toContain('d.txt')
  })
})
