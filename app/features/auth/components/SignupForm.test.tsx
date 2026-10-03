/** @vitest-environment jsdom */
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SignupForm } from './SignupForm'
import { signUp } from '#/lib/auth-client'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('#/lib/auth-client', () => ({ signUp: { email: vi.fn(async () => ({ error: null })) } }))
vi.mock('./SocialSignInButtons', () => ({ SocialSignInButtons: () => null }))

describe('SignupForm hydration', () => {
  it('prevents typing into server HTML until hydrated, then preserves credentials and submits them', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const tree = <QueryClientProvider client={client}><SignupForm /></QueryClientProvider>
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const name = container.querySelector<HTMLInputElement>('#name')!
    const email = container.querySelector<HTMLInputElement>('#email')!
    const password = container.querySelector<HTMLInputElement>('#password')!
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      expect(name.disabled).toBe(true)
      expect(email.disabled).toBe(true)
      expect(password.disabled).toBe(true)
      expect(submit.disabled).toBe(true)
      await act(async () => { root = hydrateRoot(container, tree) })
      await waitFor(() => expect(email.disabled).toBe(false))
      expect(name.disabled).toBe(false)
      expect(password.disabled).toBe(false)
      expect(submit.disabled).toBe(false)
      fireEvent.change(name, { target: { value: 'Buyer Test' } })
      fireEvent.change(email, { target: { value: 'buyer@example.test' } })
      fireEvent.change(password, { target: { value: 'TestPass123!' } })
      expect(email.value).toBe('buyer@example.test')
      fireEvent.click(within(container).getByRole('button', { name: 'auth.createAccount' }))
      await waitFor(() => expect(signUp.email).toHaveBeenCalledWith({ name: 'Buyer Test', email: 'buyer@example.test', password: 'TestPass123!' }))
    } finally {
      if (root) await act(async () => { root!.unmount() })
      container.remove()
      client.clear()
    }
  })
})
