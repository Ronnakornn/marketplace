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
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/sming?schema=public` |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars in production) | - |
| `BETTER_AUTH_URL` | Public app URL used by Better Auth | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Browser-facing frontend URL | `http://localhost:3000` |
| `API_BASE_URL` | Internal API target used by Next.js rewrites | `http://localhost:3001` |
| `ADMIN_EMAILS` | Comma-separated emails to promote via seed script | `admin@example.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID; Google login is enabled only when paired with `GOOGLE_CLIENT_SECRET` | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret; never expose to browser code | - |
| `FACEBOOK_CLIENT_ID` | Facebook App ID; Facebook login is enabled only when paired with `FACEBOOK_CLIENT_SECRET` | - |
| `FACEBOOK_CLIENT_SECRET` | Facebook App Secret; never expose to browser code | - |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |

Google and Facebook callback URLs must also be configured in the provider consoles for the active `BETTER_AUTH_URL` host, for example `/api/auth/callback/google` and `/api/auth/callback/facebook`. Real OAuth callback validation requires provider console setup and is outside local deterministic tests.

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
