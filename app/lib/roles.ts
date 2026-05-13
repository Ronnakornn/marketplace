export const ROLES = {
  USER: "USER",
  SELLER: "SELLER",
  ADMIN: "ADMIN",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export function isAdminRole(role: string | null | undefined): role is "ADMIN" {
  return role === ROLES.ADMIN;
}

export function isSystemRole(role: string | null | undefined): role is "SELLER" | "ADMIN" {
  return role === ROLES.SELLER || role === ROLES.ADMIN;
}
