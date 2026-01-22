[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [git/githubAdapter](../README.md) / fetchWithRetry

# Function: fetchWithRetry()

> **fetchWithRetry**(`input`, `init`, `attempts`, `baseDelay`): `Promise`\<`Response`\>

Defined in: [src/git/githubAdapter.ts:38](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L38)

fetch を再試行付きで実行するユーティリティ。
5xx や 429 はリトライ対象、それ以外は NonRetryableError を投げる。

## Parameters

### input

`RequestInfo`

RequestInfo

### init

`RequestInit`

RequestInit

### attempts

`number` = `4`

試行回数

### baseDelay

`number` = `300`

ベースの遅延(ms)

## Returns

`Promise`\<`Response`\>
