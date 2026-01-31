/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import InMemoryStorage from '../../../../src/virtualfs/inmemoryStorage'

describe('InMemoryStorage adapter metadata persistence', () => {
  it('writeIndex persists adapter and lastCommitKey meta', async () => {
    const root = `meta_${Math.random().toString(36).slice(2)}`
    const s = new InMemoryStorage(root)
    const idx = { head: 'h1', entries: {}, lastCommitKey: 'ck1', adapter: { type: 'github', opts: { host: 'https://api' } } }
    await s.writeIndex(idx as any)
    const r = await s.readIndex()
    expect(r.head).toBe('h1')
    expect((r as any).lastCommitKey).toBe('ck1')
    expect((r as any).adapter).toEqual({ type: 'github', opts: { host: 'https://api' } })
  })

  it('readIndex reconstructs entries from infoBlobs', async () => {
    const root = `meta2_${Math.random().toString(36).slice(2)}`
    const s = new InMemoryStorage(root)
    // write a blob to create an info entry
    await s.writeBlob('x/y.txt', 'hello', 'workspace')
    const all = await s.listFiles()
    const paths = all.map((f: any) => f.path)
    expect(paths).toContain('x/y.txt')
    const e = all.find((f: any) => f.path === 'x/y.txt')
    expect(e).toBeDefined()
    const entry = e && e.info ? JSON.parse(e.info) : null
    expect(entry.path).toBe('x/y.txt')
    expect(entry.workspaceSha).toBeDefined()
  })
})
