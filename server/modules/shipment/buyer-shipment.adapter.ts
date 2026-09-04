import type { BuyerShipment } from './shipment.repository.ts'
import type { BuyerShipmentProgressSnapshot } from './buyer-shipment-projection.ts'

type BuyerShipmentProgressSource = Pick<
  BuyerShipment,
  'status' | 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt'
>

export function adaptBuyerShipmentProgress(
  shipment: BuyerShipmentProgressSource,
): BuyerShipmentProgressSnapshot {
  return {
    status: shipment.status,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
  }
}
