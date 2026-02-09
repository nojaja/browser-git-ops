/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

describe('InMemoryStorage branches', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => jest.resetAllMocks())

  it('availableRoots includes named stores created via constructor', () => {
    const s = new InMemoryStorage('__test_ns', 'my_shared_root')
    const roots = InMemoryStorage.availableRoots('__test_ns')
    expect(roots).toContain('my_shared_root')
  })

  it('writeBlob throws on unknown segment', async () => {
    const s = new InMemoryStorage('__test_ns')
    await expect(s.writeBlob('p', 'c', 'UNKNOWN')).rejects.toThrow('unknown segment')
  })

  it('readBlob respects explicit segment lookup', async () => {
    const s = new InMemoryStorage('__test_ns')
    await s.writeBlob('f1', 'w', 'workspace')
    await s.writeBlob('f2', 'b', 'base')
    // v0.0.4: conflict segment stores Info JSON metadata
    const conflictInfo = JSON.stringify({ path: 'f3', state: 'conflict', updatedAt: Date.now() })
    await s.writeBlob('f3', conflictInfo, 'conflict')

    expect(await s.readBlob('f2', 'base')).toBe('b')
    const f3Conflict = await s.readBlob('f3', 'conflict')
    expect(f3Conflict).not.toBeNull()
    expect(JSON.parse(f3Conflict!).state).toBe('conflict')
  })
})
