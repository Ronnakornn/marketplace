import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { prisma } from '#server/lib/prisma.ts'
import { PrismaCartRepository } from '#server/modules/cart/cart.repository.ts'
import { CartService } from '#server/modules/cart/cart.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaNotificationRepository } from '#server/modules/notification/notification.repository.ts'
import { NotificationService } from '#server/modules/notification/notification.service.ts'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'
import { RefundService } from '#server/modules/refund/refund.service.ts'
import { PrismaOrderRepository } from '#server/modules/order/order.repository.ts'
import { OrderService } from '#server/modules/order/order.service.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { PrismaSearchRepository } from '#server/modules/search/search.repository.ts'
import { SearchService } from '#server/modules/search/search.service.ts'
import { PrismaSellerDashboardRepository } from '#server/modules/seller/seller-dashboard.repository.ts'
import { SellerDashboardService } from '#server/modules/seller/seller-dashboard.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaReviewRepository } from '#server/modules/review/review.repository.ts'
import { ReviewService } from '#server/modules/review/review.service.ts'
import { PrismaUserRepository } from '#server/modules/user/user.repository.ts'
import { UserService } from '#server/modules/user/user.service.ts'
import { PrismaUploadRepository } from '#server/modules/upload/upload.repository.ts'
import { UploadService } from '#server/modules/upload/upload.service.ts'
import { getStorageConfigFromEnv, S3UploadStorage } from '#server/modules/upload/upload.storage.ts'

export interface AppConfig {
  environment: string
}

export interface AppContext {
  logger: ILogger
  config: AppConfig
}

export interface ServiceContainer {
  appContext: AppContext
  adminService: AdminService
  cartService: CartService
  checkoutService: CheckoutService
  catalogService: CatalogService
  notificationService: NotificationService
  orderService: OrderService
  paymentService: PaymentService
  promotionService: PromotionService
  refundService: RefundService
  returnService: ReturnService
  reviewService: ReviewService
  searchService: SearchService
  sellerDashboardService: SellerDashboardService
  shipmentService: ShipmentService
  uploadService: UploadService
  userService: UserService
}

export function createContainer(): ServiceContainer {
  const environment = process.env['NODE_ENV'] ?? 'development'
  const logger = createLogger({ environment })
  const config: AppConfig = { environment }
  const appContext: AppContext = { logger, config }

  const adminRepo = new PrismaAdminRepository(appContext, prisma)
  const adminService = new AdminService(appContext, adminRepo)
  const cartRepo = new PrismaCartRepository(appContext, prisma)
  const cartService = new CartService(appContext, cartRepo)
  const promotionRepo = new PrismaPromotionRepository(appContext, prisma)
  const promotionService = new PromotionService(appContext, promotionRepo)
  const checkoutRepo = new PrismaCheckoutRepository(appContext, prisma)
  const checkoutService = new CheckoutService(appContext, checkoutRepo, promotionService)
  const notificationRepo = new PrismaNotificationRepository(appContext, prisma)
  const notificationService = new NotificationService(appContext, notificationRepo)
  const catalogRepo = new PrismaCatalogRepository(appContext, prisma)
  const catalogService = new CatalogService(appContext, catalogRepo)
  const orderRepo = new PrismaOrderRepository(appContext, prisma)
  const orderService = new OrderService(appContext, orderRepo)
  const shipmentRepo = new PrismaShipmentRepository(appContext, prisma)
  const shipmentService = new ShipmentService(appContext, shipmentRepo)
  const paymentRepo = new PrismaPaymentRepository(appContext, prisma)
  const paymentService = new PaymentService(appContext, paymentRepo, shipmentService)
  const returnRepo = new PrismaReturnRepository(appContext, prisma)
  const returnService = new ReturnService(appContext, returnRepo)
  const refundRepo = new PrismaRefundRepository(appContext, prisma)
  const refundService = new RefundService(appContext, refundRepo)
  const reviewRepo = new PrismaReviewRepository(appContext, prisma)
  const reviewService = new ReviewService(appContext, reviewRepo)
  const searchRepo = new PrismaSearchRepository(appContext, prisma)
  const searchService = new SearchService(appContext, searchRepo)
  const sellerDashboardRepo = new PrismaSellerDashboardRepository(appContext, prisma)
  const sellerDashboardService = new SellerDashboardService(appContext, sellerDashboardRepo)
  const uploadRepo = new PrismaUploadRepository(appContext, prisma)
  const storageConfig = getStorageConfigFromEnv()
  const uploadStorage = storageConfig ? new S3UploadStorage(storageConfig) : null
  const uploadService = new UploadService(appContext, uploadRepo, uploadStorage)
  const userRepo = new PrismaUserRepository(appContext, prisma)
  const userService = new UserService(appContext, userRepo)

  return {
    appContext,
    adminService,
    cartService,
    checkoutService,
    catalogService,
    notificationService,
    orderService,
    paymentService,
    promotionService,
    refundService,
    returnService,
    reviewService,
    searchService,
    sellerDashboardService,
    shipmentService,
    uploadService,
    userService,
  }
}
