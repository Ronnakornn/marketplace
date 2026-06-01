import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "#server/lib/prisma.ts";

export interface SocialProviderAvailability {
  google: boolean;
  facebook: boolean;
}

export function getSocialProviderAvailability(env: NodeJS.ProcessEnv = process.env): SocialProviderAvailability {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()),
    facebook: Boolean(env.FACEBOOK_CLIENT_ID?.trim() && env.FACEBOOK_CLIENT_SECRET?.trim()),
  };
}

function createSocialProviders(env: NodeJS.ProcessEnv = process.env) {
  const availability = getSocialProviderAvailability(env);

  return {
    ...(availability.google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!.trim(),
            clientSecret: env.GOOGLE_CLIENT_SECRET!.trim(),
          },
        }
      : {}),
    ...(availability.facebook
      ? {
          facebook: {
            clientId: env.FACEBOOK_CLIENT_ID!.trim(),
            clientSecret: env.FACEBOOK_CLIENT_SECRET!.trim(),
          },
        }
      : {}),
  };
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: false,
      },
      phoneVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  experimental: {
    joins: true,
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  socialProviders: createSocialProviders(),
});

export type Auth = typeof auth;
