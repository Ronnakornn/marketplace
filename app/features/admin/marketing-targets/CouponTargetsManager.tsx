'use client'
import { useState } from 'react'
import { treaty } from '@elysiajs/eden'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { createCouponTargetsRoutes } from '#server/modules/promotion/coupon-targets.routes'
import { useTranslations } from '#/i18n/client'
import { Button } from '#/components/ui/button'
import { useAdminAccess } from '#/features/admin/access/useAdminAccess'

const api = treaty<ReturnType<typeof createCouponTargetsRoutes>>(
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    : window.location.origin,
  { fetch: { credentials: 'include' } },
)
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function splitIds(value: string) {
  return value
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean)
}
export function CouponTargetsManager() {
  const t = useTranslations(),
    client = useQueryClient(),
    access = useAdminAccess()
  const [page, setPage] = useState(1),
    [couponId, setCouponId] = useState(''),
    [productText, setProductText] = useState(''),
    [categoryText, setCategoryText] = useState(''),
    [version, setVersion] = useState<number | null>(null)
  const choices = useQuery({
    queryKey: ['admin', 'coupon-target-choices', page],
    queryFn: async () => {
      const result = await api.api.admin['coupon-targets'].get({
        query: { page, limit: 20 },
      })
      if (result.error) throw result.error
      return result.data
    },
  })
  const load = useMutation({
    mutationFn: async (id: string) => {
      const result = await api.api.admin['coupon-targets']({
        couponId: id,
      }).get()
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: (data) => {
      setCouponId(data.coupon.id)
      setProductText(data.productIds.join('\n'))
      setCategoryText(data.categoryIds.join('\n'))
      setVersion(data.version)
    },
  })
  const productIds = splitIds(productText),
    categoryIds = splitIds(categoryText)
  const valid =
    productIds.length <= 100 &&
    categoryIds.length <= 100 &&
    [...productIds, ...categoryIds].every((id) => uuid.test(id)) &&
    new Set(productIds.map((id) => id.toLowerCase())).size ===
      productIds.length &&
    new Set(categoryIds.map((id) => id.toLowerCase())).size ===
      categoryIds.length
  const save = useMutation({
    mutationFn: async () => {
      if (version === null || !valid) throw new Error('Invalid input')
      const result = await api.api.admin['coupon-targets']({ couponId }).put({
        productIds,
        categoryIds,
        expectedVersion: version,
      })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: (data) => {
      setVersion(data.version)
      void client.invalidateQueries({
        queryKey: ['admin', 'coupon-target-choices'],
      })
    },
  })
  return (
    <section className="admin-panel rounded-xl p-5">
      <h2 className="text-xl font-semibold">{t('admin.targets.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('admin.targets.description')}
      </p>
      {choices.isPending && <p role="status">{t('admin.directory.loading')}</p>}
      {choices.error && <p role="alert">{t('admin.directory.failed')}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {choices.data?.items.map((coupon) => (
          <Button
            variant={couponId === coupon.id ? 'default' : 'outline'}
            key={coupon.id}
            onClick={() => {
              setVersion(null)
              save.reset()
              load.mutate(coupon.id)
            }}
          >
            {coupon.code}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t('admin.directory.previous')}
        </Button>
        <Button
          variant="outline"
          disabled={!choices.data || choices.data.total <= page * 20}
          onClick={() => setPage(page + 1)}
        >
          {t('admin.directory.next')}
        </Button>
      </div>
      {load.isPending && <p role="status">{t('admin.directory.loading')}</p>}
      {load.error && <p role="alert">{t('admin.directory.failed')}</p>}
      {version !== null && (
        <form
          className="mt-5 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <h3 className="font-semibold">{load.data?.coupon.code}</h3>
          <label htmlFor="target-products">{t('admin.targets.products')}</label>
          <textarea
            id="target-products"
            className="min-h-28 rounded border p-3 font-mono text-sm"
            value={productText}
            onChange={(event) => setProductText(event.target.value)}
          />
          <label htmlFor="target-categories">
            {t('admin.targets.categories')}
          </label>
          <textarea
            id="target-categories"
            className="min-h-28 rounded border p-3 font-mono text-sm"
            value={categoryText}
            onChange={(event) => setCategoryText(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {t('admin.targets.help')}
          </p>
          {!valid && <p role="alert">{t('admin.targets.invalid')}</p>}
          {access.data?.permissions.includes('marketing.write') && (
            <Button disabled={!valid || save.isPending}>
              {t('admin.targets.save')}
            </Button>
          )}
          {save.error && <p role="alert">{t('admin.targets.failed')}</p>}
          {save.isSuccess && <p role="status">{t('admin.targets.saved')}</p>}
          <Button
            type="button"
            variant="outline"
            onClick={() => load.mutate(couponId)}
          >
            {t('admin.targets.reload')}
          </Button>
        </form>
      )}
    </section>
  )
}
