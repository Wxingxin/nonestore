import { createStore } from '../src'

const [useCounter, counterStore] = createStore(
  {
    count: 0,
    incrementLoading: false,
    incrementError: null as unknown,
  },
  {
    computed: {
      doubled: (state: { count: number }) => state.count * 2,
    },
    actions: {
      increment: (state: { count: number }) => {
        state.count += 1
      },
      add: (state: { count: number }, amount: number) => {
        state.count += amount
      },
    },
  }
)

export function CounterDemo() {
  const count = useCounter((state) => state.count)
  const doubled = useCounter((state) => state.doubled)

  return (
    <div>
      <p>count: {count}</p>
      <p>doubled: {doubled}</p>
      <button onClick={() => counterStore.actions.increment()}>increment</button>
      <button onClick={() => counterStore.actions.add(5)}>add 5</button>
    </div>
  )
}
