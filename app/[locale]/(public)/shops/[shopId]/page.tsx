import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheckIcon, MessageCircleIcon, PackageIcon, StoreIcon } from "lucide-react";
import { BuyerTopBar } from "#/components/BuyerShell";
import { JsonLd } from "#/components/JsonLd";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent } from "#/components/ui/card";
import { ShopFollowButton } from "#/features/buyer";
import { resolveLocale, withLocale } from "#/i18n/config";
import { createTranslator } from "#/i18n/server";
import { publicPageMetadata, requirePublicShopSeo, storeJsonLd } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; shopId: string }> }): Promise<Metadata> {
  const { locale, shopId } = await params;
  const shop = await requirePublicShopSeo(shopId);

  return publicPageMetadata({
    title: shop.name,
    description: createTranslator(locale)("seo.shopDescription").replace("{shop}", shop.name),
    path: `/shops/${shop.id}`,
    locale,
  });
}

export default async function ShopPage({ params }: { params: Promise<{ locale: string; shopId: string }> }) {
  const { locale, shopId } = await params;
  const resolvedLocale = resolveLocale(locale);
  const t = createTranslator(locale);
  const shop = await requirePublicShopSeo(shopId);

  return (
    <>
      <JsonLd data={storeJsonLd(shop)} />
      <div className="seller-shell min-h-[calc(100vh-80px)] bg-white text-slate-950">
        <BuyerTopBar title={shop.name} />
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-y-0 left-0 w-1 bg-orange-600" aria-hidden="true" />
            <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm">
                  <StoreIcon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{t("seller.nav.manage")}</p>
                  <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{shop.name}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("seo.shopPageDescription")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1.5 border-orange-200 bg-orange-50 text-orange-800">
                      <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                      {t("seller.verifiedMarketplaceShop")}
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5 bg-slate-100 text-slate-700">
                      <PackageIcon className="size-3.5" aria-hidden="true" />
                      {t("seller.activeItemsCount").replace("{count}", String(shop.products.length))}
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5 bg-slate-100 text-slate-700">
                      <MessageCircleIcon className="size-3.5" aria-hidden="true" />
                      {t("seller.fastChatAvailable")}
                    </Badge>
                  </div>
                </div>
              </div>
              <ShopFollowButton shopId={shop.id} className="w-full rounded-md px-5 sm:w-auto" />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{t("common.marketplace")}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{t("common.products")}</h2>
              </div>
              <span className="text-sm font-medium text-slate-500">{t("seller.activeItemsCount").replace("{count}", String(shop.products.length))}</span>
            </div>

            {shop.products.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {shop.products.map((product) => {
                  const variant = product.variants[0];
                  const productHref = withLocale(`/products/${product.id}`, resolvedLocale);
                  return (
                    <Card key={product.id} className="group overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
                      <Link href={productHref} className="flex aspect-square items-center justify-center border-b border-slate-100 bg-slate-50 text-orange-600 transition group-hover:bg-orange-50" aria-label={product.title}>
                        <PackageIcon className="size-12 stroke-[1.4]" aria-hidden="true" />
                      </Link>
                      <CardContent className="p-4">
                        <Link href={productHref} className="no-underline">
                          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900 group-hover:text-orange-700">{product.title}</h3>
                        </Link>
                        <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">
                          {product.description || t("product.detailsAvailableOnProductPage")}
                        </p>
                        {variant ? (
                          <p className="mt-3 text-base font-semibold text-orange-600">
                            {new Intl.NumberFormat(resolvedLocale, {
                              style: "currency",
                              currency: variant.currency,
                            }).format(Number(variant.price) / 100)}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
                {t("product.noProductsFound")}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
