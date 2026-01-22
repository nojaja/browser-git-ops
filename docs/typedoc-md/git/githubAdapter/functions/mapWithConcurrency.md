[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [git/githubAdapter](../README.md) / mapWithConcurrency

# Function: mapWithConcurrency()

> **mapWithConcurrency**\<`T`, `R`\>(`items`, `mapper`, `concurrency`): `Promise`\<`R`[]\>

Defined in: [src/git/githubAdapter.ts:81](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/git/githubAdapter.ts#L81)

非同期マップを並列実行するユーティリティ

## Type Parameters

### T

`T`

### R

`R`

## Parameters

### items

`T`[]

入力配列

### mapper

(`_t`) => `Promise`\<`R`\>

マッピング関数

### concurrency

`number` = `5`

同時実行数

## Returns

`Promise`\<`R`[]\>
