// Test setup file for Vitest
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock window.matchMedia for tests
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})