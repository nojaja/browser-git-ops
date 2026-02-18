[browser-git-ops - v0.0.7](../README.md) / Logger

# Interface: Logger

Simple logger interface for dependency injection.
If a caller injects an object matching this interface, the adapter
will forward debug/info/warn/error messages to it. If no logger is
provided, no logging will be performed by the adapter.

## Table of contents

### Properties

- [debug](Logger.md#debug)
- [error](Logger.md#error)
- [info](Logger.md#info)
- [warn](Logger.md#warn)

## Properties

### debug

• **debug**: (...`_messages`: `any`[]) => `void`

#### Type declaration

▸ (`..._messages`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

##### Returns

`void`

#### Defined in

[git/abstractAdapter.ts:14](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/abstractAdapter.ts#L14)

___

### error

• **error**: (...`_messages`: `any`[]) => `void`

#### Type declaration

▸ (`..._messages`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

##### Returns

`void`

#### Defined in

[git/abstractAdapter.ts:17](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/abstractAdapter.ts#L17)

___

### info

• **info**: (...`_messages`: `any`[]) => `void`

#### Type declaration

▸ (`..._messages`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

##### Returns

`void`

#### Defined in

[git/abstractAdapter.ts:15](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/abstractAdapter.ts#L15)

___

### warn

• **warn**: (...`_messages`: `any`[]) => `void`

#### Type declaration

▸ (`..._messages`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `..._messages` | `any`[] |

##### Returns

`void`

#### Defined in

[git/abstractAdapter.ts:16](https://github.com/nojaja/browser-git-ops/blob/ed9802aefd83cce9f3aa141ec064f36631d72fe5/src/git/abstractAdapter.ts#L16)
