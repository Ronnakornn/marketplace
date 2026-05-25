"use client";

export type SellerUploadUsage = "product_image" | "product_video" | "shop_image" | "kyc_document";

export interface SellerUploadInput {
  file: File;
  usage: SellerUploadUsage;
}

export interface SellerCompletedUpload {
  id: string;
  userId: string;
  usage: SellerUploadUsage;
  status: "completed" | "pending";
  fileName: string;
  contentType: string;
  fileSize: number;
  key: string;
  publicUrl?: string;
  completedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface PresignedUploadResponse {
  fileId: string;
  uploadUrl: string;
  publicUrl?: string;
  key?: string;
  expiresIn?: number;
}

export async function uploadSellerFile({ file, usage }: SellerUploadInput): Promise<SellerCompletedUpload> {
  const presigned = await requestJson<PresignedUploadResponse>("/api/uploads/presigned-url", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      usage,
    }),
  });

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(await readErrorMessage(uploadResponse, "File upload failed"));
  }

  return requestJson<SellerCompletedUpload>("/api/uploads/complete", {
    method: "POST",
    body: JSON.stringify({ fileId: presigned.fileId }),
  });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Request failed"));
  }
  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.clone().json().catch(() => null);
  const details = payload?.error?.details;
  const detailText = details?.missing && Array.isArray(details.missing)
    ? ` Missing: ${details.missing.join(", ")}.`
    : "";
  return `${payload?.error?.message ?? payload?.message ?? fallback}${detailText}`;
}
