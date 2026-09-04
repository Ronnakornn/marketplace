import type { Shipment } from '#generated/client/client.ts'
import type { ShipmentStatus } from '#generated/client/enums.ts'

export type BuyerShipmentProgressSnapshot = Pick<
  Shipment,
  'status' | 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt'
>

export interface BuyerShipmentTimelineEvent {
  status: 'pending_pack' | 'packed' | 'shipped' | 'delivered'
  label: string
  timestamp: Date
}

export function formatBuyerShipmentStatus(status: ShipmentStatus): string {
  return status === 'PENDING_PACK' ? 'pending_pack' : status.toLowerCase()
}

export function buildBuyerShipmentTimeline(
  shipment: BuyerShipmentProgressSnapshot,
): BuyerShipmentTimelineEvent[] {
  const timeline: BuyerShipmentTimelineEvent[] = [{
    status: 'pending_pack',
    label: 'Seller is preparing your order',
    timestamp: shipment.createdAt,
  }]

  if (shipment.status === 'PACKED' || shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
    timeline.push({
      status: 'packed',
      label: 'Seller packed your order',
      timestamp: shipment.updatedAt,
    })
  }

  if ((shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') && shipment.shippedAt) {
    timeline.push({
      status: 'shipped',
      label: 'Your parcel has been shipped',
      timestamp: shipment.shippedAt,
    })
  }

  if (shipment.status === 'DELIVERED' && shipment.deliveredAt) {
    timeline.push({ status: 'delivered', label: 'Delivered', timestamp: shipment.deliveredAt })
  }

  return timeline
}
