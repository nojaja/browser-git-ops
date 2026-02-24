/**
 * @file GitHubAdapter._buildFileMapFromHead truncated 検知テスト
 * @see docs/spec/v0.0.8/tree-api-pagination-design.md §4.2, §6.2
 *
 * 設計書の要件:
 * - `truncated: true` の場合、logWarn でワーニングを出力する
 * - 取得分のファイルは正常に返される
 * - `truncated: false` / 未定義 の場合、既存動作と同一
 */
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import GitHubAdapter from '../../../../src/git/githubAdapter'

/** 40文字の hex SHA を生成 */
const FAKE_HEAD_SHA = 'b'.repeat(40)

/** Helper: GitHub tree entry を生成 */
function makeGithubTreeEntry(index: number, type: 'blob' | 'tree' = 'blob') {
  return {
    path: type === 'blob' ? `src/file${index}.ts` : `src/dir${index}`,
    mode: type === 'blob' ? '100644' : '040000',
    type,
    size: 100,
    sha: `sha${String(index).padStart(6, '0')}`,
    url: `https://api.github.com/repos/owner/repo/git/blobs/sha${String(index).padStart(6, '0')}`,
  }
}

/** fetchSnapshot の呼び出し（_determineHeadSha をスキップさせるために refs API をモック） */
function setupRefsMock() {
  return [
    // getRef (heads/) → refs API
    {
      match: /git\/refs\/heads/,
      response: {
        status: 200,
        body: JSON.stringify({ object: { sha: FAKE_HEAD_SHA } }),
      },
    },
    // getRef (tags/) → 404
    {
      match: /git\/refs\/tags/,
      response: { status: 404, body: '' },
    },
    // getRef singular (ref/) → 404
    {
      match: /git\/ref\//,
      response: { status: 404, body: '' },
    },
  ]
}

describe('GitHubAdapter tree truncated detection (v0.0.8)', () => {
  afterEach(() => {
    try { clearFetchMock() } catch (_) { /* empty */ }
  })

  // §6.2 テストケース1: truncated: false（通常のレスポンス）
  it('truncated: false の場合、既存動作と同一で全ファイルが返される', async () => {
    const treeEntries = [
      makeGithubTreeEntry(0),
      makeGithubTreeEntry(1),
      makeGithubTreeEntry(2),
    ]

    configureFetchMock([
      ...setupRefsMock(),
      {
        match: /git\/trees\//,
        response: {
          status: 200,
          body: JSON.stringify({
            sha: FAKE_HEAD_SHA,
            tree: treeEntries,
            truncated: false,
          }),
        },
      },
    ])

    const adapter = new GitHubAdapter({ owner: 'test', repo: 'repo', token: 'tok' })
    const warnMessages: any[][] = []
    adapter.setLogger({
      debug: () => {},
      info: () => {},
      warn: (...args: any[]) => { warnMessages.push(args) },
      error: () => {},
    })

    const result = await adapter.fetchSnapshot('main')

    expect(Object.keys(result.shas)).toHaveLength(3)
    expect(result.shas['src/file0.ts']).toBe('sha000000')
    // ワーニングは出力されないこと
    const truncWarn = warnMessages.filter(m =>
      m.some(a => typeof a === 'string' && a.includes('truncated'))
    )
    expect(truncWarn).toHaveLength(0)
  })

  // §6.2 テストケース2: truncated: true（大規模リポジトリ）
  it('truncated: true の場合、ワーニングログが出力され取得分のファイルは返される', async () => {
    const treeEntries = [
      makeGithubTreeEntry(0),
      makeGithubTreeEntry(1),
    ]

    configureFetchMock([
      ...setupRefsMock(),
      {
        match: /git\/trees\//,
        response: {
          status: 200,
          body: JSON.stringify({
            sha: FAKE_HEAD_SHA,
            tree: treeEntries,
            truncated: true,
          }),
        },
      },
    ])

    const adapter = new GitHubAdapter({ owner: 'test', repo: 'repo', token: 'tok' })
    const warnMessages: any[][] = []
    adapter.setLogger({
      debug: () => {},
      info: () => {},
      warn: (...args: any[]) => { warnMessages.push(args) },
      error: () => {},
    })

    const result = await adapter.fetchSnapshot('main')

    // 取得分のファイルは返されること
    expect(Object.keys(result.shas)).toHaveLength(2)
    expect(result.shas['src/file0.ts']).toBe('sha000000')
    expect(result.shas['src/file1.ts']).toBe('sha000001')

    // ワーニングログが出力されること
    const truncWarn = warnMessages.filter(m =>
      m.some(a => typeof a === 'string' && a.includes('truncated'))
    )
    expect(truncWarn.length).toBeGreaterThanOrEqual(1)
  })

  // §6.2 テストケース3: truncated 未定義（旧 API 互換）
  it('truncated 未定義の場合、既存動作と同一であること', async () => {
    const treeEntries = [
      makeGithubTreeEntry(0),
      makeGithubTreeEntry(1),
      makeGithubTreeEntry(2),
      makeGithubTreeEntry(3),
    ]

    configureFetchMock([
      ...setupRefsMock(),
      {
        match: /git\/trees\//,
        response: {
          status: 200,
          body: JSON.stringify({
            sha: FAKE_HEAD_SHA,
            tree: treeEntries,
            // truncated フィールドなし
          }),
        },
      },
    ])

    const adapter = new GitHubAdapter({ owner: 'test', repo: 'repo', token: 'tok' })
    const warnMessages: any[][] = []
    adapter.setLogger({
      debug: () => {},
      info: () => {},
      warn: (...args: any[]) => { warnMessages.push(args) },
      error: () => {},
    })

    const result = await adapter.fetchSnapshot('main')

    expect(Object.keys(result.shas)).toHaveLength(4)
    // ワーニングは出力されないこと
    const truncWarn = warnMessages.filter(m =>
      m.some(a => typeof a === 'string' && a.includes('truncated'))
    )
    expect(truncWarn).toHaveLength(0)
  })
})
