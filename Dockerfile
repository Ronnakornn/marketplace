FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile

# Build Next.js app + generate prisma
FROM deps AS build
COPY . .
RUN bun run build:all

FROM base AS production-deps
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile --production

# One-shot migration image: docker build --target migration .
FROM deps AS migration
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV NODE_ENV=production
CMD ["bun", "x", "prisma", "migrate", "deploy"]

# Production
FROM base AS production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/app ./app
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
RUN mkdir -p /app/public/uploads /app/.data/uploads \
  && chown -R bun:bun /app/public/uploads /app/.data

ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/public/uploads", "/app/.data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD bun -e "fetch('http://127.0.0.1:3001/api/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER bun
CMD ["bun", "run", "start"]
