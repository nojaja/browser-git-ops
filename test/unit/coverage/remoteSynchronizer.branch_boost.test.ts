import { jest } from '@jest/globals'
import { RemoteSynchronizer } from '../../../src/virtualfs/remoteSynchronizer'

function makeMocks() {
  const backend: any = {
    readBlob: jest.fn().mockResolvedValue(null),
    writeBlob: jest.fn().mockResolvedValue(undefined),
    deleteBlob: jest.fn().mockResolvedValue(undefined),
    listFiles: jest.fn().mockResolvedValue([]),
  }
  const indexManager: any = {
    getIndex: jest.fn(),
    setHead: jest.fn(),
    setLastCommitKey: jest.fn(),
    saveIndex: jest.fn().mockResolvedValue(undefined),
  }
  const conflictManager: any = {
    persistRemoteContentAsConflict: jest.fn().mockResolvedValue(undefined),
    setIndexEntryToConflict: jest.fn().mockResolvedValue(undefined),
    promoteResolvedConflicts: jest.fn().mockResolvedValue(undefined),
  }
  const applier: any = {
    applyCreateOrUpdate: jest.fn().mockResolvedValue(undefined),
    applyDelete: jest.fn().mockResolvedValue(undefined),
  }
  return { backend, indexManager, conflictManager, applier }
}

describe('RemoteSynchronizer.push branches', () => {
  it('throws when parentSha missing', async () => {
    const { backend, indexManager, conflictManager, applier } = makeMocks()
    const r = new RemoteSynchronizer(backend, indexManager, conflictManager, applier)
    await expect(r.push({} as any)).rejects.toThrow('No parentSha set')
  })

  it('throws on non-fast-forward parentSha mismatch', async () => {
    const { backend, indexManager, conflictManager, applier } = makeMocks()
    indexManager.getIndex.mockResolvedValue({ head: 'other' })
    const r = new RemoteSynchronizer(backend, indexManager, conflictManager, applier)
    await expect(r.push({ parentSha: 'p', changes: [{ type: 'create', path: 'a', content: 'x' }] } as any)).rejects.toThrow('非互換な更新')
  })

  it('successfully applies changes and updates index', async () => {
    const { backend, indexManager, conflictManager, applier } = makeMocks()
    indexManager.getIndex.mockResolvedValue({ head: 'p' })
    const r = new RemoteSynchronizer(backend, indexManager, conflictManager, applier)

    const res = await r.push({ parentSha: 'p', changes: [{ type: 'create', path: 'a', content: 'hello' }] } as any)

    expect(res).toHaveProperty('commitSha')
    expect(indexManager.setHead).toHaveBeenCalled()
    expect(indexManager.setLastCommitKey).toHaveBeenCalled()
    expect(indexManager.saveIndex).toHaveBeenCalled()
    expect(applier.applyCreateOrUpdate).toHaveBeenCalled()
  })

  it('throws when changes are empty', async () => {
    const { backend, indexManager, conflictManager, applier } = makeMocks()
    indexManager.getIndex.mockResolvedValue({ head: 'p' })
    const r = new RemoteSynchronizer(backend, indexManager, conflictManager, applier)
    await expect(r.push({ parentSha: 'p', changes: [] } as any)).rejects.toThrow('No changes to commit')
  })
})

export {}
