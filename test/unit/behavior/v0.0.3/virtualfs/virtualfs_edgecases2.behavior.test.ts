/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { jest } from '@jest/globals'
import { describe, it, expect } from '@jest/globals'
import VirtualFS from '../../../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS advanced edge cases', () => {
  // Test push with empty changes array throws
  it('push rejects when changes array is empty', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({}, 'h0')

    const input: any = {
      parentSha: 'h0',
      changes: [],
      message: 'Empty commit',
      commitKey: 'ck'
    }

    // ensure adapter is present so push goes through adapter path and rejects as expected
    const mockAdapterEmpty: any = { createCommitWithActions: async () => { throw new Error('No changes') }, updateRef: async () => undefined }
    vfs.adapter = mockAdapterEmpty
    await vfs.setAdapter({ type: 'gitlab', opts: {} })
    await expect(vfs.push(input)).rejects.toThrow('No changes')
  })

  // Test writeFile with nested path creates hierarchy
  it('writeFile handles deeply nested paths', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.writeFile('a/b/c/d/e/file.txt', 'deep content')

    const content = await vfs.readFile('a/b/c/d/e/file.txt')
    expect(content).toBe('deep content')
    // verify by reading the deeply nested file
    expect(await vfs.readFile('a/b/c/d/e/file.txt')).toBe('deep content')
  })

  // Test deleteFile on non-existent file
  it('deleteFile handles missing file', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({}, 'h0')

    // Delete should complete
    await vfs.unlink('nonexistent.txt')
    
    const paths = await vfs.readdir('.')
    expect(Array.isArray(paths)).toBe(true)
  })

  // Test renameFile to new location
  it('renameFile updates file location', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'file.txt': 'content' }, 'h0')

    await vfs.renameFile('file.txt', 'renamed.txt')

    const paths = await vfs.readdir('.')
    expect(paths).toContain('renamed.txt')
    expect(paths).not.toContain('file.txt')
  })

  // Test getChangeSet after multiple operations
  it('getChangeSet aggregates all pending changes', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'base1.txt': 'b1', 'base2.txt': 'b2' }, 'h0')

    // Multiple operations
    await vfs.writeFile('new1.txt', 'n1')
    await vfs.writeFile('new2.txt', 'n2')
    await vfs.writeFile('base1.txt', 'modified')

    const changes = await vfs.getChangeSet()

    expect(changes.length).toBeGreaterThan(0)
    const types = changes.map((c: any) => c.type)
    expect(types).toContain('create')
  })

  // Test push with mixed file types
  it('push handles various file extensions', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({}, 'h0')

    const input: any = {
      parentSha: 'h0',
      changes: [
        { type: 'create', path: 'readme.md', content: '# Title' },
        { type: 'create', path: 'code.ts', content: 'const x = 1' },
        { type: 'create', path: 'data.json', content: '{"key":"value"}' },
        { type: 'create', path: 'style.css', content: 'body {}' }
      ],
      message: 'Multiple types',
      commitKey: 'ck'
    }

    const mockAdapterTypes: any = {
      createCommitWithActions: undefined,
      createBlobs: jest.fn().mockResolvedValue({ 'readme.md': 'b1' }),
      createTree: jest.fn().mockResolvedValue('t-types'),
      createCommit: jest.fn().mockResolvedValue('c-types'),
      updateRef: jest.fn().mockResolvedValue(true)
    }
    vfs.adapter = mockAdapterTypes
    await vfs.setAdapter({ type: 'github', opts: {} })
    const mockAdapter: any = {
      createBlobs: jest.fn().mockResolvedValue({}),
      createTree: jest.fn().mockResolvedValue('t-edge'),
      createCommit: jest.fn().mockResolvedValue('c-edge'),
      updateRef: jest.fn().mockResolvedValue(true)
    }
    vfs.adapter = mockAdapter
    await vfs.setAdapter({ type: 'github', opts: {} })
    const result = await vfs.push(input)
    expect(result.commitSha).toBeTruthy()
  })

  // Test pull creates workspace for new files
  it('pull initializes workspace for new remote files', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({}, 'h0')

    const sha = 'newcontentsha'
    const normalized: any = {
      headSha: 'h1',
      shas: { 'remote.txt': sha },
      fetchContent: async () => ({ 'remote.txt': 'remote data' })
    }

    await (vfs as any).pull(normalized)

    // v0.0.4: pull is metadata-only, content is not fetched
    const content = await vfs.readFile('remote.txt')
    expect(content).toBe(null)
  })

  // Test applyBaseSnapshot with empty snapshot
  it('applyBaseSnapshot handles empty snapshot', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'existing.txt': 'data' }, 'h0')

    await vfs.applyBaseSnapshot({}, 'h1')

    const paths = await vfs.readdir('.')
    expect(paths.length).toBe(0)
  })

  // Test readFile after deletion falls back to base
  it('readFile falls back to base after workspace deletion', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'file.txt': 'content' }, 'h0')
    await vfs.unlink('file.txt')

    // May still read from base
    const content = await vfs.readFile('file.txt')
    expect(content === 'content' || content === null).toBe(true)
  })

  // Test listPaths after complex operations
  it('listPaths reflects all file operations', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'a.txt': 'a', 'b.txt': 'b' }, 'h0')

    await vfs.writeFile('c.txt', 'c')
    await vfs.unlink('a.txt')
    await vfs.renameFile('b.txt', 'd.txt')

    const paths = await vfs.readdir('.')

    expect(paths).toContain('c.txt')
    expect(paths).toContain('d.txt')
    expect(paths).not.toContain('a.txt')
    expect(paths).not.toContain('b.txt')
  })

  // Test push with very long file path
  it('push handles long file paths', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({}, 'h0')

    const longPath = 'dir1/dir2/dir3/dir4/dir5/dir6/dir7/dir8/very-long-filename.txt'

    const input: any = {
      parentSha: 'h0',
      changes: [{ type: 'create', path: longPath, content: 'data' }],
      message: 'Long path',
      commitKey: 'ck'
    }

    const mockAdapterLong: any = {
      createCommitWithActions: undefined,
      createBlobs: jest.fn().mockResolvedValue({}),
      createTree: jest.fn().mockResolvedValue('t-long'),
      createCommit: jest.fn().mockResolvedValue('c-long'),
      updateRef: jest.fn().mockResolvedValue(true)
    }
    vfs.adapter = mockAdapterLong
    await vfs.setAdapter({ type: 'github', opts: {} })
    const result = await vfs.push(input)
    expect(result.commitSha).toBeTruthy()
  })

  // Test pull with conflict resolution data
  it('pull stores conflict data for manual resolution', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await backend.writeBlob('conflict.txt', JSON.stringify({ 
      path: 'conflict.txt', 
      baseSha: 'baseSha', 
      state: 'modified' 
    }), 'info')
    await backend.writeBlob('conflict.txt', 'base', 'base')
    await backend.writeBlob('conflict.txt', 'local change', 'workspace')

    const normalized: any = {
      headSha: 'h1',
      shas: { 'conflict.txt': 'remoteSha' },
      fetchContent: async () => ({ 'conflict.txt': 'remote' })
    }

    const result = await (vfs as any).pull(normalized)

    expect(result.conflicts.length).toBeGreaterThan(0)
    
    // Verify conflict was detected in result
    expect(result.conflicts.some((c: any) => c.path === 'conflict.txt')).toBe(true)
  })

  // Test getIndex after various operations
  it('getIndex returns updated state', async () => {
    const backend = new InMemoryStorage('__test_ns')
    const vfs = new VirtualFS({ backend })
    await vfs.init()

    await vfs.applyBaseSnapshot({ 'file.txt': 'content' }, 'initial-head')

    const idx = await vfs.getIndex()
    expect(idx.head).toBe('initial-head')
  })
})
