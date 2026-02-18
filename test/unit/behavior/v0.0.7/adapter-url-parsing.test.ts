import { parseAdapterFromUrl } from '../../../../src/virtualfs/utils/urlParser'
import { VirtualFS } from '../../../../src/virtualfs/virtualfs'

describe('parseAdapterFromUrl', () => {
  it('parses GitHub owner/repo', () => {
    const meta = parseAdapterFromUrl('https://github.com/owner/repo')
    expect(meta.type).toBe('github')
    expect(meta.opts.owner).toBe('owner')
    expect(meta.opts.repo).toBe('repo')
    expect(meta.opts.branch).toBe('main')
  })

  it('parses GitHub .git suffix', () => {
    const meta = parseAdapterFromUrl('https://github.com/owner/repo.git')
    expect(meta.type).toBe('github')
    expect(meta.opts.owner).toBe('owner')
    expect(meta.opts.repo).toBe('repo')
  })

  it('parses GitHub enterprise host', () => {
    const meta = parseAdapterFromUrl('https://git.example.com/owner/repo')
    expect(meta.type).toBe('github')
    expect(meta.opts.host).toBe('https://git.example.com/api/v3')
  })

  it('parses GitLab project path', () => {
    const meta = parseAdapterFromUrl('https://gitlab.com/group/subgroup/project')
    expect(meta.type).toBe('gitlab')
    expect(meta.opts.projectId).toBe('group/subgroup/project')
  })

  it('honors token hint for gitlab', () => {
    const meta = parseAdapterFromUrl('https://example.com/owner/proj', 'glpat_123')
    expect(meta.type).toBe('gitlab')
  })

  it('honors platform override', () => {
    const meta = parseAdapterFromUrl('https://example.com/owner/repo', undefined, 'github')
    expect(meta.type).toBe('github')
  })

  it('throws on invalid url', () => {
    expect(() => parseAdapterFromUrl('not-a-url')).toThrow()
  })

  it('throws on insufficient path segments for github', () => {
    expect(() => parseAdapterFromUrl('https://github.com/owner')).toThrow()
  })
})

describe('VirtualFS.setAdapter overload', () => {
  it('accepts type and url and persists adapterMeta', async () => {
    const vfs = new VirtualFS({})
    // use an in-memory backend by default via constructor
    await vfs.setAdapter('github', 'https://github.com/owner/repo')
    const meta = await vfs.getAdapter()
    expect(meta).not.toBeNull()
    expect(meta!.type).toBe('github')
    expect(meta!.opts && (meta!.opts as any).owner).toBe('owner')
  })
})
