"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, ShieldCheckIcon, ShoppingCartIcon, StarIcon, TruckIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { addCartItem, fetchCart, fetchProduct, fetchProducts, formatMoney } from "#/features/buyer/api";
import { ProductCard } from "#/features/product/components/ProductCard";
import { useSession } from "#/lib/auth-client";

export function ProductDetailPage({ productId }: { productId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const productQuery = useQuery({ queryKey: ["buyer-product", productId], queryFn: () => fetchProduct(productId) });
  const relatedQuery = useQuery({ queryKey: ["buyer-related-products", productId], queryFn: () => fetchProducts({ limit: 4 }) });
  const cartQuery = useQuery({
    queryKey: ["buyer-cart"],
    queryFn: fetchCart,
    enabled: Boolean(session),
  });
  const addCartMutation = useMutation({
    mutationFn: () => {
      const variantId = productQuery.data?.variants[0]?.id;
      if (!variantId) throw new Error("ไม่มีตัวเลือกสินค้าพร้อมขาย");
      return addCartItem(variantId, 1);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart"] }),
  });
  const cartItemCount = cartQuery.data?.shops.reduce(
    (total, shop) => total + shop.items.reduce((shopTotal, item) => shopTotal + item.quantity, 0),
    0,
  ) ?? 0;

  function handleCartAction() {
    if (!session) {
      router.push("/login");
      return;
    }
    addCartMutation.mutate();
  }

  if (productQuery.isLoading) {
    return (
      <>
        <BuyerTopBar title="Product" />
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4"><BuyerLoadingList /></div>
      </>
    );
  }

  if (productQuery.isError) {
    return (
      <>
        <BuyerTopBar title="Product" />
        <div className="mx-auto max-w-6xl px-3 pb-28 pt-4"><BuyerErrorState message={productQuery.error.message} onRetry={() => void productQuery.refetch()} /></div>
      </>
    );
  }

  const product = productQuery.data;
  if (!product) return null;
  const mainImage = product.images[0];

  return (
    <>
      <BuyerTopBar title={product.title} />
      <article className="mx-auto max-w-6xl space-y-4 px-3 pb-28 pt-4">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-square bg-gradient-to-br from-orange-100 via-rose-100 to-white">
              {mainImage ? <Image src={mainImage} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">No image</div>}
            </div>
            {product.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {product.images.slice(0, 6).map((image) => (
                  <div key={image} className="relative size-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <Image src={image} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">{product.shop.name}</Badge>
            <h1 className="text-2xl font-bold text-slate-950">{product.title}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1"><StarIcon className="size-4 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>
              <span>{product.soldCount} sold</span>
              <span>{product.stock} in stock</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{formatMoney(product.priceCents, product.currency)}</p>
            <div className="space-y-2">
              <h2 className="font-semibold">Variants</h2>
              <div className="flex flex-wrap gap-2">
                {(product.variants.length ? product.variants : [{ id: product.id, title: "Default", stock: product.stock }]).map((variant) => (
                  <Badge key={variant.id} variant="outline" className="rounded-md px-3 py-1">{variant.title}</Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-slate-700">
              <span className="flex items-center gap-2"><TruckIcon className="size-4 text-orange-600" />Shipping calculated at checkout</span>
              <span className="flex items-center gap-2"><ShieldCheckIcon className="size-4 text-emerald-600" />Buyer protection on eligible orders</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">{product.description ?? "ยังไม่มีรายละเอียดสินค้า"}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Reviews</h2>
          <BuyerEmptyState title="ยังไม่มีรีวิว" description="รีวิวจากผู้ซื้อจะแสดงที่นี่เมื่อมีข้อมูลจาก API" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Related products</h2>
          {relatedQuery.isSuccess && relatedQuery.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{relatedQuery.data.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div>
          ) : null}
        </section>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] md:bottom-0">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button variant="outline" size="icon" className="size-12 shrink-0 rounded-2xl"><HeartIcon className="size-5" /><span className="sr-only">Wishlist</span></Button>
          <Button variant="outline" className="h-12 flex-1 rounded-2xl" onClick={handleCartAction} disabled={addCartMutation.isPending}>
            <span className="relative inline-flex">
              <ShoppingCartIcon className="size-4" />
              {cartItemCount > 0 ? (
                <span className="absolute -right-2.5 -top-2.5 flex min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-4 text-white">
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              ) : null}
            </span>
            Add to cart
          </Button>
          <Button className="h-12 flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700" onClick={handleCartAction} disabled={addCartMutation.isPending}>Buy now</Button>
        </div>
      </div>
    </>
  );
}
