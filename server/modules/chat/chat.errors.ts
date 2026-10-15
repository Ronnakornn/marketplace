import { ParseError } from 'elysia'

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ChatServiceError'
  }
}

export function isChatParserError(error: unknown): boolean {
  return error instanceof ParseError && error.cause instanceof ChatServiceError
}
