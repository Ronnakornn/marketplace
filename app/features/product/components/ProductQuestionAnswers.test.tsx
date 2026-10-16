/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductQuestionAnswers } from "./ProductQuestionAnswers";
import type { BuyerProductQuestion } from "../queries";
const transport = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../queries", () => ({ fetchProductQuestionAnswers: transport.fetch }));
vi.mock("#/i18n/client", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const answer = (id: string) => ({ id, answer: `Answer ${id}`, status: "PUBLISHED", createdAt: "2026-01-02T00:00:00.000Z", user: { id: "seller", name: "Shop owner" } });
const question = { id: "q1", productId: "p1", shopId: "s1", question: "Question", status: "PUBLISHED", createdAt: "2026-01-01", user: { id: "buyer", name: "Buyer" }, answerCount: 3, answersCursor: "cursor1", answers: [answer("a1")] } satisfies BuyerProductQuestion;
function mount(input = question) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ProductQuestionAnswers question={input} /></QueryClientProvider>);
}
describe("answer continuation", () => {
  it("keeps preview and every loaded answer, retries failures and stops at the last page", async () => {
    transport.fetch.mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce({ items: [answer("a2")], nextCursor: "cursor2" }).mockResolvedValueOnce({ items: [answer("a3")], nextCursor: null });
    mount();
    expect(screen.getByText("Answer a1")).toBeTruthy();
    expect(transport.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "product.loadMoreAnswers" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "product.loadMoreAnswers" }));
    expect(await screen.findByText("Answer a2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "product.loadMoreAnswers" }));
    expect(await screen.findByText("Answer a3")).toBeTruthy();
    expect(screen.getByText("Answer a1")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(transport.fetch.mock.calls).toEqual([["q1", "cursor1"], ["q1", "cursor1"], ["q1", "cursor2"]]);
  });
  it("resets continuation and stale loaded answers when the server preview changes", async () => {
    transport.fetch.mockResolvedValueOnce({ items: [answer("a2")], nextCursor: null });
    const view = mount();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Answer a2")).toBeTruthy();
    const client = new QueryClient();
    view.rerender(<QueryClientProvider client={client}><ProductQuestionAnswers question={{ ...question, answers: [answer("new")], answersCursor: "new-cursor" }} /></QueryClientProvider>);
    expect(screen.queryByText("Answer a2")).toBeNull();
    expect(screen.getByText("Answer new")).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
  });
});
