import type { Middleware, SetState } from '../core'

export function logger<T extends object>(options: {
  collapsed?: boolean
  diff?: boolean
} = {}): Middleware<T> {
  return (api) => (next) => (updater) => {
    const prev = api.getState()
    next(updater)
    const nextState = api.getState()

    const group = options.collapsed ? console.groupCollapsed : console.group
    group('[nonestore] state update')
    console.log('%cprev', 'color: #7c7c7c; font-weight: bold', prev)
    console.log('%cnext', 'color: #2d8f4e; font-weight: bold', nextState)

    if (options.diff) {
      const diff = Object.fromEntries(
        Object.entries(nextState as object).filter(([key, value]) => !Object.is(value, (prev as any)[key]))
      )
      if (Object.keys(diff).length > 0) {
        console.log('%cdiff', 'color: #2979ff; font-weight: bold', diff)
      }
    }

    console.groupEnd()
  }
}

export function validate<T extends object>(
  validator: (state: T) => string | undefined | null
): Middleware<T> {
  return (api) => (next) => (updater) => {
    next(updater)
    const error = validator(api.getState())
    if (error) {
      throw new Error(`[nonestore] validation failed: ${error}`)
    }
  }
}

export function dedup<T extends object>(): Middleware<T> {
  return () => (next) => (updater) => {
    next(updater)
  }
}

export function batch<T extends object>(): Middleware<T> {
  let queued = false
  let pending: SetState<T> extends (updater: infer U) => void ? U | null : never = null

  return () => (next) => (updater) => {
    pending = updater
    if (queued) return

    queued = true
    queueMicrotask(() => {
      queued = false
      if (pending) {
        next(pending)
        pending = null
      }
    })
  }
}

export function timeTravel<T extends object>(maxHistory = 50) {
  const past: T[] = []
  const future: T[] = []
  let storeRef: { getState: () => T; setState: (updater: (state: T) => void) => void } | null = null
  let replaying = false

  const middleware: Middleware<T> = (api) => {
    storeRef = api as typeof storeRef

    return (next) => (updater) => {
      if (!replaying) {
        past.push(structuredClone(api.getState()))
        if (past.length > maxHistory) {
          past.shift()
        }
        future.length = 0
      }

      next(updater)
    }
  }

  const undo = () => {
    if (!storeRef || past.length === 0) return

    replaying = true
    const current = structuredClone(storeRef.getState())
    const prev = past.pop() as T
    future.unshift(current)
    storeRef.setState((draft) => {
      Object.assign(draft as object, prev)
    })
    replaying = false
  }

  const redo = () => {
    if (!storeRef || future.length === 0) return

    replaying = true
    const current = structuredClone(storeRef.getState())
    const nextState = future.shift() as T
    past.push(current)
    storeRef.setState((draft) => {
      Object.assign(draft as object, nextState)
    })
    replaying = false
  }

  return {
    middleware,
    undo,
    redo,
    history: () => [...past],
  }
}
