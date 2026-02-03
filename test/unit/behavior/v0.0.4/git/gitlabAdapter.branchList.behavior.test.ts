import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { GitLabAdapter } from '../../../../../src/git/gitlabAdapter'
import fetchMock from '../../../../utils/fetchMock'

describe('GitLabAdapter branch list behavior (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.clearFetchMock()
  })

  afterEach(() => {
    fetchMock.clearFetchMock()
  })

  it('should map branch list and mark default branch based on project metadata', async () => {
    // Arrange: mock project metadata and branches endpoints
    const projMeta = { id: 123, name: 'proj', default_branch: 'main', path_with_namespace: 'root/test-repo', web_url: 'http://localhost:8929/root/test-repo' }
    const branches = [
      {
        name: 'main',
        commit: {
          id: 'ea14093291f3d25223538e7bf37272318b88b3cb',
          short_id: 'ea140932',
          created_at: '2026-02-01T16:52:56.000+00:00',
          parent_ids: ['7ba8085b744ae447701a3ae0248b4b345e1bc2f4'],
          title: 'Example push from UI',
          message: 'Example push from UI\\n\\napigit-commit-key:bfefd40d2a4600f3158c45d8a8e2fe8ecd93a5f4',
          author_name: 'CI',
          web_url: 'http://localhost:8929/root/test-repo/-/commit/ea14093291f3d25223538e7bf37272318b88b3cb'
        },
        protected: true
      },
      {
        name: 'test',
        commit: {
          id: '78f9537971c2f4dbdd4f332e2178fdfc6e4efa80',
          short_id: '78f95379',
          created_at: '2026-01-30T10:00:00.000+00:00',
          parent_ids: [],
          title: 'Add tests',
          message: 'Add tests',
          author_name: 'dev',
          web_url: 'http://localhost:8929/root/test-repo/-/commit/78f9537971c2f4dbdd4f332e2178fdfc6e4efa80'
        },
        protected: false
      }
    ]

    fetchMock.configureFetchMock([
      { match: '/api/v4/projects/123/repository/branches', response: { status: 200, body: JSON.stringify(branches), headers: { 'x-next-page': '', 'x-total': '2', 'x-total-pages': '1' } } },
      { match: '/api/v4/projects/123', response: { status: 200, body: JSON.stringify(projMeta) } }
    ])

    const adapter = new GitLabAdapter({ projectId: '123', token: 't' })

    // Act
    const meta = (adapter as any).getRepositoryMetadata ? await (adapter as any).getRepositoryMetadata() : null
    const result = (adapter as any).listBranches ? await (adapter as any).listBranches({ perPage: 30, page: 1 }) : null

    // Assert
    expect(meta).not.toBeNull()
    expect(meta.defaultBranch).toBe('main')
    expect(result).not.toBeNull()
    expect(Array.isArray(result.items)).toBe(true)
    const main = result.items.find((b: any) => b.name === 'main')
    const testBranch = result.items.find((b: any) => b.name === 'test')
    expect(main).toBeDefined()
    expect(main.protected).toBe(true)
    expect(main.isDefault).toBe(true)
    expect(testBranch).toBeDefined()
    expect(testBranch.protected).toBe(false)
    expect(testBranch.isDefault).toBe(false)
  })

  it('should fallback default branch to main when project metadata fetch fails', async () => {
    fetchMock.configureFetchMock([
      { match: '/api/v4/projects/123/repository/branches', response: { status: 200, body: JSON.stringify([{ name: 'main', commit: { id: 'ea14093291f3d25223538e7bf37272318b88b3cb', short_id: 'ea140932', created_at: '2026-02-01T16:52:56.000+00:00', parent_ids: [], author_name: 'CI', web_url: 'http://localhost:8929/root/test-repo/-/commit/ea14093291f3d25223538e7bf37272318b88b3cb' }, protected: false }]) } },
      // return 200 with empty body so adapter falls back to 'main'
      { match: '/api/v4/projects/123', response: { status: 200, body: '{}' } }
    ])

    const adapter = new GitLabAdapter({ projectId: '123', token: 't' })

    let meta = null
    try {
      meta = (adapter as any).getRepositoryMetadata ? await (adapter as any).getRepositoryMetadata() : null
    } catch (e) {
      // possible thrown
    }
    const result = (adapter as any).listBranches ? await (adapter as any).listBranches() : null

    if (meta) expect(meta.defaultBranch).toBe('main')
    expect(result).not.toBeNull()
    const main = result.items.find((b: any) => b.name === 'main')
    expect(main).toBeDefined()
    if (main) expect(main.isDefault).toBe(true)
  })
})
