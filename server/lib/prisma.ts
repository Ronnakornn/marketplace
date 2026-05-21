import { PrismaClient } from "#generated/client/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString:
    process.env["DATABASE_URL"] ??
    "postgresql://postgres:password@localhost:5432/sming?schema=public",
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      typeof v === "bigint" ? Number(v) : v
    )
  );
}

function createPrismaClient() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allOperations: async ({ args, query }) => {
        const result = await query(args);
        return serializeBigInt(result);
      },
    },
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? (createPrismaClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
