/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import en from "../../messages/en.json";
import th from "../../messages/th.json";
import { I18nProvider, useTranslations } from "./client";

const originalLanguage = document.documentElement.lang;

afterEach(() => {
  cleanup();
  document.documentElement.lang = originalLanguage;
});

function TranslatedAction() {
  const t = useTranslations();
  return <button>{t("common.cancel")}</button>;
}

it("keeps screen reader language aligned with content after changing locale", () => {
  document.documentElement.lang = "th";
  const { rerender } = render(
    <I18nProvider locale="en" messages={en} fallbackMessages={en}>
      <TranslatedAction />
    </I18nProvider>,
  );

  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");

  rerender(
    <I18nProvider locale="th" messages={th} fallbackMessages={en}>
      <TranslatedAction />
    </I18nProvider>,
  );

  expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeTruthy();
  expect(document.documentElement.lang).toBe("th");
});
