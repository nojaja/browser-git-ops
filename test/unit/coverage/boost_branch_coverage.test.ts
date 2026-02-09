import { describe, it, expect } from '@jest/globals'
import VirtualFS from '../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../src/virtualfs/inmemoryStorage'

describe('coverage boost: _isNonFastForwardError branches', () => {
  it('detects 422 in message', async () => {
    const vfs = new VirtualFS({ backend: new InMemoryStorage('__test_ns') })
    // access private helper
    const fn = (vfs as any)._isNonFastForwardError.bind(vfs)
    expect(fn(new Error('request failed: 422'))).toBeTruthy()
  })

  it('detects fast forward text', async () => {
    const vfs = new VirtualFS({ backend: new InMemoryStorage('__test_ns') })
    const fn = (vfs as any)._isNonFastForwardError.bind(vfs)
    expect(fn('This is not a fast forward')).toBeTruthy()
    expect(fn('fast forward required')).toBeTruthy()
  })

  it('returns false for unrelated errors', async () => {
    const vfs = new VirtualFS({ backend: new InMemoryStorage('__test_ns') })
    const fn = (vfs as any)._isNonFastForwardError.bind(vfs)
    expect(fn(new Error('network error'))).toBeFalsy()
  })
})
