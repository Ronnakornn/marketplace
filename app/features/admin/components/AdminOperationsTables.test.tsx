/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "#/i18n/client";
import enMessages from "../../../../messages/en.json";
import { AdminUsersTable } from "./AdminOperationsTables";

const transport = vi.hoisted(() => ({ usersGet: vi.fn() }));
vi.mock("#/lib/eden", () => ({ api: { api: { admin: { users: { get: transport.usersGet } } } } }));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminUsersTable server pagination", () => {
  it("loads the second API page and displays its ten rows without slicing them again", async () => {
    const users = Array.from({ length: 20 }, (_, index) => ({
      id: `user-${index + 1}`,
      name: `Buyer ${String(index + 1).padStart(2, "0")}`,
      email: `buyer${index + 1}@example.com`,
      role: "USER",
      status: "ACTIVE",
      createdAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z",
    }));
    transport.usersGet.mockImplementation(
      async ({ query }: { query: { page: number; limit: number } }) => ({
        data: {
          items: users.slice((query.page - 1) * query.limit, query.page * query.limit),
          pagination: { page: query.page, limit: query.limit, total: 20, totalPages: 2 },
        },
        error: null,
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}>
          <AdminUsersTable />
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("link", { name: "Buyer 01" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Buyer 11" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("link", { name: "Buyer 11" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buyer 20" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Buyer 01" })).toBeNull();
    expect(screen.getAllByRole("link", { name: /^Buyer \d{2}$/ })).toHaveLength(10);
    await waitFor(() =>
      expect(transport.usersGet).toHaveBeenCalledWith({ query: { page: 2, limit: 10 } }),
    );
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Sort by User" })).toBeNull();
    client.clear();
  });

  it("resets selected role, status, current-page search and pagination together", async () => {
    const users = Array.from({ length: 40 }, (_, index) => ({
      id: `user-${index + 1}`,
      name: `Buyer ${String(index + 1).padStart(2, "0")}`,
      email: `buyer${index + 1}@example.com`,
      role: index < 20 ? "USER" : "ADMIN",
      status: index < 20 ? "ACTIVE" : "SUSPENDED",
      createdAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z",
    }));
    transport.usersGet.mockImplementation(
      async ({
        query,
      }: {
        query: { page: number; limit: number; role?: string; status?: string };
      }) => {
        const filtered = users.filter(
          (user) =>
            (!query.role || user.role === query.role) &&
            (!query.status || user.status === query.status),
        );
        return {
          data: {
            items: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
            pagination: {
              page: query.page,
              limit: query.limit,
              total: filtered.length,
              totalPages: Math.ceil(filtered.length / query.limit),
            },
          },
          error: null,
        };
      },
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}>
          <AdminUsersTable />
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect((await screen.findByRole("link", { name: "Buyer 01" })).textContent).toBe("Buyer 01");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect((await screen.findByRole("link", { name: "Buyer 11" })).textContent).toBe("Buyer 11");

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Role" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Administrator" }));
    expect((await screen.findByRole("link", { name: "Buyer 21" })).textContent).toBe("Buyer 21");
    expect(screen.getByText("Role: Administrator").textContent).toBe("Role: Administrator");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Status" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Suspended" }));
    await waitFor(() =>
      expect(screen.getByText("Status: Suspended").textContent).toBe("Status: Suspended"),
    );
    expect((await screen.findByRole("link", { name: "Buyer 21" })).textContent).toBe("Buyer 21");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect((await screen.findByRole("link", { name: "Buyer 31" })).textContent).toBe("Buyer 31");
    fireEvent.change(screen.getByRole("textbox", { name: "Search this page" }), {
      target: { value: "Buyer 40" },
    });
    expect(
      screen.getAllByRole("link", { name: /^Buyer \d{2}$/ }).map((link) => link.textContent),
    ).toEqual(["Buyer 40"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect((await screen.findByRole("link", { name: "Buyer 01" })).textContent).toBe("Buyer 01");
    expect(screen.getByRole("textbox", { name: "Search this page" })).toHaveProperty("value", "");
    expect(screen.getByRole("combobox", { name: "Role" }).textContent).toBe("All roles");
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("All statuses");
    expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
    expect(
      screen.getAllByRole("link", { name: /^Buyer \d{2}$/ }).map((link) => link.textContent),
    ).toEqual([
      "Buyer 01",
      "Buyer 02",
      "Buyer 03",
      "Buyer 04",
      "Buyer 05",
      "Buyer 06",
      "Buyer 07",
      "Buyer 08",
      "Buyer 09",
      "Buyer 10",
    ]);
    client.clear();
  });
});
