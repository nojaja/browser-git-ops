import { jest } from '@jest/globals'

type RouteEntry = {
  // match function receiving request url and init, return boolean
  match?: string | RegExp;
  // if match is omitted, applies as default/fallback
  response: {
    status?: number;
    body?: string;
    headers?: Record<string,string>;
  } | ((input?: any, init?: any) => { status?: number; body?: string; headers?: Record<string,string> });
}

let _mock: jest.Mock | null = null

export function configureFetchMock(entries: RouteEntry[]) {
  // create an ordered mock that checks entries in sequence
  _mock = jest.fn().mockImplementation(async (input: any, init: any) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''

    const make = (status:number, body:string, hdrs?:Record<string,string>) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status >= 200 && status < 300 ? 'OK' : 'ERR',
      headers: { get: (k:string) => (hdrs || {})[k.toLowerCase()] },
      text: async () => body,
      json: async () => JSON.parse(body),
      clone() { return this }
    })

    for (const e of entries) {
      const produce = (resp:any) => make(resp.status ?? 200, resp.body ?? '', resp.headers)
      if (!e.match) {
        const resp = typeof e.response === 'function' ? e.response(input, init) : e.response
        return produce(resp)
      }
      if (typeof e.match === 'string') {
        if (url.includes(e.match)) {
          const resp = typeof e.response === 'function' ? e.response(input, init) : e.response
          return produce(resp)
        }
      } else {
        if (e.match.test(url)) {
          const resp = typeof e.response === 'function' ? e.response(input, init) : e.response
          return produce(resp)
        }
      }
    }
    return make(404, '')
  })

  ;(global as any).fetch = _mock
  return _mock
}

export function clearFetchMock() {
  try {
    if ((global as any).fetch && (global as any).fetch.mockRestore) (global as any).fetch.mockRestore()
  } catch (_) {}
  ;(global as any).fetch = undefined
  _mock = null
}

export default { configureFetchMock, clearFetchMock }
