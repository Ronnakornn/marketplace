import type { OrderShipment } from './order.repository.ts'
import type { BuyerShipmentProgressSnapshot } from '#server/modules/shipment/buyer-shipment-projection.ts'

type OrderShipmentProgressSource = Pick<
  OrderShipment,
  'status' | 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt'
>

export function adaptOrderShipmentProgress(
  shipment: OrderShipmentProgressSource,
): BuyerShipmentProgressSnapshot {
  return {
    status: shipment.status,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
  }
}
