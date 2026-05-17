export type AiSearchErrorCode =
  | 'AI_SEARCH_DISABLED'
  | 'VECTOR_SEARCH_UNAVAILABLE'
  | 'INVALID_AI_QUERY'
  | 'AI_ASSISTANT_FAILED'

export class AiSearchServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: AiSearchErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AiSearchServiceError'
  }
}
