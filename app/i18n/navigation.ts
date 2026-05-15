"use client";

import { useLocale } from "./client";
import { withLocale } from "./config";

export function useLocalePath() {
  const locale = useLocale();
  return (pathname: string) => withLocale(pathname, locale);
}
