import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { validateProductionRuntimeEnv } from '#server/config/production-env.ts'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { prisma } from '#server/lib/prisma.ts'
import { PrismaCartRepository } from '#server/modules/cart/cart.repository.ts'
import { CartService } from '#server/modules/cart/cart.service.ts'
import { PrismaChatRepository } from '#server/modules/chat/chat.repository.ts'
import { ChatService } from '#server/modules/chat/chat.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import {
  AiSearchService,
  EmbeddingService,
  getAiSearchConfigFromEnv,
  PgVectorSearchAdapter,
  ShoppingAssistantService,
} from '#server/modules/ai-search'
import { AffiliateService, PrismaAffiliateRepository } from '#server/modules/affiliate'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { CommissionService } from '#server/modules/commission'
import { PayoutService, PrismaPayoutRepository } from '#server/modules/payout'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaNotificationRepository } from '#server/modules/notification/notification.repository.ts'
import { NotificationService } from '#server/modules/notification/notification.service.ts'
import { InMemoryRealtimeAdapter, PrismaRealtimeRepository, RealtimeService } from '#server/modules/realtime'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'
import { RefundService } from '#server/modules/refund/refund.service.ts'
import { PrismaOrderRepository } from '#server/modules/order/order.repository.ts'
import { OrderService } from '#server/modules/order/order.service.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { PrismaRecommendationRepository, RecommendationService } from '#server/modules/recommendation'
import { PrismaSearchRepository } from '#server/modules/search/search.repository.ts'
import { SearchService } from '#server/modules/search/search.service.ts'
import { PrismaSellerDashboardRepository } from '#server/modules/seller/seller-dashboard.repository.ts'
import { SellerDashboardService } from '#server/modules/seller/seller-dashboard.service.ts'
import { PrismaSellerShopRepository, SellerShopService } from '#server/modules/seller-shop'
import { PrismaSellerOnboardingRepository, SellerOnboardingService } from '#server/modules/seller-onboarding'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaReviewRepository } from '#server/modules/review/review.repository.ts'
import { ReviewService } from '#server/modules/review/review.service.ts'
import { PrismaShopReviewRepository, ShopReviewService } from '#server/modules/shop-review'
import { PrismaUserRepository } from '#server/modules/user/user.repository.ts'
import { UserService } from '#server/modules/user/user.service.ts'
import { PrismaUploadRepository } from '#server/modules/upload/upload.repository.ts'
import { UploadService } from '#server/modules/upload/upload.service.ts'
import { getLocalStorageConfigFromEnv, getStorageConfigFromEnv, LocalUploadStorage, S3UploadStorage } from '#server/modules/upload/upload.storage.ts'
import { PrismaWalletRepository, WalletService } from '#server/modules/wallet'
import { JobService, PrismaJobRepository } from '#server/modules/jobs'
import { EventBus, EventHandlerRegistry, EventPublisherService } from '#server/modules/event-bus'
import { createCoreCommerceEventHandlers } from '#server/modules/events'
import { createFraudEventHandlers, FraudService, getFraudRuleConfigFromEnv, PrismaFraudRepository } from '#server/modules/fraud'
import { BullMqQueueProducer, getQueueConfigFromEnv, OptionalQueueProducer, type QueueProducer } from '#server/modules/queue'
import { AuditLogService, PrismaAuditLogRepository } from '#server/modules/audit-log'
import { ActiveShopResolver, OwnershipGuards, PrismaOwnershipGuardRepository, SecurityService } from '#server/modules/security'
import { CacheInvalidation, CacheService, createRedisCacheClient, getCacheConfigFromEnv } from '#server/modules/cache'
import {
  getObservabilityConfigFromEnv,
  MetricsCollector,
  ObservabilityService,
  PrismaHealthCheckRepository,
} from '#server/modules/observability'

export interface AppConfig {
  environment: string
}

export interface AppContext {
  logger: ILogger
  config: AppConfig
}

export interface ServiceContainer {
  appContext: AppContext
  auditLogService: AuditLogService
  adminService: AdminService
  aiSearchService: AiSearchService
  affiliateService: AffiliateService
  cartService: CartService
  chatService: ChatService
  cacheInvalidation: CacheInvalidation
  cacheService: CacheService
  checkoutService: CheckoutService
  commissionService: CommissionService
  catalogService: CatalogService
  eventBus: EventBus
  eventHandlerRegistry: EventHandlerRegistry
  eventPublisherService: EventPublisherService
  fraudService: FraudService
  jobService: JobService
  notificationService: NotificationService
  realtimeService: RealtimeService
  metricsCollector: MetricsCollector
  observabilityService: ObservabilityService
  orderService: OrderService
  paymentService: PaymentService
  payoutService: PayoutService
  promotionService: PromotionService
  refundService: RefundService
  recommendationService: RecommendationService
  returnService: ReturnService
  reviewService: ReviewService
  shopReviewService: ShopReviewService
  searchService: SearchService
  securityService: SecurityService
  activeShopResolver: ActiveShopResolver
  ownershipGuards: OwnershipGuards
  sellerDashboardService: SellerDashboardService
  sellerShopService: SellerShopService
  sellerOnboardingService: SellerOnboardingService
  shipmentService: ShipmentService
  shoppingAssistantService: ShoppingAssistantService
  uploadService: UploadService
  userService: UserService
  walletService: WalletService
}

export function createContainer(): ServiceContainer {
  validateProductionRuntimeEnv()
  const environment = process.env['NODE_ENV'] ?? 'development'
  const logger = createLogger({ environment, level: process.env['LOG_LEVEL'] })
  const config: AppConfig = { environment }
  const appContext: AppContext = { logger, config }
  const observabilityConfig = getObservabilityConfigFromEnv()
  const aiSearchConfig = getAiSearchConfigFromEnv()
  const fraudRuleConfig = getFraudRuleConfigFromEnv()
  const metricsCollector = new MetricsCollector()
  const queueConfig = getQueueConfigFromEnv()
  const cacheConfig = getCacheConfigFromEnv()
  const cacheService = new CacheService(appContext, cacheConfig, createRedisCacheClient(cacheConfig))
  const cacheInvalidation = new CacheInvalidation(cacheService)
  const eventHandlerRegistry = new EventHandlerRegistry()
  const eventBus = new EventBus(appContext, eventHandlerRegistry)
  const eventPublisherService = new EventPublisherService(appContext, eventBus)
  const securityService = new SecurityService(appContext)
  const ownershipGuardRepo = new PrismaOwnershipGuardRepository(appContext, prisma)
  const activeShopResolver = new ActiveShopResolver(ownershipGuardRepo)
  const ownershipGuards = new OwnershipGuards(ownershipGuardRepo)

  const auditLogRepo = new PrismaAuditLogRepository(appContext, prisma)
  const auditLogService = new AuditLogService(appContext, auditLogRepo)
  const fraudRepo = new PrismaFraudRepository(appContext, prisma)
  const fraudService = new FraudService(appContext, fraudRepo, fraudRuleConfig, auditLogService)
  const adminRepo = new PrismaAdminRepository(appContext, prisma)
  const adminService = new AdminService(appContext, adminRepo, auditLogService)
  const affiliateRepo = new PrismaAffiliateRepository(appContext, prisma)
  const affiliateService = new AffiliateService(appContext, affiliateRepo)
  const cartRepo = new PrismaCartRepository(appContext, prisma)
  const cartService = new CartService(appContext, cartRepo)
  const realtimeRepo = new PrismaRealtimeRepository(appContext, prisma)
  const realtimeService = new RealtimeService(appContext, realtimeRepo, new InMemoryRealtimeAdapter())
  const promotionRepo = new PrismaPromotionRepository(appContext, prisma)
  const promotionService = new PromotionService(appContext, promotionRepo, activeShopResolver)
  const commissionService = new CommissionService(appContext)
  const walletRepo = new PrismaWalletRepository(appContext, prisma)
  const walletService = new WalletService(appContext, walletRepo, commissionService, activeShopResolver)
  const checkoutRepo = new PrismaCheckoutRepository(appContext, prisma)
  const checkoutService = new CheckoutService(appContext, checkoutRepo, promotionService, cacheInvalidation)
  const notificationRepo = new PrismaNotificationRepository(appContext, prisma)
  const notificationService = new NotificationService(appContext, notificationRepo, realtimeService)
  const chatRepo = new PrismaChatRepository(appContext, prisma)
  const chatService = new ChatService(appContext, chatRepo, realtimeService, notificationService)
  const catalogRepo = new PrismaCatalogRepository(appContext, prisma)
  const catalogService = new CatalogService(appContext, catalogRepo, cacheService, cacheInvalidation, eventPublisherService, activeShopResolver)
  const orderRepo = new PrismaOrderRepository(appContext, prisma)
  const orderService = new OrderService(appContext, orderRepo, activeShopResolver)
  const shipmentRepo = new PrismaShipmentRepository(appContext, prisma)
  const shipmentService = new ShipmentService(
    appContext,
    shipmentRepo,
    walletService,
    eventPublisherService,
    cacheInvalidation,
    activeShopResolver,
  )
  const paymentRepo = new PrismaPaymentRepository(appContext, prisma)
  const paymentService = new PaymentService(appContext, paymentRepo, shipmentService, cacheInvalidation, eventPublisherService, affiliateService)
  const payoutRepo = new PrismaPayoutRepository(appContext, prisma)
  const payoutService = new PayoutService(appContext, payoutRepo, eventPublisherService, activeShopResolver)
  const returnRepo = new PrismaReturnRepository(appContext, prisma)
  const returnService = new ReturnService(appContext, returnRepo, activeShopResolver)
  const refundRepo = new PrismaRefundRepository(appContext, prisma)
  const refundService = new RefundService(appContext, refundRepo, eventPublisherService)
  const recommendationRepo = new PrismaRecommendationRepository(appContext, prisma)
  const recommendationService = new RecommendationService(appContext, recommendationRepo, cacheService)
  const reviewRepo = new PrismaReviewRepository(appContext, prisma)
  const reviewService = new ReviewService(appContext, reviewRepo)
  const shopReviewRepo = new PrismaShopReviewRepository(appContext, prisma)
  const shopReviewService = new ShopReviewService(appContext, shopReviewRepo, cacheInvalidation)
  const searchRepo = new PrismaSearchRepository(appContext, prisma)
  const searchService = new SearchService(appContext, searchRepo, cacheService)
  const embeddingService = new EmbeddingService(appContext, aiSearchConfig)
  const vectorSearchAdapter = new PgVectorSearchAdapter(appContext, prisma)
  const aiSearchService = new AiSearchService(
    appContext,
    aiSearchConfig,
    embeddingService,
    vectorSearchAdapter,
    searchService,
    cacheService,
  )
  const shoppingAssistantService = new ShoppingAssistantService(appContext, aiSearchConfig, aiSearchService)
  const sellerDashboardRepo = new PrismaSellerDashboardRepository(appContext, prisma)
  const sellerDashboardService = new SellerDashboardService(appContext, sellerDashboardRepo, cacheService, activeShopResolver)
  const sellerShopRepo = new PrismaSellerShopRepository(appContext, prisma)
  const sellerShopService = new SellerShopService(appContext, sellerShopRepo)
  const sellerOnboardingRepo = new PrismaSellerOnboardingRepository(appContext, prisma)
  const sellerOnboardingService = new SellerOnboardingService(appContext, sellerOnboardingRepo)
  const uploadRepo = new PrismaUploadRepository(appContext, prisma)
  const storageConfig = getStorageConfigFromEnv()
  const uploadStorage = storageConfig ? new S3UploadStorage(storageConfig) : new LocalUploadStorage(getLocalStorageConfigFromEnv())
  const uploadService = new UploadService(appContext, uploadRepo, uploadStorage)
  const queueProducer: QueueProducer = new OptionalQueueProducer(
    queueConfig ? new BullMqQueueProducer(appContext, queueConfig) : null,
  )
  const jobRepo = new PrismaJobRepository(appContext, prisma)
  const jobService = new JobService(appContext, jobRepo, queueProducer, cacheInvalidation)
  const healthCheckRepo = new PrismaHealthCheckRepository(appContext, prisma)
  const observabilityService = new ObservabilityService(appContext, healthCheckRepo, metricsCollector, {
    metricsEnabled: observabilityConfig.metricsEnabled,
    healthCheckTimeoutMs: observabilityConfig.healthCheckTimeoutMs,
    queueConfig,
  })
  const userRepo = new PrismaUserRepository(appContext, prisma)
  const userService = new UserService(appContext, userRepo)

  eventHandlerRegistry.registerMany(createCoreCommerceEventHandlers({
    cacheInvalidation,
    notificationService,
    searchService,
    shipmentService,
  }))
  eventHandlerRegistry.registerMany(createFraudEventHandlers({ fraudService }))

  return {
    appContext,
    auditLogService,
    adminService,
    aiSearchService,
    affiliateService,
    cartService,
    chatService,
    cacheInvalidation,
    cacheService,
    checkoutService,
    commissionService,
    catalogService,
    eventBus,
    eventHandlerRegistry,
    eventPublisherService,
    fraudService,
    jobService,
    notificationService,
    realtimeService,
    metricsCollector,
    observabilityService,
    orderService,
    paymentService,
    payoutService,
    promotionService,
    refundService,
    recommendationService,
    returnService,
    reviewService,
    shopReviewService,
    searchService,
    securityService,
    activeShopResolver,
    ownershipGuards,
    sellerDashboardService,
    sellerShopService,
    sellerOnboardingService,
    shipmentService,
    shoppingAssistantService,
    uploadService,
    userService,
    walletService,
  }
}
