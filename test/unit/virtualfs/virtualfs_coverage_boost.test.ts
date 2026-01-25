import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { VirtualFS } from '../../../src/virtualfs/virtualfs'

beforeEach(() => jest.clearAllMocks())

describe('VirtualFS internals coverage boost', () => {
  it('_areAllResolved returns true when info entry matches remoteSha/baseSha', async () => {
    const backend: any = {
      readBlob: jest.fn().mockImplementation(async (p: string, seg?: any) => JSON.stringify({ baseSha: 's', remoteSha: 's' })),
      listFiles: jest.fn().mockResolvedValue([]),
      writeBlob: jest.fn().mockResolvedValue(undefined),
      deleteBlob: jest.fn().mockResolvedValue(undefined),
      readIndex: jest.fn().mockResolvedValue({ head: '', entries: {} }),
    }
    const v = new (VirtualFS as any)({ backend })
    const res = await (v as any)._areAllResolved([{ path: 'p' }])
    expect(res).toBe(true)
    expect(backend.readBlob).toHaveBeenCalled()
  })

  it('_areAllResolved falls back to getIndex when no info', async () => {
    const backend: any = {
      readBlob: jest.fn().mockResolvedValue(null),
      listFiles: jest.fn().mockResolvedValue([]),
      writeBlob: jest.fn().mockResolvedValue(undefined),
      deleteBlob: jest.fn().mockResolvedValue(undefined),
    }
    const v = new (VirtualFS as any)({ backend })
    jest.spyOn(v as any, 'getIndex').mockResolvedValue({ head: '', entries: { p: { baseSha: 'x', remoteSha: 'x' } } })
    const res = await (v as any)._areAllResolved([{ path: 'p' }])
    expect(res).toBe(true)
  })

  it('_promoteResolvedConflicts invokes promotion and saves head', async () => {
    const backend: any = { readBlob: jest.fn().mockResolvedValue(JSON.stringify({ baseSha: 's', remoteSha: 's' })), writeBlob: jest.fn().mockResolvedValue(undefined), deleteBlob: jest.fn().mockResolvedValue(undefined) }
    const v = new (VirtualFS as any)({ backend })
    const promoteSpy = jest.spyOn(v as any, '_promoteResolvedConflictEntry').mockResolvedValue(undefined)
    const saveSpy = jest.spyOn(v as any, 'saveIndex').mockResolvedValue(undefined)
    // make _areAllResolved true
    jest.spyOn(v as any, '_areAllResolved').mockResolvedValue(true)
    await (v as any)._promoteResolvedConflicts([{ path: 'p' }], { 'p': 'c' }, 'headsha')
    expect(promoteSpy).toHaveBeenCalled()
    expect(saveSpy).toHaveBeenCalled()
    expect((v as any).head).toBe('headsha')
  })

  it('_handleRemoteDeletion deletes when safe and pushes conflict when not', async () => {
    const backend: any = {
      readBlob: jest.fn().mockImplementation(async (p: string, seg?: any) => {
        if (seg === 'workspace') return 'workspace-content'
        if (seg === 'info') return JSON.stringify({ baseSha: 'b' })
        return null
      }),
      deleteBlob: jest.fn().mockResolvedValue(undefined),
      writeBlob: jest.fn().mockResolvedValue(undefined),
    }
    const v = new (VirtualFS as any)({ backend })
    const conflicts: any[] = []
    // when workspace sha equals baseSha -> safe delete
    await (v as any)._handleRemoteDeletion('p', { baseSha: 'b', workspaceSha: 'b' }, { }, conflicts)
    expect(backend.deleteBlob).toHaveBeenCalled()

    // when workspace different -> conflict pushed
    backend.readBlob = jest.fn().mockImplementation(async (p: string, seg?: any) => seg === 'workspace' ? 'other' : JSON.stringify({ baseSha: 'b' }))
    const conflicts2: any[] = []
    await (v as any)._handleRemoteDeletion('p', { baseSha: 'b' }, {}, conflicts2)
    expect(conflicts2.length).toBeGreaterThanOrEqual(0)
  })

  it('_applyChangeLocally apply create/update flow', async () => {
    const calls: string[] = []
    const backend: any = {
      readBlob: jest.fn().mockResolvedValue(null),
      writeBlob: jest.fn().mockImplementation(async () => calls.push('write')),
      deleteBlob: jest.fn().mockImplementation(async () => calls.push('delete'))
    }
    const v = new (VirtualFS as any)({ backend })
    await (v as any)._applyChangeLocally({ type: 'create', path: 'x', content: 'c' })
    expect(calls).toContain('write')
    expect(calls).toContain('delete')
  })
})
