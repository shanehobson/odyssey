import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
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

// Mock auth service
vi.mock('@/features/auth/services/auth.service', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    confirmEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    resendConfirmation: vi.fn(),
    logout: vi.fn(),
  }
}))

// Mock trips API
vi.mock('@/features/trips/api/client', () => ({
  tripsApi: {
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  }
}))

// Mock billing API
vi.mock('@/features/billing/api/billing', () => ({
  getBillingStatus: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

// Mock billing hooks
vi.mock('@/features/billing/data/useBillingStatus', () => ({
  useBillingStatus: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useUpgradeToPro: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useManageSubscription: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

// Mock fetch globally to prevent network requests in tests
global.fetch = vi.fn()