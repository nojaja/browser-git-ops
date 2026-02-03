/**
 * @test-type behavior
 * @purpose Requirement or design guarantee
 * @policy DO NOT MODIFY
 */

import GitLabAdapter from '../../../../../src/git/gitlabAdapter';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { configureFetchMock, clearFetchMock } from '../../../../utils/fetchMock'

describe('GitLabAdapter - additional flows', () => {
  let adapter: any;

  beforeEach(() => {
    adapter = new GitLabAdapter({ projectId: '1', token: 't' });
    jest.restoreAllMocks();
    configureFetchMock([])
  });

  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
    jest.resetAllMocks();
  });

  it('createBlobs returns map of blob shas', async () => {
    const changes = [
      { type: 'create', path: 'a.txt', content: 'hello' },
      { type: 'update', path: 'dir/b.txt', content: 'bye' }
    ];

    const blobs = await adapter.createBlobs(changes);
    expect(Object.keys(blobs)).toHaveLength(2);
    expect(blobs['a.txt']).toMatch(/[0-9a-f]{8,}/i);
    expect(blobs['dir/b.txt']).toMatch(/[0-9a-f]{8,}/i);
  });

  it('createCommit returns parentSha when no pending actions', async () => {
    const parentSha = 'parent-sha-123';
    const result = await adapter.createCommit('msg', parentSha, 'treesha');
    expect(result).toBe(parentSha);
  });

  it('createTree + createCommit uses actions and returns created id', async () => {
    // prepare tree which internally registers pending actions
    const tree = [
      { action: 'create', file_path: 'x.txt', content: 'X' }
    ];
    await adapter.createTree(tree);

    const fm = configureFetchMock([{ response: { status: 200, body: JSON.stringify({ id: 'new-commit-id' }) } }])
    ;(fm as jest.Mock).mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ id: 'new-commit-id' }) })

    const res = await adapter.createCommit('parent', 'msg');
    expect(res).toBe('new-commit-id');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('createCommitWithActions throws on invalid JSON text', async () => {
    const fm2 = configureFetchMock([])
    ;(fm2 as jest.Mock).mockResolvedValueOnce({ ok: true, text: async () => 'not a json' })

    await expect(adapter.createCommitWithActions('main', 'm', [{ type: 'create', path: 'y.txt', content: 'Y' }])).rejects.toThrow();
  });

  it('createCommitWithActions retries on 500 then succeeds', async () => {
    const fm3 = configureFetchMock([])
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
    ;(fm3 as jest.Mock).mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ id: 'ok-id' }) })

    const id = await adapter.createCommitWithActions('main', 'm', [{ type: 'update', path: 'z.txt', content: 'Z' }])
    expect(id).toBe('ok-id');
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
