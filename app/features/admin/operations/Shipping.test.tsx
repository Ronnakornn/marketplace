/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShippingProviderPicker } from "./Shipping";

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
}));
afterEach(cleanup);
const providers = [
  { id: "carrier-a", name: "Parcel Express", code: "EXPRESS" },
  { id: "carrier-b", name: "Regional Delivery", code: "REGIONAL" },
];

describe("shipping provider picker", () => {
  it("finds a carrier by name or code and sends its stored id", () => {
    const change = vi.fn();
    render(
      <ShippingProviderPicker
        providers={providers}
        value=""
        onChange={change}
      />,
    );
    fireEvent.change(
      screen.getByLabelText("admin.operations.shipping.searchProviders"),
      { target: { value: "regional" } },
    );
    expect(
      screen.queryByRole("option", { name: "Parcel Express · EXPRESS" }),
    ).toBeNull();
    expect(
      screen.getByRole("option", { name: "Regional Delivery · REGIONAL" }),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("admin.operations.shipping.provider"),
      { target: { value: "carrier-b" } },
    );
    expect(change).toHaveBeenCalledWith("carrier-b");
  });

  it("retains a selected carrier name when it is absent from the current provider page", () => {
    render(
      <ShippingProviderPicker
        providers={providers}
        value="carrier-outside"
        selected={{ id: "carrier-outside", name: "Saved Carrier" }}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(
      "admin.operations.shipping.provider",
    );
    expect(select.value).toBe("carrier-outside");
    expect(screen.getByRole("option", { name: "Saved Carrier" })).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("admin.operations.shipping.searchProviders"),
      { target: { value: "unknown" } },
    );
    expect(select.value).toBe("carrier-outside");
    expect(screen.getByRole("option", { name: "Saved Carrier" })).toBeTruthy();
  });

  it("does not clear a chosen carrier while narrowing the search", () => {
    function Harness() {
      const [value, setValue] = useState("carrier-a");
      return (
        <ShippingProviderPicker
          providers={providers}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Harness />);
    fireEvent.change(
      screen.getByLabelText("admin.operations.shipping.searchProviders"),
      { target: { value: "regional" } },
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>(
        "admin.operations.shipping.provider",
      ).value,
    ).toBe("carrier-a");
    expect(
      screen.getByRole("option", { name: "Parcel Express · EXPRESS" }),
    ).toBeTruthy();
  });

  it("requires a carrier before the native form can submit", () => {
    render(
      <form>
        <ShippingProviderPicker
          providers={providers}
          value=""
          onChange={vi.fn()}
        />
      </form>,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(
      "admin.operations.shipping.provider",
    );
    expect(select.checkValidity()).toBe(false);
    expect(select.validity.valueMissing).toBe(true);
  });
});
