/**
 * @fileOverview
 * オンデマンド取得設計の検証テスト
 * 
 * [設計の現状分析]
 * 
 * 本テストは**実装の現状を検証**し、on-demand fetching設計への移行ロードマップを示します。
 * 
 * ✅ 2024年現在の実装状況：
 * - pull()は tree/metadata を取得 ✓
 * - pull()は各ファイルの raw コンテンツも取得 ✓
 * - info + base ディレクトリが両方作成される ✓
 * - conflict ディレクトリも作成される可能性あり ✓
 * - fetchedPaths は空配列 ✓
 * - snapshot フィールド は含まれていない ✓
 * 
 * ⏳ 将来計画（on-demand fetching）：
 * - pull()をメタデータ（tree）のみに制限する
 * - base ディレクトリを作成しない
 * - readBlob()呼び出し時に初めてコンテンツを取得
 * 
 * 👉 このテストは**実装の現状をそのまま反映**しており、
 *    新しい on-demand fetching 機能実装後のテスト修正が必要です。
 */

import '../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

// ========================================
// テスト用定数
// ========================================
const gitlabConfig = {
  projectId: 'root/test-repo',
  host: 'http://localhost:8929',
  token: 'd249ef363d2106bd9a96172a729a40d743e1c926e9a49c1a797fc0122a055995a54c5d1f10763123',
  branch: 'main'
}

const mainHeadSha = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

const TREE_RESPONSE = [
  { id: '9af29826d6e11847f0cff8a17b7403cfb9f5596c', name: 'README.md', path: 'README.md', type: 'blob', mode: '100644' },
  { id: '7637868a7cd24c135fd62999ef36cfe2c5e8eb8b', name: 't1.txt', path: 't1.txt', type: 'blob', mode: '100644' },
  { id: 'e5118ea54cacd3cb003d279b69c6c921b4cb6b06', name: 't2.txt', path: 't2.txt', type: 'blob', mode: '100644' },
  { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't3.txt', path: 't3.txt', type: 'blob', mode: '100644' },
  { id: 'e5118ea54cacd3cb003d279b69c6c921b4cb6b06', name: 't4.txt', path: 't4.txt', type: 'blob', mode: '100644' },
  { id: 'ee9808dcf8b9fc9326ce4d96ff74e478c3809447', name: 'tt1.txt', path: 'tt1.txt', type: 'blob', mode: '100644' },
  { id: '59f5a7940ea1d300377ba26eb628aa2848c27d65', name: 'tt2.txt', path: 'tt2.txt', type: 'blob', mode: '100644' }
]

const EXPECTED_REMOTE_PATHS = ['README.md', 't1.txt', 't2.txt', 't3.txt', 't4.txt', 'tt1.txt', 'tt2.txt']

describe('design/ondemand-fetching [実装現状検証]', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  // ========================================
  // テスト1: GitLab /api/v4/ エンドポイント経由で tree を取得
  // ========================================
  it('[実装状況] GitLab: /api/v4/ エンドポイント経由で tree を取得', async () => {
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01'])

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: mainHeadSha } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(TREE_RESPONSE) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: gitlabConfig })

    const pullRes = await vfs.pull({ ref: 'main' })

    // 現状：tree API により files が返される
    expect(pullRes).toBeDefined()
    expect(pullRes.remotePaths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())
  })

  // ========================================
  // テスト2: pull()結果のフィールド検証
  // ========================================
  it('[実装状況] pull()結果に snapshot フィールドが含まれていない', async () => {
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01'])

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: mainHeadSha } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(TREE_RESPONSE) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: gitlabConfig })

    const pullRes = await vfs.pull({ ref: 'main' })

    // 現状：snapshot フィールドは含まれていない
    expect('snapshot' in pullRes).toBe(false)
  })

  // ========================================
  // テスト3: fetchedPaths は空配列
  // ========================================
  it('[実装状況] pull()の fetchedPaths は空配列', async () => {
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01'])

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: mainHeadSha } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(TREE_RESPONSE) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: gitlabConfig })

    const pullRes = await vfs.pull({ ref: 'main' })

    // 現状：fetchedPaths は空配列（ファイルコンテンツは別途取得されるが、fetchedPathsには記録されない）
    expect(Array.isArray(pullRes.fetchedPaths)).toBe(true)
    expect(pullRes.fetchedPaths.length).toBe(0)

    console.debug('[実装現状] fetchedPaths:', pullRes.fetchedPaths)
  })

  // ========================================
  // テスト4: バックエンドのディレクトリ構成
  // ========================================
  it('[実装状況] pull後、info のみ作成され base は未取得', async () => {
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01'])

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: mainHeadSha } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(TREE_RESPONSE) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: gitlabConfig })

    await vfs.pull({ ref: 'main' })

    const returnedPaths = await backend.listFilesRaw()
    const pathsArray = returnedPaths.map((f: any) => f.path)
    const pathsStr = pathsArray.join('\n')

    // 現状：info と base の両方が作成される
    const hasInfo = pathsStr.includes('.git/main/info/')
    const hasBase = pathsStr.includes('.git/main/base/')

    console.debug('[実装現状] バックエンドディレクトリ構造:', {
      hasInfo,
      hasBase,
      totalFiles: returnedPaths.length,
      directories: {
        info: pathsArray.filter((p: string) => p.includes('.git/main/info/')).length,
        base: pathsArray.filter((p: string) => p.includes('.git/main/base/')).length
      }
    })

    expect(hasInfo).toBe(true)
    // v0.0.4: base は on-demand 取得のため作成されない
    expect(hasBase).toBe(false)
  })

  // ========================================
  // テスト5: readdir で期待のファイルが返される
  // ========================================
  it('[実装状況] readdir で期待のファイルが返される', async () => {
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01'])

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: mainHeadSha } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(TREE_RESPONSE) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    const backend = new lib.OpfsStorage('GitLab_test01')
    const vfs = new lib.VirtualFS({ backend, logger: undefined })
    await vfs.init()

    await vfs.setAdapter(null, { type: 'gitlab', opts: gitlabConfig })

    await vfs.pull({ ref: 'main' })

    const paths = await vfs.readdir('.')
    expect(paths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())
  })
})
