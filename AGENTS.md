# AGENTS.md

## Overview

This repository is a production-ready marketplace e-commerce platform inspired by Shopee/Lazada.

read CLAUDE.md

Architecture style:

* Modular Monolith
* Domain-Driven Design (DDD)
* API-first
* Full-stack TypeScript

Core stack:

* Frontend: Next.js App Router
* Backend: ElysiaJS
* Database: PostgreSQL
* ORM: Prisma
* Auth: Better Auth
* Runtime: Bun
* Validation: TypeBox / Prismabox
* Realtime: WebSocket / Supabase Realtime (optional)
* Queue: Redis + BullMQ (optional)

This file is the primary AI agent entrypoint.
All AI agents (Codex, Claude, Copilot, Cursor, Windsurf) must read this file before making changes.

---

# Read Order

Always read files in this order before coding:

1. `AGENTS.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/erd.md`
5. `docs/schema.dbml`
6. `docs/checkout-flow.md`
7. `docs/fulfillment-flow.md`
8. `prisma/schema.prisma` when changing models
9. Relevant skill docs under `.agents/skills/*/SKILL.md`

---

# Development Commands

## General

```bash
bun install
bun run dev
bun run build
bun run test
bunx tsc --noEmit
```

## Frontend

```bash
bun run dev:web
```

## Backend

```bash
bun run dev:api
```

## Database

```bash
bun run db:generate
bun run db:push
bun run db:migrate
bun run db:seed
bun run db:studio
```

---

# High-Level Architecture

## Main Domains

The system is separated into business domains.

```txt
Catalog
Cart
Checkout
Order
Payment
Shipping
Promotion
Inventory
Review
Seller
Admin
Chat
Notification
Auth
```

Each domain must be isolated.

Example:

```txt
server/modules/catalog/
server/modules/cart/
server/modules/order/
```

---

# Folder Structure Rules

## Backend

```txt
server/modules/<domain>/
```

Each domain should contain:

```txt
controllers/
services/
repositories/
validators/
dtos/
models/
```

## Frontend

Feature-based frontend structure:

```txt
app/features/<domain>/
```

Shared UI:

```txt
app/components/
```

Never place business logic inside shared UI.

---

# Database Rules

## Prisma Is Source of Truth

Never manually change PostgreSQL tables.
All schema changes must go through:

```bash
prisma/schema.prisma
```

After schema changes:

```bash
bun run db:generate
```

before:

* tests
* builds
* typecheck

---

# Marketplace Rules

These rules are CRITICAL.

## Orders

* One order may contain items from many shops.
* Shipments must be split by shop.
* Order item snapshots are required.
* Address snapshots are required.

## Inventory

* Reserve stock during checkout.
* Never decrease stock directly before payment success.
* Prevent overselling.
* Inventory updates must use database transactions.

## Payments

* Client payment status is NEVER trusted.
* Payment success must come from webhook.
* Webhooks must be idempotent.
* Expired payments must release reserved stock.

## Security

* Sellers must only access their own resources.
* Never expose admin routes publicly.
* Validate ownership everywhere.
* Never trust client-provided pricing.

---

# API Rules

## API Composition

Keep:

```txt
server/index.ts
```

as the API composition root.

## Authentication

Use auth macros:

```ts
{ withAuth: true }
{ withRole: 'ADMIN' }
{ withRole: 'SELLER' }
```

Do NOT write inline authorization logic repeatedly.

## Validation

Do NOT manually duplicate Prisma entity schemas.

Use:

* prismabox
* generated schemas
* TypeBox composition

Example:

```ts
CreateProductSchema = t.Pick(ProductSchema, ['title'])
```

---

# Frontend Rules

## Data Fetching

* Use Eden Treaty inferred types.
* Never manually duplicate backend response types.
* Use TanStack Query for server state.

## Routing

* Use Next.js App Router.
* Browser requests must use same-origin `/api/*`.
* Next.js rewrites proxy requests to Elysia.

---

# Logging Rules

Use:

```ts
appContext.logger
```

Do NOT use:

```ts
console.log
```

---

# AI Agent Workflow

Before implementing ANY feature:

1. Read docs
2. Create implementation plan
3. Identify affected domains
4. Identify affected tables
5. Identify risks
6. Implement incrementally
7. Add tests
8. Run typecheck
9. Run tests
10. Update docs if architecture changed

---

# Required Implementation Order

When building new systems, follow this order:

```txt
1. Database schema
2. Repository
3. Service
4. Validation
5. Controller/API
6. Frontend integration
7. Tests
8. Documentation
```

---

# Coding Principles

## General

* Prefer simple solutions.
* Avoid premature abstraction.
* Keep functions small.
* Use explicit naming.
* Avoid magic values.
* Keep domain logic in services.

## DDD

Business rules belong in:

```txt
services/
```

Database access belongs in:

```txt
repositories/
```

HTTP concerns belong in:

```txt
controllers/
```

---

# Testing Rules

Minimum required tests:

## Checkout

* stock validation
* reserve inventory
* price calculation
* coupon validation
* transaction rollback

## Payment

* webhook verification
* idempotency
* duplicate webhook protection
* failed payment recovery

## Authorization

* seller isolation
* admin protection
* ownership validation

---

# Performance Rules

* Use pagination for large queries.
* Avoid N+1 queries.
* Use indexes for frequently filtered columns.
* Avoid loading unnecessary relations.
* Use caching where appropriate.

---

# Generated Files

Treat these folders as generated:

```txt
generated/
```

Never manually edit generated output.
Regenerate instead.

---

# Deployment Expectations

Production deployment should support:

* Docker
* PM2
* Nginx reverse proxy
* PostgreSQL backups
* Redis queues
* Health checks
* Environment validation
* Structured logging

---

# AI-Specific Notes

## Codex

* Follow AGENTS.md strictly.
* Read docs before coding.
* Never implement entire systems in one step.
* Prefer incremental PR-sized changes.

## Claude

* Keep alignment with `.chief/` workflows when relevant.

## Copilot / Cursor / Windsurf

* Use feature-based edits.
* Avoid massive refactors unless requested.

---

# Important

If requirements are unclear:

DO NOT immediately generate large amounts of code.

Instead:

1. Clarify assumptions
2. Create plan
3. List affected modules
4. Then implement incrementally

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
