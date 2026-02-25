/**
 * @file setAdapter branch parameter addition behavior test
 * @see docs/spec/v0.0.8/setAdapter-branch-design.md
 *
 * Verification items:
 * 1. setAdapter(meta: AdapterMeta) sets value and getAdapter returns expected URL (github/gitlab/selfhost 3 patterns)
 * 2. setAdapter(type, url, branch?, token?) sets value and getAdapter returns expected AdapterMeta
 * 3. getAdapter returns branch and token at the expected hierarchy
 * 4. setAdapter without branch argument results in getAdapter returning 'main'
 * 5. setAdapter(url, branch?, token?) sets value and getAdapter returns expected AdapterMeta
 * 6. buildUrlFromAdapterOptions correctly generates url from opts
 */
import { VirtualFS } from '../../../../src/virtualfs/virtualfs'
import { buildUrlFromAdapterOptions } from '../../../../src/virtualfs/utils/urlParser'

/**
 * Helper: create VirtualFS backed by InMemoryStorage
 * @returns VirtualFS instance
 */
function createVfs(): VirtualFS {
  return new VirtualFS({})
}

describe('setAdapter branch parameter (v0.0.8)', () => {
  // ============================================================
  // 1. setAdapter(meta: AdapterMeta) - GitHub / GitLab / selfhost
  // ============================================================
  describe('setAdapter(meta: AdapterMeta) generates correct URL', () => {
    it('GitHub: url is generated from opts and branch/token are stored at top level', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'github',
        branch: 'develop',
        token: 'ghp_testtoken',
        opts: { owner: 'octocat', repo: 'Hello-World' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('github')
      expect(meta!.url).toBe('https://github.com/octocat/Hello-World')
      expect(meta!.branch).toBe('develop')
      expect(meta!.token).toBe('ghp_testtoken')
      expect(meta!.opts).toBeDefined()
      expect((meta!.opts as any).owner).toBe('octocat')
      expect((meta!.opts as any).repo).toBe('Hello-World')
    })

    it('GitLab (SaaS): url is generated from opts and branch/token are stored at top level', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'gitlab',
        branch: 'feature/xyz',
        token: 'glpat_testtoken',
        opts: { projectId: 'group/subgroup/project' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('gitlab')
      expect(meta!.url).toBe('https://gitlab.com/group/subgroup/project')
      expect(meta!.branch).toBe('feature/xyz')
      expect(meta!.token).toBe('glpat_testtoken')
      expect(meta!.opts).toBeDefined()
      expect((meta!.opts as any).projectId).toBe('group/subgroup/project')
    })

    it('Self-host GitLab: url is generated from opts and includes host', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'gitlab',
        branch: 'main',
        token: 'glpat_selfhost',
        opts: { projectId: 'root/test-repo', host: 'http://localhost:8929' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('gitlab')
      expect(meta!.url).toBe('http://localhost:8929/root/test-repo')
      expect(meta!.branch).toBe('main')
      expect(meta!.token).toBe('glpat_selfhost')
      expect((meta!.opts as any).host).toBe('http://localhost:8929')
      expect((meta!.opts as any).projectId).toBe('root/test-repo')
    })

    it('Self-host GitHub Enterprise: url is generated from opts', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'github',
        branch: 'release/v1',
        opts: { owner: 'myorg', repo: 'myrepo', host: 'https://git.example.com/api/v3' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('github')
      expect(meta!.url).toBe('https://git.example.com/myorg/myrepo')
      expect(meta!.branch).toBe('release/v1')
      expect((meta!.opts as any).host).toBe('https://git.example.com/api/v3')
    })
  })

  // ============================================================
  // 2. setAdapter(type, url, branch?, token?) returns correct AdapterMeta
  // ============================================================
  describe('setAdapter(type, url, branch?, token?) returns correct AdapterMeta', () => {
    it('GitHub: type + url + branch + token', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('github', 'https://github.com/octocat/Hello-World', 'develop', 'ghp_tok123')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('github')
      expect(meta!.url).toBe('https://github.com/octocat/Hello-World')
      expect(meta!.branch).toBe('develop')
      expect(meta!.token).toBe('ghp_tok123')
      expect((meta!.opts as any).owner).toBe('octocat')
      expect((meta!.opts as any).repo).toBe('Hello-World')
    })

    it('GitLab: type + url + branch + token', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('gitlab', 'https://gitlab.com/group/project', 'staging', 'glpat_abc')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('gitlab')
      expect(meta!.url).toBe('https://gitlab.com/group/project')
      expect(meta!.branch).toBe('staging')
      expect(meta!.token).toBe('glpat_abc')
      expect((meta!.opts as any).projectId).toBe('group/project')
    })

    it('GitHub: type + url only (branch/token omitted)', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('github', 'https://github.com/owner/repo')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe('github')
      expect(meta!.url).toBe('https://github.com/owner/repo')
      expect(meta!.branch).toBe('main')
      expect((meta!.opts as any).owner).toBe('owner')
      expect((meta!.opts as any).repo).toBe('repo')
    })
  })

  // ============================================================
  // 3. getAdapter returns branch and token at expected hierarchy
  // ============================================================
  describe('getAdapter has branch/token at top level', () => {
    it('branch and token exist at adapter.branch / adapter.token', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('github', 'https://github.com/owner/repo', 'feature/test', 'tok_abc')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      // top level branch/token
      expect(meta).toHaveProperty('branch', 'feature/test')
      expect(meta).toHaveProperty('token', 'tok_abc')
      // opts contains host/owner/repo etc.
      expect(meta).toHaveProperty('opts')
      expect(meta!.opts).toHaveProperty('owner', 'owner')
      expect(meta!.opts).toHaveProperty('repo', 'repo')
    })

    it('AdapterMeta object also stores at same hierarchy', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'gitlab',
        branch: 'hotfix/1',
        token: 'glpat_xyz',
        opts: { projectId: 'ns/proj' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta).toHaveProperty('branch', 'hotfix/1')
      expect(meta).toHaveProperty('token', 'glpat_xyz')
      expect(meta).toHaveProperty('type', 'gitlab')
      expect(meta).toHaveProperty('url')
      expect(meta).toHaveProperty('opts')
    })
  })

  // ============================================================
  // 4. branch omitted defaults to 'main'
  // ============================================================
  describe('branch defaults to main when omitted', () => {
    it('setAdapter(meta) without branch defaults to main', async () => {
      const vfs = createVfs()
      await vfs.setAdapter({
        type: 'github',
        opts: { owner: 'octocat', repo: 'Hello-World' },
      })
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.branch).toBe('main')
    })

    it('setAdapter(type, url) without branch defaults to main', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('github', 'https://github.com/owner/repo')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.branch).toBe('main')
    })

    it('setAdapter(url) without branch defaults to main', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('https://github.com/owner/repo')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.branch).toBe('main')
    })

    it('setAdapter(url, branch) uses specified branch', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('https://github.com/owner/repo', 'develop')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.branch).toBe('develop')
    })

    it('setAdapter(url, branch, token) all specified', async () => {
      const vfs = createVfs()
      await vfs.setAdapter('https://gitlab.com/group/project', 'feature/xyz', 'glpat_token')
      const meta = await vfs.getAdapter()
      expect(meta).not.toBeNull()
      expect(meta!.branch).toBe('feature/xyz')
      expect(meta!.token).toBe('glpat_token')
      expect(meta!.type).toBe('gitlab')
      expect(meta!.url).toBe('https://gitlab.com/group/project')
    })
  })

  // ============================================================
  // 5. All calling styles produce unified storage structure
  // ============================================================
  describe('all calling styles produce unified structure', () => {
    it('setAdapter(meta) and setAdapter(type, url, branch, token) produce same structure', async () => {
      // Style 1: meta object
      const vfs1 = createVfs()
      await vfs1.setAdapter({
        type: 'github',
        branch: 'develop',
        token: 'tok123',
        opts: { owner: 'octocat', repo: 'Hello-World' },
      })
      const meta1 = await vfs1.getAdapter()

      // Style 2: type + url + branch + token
      const vfs2 = createVfs()
      await vfs2.setAdapter('github', 'https://github.com/octocat/Hello-World', 'develop', 'tok123')
      const meta2 = await vfs2.getAdapter()

      // verify identical structure
      expect(meta1!.type).toBe(meta2!.type)
      expect(meta1!.url).toBe(meta2!.url)
      expect(meta1!.branch).toBe(meta2!.branch)
      expect(meta1!.token).toBe(meta2!.token)
      expect((meta1!.opts as any).owner).toBe((meta2!.opts as any).owner)
      expect((meta1!.opts as any).repo).toBe((meta2!.opts as any).repo)
    })

    it('setAdapter(url) and setAdapter(type, url) produce same structure (branch=main)', async () => {
      const vfs1 = createVfs()
      await vfs1.setAdapter('https://github.com/owner/repo')
      const meta1 = await vfs1.getAdapter()

      const vfs2 = createVfs()
      await vfs2.setAdapter('github', 'https://github.com/owner/repo')
      const meta2 = await vfs2.getAdapter()

      expect(meta1!.type).toBe(meta2!.type)
      expect(meta1!.url).toBe(meta2!.url)
      expect(meta1!.branch).toBe(meta2!.branch)
      expect((meta1!.opts as any).owner).toBe((meta2!.opts as any).owner)
      expect((meta1!.opts as any).repo).toBe((meta2!.opts as any).repo)
    })
  })

  // ============================================================
  // 6. buildUrlFromAdapterOptions unit tests
  // ============================================================
  describe('buildUrlFromAdapterOptions', () => {
    it('GitHub: owner + repo produces https://github.com/owner/repo', () => {
      const url = buildUrlFromAdapterOptions('github', { owner: 'octocat', repo: 'Hello-World' })
      expect(url).toBe('https://github.com/octocat/Hello-World')
    })

    it('GitHub Enterprise: host specified produces host base URL', () => {
      const url = buildUrlFromAdapterOptions('github', {
        owner: 'myorg',
        repo: 'myrepo',
        host: 'https://git.example.com/api/v3',
      })
      expect(url).toBe('https://git.example.com/myorg/myrepo')
    })

    it('GitLab (SaaS): projectId produces https://gitlab.com/projectId', () => {
      const url = buildUrlFromAdapterOptions('gitlab', { projectId: 'group/subgroup/project' })
      expect(url).toBe('https://gitlab.com/group/subgroup/project')
    })

    it('GitLab self-host: host + projectId produces host/projectId', () => {
      const url = buildUrlFromAdapterOptions('gitlab', {
        projectId: 'root/test-repo',
        host: 'http://localhost:8929',
      })
      expect(url).toBe('http://localhost:8929/root/test-repo')
    })

    it('GitLab self-host (https): host + projectId produces host/projectId', () => {
      const url = buildUrlFromAdapterOptions('gitlab', {
        projectId: 'ns/proj',
        host: 'https://gitlab.example.com',
      })
      expect(url).toBe('https://gitlab.example.com/ns/proj')
    })
  })
})
