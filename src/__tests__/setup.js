import '@testing-library/jest-dom'

// Mock localStorage for all tests
const store = {}
const localStorageMock = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, value) => { store[key] = String(value) }),
  removeItem: vi.fn((key) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Reset between tests
afterEach(() => {
  localStorageMock.clear()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})

// Mock import.meta.env
if (!import.meta.env.BASE_URL) {
  import.meta.env.BASE_URL = '/chemistry-astar/'
}
if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
  import.meta.env.VITE_ANTHROPIC_API_KEY = 'test-key-for-testing'
}
