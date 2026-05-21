import { describe, expect, it } from "vitest";
import { getSellerRedirectPath, getSellerRouteKind, getRequiredSellerPath } from "./seller-access";

describe("seller access routing", () => {
  it("sends users without an application or shop to seller registration", () => {
    const access = { hasActiveShop: false, application: null };

    expect(getRequiredSellerPath(access)).toBe("/seller/register");
    expect(getSellerRedirectPath("/seller", access)).toBe("/seller/register");
    expect(getSellerRedirectPath("/seller/register", access)).toBeNull();
  });

  it("sends submitted rejected cancelled and approved-without-shop applications to status", () => {
    for (const status of ["SUBMITTED", "REJECTED", "CANCELLED", "APPROVED"] as const) {
      const access = { hasActiveShop: false, application: { status } };

      expect(getRequiredSellerPath(access)).toBe("/seller/status");
      expect(getSellerRedirectPath("/seller/register", access)).toBe("/seller/status");
      expect(getSellerRedirectPath("/seller/products", access)).toBe("/seller/status");
      expect(getSellerRedirectPath("/seller/status", access)).toBeNull();
    }
  });

  it("keeps draft applications on registration", () => {
    const access = { hasActiveShop: false, application: { status: "DRAFT" as const } };

    expect(getRequiredSellerPath(access)).toBe("/seller/register");
    expect(getSellerRedirectPath("/seller/status", access)).toBe("/seller/register");
  });

  it("sends active shops away from onboarding and status routes", () => {
    const access = { hasActiveShop: true, application: { status: "APPROVED" as const } };

    expect(getRequiredSellerPath(access)).toBe("/seller");
    expect(getSellerRedirectPath("/seller", access)).toBeNull();
    expect(getSellerRedirectPath("/seller/register", access)).toBe("/seller");
    expect(getSellerRedirectPath("/seller/status", access)).toBe("/seller");
    expect(getSellerRedirectPath("/seller/orders", access)).toBeNull();
  });

  it("classifies seller route kinds", () => {
    expect(getSellerRouteKind("/seller/register")).toBe("register");
    expect(getSellerRouteKind("/seller/status")).toBe("status");
    expect(getSellerRouteKind("/seller")).toBe("operational");
  });
});
