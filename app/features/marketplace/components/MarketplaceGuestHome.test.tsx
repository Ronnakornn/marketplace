/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const product = (id: string, title: string, coverImage: string | null = "/uploads/product_image/test/main.avif") => ({
  productId: id,
  title,
  coverImage,
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

afterEach(cleanup);

describe("MarketplaceGuestHome performance", () => {
  it("shows login without signup or a duplicate marketplace title in the guest header", () => {
    const { container } = render(<MarketplaceGuestHome initialHome={home} locale="th" />);
    const header = container.querySelector("header");

    expect(header?.querySelector('a[href="/th/login"]')).not.toBeNull();
    expect(header?.querySelector('a[href="/th/signup"]')).toBeNull();
    expect(header?.querySelector("p")).toBeNull();
    expect(header?.querySelector('a[hreflang="en"]')).not.toBeNull();
  });

  it("eagerly fetches only the first above-the-fold recommendation", () => {
    render(<MarketplaceGuestHome initialHome={home} locale="th" />);

    const priorityImage = screen.getByRole("img", { name: "Priority product" });
    const lazyImage = screen.getByRole("img", { name: "Lazy product" });

    expect(priorityImage.getAttribute("loading")).toBe("eager");
    expect(priorityImage.getAttribute("fetchpriority")).toBe("high");
    expect(lazyImage.getAttribute("loading")).not.toBe("eager");
    expect(lazyImage.getAttribute("fetchpriority")).not.toBe("high");
  });

  it("renders an inline placeholder instead of downloading a fallback image", () => {
    const homeWithoutImages = {
      ...home,
      sections: {
        ...home.sections,
        recommendedProducts: [product("product-without-image", "Product without image", null)],
      },
    } as unknown as DiscoveryHomeResponse;

    render(<MarketplaceGuestHome initialHome={homeWithoutImages} locale="th" />);

    expect(screen.queryByRole("img", { name: "Product without image" })).toBeNull();
  });
});
