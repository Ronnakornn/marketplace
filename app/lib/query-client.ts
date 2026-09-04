import { QueryClient, type Query } from '@tanstack/react-query'
import { ApiClientError } from '#/lib/api-client'

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 1) return false
  if (!(error instanceof ApiClientError) || error.status === undefined) return true

  const isPermanentClientError = error.status >= 400
    && error.status < 500
    && error.status !== 408
    && error.status !== 429

  return !isPermanentClientError
}

export function shouldRefetchQueryOnWindowFocus(query: Query) {
  return query.state.error ? shouldRetryQuery(0, query.state.error) : true
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: shouldRefetchQueryOnWindowFocus,
      },
    },
  })
}
