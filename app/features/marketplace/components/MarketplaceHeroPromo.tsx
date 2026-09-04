import Link from "next/link";
import Image from "next/image";
import { Button } from "#/components/ui/button";
import type { MarketplaceBanner } from "#/features/marketplace/queries";
import { resolveUploadedImageUrl } from "#/lib/assets";

interface MarketplaceHeroPromoProps {
  banner: MarketplaceBanner | undefined;
  href: string;
  voucherHref: string;
  shopNowLabel: string;
  claimVoucherLabel: string;
  onBannerClick?: () => void;
}

export function MarketplaceHeroPromo({
  banner,
  href,
  voucherHref,
  shopNowLabel,
  claimVoucherLabel,
  onBannerClick,
}: MarketplaceHeroPromoProps) {
  if (!banner) return null;
  const imageUrl = banner.imageUrl ? resolveUploadedImageUrl(banner.imageUrl) : null;
  const mobileImageUrl = banner.mobileImageUrl ? resolveUploadedImageUrl(banner.mobileImageUrl) : imageUrl;

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-4 text-white shadow-[0_18px_48px_rgba(244,63,94,0.24)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{banner.title}</h1>
          {banner.subtitle ? <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">{banner.subtitle}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-white text-rose-600 hover:bg-white/95">
              <Link href={href} prefetch={false} onClick={onBannerClick}>{shopNowLabel}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href={voucherHref} prefetch={false}>{claimVoucherLabel}</Link>
            </Button>
          </div>
        </div>
        {imageUrl ? (
          <picture className="aspect-square w-24 shrink-0 overflow-hidden rounded-[1.5rem] bg-white/15 sm:w-40 sm:rounded-[2rem]">
            {mobileImageUrl ? <source media="(max-width: 639px)" srcSet={mobileImageUrl} /> : null}
            <Image src={imageUrl} alt={banner.title} width={160} height={160} sizes="(max-width: 639px) 96px, 160px" className="size-full object-cover" priority />
          </picture>
        ) : null}
      </div>
    </section>
  );
}
