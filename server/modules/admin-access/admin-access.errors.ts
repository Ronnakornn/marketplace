export class AdminAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AdminAccessError'
  }
}
