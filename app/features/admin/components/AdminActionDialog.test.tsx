/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminActionDialog } from "./AdminActionDialog";

vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);

function dialogProps(): Parameters<typeof AdminActionDialog>[0] {
  return {
    action: "Mark payout paid",
    description: "Verify the completed transfer before confirming.",
    target: "Bangkok shop",
    recordId: "payout-42",
    amount: "THB 90,071,992,547,409.91",
    currency: "THB",
    field: { label: "Payment reference", helper: "Use the verified bank reference.", minLength: 1, maxLength: 200 },
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
  };
}

describe("financial action dialog", () => {
  it("shows the exact target, identifier and already formatted amount", () => {
    render(<AdminActionDialog {...dialogProps()} />);
    expect(screen.getByRole("dialog").textContent).toContain("Bangkok shop");
    expect(screen.getByText("payout-42")).toBeTruthy();
    expect(screen.getByText("THB 90,071,992,547,409.91")).toBeTruthy();
    expect(screen.getByText("Use the verified bank reference.")).toBeTruthy();
  });

  it("cancels without writing even when a valid reference was entered", () => {
    const props = dialogProps();
    render(<AdminActionDialog {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Payment reference" }), { target: { value: "BANK-42" } });
    fireEvent.click(screen.getByRole("button", { name: "admin.common.cancel" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("dismisses with Escape without submitting the entered reference", () => {
    const props = dialogProps();
    render(<AdminActionDialog {...props} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "BANK-42" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("blocks blank references and trims the submitted reference", async () => {
    const props = dialogProps();
    render(<AdminActionDialog {...props} />);
    const confirm = screen.getByRole("button", { name: "Mark payout paid" });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  BANK-42  " } });
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.click(confirm);
    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledWith("BANK-42"));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
  });

  it("keeps the dialog and entered value after an API failure and permits retry", async () => {
    const props = dialogProps();
    const confirm = vi.fn().mockRejectedValueOnce({ value: { error: { message: "A different reviewer must complete this payout" } } }).mockResolvedValueOnce(undefined);
    render(<AdminActionDialog {...props} onConfirm={confirm} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "BANK-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark payout paid" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("A different reviewer must complete this payout"));
    expect(screen.getByRole("textbox")).toHaveProperty("value", "BANK-42");
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mark payout paid" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("prevents repeat submits and cancellation while the mutation is unresolved", async () => {
    const props = dialogProps();
    let finish: (() => void) | undefined;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<AdminActionDialog {...props} onConfirm={confirm} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "BANK-42" } });
    const button = screen.getByRole("button", { name: "Mark payout paid" });
    fireEvent.click(button);
    fireEvent.click(button);
    const form = button.closest("form");
    if (!form) throw new Error("Missing action form");
    fireEvent.submit(form);
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "admin.financialAction.confirming" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "admin.common.cancel" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).not.toHaveBeenCalled();
    finish?.();
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
  });

  it("validates a commission reason against its minimum and maximum length", () => {
    const props = dialogProps();
    render(<AdminActionDialog {...props} field={{ label: "Reason", helper: "At least 3 characters", minLength: 3, maxLength: 500, multiline: true }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "ok" } });
    expect(screen.getByRole("button", { name: "Mark payout paid" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Verified order" } });
    expect(screen.getByRole("button", { name: "Mark payout paid" })).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(501) } });
    expect(screen.getByRole("button", { name: "Mark payout paid" })).toHaveProperty("disabled", true);
  });
});
