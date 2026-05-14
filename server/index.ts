import { Elysia } from "elysia";
import { authPlugin } from "#server/modules/auth";
import { createContainer } from "#server/context/app-context";
import { createAdminRoutes } from "#server/modules/admin";
import { createCartRoutes } from "#server/modules/cart";
import { createCheckoutRoutes } from "#server/modules/checkout";
import { createCatalogRoutes } from "#server/modules/catalog";
import { createNotificationRoutes } from "#server/modules/notification";
import { createOrderRoutes } from "#server/modules/order";
import { createPaymentRoutes } from "#server/modules/payment";
import { createPromotionRoutes } from "#server/modules/promotion";
import { createRefundRoutes } from "#server/modules/refund";
import { createReturnRoutes } from "#server/modules/return";
import { createReviewRoutes } from "#server/modules/review";
import { createSearchRoutes } from "#server/modules/search";
import { createSellerDashboardRoutes } from "#server/modules/seller";
import { createShipmentRoutes } from "#server/modules/shipment";
import { createUploadRoutes } from "#server/modules/upload";
import { createUserRoutes } from "#server/modules/user";
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

  // --- health check ---
  .get("/api/health", () => ({ status: "ok" }))

  // --- Better Auth handler + auth macro ---
  .use(authPlugin)

  // --- Review routes ---
  .use(createReviewRoutes(container))

  // --- Catalog routes ---
  .use(createCatalogRoutes(container))

  // --- Search routes ---
  .use(createSearchRoutes(container))

  // --- Cart routes ---
  .use(createCartRoutes(container))

  // --- Checkout routes ---
  .use(createCheckoutRoutes(container))

  // --- Promotion routes ---
  .use(createPromotionRoutes(container))

  // --- Notification routes ---
  .use(createNotificationRoutes(container))

  // --- Return routes ---
  .use(createReturnRoutes(container))

  // --- Refund routes ---
  .use(createRefundRoutes(container))

  // --- Order routes ---
  .use(createOrderRoutes(container))

  // --- Payment webhook routes ---
  .use(createPaymentRoutes(container))

  // --- Seller shipment routes ---
  .use(createShipmentRoutes(container))

  // --- Upload routes ---
  .use(createUploadRoutes(container))

  // --- Seller dashboard routes ---
  .use(createSellerDashboardRoutes(container))

  // --- User admin routes (role-protected via { withRole: 'ADMIN' }) ---
  .use(createUserRoutes(container))

  // --- Task 17 admin marketplace routes ---
  .use(createAdminRoutes(container));

const app = baseApp.listen(port);

log.info("API server running", { port: app.server?.port });

export type App = typeof baseApp;
