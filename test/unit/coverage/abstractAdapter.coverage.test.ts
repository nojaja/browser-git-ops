import { jest } from '@jest/globals'
import * as AA from '../../../src/git/abstractAdapter'

describe('abstractAdapter helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    try { jest.useRealTimers() } catch (_) {}
  })

  test('classifyStatus identifies retryable statuses', () => {
    expect(AA.classifyStatus(500)).toBe(true)
    expect(AA.classifyStatus(502)).toBe(true)
    expect(AA.classifyStatus(429)).toBe(true)
    expect(AA.classifyStatus(400)).toBe(false)
    expect(AA.classifyStatus(200)).toBe(false)
  })

  test('getDelayForResponse uses Retry-After header when present', () => {
    const hdrs = { get: (k: string) => (k.toLowerCase() === 'retry-after' ? '3' : undefined) }
    const fakeResp: any = { headers: hdrs }
    const d = AA.getDelayForResponse(fakeResp as unknown as Response, 0, 100)
    expect(d).toBe(3000)
  })

  test('getDelayForResponse falls back to exponential backoff when no response', () => {
    const base = 50
    const d = AA.getDelayForResponse(null, 2, base)
    const min = base * Math.pow(2, 2)
    expect(d).toBeGreaterThanOrEqual(min)
    expect(d).toBeLessThan(min + 200)
  })

  test('processResponseWithDelay returns ok response', async () => {
    const okResp: any = { ok: true, status: 200, text: async () => 'ok' }
    await expect(AA.processResponseWithDelay(okResp as Response, 0, 10)).resolves.toBe(okResp)
  })

  test('processResponseWithDelay throws RetryableError for 5xx', async () => {
    // Make setTimeout execute immediately to avoid test delays
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => { fn(); return 0 as any }) as any)
    const bad: any = { ok: false, status: 500, text: async () => 'err' }
    await expect(AA.processResponseWithDelay(bad as Response, 0, 1)).rejects.toBeInstanceOf(AA.RetryableError)
  })

  test('processResponseWithDelay throws NonRetryableError for 4xx', async () => {
    const notFound: any = { ok: false, status: 404, text: async () => 'not found' }
    await expect(AA.processResponseWithDelay(notFound as Response, 0, 1)).rejects.toBeInstanceOf(AA.NonRetryableError)
  })

  test('fetchWithRetry returns on success and retries until exhausted', async () => {
    // mock setTimeout to avoid waits
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => { fn(); return 0 as any }) as any)

    // successful fetch on first try
    const okResp: any = { ok: true, status: 200, text: async () => 'ok' }
    let calls = 0
    const fakeFetch = jest.fn().mockImplementation(() => { calls++; return Promise.resolve(okResp) })
    ;(global as any).fetch = fakeFetch
    await expect(AA.fetchWithRetry('http://x', {} as any, 3, 10)).resolves.toBe(okResp)
    expect(calls).toBe(1)

    // exhausted retries -> still throws RetryableError
    const badResp: any = { ok: false, status: 500, text: async () => 'err' }
    const fakeFetchAlwaysBad = jest.fn().mockImplementation(() => Promise.resolve(badResp))
    ;(global as any).fetch = fakeFetchAlwaysBad
    await expect(AA.fetchWithRetry('http://y', {} as any, 2, 1)).rejects.toBeInstanceOf(AA.RetryableError)
  })

  test('mapWithConcurrency preserves order and maps values', async () => {
    const items = [1, 2, 3, 4, 5]
    let active = 0
    let maxActive = 0
    // Use microtask-yield instead of timers to avoid test-timeout complexity
    const mapper = async (n: number) => {
      active++
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active--
      return n * 2
    }
    const results = await AA.mapWithConcurrency(items, mapper, 2)
    expect(results).toEqual([2, 4, 6, 8, 10])
    expect(maxActive).toBeGreaterThanOrEqual(1)
  })
})
/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/git/abstractAdapter.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import * as Adapter from '../../../src/git/abstractAdapter.ts'

describe('abstractAdapter - coverage focused tests', () => {
  it('classifyStatus: various statuses', () => {
    expect(Adapter.classifyStatus(200)).toBe(false)
    expect(Adapter.classifyStatus(429)).toBe(true)
    expect(Adapter.classifyStatus(500)).toBe(true)
    expect(Adapter.classifyStatus(499)).toBe(false)
  })

  it('getDelayForResponse uses Retry-After header when present', () => {
    const headers = { get: (_: string) => '2' }
    const res = { headers } as any
    const d = Adapter.getDelayForResponse(res as any, 0, 100)
    expect(d).toBe(2000)
  })

  it('processResponseWithDelay returns response when ok', async () => {
    const r = { ok: true, status: 200, text: async () => 'ok', headers: { get: (_: string) => null } } as any
    const out = await Adapter.processResponseWithDelay(r, 0, 1)
    expect(out).toBe(r)
  })

  it('processResponseWithDelay throws RetryableError on retryable status', async () => {
    // Avoid real delay by temporarily replacing setTimeout to call immediately
    const realSetTimeout = (global as any).setTimeout
    ;(global as any).setTimeout = (fn: any) => {
      try {
        fn()
      } finally {
        // noop
      }
      return 0 as any
    }
    const r = { ok: false, status: 500, text: async () => 'err', headers: { get: (_: string) => null } } as any
    await expect(Adapter.processResponseWithDelay(r, 0, 1)).rejects.toThrow(Adapter.RetryableError)
    ;(global as any).setTimeout = realSetTimeout
  })

  it('fetchWithRetry throws RetryableError when fetch always fails', async () => {
    ;(global as any).fetch = jest.fn().mockRejectedValue(new Error('network'))
    await expect(Adapter.fetchWithRetry('http://x', {} as any, 1, 1)).rejects.toThrow(Adapter.RetryableError)
    delete (global as any).fetch
  })

  it('mapWithConcurrency preserves order and maps correctly', async () => {
    const items = [1, 2, 3]
    const mapper = async (n: number) => n * 2
    const out = await Adapter.mapWithConcurrency(items, mapper, 1)
    expect(out).toEqual([2, 4, 6])
  })
})
