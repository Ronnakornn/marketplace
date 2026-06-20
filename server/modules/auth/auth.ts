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

type SocialEmailProfile = {
  email?: string | null;
  email_verified?: boolean;
  emailVerified?: boolean;
};

export function requireVerifiedSocialEmail(profile: SocialEmailProfile) {
  const email = profile.email?.trim();
  const emailVerified = profile.emailVerified === true || profile.email_verified === true;

  if (!email || !emailVerified) {
    return {
      email: null,
      emailVerified: false,
    };
  }

  return {
    email,
    emailVerified: true,
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
            mapProfileToUser: requireVerifiedSocialEmail,
          },
        }
      : {}),
    ...(availability.facebook
      ? {
          facebook: {
            clientId: env.FACEBOOK_CLIENT_ID!.trim(),
            clientSecret: env.FACEBOOK_CLIENT_SECRET!.trim(),
            fields: ["email_verified"],
            mapProfileToUser: requireVerifiedSocialEmail,
          },
        }
      : {}),
  };
}

function getTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configuredOrigins = [
    env.BETTER_AUTH_TRUSTED_ORIGINS,
    env.AUTH_TRUSTED_ORIGINS,
  ].flatMap((value) => value?.split(",") ?? []);

  const origins = [
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    ...configuredOrigins,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.103:3000",
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set(origins));
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
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      disableImplicitLinking: false,
      requireLocalEmailVerified: true,
      trustedProviders: [],
    },
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
  trustedOrigins: getTrustedOrigins(),
  socialProviders: createSocialProviders(),
});

export type Auth = typeof auth;
