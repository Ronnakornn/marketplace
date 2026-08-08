import Link from 'next/link'
import { MessageCircleIcon, StarIcon, StoreIcon, UsersIcon } from 'lucide-react'
import type { PublicStorefrontProfile } from '#server/modules/seller-shop/seller-shop.service.ts'
import { resolveUploadedImageUrl } from '#/lib/assets'

export function StorefrontIdentity({ shop, locale, labels }: {
  shop: PublicStorefrontProfile
  locale: 'th' | 'en'
  labels: { products: string; reviews: string; followers: string; chat: string; manage: string; logoAlt: string }
}) {
  const logo = shop.logoUrl ? resolveUploadedImageUrl(shop.logoUrl) : null
  const cover = shop.coverUrl ? resolveUploadedImageUrl(shop.coverUrl) : null
  const logoNode = logo
    ? <img src={logo} alt={labels.logoAlt} className="size-20 rounded-xl border-4 border-white bg-white object-cover shadow-sm" />
    : <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-xl border-4 border-white bg-orange-600 text-white shadow-sm"><StoreIcon className="size-9" /></span>

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {cover ? <div className="relative h-40 bg-slate-100 sm:h-56"><img src={cover} alt="" className="size-full object-cover" /><div className="absolute -bottom-10 left-5">{logoNode}</div></div> : null}
    <div className={`p-5 ${cover ? 'pt-14' : ''}`}>
      {!cover ? <div className="mb-4">{logoNode}</div> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{shop.name}</h1>{shop.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-slate-600">{shop.description}</p> : null}</div>
        {shop.viewer.isOwner ? <Link href={`/${locale}/seller?shopId=${shop.id}`} className="rounded-md bg-orange-600 px-4 py-2 text-center text-sm font-semibold text-white no-underline">{labels.manage}</Link> : null}
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
        <div className="flex items-center gap-1.5"><StarIcon className="size-4 text-orange-600" aria-hidden="true" /><dt className="sr-only">{labels.reviews}</dt><dd><Link href="#reviews" className="rounded-sm underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">{shop.ratingAverage.toFixed(1)} · {shop.ratingCount} {labels.reviews}</Link></dd></div>
        <div className="flex items-center gap-1.5"><UsersIcon className="size-4 text-orange-600" aria-hidden="true" /><dt className="sr-only">{labels.followers}</dt><dd>{shop.followerCount} {labels.followers}</dd></div>
        <div><dt className="sr-only">{labels.products}</dt><dd>{shop.productCount} {labels.products}</dd></div>
        {shop.chatEnabled && !shop.viewer.isOwner ? <div className="flex items-center gap-1.5"><MessageCircleIcon className="size-4 text-orange-600" aria-hidden="true" /><dt className="sr-only">{labels.chat}</dt><dd>{labels.chat}</dd></div> : null}
      </dl>
    </div>
  </section>
}
