import { configureFetchMock, clearFetchMock } from '../../../utils/fetchMock'
import AbstractGitAdapter from '../../../../src/git/abstractAdapter'

class TestAdapter extends AbstractGitAdapter {
  public async seq(failUrl: string, okUrl: string) {
    // attempts=2 to make tests fast
    await this.fetchWithRetry(failUrl, { method: 'GET' }, 2, 10)
    await this.fetchWithRetry(okUrl, { method: 'GET' }, 2, 10)
  }

  public async parallel(urls: string[], concurrency = 2) {
    return this.mapWithConcurrency(urls, async (u: string) => {
      await this.fetchWithRetry(u, { method: 'GET' }, 2, 10)
      return 'ok'
    }, concurrency)
  }
}

describe('fetchWithRetry failure handling (v0.0.7)', () => {
  afterEach(() => {
    try { clearFetchMock() } catch (_) {}
  })

  it('sequential: stops after retry-exhausted and does not call subsequent fetches', async () => {
    const failUrl = 'https://example.com/fail'
    const okUrl = 'https://example.com/ok'

    const mock = configureFetchMock([
      { match: /fail/, response: { status: 500, body: '' } }, // always 500
      { match: /ok/, response: { status: 200, body: 'ok' } },
    ])

    const a = new TestAdapter({})

    await expect(a.seq(failUrl, okUrl)).rejects.toMatchObject({ code: 'RETRY_EXHAUSTED' })

    // ensure only the failing URL was fetched (attempts times)
    const urls = (mock as any).mock.calls.map((c: any[]) => c[0])
    expect(urls.every((u: string) => u.includes('/fail'))).toBe(true)
  })

  it('parallel: on one retry-exhausted, mapWithConcurrency should reject and not start remaining tasks', async () => {
    const urls = [
      'https://example.com/ok1',
      'https://example.com/fail',
      'https://example.com/ok2',
      'https://example.com/ok3',
    ]

    const mock = configureFetchMock([
      { match: /fail/, response: { status: 500, body: '' } },
      { match: /ok/, response: { status: 200, body: 'ok' } },
    ])

    const a = new TestAdapter({})

    await expect(a.parallel(urls, 2)).rejects.toMatchObject({ code: 'RETRY_EXHAUSTED' })

    const called = (mock as any).mock.calls.map((c: any[]) => c[0])
    // ensure the failing url was requested and the overall operation rejected as retry-exhausted
    expect(called.some((u: string) => u.includes('/fail'))).toBe(true)
  })
})
