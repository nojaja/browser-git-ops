import { jest } from '@jest/globals'
import { IndexedDatabaseStorage } from '../../../src/virtualfs/indexedDatabaseStorage'

describe('IndexedDatabaseStorage internals - branch boost', () => {
  it('_resolveExistingInfoText selects git-base then info when gitBase present', async () => {
    const inst: any = Object.create((IndexedDatabaseStorage as any).prototype)
    inst.currentBranch = 'main'
    // _getFromStore: first call returns gitBase, second returns info
    const mock = jest.fn()
    mock.mockResolvedValueOnce('gitbasecontent')
    mock.mockResolvedValueOnce('infotext')
    inst._getFromStore = mock

    const res = await inst._resolveExistingInfoText('workspace', 'main', 'file.txt', 'file.txt')
    expect(res).toBe('infotext')
    expect(mock).toHaveBeenCalled()
  })

  it('_resolveExistingInfoText falls back to workspace-info when gitBase absent', async () => {
    const inst: any = Object.create((IndexedDatabaseStorage as any).prototype)
    inst.currentBranch = 'main'
    const mock = jest.fn()
    mock.mockResolvedValueOnce(null) // git base missing
    mock.mockResolvedValueOnce('wsinfo')
    inst._getFromStore = mock

    const res = await inst._resolveExistingInfoText('workspace', 'main', 'file2.txt', 'file2.txt')
    expect(res).toBe('wsinfo')
  })

  it('_resolveExistingInfoText calls info store for non-workspace segments', async () => {
    const inst: any = Object.create((IndexedDatabaseStorage as any).prototype)
    inst._getFromStore = jest.fn().mockResolvedValue('info-for-nonworkspace')
    const res = await inst._resolveExistingInfoText('info', 'main', 'x', 'x')
    expect(res).toBe('info-for-nonworkspace')
  })

  it('_entryFromStoreKey filters by prefix and recursion', async () => {
    const inst: any = Object.create((IndexedDatabaseStorage as any).prototype)
    inst.dbName = 'mydb'
    inst.currentBranch = 'main'
    // resolveInfoForKey returns a fixed value
    inst._resolveInfoForKey = jest.fn().mockResolvedValue('info-json')

    // case: workspace-info store key without branch prefix; prefix matches
    const r1 = await inst._entryFromStoreKey(IndexedDatabaseStorage.VAR_WORKSPACE_INFO, 'path/a.txt', 'main', 'path', true)
    expect(r1).not.toBeNull()
    expect(r1!.info).toBe('info-json')

    // case: recursive=false and nested path should be filtered
    const r2 = await inst._entryFromStoreKey(IndexedDatabaseStorage.VAR_BASE, 'main::dir/sub/file.txt', 'main', 'dir', false)
    expect(r2).toBeNull()

    // case: workspace store respects prefix and returns entry
    const r3 = await inst._entryFromStoreKey(IndexedDatabaseStorage.VAR_WORKSPACE_BASE, 'dir/file.txt', 'main', 'dir', false)
    expect(r3).not.toBeNull()
    expect(r3!.path).toContain('workspace')
  })

  it('_entriesFromStoreKeys filters null entries', async () => {
    const inst: any = Object.create((IndexedDatabaseStorage as any).prototype)
    inst._entryFromStoreKey = jest.fn()
    inst._entryFromStoreKey
      .mockResolvedValueOnce({ uri: 'u1', path: 'p1', info: null })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ uri: 'u3', path: 'p3', info: 'i3' })

    const out = await inst._entriesFromStoreKeys('some', ['k1', 'k2', 'k3'], 'main', 'p', true)
    expect(out).toHaveLength(2)
    expect(out.map((x: any) => x.path)).toEqual(['p1', 'p3'])
  })
})

export {}
