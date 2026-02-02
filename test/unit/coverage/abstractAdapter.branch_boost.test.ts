import { jest } from '@jest/globals'
import * as AA from '../../../src/git/abstractAdapter'

// 1) ファイル内の分岐を列挙
// - getDelayForResponse: response === null | headers.get exists | headers as object | headers.get throws
// - processResponseWithDelay: response.ok true | retryable (>=500 or 429) | non-retryable (other)
// - fetchWithRetry: fetch resolves ok | fetch rejects (exhaust retries -> wraps Error)
// - mapWithConcurrency: concurrency >= items.length | concurrency < items.length

// 2) 分岐表 (入力 -> 期待結果)
const delayCases = [
  { name: 'null response', response: null, idx: 0, base: 100, expectFn: (v: number) => expect(typeof v).toBe('number') },
  { name: 'headers.get returns value', response: { headers: { get: () => '2' } } as any, idx: 1, base: 100, expectFn: (v: number) => expect(v).toBe(2000) },
  { name: 'headers plain object', response: { headers: { 'Retry-After': '3' } } as any, idx: 2, base: 100, expectFn: (v: number) => expect(v).toBe(3000) },
  { name: 'headers.get throws', response: { headers: { get: () => { throw new Error('boom') } } } as any, idx: 0, base: 50, expectFn: (v: number) => expect(typeof v).toBe('number') }
]

describe('AbstractAdapter branch boost (table-driven)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getDelayForResponse table-driven cases', () => {
    delayCases.forEach((c) => {
      const d = AA.getDelayForResponse((c as any).response, c.idx, c.base)
      c.expectFn(d)
    })
  })

  it('processResponseWithDelay: ok, retryable and non-retryable paths', async () => {
    // ok path
    const okResp = { ok: true, status: 200 } as any
    await expect(AA.processResponseWithDelay(okResp, 0, 1)).resolves.toBe(okResp)

    // retryable path (status 500)
    const retryResp = { ok: false, status: 500, text: async () => 'x' } as any
    await expect(AA.processResponseWithDelay(retryResp, 0, 1)).rejects.toThrow(AA.RetryableError)

    // non-retryable path (status 400)
    const badResp = { ok: false, status: 400, text: async () => 'bad' } as any
    await expect(AA.processResponseWithDelay(badResp, 0, 1)).rejects.toThrow(AA.NonRetryableError)
  })

  it('fetchWithRetry: successful fetch and exhausted retries wrap', async () => {
    // success path: fetch resolves to ok response
    const realFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' } as any)
    await expect(AA.fetchWithRetry('http://x', {} as any, 2, 1)).resolves.toHaveProperty('ok', true)

    // failure path: fetch rejects -> final RetryableError
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    await expect(AA.fetchWithRetry('http://x', {} as any, 2, 1)).rejects.toThrow(AA.RetryableError)

    global.fetch = realFetch
  })

  it('mapWithConcurrency: respects concurrency', async () => {
    const items = [1, 2, 3, 4]
    const mapper = jest.fn(async (n) => n * 2)
    const res1 = await AA.mapWithConcurrency(items, mapper, 10) // concurrency > length
    expect(res1).toEqual([2, 4, 6, 8])

    const mapper2 = jest.fn(async (n) => n + 1)
    const res2 = await AA.mapWithConcurrency(items, mapper2, 2)
    expect(res2).toEqual([2, 3, 4, 5])
  })

  it('AbstractGitAdapter: logger branches, formatRequest/Response, mapWithConcurrency default', async () => {
    class TestAdapter extends (AA.default as any) {
      public callLogDebug(...m: any[]) { return (this as any).logDebug(...m) }
      public callLogInfo(...m: any[]) { return (this as any).logInfo(...m) }
      public callLogWarn(...m: any[]) { return (this as any).logWarn(...m) }
      public callLogError(...m: any[]) { return (this as any).logError(...m) }
      public callFormatRequestForLog(i: any, init: any, a: number, b: number) { return (this as any).formatRequestForLog(i, init, a, b) }
      public callFormatResponseForLog(r: any) { return (this as any).formatResponseForLog(r) }
      public callMapWithConcurrency(items: any[], mapper: any, concurrency?: number) { return (this as any).mapWithConcurrency(items, mapper, concurrency) }
    }

    // constructor options with logger branch
    const withLogger = new TestAdapter({ logger: { debug: () => {} } })
    expect((withLogger as any).logger).toBeDefined()

    // logger methods that throw should be swallowed by the adapter
    const adapter = new TestAdapter()
    const throwingLogger = {
      debug: () => { throw new Error('d') },
      info: () => { throw new Error('i') },
      warn: () => { throw new Error('w') },
      error: () => { throw new Error('e') }
    }
    adapter.setLogger(throwingLogger as any)
    expect(() => adapter.callLogDebug('x')).not.toThrow()
    expect(() => adapter.callLogInfo('x')).not.toThrow()
    expect(() => adapter.callLogWarn('x')).not.toThrow()
    expect(() => adapter.callLogError('x')).not.toThrow()

    // formatRequestForLog: non-string body and headers array path
    const reqLog = adapter.callFormatRequestForLog({ url: 'http://u' }, { method: 'POST', headers: { h: 'v' }, body: { a: 1 } }, 2, 50)
    expect(reqLog.bodyPreview).toBe('<non-string>')
    expect(reqLog.headers.h).toBe('v')
    expect(reqLog.method).toBe('POST')

    // formatResponseForLog: clone/text path
    const fakeResp = { status: 200, statusText: 'OK', headers: new Map([['h', 'v']]), clone: () => ({ text: async () => 'hello' }) }
    const respLog = await adapter.callFormatResponseForLog(fakeResp as any)
    expect(respLog.bodyPreview).toBe('hello')
    expect(respLog.headers.h).toBe('v')

    // mapWithConcurrency default arg path (call without concurrency)
    const mapped = await adapter.callMapWithConcurrency([1, 2, 3], async (n: number) => n * 3)
    expect(mapped).toEqual([3, 6, 9])
  })
})
