/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatRealtime } from "./realtime";

class FakeSocket extends EventTarget {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];
  readyState = 0;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.dispatchEvent(new Event("close")); });
  constructor(readonly url: string) { super(); FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  message(event: string, channel = "chat:room") { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ event, channel }) })); }
}
let visible = true;
let online = true;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden");
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  visible = true; online = true;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("chat realtime lifecycle", () => {
  it("uses same origin and reports live only after every subscription is confirmed", () => {
    const sync = vi.fn();
    const { result } = renderHook(() => useChatRealtime(["chat:room", "user:buyer:chats"], sync));
    expect(result.current).toBe("connecting");
    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe("ws://localhost:3000/api/realtime");
    act(() => socket.open());
    expect(socket.send.mock.calls.map(([body]) => JSON.parse(body))).toEqual([
      { action: "subscribe", channel: "chat:room" }, { action: "subscribe", channel: "user:buyer:chats" },
    ]);
    act(() => socket.message("realtime.subscribed"));
    expect(result.current).toBe("connecting");
    act(() => socket.message("realtime.subscribed", "user:buyer:chats"));
    expect(result.current).toBe("live");
    const calls = sync.mock.calls.length;
    act(() => socket.message("chat.message.created"));
    expect(sync).toHaveBeenCalledTimes(calls + 1);
  });

  it("reconnects with backoff, catches up on resubscribe and removes every timer on unmount", () => {
    const sync = vi.fn();
    const { result, unmount } = renderHook(() => useChatRealtime(["chat:room"], sync));
    act(() => { FakeSocket.instances[0].open(); FakeSocket.instances[0].message("realtime.subscribed"); });
    act(() => FakeSocket.instances[0].close());
    expect(result.current).toBe("reconnecting");
    act(() => vi.advanceTimersByTime(999));
    expect(FakeSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => { FakeSocket.instances[1].open(); FakeSocket.instances[1].message("realtime.subscribed"); });
    expect(result.current).toBe("live");
    expect(sync.mock.calls.length).toBeGreaterThanOrEqual(5);
    unmount();
    expect(FakeSocket.instances[1].close).toHaveBeenCalled();
    const count = sync.mock.calls.length;
    act(() => vi.advanceTimersByTime(60_000));
    expect(sync).toHaveBeenCalledTimes(count);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("pauses while hidden or offline and catches up on focus and online", () => {
    const sync = vi.fn();
    const { result } = renderHook(() => useChatRealtime(["chat:room"], sync));
    visible = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toBe("offline");
    const count = sync.mock.calls.length;
    act(() => vi.advanceTimersByTime(30_000));
    expect(sync).toHaveBeenCalledTimes(count);
    visible = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeSocket.instances).toHaveLength(2);
    online = false;
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe("offline");
    online = true;
    act(() => window.dispatchEvent(new Event("online")));
    expect(FakeSocket.instances).toHaveLength(3);
    const resumed = sync.mock.calls.length;
    act(() => window.dispatchEvent(new Event("focus")));
    expect(sync).toHaveBeenCalledTimes(resumed + 1);
  });

  it("retries an unconfirmed subscription and polls when realtime is unavailable", () => {
    const sync = vi.fn();
    const { result } = renderHook(() => useChatRealtime(["chat:room"], sync));
    act(() => FakeSocket.instances[0].open());
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe("reconnecting");
    act(() => vi.advanceTimersByTime(5_000));
    expect(FakeSocket.instances.length).toBeGreaterThan(1);
    expect(sync.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
