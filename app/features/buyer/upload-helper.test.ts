// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadBuyerImage } from "./upload-helper";

const mocks = vi.hoisted(() => ({
  requestApi: vi.fn(),
}));

vi.mock("#/lib/api-client", () => ({
  requestApi: mocks.requestApi,
}));

describe("uploadBuyerImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    mocks.requestApi
      .mockResolvedValueOnce({ fileId: "upload-1", uploadUrl: "/api/uploads/upload-1/content" })
      .mockResolvedValueOnce({ id: "upload-1", status: "completed" });
  });

  it("presigns, uploads, and completes a buyer image", async () => {
    const file = new File(["image"], "evidence.webp", { type: "image/webp" });

    await expect(uploadBuyerImage(file, "Upload failed")).resolves.toEqual({
      id: "upload-1",
      status: "completed",
    });

    expect(mocks.requestApi).toHaveBeenNthCalledWith(1, "/api/uploads/presigned-url", expect.objectContaining({
      method: "POST",
    }));
    expect(fetch).toHaveBeenCalledWith("/api/uploads/upload-1/content", {
      method: "PUT",
      headers: { "content-type": "image/webp" },
      body: file,
    });
    expect(mocks.requestApi).toHaveBeenNthCalledWith(2, "/api/uploads/complete", expect.objectContaining({
      method: "POST",
    }));
  });

  it("uses the translated error and does not complete a failed upload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
    const file = new File(["image"], "evidence.png", { type: "image/png" });

    await expect(uploadBuyerImage(file, "อัปโหลดรูปไม่สำเร็จ")).rejects.toThrow("อัปโหลดรูปไม่สำเร็จ");
    expect(mocks.requestApi).toHaveBeenCalledTimes(1);
  });
});
