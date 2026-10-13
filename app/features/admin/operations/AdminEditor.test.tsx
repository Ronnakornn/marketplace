/** @vitest-environment jsdom */
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor, Field, OperationConfirmation } from "./shared";

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
}));
afterEach(cleanup);

describe("operation editor", () => {
  it("shows the list action before mounting the create form", () => {
    render(
      <Editor title="createProvider" onSubmit={vi.fn()}>
        <Field label="name" value="" onChange={vi.fn()} required />
      </Editor>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("admin.operations.fields.name")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "admin.operations.createProvider" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "admin.operations.createProvider",
    });
    expect(
      within(dialog)
        .getByLabelText("admin.operations.fields.name")
        .hasAttribute("required"),
    ).toBe(true);
  });

  it("keeps native required validation and closes only after the owner reports success", () => {
    const submit = vi.fn();
    let finishSave = () => {};
    function Harness() {
      const [open, setOpen] = useState(true);
      const [name, setName] = useState("");
      finishSave = () => setOpen(false);
      return (
        <Editor
          title="editProvider"
          open={open}
          onOpenChange={setOpen}
          onSubmit={submit}
        >
          <Field label="name" value={name} onChange={setName} required />
        </Editor>
      );
    }
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "admin.operations.save" }),
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("admin.operations.fields.name"), {
      target: { value: "Carrier name" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "admin.operations.save" }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: "admin.operations.editProvider" }),
    ).toBeTruthy();
    act(finishSave);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens an edit selection immediately and shows errors in its dialog", () => {
    const view = render(
      <Editor
        title="editProvider"
        open={false}
        error={{ status: 409 }}
        onSubmit={vi.fn()}
      >
        Existing provider
      </Editor>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(
      <Editor
        title="editProvider"
        open
        error={{ status: 409 }}
        onSubmit={vi.fn()}
      >
        Existing provider
      </Editor>,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "admin.operations.conflict",
    );
    expect(within(dialog).getByText("Existing provider")).toBeTruthy();
  });

  it("blocks dismissal and duplicate submission while saving", () => {
    const cancel = vi.fn();
    const submit = vi.fn();
    const changeOpen = vi.fn();
    render(
      <Editor
        title="editProvider"
        open
        busy
        onCancel={cancel}
        onOpenChange={changeOpen}
        onSubmit={submit}
      >
        <Field label="name" value="Carrier" onChange={vi.fn()} />
      </Editor>,
    );
    const dialog = screen.getByRole("dialog");
    for (const button of within(dialog).getAllByRole("button", {
      name: "admin.operations.cancel",
    })) {
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
    }
    fireEvent.keyDown(dialog, { key: "Escape" });
    const form = within(dialog)
      .getByRole("button", { name: "admin.operations.saving" })
      .closest("form");
    if (!form) throw new Error("Editor form missing");
    fireEvent.submit(form);
    expect(submit).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(changeOpen).not.toHaveBeenCalled();
  });

  it("locks repeated submissions until an async save settles and keeps a failed draft open", async () => {
    let rejectSave: (error: unknown) => void = () => {};
    const request = new Promise<void>((_, reject) => {
      rejectSave = reject;
    });
    const submit = vi.fn(() => request);
    render(
      <Editor title="editProvider" open onSubmit={submit}>
        Saved draft
      </Editor>,
    );
    const form = screen
      .getByRole("button", { name: "admin.operations.save" })
      .closest("form");
    if (!form) throw new Error("Editor form missing");
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("button", { name: "admin.operations.saving" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await act(async () => {
      rejectSave({ status: 403 });
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "admin.operations.forbidden",
    );
    expect(
      within(dialog)
        .getByRole("button", { name: "admin.operations.save" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("cancels an uncontrolled editor without invoking the save operation", () => {
    const cancel = vi.fn();
    const submit = vi.fn();
    render(
      <Editor title="createRate" onCancel={cancel} onSubmit={submit}>
        Rate fields
      </Editor>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "admin.operations.createRate" }),
    );
    const cancelButton = within(screen.getByRole("dialog"))
      .getAllByRole("button", { name: "admin.operations.cancel" })
      .at(-1);
    if (!cancelButton) throw new Error("Cancel button missing");
    fireEvent.click(cancelButton);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("operation confirmation", () => {
  it("collects a reason for the visible target and preserves the dialog on failure", () => {
    const confirm = vi.fn();
    function Harness() {
      const [reason, setReason] = useState("");
      return (
        <OperationConfirmation
          open
          onOpenChange={vi.fn()}
          title="delete"
          target="Carrier A"
          reason={reason}
          onReasonChange={setReason}
          onConfirm={confirm}
          error={{ status: 409 }}
          destructive
        />
      );
    }
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    const button = within(dialog).getByRole("button", {
      name: "admin.operations.delete",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByText("Carrier A")).toBeTruthy();
    fireEvent.change(
      within(dialog).getByLabelText("admin.operations.fields.reason"),
      { target: { value: "Retired carrier contract" } },
    );
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "admin.operations.conflict",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
