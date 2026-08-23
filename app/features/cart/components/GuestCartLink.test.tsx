/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestCartLink } from "./GuestCartLink";
import { addGuestCartItem } from "#/features/cart/guest-cart";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a> }));

afterEach(() => window.localStorage.clear());

describe("GuestCartLink", () => {
  it("shows the current guest cart quantity after an item is added", async () => {
    render(<GuestCartLink href="/th/cart" label="Cart" />);

    await act(async () => addGuestCartItem("variant-1", 2));

    expect(screen.getByRole("link", { name: "Cart (2)" }).textContent).toContain("2");
  });
});
