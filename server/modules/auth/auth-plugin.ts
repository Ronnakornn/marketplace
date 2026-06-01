import { Elysia } from "elysia";
import type { Role } from "#generated/client/enums.ts";
import { auth, getSocialProviderAvailability } from "./auth.ts";
import { getAuthContext } from "./auth.context.ts";

export const authPlugin = new Elysia({ name: "auth" })
  .mount(auth.handler)
  .get("/api/auth/provider-availability", () => getSocialProviderAvailability())
  .macro({
    withAuth: {
      async resolve({ status, request: { headers } }: any) {
        const authContext = await getAuthContext(headers);
        if (!authContext) return status(401);
        if (authContext.user.status === "SUSPENDED") {
          return status(403);
        }
        return { authContext };
      },
    },
    withVerifiedAuth: {
      async resolve({ status, request: { headers } }: any) {
        const authContext = await getAuthContext(headers);
        if (!authContext) return status(401);
        if (authContext.user.status === "SUSPENDED") {
          return status(403);
        }
        if (!authContext.user.emailVerified) {
          return status(403);
        }
        return { authContext };
      },
    },
    withRole(role: Role) {
      return {
        async resolve({ status, request: { headers } }: any) {
          const authContext = await getAuthContext(headers);
          if (!authContext) return status(401);
          if (authContext.user.status === "SUSPENDED") {
            return status(403);
          }
          if (!authContext.user.emailVerified) {
            return status(403);
          }
          if (authContext.user.role !== role) return status(403);
          return { authContext };
        },
      };
    },
  } as any);
