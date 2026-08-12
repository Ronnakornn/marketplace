"use client";

import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const apiClient = axios.create({
  baseURL: "/",
  withCredentials: true,
  headers: { Accept: "application/json" },
  adapter: browserFetchAdapter,
});

apiClient.interceptors.request.use((config) => {
  config.withCredentials = true;
  config.headers = AxiosHeaders.from(config.headers);
  config.headers.set("X-Requested-With", "XMLHttpRequest");
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalizeApiError(error)),
);

export async function requestApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const config: AxiosRequestConfig = {
    url: path,
    method: init.method ?? "GET",
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    signal: init.signal ?? undefined,
    data: normalizeRequestBody(init.body),
  };
  const response = await apiClient.request<T>(config);
  return response.data;
}

function normalizeRequestBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

async function browserFetchAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const method = (config.method ?? "get").toUpperCase();
  const response = await fetch(config.url ?? "", {
    ...(method === "GET" ? {} : { method }),
    headers: AxiosHeaders.from(config.headers).toJSON() as Record<string, string>,
    credentials: config.withCredentials ? "include" : "same-origin",
    signal: typeof AbortSignal !== "undefined" && config.signal instanceof AbortSignal ? config.signal : undefined,
    ...(method === "GET" || method === "HEAD" ? {} : { body: config.data as BodyInit | null | undefined }),
  });
  const text = await response.text();
  const data = parseResponseBody(text);
  const axiosResponse: AxiosResponse = {
    config: config as InternalAxiosRequestConfig,
    data,
    headers: Object.fromEntries(response.headers?.entries?.() ?? []),
    status: response.status ?? (response.ok ? 200 : 500),
    statusText: response.statusText ?? "",
  };
  if (!response.ok) {
    throw new AxiosError("Request failed", "ERR_BAD_RESPONSE", config as InternalAxiosRequestConfig, undefined, axiosResponse);
  }
  return axiosResponse;
}

function parseResponseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function normalizeApiError(error: AxiosError): ApiClientError {
  const payload = toRecord(error.response?.data);
  const nestedError = toRecord(payload.error);
  const missing = toRecord(nestedError.details).missing;
  const detailText = Array.isArray(missing) && missing.length ? ` Missing: ${missing.join(", ")}.` : "";
  const message = `${readString(nestedError.message, readString(payload.message, error.message || "Request failed"))}${detailText}`;
  return new ApiClientError(
    message,
    error.response?.status,
    readString(nestedError.code, readString(payload.code)) || undefined,
    nestedError.details ?? payload.details,
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
