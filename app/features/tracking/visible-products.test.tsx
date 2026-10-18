// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrackVisibleProducts } from "./tracking";

class VisibilityObserver implements IntersectionObserver {
  static instances: VisibilityObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  readonly elements = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    VisibilityObserver.instances.push(this);
  }
  observe(element: Element) { this.elements.add(element); }
  unobserve(element: Element) { this.elements.delete(element); }
  disconnect() { this.elements.clear(); }
  takeRecords() { return []; }
  emit(visible: boolean, elements = [...this.elements]) {
    this.callback(elements.map((target) => ({
      target,
      time: 0,
      rootBounds: null,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      isIntersecting: visible,
      intersectionRatio: visible ? 1 : 0,
    })), this);
  }
}

function ProductList({ ids, source = "search_results" }: { ids: string[]; source?: string }) {
  const ref = useTrackVisibleProducts(ids.map((id) => ({ id, shop: { id: "shop-1" } })), source);
  return <section ref={ref}>{ids.map((id) => <article data-product-id={id} key={id}>{id}</article>)}</section>;
}

function latestObserver() {
  const observer = VisibilityObserver.instances.at(-1);
  if (!observer) throw new Error("Expected a mounted product observer");
  return observer;
}

beforeEach(() => {
  vi.useFakeTimers();
  VisibilityObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", VisibilityObserver);
  Object.defineProperty(window.navigator, "sendBeacon", { value: undefined, configurable: true });
  vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}"));
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("visible product impressions", () => {
  it("sends 40 visible impressions in one request and does not recount identical IDs on rerender", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `product-${i}`);
    const view = render(<ProductList ids={ids} />);
    act(() => latestObserver().emit(true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(window.fetch).mock.calls[0]?.[1]?.body)).events).toHaveLength(40);

    view.rerender(<ProductList ids={[...ids]} />);
    act(() => latestObserver().emit(true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(VisibilityObserver.instances).toHaveLength(1);
  });

  it("waits until a card intersects the viewport and retains its tracking metadata", () => {
    render(<ProductList ids={["offscreen-product"]} />);
    act(() => latestObserver().emit(false));
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).not.toHaveBeenCalled();

    act(() => latestObserver().emit(true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledOnce();
    const body = vi.mocked(window.fetch).mock.calls[0]?.[1]?.body;
    expect(JSON.parse(String(body)).events[0]).toMatchObject({
      eventType: "product_impression", source: "search_results", productId: "offscreen-product", shopId: "shop-1", position: 0,
    });
  });

  it("observes appended cards without counting existing cards again", () => {
    const view = render(<ProductList ids={["first"]} />);
    act(() => latestObserver().emit(true));
    act(() => vi.advanceTimersByTime(10_000));
    const previous = latestObserver();
    view.rerender(<ProductList ids={["first", "next-page"]} />);
    expect(previous.elements.size).toBe(0);
    act(() => latestObserver().emit(true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(vi.mocked(window.fetch).mock.calls[1]?.[1]?.body)).events[0]).toMatchObject({ productId: "next-page", position: 1 });
  });

  it("keeps source lifetimes independent and flushes pending impressions on unmount", () => {
    const view = render(<ProductList ids={["same-product"]} />);
    act(() => latestObserver().emit(true));
    view.rerender(<ProductList ids={["same-product"]} source="category_listing" />);
    act(() => latestObserver().emit(true));
    const observer = latestObserver();
    view.unmount();
    expect(observer.elements.size).toBe(0);
    expect(vi.mocked(window.fetch).mock.calls.flatMap((call) => JSON.parse(String(call[1]?.body)).events.map((event: { source: string }) => event.source))).toEqual(["search_results", "category_listing"]);
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not observe another mounted list with a different source", () => {
    render(<><ProductList ids={["search-product"]} /><ProductList ids={["shop-product"]} source="storefront" /></>);
    expect(VisibilityObserver.instances.map((observer) => [...observer.elements].map((element) => element.textContent))).toEqual([["search-product"], ["shop-product"]]);
  });

  it("checks actual viewport bounds when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    let top = window.innerHeight + 100;
    const rect = () => new DOMRect(0, top, 100, 100);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(rect);
    const view = render(<ProductList ids={["fallback-product"]} />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).not.toHaveBeenCalled();
    top = 10;
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledOnce();
    expect(screen.getByText("fallback-product")).toBeTruthy();
    view.unmount();
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(10_000));
    expect(window.fetch).toHaveBeenCalledOnce();
  });
});
