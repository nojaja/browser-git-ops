import '../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

describe('OpfsStorage + GitLab pull', () => {
  // 期待値は const で定義
  const EXPECTED_REMOTE_PATHS = [
    'README.md', 't1.txt', 't2.txt', 't3.txt', 't4.txt', 'tt1.txt', 'tt2.txt'
  ]

  // Expected raw URIs/paths (use const values defined here)
  const EXPECTED_FILES_RAW = [
    'GitLab_test01/index',
    'GitLab_test01/.git/main/info/tt2.txt',
    'GitLab_test01/.git/main/info/tt1.txt',
    'GitLab_test01/.git/main/info/t4.txt',
    'GitLab_test01/.git/main/info/t3.txt',
    'GitLab_test01/.git/main/info/t2.txt',
    'GitLab_test01/.git/main/info/t1.txt',
    'GitLab_test01/.git/main/info/README.md'
  ]
  // v0.0.4では編集のタイミング以外ではinfoのみ取得となったため
  // 下記がraw URIs/pathsに存在しない事を確認する
  const NOT_EXPECTED_FILES_RAW = [
    'GitLab_test01/.git/main/base/tt2.txt',
    'GitLab_test01/.git/main/base/tt1.txt',
    'GitLab_test01/.git/main/base/t4.txt',
    'GitLab_test01/.git/main/base/t3.txt',
    'GitLab_test01/.git/main/base/t2.txt',
    'GitLab_test01/.git/main/base/t1.txt',
    'GitLab_test01/.git/main/base/README.md'
  ]

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

  it('pulls from GitLab and backend reflects the same paths (readdir & listFilesRaw)', async () => {
    // mock fetch to simulate GitLab API
    const branchJson = { name: 'main', commit: { id: '25a5767c9cd5d1fd235cf359c92dec1957369060' } }

    const treeJson = [
      { id: '9af29826d6e11847f0cff8a17b7403cfb9f5596c', name: 'README.md', type: 'blob', path: 'README.md' },
      { id: '7637868a7cd24c135fd62999ef36cfe2c5e8eb8b', name: 't1.txt', type: 'blob', path: 't1.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't2.txt', type: 'blob', path: 't2.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't3.txt', type: 'blob', path: 't3.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't4.txt', type: 'blob', path: 't4.txt' },
      { id: 'd6d2f13a2ed121d421a912680d9174bca9e5d44b', name: 'tt1.txt', type: 'blob', path: 'tt1.txt' },
      { id: 'ee9808dcf8b9fc9326ce4d96ff74e478c3809447', name: 'tt2.txt', type: 'blob', path: 'tt2.txt' }
    ]

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't4.txt': 'hello-4',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    // configure fetch mock via helper with declarative entries
    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify(branchJson) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    // ①OpfsStorageのインスタンス作成
    const backend = new lib.OpfsStorage('GitLab_test01')
    const currentVfs = new lib.VirtualFS({ backend, logger: undefined })
    await currentVfs.init()

    // ②gitlabの接続設定追加  
    await currentVfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'aaaaaaaaa', branch: 'main' } })

    // ③初回のリポジトリアクセス
    const res = await currentVfs.pull()

    // ④readdir 結果確認
    const paths = await currentVfs.readdir('.')
    expect(paths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())

    // ⑤ listFilesRaw 確認
    const filesRaw = await backend.listFilesRaw()
    const returned = filesRaw.map((f: any) => f.path)
    expect(returned.slice().sort()).toEqual(EXPECTED_FILES_RAW.slice().sort())
    //NOT_EXPECTED_FILES_RAWに含まれるパスが存在しない事を確認
    for (const p of NOT_EXPECTED_FILES_RAW) {
      expect(returned.includes(p)).toBeFalsy()
    }

  })
})
