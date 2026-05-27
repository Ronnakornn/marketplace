import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPlugin } from "./auth-plugin.ts";
import { getAuthContext } from "./auth.context.ts";
import { prisma } from "#server/lib/prisma.ts";

vi.mock("./auth.ts", () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}));

vi.mock("./auth.context.ts", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("#server/lib/prisma.ts", () => ({
  prisma: {
    shop: {
      count: vi.fn(),
    },
    sellerApplication: {
      findFirst: vi.fn(),
    },
  },
}));

function createApp() {
  return new Elysia()
    .use(authPlugin)
    .get("/private", ({ authContext }: any) => ({ id: authContext!.user.id }), {
      withAuth: true,
    })
    .get("/admin", ({ authContext }: any) => ({ role: authContext!.user.role }), {
      withRole: "ADMIN",
    })
    .get("/user-role", ({ authContext }: any) => ({ role: authContext!.user.role }), {
      withRole: "USER",
    })
    .get("/seller-op", ({ authContext }: any) => ({ id: authContext!.user.id }), {
      withSellerOperational: true,
    })
    .get("/seller-onboarding", ({ authContext }: any) => ({ id: authContext!.user.id }), {
      withAuth: true,
    });
}

function mockUser(role: "USER" | "ADMIN", status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  return {
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      name: role,
      role,
      status,
    },
  };
}

describe("authPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.shop.count as any).mockResolvedValue(0);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue(null);
  });

  it("rejects unauthenticated access", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    const response = await createApp().handle(new Request("http://localhost/private"));
    expect(response.status).toBe(401);
  });

  it("allows authenticated access", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    const response = await createApp().handle(new Request("http://localhost/private"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "user-1" });
  });

  it("protects admin-only routes", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    const response = await createApp().handle(new Request("http://localhost/admin"));
    expect(response.status).toBe(403);
  });

  it("allows admin-only routes for admins", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("ADMIN"));
    const response = await createApp().handle(new Request("http://localhost/admin"));
    expect(response.status).toBe(200);
  });

  it("protects role-specific routes", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("ADMIN"));
    const response = await createApp().handle(new Request("http://localhost/user-role"));
    expect(response.status).toBe(403);
  });

  it("allows role-specific routes for matching users", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    const response = await createApp().handle(new Request("http://localhost/user-role"));
    expect(response.status).toBe(200);
  });

  it("blocks seller operational routes when onboarding is required", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(0);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status: "DRAFT" });

    const response = await createApp().handle(new Request("http://localhost/seller-op"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "SELLER_ONBOARDING_REQUIRED",
        details: { redirectPath: "/seller/register" },
      },
    });
  });

  it("blocks seller operational routes while waiting active shop", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(0);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status: "SUBMITTED" });

    const response = await createApp().handle(new Request("http://localhost/seller-op"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "SELLER_SHOP_INACTIVE",
        details: { redirectPath: "/seller/status" },
      },
    });
  });

  it("blocks approved-without-shop seller routes with inactive-shop code", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(0);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status: "APPROVED" });

    const response = await createApp().handle(new Request("http://localhost/seller-op"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "SELLER_SHOP_INACTIVE",
        details: { redirectPath: "/seller/status" },
      },
    });
  });

  it("maps rejected and cancelled states to onboarding-required code", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(0);

    for (const status of ["REJECTED", "CANCELLED"] as const) {
      (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status });

      const response = await createApp().handle(new Request("http://localhost/seller-op"));

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "SELLER_ONBOARDING_REQUIRED",
          details: { redirectPath: "/seller/register" },
        },
      });
    }
  });

  it("allows seller operational routes when active shop exists", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(1);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status: "APPROVED" });

    const response = await createApp().handle(new Request("http://localhost/seller-op"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "user-1" });
  });

  it("keeps onboarding routes reachable while operational routes are gated", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    (prisma.shop.count as any).mockResolvedValue(0);
    (prisma.sellerApplication.findFirst as any).mockResolvedValue({ status: "DRAFT" });

    const onboardingResponse = await createApp().handle(new Request("http://localhost/seller-onboarding"));
    const operationalResponse = await createApp().handle(new Request("http://localhost/seller-op"));

    expect(onboardingResponse.status).toBe(200);
    await expect(onboardingResponse.json()).resolves.toEqual({ id: "user-1" });
    expect(operationalResponse.status).toBe(403);
  });
});
