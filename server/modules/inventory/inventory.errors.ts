export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'INVENTORY_ERROR',
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'InventoryServiceError'
  }
}
