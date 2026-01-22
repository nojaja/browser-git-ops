[**browser-git-ops v0.0.2**](../../../README.md)

***

[browser-git-ops](../../../modules.md) / [virtualfs/types](../README.md) / Change

# Type Alias: Change

> **Change** = \{ `content`: `string`; `path`: `string`; `type`: `"create"`; \} \| \{ `baseSha`: `string`; `content`: `string`; `path`: `string`; `type`: `"update"`; \} \| \{ `baseSha`: `string`; `path`: `string`; `type`: `"delete"`; \}

Defined in: [src/virtualfs/types.ts:33](https://github.com/nojaja/browser-git-ops/blob/b65f459a68a6c65247fcf1e92989a52f4563d596/src/virtualfs/types.ts#L33)
