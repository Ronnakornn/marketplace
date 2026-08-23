"use client";

import { useState } from "react";
import { ShoppingCartIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { addGuestCartItem } from "#/features/cart/guest-cart";
import type { GuestCartItemSnapshot } from "#/features/cart/guest-cart";

export function GuestAddToCartButton({ variantId, label, addedLabel, item }: { variantId: string; label: string; addedLabel: string; item: GuestCartItemSnapshot }) {
  const [added, setAdded] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500"
        aria-label={label}
        title={label}
        onClick={() => { addGuestCartItem(variantId, 1, item); setAdded(true); }}
      >
        <ShoppingCartIcon className="size-4" />
      </Button>
      <span className="sr-only" aria-live="polite">{added ? addedLabel : ""}</span>
    </>
  );
}
