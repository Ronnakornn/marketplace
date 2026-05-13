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

# Production
FROM base AS production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/app ./app
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs

ENV NODE_ENV=production
EXPOSE 3000
EXPOSE 3001
CMD ["bun", "run", "start"]
