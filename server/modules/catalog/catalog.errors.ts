export class CatalogServiceError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = 'CATALOG_ERROR',
    public details?: unknown,
  ) {
    super(message)
    this.name = 'CatalogServiceError'
  }
}
