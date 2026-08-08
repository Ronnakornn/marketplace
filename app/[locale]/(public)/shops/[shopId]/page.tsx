import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BuyerTopBar } from '#/components/BuyerShell'
import { JsonLd } from '#/components/JsonLd'
import { StorefrontIdentity } from '#/features/storefront/StorefrontIdentity'
import { resolveLocale } from '#/i18n/config'
import { createTranslator } from '#/i18n/server'
import { getServerSession } from '#/lib/auth-server'
import { publicPageMetadata, resolvePublicSeoImage, safeDescription, safeTitle, storeJsonLd } from '#/lib/seo'
import { getPublicStorefront } from '#server/modules/seller-shop/public-storefront.server.ts'
import { SellerShopServiceError } from '#server/modules/seller-shop/seller-shop.errors.ts'

async function requireStorefront(identifier: string, locale: 'th' | 'en', viewerId?: string) {
  try { return await getPublicStorefront(identifier, locale, viewerId) }
  catch (error) { if (error instanceof SellerShopServiceError && error.status === 404) notFound(); throw error }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; shopId: string }> }): Promise<Metadata> {
  const { locale, shopId } = await params
  const resolvedLocale = resolveLocale(locale)
  const t = createTranslator(resolvedLocale)
  const shop = await requireStorefront(shopId, resolvedLocale)
  return publicPageMetadata({
    title: safeTitle(shop.metaTitle ?? shop.name, shop.name),
    description: safeDescription(shop.metaDescription ?? shop.description, t('seo.shopDescription').replace('{shop}', shop.name)),
    path: `/shops/${shop.slug}`,
    locale: resolvedLocale,
    image: resolvePublicSeoImage(shop.coverUrl, shop.logoUrl),
  })
}

export default async function ShopPage({ params }: { params: Promise<{ locale: string; shopId: string }> }) {
  const { locale, shopId } = await params
  const resolvedLocale = resolveLocale(locale)
  const t = createTranslator(resolvedLocale)
  const session = await getServerSession()
  const shop = await requireStorefront(shopId, resolvedLocale, session?.user.id)
  return <>
    <JsonLd data={storeJsonLd(shop, resolvedLocale)} />
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 text-slate-950">
      <BuyerTopBar title={shop.name} />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <StorefrontIdentity shop={shop} locale={resolvedLocale} labels={{
          products: t('storefront.products'), reviews: t('storefront.reviews'), followers: t('storefront.followers'),
          chat: t('storefront.chatAvailable'), manage: t('storefront.manageShop'), logoAlt: t('storefront.logoAlt').replace('{shop}', shop.name),
        }} />
      </main>
    </div>
  </>
}
