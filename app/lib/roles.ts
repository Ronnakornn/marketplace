export const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export function isAdminRole(role: string | null | undefined): role is "ADMIN" {
  return role === ROLES.ADMIN;
}

export function isSystemRole(role: string | null | undefined): role is "ADMIN" {
  return isAdminRole(role);
}
