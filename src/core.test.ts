import { describe, expect, it, vi } from 'vitest'
import { create } from './index'

describe('create', () => {
  it('updates state, computes derived values, and notifies selectors', () => {
    const store = create(
      { count: 0 },
      {
        computed: {
          doubled: (state: { count: number }) => state.count * 2,
        },
        actions: {
          increment: (state: { count: number }) => {
            state.count += 1
          },
        },
      }
    )

    const listener = vi.fn()
    store.subscribe(listener, (state) => state.count)

    store.actions.increment()

    expect(store.getState().count).toBe(1)
    expect(store.getState().doubled).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('persists selected state after updates', () => {
    const storage = (() => {
      const map = new Map<string, string>()
      return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
          map.set(key, value)
        },
        removeItem: (key: string) => {
          map.delete(key)
        },
      }
    })()

    const store = create(
      { count: 0, theme: 'light' },
      {
        persist: {
          key: 'settings',
          pick: ['theme'],
          storage,
        },
      }
    )

    store.setState({ count: 2, theme: 'dark' })

    expect(storage.getItem('settings')).toBe(JSON.stringify({ theme: 'dark' }))
  })
})
