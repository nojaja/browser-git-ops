import type { AdapterMeta, GitHubAdapterOptions, GitLabAdapterOptions } from '../types.ts'
export type AdapterType = 'github' | 'gitlab'

/**
 * Parse a repository URL into adapter metadata suitable for `setAdapter`.
 * @param urlString repository URL
 * @param token optional token hint
 * @param platformOverride optional platform override ('github'|'gitlab'|'auto')
 * @returns parsed AdapterMeta containing `type` and `opts`
 */
export function parseAdapterFromUrl(urlString: string, token?: string, platformOverride: 'github' | 'gitlab' | 'auto' = 'auto'): AdapterMeta {
  if (!urlString || typeof urlString !== 'string') throw new TypeError('invalid url')

  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch (error) {
    throw new TypeError('invalid url')
  }

  const hostname = (parsed.hostname || '').toLowerCase()
  const searchParameters = parsed.searchParams
  const tokenFromUrl = searchParameters.get('token') || undefined
  const resolvedToken = token || tokenFromUrl
  const branchParameter = searchParameters.get('branch') || undefined

  const normalizedPath = parsed.pathname.replace(/(^\/+|\/+$)/g, '')
  const rawSegments = normalizedPath ? normalizedPath.split('/') : []
  const segments = rawSegments.map(segment => segment.replace(/\.git$/i, ''))

  const platform = determinePlatform(hostname, segments, resolvedToken, platformOverride)

  if (platform === 'github') return buildGithubMeta(parsed, hostname, segments, resolvedToken, branchParameter)
  return buildGitlabMeta(parsed, hostname, segments, resolvedToken, branchParameter)
}
/**
 * Determine which platform the URL refers to.
 * @param hostname lowercased hostname
 * @param segments path segments
 * @param resolvedToken optional token hint
 * @param platformOverride override value
 * @returns determined AdapterType
 */
function determinePlatform(hostname: string, segments: string[], resolvedToken?: string, platformOverride: 'github' | 'gitlab' | 'auto' = 'auto'): AdapterType {
  if (platformOverride === 'github' || platformOverride === 'gitlab') return platformOverride
  if (hostname.includes('gitlab')) return 'gitlab'
  if (hostname.includes('github')) return 'github'
  if (resolvedToken && resolvedToken.startsWith('glpat_')) return 'gitlab'
  if (resolvedToken && resolvedToken.startsWith('ghp_')) return 'github'
  if (segments.length >= 3) return 'gitlab'
  if (segments.length === 2) return 'github'
  throw new Error('cannot determine adapter type from URL')
}
/**
 * Build metadata for GitHub repositories.
 * @param parsed parsed URL instance
 * @param hostname hostname string
 * @param segments path segments
 * @param resolvedToken optional token
 * @param branchParameter optional branch parameter
 * @returns AdapterMeta for GitHub
 */
function buildGithubMeta(parsed: URL, hostname: string, segments: string[], resolvedToken?: string, branchParameter?: string): AdapterMeta {
  const owner = segments[0] || ''
  const repo = segments[1] || ''
  if (!owner || !repo) throw new Error('invalid repository path')
  const options: GitHubAdapterOptions = { owner, repo, branch: branchParameter || 'main' }
  if (resolvedToken) options.token = resolvedToken
  if (!/github\.com$/i.test(hostname)) {
    options.host = `${parsed.protocol}//${parsed.host}/api/v3`
  }
  return { type: 'github', opts: options }
}
/**
 * Build metadata for GitLab repositories.
 * @param parsed parsed URL instance
 * @param hostname hostname string
 * @param segments path segments
 * @param resolvedToken optional token
 * @param branchParameter optional branch parameter
 * @returns AdapterMeta for GitLab
 */
function buildGitlabMeta(parsed: URL, hostname: string, segments: string[], resolvedToken?: string, branchParameter?: string): AdapterMeta {
  const projectId = segments.join('/')
  if (!projectId) throw new Error('invalid repository path')
  const options: GitLabAdapterOptions = { projectId, branch: branchParameter || 'main' }
  if (resolvedToken) options.token = resolvedToken
  if (!/gitlab\.com$/i.test(hostname)) {
    options.host = `${parsed.protocol}//${parsed.host}`
  }
  return { type: 'gitlab', opts: options }
}

/**
 * Build a canonical repository URL from adapter options and type.
 * The URL does NOT contain branch information (branch is stored separately).
 * @param type adapter type ('github' | 'gitlab')
 * @param options adapter options containing host, owner, repo, or projectId
 * @returns canonical repository URL string
 */
export function buildUrlFromAdapterOptions(type: string, options: Record<string, any>): string {
  if (type === 'github') return buildGithubUrl(options)
  if (type === 'gitlab') return buildGitlabUrl(options)
  throw new Error(`unsupported adapter type: ${type}`)
}

/**
 * Build GitHub repository URL from options.
 * @param options adapter options with owner, repo, and optional host
 * @returns GitHub repository URL
 */
function buildGithubUrl(options: Record<string, any>): string {
  const owner = options.owner || ''
  const repo = options.repo || ''
  if (!owner || !repo) throw new Error('owner and repo are required for github')
  const host = options.host as string | undefined
  if (host) {
    // host is API base like 'https://git.example.com/api/v3' – strip /api/v3 suffix
    const baseUrl = host.replace(/\/api\/v\d+\/?$/i, '')
    return `${baseUrl}/${owner}/${repo}`
  }
  return `https://github.com/${owner}/${repo}`
}

/**
 * Build GitLab repository URL from options.
 * @param options adapter options with projectId and optional host
 * @returns GitLab repository URL
 */
function buildGitlabUrl(options: Record<string, any>): string {
  const projectId = options.projectId || ''
  if (!projectId) throw new Error('projectId is required for gitlab')
  const host = options.host as string | undefined
  if (host) {
    // host is base URL like 'http://localhost:8929' or 'https://gitlab.example.com'
    const trimmed = host.replace(/\/+$/, '')
    return `${trimmed}/${projectId}`
  }
  return `https://gitlab.com/${projectId}`
}
