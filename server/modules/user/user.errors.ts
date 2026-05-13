export class UserServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'UserServiceError'
  }
}
