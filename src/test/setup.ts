import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The whole suite runs in parallel; the default 1 s wait is too short on a busy machine.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})
