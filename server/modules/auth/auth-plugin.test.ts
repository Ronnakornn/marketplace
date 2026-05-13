import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPlugin } from "./auth-plugin.ts";
import { getAuthContext } from "./auth.context.ts";

vi.mock("./auth.ts", () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}));

vi.mock("./auth.context.ts", () => ({
  getAuthContext: vi.fn(),
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
    .get("/seller", ({ authContext }: any) => ({ role: authContext!.user.role }), {
      withRole: "SELLER",
    });
}

function mockUser(role: "USER" | "SELLER" | "ADMIN", status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
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
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("SELLER"));
    const response = await createApp().handle(new Request("http://localhost/admin"));
    expect(response.status).toBe(403);
  });

  it("allows admin-only routes for admins", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("ADMIN"));
    const response = await createApp().handle(new Request("http://localhost/admin"));
    expect(response.status).toBe(200);
  });

  it("protects seller-only routes", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    const response = await createApp().handle(new Request("http://localhost/seller"));
    expect(response.status).toBe(403);
  });

  it("allows seller-only routes for sellers", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("SELLER"));
    const response = await createApp().handle(new Request("http://localhost/seller"));
    expect(response.status).toBe(200);
  });
});
