# nonestore

A small React state management library with an Immer-powered mutation model, typed actions, computed state, and pluggable middleware.

## Status

This repository is now structured for GitHub and npm publishing, but you still need to replace the placeholder GitHub URLs in `package.json` before the first publish.

## Install

```bash
npm install nonestore immer
```

Peer dependencies:

```bash
npm install react react-dom
```

## Quick start

```tsx
import { createStore } from 'nonestore'

const [useCounter, counterStore] = createStore(
  { count: 0 },
  {
    actions: {
      increment: (state) => {
        state.count += 1
      },
      add: (state, amount: number) => {
        state.count += amount
      },
    },
  }
)

export function Counter() {
  const count = useCounter((state) => state.count)
  return <button onClick={() => counterStore.actions.increment()}>{count}</button>
}
```

## API

### `create(initialState, config?)`

Creates a framework-agnostic store.

```ts
import { create } from 'nonestore'

const store = create(
  { count: 0 },
  {
    computed: {
      doubled: (state) => state.count * 2,
    },
    actions: {
      increment: (state) => {
        state.count += 1
      },
    },
  }
)
```

Core methods:

- `store.getState()`
- `store.setState(updater)`
- `store.subscribe(listener, selector?)`
- `store.actions.someAction()`
- `store.destroy()`

### `createStore(initialState, config?)`

Creates a store and returns a bound React hook.

```tsx
const [useShop, shopStore] = createStore(initialState, config)
const total = useShop((state) => state.total)
```

## Middleware

Built-in middleware exports:

- `logger()`
- `validate()`
- `timeTravel()`
- `batch()`
- `dedup()`

Example:

```ts
import { createStore, logger, validate } from 'nonestore'

const [useSettings] = createStore(
  { theme: 'light' },
  {
    middlewares: [
      logger({ collapsed: true, diff: true }),
      validate((state) => {
        if (!state.theme) return 'theme is required'
      }),
    ],
  }
)
```

## Persistence

`persist` writes after every state change and hydrates on store creation.

```ts
const store = create(
  { theme: 'light' },
  {
    persist: {
      key: 'settings',
      pick: ['theme'],
    },
  }
)
```

## Local development

```bash
npm install
npm run lint
npm run test
npm run build
```

## Release checklist

1. Replace the placeholder GitHub URLs in `package.json`.
2. Fill in `author` in `package.json`.
3. Update `LICENSE` copyright holder.
4. Run `npm login`.
5. Verify the publish payload with `npm pack`.
6. Publish with `npm publish`.

If you want CI before publishing, GitHub Actions is already included in `.github/workflows/ci.yml`.
