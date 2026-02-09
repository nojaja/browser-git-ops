import { jest } from '@jest/globals'
import * as aa from '../../../src/git/abstractAdapter'
import {
  classifyStatus,
  getDelayForResponse,
  processResponseWithDelay,
  fetchWithRetry,
  RetryableError,
  NonRetryableError,
  mapWithConcurrency
} from '../../../src/git/abstractAdapter'

describe('abstractAdapter extra coverage', () => {
  afterEach(() => jest.resetAllMocks())

  it('classifyStatus true for 429 and 5xx, false otherwise', () => {
    expect(classifyStatus(200)).toBe(false)
    expect(classifyStatus(429)).toBe(true)
    expect(classifyStatus(500)).toBe(true)
    expect(classifyStatus(499)).toBe(false)
  })

  it('getDelayForResponse uses headers.get Retry-After when present', () => {
    const resp: any = { headers: { get: jest.fn().mockImplementation((k: string) => (k === 'Retry-After' ? '2' : null)) } }
    const d = getDelayForResponse(resp as any, 0, 100)
    expect(d).toBe(2000)
  })

  it('getDelayForResponse supports plain header object with Retry-After property', () => {
    const resp: any = { headers: { 'Retry-After': '3' } }
    const d = getDelayForResponse(resp as any, 0, 100)
    expect(d).toBe(3000)
  })

  it('processResponseWithDelay returns response when ok', async () => {
    const resp: any = { ok: true }
    const out = await processResponseWithDelay(resp as any, 0, 10)
    expect(out).toBe(resp)
  })

  it('processResponseWithDelay throws RetryableError for retryable status', async () => {
    // avoid waiting by making setTimeout invoke immediately
    const origSetTimeout = (global as any).setTimeout
    ;(global as any).setTimeout = (cb: any) => { cb(); return 0 }
    try {
      const resp: any = { ok: false, status: 500, text: jest.fn() }
      await expect(processResponseWithDelay(resp as any, 0, 1)).rejects.toBeInstanceOf(RetryableError)
    } finally {
      ;(global as any).setTimeout = origSetTimeout
    }
  })

  it('processResponseWithDelay throws NonRetryableError with response text', async () => {
    const resp: any = { ok: false, status: 404, text: jest.fn().mockResolvedValue('notfound') }
    await expect(processResponseWithDelay(resp as any, 0, 1)).rejects.toThrow(NonRetryableError)
  })

  it('fetchWithRetry retries on thrown fetch and succeeds when fetch later resolves', async () => {
    const okResp: any = { ok: true, status: 200, text: jest.fn().mockResolvedValue('ok'), headers: { get: () => null } }
    let call = 0
    ;(global as any).fetch = jest.fn().mockImplementation(() => {
      call++
      if (call === 1) return Promise.reject(new Error('boom'))
      return Promise.resolve(okResp)
    })
    const res = await fetchWithRetry('http://x', {})
    expect(res).toBe(okResp)
    expect((global as any).fetch).toHaveBeenCalled()
  })

  it('fetchWithRetry throws RetryableError when fetch always fails', async () => {
    ;(global as any).fetch = jest.fn().mockRejectedValue(new Error('nope'))
    await expect(fetchWithRetry('http://x', {}, 2, 1)).rejects.toBeInstanceOf(RetryableError)
  })

  it('mapWithConcurrency preserves order', async () => {
    const items = [1, 2, 3, 4]
    const mapper = async (n: number) => {
      await new Promise((r) => setTimeout(r, 1))
      return n * 2
    }
    const res = await mapWithConcurrency(items, mapper, 2)
    expect(res).toEqual([2, 4, 6, 8])
  })
})

export {}
