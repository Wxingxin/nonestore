import { useSyncExternalStore } from 'react'
import { create } from '../core'
import type { ActionDef, ComputedDef, Selector, Store, StoreConfig, StoreConfigShape } from '../core'

export function useStore<
  T extends object,
  C extends ComputedDef<T>,
  A extends ActionDef<T>,
  S = ReturnType<Store<T, C, A>['getState']>
>(
  store: Store<T, C, A>,
  selector?: Selector<ReturnType<Store<T, C, A>['getState']>, S>
): S {
  return useSyncExternalStore(
    (onStoreChange) => store.subscribe(() => onStoreChange(), selector),
    () => {
      const snapshot = store.getState()
      return selector ? selector(snapshot) : (snapshot as S)
    },
    () => {
      const snapshot = store.getState()
      return selector ? selector(snapshot) : (snapshot as S)
    }
  )
}

export function createStore<
  T extends object,
  const C extends ComputedDef<T> = {},
  const A extends ActionDef<T> = {}
>(
  initialState: T,
  config?: StoreConfig<T, C, A> & StoreConfigShape<T>
): [
    <S = ReturnType<Store<T, C, A>['getState']>>(
      selector?: Selector<ReturnType<Store<T, C, A>['getState']>, S>
    ) => S,
    Store<T, C, A>
  ] {
  const store = create(initialState, config)

  function useBoundStore<S = ReturnType<Store<T, C, A>['getState']>>(
    selector?: Selector<ReturnType<Store<T, C, A>['getState']>, S>
  ): S {
    return useStore(store, selector)
  }

  return [useBoundStore, store]
}
