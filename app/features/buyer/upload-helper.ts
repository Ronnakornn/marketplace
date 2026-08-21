"use client";

import { requestApi } from "#/lib/api-client";

interface PresignedUploadResponse {
  fileId: string;
  uploadUrl: string;
}

interface CompletedUploadResponse {
  id: string;
  status: "completed" | "pending";
}

export async function uploadBuyerImage(file: File, uploadErrorMessage: string): Promise<CompletedUploadResponse> {
  const presigned = await requestApi<PresignedUploadResponse>("/api/uploads/presigned-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      usage: "review_image",
    }),
  });
  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error(uploadErrorMessage);

  return requestApi<CompletedUploadResponse>("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileId: presigned.fileId }),
  });
}
