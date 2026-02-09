import { jest } from '@jest/globals'
import { IndexedDatabaseStorage } from '../../../src/virtualfs/indexedDatabaseStorage'

describe('IndexedDatabaseStorage static helpers', () => {
  const realIDB = (globalThis as any).indexedDB

  afterEach(() => {
    ;(globalThis as any).indexedDB = realIDB
    jest.restoreAllMocks()
  })

  it('canUse returns false when indexedDB absent', () => {
    ;(globalThis as any).indexedDB = undefined
    expect(IndexedDatabaseStorage.canUse()).toBe(false)
  })

  it('availableRoots returns empty when databases not a function', async () => {
    ;(globalThis as any).indexedDB = { databases: undefined }
    const roots = await IndexedDatabaseStorage.availableRoots()
    expect(roots).toEqual([])
  })

  it('availableRoots returns names from databases()', async () => {
    const entries = [{ name: 'one' }, { name: 'two' }, { name: 'one' }]
    const asyncIterable = (async function* () { for (const e of entries) yield e })()
    ;(globalThis as any).indexedDB = { databases: jest.fn().mockResolvedValue(asyncIterable) }
    const roots = await IndexedDatabaseStorage.availableRoots()
    expect(roots.sort()).toEqual(['one', 'two'].sort())
  })

  it('delete resolves on onsuccess and warns on blocked', async () => {
    const calls: string[] = []
    const request: any = {}
    // simulate request lifecycle
    request.onsuccess = null
    request.onerror = null
    request.onblocked = null
    ;(globalThis as any).indexedDB = {
      deleteDatabase: jest.fn().mockImplementation((name: string) => {
        // call onblocked synchronously to exercise that branch
        setTimeout(() => { if (typeof request.onblocked === 'function') request.onblocked() }, 0)
        setTimeout(() => { if (typeof request.onsuccess === 'function') request.onsuccess() }, 0)
        return request
      })
    }

    // spy on console.warn to assert blocked path executed
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => calls.push(String(args[0])))
    await expect(IndexedDatabaseStorage.delete('mydb')).resolves.toBeUndefined()
    expect((globalThis as any).indexedDB.deleteDatabase).toHaveBeenCalledWith('mydb')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('delete rejects when onerror called', async () => {
    const request: any = {}
    request.onsuccess = null
    request.onerror = null
    ;(globalThis as any).indexedDB = {
      deleteDatabase: jest.fn().mockImplementation(() => {
        setTimeout(() => { if (typeof request.onerror === 'function') request.onerror() }, 0)
        return request
      })
    }
    await expect(IndexedDatabaseStorage.delete('dbx')).rejects.toThrow('Failed to delete IndexedDB')
  })
})

export {}
