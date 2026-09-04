import { describe, expect, it } from 'vitest'
import {
  buildBuyerShipmentTimeline,
  formatBuyerShipmentStatus,
} from './buyer-shipment-projection.ts'
import { adaptOrderShipmentProgress } from '#server/modules/order/buyer-shipment.adapter.ts'
import { adaptBuyerShipmentProgress } from './buyer-shipment.adapter.ts'

describe('Buyer Shipment projection', () => {
  it('projects one delivered shipment snapshot into the buyer timeline', () => {
    const createdAt = new Date('2026-09-01T08:00:00.000Z')
    const updatedAt = new Date('2026-09-01T09:00:00.000Z')
    const shippedAt = new Date('2026-09-01T10:00:00.000Z')
    const deliveredAt = new Date('2026-09-02T10:00:00.000Z')

    const snapshot = {
      status: 'DELIVERED',
      createdAt,
      updatedAt,
      shippedAt,
      deliveredAt,
    } as const

    expect(adaptOrderShipmentProgress(snapshot)).toEqual(snapshot)
    expect(adaptOrderShipmentProgress(snapshot)).not.toBe(snapshot)
    expect(adaptBuyerShipmentProgress(snapshot)).toEqual(snapshot)
    expect(adaptBuyerShipmentProgress(snapshot)).not.toBe(snapshot)
    expect(buildBuyerShipmentTimeline(adaptOrderShipmentProgress(snapshot))).toEqual([
      { status: 'pending_pack', label: 'Seller is preparing your order', timestamp: createdAt },
      { status: 'packed', label: 'Seller packed your order', timestamp: updatedAt },
      { status: 'shipped', label: 'Your parcel has been shipped', timestamp: shippedAt },
      { status: 'delivered', label: 'Delivered', timestamp: deliveredAt },
    ])
    expect(formatBuyerShipmentStatus('PENDING_PACK')).toBe('pending_pack')
  })
})
