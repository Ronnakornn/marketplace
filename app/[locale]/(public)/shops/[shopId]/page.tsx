import type { Metadata } from "next";
import Link from "next/link";
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
      <main className="mx-auto max-w-6xl space-y-5 px-3 pb-28 pt-4">
        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
            {t("seller.dashboard")}
          </Badge>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">{shop.name}</h1>
              <p className="mt-2 text-sm text-slate-600">{t("seo.shopPageDescription")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">{t("seller.verifiedMarketplaceShop")}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{t("seller.activeItemsCount").replace("{count}", String(shop.products.length))}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{t("seller.fastChatAvailable")}</span>
              </div>
            </div>
            <ShopFollowButton shopId={shop.id} />
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{t("common.marketplace")}</h2>
            <p className="text-xs text-slate-500">{t("seller.activeItemsCount").replace("{count}", String(shop.products.length))}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {shop.products.map((product) => {
              const variant = product.variants[0];
              return (
                <Card key={product.id} className="overflow-hidden rounded-3xl border-slate-200 bg-white py-0 shadow-sm">
                  <Link href={withLocale(`/products/${product.id}`, resolvedLocale)} className="block aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white" />
                  <CardContent className="p-3">
                    <Link href={withLocale(`/products/${product.id}`, resolvedLocale)}>
                      <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">{product.title}</h3>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {product.description || t("product.detailsAvailableOnProductPage")}
                    </p>
                    {variant ? (
                      <p className="mt-2 font-bold text-orange-600">
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
        </section>
      </main>
    </>
  );
}
