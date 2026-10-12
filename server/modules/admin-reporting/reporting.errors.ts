export class ReportingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'INVALID_REPORT',
  ) {
    super(message)
  }
}
