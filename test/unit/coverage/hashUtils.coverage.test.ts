import { jest } from '@jest/globals'
import * as hashUtils from '../../../src/virtualfs/hashUtils'

function hexStringToArrayBuffer(hex: string) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytes.buffer
}

describe('hashUtils (coverage)', () => {
  const fixedHex = '0102030405'
  const fixedBuffer = hexStringToArrayBuffer(fixedHex)

  beforeEach(() => {
    // mock crypto.subtle.digest
    ;(global as any).crypto = {
      subtle: {
        digest: jest.fn().mockResolvedValue(fixedBuffer)
      }
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
    // cleanup global crypto
    try { delete (global as any).crypto } catch (_) {}
  })

  it('shaOf returns hex string corresponding to digest buffer', async () => {
    const h = await hashUtils.shaOf('abc')
    expect(h).toBe('0102030405')
    expect((global as any).crypto.subtle.digest).toHaveBeenCalledWith('SHA-1', expect.any(Uint8Array))
  })

  it('shaOfGitBlob passes merged header+body to digest and returns hex', async () => {
    let lastData: ArrayBuffer | undefined
    ;(global as any).crypto.subtle.digest = jest.fn().mockImplementation(async (_alg: any, data: ArrayBuffer) => {
      lastData = data
      return fixedBuffer
    })
    const res = await hashUtils.shaOfGitBlob('abc')
    expect(res).toBe('0102030405')
    // header is `blob 3\0` (7 bytes) + body 3 bytes => total 10
    expect((lastData as ArrayBuffer).byteLength).toBeGreaterThanOrEqual(10)
  })
})

export {}
/*
 coverage: purpose=increase-branch-and-function-coverage
 file: src/virtualfs/hashUtils.ts
 generated-by: assistant
*/
import { jest } from '@jest/globals'
import * as Hash from '../../../src/virtualfs/hashUtils.ts'

describe('hashUtils - coverage focused tests', () => {
  it('shaOf returns hex string from crypto.subtle.digest', async () => {
    const fakeBuffer = new Uint8Array([0x12, 0x34]).buffer
    ;(global as any).crypto = { subtle: { digest: jest.fn().mockResolvedValue(fakeBuffer) } }
    const res = await Hash.shaOf('dummy')
    expect(res).toBe('1234')
    ;(global as any).crypto = (global as any).crypto && undefined
  })

  it('shaOfGitBlob computes hash for blob content using underlying shaOf', async () => {
    const fakeBuffer = new Uint8Array([0xab, 0xcd]).buffer
    ;(global as any).crypto = { subtle: { digest: jest.fn().mockResolvedValue(fakeBuffer) } }
    const res = await Hash.shaOfGitBlob('content')
    expect(res).toBe('abcd')
    ;(global as any).crypto = (global as any).crypto && undefined
  })
})
