/**
 * @test-type behavior
 * @purpose Requirement or design guarantee (v0.0.4)
 * @policy DO NOT MODIFY
 */

import { VirtualFS } from '../../../../../src/virtualfs/virtualfs'
import { InMemoryStorage } from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS push behavior (v0.0.4)', () => {
  let backend: any
  let vfs: any

  beforeEach(async () => {
    backend = new (InMemoryStorage as any)('push-tests-v004')
    vfs = new VirtualFS({ backend })
    await vfs.init()
  })

  it('push throws when getAdapterInstance() fails', async () => {
    // simulate getAdapterInstance throwing
    ;(vfs as any).getAdapterInstance = async () => { throw new Error('adapter failure') }
    await expect((vfs as any).push({ message: 'm', changes: [], parentSha: 'p' })).rejects.toThrow('adapter failure')
  })

  it('push uses index.head when parentSha is not provided', async () => {
    // set current head
    vfs.head = 'head-from-index'

    let receivedParent: any = undefined
    const adapter = {
      createCommitWithActions: async (_branch: string, _message: string, changes: any[], parentSha: any) => {
        receivedParent = parentSha
        return 'commit-from-adapter'
      },
      updateRef: async (_: string, __: string) => undefined
    }

    // ensure getAdapterInstance returns our adapter
    ;(vfs as any).getAdapterInstance = async () => adapter

    // call push without parentSha
    const res = await (vfs as any).push({ message: 'm', changes: [], commitKey: 'k' })
    expect(res.commitSha).toBe('commit-from-adapter')
    expect(receivedParent).toBe('head-from-index')
    expect(vfs.head).toBe('commit-from-adapter')
  })

  it('push uses getChangeSet() when changes not provided', async () => {
    const mockChangeSet = [{ type: 'create', path: 'x', content: 'C' }]
    // stub public getChangeSet to return our mock
    ;(vfs as any).getChangeSet = async () => mockChangeSet

    let receivedChanges: any = undefined
    const adapter = {
      createCommitWithActions: async (_branch: string, _message: string, changes: any[], _parentSha: any) => {
        receivedChanges = changes
        return 'commit-changes'
      },
      updateRef: async (_: string, __: string) => undefined
    }
    ;(vfs as any).getAdapterInstance = async () => adapter

    const res = await (vfs as any).push({ message: 'm2', parentSha: 'p2', commitKey: 'k2' })
    expect(res.commitSha).toBe('commit-changes')
    expect(receivedChanges).toEqual(mockChangeSet)
    expect(vfs.head).toBe('commit-changes')
  })
})
