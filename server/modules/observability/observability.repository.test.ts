import { describe, expect, it, vi } from "vitest";
import { PrismaHealthCheckRepository } from "./observability.repository.ts";

describe("PrismaHealthCheckRepository database schema readiness", () => {
  it("requires the latest production migration before reporting ready", async () => {
    const queries: string[] = [];
    const prisma = {
      $queryRaw: vi.fn((strings: TemplateStringsArray) => {
        queries.push(strings.join(""));
        return Promise.resolve(queries.length === 1
          ? [{ schemaReady: true, migrationsReady: true }]
          : [{ ready: true }]);
      }),
    };
    const repository = new PrismaHealthCheckRepository({
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() },
    } as never, prisma as never);

    await expect(repository.checkDatabaseSchema(1_000)).resolves.toBe(true);
    expect(queries.join("\n")).toContain("20260904161000_add_buyer_coin_debt_balance");
  });
});
