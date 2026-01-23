import VirtualFS from '../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS coverage targets', () => {
  it('_isNonFastForwardError detection', () => {
    const v = new VirtualFS({ backend: new InMemoryStorage() })
    expect((v as any)._isNonFastForwardError(new Error('422'))).toBe(true)
    expect((v as any)._isNonFastForwardError('some fast forward error')).toBe(true)
    expect((v as any)._isNonFastForwardError(new Error('other'))).toBe(false)
  })

  it('push throws when parentSha undefined or head mismatch', async () => {
    const v = new VirtualFS({ backend: new InMemoryStorage() })
    // missing parentSha
    await expect(v.push({ parentSha: undefined as any, changes: [{ type: 'create', path: 'a', content: 'x' }] } as any)).rejects.toThrow()

    // head mismatch
    await expect(v.push({ parentSha: 'not-head', changes: [{ type: 'create', path: 'a', content: 'x' }] } as any)).rejects.toThrow()
  })

  it('_areAllResolved and _promoteResolvedConflicts flow', async () => {
    const backend = new InMemoryStorage()
    const v = new VirtualFS({ backend })
    await v.init()
    // prepare index entry with baseSha equal to remoteSha
    const ie: any = { path: 'f', state: 'conflict', remoteSha: 'rs', baseSha: 'rs', updatedAt: Date.now() }
    await backend.writeBlob('f', JSON.stringify(ie), 'info')
    const conflicts = [{ path: 'f', remoteSha: 'rs' }]
    // prepare baseSnapshot content
    const baseSnapshot: Record<string, string> = { f: 'content' }
    await (v as any)._promoteResolvedConflicts(conflicts, baseSnapshot, 'head123')
    const idx = await v.getIndex()
    expect(idx.head).toBe('head123')
    const infoTxt = await backend.readBlob('f', 'info')
    const entry = infoTxt ? JSON.parse(infoTxt) : null
    expect(entry?.state).toBe('base')
  })

  it('resolveConflict promotes remote content when present and deletes conflict blob', async () => {
    const backend = new InMemoryStorage()
    const v = new VirtualFS({ backend })
    await v.init()
    // write conflict blob
    await backend.writeBlob('x', 'payload', 'conflict')
    // create index entry with remoteSha
    const ie: any = { path: 'x', state: 'conflict', remoteSha: 'r1', updatedAt: Date.now() }
    await backend.writeBlob('x', JSON.stringify(ie), 'info')
    const ok = await v.resolveConflict('x')
    expect(ok).toBe(true)
    // after resolve, index entry should be base and conflict removed
    const infoTxt = await backend.readBlob('x', 'info')
    const entry = infoTxt ? JSON.parse(infoTxt) : null
    expect(entry?.state).toBe('base')
    const got = await backend.readBlob('x', 'conflict')
    expect(got).toBeNull()
  })

  it('_handleRemoteDeletion branches', async () => {
    const backend = new InMemoryStorage()
    const v = new VirtualFS({ backend })
    await v.init()
    // case: entry with no baseSha -> ignored
    const ie1: any = { path: 'nobase', state: 'added' }
    await backend.writeBlob('nobase', JSON.stringify(ie1), 'info')
    const conflicts: any[] = []
    await (v as any)._handleRemoteDeletion('nobase', ie1, {}, conflicts)
    const info1Txt = await backend.readBlob('nobase', 'info')
    expect(info1Txt).toBeDefined()

    // case: entry with baseSha and no localWorkspace -> deleted
    const ie2: any = { path: 'delme', state: 'base', baseSha: 'b', updatedAt: Date.now() }
    await backend.writeBlob('delme', JSON.stringify(ie2), 'info')
    await backend.writeBlob('delme', 'old', 'base')
    await (v as any)._handleRemoteDeletion('delme', ie2, {}, conflicts)
    const info2Txt = await backend.readBlob('delme', 'info')
    expect(info2Txt).toBeNull()

    // case: entry with baseSha but workspace different sha -> conflict
    const ie3: any = { path: 'c', state: 'base', baseSha: 'b1', updatedAt: Date.now() }
    await backend.writeBlob('c', JSON.stringify(ie3), 'info')
    await backend.writeBlob('c', 'x', 'workspace')
    const conflicts2: any[] = []
    await (v as any)._handleRemoteDeletion('c', ie3, {}, conflicts2)
    expect(conflicts2.length).toBeGreaterThan(0)
  })
})
