import { Elysia } from "elysia";
import { authPlugin } from "#server/modules/auth";
import { createContainer } from "#server/context/app-context";
import { createCatalogRoutes } from "#server/modules/catalog";
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

  // --- Catalog routes ---
  .use(createCatalogRoutes(container))

  // --- User admin routes (role-protected via { withRole: 'ADMIN' }) ---
  .use(createUserRoutes(container));

const app = baseApp.listen(port);

log.info("API server running", { port: app.server?.port });

export type App = typeof baseApp;
