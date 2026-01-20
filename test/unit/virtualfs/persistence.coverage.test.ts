import { jest, describe, it, expect, beforeEach } from '@jest/globals'

beforeEach(() => {
  jest.clearAllMocks()
})

// minimal fake IndexedDB for this test
function makeFakeIndexedDB() {
  const stores = new Set<string>()
  const data = new Map<string, Map<string, any>>()

  const db: any = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => { stores.add(name); data.set(name, new Map()) },
    transaction: (storeName: string, _mode: string) => {
      const storeMap = data.get(storeName) || new Map()
      const tx: any = { oncomplete: undefined, onerror: undefined }
      tx.objectStore = (_: string) => {
        return {
          get: (key: string) => {
            let onsuccess: any
            const req: any = { get result() { return storeMap.get(key) } }
            Object.defineProperty(req, 'onsuccess', { set(fn) { onsuccess = fn } })
            setTimeout(() => { if (onsuccess) onsuccess({ target: req }) }, 0)
            return req
          },
          put: (val: any, key: string) => {
            let onsuccess: any
            const req: any = {}
            Object.defineProperty(req, 'onsuccess', { set(fn) { onsuccess = fn } })
            setTimeout(() => { storeMap.set(key, val); if (onsuccess) onsuccess({ target: req }); if (typeof tx.oncomplete === 'function') tx.oncomplete() }, 0)
            return req
          },
          delete: (key: string) => {
            let onsuccess: any
            const req: any = {}
            Object.defineProperty(req, 'onsuccess', { set(fn) { onsuccess = fn } })
            setTimeout(() => { storeMap.delete(key); if (onsuccess) onsuccess({ target: req }); if (typeof tx.oncomplete === 'function') tx.oncomplete() }, 0)
            return req
          }
        }
      }
      return tx
    }
  }

  return {
    open: (_name: string, _ver: number) => {
      let onsuccess: any
      let onupgradeneeded: any
      const req: any = {}
      Object.defineProperty(req, 'onsuccess', { set(fn) { onsuccess = fn } })
      Object.defineProperty(req, 'onupgradeneeded', { set(fn) { onupgradeneeded = fn } })
      setTimeout(() => { if (onupgradeneeded) onupgradeneeded({ target: { result: db } }); if (onsuccess) onsuccess({ target: { result: db } }) }, 0)
      req.result = db
      return req
    }
  }
}

// install fake indexedDB
// @ts-ignore
global.indexedDB = makeFakeIndexedDB()

import { OpfsStorage } from '../../../src/virtualfs/opfsStorage'

describe('OpfsStorage OPFS extra branches for coverage', () => {
  it('uses originPrivateFileSystem fallback when storage.getDirectory throws and remove via handle', async () => {
    const files = new Map<string, string>()

    // make dir with getFileHandle returning handle with remove()
    function makeDir(map: Map<string, any>) {
      async function getDirectory(name: string) {
        if (!map.has(name)) map.set(name, makeDir(new Map()))
        return map.get(name)
      }

      async function getFileHandle(name: string, opts?: any) {
        const key = name
        async function createWritable() {
          async function write(content: string) { files.set(key, content) }
          async function close() { /* noop */ }
          return { write, close }
        }
        async function getFile() { async function text() { return files.get(key) } return { text } }
        // handle with remove method
        const handle: any = { createWritable, getFile, remove: async () => { files.delete(key) } }
        return handle
      }

      return { getDirectory, getFileHandle }
    }

    const root = makeDir(new Map())

    ;(globalThis as any).navigator = (globalThis as any).navigator || {}
    // storage.getDirectory will throw to exercise fallback
    const nav: any = (globalThis as any).navigator
    nav.storage = {
      persist: async () => true,
      getDirectory: async () => { throw new Error('opfs fail') }
    }

    // originPrivateFileSystem provides fallback
    ;(globalThis as any).originPrivateFileSystem = { getDirectory: async () => root }

    const bs = new OpfsStorage()
    await bs.init()

    await bs.writeBlob('d/r.txt', 'origin-content')
    const got = await bs.readBlob('d/r.txt')
    expect(got).toBe('origin-content')

    await bs.deleteBlob('d/r.txt')
    const after = await bs.readBlob('d/r.txt')
    expect(after).toBeNull()
  })
})
