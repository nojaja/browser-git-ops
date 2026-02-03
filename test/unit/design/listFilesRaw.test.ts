import { jest } from '@jest/globals'
import * as lib from '../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

// 期待値はconstで定義
const EXPECTED_REMOTE_PATHS = [
  'tt2.txt','tt1.txt','t5.txt','t3.txt','t2.txt','t1.txt','README.md'
]

const EXPECTED_FILES_AFTER_DELETE = [
  'GitLab_test01/workspace/info/t5.txt',
  'GitLab_test01/index',
  'GitLab_test01/.git/main/info/tt2.txt',
  'GitLab_test01/.git/main/info/tt1.txt',
  'GitLab_test01/.git/main/info/t5.txt',
  'GitLab_test01/.git/main/info/t3.txt',
  'GitLab_test01/.git/main/info/t2.txt',
  'GitLab_test01/.git/main/info/t1.txt',
  'GitLab_test01/.git/main/info/README.md',
  'GitLab_test01/.git/main/base/tt2.txt',
  'GitLab_test01/.git/main/base/tt1.txt',
  'GitLab_test01/.git/main/base/t5.txt',
  'GitLab_test01/.git/main/base/t3.txt',
  'GitLab_test01/.git/main/base/t2.txt',
  'GitLab_test01/.git/main/base/t1.txt',
  'GitLab_test01/.git/main/base/README.md'
]

const EXPECTED_FILES_AFTER_RESTORE = [
  'GitLab_test01/index',
  'GitLab_test01/.git/main/info/tt2.txt',
  'GitLab_test01/.git/main/info/tt1.txt',
  'GitLab_test01/.git/main/info/t5.txt',
  'GitLab_test01/.git/main/info/t3.txt',
  'GitLab_test01/.git/main/info/t2.txt',
  'GitLab_test01/.git/main/info/t1.txt',
  'GitLab_test01/.git/main/info/README.md',
  'GitLab_test01/.git/main/base/tt2.txt',
  'GitLab_test01/.git/main/base/tt1.txt',
  'GitLab_test01/.git/main/base/t5.txt',
  'GitLab_test01/.git/main/base/t3.txt',
  'GitLab_test01/.git/main/base/t2.txt',
  'GitLab_test01/.git/main/base/t1.txt',
  'GitLab_test01/.git/main/base/README.md'
]

const EXPECTED_AFTER_DELETE_PATHS = [
  'tt2.txt','tt1.txt','t3.txt','t2.txt','t1.txt','README.md'
]

const EXPECTED_AFTER_RESTORE_PATHS = [
  'tt2.txt','tt1.txt','t5.txt','t3.txt','t2.txt','t1.txt','README.md'
]

describe('design/listFilesRaw', () => {
  beforeEach( async () => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach( async () => {
    jest.resetAllMocks();
    clearFetchMock();
    resetMockOPFS();
  })

  it('listFilesRaw の path 値が期待どおりであること', async () => {
    // OpfsStorage.availableRoots() が返す値をモック
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockReturnValue(['GitLab_test01']);

    const treeJson = [
      { id: '9af29826d6e11847f0cff8a17b7403cfb9f5596c', name: 'README.md', type: 'blob', path: 'README.md' },
      { id: '7637868a7cd24c135fd62999ef36cfe2c5e8eb8b', name: 't1.txt', type: 'blob', path: 't1.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't2.txt', type: 'blob', path: 't2.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't3.txt', type: 'blob', path: 't3.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't5.txt', type: 'blob', path: 't5.txt' },
      { id: 'd6d2f13a2ed121d421a912680d9174bca9e5d44b', name: 'tt1.txt', type: 'blob', path: 'tt1.txt' },
      { id: 'ee9808dcf8b9fc9326ce4d96ff74e478c3809447', name: 'tt2.txt', type: 'blob', path: 'tt2.txt' }
    ]

    const fileContents: Record<string,string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't5.txt': 'hello-5',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    // configure fetch mock via helper with declarative entries
    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: '0437a3a7ad2664deb12da00c5a4167e8c4455e6b' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    // ①OpfsStorageのインスタンス作成
    const backend = new lib.OpfsStorage('GitLab_test01')
    const currentVfs = new lib.VirtualFS({ backend, logger: undefined })
    await currentVfs.init()

    // ②gitlabの接続設定追加
    await currentVfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: '******', branch: 'main' } })

    // ③初回のリポジトリアクセス
    const pullRes = await currentVfs.pull()
    expect(pullRes).toBeDefined()
    expect(pullRes.remotePaths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())

    // ④listPaths 結果確認
    const paths = await currentVfs.listPaths()
    expect(paths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())

    // ⑤ファイルの削除 (t5.txt)
    await currentVfs.deleteFile('t5.txt')

    // ⑥ listPaths 結果変化確認 (t5.txt が消えていることは listPaths の順序維持で確認)
    const pathsAfterDelete = await currentVfs.listPaths();
    expect(pathsAfterDelete.slice().sort()).toEqual(EXPECTED_AFTER_DELETE_PATHS.slice().sort());

    // ⑦ backend.listFilesRaw の結果検証 (path 値の配列を抽出して比較)
    const filesRaw = await backend.listFilesRaw();
    const pathsFromFilesRaw = filesRaw.map((f: any) => f.path);
    expect(pathsFromFilesRaw.sort()).toEqual(EXPECTED_FILES_AFTER_DELETE.slice().sort())

    // ⑧ 削除を元に戻す
    await backend.deleteBlob('t5.txt', 'workspace');

    // ⑨ listPaths 再確認
    const pathsAfterRestore = await currentVfs.listPaths();
    expect(pathsAfterRestore.slice().sort()).toEqual(EXPECTED_AFTER_RESTORE_PATHS.slice().sort());

    // ⑩ listFilesRaw 再確認
    const filesRaw2 = await backend.listFilesRaw();
    const pathsFromFilesRaw2 = filesRaw2.map((f: any) => f.path);
    expect(pathsFromFilesRaw2.slice().sort()).toEqual(EXPECTED_FILES_AFTER_RESTORE.slice().sort());
  });
});

describe('OpfsStorage.listFilesRaw - paths match expected constants', () => {

  const expectedFilesRawBeforeDelete = [
    'GitLab_test01/index',
    'GitLab_test01/.git/main/info/tt2.txt',
    'GitLab_test01/.git/main/info/tt1.txt',
    'GitLab_test01/.git/main/info/t5.txt',
    'GitLab_test01/.git/main/info/t3.txt',
    'GitLab_test01/.git/main/info/t2.txt',
    'GitLab_test01/.git/main/info/t1.txt',
    'GitLab_test01/.git/main/info/README.md',
    'GitLab_test01/.git/main/base/tt2.txt',
    'GitLab_test01/.git/main/base/tt1.txt',
    'GitLab_test01/.git/main/base/t5.txt',
    'GitLab_test01/.git/main/base/t3.txt',
    'GitLab_test01/.git/main/base/t2.txt',
    'GitLab_test01/.git/main/base/t1.txt',
    'GitLab_test01/.git/main/base/README.md'
  ] as const

  const expectedFilesRawAfterDelete = [
    'GitLab_test01/workspace/info/t5.txt',
    'GitLab_test01/index',
    'GitLab_test01/.git/main/info/tt2.txt',
    'GitLab_test01/.git/main/info/tt1.txt',
    'GitLab_test01/.git/main/info/t5.txt',
    'GitLab_test01/.git/main/info/t3.txt',
    'GitLab_test01/.git/main/info/t2.txt',
    'GitLab_test01/.git/main/info/t1.txt',
    'GitLab_test01/.git/main/info/README.md',
    'GitLab_test01/.git/main/base/tt2.txt',
    'GitLab_test01/.git/main/base/tt1.txt',
    'GitLab_test01/.git/main/base/t5.txt',
    'GitLab_test01/.git/main/base/t3.txt',
    'GitLab_test01/.git/main/base/t2.txt',
    'GitLab_test01/.git/main/base/t1.txt',
    'GitLab_test01/.git/main/base/README.md'
  ] as const

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterEach(async () => {
    try { await (lib as any).OpfsStorage.delete('GitLab_test01') } catch (e) { console.error('[afterEach] OpfsStorage.delete error:', e) }
    try { clearFetchMock() } catch (e) { console.error('[afterEach] clearFetchMock error:', e) }
    jest.resetAllMocks();
  })

  it('follows the scenario and listFilesRaw returns expected path values', async () => {
    // Remote tree and files
    const treeJson = [
      { id: '9af29826d6e11847f0cff8a17b7403cfb9f5596c', name: 'README.md', type: 'blob', path: 'README.md' },
      { id: '7637868a7cd24c135fd62999ef36cfe2c5e8eb8b', name: 't1.txt', type: 'blob', path: 't1.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't2.txt', type: 'blob', path: 't2.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't3.txt', type: 'blob', path: 't3.txt' },
      { id: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0', name: 't5.txt', type: 'blob', path: 't5.txt' },
      { id: 'd6d2f13a2ed121d421a912680d9174bca9e5d44b', name: 'tt1.txt', type: 'blob', path: 'tt1.txt' },
      { id: 'ee9808dcf8b9fc9326ce4d96ff74e478c3809447', name: 'tt2.txt', type: 'blob', path: 'tt2.txt' }
    ]

    const fileContents: Record<string,string> = {
      'README.md': '# test-repo\n',
      't1.txt': 'hello-1',
      't2.txt': 'hello-2',
      't3.txt': 'hello-3',
      't5.txt': 'hello-5',
      'tt1.txt': 'x',
      'tt2.txt': 'y'
    }

    // configure fetch mock via helper with declarative entries
    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: '0437a3a7ad2664deb12da00c5a4167e8c4455e6b' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } },
    ])

    // ①OpfsStorageのインスタンス作成
    const backend = new lib.OpfsStorage('GitLab_test01')
    const currentVfs = new lib.VirtualFS({ backend, logger: undefined })
    await currentVfs.init()

    // ②gitlabの接続設定追加
    await currentVfs.setAdapter(null, { type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: '******', branch: 'main' } })

    // ③初回のリポジトリアクセス
    const pullRes = await currentVfs.pull()
    expect(pullRes).toBeDefined()
    expect(pullRes.remotePaths.slice().sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())

    // ④listPaths 結果確認
    const paths = await currentVfs.listPaths()
    expect(paths.sort()).toEqual(EXPECTED_REMOTE_PATHS.slice().sort())

    // ⑤ listFilesRaw before delete
    const filesRawBefore = await backend.listFilesRaw()
    const returnedPathsBefore = filesRawBefore.map((f:any) => f.path).sort()
    expect(returnedPathsBefore).toEqual(expectedFilesRawBeforeDelete.slice().sort())

    // ⑥ファイルの削除 (t5.txt)
    await currentVfs.deleteFile('t5.txt')

    // ⑦ getChangeSet contains delete
    const changes = await currentVfs.getChangeSet()
    expect(changes).toEqual(expect.arrayContaining([{ type: 'delete', path: 't5.txt', baseSha: expect.any(String) }]))

    // ⑧ listPaths after delete
    const pathsAfterDelete = await currentVfs.listPaths()
    expect(pathsAfterDelete.sort()).toEqual(['tt2.txt','tt1.txt','t3.txt','t2.txt','t1.txt','README.md'].sort())

    // ⑨ listFilesRaw after delete
    const filesRawAfter = await backend.listFilesRaw()
    const returnedPathsAfter = filesRawAfter.map((f:any) => f.path).sort()
    expect(returnedPathsAfter).toEqual(expectedFilesRawAfterDelete.slice().sort())
  })
})
