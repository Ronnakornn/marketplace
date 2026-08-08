import { cache } from 'react'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { prisma } from '#server/lib/prisma.ts'
import { PrismaSellerShopRepository } from './seller-shop.repository.ts'
import { SellerShopService } from './seller-shop.service.ts'

const environment = process.env.NODE_ENV ?? 'development'
const appContext = { config: { environment }, logger: createLogger({ environment }) }
const service = new SellerShopService(appContext, new PrismaSellerShopRepository(appContext, prisma))

export const getPublicStorefront = cache((identifier: string, locale: 'th' | 'en', viewerId?: string) =>
  service.getPublicStorefront(identifier, locale, viewerId))
