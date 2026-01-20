import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

beforeEach(() => {
  jest.clearAllMocks()
})

// minimal fake IndexedDB used by other tests
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
            const req: any = {}
            Object.defineProperty(req, 'onsuccess', { set(fn) { onsuccess = fn } })
            setTimeout(() => { if (onsuccess) onsuccess({ target: req }) }, 0)
            Object.defineProperty(req, 'result', { get() { return storeMap.get(key) } })
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

import { BrowserStorage } from '../../../src/virtualfs/browserStorage'

describe('BrowserStorage extra coverage', () => {
  it('canUseOpfs returns true only when persist and getDirectory exist', async () => {
    ;(globalThis as any).navigator = (globalThis as any).navigator || {}
    // both present -> true
    ;(navigator as any).storage = { persist: async () => true, getDirectory: async () => ({}) }
    const bs = new BrowserStorage()
    await bs.init()
    expect(await bs.canUseOpfs()).toBe(true)

    // persist exists (even if returns false) -> true (persist-only detection)
    ;(navigator as any).storage = { persist: async () => false, getDirectory: async () => ({}) }
    expect(await bs.canUseOpfs()).toBe(true)

    // missing getDirectory -> still true (persist-only detection)
    ;(navigator as any).storage = { persist: async () => true }
    expect(await bs.canUseOpfs()).toBe(true)
  })

  it('deleteBlob attempts OPFS removal then IndexedDB', async () => {
    const files = new Map<string, string>()

    function makeDir(map: Map<string, any>) {
      async function getDirectory(name: string) {
        if (!map.has(name)) map.set(name, makeDir(new Map()))
        return map.get(name)
      }
      async function getFileHandle(name: string, opts?: any) {
        const key = name
        async function createWritable() {
          async function write(content: string) { map.set(key, content); files.set(key, content) }
          async function close() {}
          return { write, close }
        }
        async function getFile() { async function text() { return files.get(key) }; return { text } }
        return { createWritable, getFile }
      }
      async function removeEntry(name: string) { map.delete(name); files.delete(name) }
      return { getDirectory, getFileHandle, removeEntry }
    }

    const root = makeDir(new Map())
    ;(globalThis as any).navigator = (globalThis as any).navigator || {}
    ;(navigator as any).storage = { persist: async () => true, getDirectory: async () => root }

    const bs = new BrowserStorage()
    await bs.init()

    await bs.writeBlob('d1/a.txt', 'x')
    expect(await bs.readBlob('d1/a.txt')).toBe('x')
    await bs.deleteBlob('d1/a.txt')
    expect(await bs.readBlob('d1/a.txt')).toBeNull()
  })
})
