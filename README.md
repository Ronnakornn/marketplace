# Marketplace - Next.js + Elysia + Prisma Stack

A full-stack **multi-vendor marketplace** built with Next.js App Router, Elysia backend, Better Auth, and Prisma ORM.

## Features

- **Authentication** - Better Auth with email/password and session management
- **Marketplace Data Model** - Users, shops, products, variants, inventory, checkout, orders, payments, shipments, returns, refunds, chat, and notifications
- **End-to-End Type Safety** - Prisma schema drives types through the entire stack via Eden Treaty
- **Module Architecture** - Domain-centric backend modules, feature-based frontend organization
- **Auto-Generated Validation** - Prismabox generates TypeBox schemas from Prisma models
- **Structured Logging** - Pino with pretty-print in dev, JSON in production
- **Next.js App Router** - File-system routing, layouts, and same-origin API proxying through Next.js

## Tech Stack

### Backend & API
- **[Elysia](https://elysiajs.com)** — Type-safe web framework on Bun runtime
- **[Prisma v7](https://prisma.io)** — ORM with PostgreSQL (`pg` driver adapter)
- **[Better Auth](https://better-auth.com)** — Authentication library
- **[Prismabox](https://github.com/prismabox/prismabox)** — Auto-generate TypeBox schemas from Prisma
- **[Pino](https://getpino.io)** — Structured logging

### Frontend & UI
- **[Next.js 16](https://nextjs.org)** - App Router frontend on React 19
- **[Eden Treaty](https://elysiajs.com/eden)** - Type-safe RPC client for Elysia
- **[React Query](https://tanstack.com/query)** - Data fetching and cache management
- **[shadcn/ui](https://ui.shadcn.com)** - Component library on Radix + Tailwind CSS v4

## Architecture

This template implements a **Module-Based Architecture** with a type safety chain:

```
prisma/schema.prisma (single source of truth)
  -> Prisma Client (TypeScript types)
  -> Prismabox (TypeBox validation schemas)
  -> Elysia routes (body/response validation)
  -> Eden Treaty (type-safe frontend RPC)
  -> React Query hooks (typed data fetching)
```

### Project Structure

```
server/                            # Backend API
  index.ts                         # Composition root - mounts modules, starts Elysia on :3001
  context/app-context.ts           # DI container factory
  lib/                             # Auth config, Prisma client, auth plugin
  infrastructure/logging/          # ILogger, PinoLogger, factory
  modules/
    user/                          # User/admin module

app/                               # Next.js App Router frontend
  layout.tsx                       # Root layout
  page.tsx                         # Home page
  login/page.tsx                   # Login page
  signup/page.tsx                  # Signup page
  about/page.tsx                   # About page
  features/                        # Feature modules
  components/                      # Shared UI and layout
  lib/                             # Eden client, auth client, query client

prisma/schema.prisma               # Database schema + prismabox generator
generated/                         # Auto-generated Prisma client + TypeBox schemas
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation including patterns, conventions, and guides for adding new modules.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.3+

### 1. Clone and Install

```bash
git clone <repository-url> marketplace
cd marketplace
bun install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Configure `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sming?schema=public"
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:3000"
ALLOW_INSECURE_HTTP="false"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_ALLOWED_DEV_ORIGINS="localhost:3000,127.0.0.1:3000"
API_BASE_URL="http://localhost:3001"
ADMIN_EMAILS="admin@example.com"
PAYMENT_WEBHOOK_SECRET="your-payment-webhook-secret-at-least-32-chars"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""
```

### 3. Set Up Database

```bash
bunx prisma migrate dev --name init_marketplace
bun run db:generate
bun run db:seed-admin
```

### 4. Start Development

```bash
bun run dev
```

This starts both frontend (http://localhost:3000) and backend (http://localhost:3001) concurrently.

## Development Commands

```bash
# Development
bun run dev              # Start Next.js frontend + Elysia backend
bun run dev:frontend     # Start Next.js dev server only (port 3000)
bun run dev:server       # Start Elysia backend only with watch (port 3001)

# Build
bun run build            # Build Next.js frontend
bun run build:all        # Generate Prisma client + build frontend

# Production
bun run start            # Start Next.js frontend (:3000) + Elysia API (:3001)

# Database
bun run db:generate      # Regenerate Prisma client + prismabox schemas
bun run db:push          # Push schema changes to database
bun run db:seed-admin    # Promote users from ADMIN_EMAILS to ADMIN role
bun run db:studio        # Open Prisma Studio

# Migrations
bunx prisma migrate dev --name <migration_name>  # Create and apply a local migration
bunx prisma migrate status                       # Check pending/applied migrations
bunx prisma migrate deploy                       # Apply migrations in production/CI
bun run db:generate                              # Regenerate client after schema changes

# Testing
bun run test             # Run Vitest
bun run test:e2e         # Run Playwright E2E against the configured test DB
```

See [docs/TESTING.md](docs/TESTING.md) for focused test commands, Playwright
projects, database safety, debugging, and CI order.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/sming?schema=public` |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars in production) | - |
| `BETTER_AUTH_URL` | Public app URL used by Better Auth | `http://localhost:3000` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated browser origins allowed to post to Better Auth endpoints | `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` |
| `ALLOW_INSECURE_HTTP` | Allows `http://` public app/auth URLs in production for IP-only deployments; use only until HTTPS is available | `false` |
| `NEXT_PUBLIC_APP_URL` | Browser-facing frontend URL | `http://localhost:3000` |
| `NEXT_ALLOWED_DEV_ORIGINS` | Comma-separated hosts allowed to access Next.js dev resources such as HMR | `localhost:3000,127.0.0.1:3000` |
| `API_BASE_URL` | Internal API target used by Next.js rewrites | `http://localhost:3001` |
| `ADMIN_EMAILS` | Comma-separated emails to promote via seed script | `admin@example.com` |
| `PUSH_NOTIFICATIONS_ENABLED` | Enables Web Push delivery for important order updates | `false` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key used by browser push subscriptions | - |
| `VAPID_PRIVATE_KEY` | Server-only VAPID private key | - |
| `VAPID_SUBJECT` | VAPID contact URI, such as `mailto:admin@example.com` | - |
| `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` | Encrypts push endpoints and browser keys at rest; minimum 32 characters in production | - |
| `PHONE_OTP_ENABLED` | Enables phone OTP delivery; set `false` to disable phone OTP without requiring provider credentials | `true` |
| `PHONE_OTP_PROVIDER` | Phone OTP delivery provider: `deterministic-dev` for local/demo OTPs or `http` for an HTTPS SMS gateway adapter | `deterministic-dev` |
| `ALLOW_DETERMINISTIC_OTP` | Allows `deterministic-dev` phone OTP in production; use only for demo/staging deployments | `false` |
| `PHONE_OTP_HTTP_URL` | HTTPS endpoint for the generic HTTP SMS gateway adapter | - |
| `PHONE_OTP_HTTP_BEARER_TOKEN` | Optional bearer token for the HTTP SMS gateway adapter | - |
| `PHONE_OTP_HTTP_TIMEOUT_MS` | Timeout for the HTTP SMS gateway adapter | `5000` |
| `RATE_LIMIT_ENABLED` | Enables API rate limiting by route category | `true` |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window length in seconds | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Public API request limit per client IP per window | `600` |
| `RATE_LIMIT_AUTH_MAX_REQUESTS` | Auth route request limit per client IP per window | `120` |
| `RATE_LIMIT_CHECKOUT_MAX_REQUESTS` | Checkout/payment route request limit per client IP per window | `180` |
| `RATE_LIMIT_ADMIN_MAX_REQUESTS` | Admin route request limit per client IP per window | `300` |
| `REQUEST_BODY_LIMIT_BYTES` | Maximum accepted request body size | `1048576` |
| `REDIS_URL` | Redis connection URL for cache and optional queues | `redis://localhost:6379` |
| `CACHE_ENABLED` | Enables Redis-backed application cache when `REDIS_URL` is configured | `true` |
| `CACHE_DEFAULT_TTL_SECONDS` | Default cache TTL in seconds | `300` |
| `CACHE_PRODUCT_TTL_SECONDS` | Product/category cache TTL in seconds | `600` |
| `CACHE_SEARCH_TTL_SECONDS` | Search cache TTL in seconds | `120` |
| `CACHE_SELLER_DASHBOARD_TTL_SECONDS` | Seller dashboard cache TTL in seconds | `60` |
| `CACHE_KEY_PREFIX` | Prefix for Redis cache keys | `ecommerce` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID; Google login is enabled only when paired with `GOOGLE_CLIENT_SECRET` | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret; never expose to browser code | - |
| `FACEBOOK_CLIENT_ID` | Facebook App ID; Facebook login is enabled only when paired with `FACEBOOK_CLIENT_SECRET` | - |
| `FACEBOOK_CLIENT_SECRET` | Facebook App Secret; never expose to browser code | - |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |

Google and Facebook callback URLs must also be configured in the provider consoles for the active `BETTER_AUTH_URL` host, for example `/api/auth/callback/google` and `/api/auth/callback/facebook`. Real OAuth callback validation requires provider console setup and is outside local deterministic tests.

### Web Push Notifications

Generate VAPID keys once, keep the private key server-only, then enable push and deploy the database migration:

```bash
bunx web-push generate-vapid-keys
bunx prisma migrate deploy
```

Set `PUSH_NOTIFICATIONS_ENABLED=true` plus the four push environment variables above. Web Push requires HTTPS. Android browsers can subscribe directly; iOS/iPadOS 16.4+ users must first install the PWA with Add to Home Screen.

For local HTTP development, browsers treat `http://localhost` and `http://127.0.0.1` as secure contexts. Generate ephemeral in-memory keys and run the complete stack with:

```bash
bun run db:push
bun run dev:push
bun run test:push:http
```

LAN IPs and public HTTP domains are not secure contexts and cannot use Web Push. Use HTTPS when testing from a physical Android or iOS device.

## Key Patterns

### Adding a New Backend Module

1. Add models to `prisma/schema.prisma`, run `bun run db:generate`
2. Create `server/modules/<name>/` with repository, service, routes, errors
3. Import prismabox schemas for route validation (`generated/prismabox/<Model>.ts`)
4. Register service in `server/context/app-context.ts`
5. Mount routes in `server/index.ts`: `.use(create<Name>Routes(container))`

### Adding a New Frontend Feature

1. Create `app/features/<name>/` with components and hooks
2. Hooks use Eden client + React Query (types inferred from server)
3. Export via barrel `index.ts`
4. Import in Next.js pages or layouts: `import { Component } from '#/features/<name>'`

### Type Rules

- Database model types come from Prisma — never declare manual interfaces
- Route validation schemas come from prismabox — never write manual `t.Object()`
- Frontend types are inferred from Eden — never duplicate server types

## Deployment

### Docker

```bash
docker build -t marketplace .
docker run -p 3000:3000 marketplace
```

The Dockerfile builds the Next.js frontend, keeps the Elysia API server, and starts both processes in one container. The browser talks to Next.js on port 3000, and Next proxies `/api/*` requests to the internal API on port 3001.

### Production Environment

```env
NODE_ENV="production"
DATABASE_URL="postgresql://postgres:password@localhost:5432/sming?schema=public"
BETTER_AUTH_SECRET="secure-production-secret-at-least-32-chars"
BETTER_AUTH_URL="https://yourdomain.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://yourdomain.com"
```

For an IP-only HTTP deployment, set these values and restart both frontend and API processes:

```env
ALLOW_INSECURE_HTTP="true"
BETTER_AUTH_URL="http://165.245.191.63"
BETTER_AUTH_TRUSTED_ORIGINS="http://165.245.191.63"
NEXT_PUBLIC_APP_URL="http://165.245.191.63"
```

## AI Agent Setup

This template includes optional repository context for both Codex and Claude-based workflows.

### Codex

- **`AGENTS.md`** - Repository instructions, architecture guardrails, and development commands for Codex
- **`.agents/skills/`** - Reusable skills available to Codex, including Prisma-specific references

Codex should start with `AGENTS.md`, then read `docs/ARCHITECTURE.md`, and open relevant skill docs when working on Prisma-related tasks.

### Claude Code / Chief Agent Framework

- **`.chief/`** - Planning, milestones, task specs, and rules for autonomous agent execution
- **`CLAUDE.md`** - Project rules, architecture context, and development commands for Claude
- **`.claude/`** - Claude agent and skill wiring for the chief-agent workflow

If you use Claude Code, the chief-agent can read these files to plan and execute work autonomously.

The application code is fully independent of both agent setups. Remove or customize whichever agent-specific files you do not need.

## Documentation

- **[AGENTS.md](AGENTS.md)** - Codex project instructions and workflow entrypoint
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Module structure, DI patterns, type safety chain
- **[CLAUDE.md](CLAUDE.md)** - AI development guidelines and chief-agent framework

## License

This project is licensed under the MIT License.
