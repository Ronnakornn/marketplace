"use client";

import Link from "next/link";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCartIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { buyAgain, type BuyAgainResult } from "../api";

export function BuyAgainButton({ orderId }: { orderId: string }) {
  const t = useTranslations();
  const formatters = useFormatters();
  const localePath = useLocalePath();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: () => buyAgain(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["buyer-cart"] });
    },
    onSettled: () => { submitting.current = false; },
  });
  const result = mutation.data;
  const addedQuantity = result?.items.reduce((sum, item) => sum + item.addedQuantity, 0) ?? 0;
  const cartReady = result?.items.some(item => item.kind !== "skipped" && item.finalQuantity > 0) ?? false;

  function submit() {
    if (submitting.current) return;
    submitting.current = true;
    mutation.mutate();
  }

  function outcomeText(item: BuyAgainResult["items"][number]): string {
    switch (item.kind) {
      case "added": return t("order.buyAgain.added").replace("{added}", String(item.addedQuantity)).replace("{final}", String(item.finalQuantity));
      case "partial": return t("order.buyAgain.partial").replace("{added}", String(item.addedQuantity)).replace("{final}", String(item.finalQuantity)).replace("{target}", String(item.targetQuantity));
      case "already_in_cart": return t("order.buyAgain.alreadyInCart").replace("{quantity}", String(item.finalQuantity));
      case "skipped": return t("order.buyAgain.skipped").replace("{reason}", t(`order.buyAgain.reasons.${item.reason}`));
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <Button type="button" variant="outline" className="rounded-full" disabled={mutation.isPending} onClick={submit}>
        <ShoppingCartIcon className="size-4" aria-hidden="true" />
        {mutation.isPending ? t("order.buyAgain.checking") : t("order.buyAgain.button")}
      </Button>
      <p className="mt-2 text-xs text-slate-500">{t("order.buyAgain.notice")}</p>
      {mutation.isError ? <p role="alert" className="mt-2 text-sm text-red-600">{t("order.buyAgain.error")}</p> : null}
      {result && !mutation.isPending ? (
        <div aria-live="polite" className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold">{addedQuantity > 0
            ? t("order.buyAgain.summary").replace("{count}", String(addedQuantity))
            : t(cartReady ? "order.buyAgain.cartReady" : "order.buyAgain.none")}</p>
          <ul className="space-y-2">
            {result.items.map(item => (
              <li key={item.variantId}>
                <p className="font-medium">{item.productTitle} · {item.variantTitle}</p>
                <p className={item.kind === "skipped" ? "text-amber-800" : "text-slate-600"}>{outcomeText(item)}</p>
                {item.kind !== "skipped" ? <p className="text-xs text-slate-500">{t("order.buyAgain.currentPrice")} {formatters.currency(item.unitPrice, item.currency)}</p> : null}
              </li>
            ))}
          </ul>
          {cartReady ? <Button asChild className="bg-orange-600 hover:bg-orange-700"><Link href={localePath("/cart")}>{t("order.buyAgain.openCart")}</Link></Button> : null}
        </div>
      ) : null}
    </div>
  );
}
