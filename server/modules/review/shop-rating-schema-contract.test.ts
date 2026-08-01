import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shop rating schema contract', () => {
  it('keeps moderation audit fields and indexes for shop ratings', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

    expect(schema).toContain('model ShopRating {')
    expect(schema).toContain('moderatedAt      DateTime?')
    expect(schema).toContain('moderatedById    String?      @db.Uuid')
    expect(schema).toContain('moderationReason String?')
    expect(schema).toContain('@relation("ShopRatingModeratedBy", fields: [moderatedById], references: [id], onDelete: SetNull)')
    expect(schema).toContain('@@index([status, moderatedAt])')
    expect(schema).toContain('@@index([moderatedById])')
  })

  it('keeps reverse moderation relation on user model', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

    expect(schema).toContain('moderatedShopRatings            ShopRating[]             @relation("ShopRatingModeratedBy")')
  })
})
