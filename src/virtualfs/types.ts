export type FileState = 'base' | 'modified' | 'added' | 'deleted' | 'conflict'

export interface IndexEntry {
  path: string
  state: FileState
  baseSha?: string
  // remoteSha is set when a conflict is detected to hold the incoming remote version's sha
  remoteSha?: string
  workspaceSha?: string
  updatedAt: number
}

export interface IndexFile {
  head: string
  // 最後にプッシュしたコミットの commitKey（任意）
  lastCommitKey?: string
  // adapter metadata persisted by VirtualFS (optional)
  adapter?: AdapterMeta
  entries: Record<string, IndexEntry>
}

export interface AdapterOptionsBase {
  token?: string
  branch?: string
  host?: string
  defaultBranch?: string
  repositoryName?: string
  repositoryId?: string | number
}

export interface GitHubAdapterOptions extends AdapterOptionsBase {
  owner: string
  repo: string
}

export interface GitLabAdapterOptions extends AdapterOptionsBase {
  projectId: string
}

export type AdapterOptions = GitHubAdapterOptions | GitLabAdapterOptions

export interface AdapterMeta {
  type: string
  opts?: AdapterOptions
}

export interface TombstoneEntry {
  path: string
  baseSha: string
  deletedAt: number
}

export interface ConflictEntry {
  path: string
  baseSha?: string
  remoteSha?: string
  workspaceSha?: string
}

export type Change =
  | { type: 'create'; path: string; content: string }
  | { type: 'update'; path: string; content: string; baseSha: string }
  | { type: 'delete'; path: string; baseSha: string }

export interface CommitInput {
  message: string
  parentSha: string
  changes: Change[]
  ref?: string // optional branch name, e.g. 'main'
  // generated idempotency key: hash(parentSha + JSON.stringify(changes))
  commitKey?: string
}

// Branch related types
export type BranchInfo = {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
  isDefault: boolean
}

export type BranchListQuery = {
  perPage?: number
  page?: number
}

export type BranchListPage = {
  items: BranchInfo[]
  nextPage?: number
  lastPage?: number
}

export type RepositoryMetadata = {
  defaultBranch: string
  name: string
  id?: string | number
}

// Create branch types
export type CreateBranchInput = {
  name: string
  fromRef?: string
}

export type CreateBranchResult = {
  name: string
  sha: string
  ref: string
}
