import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createStore } from './index'

describe('createStore', () => {
  it('re-renders consumers when selected state changes', () => {
    const [useCounter, counterStore] = createStore(
      { count: 0 },
      {
        actions: {
          increment: (state: { count: number }) => {
            state.count += 1
          },
        },
      }
    )

    function Counter() {
      const count = useCounter((state) => state.count)
      return <span data-testid="count">{count}</span>
    }

    render(<Counter />)
    expect(screen.getByTestId('count').textContent).toBe('0')

    act(() => {
      counterStore.actions.increment()
    })

    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})
