import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConfig } from "../src/config.js";
import { HttpError, RMPAPIError } from "../src/errors.js";
import { HttpClient } from "../src/http.js";

function mockResponse(
  body: string | object,
  init: { status?: number; ok?: boolean; headers?: Record<string, string> } = {}
): Response {
  const status = init.status ?? 200;
  const isOk = init.ok ?? (status >= 200 && status < 300);
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: isOk,
    status,
    headers: new Headers(init.headers),
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

describe("HttpClient.getHtml", () => {
  it("returns text on 200", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse("<html>Hello</html>"));
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    const result = await client.getHtml("https://example.com/page");
    expect(result).toBe("<html>Hello</html>");
    client.close();
  });

  it("throws HttpError on 404", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse("Not Found", { status: 404 })
    );
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    await expect(client.getHtml("https://example.com/missing")).rejects.toThrow(
      HttpError
    );
    client.close();
  });

  it("sends default headers", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse("ok"));
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    await client.getHtml("https://example.com/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders["User-Agent"]).toBeDefined();
    client.close();
  });
});

describe("HttpClient.postJson", () => {
  it("returns JSON on 200", async () => {
    const payload = { data: { x: 1 } };
    fetchMock.mockResolvedValueOnce(mockResponse(payload));
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    const result = await client.postJson("", { query: "..." });
    expect(result).toEqual(payload);
    client.close();
  });

  it("throws RMPAPIError when errors in body", async () => {
    const body = { errors: [{ message: "Unauthorized" }] };
    fetchMock.mockResolvedValueOnce(mockResponse(body));
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    await expect(client.postJson("", { query: "..." })).rejects.toThrow(
      RMPAPIError
    );
    client.close();
  });

  it("throws HttpError on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse("Forbidden", { status: 403 })
    );
    const config = createConfig({ rate_limit_per_minute: 1000 });
    const client = new HttpClient(config);
    try {
      await client.postJson("", {});
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status_code).toBe(403);
      return;
    }
    expect.fail("should have thrown");
    client.close();
  });

  it("retries on 5xx", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse("", { status: 502 }))
      .mockResolvedValueOnce(mockResponse("", { status: 502 }))
      .mockResolvedValueOnce(mockResponse("", { status: 502 }));
    const config = createConfig({
      max_retries: 2,
      rate_limit_per_minute: 1000,
    });
    const client = new HttpClient(config);
    try {
      await client.postJson("", {});
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status_code).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      return;
    }
    expect.fail("should have thrown");
    client.close();
  });

  it("succeeds after 5xx retry", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse("", { status: 503 }))
      .mockResolvedValueOnce(mockResponse({ data: "ok" }));
    const config = createConfig({
      max_retries: 3,
      rate_limit_per_minute: 1000,
    });
    const client = new HttpClient(config);
    const result = await client.postJson("", {});
    expect(result).toEqual({ data: "ok" });
    client.close();
  });
});
