import type { PrismaClient, SellerProfile, Shop, ShopSetting } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type SellerProfileRecord = Pick<SellerProfile, 'id' | 'userId' | 'maxShopCount'>

export type SellerOwnedShopRecord = Pick<
  Shop,
  | 'id'
  | 'ownerId'
  | 'name'
  | 'slug'
  | 'status'
  | 'contactEmail'
  | 'contactPhone'
  | 'description'
  | 'descriptionTh'
  | 'descriptionEn'
  | 'logoUrl'
  | 'coverUrl'
  | 'metaTitle'
  | 'metaDescription'
  | 'createdAt'
  | 'updatedAt'
>

export type SellerShopSettingRecord = Pick<
  ShopSetting,
  | 'id'
  | 'shopId'
  | 'autoAcceptOrder'
  | 'allowCod'
  | 'chatEnabled'
  | 'vacationMode'
  | 'defaultShippingProvider'
  | 'returnPolicy'
  | 'shippingPolicy'
  | 'returnPolicyTh'
  | 'returnPolicyEn'
  | 'shippingPolicyTh'
  | 'shippingPolicyEn'
  | 'version'
  | 'updatedAt'
>

export interface SellerShopProfileUpdateInput {
  name?: string
  slug?: string
  contactEmail?: string
  contactPhone?: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface SellerShopSettingUpdateInput {
  autoAcceptOrder?: boolean
  allowCod?: boolean
  chatEnabled?: boolean
  vacationMode?: boolean
  defaultShippingProvider?: string | null
  returnPolicy?: string | null
  shippingPolicy?: string | null
  returnPolicyTh?: string | null
  returnPolicyEn?: string | null
  shippingPolicyTh?: string | null
  shippingPolicyEn?: string | null
}

export interface ISellerShopRepository {
  findSellerProfileByUserId(userId: string): Promise<SellerProfileRecord | null>
  listOwnedShops(userId: string): Promise<SellerOwnedShopRecord[]>
  findOwnedShopById(userId: string, shopId: string): Promise<SellerOwnedShopRecord | null>
  findOwnedActiveShopById(userId: string, shopId: string): Promise<SellerOwnedShopRecord | null>
  findShopBySlug(slug: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'slug'> | null>
  updateShopProfile(shopId: string, input: SellerShopProfileUpdateInput): Promise<SellerOwnedShopRecord>
  findShopSettings(shopId: string): Promise<SellerShopSettingRecord | null>
  upsertShopSettings(shopId: string, input: SellerShopSettingUpdateInput): Promise<SellerShopSettingRecord>
}

const ownedShopSelect = {
  id: true,
  ownerId: true,
  name: true,
  slug: true,
  status: true,
  contactEmail: true,
  contactPhone: true,
  description: true,
  descriptionTh: true,
  descriptionEn: true,
  logoUrl: true,
  coverUrl: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true,
} as const

const shopSettingSelect = {
  id: true,
  shopId: true,
  autoAcceptOrder: true,
  allowCod: true,
  chatEnabled: true,
  vacationMode: true,
  defaultShippingProvider: true,
  returnPolicy: true,
  shippingPolicy: true,
  returnPolicyTh: true,
  returnPolicyEn: true,
  shippingPolicyTh: true,
  shippingPolicyEn: true,
  version: true,
  updatedAt: true,
} as const

export class PrismaSellerShopRepository implements ISellerShopRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findSellerProfileByUserId(userId: string): Promise<SellerProfileRecord | null> {
    this.logger.debug('PrismaSellerShopRepository.findSellerProfileByUserId', { userId })
    return this.prisma.sellerProfile.findUnique({
      where: { userId },
      select: { id: true, userId: true, maxShopCount: true },
    })
  }

  listOwnedShops(userId: string): Promise<SellerOwnedShopRecord[]> {
    this.logger.debug('PrismaSellerShopRepository.listOwnedShops', { userId })
    return this.prisma.shop.findMany({
      where: { ownerId: userId },
      select: ownedShopSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
  }

  findOwnedShopById(userId: string, shopId: string): Promise<SellerOwnedShopRecord | null> {
    this.logger.debug('PrismaSellerShopRepository.findOwnedShopById', { userId, shopId })
    return this.prisma.shop.findFirst({
      where: { id: shopId, ownerId: userId },
      select: ownedShopSelect,
    })
  }

  findOwnedActiveShopById(userId: string, shopId: string): Promise<SellerOwnedShopRecord | null> {
    this.logger.debug('PrismaSellerShopRepository.findOwnedActiveShopById', { userId, shopId })
    return this.prisma.shop.findFirst({
      where: { id: shopId, ownerId: userId, status: 'ACTIVE' },
      select: ownedShopSelect,
    })
  }

  findShopBySlug(slug: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'slug'> | null> {
    this.logger.debug('PrismaSellerShopRepository.findShopBySlug', { slug })
    return this.prisma.shop.findFirst({
      where: { slug },
      select: { id: true, ownerId: true, slug: true },
    })
  }

  updateShopProfile(shopId: string, input: SellerShopProfileUpdateInput): Promise<SellerOwnedShopRecord> {
    this.logger.info('PrismaSellerShopRepository.updateShopProfile', { shopId, fields: Object.keys(input) })
    return this.prisma.shop.update({
      where: { id: shopId },
      data: input,
      select: ownedShopSelect,
    })
  }

  findShopSettings(shopId: string): Promise<SellerShopSettingRecord | null> {
    this.logger.debug('PrismaSellerShopRepository.findShopSettings', { shopId })
    return this.prisma.shopSetting.findUnique({
      where: { shopId },
      select: shopSettingSelect,
    })
  }

  upsertShopSettings(shopId: string, input: SellerShopSettingUpdateInput): Promise<SellerShopSettingRecord> {
    this.logger.info('PrismaSellerShopRepository.upsertShopSettings', { shopId, fields: Object.keys(input) })
    return this.prisma.shopSetting.upsert({
      where: { shopId },
      create: { shopId, ...input },
      update: input,
      select: shopSettingSelect,
    })
  }
}
