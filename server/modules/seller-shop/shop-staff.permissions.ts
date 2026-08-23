import type { ShopStaffRoleType } from '#generated/client/enums.ts'

export const STAFF_ROLE_PERMISSIONS = {
  MANAGER: ['products', 'inventory', 'shipments', 'promotions', 'chat'],
  WAREHOUSE: ['inventory', 'shipments'],
  SUPPORT: ['chat', 'returns'],
} as const satisfies Partial<Record<ShopStaffRoleType, readonly string[]>>

export type AssignableStaffRole = keyof typeof STAFF_ROLE_PERMISSIONS

export function isAssignableStaffRole(role: string): role is AssignableStaffRole {
  return role in STAFF_ROLE_PERMISSIONS
}

export function permissionsForStaffRole(role: AssignableStaffRole): string[] {
  return [...STAFF_ROLE_PERMISSIONS[role]]
}
