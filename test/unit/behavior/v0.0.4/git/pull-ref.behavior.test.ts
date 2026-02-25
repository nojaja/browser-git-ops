import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import VirtualFS from '../../../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS.pull() with ref (TDD behavior tests for v0.0.4)', () => {
  let vfs: any
  let backend: any
  let fakeAdapter: any

  beforeEach(async () => {
    jest.clearAllMocks()
    backend = new InMemoryStorage('__test_ns')
    vfs = new VirtualFS({ backend })
    await vfs.init()

    // simple fake adapter skeleton used to drive tests
    fakeAdapter = {
      fetchSnapshot: jest.fn(async (arg: any) => {
        // Simulate GitLab tree response mapping: tree entries provide `id` which we expose as shas map
        // If arg is a resolved SHA (string), treat it as headSha
        const headSha = typeof arg === 'string' ? String(arg) : 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
        const shas: Record<string,string> = {
          'README.md': '9af29826d6e11847f0cff8a17b7403cfb9f5596c'
        }
        // fetchContent and snapshot provide README.md content so pull can apply it
        const snapshot: Record<string,string> = { 'README.md': '# Example\n' }
        const fetchContent = async (paths: string[]) => {
          const out: Record<string,string> = {}
          for (const p of paths) {
            if (p in snapshot) out[p] = snapshot[p]
          }
          return out
        }
        return { headSha, shas, fetchContent, snapshot }
      }),
      resolveRef: jest.fn(async (ref: string) => {
        // Produce deterministic 40-char sha for tests (simulate commit-ish resolution)
        if (typeof ref === 'string' && /^[0-9a-f]{40}$/.test(ref)) return ref
        // simple deterministic mapping: hexify input then pad/truncate
        const hex = Buffer.from(ref).toString('hex').slice(0, 40)
        return (hex + '0'.repeat(40)).slice(0, 40)
      })
    }

    // persist adapter meta as if previously configured (gitlab shape expected by tests)
    vfs.adapter = fakeAdapter
    await vfs.setAdapter({ type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: '******', branch: 'main' } })
  })

  it('resolves ref, applies snapshot and updates head and adapterMeta.branch on success', async () => {
    const ref = 'develop'
    // call new API shape; use any cast so tests compile even if API not yet implemented
    await expect((vfs as any).pull({ ref })).resolves.toBeDefined()

    // resolveRef should have been called
    expect(fakeAdapter.resolveRef).toHaveBeenCalledWith(ref)

    // after successful pull the index head should be set to resolved sha
    const index = await vfs.getIndex()
    const resolvedSha = await fakeAdapter.resolveRef(ref)
    expect(index.head).toBe(resolvedSha)

    // adapter meta should be updated to the requested ref
    const meta = await vfs.getAdapter()
    expect(meta).not.toBeNull()
    expect(meta.branch).toBe(ref)
  })

  it('throws if resolveRef fails and does not modify adapterMeta', async () => {
    const badRef = 'nonexistent'
    // make resolveRef fail
    fakeAdapter.resolveRef.mockRejectedValueOnce(new Error('ref not found'))

    await expect((vfs as any).pull({ ref: badRef })).rejects.toThrow()

    // Ensure adapter meta remains unchanged (still 'main')
    const meta = await vfs.getAdapter()
    expect(meta.branch).toBe('main')
  })

  it('uses adapterMeta.branch when no ref specified', async () => {
    // ensure adapterMeta.branch is set to 'feature'
    vfs.adapter = fakeAdapter
    await vfs.setAdapter({ type: 'github', opts: { branch: 'feature' } })

    await expect((vfs as any).pull()).resolves.toBeDefined()

    // resolveRef should have been called with 'feature'
    expect(fakeAdapter.resolveRef).toHaveBeenCalledWith('feature')

    // index head should reflect resolved sha for 'feature'
    const index = await vfs.getIndex()
    const resolvedSha = await fakeAdapter.resolveRef('feature')
    expect(index.head).toBe(resolvedSha)
  })
})
