import { afterEach, describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { ApiClientError, apiClient, requestApi } from "./api-client";

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("apiClient", () => {
  it("applies shared credentials and request headers", async () => {
    let captured: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = (async (config) => {
      captured = config;
      return response(config, { ok: true });
    }) satisfies AxiosAdapter;

    await requestApi("/api/test", { method: "POST", body: JSON.stringify({ value: 1 }) });

    expect(captured?.withCredentials).toBe(true);
    expect(AxiosHeaders.from(captured?.headers).get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(captured?.data).toBe(JSON.stringify({ value: 1 }));
  });

  it("normalizes backend errors in the response interceptor", async () => {
    apiClient.defaults.adapter = (async (config) => {
      const failedResponse = response(config, {
        error: { message: "Validation failed", code: "VALIDATION_ERROR", details: { missing: ["email"] } },
      }, 422);
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, failedResponse);
    }) satisfies AxiosAdapter;

    const error = await requestApi("/api/test").catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      message: "Validation failed Missing: email.",
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});

function response<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status < 400 ? "OK" : "Error",
  };
}
