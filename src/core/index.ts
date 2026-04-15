import { Draft, createDraft, finishDraft, produce } from 'immer'

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

export type Listener<T> = (state: T, prevState: T) => void
export type Selector<T, S = unknown> = (state: T) => S
export type ComputedDef<T extends object> = Record<string, (state: T) => unknown>
export type ActionDef<T extends object> = Record<string, (state: Draft<T>, ...args: any[]) => void | Promise<void>>

export type InferComputed<C extends ComputedDef<any>> = {
  readonly [K in keyof C]: ReturnType<C[K]>
}

export type InferActions<A extends ActionDef<any>> = {
  [K in keyof A]: A[K] extends (state: any, ...args: infer P) => infer R
  ? (...args: P) => R
  : never
}

export type SetState<T extends object> = (
  updater: ((state: Draft<T>) => void) | DeepPartial<T>
) => void

export type Middleware<T extends object> = (
  api: MiddlewareAPI<T>
) => (next: SetState<T>) => SetState<T>

export type MiddlewareAPI<T extends object> = {
  getState: () => T
  setState: SetState<T>
}

export type StoreConfigShape<T extends object> = {
  computed?: ComputedDef<T>
  actions?: ActionDef<T>
  middlewares?: Middleware<T>[]
  devtools?: boolean
  persist?: PersistConfig<T>
}

export type StoreConfig<
  T extends object,
  C extends ComputedDef<T> = {},
  A extends ActionDef<T> = {}
> = Omit<StoreConfigShape<T>, 'computed' | 'actions'> & {
  computed?: C
  actions?: A
}

export type PersistConfig<T> = {
  key: string
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  pick?: readonly (keyof T)[]
  serialize?: (state: Partial<T>) => string
  deserialize?: (raw: string) => Partial<T>
}

export type Store<
  T extends object,
  C extends ComputedDef<T> = {},
  A extends ActionDef<T> = {}
> = {
  getState: () => T & InferComputed<C>
  subscribe: <S = T & InferComputed<C>>(
    listener: Listener<T & InferComputed<C>>,
    selector?: Selector<T & InferComputed<C>, S>
  ) => () => void
  setState: SetState<T>
  actions: InferActions<A>
  destroy: () => void
}

type Subscription<T> = {
  listener: Listener<T>
  selector?: Selector<T, unknown>
  selected?: unknown
}

type DevtoolsConnection<T> = {
  push: (snapshot: T) => void
  cleanup: () => void
}

function pickState<T extends object>(state: T, keys?: readonly (keyof T)[]): Partial<T> {
  if (!keys) return state

  const result = {} as Partial<T>
  for (const key of keys) {
    result[key] = state[key]
  }
  return result
}

function shallowMerge<T extends object>(draft: Draft<T>, patch: DeepPartial<T>) {
  Object.assign(draft as object, patch)
}

function createSnapshotBuilder<T extends object, C extends ComputedDef<T>>(
  getState: () => T,
  computed: C
) {
  return (): T & InferComputed<C> => {
    const state = getState()
    const computedEntries = Object.entries(computed).map(([key, compute]) => [key, compute(state)])
    return {
      ...state,
      ...Object.fromEntries(computedEntries),
    } as T & InferComputed<C>
  }
}

function connectDevtools<T extends object>(name: string, getState: () => T): DevtoolsConnection<T> | null {
  if (typeof window === 'undefined') return null

  const extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__
  if (!extension) return null

  const devtools = extension.connect({ name })
  devtools.init(getState())

  return {
    push: (snapshot) => devtools.send({ type: '@@STATE' }, snapshot),
    cleanup: () => devtools.disconnect(),
  }
}

export function create<
  T extends object,
  const C extends ComputedDef<T> = {},
  const A extends ActionDef<T> = {}
>(
  initialState: T,
  config: (StoreConfig<T, C, A> & StoreConfigShape<T>) | undefined = {}
): Store<T, C, A> {
  const { computed = {} as C, actions = {} as A, middlewares = [], devtools = false, persist } = config

  let state = { ...initialState } as T
  const subscriptions = new Set<Subscription<T & InferComputed<C>>>()
  const buildSnapshot = createSnapshotBuilder(() => state, computed)

  const persistStorage =
    persist?.storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined)

  if (persist && persistStorage) {
    try {
      const raw = persistStorage.getItem(persist.key)
      if (raw) {
        const restored = (persist.deserialize ?? JSON.parse)(raw)
        state = { ...state, ...restored }
      }
    } catch {
      // Ignore malformed persisted state so store creation stays resilient.
    }
  }

  const devtoolsConnection = devtools ? connectDevtools('nonestore', buildSnapshot) : null

  const notify = (prevSnapshot: T & InferComputed<C>) => {
    const nextSnapshot = buildSnapshot()

    for (const sub of subscriptions) {
      if (!sub.selector) {
        sub.listener(nextSnapshot, prevSnapshot)
        continue
      }

      const nextSelected = sub.selector(nextSnapshot)
      if (!Object.is(nextSelected, sub.selected)) {
        sub.selected = nextSelected
        sub.listener(nextSnapshot, prevSnapshot)
      }
    }

    if (persist && persistStorage) {
      try {
        const serialized = (persist.serialize ?? JSON.stringify)(pickState(state, persist.pick))
        persistStorage.setItem(persist.key, serialized)
      } catch {
        // Ignore persistence failures to avoid breaking state updates.
      }
    }

    devtoolsConnection?.push(nextSnapshot)
  }

  const baseSetState: SetState<T> = (updater) => {
    const prevSnapshot = buildSnapshot()
    const nextState =
      typeof updater === 'function'
        ? produce(state, updater as (draft: Draft<T>) => void)
        : produce(state, (draft) => shallowMerge(draft, updater))

    if (Object.is(nextState, state)) return

    state = nextState
    notify(prevSnapshot)
  }

  let setState: SetState<T> = baseSetState

  const middlewareAPI: MiddlewareAPI<T> = {
    getState: () => state,
    setState: (updater) => setState(updater),
  }

  setState = middlewares.reduceRight<SetState<T>>(
    (next, middleware) => middleware(middlewareAPI)(next),
    baseSetState
  )

  const boundActions = Object.fromEntries(
    Object.entries(actions).map(([name, action]) => {
      const bound = (...args: unknown[]) => {
        const loadingKey = `${name}Loading` as keyof T
        const errorKey = `${name}Error` as keyof T
        const trackAsync = action.constructor.name === 'AsyncFunction'

        if (!trackAsync) {
          setState((draft) => {
            void (action as (state: Draft<T>, ...args: unknown[]) => void)(draft, ...args)
          })
          return
        }

        return (async () => {
          if (loadingKey in state) {
            setState((draft) => {
              ; (draft as Record<string, unknown>)[loadingKey as string] = true
            })
          }

          if (errorKey in state) {
            setState((draft) => {
              ; (draft as Record<string, unknown>)[errorKey as string] = null
            })
          }

          try {
            const draft = createDraft(state)
            await (action as (state: Draft<T>, ...args: unknown[]) => Promise<void>)(draft, ...args)
            const nextState = finishDraft(draft) as T

            if (!Object.is(nextState, state)) {
              const prevSnapshot = buildSnapshot()
              state = nextState
              notify(prevSnapshot)
            }
          } catch (error) {
            if (errorKey in state) {
              setState((draft) => {
                ; (draft as Record<string, unknown>)[errorKey as string] = error
              })
            }
            throw error
          } finally {
            if (loadingKey in state) {
              setState((draft) => {
                ; (draft as Record<string, unknown>)[loadingKey as string] = false
              })
            }
          }
        })()
      }

      return [name, bound]
    })
  ) as InferActions<A>

  return {
    getState: buildSnapshot,
    subscribe: (listener, selector) => {
      const subscription: Subscription<T & InferComputed<C>> = {
        listener,
        selector,
        selected: selector ? selector(buildSnapshot()) : undefined,
      }
      subscriptions.add(subscription)
      return () => {
        subscriptions.delete(subscription)
      }
    },
    setState,
    actions: boundActions,
    destroy: () => {
      subscriptions.clear()
      devtoolsConnection?.cleanup()
    },
  }
}
