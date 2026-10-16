/** @vitest-environment jsdom */
import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDebouncedSearch } from "./useDebouncedSearch";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("commits only the final trimmed prefix and resets its page in the same render", () => {
  vi.useFakeTimers();
  const observations: Array<{ q: string; page: number }> = [];
  const view = renderHook(({ search }) => {
    const [pagination, setPagination] = useState({ pageIndex: 4, pageSize: 20 });
    const q = useDebouncedSearch(search, setPagination);
    observations.push({ q, page: pagination.pageIndex + 1 });
    return { q, pagination };
  }, { initialProps: { search: "" } });
  for (const search of ["b", "ba", "bat", "batt", "batte", "batter", " battery "]) {
    view.rerender({ search });
    act(() => { vi.advanceTimersByTime(30); });
  }
  expect(view.result.current.q).toBe("");
  act(() => { vi.advanceTimersByTime(300); });
  expect(view.result.current).toEqual({ q: "battery", pagination: { pageIndex: 0, pageSize: 20 } });
  expect(observations.filter(({ q }) => q)).toEqual([{ q: "battery", page: 1 }]);
});
