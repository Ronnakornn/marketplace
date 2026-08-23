import { describe, expect, it } from "vitest";
import { formatOrderStatus } from "./order-status";

describe("formatOrderStatus", () => {
  it("uses the order status translation namespace", () => {
    const translatedKeys: string[] = [];

    const result = formatOrderStatus("PENDING_PAYMENT", ((key: string) => {
      translatedKeys.push(key);
      return "รอชำระเงิน";
    }) as never);

    expect(result).toBe("รอชำระเงิน");
    expect(translatedKeys).toEqual(["order.statuses.pendingPayment"]);
  });

  it("uses the localized fallback for an unknown status", () => {
    expect(formatOrderStatus("NOT_A_STATUS", ((key: string) => key) as never)).toBe("order.statuses.unknown");
  });
});
