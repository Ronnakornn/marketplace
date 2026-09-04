import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "#/lib/api-client";
import { createAppQueryClient, shouldRefetchQueryOnWindowFocus } from "#/lib/query-client";

describe("createAppQueryClient retry policy", () => {
  it("does not retry a permanent 404 response", async () => {
    const client = createAppQueryClient();
    const queryFn = vi.fn().mockRejectedValue(new ApiClientError("Order not found", 404));

    await expect(
      client.fetchQuery({ queryKey: ["missing-order"], queryFn, retryDelay: 0 }),
    ).rejects.toThrow("Order not found");

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient server error once", async () => {
    const client = createAppQueryClient();
    const queryFn = vi.fn().mockRejectedValue(new ApiClientError("Unavailable", 503));

    await expect(
      client.fetchQuery({ queryKey: ["unavailable-order"], queryFn, retryDelay: 0 }),
    ).rejects.toThrow("Unavailable");

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("does not refetch a permanent API error when the window regains focus", () => {
    expect(
      shouldRefetchQueryOnWindowFocus({ state: { error: new ApiClientError("Order not found", 404) } } as never),
    ).toBe(false);
    expect(
      shouldRefetchQueryOnWindowFocus({ state: { error: new ApiClientError("Unavailable", 503) } } as never),
    ).toBe(true);
    expect(shouldRefetchQueryOnWindowFocus({ state: { error: null } } as never)).toBe(true);
  });
});
