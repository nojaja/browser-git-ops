/**
 * @file GitLabAdapter._fetchTreeAndBuildShas ページネーション対応テスト
 * @see docs/spec/v0.0.8/tree-api-pagination-design.md §4.1, §6.1
 *
 * 設計書の要件:
 * - `_fetchTreeAndBuildShas` は `per_page=100` で全ページを取得するまでループする
 * - `x-next-page` ヘッダでループ継続/停止を判定する
 * - 既存の `_parsePagingHeaders` を再利用する
 */
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import GitLabAdapter from '../../../../src/git/gitlabAdapter'

/** Helper: GitLab tree entry を生成 */
function makeTreeEntry(index: number, type: 'blob' | 'tree' = 'blob') {
  return {
    id: `sha-${String(index).padStart(4, '0')}`,
    name: `file${index}`,
    type,
    path: type === 'blob' ? `dir/file${index}.txt` : `dir/subdir${index}`,
    mode: type === 'blob' ? '100644' : '040000',
  }
}

/** Helper: N 個の blob エントリ配列を生成 */
function makeBlobEntries(count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => makeTreeEntry(offset + i, 'blob'))
}

/** 40文字の hex SHA を生成 */
const FAKE_HEAD_SHA = 'a'.repeat(40)

/**
 * fetchSnapshot 経由で _fetchTreeAndBuildShas を呼び出す。
 * _determineHeadSha はすでに SHA 形式を渡すことでブランチ API をスキップさせる。
 */
async function callFetchSnapshot(adapter: GitLabAdapter) {
  return adapter.fetchSnapshot(FAKE_HEAD_SHA)
}

describe('GitLabAdapter tree pagination (v0.0.8)', () => {
  afterEach(() => {
    try { clearFetchMock() } catch (_) { /* empty */ }
  })

  // §6.1 テストケース1: 1ページ分のレスポンス（ファイル数 ≤ 100 件）
  it('1ページ分: x-next-page が空の場合、1回のリクエストで全件取得する', async () => {
    const entries = makeBlobEntries(5)
    const mock = configureFetchMock([
      {
        match: /repository\/tree/,
        response: {
          status: 200,
          body: JSON.stringify(entries),
          headers: {
            'x-next-page': '',
            'x-total-pages': '1',
          },
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    // 5件すべてが shas に含まれること
    expect(Object.keys(result.shas)).toHaveLength(5)
    for (const e of entries) {
      expect(result.shas[e.path]).toBe(e.id)
    }

    // tree API は1回だけ呼ばれること
    const treeCalls = (mock as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('repository/tree')
    )
    expect(treeCalls).toHaveLength(1)

    // per_page=100 が含まれること
    expect(treeCalls[0][0]).toContain('per_page=100')
  })

  // §6.1 テストケース2: 複数ページのレスポンス（2ページ）
  it('2ページ: x-next-page=2 で2回リクエストし結果をマージする', async () => {
    const page1 = makeBlobEntries(100, 0)
    const page2 = makeBlobEntries(30, 100)
    let callCount = 0

    configureFetchMock([
      {
        match: /repository\/tree/,
        response: () => {
          callCount++
          if (callCount === 1) {
            return {
              status: 200,
              body: JSON.stringify(page1),
              headers: { 'x-next-page': '2', 'x-total-pages': '2' },
            }
          }
          return {
            status: 200,
            body: JSON.stringify(page2),
            headers: { 'x-next-page': '', 'x-total-pages': '2' },
          }
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    // 130件すべてが shas に含まれること
    expect(Object.keys(result.shas)).toHaveLength(130)
    // page1 の最初
    expect(result.shas['dir/file0.txt']).toBe('sha-0000')
    // page2 の最後
    expect(result.shas['dir/file129.txt']).toBe('sha-0129')
  })

  // §6.1 テストケース3: 3ページ以上のレスポンス
  it('3ページ: 3回リクエストし結果をマージする', async () => {
    const page1 = makeBlobEntries(100, 0)
    const page2 = makeBlobEntries(100, 100)
    const page3 = makeBlobEntries(50, 200)
    let callCount = 0

    configureFetchMock([
      {
        match: /repository\/tree/,
        response: () => {
          callCount++
          if (callCount === 1) {
            return {
              status: 200,
              body: JSON.stringify(page1),
              headers: { 'x-next-page': '2', 'x-total-pages': '3' },
            }
          }
          if (callCount === 2) {
            return {
              status: 200,
              body: JSON.stringify(page2),
              headers: { 'x-next-page': '3', 'x-total-pages': '3' },
            }
          }
          return {
            status: 200,
            body: JSON.stringify(page3),
            headers: { 'x-next-page': '', 'x-total-pages': '3' },
          }
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    // 250件すべてが shas に含まれること
    expect(Object.keys(result.shas)).toHaveLength(250)
  })

  // §6.1 テストケース4: 空レスポンス（ファイル数 0 件）
  it('空レスポンス: 0件の場合、空の shas を返す', async () => {
    configureFetchMock([
      {
        match: /repository\/tree/,
        response: {
          status: 200,
          body: JSON.stringify([]),
          headers: { 'x-next-page': '', 'x-total-pages': '0' },
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    expect(Object.keys(result.shas)).toHaveLength(0)
  })

  // §6.1 テストケース5: x-next-page ヘッダなし
  it('x-next-page ヘッダなし: 1ページで停止する', async () => {
    const entries = makeBlobEntries(10)
    const mock = configureFetchMock([
      {
        match: /repository\/tree/,
        response: {
          status: 200,
          body: JSON.stringify(entries),
          headers: {},  // ヘッダなし
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    expect(Object.keys(result.shas)).toHaveLength(10)
    const treeCalls = (mock as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('repository/tree')
    )
    expect(treeCalls).toHaveLength(1)
  })

  // §6.1 テストケース6: tree + blob 混在
  it('tree + blob 混在: blob のみが fileSet に含まれる', async () => {
    const entries = [
      makeTreeEntry(0, 'blob'),
      makeTreeEntry(1, 'tree'),
      makeTreeEntry(2, 'blob'),
      makeTreeEntry(3, 'tree'),
      makeTreeEntry(4, 'blob'),
    ]

    configureFetchMock([
      {
        match: /repository\/tree/,
        response: {
          status: 200,
          body: JSON.stringify(entries),
          headers: { 'x-next-page': '', 'x-total-pages': '1' },
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    const result = await callFetchSnapshot(adapter)

    // blob は 3 つ（index 0, 2, 4）
    expect(Object.keys(result.shas)).toHaveLength(3)
    expect(result.shas['dir/file0.txt']).toBeDefined()
    expect(result.shas['dir/file2.txt']).toBeDefined()
    expect(result.shas['dir/file4.txt']).toBeDefined()
    // tree エントリは含まれない
    expect(result.shas['dir/subdir1']).toBeUndefined()
    expect(result.shas['dir/subdir3']).toBeUndefined()
  })

  // §6.1 テストケース7: ページネーション中のエラー（2ページ目で HTTP エラー）
  it('ページネーション中のエラー: 2ページ目で 500 エラーが発生すると reject される', async () => {
    // fetchWithRetry のリトライ（4回 × バックオフ）により時間がかかるため延長
    const page1 = makeBlobEntries(100, 0)
    let callCount = 0

    configureFetchMock([
      {
        match: /repository\/tree/,
        response: () => {
          callCount++
          if (callCount === 1) {
            return {
              status: 200,
              body: JSON.stringify(page1),
              headers: { 'x-next-page': '2', 'x-total-pages': '2' },
            }
          }
          // 2 ページ目以降は常に 500
          return { status: 500, body: 'Internal Server Error' }
        },
      },
    ])

    const adapter = new GitLabAdapter({ projectId: 'test/repo', token: 'tok' })
    await expect(callFetchSnapshot(adapter)).rejects.toThrow()
  }, 30000)
})
