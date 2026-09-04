/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiscoveryHomeResponse } from "#/features/marketplace/queries";
import { MarketplaceGuestHome } from "./MarketplaceGuestHome";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...props }: { src: string; alt: string; fill?: boolean; sizes?: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("#/i18n/server", () => ({
  createTranslator: () => (key: string) => key,
}));

vi.mock("#/features/cart/components/GuestAddToCartButton", () => ({
  GuestAddToCartButton: () => <button type="button">Add</button>,
}));

vi.mock("#/features/cart/components/GuestCartLink", () => ({
  GuestCartLink: ({ href, label }: { href: string; label: string }) => <a href={href}>{label}</a>,
}));

vi.mock("./MarketplaceHeroPromo", () => ({
  MarketplaceHeroPromo: () => null,
}));

const product = (id: string, title: string) => ({
  productId: id,
  title,
  coverImage: "/images/fallback-product.svg",
  minPrice: 1_000,
  maxPrice: 1_000,
  currency: "THB",
  rating: 4.8,
  soldCount: 12,
  stock: 5,
  shop: { id: "shop-1", name: "Test Shop", slug: "test-shop", location: "Bangkok" },
});

const home = {
  sections: {
    banners: [],
    categories: [],
    flashSale: null,
    recommendedProducts: [product("product-priority", "Priority product"), product("product-lazy", "Lazy product")],
    newArrivals: [],
    featuredShops: [],
    recentlyViewed: [],
    promotions: [],
  },
} as unknown as DiscoveryHomeResponse;

describe("MarketplaceGuestHome performance", () => {
  it("eagerly fetches only the first above-the-fold recommendation", () => {
    render(<MarketplaceGuestHome initialHome={home} locale="th" />);

    const priorityImage = screen.getByRole("img", { name: "Priority product" });
    const lazyImage = screen.getByRole("img", { name: "Lazy product" });

    expect(priorityImage.getAttribute("loading")).toBe("eager");
    expect(priorityImage.getAttribute("fetchpriority")).toBe("high");
    expect(lazyImage.getAttribute("loading")).not.toBe("eager");
    expect(lazyImage.getAttribute("fetchpriority")).not.toBe("high");
  });
});
