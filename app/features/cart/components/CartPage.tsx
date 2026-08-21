"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchCart, formatMoney, removeCartItem, updateCartItem } from "#/features/buyer/api";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function CartPage({ initialVoucher = "" }: { initialVoucher?: string }) {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations();
  const localePath = useLocalePath();
  const cartQuery = useQuery({ queryKey: ["buyer-cart", locale], queryFn: () => fetchCart(locale) });
  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-cart", locale] }),
  });
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const cart = cartQuery.data;
  const itemCount = cart?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0;
  const selectedItems = useMemo(
    () => cart?.shops.flatMap((shop) => shop.items).filter((item) => selectedItemIds.has(item.id)) ?? [],
    [cart, selectedItemIds],
  );
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const checkoutParams = new URLSearchParams({ items: selectedItems.map((item) => item.id).join(",") });
  if (initialVoucher) checkoutParams.set("voucher", initialVoucher);
  const checkoutHref = `${localePath("/checkout")}?${checkoutParams}`;

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId); else next.delete(itemId);
      return next;
    });
  }

  function toggleShop(itemIds: string[], checked: boolean) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      for (const itemId of itemIds) {
        if (checked) next.add(itemId); else next.delete(itemId);
      }
      return next;
    });
  }

  return (
    <>
      <BuyerTopBar title={t("cart.title")} />
      <div className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4">
        {cartQuery.isLoading ? <BuyerLoadingList /> : null}
        {cartQuery.isError ? <BuyerErrorState message={cartQuery.error.message} onRetry={() => void cartQuery.refetch()} /> : null}
        {cartQuery.isSuccess && itemCount === 0 ? <BuyerEmptyState title={t("cart.emptyTitle")} description={t("cart.emptyDescription")} /> : null}
        {cart ? cart.shops.map((shop) => (
          <section key={shop.shopId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-950">
                <input
                  type="checkbox"
                  checked={shop.items.length > 0 && shop.items.every((item) => selectedItemIds.has(item.id))}
                  onChange={(event) => toggleShop(shop.items.map((item) => item.id), event.target.checked)}
                  aria-label={t("cart.selectShop").replace("{shop}", shop.shopName)}
                />
                {shop.shopName}
              </label>
              <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">{formatMoney(shop.subtotal, cart.currency)}</Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {shop.items.map((item) => (
                <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[auto_96px_1fr_auto] sm:items-center">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={(event) => toggleItem(item.id, event.target.checked)}
                    aria-label={t("cart.selectItem").replace("{item}", item.title)}
                  />
                  <Link href={localePath(`/products/${item.productId}`)} className="block overflow-hidden rounded-lg bg-slate-100">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center text-xs text-slate-400">{t("cart.noImage")}</span>}
                  </Link>
                  <div>
                    <Link href={localePath(`/products/${item.productId}`)} className="font-semibold text-slate-950 hover:text-orange-600">{item.title}</Link>
                    <p className="mt-1 text-sm text-slate-700">{item.variantTitle}</p>
                    <p className="mt-2 font-bold text-orange-600">{formatMoney(item.unitPrice, item.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="rounded-full" disabled={item.quantity <= 1 || updateMutation.isPending} onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })}>
                      <MinusIcon className="size-4" /><span className="sr-only">{t("cart.decrease")}</span>
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="rounded-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}>
                      <PlusIcon className="size-4" /><span className="sr-only">{t("cart.increase")}</span>
                    </Button>
                    <Button size="icon" variant="ghost" className="rounded-full" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(item.id)}>
                      <Trash2Icon className="size-4 text-red-600" /><span className="sr-only">{t("cart.remove")}</span>
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
              <p className="text-xs font-medium text-slate-700">{t("cart.subtotal")}</p>
              <p className="text-lg font-bold text-slate-950">{formatMoney(selectedSubtotal, cart.currency)}</p>
              <p className="text-xs text-slate-500">{t("cart.selectedCount").replace("{count}", String(selectedItems.length))}</p>
            </div>
            {selectedItems.length > 0 ? (
              <Button asChild className="h-12 min-w-36 rounded-2xl bg-orange-600 hover:bg-orange-700"><Link href={checkoutHref}>{t("cart.checkout")}</Link></Button>
            ) : (
              <Button disabled className="h-12 min-w-36 rounded-2xl bg-orange-600">{t("cart.checkout")}</Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
