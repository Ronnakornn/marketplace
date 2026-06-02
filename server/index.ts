import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authPlugin } from "#server/modules/auth";
import { createPhoneOtpRoutes } from "#server/modules/auth";
import { createContainer } from "#server/context/app-context";
import { createAuditLogRoutes } from "#server/modules/audit-log";
import { getSecurityConfigFromEnv } from "#server/modules/security";
import { createSecurityPlugin } from "#server/plugins/security.plugin";
import { getObservabilityConfigFromEnv, createObservabilityRoutes } from "#server/modules/observability";
import { createObservabilityPlugin } from "#server/plugins/observability.plugin";
import { createCachePlugin } from "#server/plugins/cache.plugin";
import { createAdminRoutes } from "#server/modules/admin";
import { createAiSearchRoutes } from "#server/modules/ai-search";
import { createAffiliateRoutes } from "#server/modules/affiliate";
import { createCartRoutes } from "#server/modules/cart";
import { createChatRoutes } from "#server/modules/chat";
import { createCheckoutRoutes } from "#server/modules/checkout";
import { createCatalogRoutes } from "#server/modules/catalog";
import { createFraudRoutes } from "#server/modules/fraud";
import { createInventoryRoutes } from "#server/modules/inventory";
import { createNotificationRoutes } from "#server/modules/notification";
import { createOrderRoutes } from "#server/modules/order";
import { createPaymentRoutes } from "#server/modules/payment";
import { createPayoutRoutes } from "#server/modules/payout";
import { createPromotionRoutes } from "#server/modules/promotion";
import { createRefundRoutes } from "#server/modules/refund";
import { createRecommendationRoutes } from "#server/modules/recommendation";
import { createRealtimeRoutes } from "#server/modules/realtime";
import { createReturnRoutes } from "#server/modules/return";
import { createReviewRoutes } from "#server/modules/review";
import { createSearchRoutes } from "#server/modules/search";
import { createSellerDashboardRoutes } from "#server/modules/seller";
import { createSellerOnboardingRoutes } from "#server/modules/seller-onboarding";
import { createShipmentRoutes } from "#server/modules/shipment";
import { createUploadRoutes } from "#server/modules/upload";
import { createUserRoutes } from "#server/modules/user";
import { createWalletRoutes } from "#server/modules/wallet";
const port = Number(process.env.API_PORT ?? 3001);

// --- Composition Root: wire all dependencies via container ---
const container = createContainer();
const log = container.appContext.logger;

const baseApp = new Elysia()
  .onError(({ error, code }) => {
    log.error("Unhandled error", {
      code,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  })

  // --- Observability: request IDs, request/error logs, metrics ---
  .use(createObservabilityPlugin(container.appContext, container.metricsCollector, getObservabilityConfigFromEnv()))

  // --- Security hardening middleware ---
  .use(createSecurityPlugin(container.appContext, getSecurityConfigFromEnv()))

  // --- Swagger/OpenAPI documentation ---
  .use(swagger({
    path: "/swagger",
    specPath: "/swagger/json",
    provider: "swagger-ui",
    documentation: {
      info: {
        title: "Marketplace API",
        version: "1.0.0",
        description: "API documentation for the multi-vendor marketplace backend.",
      },
      tags: [
        { name: "Admin", description: "Marketplace administration" },
        { name: "AI Search", description: "AI-assisted product discovery" },
        { name: "Audit Log", description: "Administrative audit records" },
        { name: "Auth", description: "Authentication and session management" },
        { name: "Cart", description: "Buyer cart management" },
        { name: "Catalog", description: "Products, variants, categories, and inventory" },
        { name: "Checkout", description: "Checkout creation, totals, and reservations" },
        { name: "Chat", description: "Buyer and shop messaging" },
        { name: "Fraud", description: "Fraud detection and review workflows" },
        { name: "Inventory", description: "Seller stock and inventory movement workflows" },
        { name: "Notification", description: "User notifications" },
        { name: "Observability", description: "Health, readiness, and metrics" },
        { name: "Order", description: "Orders and order lifecycle" },
        { name: "Payment", description: "Payments and provider webhooks" },
        { name: "Promotion", description: "Coupons and promotions" },
        { name: "Recommendation", description: "Product recommendations" },
        { name: "Refund", description: "Refund workflows" },
        { name: "Return", description: "Return request workflows" },
        { name: "Review", description: "Product review workflows" },
        { name: "Search", description: "Marketplace search" },
        { name: "Seller", description: "Seller dashboard and shop operations" },
        { name: "Shipment", description: "Shop-based fulfillment and shipments" },
        { name: "Upload", description: "Upload and storage workflows" },
        { name: "User", description: "User administration" },
        { name: "Wallet", description: "Seller wallet and payout balances" },
      ],
    },
  }))

  // --- Redis-backed backend cache context ---
  .use(createCachePlugin(container.cacheService))

  // --- health/readiness/liveness/metrics ---
  .use(createObservabilityRoutes(container))

  // --- Better Auth handler + auth macro ---
  .use(authPlugin)

  // --- Phone OTP auth routes ---
  .use(createPhoneOtpRoutes(container))

  // --- Audit log admin routes ---
  .use(createAuditLogRoutes(container))

  // --- Affiliate tracking and commission routes ---
  .use(createAffiliateRoutes(container))

  // --- Review routes ---
  .use(createReviewRoutes(container))

  // --- Catalog routes ---
  .use(createCatalogRoutes(container))

  // --- Search routes ---
  .use(createSearchRoutes(container))

  // --- AI-assisted product discovery routes ---
  .use(createAiSearchRoutes(container))

  // --- Cart routes ---
  .use(createCartRoutes(container))

  // --- Chat routes ---
  .use(createChatRoutes(container))

  // --- Realtime websocket routes ---
  .use(createRealtimeRoutes(container))

  // --- Checkout routes ---
  .use(createCheckoutRoutes(container))

  // --- Inventory routes ---
  .use(createInventoryRoutes(container))

  // --- Promotion routes ---
  .use(createPromotionRoutes(container))

  // --- Notification routes ---
  .use(createNotificationRoutes(container))

  // --- Return routes ---
  .use(createReturnRoutes(container))

  // --- Refund routes ---
  .use(createRefundRoutes(container))

  // --- Public recommendation routes ---
  .use(createRecommendationRoutes(container))

  // --- Order routes ---
  .use(createOrderRoutes(container))

  // --- Payment webhook routes ---
  .use(createPaymentRoutes(container))

  // --- Seller wallet and payout routes ---
  .use(createWalletRoutes(container))
  .use(createPayoutRoutes(container))

  // --- Seller shipment routes ---
  .use(createShipmentRoutes(container))

  // --- Upload routes ---
  .use(createUploadRoutes(container))

  // --- Seller dashboard routes ---
  .use(createSellerDashboardRoutes(container))

  // --- Seller onboarding routes ---
  .use(createSellerOnboardingRoutes(container))

  // --- User admin routes (role-protected via { withRole: 'ADMIN' }) ---
  .use(createUserRoutes(container))

  // --- Task 17 admin marketplace routes ---
  .use(createAdminRoutes(container))

  // --- Fraud detection admin review queue routes ---
  .use(createFraudRoutes(container));

const app = baseApp.listen(port);

log.info("API server running", { port: app.server?.port });

export type App = typeof baseApp;
