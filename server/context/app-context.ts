import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { validateProductionRuntimeEnv } from '#server/config/production-env.ts'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { createEmailService } from '#server/modules/email'
import { prisma } from '#server/lib/prisma.ts'
import { AdminAccessRepository, AdminAccessService } from '#server/modules/admin-access'
import { AdminConfigRepository, AdminConfigService } from '#server/modules/admin-config'
import { AdminReportingRepository } from '#server/modules/admin-reporting/reporting.repository.ts'
import { AdminReportingService } from '#server/modules/admin-reporting/reporting.service.ts'
import { OrderDocumentsService } from '#server/modules/admin-reporting/order-documents.service.ts'
import { CatalogImportRepository } from '#server/modules/catalog-import/catalog-import.repository.ts'
import { CatalogImportService } from '#server/modules/catalog-import/catalog-import.service.ts'
import { CatalogBulkRepository } from '#server/modules/catalog/catalog-bulk.repository.ts'
import { CatalogApprovalRepository } from '#server/modules/catalog/catalog-approval.repository.ts'
import { AdminOperationsService, PrismaAdminOperationsRepository } from '#server/modules/admin-operations'
import { AdminDirectoryRepository } from '#server/modules/admin-directory/admin-directory.repository.ts'
import { AdminDirectoryService } from '#server/modules/admin-directory/admin-directory.service.ts'
import { CouponTargetsRepository } from '#server/modules/promotion/coupon-targets.repository.ts'
import { CouponTargetsService } from '#server/modules/promotion/coupon-targets.service.ts'
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
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { DiscoveryService, PrismaDiscoveryRepository } from '#server/modules/discovery'
import { InventoryService, PrismaInventoryRepository } from '#server/modules/inventory'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { CommissionService } from '#server/modules/commission'
import { PayoutService, PrismaPayoutRepository } from '#server/modules/payout'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaNotificationRepository } from '#server/modules/notification/notification.repository.ts'
import { NotificationService } from '#server/modules/notification/notification.service.ts'
import { getPushConfigFromEnv, PrismaPushRepository, PushService } from '#server/modules/notification'
import { createRealtimeAdapter, PrismaRealtimeRepository, RealtimeService } from '#server/modules/realtime'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'
import { RefundService } from '#server/modules/refund/refund.service.ts'
import { PrismaOrderRepository } from '#server/modules/order/order.repository.ts'
import { OrderService } from '#server/modules/order/order.service.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { SupportService, PrismaSupportRepository } from '#server/modules/support'
import { PrismaRecommendationRepository, RecommendationService } from '#server/modules/recommendation'
import { PrismaSearchRepository } from '#server/modules/search/search.repository.ts'
import { SearchService } from '#server/modules/search/search.service.ts'
import { PrismaTrackingRepository, TrackingService } from '#server/modules/tracking'
import { PrismaSellerDashboardRepository } from '#server/modules/seller/seller-dashboard.repository.ts'
import { SellerDashboardService } from '#server/modules/seller/seller-dashboard.service.ts'
import { PrismaSellerShopRepository, PrismaShopStaffRepository, SellerShopService, ShopStaffService } from '#server/modules/seller-shop'
import { PrismaSellerOnboardingRepository, SellerOnboardingService } from '#server/modules/seller-onboarding'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaReviewRepository } from '#server/modules/review/review.repository.ts'
import { ReviewService } from '#server/modules/review/review.service.ts'
import { PrismaShopReviewRepository, ShopReviewService } from '#server/modules/shop-review'
import { PrismaProductQuestionRepository, ProductQuestionService } from '#server/modules/product-question'
import { PrismaProductAnalyticsRepository, ProductAnalyticsService } from '#server/modules/product-analytics'
import { PrismaUserRepository } from '#server/modules/user/user.repository.ts'
import { UserService } from '#server/modules/user/user.service.ts'
import { PrismaUploadRepository } from '#server/modules/upload/upload.repository.ts'
import { UploadService } from '#server/modules/upload/upload.service.ts'
import { createUploadStorageFromEnv } from '#server/modules/upload/upload.storage.ts'
import { PrismaWalletRepository, WalletService } from '#server/modules/wallet'
import { JobService, PrismaJobRepository } from '#server/modules/jobs'
import { EventBus, EventHandlerRegistry, EventPublisherService } from '#server/modules/event-bus'
import { createCoreCommerceEventHandlers } from '#server/modules/events'
import { createFraudEventHandlers, FraudService, getFraudRuleConfigFromEnv, PrismaFraudRepository } from '#server/modules/fraud'
import { BullMqQueueProducer, getQueueConfigFromEnv, OptionalQueueProducer, type QueueProducer } from '#server/modules/queue'
import { AuditLogService, PrismaAuditLogRepository } from '#server/modules/audit-log'
import { ContentModerationService, PrismaContentModerationRepository } from '#server/modules/content-moderation'
import { createPhoneOtpProvider, PhoneOtpService, PrismaPhoneOtpRepository } from '#server/modules/auth'
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
  adminAccessService: AdminAccessService
  adminConfigService: AdminConfigService
  adminReportingService: AdminReportingService
  orderDocumentsService: OrderDocumentsService
  catalogImportService: CatalogImportService
  adminOperationsService: AdminOperationsService
  adminDirectoryService: AdminDirectoryService
  couponTargetsService: CouponTargetsService
  aiSearchService: AiSearchService
  affiliateService: AffiliateService
  cartService: CartService
  chatService: ChatService
  cacheInvalidation: CacheInvalidation
  cacheService: CacheService
  contentModerationService: ContentModerationService
  checkoutService: CheckoutService
  commissionService: CommissionService
  catalogService: CatalogService
  discoveryService: DiscoveryService
  eventBus: EventBus
  eventHandlerRegistry: EventHandlerRegistry
  eventPublisherService: EventPublisherService
  fraudService: FraudService
  inventoryService: InventoryService
  jobService: JobService
  notificationService: NotificationService
  pushService: PushService
  realtimeService: RealtimeService
  metricsCollector: MetricsCollector
  observabilityService: ObservabilityService
  orderService: OrderService
  paymentService: PaymentService
  payoutService: PayoutService
  phoneOtpService: PhoneOtpService
  productQuestionService: ProductQuestionService
  productAnalyticsService: ProductAnalyticsService
  promotionService: PromotionService
  refundService: RefundService
  recommendationService: RecommendationService
  returnService: ReturnService
  supportService: SupportService
  reviewService: ReviewService
  shopReviewService: ShopReviewService
  searchService: SearchService
  securityService: SecurityService
  activeShopResolver: ActiveShopResolver
  ownershipGuards: OwnershipGuards
  sellerDashboardService: SellerDashboardService
  sellerShopService: SellerShopService
  shopStaffService: ShopStaffService
  sellerOnboardingService: SellerOnboardingService
  shipmentService: ShipmentService
  shoppingAssistantService: ShoppingAssistantService
  trackingService: TrackingService
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
  const adminAccessService = new AdminAccessService(new AdminAccessRepository(prisma))
  const adminConfigService = new AdminConfigService(new AdminConfigRepository(prisma), adminAccessService)
  const adminReportingService = new AdminReportingService(new AdminReportingRepository(prisma), adminAccessService)
  const orderDocumentsService = new OrderDocumentsService(prisma, adminAccessService)
  const adminDirectoryService = new AdminDirectoryService(new AdminDirectoryRepository(prisma), adminAccessService)
  const couponTargetsService = new CouponTargetsService(new CouponTargetsRepository(prisma, adminAccessService), adminAccessService)
  const supportService = new SupportService(appContext, new PrismaSupportRepository(appContext, prisma))
  const emailService = createEmailService(appContext)
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
  const contentModerationRepo = new PrismaContentModerationRepository(appContext, prisma)
  const contentModerationService = new ContentModerationService(appContext, contentModerationRepo, auditLogService)
  const fraudRepo = new PrismaFraudRepository(appContext, prisma)
  const fraudService = new FraudService(appContext, fraudRepo, fraudRuleConfig, auditLogService)
  const refundRepo = new PrismaRefundRepository(appContext, prisma, adminAccessService)
  const refundService = new RefundService(appContext, refundRepo)
  const adminRepo = new PrismaAdminRepository(appContext, prisma, adminAccessService)
  const affiliateRepo = new PrismaAffiliateRepository(appContext, prisma)
  const affiliateService = new AffiliateService(appContext, affiliateRepo)
  const realtimeRepo = new PrismaRealtimeRepository(appContext, prisma)
  const realtimeService = new RealtimeService(appContext, realtimeRepo, createRealtimeAdapter(appContext))
  const promotionRepo = new PrismaPromotionRepository(appContext, prisma)
  const promotionService = new PromotionService(appContext, promotionRepo, activeShopResolver)
  const commissionService = new CommissionService(appContext)
  const walletRepo = new PrismaWalletRepository(appContext, prisma)
  const walletService = new WalletService(appContext, walletRepo, commissionService, activeShopResolver)
  const adminService = new AdminService(appContext, adminRepo, auditLogService, refundRepo, eventPublisherService, walletService, cacheInvalidation, adminAccessService)
  const checkoutRepo = new PrismaCheckoutRepository(appContext, prisma)
  const checkoutQuoteEvaluator = new CheckoutQuoteEvaluator(promotionService, undefined, input => adminConfigService.requireFeature('promotions', input))
  const checkoutService = new CheckoutService(appContext, checkoutRepo, checkoutQuoteEvaluator, cacheInvalidation, undefined, async input => {
    await adminConfigService.requireAdmission(input)
    await adminConfigService.requireFeature('checkout', input)
  }, channel => adminConfigService.requirePaymentChannel(channel))
  const notificationRepo = new PrismaNotificationRepository(appContext, prisma)
  const pushRepo = new PrismaPushRepository(appContext, prisma)
  const pushService = new PushService(appContext, pushRepo, getPushConfigFromEnv())
  const notificationService = new NotificationService(appContext, notificationRepo, realtimeService, pushService, adminConfigService, emailService)
  const chatRepo = new PrismaChatRepository(appContext, prisma)
  const uploadStorage = createUploadStorageFromEnv()
  const chatService = new ChatService(appContext, chatRepo, realtimeService, notificationService, uploadStorage.chatObjects)
  const catalogRepo = new PrismaCatalogRepository(appContext, prisma, () => adminConfigService.publicationApprovalRequired())
  const catalogService = new CatalogService(appContext, catalogRepo, cacheService, cacheInvalidation, eventPublisherService, activeShopResolver, auditLogService,
    () => adminConfigService.publicationApprovalRequired(), new CatalogApprovalRepository(prisma, adminAccessService))
  const trackingRepo = new PrismaTrackingRepository(appContext, prisma)
  const trackingService = new TrackingService(appContext, trackingRepo, catalogService)
  const cartRepo = new PrismaCartRepository(appContext, prisma)
  const cartService = new CartService(appContext, cartRepo, trackingService)
  const discoveryRepo = new PrismaDiscoveryRepository(appContext, prisma)
  const inventoryRepo = new PrismaInventoryRepository(appContext, prisma)
  const inventoryService = new InventoryService(appContext, inventoryRepo, activeShopResolver, cacheInvalidation)
  const catalogImportService = new CatalogImportService(new CatalogImportRepository(prisma), adminAccessService, inventoryRepo, new CatalogBulkRepository(() => adminConfigService.publicationApprovalRequired()), cacheInvalidation)
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
    auditLogService,
  )
  const paymentRepo = new PrismaPaymentRepository(appContext, prisma)
  const paymentSettlement = new PaymentSettlement(shipmentService, affiliateService)
  const paymentService = new PaymentService(
    appContext,
    paymentRepo,
    paymentSettlement,
    cacheInvalidation,
    eventPublisherService,
  )
  const payoutRepo = new PrismaPayoutRepository(appContext, prisma)
  const payoutService = new PayoutService(appContext, payoutRepo, eventPublisherService, activeShopResolver, auditLogService, adminAccessService)
  const phoneOtpRepo = new PrismaPhoneOtpRepository(appContext, prisma)
  const phoneOtpService = new PhoneOtpService(appContext, phoneOtpRepo, createPhoneOtpProvider())
  const returnRepo = new PrismaReturnRepository(appContext, prisma)
  const returnService = new ReturnService(appContext, returnRepo, activeShopResolver, eventPublisherService)
  const recommendationRepo = new PrismaRecommendationRepository(appContext, prisma)
  const recommendationService = new RecommendationService(appContext, recommendationRepo, cacheService)
  const discoveryService = new DiscoveryService(appContext, discoveryRepo, catalogService, recommendationService, promotionService, trackingService)
  const reviewRepo = new PrismaReviewRepository(appContext, prisma)
  const reviewService = new ReviewService(appContext, reviewRepo)
  const shopReviewRepo = new PrismaShopReviewRepository(appContext, prisma)
  const shopReviewService = new ShopReviewService(appContext, shopReviewRepo, cacheInvalidation)
  const productQuestionRepo = new PrismaProductQuestionRepository(appContext, prisma)
  const productQuestionService = new ProductQuestionService(appContext, productQuestionRepo, ownershipGuards)
  const productAnalyticsRepo = new PrismaProductAnalyticsRepository(appContext, prisma)
  const productAnalyticsService = new ProductAnalyticsService(appContext, productAnalyticsRepo, activeShopResolver)
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
  const shopStaffRepo = new PrismaShopStaffRepository(appContext, prisma)
  const shopStaffService = new ShopStaffService(appContext, shopStaffRepo)
  const sellerOnboardingRepo = new PrismaSellerOnboardingRepository(appContext, prisma)
  const sellerOnboardingService = new SellerOnboardingService(appContext, sellerOnboardingRepo)
  const uploadRepo = new PrismaUploadRepository(appContext, prisma)
  const uploadService = new UploadService(appContext, uploadRepo, uploadStorage, adminAccessService)
  const adminOperationsService = new AdminOperationsService(appContext, new PrismaAdminOperationsRepository(appContext, prisma), adminAccessService, payoutService, uploadService)
  const queueProducer: QueueProducer = new OptionalQueueProducer(
    queueConfig ? new BullMqQueueProducer(appContext, queueConfig) : null,
  )
  const jobRepo = new PrismaJobRepository(appContext, prisma)
  const jobService = new JobService(
    appContext,
    jobRepo,
    queueProducer,
    cacheInvalidation,
    eventPublisherService,
    emailService,
    walletService,
    { processDueSchedules: now => adminReportingService.processDueSchedules(now), prepareDuePayouts: now => payoutService.prepareDuePayouts(now) },
    notificationService,
  )
  const healthCheckRepo = new PrismaHealthCheckRepository(appContext, prisma)
  const observabilityService = new ObservabilityService(appContext, healthCheckRepo, metricsCollector, {
    metricsEnabled: observabilityConfig.metricsEnabled,
    healthCheckTimeoutMs: observabilityConfig.healthCheckTimeoutMs,
    queueConfig,
  })
  const userRepo = new PrismaUserRepository(appContext, prisma, adminAccessService)
  const userService = new UserService(appContext, userRepo, emailService, adminAccessService)

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
    adminAccessService,
    adminConfigService,
    adminReportingService,
    orderDocumentsService,
    catalogImportService,
    adminOperationsService,
    adminDirectoryService,
    couponTargetsService,
    aiSearchService,
    affiliateService,
    cartService,
    chatService,
    cacheInvalidation,
    cacheService,
    contentModerationService,
    checkoutService,
    commissionService,
    catalogService,
    discoveryService,
    eventBus,
    eventHandlerRegistry,
    eventPublisherService,
    fraudService,
    inventoryService,
    jobService,
    notificationService,
    pushService,
    realtimeService,
    metricsCollector,
    observabilityService,
    orderService,
    paymentService,
    payoutService,
    phoneOtpService,
    productQuestionService,
    productAnalyticsService,
    promotionService,
    refundService,
    recommendationService,
    returnService,
    supportService,
    reviewService,
    shopReviewService,
    searchService,
    securityService,
    activeShopResolver,
    ownershipGuards,
    sellerDashboardService,
    sellerShopService,
    shopStaffService,
    sellerOnboardingService,
    shipmentService,
    shoppingAssistantService,
    trackingService,
    uploadService,
    userService,
    walletService,
  }
}
