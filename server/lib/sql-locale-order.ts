import { Prisma } from '#generated/client/client.ts'

export function localeSortKey(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${value} COLLATE "marketplace_locale_compare"`
}
