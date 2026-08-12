"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { unsubscribePushForCurrentBrowser } from "#/lib/push-notifications";

const authBaseUrl =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    : window.location.origin;

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    inferAdditionalFields({
      user: {
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
      },
    }),
  ],
});

export const { useSession, signIn, signUp } = authClient;

export async function signOut() {
  try {
    await unsubscribePushForCurrentBrowser();
  } catch {
    // Signing out must not depend on browser push support or provider availability.
  }
  return authClient.signOut();
}
