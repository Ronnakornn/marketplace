export class AdminOperationsError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
    readonly code = 'ADMIN_OPERATIONS_INVALID',
  ) {
    super(message)
  }
}
