"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, StarIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import type { BuyerProduct } from "#/features/buyer/api";
import { formatMoney } from "#/features/buyer/api";
import { resolveUploadedImageUrl } from "#/lib/assets";

export function ProductCard({ product }: { product: BuyerProduct }) {
  const image = resolveUploadedImageUrl(product.images[0]);

  return (
    <Link href={`/products/${product.id}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
        <Image src={image} alt={product.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" />
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-slate-900">{product.title}</h3>
        <div className="flex items-end justify-between gap-2">
          <p className="text-base font-bold text-orange-600">{formatMoney(product.price, product.currency)}</p>
          <span className="text-xs text-slate-500">{product.soldCount} sold</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{product.shop.location}</span>
          </span>
        </div>
        <Badge variant="outline" className="max-w-full truncate rounded-full border-orange-200 bg-orange-50 font-normal text-orange-700">
          {product.shop.name}
        </Badge>
      </div>
    </Link>
  );
}
