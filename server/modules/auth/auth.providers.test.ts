import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

async function importAuthWithEnv(env: Partial<NodeJS.ProcessEnv>) {
  vi.resetModules();
  vi.doMock("better-auth", () => ({
    betterAuth: vi.fn((options) => ({ handler: vi.fn(), options })),
  }));
  vi.doMock("better-auth/adapters/prisma", () => ({
    prismaAdapter: vi.fn(() => "prisma-adapter"),
  }));
  vi.doMock("#server/lib/prisma.ts", () => ({
    prisma: {},
  }));

  process.env = { ...originalEnv, ...env };
  return import("./auth.ts");
}

describe("auth social provider configuration", () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("better-auth");
    vi.doUnmock("better-auth/adapters/prisma");
    vi.doUnmock("#server/lib/prisma.ts");
  });

  it("reports providers unavailable when either credential is missing", async () => {
    const { getSocialProviderAvailability, auth } = await importAuthWithEnv({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "",
      FACEBOOK_CLIENT_ID: "",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });

    expect(getSocialProviderAvailability(process.env)).toEqual({
      google: false,
      facebook: false,
    });
    expect(auth.options.socialProviders).toEqual({});
  });

  it("configures only providers with complete credentials", async () => {
    const { getSocialProviderAvailability, auth } = await importAuthWithEnv({
      GOOGLE_CLIENT_ID: " google-id ",
      GOOGLE_CLIENT_SECRET: " google-secret ",
      FACEBOOK_CLIENT_ID: "facebook-id",
      FACEBOOK_CLIENT_SECRET: "facebook-secret",
    });

    expect(getSocialProviderAvailability(process.env)).toEqual({
      google: true,
      facebook: true,
    });
    expect(auth.options.socialProviders).toEqual({
      google: {
        clientId: "google-id",
        clientSecret: "google-secret",
      },
      facebook: {
        clientId: "facebook-id",
        clientSecret: "facebook-secret",
      },
    });
  });
});
