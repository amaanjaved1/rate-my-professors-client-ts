/**
 * HTTP client used by the RMP client: rate limiting, retries, and error mapping.
 *
 * - All requests go through a token-bucket rate limiter (see {@link TokenBucket}).
 * - Failed requests (5xx or network errors) are retried up to config.max_retries.
 * - Non-2xx responses become {@link HttpError}; GraphQL `errors` in the body become {@link RMPAPIError}.
 * - Timeouts use AbortController; call {@link close} to cancel in-flight requests.
 */

import type { RMPClientConfig } from "./config.js";
import { HttpError, RetryError, RMPAPIError } from "./errors.js";
import { TokenBucket } from "./rateLimit.js";

/**
 * Low-level HTTP client with retries, rate limiting, and typed errors.
 * Typically you use {@link RMPClient}, which uses this internally.
 */
export class HttpClient {
  private _config: RMPClientConfig;
  private _bucket: TokenBucket;
  private _abortController: AbortController | null = null;

  constructor(config: RMPClientConfig) {
    this._config = config;
    this._bucket = new TokenBucket(
      config.rate_limit_per_minute,
      config.rate_limit_per_minute / 60
    );
  }

  /**
   * Merges config default headers with optional extra headers.
   * User-Agent is always set from config.
   */
  private _headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...this._config.default_headers,
      "User-Agent": this._config.user_agent,
    };
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  /**
   * Resolves a path (or empty string) against the config base_url.
   * Empty path returns base_url; leading slashes are normalized.
   */
  private _url(path: string): string {
    if (path === "") return this._config.base_url;
    const base = this._config.base_url.replace(/\/$/, "");
    const p = path.replace(/^\//, "");
    return `${base}/${p}`;
  }

  /**
   * Sends a POST request with JSON body. Respects rate limit, timeout, and retries.
   * On success returns the parsed JSON object. If the response contains an `errors`
   * property (RMP GraphQL style), throws {@link RMPAPIError}. On non-2xx status
   * throws {@link HttpError}; after exhausting retries throws {@link RetryError}.
   *
   * @param path - Path or "" for base URL.
   * @param payload - Object to send as JSON body.
   * @param headers - Optional extra headers.
   * @returns The response body as a record (no `errors` key on success).
   */
  async postJson(
    path: string,
    payload: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    const url = this._url(path);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this._config.max_retries; attempt++) {
      await this._bucket.consume();
      this._abortController = new AbortController();
      const timeoutId = setTimeout(
        () => this._abortController?.abort(),
        this._config.timeout_seconds * 1000
      );

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this._headers(headers),
          },
          body: JSON.stringify(payload),
          signal: this._abortController.signal,
        });
        clearTimeout(timeoutId);
        this._abortController = null;

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>;
          if (data && typeof data === "object" && "errors" in data) {
            throw new RMPAPIError("RMP API returned errors", data.errors as unknown);
          }
          return data;
        }

        const body = await response.text();
        const err = new HttpError(response.status, url, body);
        lastError = err;
        if (response.status >= 500 && response.status < 600 && attempt < this._config.max_retries) {
          continue;
        }
        throw err;
      } catch (e) {
        clearTimeout(timeoutId);
        this._abortController = null;
        if (e instanceof HttpError || e instanceof RMPAPIError) throw e;
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt >= this._config.max_retries) {
          throw new RetryError(lastError);
        }
      }
    }

    throw new RetryError(lastError ?? new Error("Unknown error"));
  }

  /**
   * Aborts any in-flight request (e.g. when shutting down the client).
   * Safe to call multiple times.
   */
  close(): void {
    this._abortController?.abort();
  }
}
