"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { PaginationState } from "@tanstack/react-table";

export function useDebouncedSearch(search: string, setPagination: Dispatch<SetStateAction<PaginationState>>) {
  const [debounced, setDebounced] = useState(search.trim());
  const normalized = search.trim();
  useEffect(() => {
    if (normalized === debounced) return;
    const timer = setTimeout(() => {
      setDebounced(normalized);
      setPagination((page) => ({ ...page, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [normalized, debounced, setPagination]);
  return debounced;
}
