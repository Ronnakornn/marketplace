/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteStatusesProvider, favoriteQueryKeys, updateFavoriteCaches, useFavoriteStatus } from "./favorites";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "buyer-1", role: "USER" } } as { user: { id: string; role: string } } | null,
  batch: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === "product-1"]))),
  detail: vi.fn(async () => false),
}));
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: mocks.session }) }));
vi.mock("#/features/buyer/api", () => ({ fetchFavoriteStatuses: mocks.batch, fetchFavoriteStatus: mocks.detail }));

function Status({ id }: { id: string }) {
  const userId = mocks.session?.user.id ?? "";
  const result = useFavoriteStatus(id, userId, mocks.session?.user.role === "USER");
  return <span data-testid={id}>{result.data === undefined ? "unknown" : result.data ? "saved" : "unsaved"}</span>;
}

function tree(client: QueryClient, ids: string[]) {
  return <QueryClientProvider client={client}><FavoriteStatusesProvider productIds={ids}>
    {ids.map((id) => <Status key={id} id={id} />)}
  </FavoriteStatusesProvider></QueryClientProvider>;
}

beforeEach(() => {
  mocks.session = { user: { id: "buyer-1", role: "USER" } };
  mocks.batch.mockReset().mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === "product-1"])));
  mocks.detail.mockClear();
});
afterEach(cleanup);

describe("favorite status batches", () => {
  it("releases observers for disjoint filtered results", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(tree(client, ["result-0"]));
    for (let index = 0; index < 8; index++) {
      view.rerender(tree(client, [`result-${index}`]));
      await waitFor(() => expect(screen.getByTestId(`result-${index}`).textContent).toBe("unsaved"));
      const observed = client.getQueryCache().findAll({ queryKey: favoriteQueryKeys.batches("buyer-1") }).filter((query) => query.getObserversCount() > 0);
      expect(observed).toHaveLength(1);
    }
  });

  it("requests only new IDs across ten appended pages", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ids = Array.from({ length: 400 }, (_, index) => `product-${(index * 137) % 400}`);
    const view = render(tree(client, ids.slice(0, 40)));
    for (let count = 40; count <= 400; count += 40) {
      view.rerender(tree(client, ids.slice(0, count)));
      await waitFor(() => expect(screen.getByTestId(ids[count - 1]!).textContent).not.toBe("unknown"));
    }
    const submitted = mocks.batch.mock.calls.flatMap(([ids]) => ids);
    expect(submitted).toHaveLength(400);
    expect(new Set(submitted).size).toBe(400);
    expect(mocks.batch.mock.calls).toHaveLength(10);
    expect(mocks.batch.mock.calls.every(([ids]) => ids.length <= 100)).toBe(true);
  });

  it("reads standalone cards without a provider and safely handles an unavailable buyer ID", async () => {
    function Standalone({ missingId }: { missingId: boolean }) {
      const result = useFavoriteStatus("product-1", missingId ? undefined! : "buyer-1", true);
      return <span>{result.data === undefined ? "unknown" : result.data ? "saved" : "unsaved"}</span>;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><Standalone missingId /></QueryClientProvider>);
    expect(screen.getByText("unknown").textContent).toBe("unknown");
    expect(mocks.detail).not.toHaveBeenCalled();
    view.rerender(<QueryClientProvider client={client}><Standalone missingId={false} /></QueryClientProvider>);
    expect((await screen.findByText("unsaved")).textContent).toBe("unsaved");
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith("product-1");
  });

  it("loads forty visible cards in one request with no per-card status requests", async () => {
    const ids = Array.from({ length: 40 }, (_, index) => `product-${index}`);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(tree(client, ids));
    await waitFor(() => expect(screen.getByTestId("product-1").textContent).toBe("saved"));
    expect(screen.getByTestId("product-39").textContent).toBe("unsaved");
    expect(mocks.batch).toHaveBeenCalledTimes(1);
    expect(mocks.batch.mock.calls[0]?.[0]).toHaveLength(40);
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("splits large visible groups into batches of at most one hundred", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ids = Array.from({ length: 101 }, (_, index) => `product-${index}`);
    render(tree(client, ids));
    await waitFor(() => expect(screen.getByTestId("product-100").textContent).toBe("unsaved"));
    expect(mocks.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 1]);
  });

  it("does not reveal the previous buyer's cached statuses while the next buyer loads", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(tree(client, ["product-1"]));
    await waitFor(() => expect(screen.getByTestId("product-1").textContent).toBe("saved"));
    let resolve!: (value: Record<string, boolean>) => void;
    mocks.batch.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    mocks.session = { user: { id: "buyer-2", role: "USER" } };
    view.rerender(tree(client, ["product-1"]));
    expect(screen.getByTestId("product-1").textContent).toBe("unknown");
    await act(async () => { resolve({ "product-1": false }); });
    await waitFor(() => expect(screen.getByTestId("product-1").textContent).toBe("unsaved"));
    expect(client.getQueryData(favoriteQueryKeys.batch("buyer-1", ["product-1"]))).toEqual({ "product-1": true });
  });

  it.each([null, { user: { id: "seller-1", role: "SELLER" } }])("skips favorite reads for guests and sellers", async (session) => {
    mocks.session = session;
    render(tree(new QueryClient(), ["product-1"]));
    expect(screen.getByTestId("product-1").textContent).toBe("unknown");
    await act(async () => {});
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("updates all of this buyer's requested batch and detail states after a mutation", async () => {
    const client = new QueryClient();
    client.setQueryData(favoriteQueryKeys.batch("buyer-1", ["product-1", "product-2"]), { "product-1": false, "product-2": true });
    client.setQueryData(favoriteQueryKeys.detail("buyer-1", "product-1"), false);
    client.setQueryData(favoriteQueryKeys.batch("buyer-2", ["product-1"]), { "product-1": false });
    await updateFavoriteCaches(client, "buyer-1", "product-1", true);
    expect(client.getQueryData(favoriteQueryKeys.batch("buyer-1", ["product-1", "product-2"]))).toEqual({ "product-1": true, "product-2": true });
    expect(client.getQueryData(favoriteQueryKeys.detail("buyer-1", "product-1"))).toBe(true);
    expect(client.getQueryData(favoriteQueryKeys.batch("buyer-2", ["product-1"]))).toEqual({ "product-1": false });
  });

  it("cancels an earlier read so a late response cannot replace the successful mutation", async () => {
    const client = new QueryClient();
    const key = favoriteQueryKeys.batch("buyer-1", ["product-1"]);
    client.setQueryData(key, { "product-1": false });
    let resolve!: (value: Record<string, boolean>) => void;
    const previous = client.fetchQuery({ queryKey: key, queryFn: () => new Promise<Record<string, boolean>>((done) => { resolve = done; }) });
    void previous.catch(() => undefined);
    await updateFavoriteCaches(client, "buyer-1", "product-1", true);
    resolve({ "product-1": false });
    await Promise.resolve();
    expect(client.getQueryData(key)).toEqual({ "product-1": true });
  });
});
