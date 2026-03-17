import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConfig } from "../src/config.js";
import { HttpError, RMPAPIError, RetryError } from "../src/errors.js";
import { HttpClient } from "../src/http.js";

function mockResponse(
  body: string | object,
  init: { status?: number; ok?: boolean } = {}
): Response {
  const status = init.status ?? 200;
  const isOk = init.ok ?? (status >= 200 && status < 300);
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: isOk,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(bodyStr),
    json: () => Promise.resolve(typeof body === "string" ? JSON.parse(body) : body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpClient.postJson", () => {
  it("returns JSON on 200", async () => {
    const payload = { data: { x: 1 } };
    fetchMock.mockResolvedValueOnce(mockResponse(payload));
    const client = new HttpClient(createConfig({ rate_limit_per_minute: 1000 }));
    const result = await client.postJson("", { query: "..." });
    expect(result).toEqual(payload);
    client.close();
  });

  it("throws RMPAPIError when errors in body", async () => {
    const body = { errors: [{ message: "Unauthorized" }] };
    fetchMock.mockResolvedValueOnce(mockResponse(body));
    const client = new HttpClient(createConfig({ rate_limit_per_minute: 1000 }));
    await expect(client.postJson("", { query: "..." })).rejects.toThrow(RMPAPIError);
    client.close();
  });

  it("throws HttpError on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse("Forbidden", { status: 403 }));
    const client = new HttpClient(createConfig({ rate_limit_per_minute: 1000 }));
    try {
      await client.postJson("", {});
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status_code).toBe(403);
      return;
    }
    expect.fail("should have thrown");
  });

  it("retries on 5xx then throws HttpError", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse("", { status: 502 }))
      .mockResolvedValueOnce(mockResponse("", { status: 502 }))
      .mockResolvedValueOnce(mockResponse("", { status: 502 }));
    const client = new HttpClient(
      createConfig({ max_retries: 2, rate_limit_per_minute: 1000 })
    );
    try {
      await client.postJson("", {});
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      return;
    }
    expect.fail("should have thrown");
  });

  it("succeeds after 5xx retry", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse("", { status: 503 }))
      .mockResolvedValueOnce(mockResponse({ data: "ok" }));
    const client = new HttpClient(
      createConfig({ max_retries: 3, rate_limit_per_minute: 1000 })
    );
    const result = await client.postJson("", {});
    expect(result).toEqual({ data: "ok" });
    client.close();
  });

  it("throws RetryError on network failure after retries", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const client = new HttpClient(
      createConfig({ max_retries: 1, rate_limit_per_minute: 1000 })
    );
    await expect(client.postJson("", {})).rejects.toThrow(RetryError);
    client.close();
  });

  it("sends Content-Type and User-Agent headers", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ data: null }));
    const client = new HttpClient(createConfig({ rate_limit_per_minute: 1000 }));
    await client.postJson("", { query: "test" });
    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders["Content-Type"]).toBe("application/json");
    expect(callHeaders["User-Agent"]).toBeDefined();
    client.close();
  });

  it("resolves URL from base_url when path is empty", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ data: null }));
    const client = new HttpClient(
      createConfig({ base_url: "https://api.test/graphql", rate_limit_per_minute: 1000 })
    );
    await client.postJson("", {});
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/graphql");
    client.close();
  });

  it("resolves URL from base_url when path is given", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ data: null }));
    const client = new HttpClient(
      createConfig({ base_url: "https://api.test", rate_limit_per_minute: 1000 })
    );
    await client.postJson("v2/graphql", {});
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v2/graphql");
    client.close();
  });
});

describe("HttpClient.close", () => {
  it("is safe to call multiple times", () => {
    const client = new HttpClient(createConfig({ rate_limit_per_minute: 1000 }));
    client.close();
    client.close();
  });
});
