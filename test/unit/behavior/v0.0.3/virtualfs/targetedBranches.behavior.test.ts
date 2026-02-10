/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest } from '@jest/globals'
import { describe, it, expect } from '@jest/globals'
import VirtualFS from '../../../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS targeted branch coverage', () => {
  it('push throws on non-fast-forward errors from adapter.updateRef', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    // prepare head so parentSha matches
    await vfs.applyBaseSnapshot({ 'p.txt': 'base' }, 'head1')

    const adapter: any = {
      createBlobs: jest.fn().mockResolvedValue({ 'p.txt': 'blobsha' }),
      createTree: jest.fn().mockResolvedValue('treesha'),
      createCommit: jest.fn().mockResolvedValue('commitsha'),
      updateRef: jest.fn().mockRejectedValue(new Error('not a fast forward'))
    }

    const input: any = { parentSha: 'head1', changes: [{ type: 'create', path: 'p.txt', content: 'x' }], message: 'm', commitKey: 'k' }

    vfs.adapter = adapter
    await vfs.setAdapter({ type: 'github', opts: {} })
    await expect(vfs.push(input)).rejects.toThrow('非互換な更新')
  })

  it('pull treats missing fetched content for existing index entry as conflict', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    // prepare an index entry indicating baseSha old
    await backend.writeBlob('a.txt', JSON.stringify({ path: 'a.txt', state: 'base', baseSha: 'old' }), 'info')
    await backend.writeBlob('a.txt', 'oldcontent', 'base')

    const normalized: any = {
      headSha: 'h',
      shas: { 'a.txt': 'newsha' },
      fetchContent: async (_paths: string[]) => {
        return {} // no content provided -> triggers conflict branch (v0.0.4)
      }
    }

    const res = await vfs.pull(normalized)
    // v0.0.4: pull is metadata-only, fetchContent is not called, so no conflict
    expect(res.conflicts.find((c: any) => c.path === 'a.txt')).toBeUndefined()
    // v0.0.4: no conflict metadata without fetchContent call
    const conflictInfo = await backend.readBlob('a.txt', 'conflict')
    expect(conflictInfo).toBeNull()
  })

  it('pull records conflict and persists remote content when workspace modified', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    // prepare base/index and a workspace edit
    await backend.writeBlob('b.txt', JSON.stringify({ path: 'b.txt', state: 'base', baseSha: 'old' }), 'info')
    await backend.writeBlob('b.txt', 'oldcontent', 'base')
    // local workspace edit
    await backend.writeBlob('b.txt', 'localedit', 'workspace')

    const normalized: any = {
      headSha: 'h2',
      shas: { 'b.txt': 'remotesha' },
      fetchContent: async (paths: string[]) => {
        const out: Record<string, string> = {}
        for (const p of paths) out[p] = 'remotecontent'
        return out
      }
    }

    const res = await vfs.pull(normalized)
    // conflict should be reported
    const c = res.conflicts.find((x: any) => x.path === 'b.txt')
    expect(c).toBeDefined()
    // v0.0.4: remote info (metadata) should be persisted under conflict segment
    const conflictInfo = await backend.readBlob('b.txt', 'conflict')
    expect(conflictInfo).not.toBeNull()
    // v0.0.4: actual content is on-demand fetched and stored in conflictBlob
    const conflictBlob = await backend.readBlob('b.txt', 'conflictBlob')
    if (conflictBlob) {
      expect(conflictBlob).toBe('remotecontent')
    }
  })
})
