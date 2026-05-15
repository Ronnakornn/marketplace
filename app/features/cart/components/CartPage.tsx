"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchCart, formatMoney, removeCartItem, updateCartItem } from "#/features/buyer/api";
import { useLocale } from "#/i18n/client";

export function CartPage() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const cartQuery = useQuery({ queryKey: ["buyer-cart", locale], queryFn: () => fetchCart(locale) });
  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] }),
  });

  const cart = cartQuery.data;
  const itemCount = cart?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0;

  return (
    <>
      <BuyerTopBar title="Cart" />
      <div className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4">
        {cartQuery.isLoading ? <BuyerLoadingList /> : null}
        {cartQuery.isError ? <BuyerErrorState message={cartQuery.error.message} onRetry={() => void cartQuery.refetch()} /> : null}
        {cartQuery.isSuccess && itemCount === 0 ? <BuyerEmptyState title="รถเข็นว่าง" description="เพิ่มสินค้าลงรถเข็นแล้วกลับมาชำระเงินได้จากหน้านี้" /> : null}
        {cart ? cart.shops.map((shop) => (
          <section key={shop.shopId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="font-bold text-slate-950">{shop.shopName}</h2>
              <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">{formatMoney(shop.subtotalCents, cart.currency)}</Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {shop.items.map((item) => (
                <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Link href={`/products/${item.productId}`} className="font-semibold text-slate-950 hover:text-orange-600">{item.title}</Link>
                    <p className="mt-1 text-sm text-slate-500">{item.variantTitle}</p>
                    <p className="mt-2 font-bold text-orange-600">{formatMoney(item.unitPriceCents, item.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="rounded-full" disabled={item.quantity <= 1 || updateMutation.isPending} onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })}>
                      <MinusIcon className="size-4" /><span className="sr-only">Decrease</span>
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="rounded-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}>
                      <PlusIcon className="size-4" /><span className="sr-only">Increase</span>
                    </Button>
                    <Button size="icon" variant="ghost" className="rounded-full" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(item.id)}>
                      <Trash2Icon className="size-4 text-red-600" /><span className="sr-only">Remove</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )) : null}
      </div>

      {cart && itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] md:bottom-0">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Subtotal</p>
              <p className="text-lg font-bold text-slate-950">{formatMoney(cart.subtotalCents, cart.currency)}</p>
            </div>
            <Button asChild className="h-12 min-w-36 rounded-2xl bg-orange-600 hover:bg-orange-700"><Link href="/checkout">Checkout</Link></Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
