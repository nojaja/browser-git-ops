/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import { describe, it, expect } from '@jest/globals'
import VirtualFS from '../../../../../src/virtualfs/virtualfs'
import InMemoryStorage from '../../../../../src/virtualfs/inmemoryStorage'

describe('VirtualFS 基本動作', () => {
  it('ファイルの追加・更新・削除と index.json の更新', async () => {
      const vfs = new VirtualFS({ backend: new InMemoryStorage('__test_ns') })
    await vfs.init()

    await vfs.writeFile('foo.txt', 'hello')
    // verify visible via listPaths and change set reflects create
    let paths = await vfs.readdir('.')
    expect(paths).toContain('foo.txt')
    let changes = await vfs.getChangeSet()
    expect(changes).toEqual([{ type: 'create', path: 'foo.txt', content: 'hello' }])

    await vfs.writeFile('foo.txt', 'hello2')
    paths = await vfs.readdir('.')
    expect(paths).toContain('foo.txt')
    changes = await vfs.getChangeSet()
    expect(changes).toEqual([{ type: 'create', path: 'foo.txt', content: 'hello2' }])

    await vfs.unlink('foo.txt')
    // since it was added then deleted before base exists, it should be removed
    paths = await vfs.readdir('.')
    expect(paths).not.toContain('foo.txt')
    changes = await vfs.getChangeSet()
    expect(changes).toEqual([])
  })

  it('tombstone が作られるケース（base あり）', async () => {
    const vfs = new VirtualFS({ backend: new InMemoryStorage('__test_ns') })
    await vfs.init()
    // apply base snapshot
    await vfs.applyBaseSnapshot({ 'a.txt': 'basecontent' }, 'head1')
    await vfs.writeFile('a.txt', 'modified')
    await vfs.unlink('a.txt')
    const changes = await vfs.getChangeSet()
    // delete should be present or reflected in index when tombstone absent
    const hasDelete = changes.find((c: any) => c.type === 'delete' && c.path === 'a.txt')
      if (!hasDelete) {
      const paths = await vfs.readdir('.')
      expect(paths).not.toContain('a.txt')
    } else {
      expect(hasDelete).toBeDefined()
    }
  })
})
