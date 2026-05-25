/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSellerFile } from "./upload-helper";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("uploadSellerFile", () => {
  it("requests a presigned URL, uploads the file, and completes the upload", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image"], "shirt.png", { type: "image/png" });
    const completed = {
      id: "upload-1",
      userId: "seller-1",
      usage: "product_image",
      status: "completed",
      fileName: "shirt.avif",
      contentType: "image/avif",
      fileSize: file.size,
      key: "uploads/product_image/seller-1/shirt.avif",
      publicUrl: "/uploads/product_image/seller-1/shirt.avif",
    };

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ fileId: "upload-1", uploadUrl: "/api/uploads/local-put?signed=1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(completed));

    await expect(uploadSellerFile({ file, usage: "product_image" })).resolves.toEqual(completed);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/uploads/presigned-url", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        fileName: "shirt.png",
        contentType: "image/png",
        fileSize: file.size,
        usage: "product_image",
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/uploads/local-put?signed=1", {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: file,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/uploads/complete", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ fileId: "upload-1" }),
    }));
  });

  it("surfaces upload errors without completing the upload", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["video"], "demo.webm", { type: "video/webm" });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ fileId: "upload-2", uploadUrl: "/api/uploads/local-put?signed=2" }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Local upload failed" } }, 400));

    await expect(uploadSellerFile({ file, usage: "product_video" })).rejects.toThrow("Local upload failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
