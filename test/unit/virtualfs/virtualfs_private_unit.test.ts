import { jest } from '@jest/globals'
import VirtualFS from '../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS private helpers', () => {
  const vfs = new VirtualFS({ backend: new InMemoryStorage() }) as any

  it('_isNonFastForwardError recognizes 422 and phrases', () => {
    expect(vfs._isNonFastForwardError('422')).toBe(true)
    expect(vfs._isNonFastForwardError(new Error('not a fast forward'))).toBe(true)
    expect(vfs._isNonFastForwardError('some other')).toBe(false)
  })

  it('_isEntryConsidered rules', () => {
    expect(vfs._isEntryConsidered({ state: 'modified' })).toBe(true)
    expect(vfs._isEntryConsidered({ state: 'conflict' })).toBe(true)
    expect(vfs._isEntryConsidered({ workspaceSha: 'a', state: 'x' })).toBe(true)
    expect(vfs._isEntryConsidered({ state: 'added' })).toBe(false)
  })

  it('_changesFromIndexEntry returns correct change lists', () => {
    const fn = vfs._changesFromIndexEntry.bind(vfs)
    // added but no blob -> empty
    expect(fn({ state: 'added' }, 'p', null)).toEqual([])
    // added with blob -> create
    expect(fn({ state: 'added' }, 'p', 'b')).toEqual([{ type: 'create', path: 'p', content: 'b' }])
    // modified with baseSha and blob -> update
    expect(fn({ state: 'modified', baseSha: 'x' }, 'p', 'c')).toEqual([{ type: 'update', path: 'p', content: 'c', baseSha: 'x' }])
    // modified without baseSha but with blob -> create
    expect(fn({ state: 'modified' }, 'p', 'd')).toEqual([{ type: 'create', path: 'p', content: 'd' }])
    // entry not considered -> empty
    expect(fn({ state: 'added' }, 'p', null)).toEqual([])
  })
})
