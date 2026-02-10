/**
 * @test-type behavior
 * @purpose Validate removal of old setAdapter(adapter, meta) API (v0.0.6)
 * @policy Jest unit tests only
 */
import { jest } from '@jest/globals'
import { VirtualFS } from '../../../../../src/virtualfs/virtualfs'
import { InMemoryStorage } from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS setAdapter old-API removal (v0.0.6)', () => {
  let backend: any
  let vfs: any

  beforeEach(async () => {
    backend = new (InMemoryStorage as any)('v006-old-api')
    ;(backend as any).listFilesRaw = jest.fn(async () => {
      try {
        return (await (backend as any).listFiles(undefined, 'info', true)).map((f: any) => ({ uri: f.path, path: f.path, info: f.info }))
      } catch (e) {
        return []
      }
    })

    vfs = new VirtualFS({ backend })
    await vfs.init()
  })

  it('declared arity of setAdapter should be 1 (meta only)', () => {
    // TDD: prefer failure until implementation updated
    expect((vfs as any).setAdapter.length).toBe(1)
  })

  it('calling setAdapter(adapterInstance, meta) should be rejected (old API removed)', async () => {
    const adapterInstance = { dummy: true }
    const meta = { type: 'github', opts: { branch: 'main' } }

    await expect((vfs as any).setAdapter(adapterInstance, meta)).rejects.toThrow()

    // ensure backend.listFilesRaw remains the recommended way to check persistence
    const raw = await backend.listFilesRaw()
    expect(Array.isArray(raw)).toBe(true)
  })

  it('should NOT persist meta when called using old two-arg signature', async () => {
    const adapterInstance = { dummy: true }
    const meta = { type: 'github', opts: { branch: 'main' } }

    // If old API still exists this call might persist; TDD expects it NOT to persist
    try {
      await (vfs as any).setAdapter(adapterInstance, meta)
    } catch (e) {
      // ignored, as some implementations may throw
    }

    const got = await (vfs as any).getAdapter()
    // Expectation: meta must NOT have been persisted as AdapterMeta
    expect(got === null || got && got.type !== 'github').toBeTruthy()
  })
})
