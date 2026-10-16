import { describe, expect, it } from 'vitest'
import { adminPath, canVisitAdminPath, adminNavigationPermissions } from './navigation'
import en from '../../../../messages/en.json'
import th from '../../../../messages/th.json'

it('hides unresolved, absent and unknown administrator permissions', () => { expect(canVisitAdminPath(undefined, '/admin/users')).toBe(false); expect(canVisitAdminPath([], '/admin/users')).toBe(false); expect(canVisitAdminPath(['*'], '/admin/users')).toBe(false); expect(canVisitAdminPath(['users.read'], '/admin/finance')).toBe(false) })
it('maps localized nested pages and query links to the owning read permission', () => { expect(adminPath('/th/admin/users/buyer-1?q=x')).toBe('/admin/users/buyer-1'); expect(canVisitAdminPath(['users.read'], '/th/admin/users/buyer-1')).toBe(true); expect(canVisitAdminPath(['orders.read'], '/en/admin/orders?paymentState=PENDING')).toBe(true); expect(canVisitAdminPath(['catalog.read'], '/admin/catalog/imports')).toBe(true); expect(canVisitAdminPath(['reports.read'], '/admin/report-schedules')).toBe(false); expect(canVisitAdminPath(['reports.export'], '/admin/report-schedules')).toBe(true) })
it('covers the new operations, access and reporting pages', () => { for (const [path, permission] of Object.entries(adminNavigationPermissions)) expect(canVisitAdminPath([permission], path)).toBe(true) })
function keys(value: unknown, prefix = ''): string[] { if (!value || typeof value !== 'object') return [prefix]; return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key)).sort() }
describe('integration locale coverage', () => {
  it('provides the same Thai and English administrator keys', () => {
    expect(keys(th.admin.integration)).toEqual(keys(en.admin.integration))
  })
  it('provides the same Thai and English support keys', () => {
    expect(keys(th.support.integration)).toEqual(keys(en.support.integration))
  })
})
