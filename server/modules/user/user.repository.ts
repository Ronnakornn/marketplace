import type { Account, Address, FavoriteProduct, PrismaClient, Product, ProductVariant, Shop, ShopFollow, User, Verification } from '#generated/client/client.ts'
import type { Role, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type AdminUserListItem = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'updatedAt'
>

export type UserProfile = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'status' | 'emailVerified' | 'phone' | 'phoneVerified' | 'image' | 'createdAt' | 'updatedAt'
>

export interface UpdateAdminUserData {
  name?: string
  email?: string
  role?: Role
  status?: UserStatus
}

export interface UpdateCurrentUserData {
  name?: string
  image?: string | null
  phone?: string | null
  phoneVerified?: boolean
}

export interface CreateVerificationData {
  identifier: string
  value: string
  expiresAt: Date
}

export type BuyerAddress = Address
export type FavoriteProductRecord = FavoriteProduct & {
  product: Product & {
    shop: Pick<Shop, 'id' | 'name' | 'slug'>
    variants: ProductVariant[]
  }
}
export type ShopFollowRecord = ShopFollow & {
  shop: Shop & {
    products: Array<Product & { variants: ProductVariant[] }>
    _count: { followers: number; products: number }
  }
}

export interface AddressData {
  recipientName: string
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  region?: string | null
  postalCode: string
  country: string
  isDefault?: boolean
}

export interface IUserRepository {
  findManyForAdmin(): Promise<AdminUserListItem[]>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByPhone(phone: string): Promise<User | null>
  countAdmins(excludeUserId?: string): Promise<number>
  updateUser(id: string, data: UpdateAdminUserData): Promise<User>
  updateCurrentUser(id: string, data: UpdateCurrentUserData): Promise<UserProfile>
  markEmailVerified(userId: string): Promise<User>
  createVerification(data: CreateVerificationData): Promise<Verification>
  findVerification(identifier: string, value: string): Promise<Verification | null>
  deleteVerificationsByIdentifier(identifier: string): Promise<void>
  deleteVerification(id: string): Promise<void>
  findCredentialAccount(userId: string): Promise<Account | null>
  updateCredentialPassword(accountId: string, passwordHash: string): Promise<Account>
  delete(id: string): Promise<User>
  promoteByEmails(emails: string[]): Promise<number>
  listAddresses(userId: string): Promise<BuyerAddress[]>
  findAddress(userId: string, addressId: string): Promise<BuyerAddress | null>
  createAddress(userId: string, data: AddressData): Promise<BuyerAddress>
  updateAddress(userId: string, addressId: string, data: Partial<AddressData>): Promise<BuyerAddress>
  deleteAddress(userId: string, addressId: string): Promise<BuyerAddress>
  setDefaultAddress(userId: string, addressId: string): Promise<BuyerAddress>
  listFavoriteProducts(userId: string): Promise<FavoriteProductRecord[]>
  findFavoriteProduct(userId: string, productId: string): Promise<FavoriteProduct | null>
  addFavoriteProduct(userId: string, productId: string): Promise<FavoriteProduct>
  removeFavoriteProduct(userId: string, productId: string): Promise<void>
  listFollowedShops(userId: string): Promise<ShopFollowRecord[]>
  findShopFollow(userId: string, shopId: string): Promise<ShopFollow | null>
  followShop(userId: string, shopId: string): Promise<ShopFollow>
  unfollowShop(userId: string, shopId: string): Promise<void>
}

export class PrismaUserRepository implements IUserRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findManyForAdmin(): Promise<AdminUserListItem[]> {
    this.logger.debug('PrismaUserRepository.findManyForAdmin')
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string): Promise<User | null> {
    this.logger.debug('PrismaUserRepository.findById', { id })
    return this.prisma.user.findUnique({ where: { id } })
  }

  findByEmail(email: string): Promise<User | null> {
    this.logger.debug('PrismaUserRepository.findByEmail', { email })
    return this.prisma.user.findUnique({ where: { email } })
  }

  findByPhone(phone: string): Promise<User | null> {
    this.logger.debug('PrismaUserRepository.findByPhone')
    return this.prisma.user.findUnique({ where: { phone } })
  }

  countAdmins(excludeUserId?: string): Promise<number> {
    this.logger.debug('PrismaUserRepository.countAdmins', { excludeUserId })
    return this.prisma.user.count({
      where: {
        role: 'ADMIN',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    })
  }

  updateUser(id: string, data: UpdateAdminUserData): Promise<User> {
    this.logger.info('PrismaUserRepository.updateUser', { id, data })
    return this.prisma.user.update({
      where: { id },
      data,
    })
  }

  updateCurrentUser(id: string, data: UpdateCurrentUserData): Promise<UserProfile> {
    this.logger.info('PrismaUserRepository.updateCurrentUser', { id })
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  markEmailVerified(userId: string): Promise<User> {
    this.logger.info('PrismaUserRepository.markEmailVerified', { userId })
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    })
  }

  createVerification(data: CreateVerificationData): Promise<Verification> {
    this.logger.info('PrismaUserRepository.createVerification', { identifier: data.identifier, expiresAt: data.expiresAt })
    return this.prisma.verification.create({ data })
  }

  findVerification(identifier: string, value: string): Promise<Verification | null> {
    this.logger.debug('PrismaUserRepository.findVerification', { identifier })
    return this.prisma.verification.findFirst({ where: { identifier, value } })
  }

  async deleteVerificationsByIdentifier(identifier: string): Promise<void> {
    this.logger.info('PrismaUserRepository.deleteVerificationsByIdentifier', { identifier })
    await this.prisma.verification.deleteMany({ where: { identifier } })
  }

  async deleteVerification(id: string): Promise<void> {
    this.logger.info('PrismaUserRepository.deleteVerification', { id })
    await this.prisma.verification.delete({ where: { id } })
  }

  findCredentialAccount(userId: string): Promise<Account | null> {
    this.logger.debug('PrismaUserRepository.findCredentialAccount', { userId })
    return this.prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
        password: { not: null },
      },
    })
  }

  updateCredentialPassword(accountId: string, passwordHash: string): Promise<Account> {
    this.logger.info('PrismaUserRepository.updateCredentialPassword', { accountId })
    return this.prisma.account.update({
      where: { id: accountId },
      data: { password: passwordHash },
    })
  }

  delete(id: string): Promise<User> {
    this.logger.info('PrismaUserRepository.delete', { id })
    return this.prisma.user.delete({ where: { id } })
  }

  async promoteByEmails(emails: string[]): Promise<number> {
    this.logger.info('PrismaUserRepository.promoteByEmails', { count: emails.length })
    if (emails.length === 0) return 0
    const result = await this.prisma.user.updateMany({
      where: { email: { in: emails } },
      data: { role: 'ADMIN' },
    })
    return result.count
  }

  listAddresses(userId: string): Promise<BuyerAddress[]> {
    this.logger.debug('PrismaUserRepository.listAddresses', { userId })
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  findAddress(userId: string, addressId: string): Promise<BuyerAddress | null> {
    this.logger.debug('PrismaUserRepository.findAddress', { userId, addressId })
    return this.prisma.address.findFirst({
      where: { id: addressId, userId },
    })
  }

  createAddress(userId: string, data: AddressData): Promise<BuyerAddress> {
    this.logger.info('PrismaUserRepository.createAddress', { userId, isDefault: data.isDefault })
    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({ where: { userId } })
      const makeDefault = data.isDefault === true || existingCount === 0
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
      }
      return tx.address.create({
        data: {
          userId,
          ...data,
          isDefault: makeDefault,
        },
      })
    })
  }

  updateAddress(userId: string, addressId: string, data: Partial<AddressData>): Promise<BuyerAddress> {
    this.logger.info('PrismaUserRepository.updateAddress', { userId, addressId })
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
      }
      return tx.address.update({
        where: { id: addressId },
        data,
      })
    })
  }

  deleteAddress(userId: string, addressId: string): Promise<BuyerAddress> {
    this.logger.info('PrismaUserRepository.deleteAddress', { userId, addressId })
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.address.delete({ where: { id: addressId } })
      if (deleted.isDefault) {
        const replacement = await tx.address.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        })
        if (replacement) {
          await tx.address.update({ where: { id: replacement.id }, data: { isDefault: true } })
        }
      }
      return deleted
    })
  }

  setDefaultAddress(userId: string, addressId: string): Promise<BuyerAddress> {
    this.logger.info('PrismaUserRepository.setDefaultAddress', { userId, addressId })
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })
    })
  }

  listFavoriteProducts(userId: string): Promise<FavoriteProductRecord[]> {
    this.logger.debug('PrismaUserRepository.listFavoriteProducts', { userId })
    return this.prisma.favoriteProduct.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            shop: { select: { id: true, name: true, slug: true } },
            variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  findFavoriteProduct(userId: string, productId: string): Promise<FavoriteProduct | null> {
    return this.prisma.favoriteProduct.findUnique({
      where: { userId_productId: { userId, productId } },
    })
  }

  addFavoriteProduct(userId: string, productId: string): Promise<FavoriteProduct> {
    this.logger.info('PrismaUserRepository.addFavoriteProduct', { userId, productId })
    return this.prisma.favoriteProduct.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    })
  }

  async removeFavoriteProduct(userId: string, productId: string): Promise<void> {
    this.logger.info('PrismaUserRepository.removeFavoriteProduct', { userId, productId })
    await this.prisma.favoriteProduct.deleteMany({ where: { userId, productId } })
  }

  listFollowedShops(userId: string): Promise<ShopFollowRecord[]> {
    this.logger.debug('PrismaUserRepository.listFollowedShops', { userId })
    return this.prisma.shopFollow.findMany({
      where: { userId },
      include: {
        shop: {
          include: {
            _count: { select: { followers: true, products: true } },
            products: {
              where: { status: 'ACTIVE' },
              include: { variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
              orderBy: { createdAt: 'desc' },
              take: 4,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  findShopFollow(userId: string, shopId: string): Promise<ShopFollow | null> {
    return this.prisma.shopFollow.findUnique({
      where: { userId_shopId: { userId, shopId } },
    })
  }

  followShop(userId: string, shopId: string): Promise<ShopFollow> {
    this.logger.info('PrismaUserRepository.followShop', { userId, shopId })
    return this.prisma.shopFollow.upsert({
      where: { userId_shopId: { userId, shopId } },
      create: { userId, shopId },
      update: {},
    })
  }

  async unfollowShop(userId: string, shopId: string): Promise<void> {
    this.logger.info('PrismaUserRepository.unfollowShop', { userId, shopId })
    await this.prisma.shopFollow.deleteMany({ where: { userId, shopId } })
  }
}
