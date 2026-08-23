"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCartIcon } from "lucide-react";
import { GUEST_CART_CHANGED_EVENT, readGuestCart } from "#/features/cart/guest-cart";

export function GuestCartLink({ href, label }: { href: string; label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(readGuestCart().reduce((total, item) => total + item.quantity, 0));
    sync();
    window.addEventListener(GUEST_CART_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(GUEST_CART_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  return <Link href={href} prefetch={false} className="relative flex size-10 items-center justify-center rounded-full text-slate-900 transition hover:bg-orange-50 hover:text-orange-600" aria-label={count ? `${label} (${count})` : label}>
    <ShoppingCartIcon className="size-5" />
    {count ? <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-orange-700 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{count > 99 ? "99+" : count}</span> : null}
    <span className="sr-only">{label}</span>
  </Link>;
}
