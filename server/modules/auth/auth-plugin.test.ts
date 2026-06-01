import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPlugin } from "./auth-plugin.ts";
import { getAuthContext } from "./auth.context.ts";

vi.mock("./auth.ts", () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
  getSocialProviderAvailability: vi.fn(() => ({
    google: true,
    facebook: false,
  })),
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
    .get("/verified", ({ authContext }: any) => ({ id: authContext!.user.id }), {
      withVerifiedAuth: true,
    })
    .get("/admin", ({ authContext }: any) => ({ role: authContext!.user.role }), {
      withRole: "ADMIN",
    })
    .get("/user-role", ({ authContext }: any) => ({ role: authContext!.user.role }), {
      withRole: "USER",
    });
}

function mockUser(role: "USER" | "ADMIN", status: "ACTIVE" | "SUSPENDED" = "ACTIVE", emailVerified = true) {
  return {
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      name: role,
      role,
      status,
      emailVerified,
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
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER", "ACTIVE", false));
    const response = await createApp().handle(new Request("http://localhost/private"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "user-1" });
  });

  it("blocks verified-only routes for unverified users", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER", "ACTIVE", false));
    const response = await createApp().handle(new Request("http://localhost/verified"));
    expect(response.status).toBe(403);
  });

  it("allows verified-only routes for verified users", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER"));
    const response = await createApp().handle(new Request("http://localhost/verified"));
    expect(response.status).toBe(200);
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

  it("blocks admin-only routes for unverified admins", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("ADMIN", "ACTIVE", false));
    const response = await createApp().handle(new Request("http://localhost/admin"));
    expect(response.status).toBe(403);
  });

  it("blocks suspended users", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockUser("USER", "SUSPENDED"));
    const response = await createApp().handle(new Request("http://localhost/private"));
    expect(response.status).toBe(403);
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

  it("exposes only social provider availability booleans", async () => {
    const response = await createApp().handle(new Request("http://localhost/api/auth/provider-availability"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      google: true,
      facebook: false,
    });
  });
});
