/** @vitest-environment jsdom */
import { StrictMode, useState } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const auth = vi.hoisted(() => ({
  identity: "account-a" as string | null,
  sessionId: "session-a",
  isPending: false,
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({
    data: auth.identity ? { user: { id: auth.identity }, session: { id: auth.sessionId } } : null,
    isPending: auth.isPending,
  }),
}));
vi.mock("#/components/ui/sonner", () => ({ Toaster: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

afterEach(cleanup);
beforeEach(() => {
  auth.identity = "account-a";
  auth.sessionId = "session-a";
  auth.isPending = false;
});

describe("Providers account isolation", () => {
  it.each([false, true])("never renders the previous account's profile, address, orders or draft after switching, anonymous step %s", async (anonymousStep) => {
    const clients: QueryClient[] = [];
    const observed: Array<{ identity: string | null; values: Array<string | undefined> }> = [];
    function AccountPage() {
      const client = useQueryClient();
      if (!clients.includes(client)) clients.push(client);
      const profile = useQuery({ queryKey: ["buyer-profile"], queryFn: async () => `${auth.identity}:profile` });
      const address = useQuery({ queryKey: ["buyer-addresses"], queryFn: async () => `${auth.identity}:address` });
      const orders = useQuery({ queryKey: ["buyer-orders"], queryFn: async () => `${auth.identity}:orders` });
      const [draft, setDraft] = useState("");
      observed.push({ identity: auth.identity, values: [profile.data, address.data, orders.data] });
      return <><p>{profile.data}</p><p>{address.data}</p><p>{orders.data}</p><input aria-label="Private draft" value={draft} onChange={(event) => setDraft(event.target.value)} /></>;
    }
    const view = render(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    await screen.findByText("account-a:profile");
    await screen.findByText("account-a:address");
    await screen.findByText("account-a:orders");
    fireEvent.change(screen.getByLabelText("Private draft"), { target: { value: "Account A's private draft" } });

    if (anonymousStep) {
      auth.identity = null;
      view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
      expect(screen.queryByText("account-a:profile")).toBeNull();
      expect(screen.getByLabelText("Private draft")).toHaveProperty("value", "");
    }
    auth.identity = "account-b";
    auth.sessionId = "session-b";
    view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);

    expect(screen.queryByText("account-a:profile")).toBeNull();
    expect(screen.queryByText("account-a:address")).toBeNull();
    expect(screen.queryByText("account-a:orders")).toBeNull();
    expect(screen.getByLabelText("Private draft")).toHaveProperty("value", "");
    await screen.findByText("account-b:profile");
    await screen.findByText("account-b:address");
    await screen.findByText("account-b:orders");
    expect(clients).toHaveLength(anonymousStep ? 3 : 2);
    expect(observed.filter((rendered) => rendered.identity !== "account-a").flatMap((rendered) => rendered.values).some((value) => value?.startsWith("account-a:"))).toBe(false);
  });

  it("keeps an account's cache during a session refresh and replaces it on a new session", async () => {
    const clients: QueryClient[] = [];
    function AccountPage() {
      const client = useQueryClient();
      if (!clients.includes(client)) clients.push(client);
      const profile = useQuery({ queryKey: ["buyer-profile"], queryFn: async () => "Current profile" });
      return <p>{profile.data}</p>;
    }
    const view = render(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    await screen.findByText("Current profile");
    view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    expect(clients).toHaveLength(1);
    auth.sessionId = "replacement-session";
    view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    expect(clients).toHaveLength(2);
  });

  it("prevents a late query response from account A appearing in account B", async () => {
    const requestA = deferred<string>();
    function AccountPage() {
      const identity = auth.identity;
      const address = useQuery({ queryKey: ["buyer-addresses"], queryFn: () => identity === "account-a" ? requestA.promise : Promise.resolve("Account B address") });
      return <p>{address.data}</p>;
    }
    const view = render(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    auth.identity = "account-b";
    auth.sessionId = "session-b";
    view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    await act(async () => { requestA.resolve("Account A address"); await requestA.promise; });
    await screen.findByText("Account B address");
    expect(screen.queryByText("Account A address")).toBeNull();
  });

  it("isolates a late mutation callback and its local state from a new account", async () => {
    const mutationA = deferred<string>();
    const completed = vi.fn();
    function AccountPage() {
      const client = useQueryClient();
      const identity = auth.identity;
      const profile = useQuery({ queryKey: ["buyer-profile"], queryFn: async () => `${identity} profile` });
      const [message, setMessage] = useState("");
      const update = useMutation({
        mutationFn: () => mutationA.promise,
        onSuccess: (profile) => {
          client.setQueryData(["buyer-profile"], profile);
          setMessage("Account A saved");
          completed();
        },
      });
      return <><p>{profile.data}</p><p>{message}</p><button onClick={() => update.mutate()}>Save profile</button></>;
    }
    const view = render(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    await screen.findByText("account-a profile");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    auth.identity = "account-b";
    auth.sessionId = "session-b";
    view.rerender(<StrictMode><Providers><AccountPage /></Providers></StrictMode>);
    await act(async () => { mutationA.resolve("Account A saved profile"); await mutationA.promise; });
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    await screen.findByText("account-b profile");
    expect(screen.queryByText("Account A saved profile")).toBeNull();
    expect(screen.queryByText("Account A saved")).toBeNull();
  });
});
