import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import th from "../../messages/th.json";
import { mergeMessages } from "./messages";
import { getClientMessages } from "./server";

vi.mock("server-only", () => ({}));

describe("client translation scopes", () => {
  it.each(["en", "th"] as const)("keeps public and shared labels in %s without private screens", async (locale) => {
    const messages = await getClientMessages(locale);
    const full = locale === "en" ? en : th;
    expect(messages.common).toEqual(full.common);
    expect(messages.product).toEqual(full.product);
    expect(messages.seller).toEqual({ dashboard: full.seller.dashboard });
    expect(messages.admin).toEqual({ statuses: full.admin.statuses });
    const before = Buffer.byteLength(JSON.stringify({ messages: full, fallbackMessages: en }));
    const after = Buffer.byteLength(JSON.stringify({ messages }));
    expect(after).toBeLessThan(before);
  });

  it.each(["en", "th"] as const)("restores role labels without removing shared messages in %s", async (locale) => {
    const full = locale === "en" ? en : th;
    const shared = await getClientMessages(locale);
    const seller = mergeMessages(shared, await getClientMessages(locale, "seller"));
    const admin = mergeMessages(shared, await getClientMessages(locale, "admin"));
    expect(seller.seller).toEqual(full.seller);
    expect(seller.common).toEqual(full.common);
    expect(admin.admin).toEqual(full.admin);
    expect(admin.common).toEqual(full.common);
    expect(typeof admin.seller).toBe("object");
    if (typeof admin.seller === "object") expect(admin.seller.kyc).toEqual(full.seller.kyc);
  });

  it("resolves missing nested translations without dropping localized siblings", () => {
    const fallback = { common: { cancel: "Cancel", save: "Save" }, state: { empty: "Empty" } };
    const primary = { common: { cancel: "ยกเลิก", save: "" } };
    expect(mergeMessages(fallback, primary)).toEqual({ common: { cancel: "ยกเลิก", save: "" }, state: { empty: "Empty" } });
    expect(fallback.common.cancel).toBe("Cancel");
  });
});
