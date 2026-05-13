import { treaty } from '@elysiajs/eden'
import type { App } from '#server/index'

const apiBaseUrl =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    : window.location.origin

export const api = treaty<App>(apiBaseUrl, {
  fetch: { credentials: 'include' },
})
