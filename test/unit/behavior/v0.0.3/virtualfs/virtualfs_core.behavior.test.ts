/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import VirtualFS from '../../../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

const backends = [
  ['InMemory', () => new InMemoryStorage('__test_ns')]
  // Add other backend factories as needed: IndexedDB/OPFS (with proper fakes)
] as const

describe.each(backends)('VirtualFS core (%s)', (_name, backendFactory) => {
  let backend: any
  beforeEach(async () => {
    backend = backendFactory()
  })

 
  it('_isNonFastForwardError detection', () => {
    const v = new VirtualFS({ backend })
    expect((v as any)._isNonFastForwardError(new Error('422'))).toBe(true)
    expect((v as any)._isNonFastForwardError('some fast forward error')).toBe(true)
    expect((v as any)._isNonFastForwardError(new Error('other'))).toBe(false)
  })

  it('push throws when parentSha undefined or head mismatch', async () => {
    const v = new VirtualFS({ backend })
    await v.init()
    await expect(v.push({ parentSha: undefined as any, changes: [{ type: 'create', path: 'a', content: 'x' }] } as any)).rejects.toThrow()
    await expect(v.push({ parentSha: 'not-head', changes: [{ type: 'create', path: 'a', content: 'x' }] } as any)).rejects.toThrow()
  })

})
