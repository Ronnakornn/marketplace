export type SellerApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type SellerRouteKind = "register" | "status" | "operational";

export interface SellerApplicationState {
  status: SellerApplicationStatus;
}

export interface SellerAccessState {
  hasActiveShop: boolean;
  application: SellerApplicationState | null;
}

export function getSellerRouteKind(pathname: string): SellerRouteKind {
  if (pathname === "/seller/register" || pathname.startsWith("/seller/register/")) return "register";
  if (pathname === "/seller/status") return "status";
  return "operational";
}

export function getRequiredSellerPath(access: SellerAccessState): "/seller" | "/seller/register" | "/seller/status" {
  if (access.hasActiveShop) return "/seller";

  const status = access.application?.status;
  if (status === "SUBMITTED" || status === "APPROVED") {
    return "/seller/status";
  }

  return "/seller/register";
}

export function getSellerRedirectPath(pathname: string, access: SellerAccessState) {
  const routeKind = getSellerRouteKind(pathname);
  const requiredPath = getRequiredSellerPath(access);

  if (requiredPath === "/seller" && routeKind !== "operational") return requiredPath;
  if (requiredPath === "/seller/register" && routeKind !== "register") return requiredPath;
  if (requiredPath === "/seller/status" && routeKind !== "status") return requiredPath;

  return null;
}
