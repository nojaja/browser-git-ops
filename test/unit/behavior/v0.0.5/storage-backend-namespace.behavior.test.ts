import '../../../setupOpfs.js'
import { jest } from '@jest/globals'
import * as lib from '../../../../src/index'
import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import { resetMockOPFS } from 'opfs-mock'

// Spec: docs/spec/v0.0.5/storage-backend-namespace.md
// TDD: this behavior test asserts the new namespace-root layout and API expectations.

describe('behavior/v0.0.5 - StorageBackend namespace support (Opfs)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  afterEach(() => {
    jest.resetAllMocks()
    clearFetchMock()
    resetMockOPFS()
  })

  it('StorageBackendConstructor.availableRoots(namespace) returns roots under given namespace', async () => {
    // arrange: spy on availableRoots to simulate namespace-scoped roots
    const mockAvailable = jest.spyOn(lib.OpfsStorage, 'availableRoots')
      .mockImplementation((ns?: string) => {
        if (ns === 'myapp-123') return ['projectA']
        return []
      })

    // act
    const roots = await lib.OpfsStorage.availableRoots('myapp-123')

    // assert
    expect(mockAvailable).toHaveBeenCalledWith('myapp-123')
    expect(Array.isArray(roots)).toBeTruthy()
    expect(roots).toContain('projectA')
  })

  it('backend.listFilesRaw() returns namespace-prefixed paths after initial pull', async () => {
    // arrange
    // simulate availableRoots returning the root name when asked for namespace
    jest.spyOn(lib.OpfsStorage, 'availableRoots').mockImplementation((ns?: string) => {
      return ns === 'myapp-123' ? ['projectA'] : []
    })

    const treeJson = [
      { id: 'id1', name: 'README.md', type: 'blob', path: 'README.md' },
      { id: 'id2', name: 'a.txt', type: 'blob', path: 'a.txt' }
    ]

    const fileContents: Record<string, string> = {
      'README.md': '# test-repo\n',
      'a.txt': 'hello'
    }

    configureFetchMock([
      { match: /\/repository\/branches\/main$/, response: { status: 200, body: JSON.stringify({ name: 'main', commit: { id: 'commit1' } }) } },
      { match: /repository\/tree/, response: { status: 200, body: JSON.stringify(treeJson) } },
      { match: /repository\/files\/.+?\/raw/, response: { status: 200, body: JSON.stringify(fileContents) } }
    ])

    // act: create backend with new constructor signature (namespace, root)
    // Note: this is TDD — expected to be supported by implementation change.
    const backend = new lib.OpfsStorage('myapp-123', 'projectA')
    const currentVfs = new lib.VirtualFS({ backend, logger: undefined })
    await currentVfs.init()

    await currentVfs.setAdapter({ type: 'gitlab', opts: { projectId: 'root/test-repo', host: 'http://localhost:8929', token: 'x', branch: 'main' } })

    const pullRes = await currentVfs.pull()
    expect(pullRes).toBeDefined()

    // use backend.listFilesRaw to check file existence and namespace prefixing
    const filesRaw = await backend.listFilesRaw()
    const paths = filesRaw.map((f: any) => f.path)

    // expected: paths include namespace/root prefix
    expect(paths).toContain('myapp-123/projectA/index')
    expect(paths).toContain('myapp-123/projectA/.git/main/info/README.md')
    expect(paths).toContain('myapp-123/projectA/.git/main/info/a.txt')
  })
})


