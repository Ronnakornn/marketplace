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

function ScopedLabels() {
  const t = useTranslations();
  return <div>{t("common.cancel")}|{t("seller.dashboard")}|{t("admin.privateLabel")}</div>;
}

it("mounts and unmounts role messages during navigation while retaining public fallback", () => {
  const shared = { common: { cancel: "ยกเลิก" }, seller: { dashboard: "ร้านค้า" } };
  const fallback = { common: { cancel: "Cancel" }, seller: { dashboard: "Seller" } };
  const view = (scope: "public" | "seller" | "admin") => (
    <I18nProvider locale="th" messages={shared} fallbackMessages={fallback}>
      {scope === "public" ? <ScopedLabels /> : (
        <I18nProvider locale="th" messages={scope === "admin" ? { admin: { privateLabel: "ผู้ดูแล" } } : { seller: { dashboard: "แดชบอร์ดร้านค้า" } }}>
          <ScopedLabels />
        </I18nProvider>
      )}
    </I18nProvider>
  );
  const { rerender } = render(view("public"));
  expect(screen.getByText("ยกเลิก|ร้านค้า|admin.privateLabel")).toBeTruthy();
  rerender(view("seller"));
  expect(screen.getByText("ยกเลิก|แดชบอร์ดร้านค้า|admin.privateLabel")).toBeTruthy();
  rerender(view("admin"));
  expect(screen.getByText("ยกเลิก|ร้านค้า|ผู้ดูแล")).toBeTruthy();
  rerender(view("public"));
  expect(screen.getByText("ยกเลิก|ร้านค้า|admin.privateLabel")).toBeTruthy();
});

it("does not inherit messages from another locale", () => {
  render(
    <I18nProvider locale="th" messages={{ common: { cancel: "ยกเลิก" } }}>
      <I18nProvider locale="en" messages={{}} fallbackMessages={{ common: { cancel: "Cancel" } }}>
        <TranslatedAction />
      </I18nProvider>
    </I18nProvider>,
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
});

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
