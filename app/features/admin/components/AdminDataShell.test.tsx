/** @vitest-environment jsdom */
import { useState, type ComponentProps, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SearchIcon } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "#/i18n/client";
import enMessages from "../../../../messages/en.json";
import { AdminDataShell } from "./AdminDataShell";

afterEach(cleanup);

function Localized({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}>
      {children}
    </I18nProvider>
  );
}

function FilteredList(props: Partial<ComponentProps<typeof AdminDataShell>>) {
  const [search, setSearch] = useState("Laptop");
  const [status, setStatus] = useState("Active");
  const [page, setPage] = useState(3);
  return (
    <AdminDataShell
      title="Orders"
      description="Review orders"
      icon={SearchIcon}
      search={search}
      searchPlaceholder="Search this page"
      searchHint="Search applies to the records on this page."
      onSearchChange={setSearch}
      activeFilters={[
        {
          id: "status",
          label: "Status",
          value: status,
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
        setPage(1);
      }}
      isLoading={false}
      error={null}
      onRetry={() => {}}
      {...props}
    >
      <p>Records on page {page}</p>
    </AdminDataShell>
  );
}

describe("AdminDataShell list feedback", () => {
  it("clears search, active filters and caller pagination through one reset", () => {
    render(<FilteredList />, { wrapper: Localized });
    expect(screen.getByText("Status: Active").textContent).toBe("Status: Active");
    expect(screen.getByText("Records on page 3").textContent).toBe("Records on page 3");
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByRole("textbox", { name: "Search this page" })).toHaveProperty("value", "");
    expect(screen.queryByText("Status: Active")).toBeNull();
    expect(screen.getByText("Records on page 1").textContent).toBe("Records on page 1");
    expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
  });

  it("can clear the current-page search without discarding the selected status or page", () => {
    render(<FilteredList />, { wrapper: Localized });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("textbox", { name: "Search this page" })).toHaveProperty("value", "");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search this page" }));
    expect(screen.getByText("Status: Active").textContent).toBe("Status: Active");
    expect(screen.getByText("Records on page 3").textContent).toBe("Records on page 3");
    fireEvent.click(screen.getByRole("button", { name: "Remove Status filter" }));
    expect(screen.getByText("Records on page 1").textContent).toBe("Records on page 1");
    expect(screen.queryByText("Status: Active")).toBeNull();
  });

  it("keeps filtering and existing rows available during a refresh", () => {
    render(<FilteredList isFetching />, { wrapper: Localized });
    expect(screen.getByRole("status").textContent).toBe("Refreshing records...");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Records on page 3").textContent).toBe("Records on page 3");
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByText("Records on page 1").textContent).toBe("Records on page 1");
  });

  it("preserves rows with a stale-data warning after a refresh error and allows retry", () => {
    const retry = vi.fn();
    render(<FilteredList hasData error={new Error("Offline")} onRetry={retry} />, {
      wrapper: Localized,
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "The displayed records may be out of date.",
    );
    expect(screen.getByText("Records on page 3").textContent).toBe("Records on page 3");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])("hides stale rows after HTTP %i while retaining the header controls", (status) => {
    render(<FilteredList hasData error={{ status }} />, { wrapper: Localized });
    expect(screen.getByRole("alert").textContent).toContain(
      status === 403 ? enMessages.admin.operations.forbidden : enMessages.state.loadErrorTitle,
    );
    expect(screen.queryByText("Records on page 3")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Search this page" })).toHaveProperty(
      "value",
      "Laptop",
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveProperty("disabled", false);
  });

  it("retains the reset controls while an initial request is loading", () => {
    render(<FilteredList isLoading />, { wrapper: Localized });
    expect(screen.queryByText("Records on page 3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByRole("textbox", { name: "Search this page" })).toHaveProperty("value", "");
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveProperty("disabled", true);
  });
});
