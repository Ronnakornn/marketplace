import { Elysia } from "elysia";
import type { Role } from "#generated/client/enums.ts";
import { prisma } from "#server/lib/prisma.ts";
import {
  createSellerOperationalReadinessError,
  resolveSellerOperationalReadiness,
} from "#server/modules/security/seller-readiness.ts";
import { auth } from "./auth.ts";
import { getAuthContext } from "./auth.context.ts";

async function getSellerReadinessState(userId: string) {
  const [activeShopCount, application] = await Promise.all([
    prisma.shop.count({
      where: {
        ownerId: userId,
        status: "ACTIVE",
      },
    }),
    prisma.sellerApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ]);

  return {
    hasActiveShop: activeShopCount > 0,
    applicationStatus: application?.status ?? null,
  };
}

export const authPlugin = new Elysia({ name: "auth" })
  .mount(auth.handler)
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
    withRole(role: Role) {
      return {
        async resolve({ status, request: { headers } }: any) {
          const authContext = await getAuthContext(headers);
          if (!authContext) return status(401);
          if (authContext.user.status === "SUSPENDED") {
            return status(403);
          }
          if (authContext.user.role !== role) return status(403);
          return { authContext };
        },
      };
    },
    withSellerOperational: {
      async resolve({ status, request: { headers } }: any) {
        const authContext = await getAuthContext(headers);
        if (!authContext) return status(401);
        if (authContext.user.status === "SUSPENDED") {
          return status(403);
        }

        const readiness = resolveSellerOperationalReadiness(
          await getSellerReadinessState(authContext.user.id),
        );
        const readinessError = createSellerOperationalReadinessError(readiness);
        if (readinessError) {
          return status(readinessError.status, {
            error: {
              code: readinessError.code,
              message: readinessError.message,
              details: readinessError.details ?? {},
            },
          });
        }

        return {
          authContext,
        };
      },
    },
  } as any);
