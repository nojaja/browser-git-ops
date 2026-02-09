import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { classifyStatus, getDelayForResponse, processResponseWithDelay, mapWithConcurrency, RetryableError, NonRetryableError } from '../../src/git/abstractAdapter'

describe('abstractAdapter helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('classifyStatus handles retryable statuses', () => {
    expect(classifyStatus(500)).toBe(true)
    expect(classifyStatus(429)).toBe(true)
    expect(classifyStatus(200)).toBe(false)
    expect(classifyStatus(404)).toBe(false)
  })

  it('getDelayForResponse uses exponential backoff when response is null', () => {
    const base = 200
    const d = getDelayForResponse(null, 1, base)
    const min = base * Math.pow(2, 1)
    expect(d).toBeGreaterThanOrEqual(min)
    expect(d).toBeLessThan(min + 200)
  })

  it('getDelayForResponse reads Retry-After from headers.get', () => {
    const resp: any = { headers: { get: (_: string) => '3' }, status: 503 }
    const d = getDelayForResponse(resp as any, 0, 100)
    expect(d).toBe(3000)
  })

  it('getDelayForResponse reads Retry-After from plain header object', () => {
    const resp: any = { headers: { 'Retry-After': '4' }, status: 503 }
    const d = getDelayForResponse(resp as any, 0, 100)
    expect(d).toBe(4000)
  })

  it('processResponseWithDelay returns ok response', async () => {
    const okResp: any = { ok: true, status: 200, text: async () => 'ok', statusText: 'OK', headers: {} }
    const res = await processResponseWithDelay(okResp as any, 0, 10)
    expect(res).toBe(okResp)
  })

  it('processResponseWithDelay throws NonRetryableError on 400', async () => {
    const badResp: any = { ok: false, status: 400, text: async () => 'bad', statusText: 'ERR', headers: {} }
    await expect(processResponseWithDelay(badResp as any, 0, 10)).rejects.toThrow(NonRetryableError)
  })

  it('mapWithConcurrency maps items concurrently', async () => {
    const items = [1, 2, 3, 4]
    const mapper = async (n: number) => n * 2
    const res = await mapWithConcurrency(items, mapper, 2)
    expect(res).toEqual([2, 4, 6, 8])
  })
})
