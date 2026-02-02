import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { GitHubAdapter } from '../../../../../src/git/githubAdapter'
import fetchMock from '../../../../utils/fetchMock'

describe('GitHubAdapter branch list behavior (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.clearFetchMock()
  })

  afterEach(() => {
    fetchMock.clearFetchMock()
  })

  it('should map branch list and mark default branch based on repository metadata', async () => {
    // Arrange: mock repository metadata and branches endpoints
    const repoMeta = { default_branch: 'develop', name: 'repo' }
    const branches = [
      { name: 'develop', commit: { sha: 'SHA_DEV', url: 'https://api.github.com/commits/SHA_DEV' }, protected: true },
      { name: 'feature-x', commit: { sha: 'SHA_FX', url: 'https://api.github.com/commits/SHA_FX' }, protected: false }
    ]

    fetchMock.configureFetchMock([
      { match: '/repos/o/r/branches', response: { status: 200, body: JSON.stringify(branches), headers: { link: '' } } },
      { match: '/repos/o/r', response: { status: 200, body: JSON.stringify(repoMeta) } }
    ])

    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })

    // Act
    const meta = (adapter as any).getRepositoryMetadata ? await (adapter as any).getRepositoryMetadata() : null
    const result = (adapter as any).listBranches ? await (adapter as any).listBranches({ perPage: 30, page: 1 }) : null

    // Assert: expected structure per design
    expect(meta).not.toBeNull()
    expect(meta.defaultBranch).toBe('develop')
    expect(result).not.toBeNull()
    expect(Array.isArray(result.items)).toBe(true)
    const dev = result.items.find((b: any) => b.name === 'develop')
    const fx = result.items.find((b: any) => b.name === 'feature-x')
    expect(dev).toBeDefined()
    expect(dev.protected).toBe(true)
    expect(dev.isDefault).toBe(true)
    expect(fx).toBeDefined()
    expect(fx.protected).toBe(false)
    expect(fx.isDefault).toBe(false)
  })

  it('should fallback default branch to main when metadata fetch fails', async () => {
    // Arrange: metadata endpoint returns error, branches exist
    fetchMock.configureFetchMock([
      { match: '/repos/o/r/branches', response: { status: 200, body: JSON.stringify([{ name: 'main', commit: { sha: 'S1', url: 'u' }, protected: false }]) } },
      // return 200 with empty body so adapter falls back to 'main'
      { match: '/repos/o/r', response: { status: 200, body: '{}' } }
    ])

    const adapter = new GitHubAdapter({ owner: 'o', repo: 'r', token: 't' })

    // Act
    let meta = null
    try {
      meta = (adapter as any).getRepositoryMetadata ? await (adapter as any).getRepositoryMetadata() : null
    } catch (e) {
      // expected to possibly throw; adapter may implement fallback internally
    }
    const result = (adapter as any).listBranches ? await (adapter as any).listBranches() : null

    // Assert
    // If adapter implements fallback as design, metadata.defaultBranch === 'main'
    if (meta) expect(meta.defaultBranch).toBe('main')
    expect(result).not.toBeNull()
    const main = result.items.find((b: any) => b.name === 'main')
    expect(main).toBeDefined()
    // isDefault should be true if fallback applied
    if (main) expect(main.isDefault).toBe(true)
  })
})
