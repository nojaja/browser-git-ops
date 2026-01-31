/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { InMemoryStorage } from '../../../../src/virtualfs/inmemoryStorage'
import { VirtualFS } from '../../../../src/virtualfs/virtualfs'

// Consolidated Batch A tests (persistence + basic vfs + read/resolve + coverage targets)
const backends = [
  { name: 'InMemory', factory: () => new InMemoryStorage(), available: true }
]

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.resetAllMocks())

for (const backend of backends) {
  const describeFn = backend.available ? describe : describe.skip
  describeFn(`VirtualFS BatchA consolidated - ${backend.name}`, () => {
    it('storage: init, write/read index and blob ops', async () => {
      const store = await backend.factory()
      await store.init()

      const index = { head: 'h', entries: {} }
      await store.writeIndex(index as any)
      const read = await store.readIndex()
      expect(read).not.toBeNull()
      expect(read.head).toBe('h')

      await store.writeBlob('dir/a.txt', 'hello')
      expect(await store.readBlob('dir/a.txt')).toBe('hello')
      await store.deleteBlob('dir/a.txt')
      expect(await store.readBlob('dir/a.txt')).toBeNull()
    })

    it('vfs: readFile and resolveConflict flows', async () => {
      const store = await backend.factory()
      await store.init()
      const vfs = new VirtualFS({ backend: store })

      await vfs.writeFile('a.txt', 'A')
      expect(await vfs.readFile('a.txt')).toBe('A')

      await store.writeBlob('b.txt', 'B', 'workspace')
      expect(await vfs.readFile('b.txt')).toBe('B')

      await store.writeBlob('c.txt', 'C', 'base')
      expect(await vfs.readFile('c.txt')).toBe('C')

      const filePath = 'conf.txt'
      await store.writeBlob(filePath, JSON.stringify({ path: filePath, remoteSha: 'r1' }), 'info')
      await store.writeBlob(filePath, 'RC', 'conflict')
      await vfs.init()
      expect(await vfs.resolveConflict(filePath)).toBe(true)
      const ie = (await vfs.getIndex()).entries[filePath]
      expect(ie.state).toBe('base')
    })
  })
}

export {}
