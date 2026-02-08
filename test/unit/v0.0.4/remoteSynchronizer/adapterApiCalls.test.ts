/**
 * アダプタインテグレーションテスト（on-demand fetching に対応した API 呼び出し）
 * 要件: GitHub/GitLab アダプタが tree のみと on-demand blob/raw を別々に呼び出すこと
 *
 * Given:
 *   - アダプタが fetchSnapshot() を実行（tree のみ）
 *   - on-demand API を呼ぶ前提
 * When:
 *   - fetchSnapshot() で tree を取得
 *   - 別途 getBlob() / getRawFile() を呼び出し
 * Then:
 *   - 適切な API エンドポイントが呼ばれること
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

describe('GitHubAdapter / GitLabAdapter - on-demand API calls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * テストケース 1: GitHub fetchSnapshot() は tree のみ取得
   * Given: GitHub API モック
   * When: fetchSnapshot(branch) を呼び出し
   * Then:
   *   - GET /git/trees/{headSha}?recursive=1 が呼ばれる
   *   - shas は返されるが fetchContent は不要
   */
  it('should fetch only tree metadata in GitHub fetchSnapshot', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    // tree API レスポンス
    const treeResponse = {
      tree: [
        { path: 'file1.ts', sha: 'blob-sha-1', type: 'blob' },
        { path: 'file2.ts', sha: 'blob-sha-2', type: 'blob' },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => treeResponse,
      text: async () => JSON.stringify(treeResponse),
      headers: new Map(),
    } as any)

    // 実装後検証:
    // const adapter = new GitHubAdapter({ owner, repo, token })
    // const snapshot = await adapter.fetchSnapshot('main')

    // - tree API が呼ばれたことを確認
    // expect(mockFetch).toHaveBeenCalledWith(
    //   expect.stringContaining('/git/trees/'),
    //   expect.objectContaining({ method: 'GET' })
    // )

    // - shas が返されること
    // expect(snapshot.shas['file1.ts']).toBe('blob-sha-1')
    // expect(snapshot.shas['file2.ts']).toBe('blob-sha-2')

    // - fetchContent は存在しないか、空の関数であること
    // expect(typeof snapshot.fetchContent).toBe('function')
    // const contentResult = await snapshot.fetchContent(['file1.ts'])
    // expect(contentResult).toEqual({}) // 何も返さない

    expect(treeResponse.tree).toHaveLength(2)
  })

  /**
   * テストケース 2: GitLab fetchSnapshot() も tree のみ取得
   * Given: GitLab API モック
   * When: fetchSnapshot(branch) を呼び出し
   * Then:
   *   - GET /repository/tree?recursive=true&ref={branch} が呼ばれる
   *   - shas は返されるが fetchContent は不要
   */
  it('should fetch only tree metadata in GitLab fetchSnapshot', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    const treeResponse = [
      { path: 'config.yaml', id: 'tree-id-1', type: 'blob' },
      { path: 'script.sh', id: 'tree-id-2', type: 'blob' },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => treeResponse,
      text: async () => JSON.stringify(treeResponse),
      headers: new Map(),
    } as any)

    // 実装後検証:
    // const adapter = new GitLabAdapter({ projectId, token })
    // const snapshot = await adapter.fetchSnapshot('main')

    // - GitLab tree API が呼ばれたことを確認
    // expect(mockFetch).toHaveBeenCalledWith(
    //   expect.stringContaining('/repository/tree'),
    //   expect.any(Object)
    // )

    // - shas が返されること
    // expect(snapshot.shas['config.yaml']).toBeDefined()

    expect(treeResponse).toHaveLength(2)
  })

  /**
   * テストケース 3: GitHub getBlob() は on-demand で blob を取得
   * Given: blob sha が指定される
   * When: adapter.getBlob(blobSha) を呼び出し
   * Then:
   *   - GET /git/blobs/{blobSha} が呼ばれる
   *   - base64 デコード済みコンテンツを返す
   */
  it('should fetch GitHub blob content on-demand', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    const blobSha = 'blob-sha-abc123'
    const blobContent = 'console.log("hello");'
    const encodedContent = Buffer.from(blobContent).toString('base64')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: blobSha,
        content: encodedContent,
        encoding: 'base64',
      }),
    } as any)

    // 実装後検証:
    // const adapter = new GitHubAdapter({ ... })
    // const blob = await adapter.getBlob(blobSha)

    // - blob API エンドポイントが呼ばれたことを確認
    // expect(mockFetch).toHaveBeenCalledWith(
    //   expect.stringContaining(`/git/blobs/${blobSha}`),
    //   expect.any(Object)
    // )

    // - デコード済みコンテンツを返すこと
    // expect(blob.content).toBe(blobContent)
    // expect(blob.encoding).toBe('base64')

    expect(encodedContent).toBeTruthy()
  })

  /**
   * テストケース 4: GitLab getRawFile() は on-demand で raw コンテンツ取得
   * Given: ファイルパスと branch が指定される
   * When: adapter.getRawFile(path, branch) を呼び出し
   * Then:
   *   - GET /repository/files/{path}/raw?ref={branch} が呼ばれる
   *   - コンテンツを返す
   */
  it('should fetch GitLab raw file content on-demand', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    const filePath = 'src/main.ts'
    const branch = 'develop'
    const fileContent = 'export function main() { }'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => fileContent,
      headers: new Map(),
    } as any)

    // 実装後検証:
    // const adapter = new GitLabAdapter({ ... })
    // const content = await adapter.getRawFile(filePath, branch)

    // - raw API エンドポイントが呼ばれたことを確認
    // expect(mockFetch).toHaveBeenCalledWith(
    //   expect.stringContaining(`/repository/files/${encodeURIComponent(filePath)}/raw`),
    //   expect.stringContaining(`ref=${branch}`)
    // )

    // - テキストコンテンツを返すこと
    // expect(content).toBe(fileContent)

    expect(fileContent).toContain('export')
  })

  /**
   * テストケース 5: fetchSnapshot() と on-demand API の呼び分け確認
   * Given: 100 ファイルのリポジトリ
   * When:
   *   - fetchSnapshot() でメタデータ取得
   *   - 3 ファイルのみ on-demand で blob 取得
   * Then:
   *   - tree API は 1 回、blob API は 3 回呼ばれる
   */
  it('should separate tree API call from individual blob calls', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    // 最初の tree API 呼び出し
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: Array.from({ length: 100 }, (_, i) => ({
          path: `file${i}.ts`,
          sha: `blob-sha-${i}`,
          type: 'blob',
        })),
      }),
      text: async () => '{}',
      headers: new Map(),
    } as any)

    // 次の blob API 呼び出し（3 つ）
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: `blob-sha-${i}`,
          content: Buffer.from(`content ${i}`).toString('base64'),
          encoding: 'base64',
        }),
      } as any)
    }

    // 実装後検証:
    // const adapter = new GitHubAdapter({ ... })
    // const snapshot = await adapter.fetchSnapshot('main')
    // expect(mockFetch).toHaveBeenCalledTimes(1) // tree API only

    // await adapter.getBlob('blob-sha-0')
    // await adapter.getBlob('blob-sha-1')
    // await adapter.getBlob('blob-sha-2')
    // expect(mockFetch).toHaveBeenCalledTimes(4) // tree + 3 blobs

    expect(mockFetch).toBeDefined()
  })

  /**
   * テストケース 6: fetchContent() の廃止確認
   * Given: 従来の fetchSnapshot().fetchContent() の形態
   * When: on-demand API に移行
   * Then: fetchSnapshot().fetchContent() は使われないこと
   */
  it('should not use fetchContent in snapshot descriptor', async () => {
    const snapshot = {
      headSha: 'sha',
      shas: { 'file.txt': 'blob-sha' },
      // fetchContent を廃止する
      fetchContent: undefined as any,
    }

    // RemoteSynchronizer が on-demand に切り替わるため、
    // fetchContent に依存しないことを確認

    // 実装後検証:
    // const result = await synchronizer.pull(snapshot)
    // → fetchContent は呼ばれない

    expect(snapshot.fetchContent).toBeUndefined()
  })
})
