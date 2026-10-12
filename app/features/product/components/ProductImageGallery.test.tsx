/** @vitest-environment jsdom */
import { useEffect, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductImageGallery } from "./ProductImageGallery";

interface GalleryApi {
  selectedScrollSnap(): number;
  scrollTo(index: number): void;
  scrollPrev(): void;
  scrollNext(): void;
  on(event: string, callback: (api: GalleryApi) => void): void;
  off(event: string, callback: (api: GalleryApi) => void): void;
}
const mocks = vi.hoisted(() => ({ apis: [] as GalleryApi[] }));

function createApi(): GalleryApi {
  let index = 0;
  const listeners = new Set<(api: GalleryApi) => void>();
  const api: GalleryApi = {
    selectedScrollSnap: () => index,
    scrollTo: (next) => { index = next; listeners.forEach((listener) => listener(api)); },
    scrollPrev: () => api.scrollTo(Math.max(0, index - 1)),
    scrollNext: () => api.scrollTo(index + 1),
    on: (_event, callback) => { listeners.add(callback); },
    off: (_event, callback) => { listeners.delete(callback); },
  };
  mocks.apis.push(api);
  return api;
}

vi.mock("#/components/ui/carousel", () => ({
  Carousel: ({ children, setApi, opts: _opts, ...props }: { children: ReactNode; setApi: (api: GalleryApi) => void; opts: unknown }) => {
    const [api] = useState(createApi);
    useEffect(() => { setApi(api); }, [api, setApi]);
    return <div {...props}>{children}</div>;
  },
  CarouselContent: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  CarouselItem: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));
vi.mock("next/image", () => ({ default: ({ fill: _fill, sizes: _sizes, fetchPriority: _priority, ...props }: { fill?: boolean; sizes?: string; fetchPriority?: string }) => <img {...props} /> }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => ({
  "product.productImage": "{title} image {index}",
  "product.showProductImage": "Show product image {index}",
  "product.productMediaGallery": "Product media gallery",
  "product.showProductVideo": "Show product video",
  "product.productVideo": "{title} video",
  "product.noProductImages": "{title} has no product images",
  "product.noProductImageAvailable": "No product image available",
  "common.close": "Close",
}[key] ?? key) }));

beforeEach(() => { mocks.apis.length = 0; });
afterEach(cleanup);

describe("ProductImageGallery", () => {
  it("shows every thumbnail, follows swipe selection, and opens the selected image without navigation buttons", async () => {
    render(<ProductImageGallery images={Array.from({ length: 10 }, (_, index) => `/bag-${index}.jpg`)} title="Bag" video={null} />);
    expect(screen.getAllByRole("option")).toHaveLength(10);
    const thirdThumbnail = screen.getByRole("option", { name: "Show product image 3" });
    expect(screen.queryByRole("button", { name: /Next|Previous/ })).toBeNull();
    screen.getByRole("button", { name: "Bag image 1" }).focus();
    act(() => { mocks.apis[0]!.scrollTo(8); });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bag image 9" }));
    expect(screen.getByRole("option", { name: "Show product image 9" }).getAttribute("aria-selected")).toBe("true");
    const mainImage = screen.getByRole("button", { name: "Bag image 9" });
    mainImage.focus();
    fireEvent.click(mainImage);
    expect(await screen.findByRole("dialog", { name: "Bag" })).toBeTruthy();
    await waitFor(() => expect(mocks.apis[1]?.selectedScrollSnap()).toBe(8));
    act(() => { mocks.apis[1]!.scrollTo(2); });
    expect(thirdThumbnail.getAttribute("aria-selected")).toBe("true");
    expect(mocks.apis[0]!.selectedScrollSnap()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bag image 3" }));
  });

  it("keeps video controls and restores the image carousel when selecting a thumbnail", async () => {
    render(<ProductImageGallery images={["/bag.jpg"]} title="Bag" video={{ url: "/bag.mp4", contentType: "video/mp4" }} />);
    fireEvent.click(screen.getByRole("option", { name: "Show product video" }));
    const video = screen.getByLabelText("Bag video");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.querySelector("source")?.getAttribute("src")).toBe("/bag.mp4");
    expect(screen.getByRole("option", { name: "Show product video" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "Show product image 1" }));
    expect(screen.getByRole("button", { name: "Bag image 1" })).toBeTruthy();
    expect(screen.queryByLabelText("Bag video")).toBeNull();
  });

  it("shows an accessible empty state when no images or video are available", () => {
    render(<ProductImageGallery images={[]} title="Bag" video={null} />);
    expect(screen.getByRole("img", { name: "Bag has no product images" }).textContent).toBe("No product image available");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
