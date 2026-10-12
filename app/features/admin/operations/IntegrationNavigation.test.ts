import { describe, expect, it } from 'vitest'
import { adminPath, canVisitAdminPath, adminNavigationPermissions } from './navigation'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

it('hides unresolved, absent and unknown administrator permissions', () => { expect(canVisitAdminPath(undefined, '/admin/users')).toBe(false); expect(canVisitAdminPath([], '/admin/users')).toBe(false); expect(canVisitAdminPath(['*'], '/admin/users')).toBe(false); expect(canVisitAdminPath(['users.read'], '/admin/finance')).toBe(false) })
it('maps localized nested pages and query links to the owning read permission', () => { expect(adminPath('/th/admin/users/buyer-1?q=x')).toBe('/admin/users/buyer-1'); expect(canVisitAdminPath(['users.read'], '/th/admin/users/buyer-1')).toBe(true); expect(canVisitAdminPath(['orders.read'], '/en/admin/orders?paymentState=PENDING')).toBe(true); expect(canVisitAdminPath(['catalog.read'], '/admin/catalog/imports')).toBe(true); expect(canVisitAdminPath(['reports.read'], '/admin/report-schedules')).toBe(false); expect(canVisitAdminPath(['reports.export'], '/admin/report-schedules')).toBe(true) })
it('covers the new operations, access and reporting pages', () => { for (const [path, permission] of Object.entries(adminNavigationPermissions)) expect(canVisitAdminPath([permission], path)).toBe(true) })
function keys(value: unknown, prefix = ''): string[] { if (!value || typeof value !== 'object') return [prefix]; return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key)).sort() }
describe('integration locale coverage', () => { it('provides the same Thai and English keys', () => { const en: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '.audit/translations-integration.en.json'), 'utf8')); const th: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '.audit/translations-integration.th.json'), 'utf8')); expect(keys(en)).toEqual(keys(th)) }) })
