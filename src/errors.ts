/**
 * Error types raised by the RateMyProfessors client.
 *
 * All client-specific errors extend {@link RMPError}. Use `instanceof` or
 * `error.name` to distinguish configuration, HTTP, retry, API, and parsing errors.
 */

/**
 * Base error for all RMP client failures.
 * Subclasses add fields (e.g. status_code, last_error) and set their own `name`.
 */
export class RMPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RMPError";
    Object.setPrototypeOf(this, RMPError.prototype);
  }
}

/**
 * Thrown when client configuration is invalid (e.g. missing required URL).
 */
export class ConfigurationError extends RMPError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Thrown when the server returns a non-2xx HTTP status.
 * Use `status_code`, `url`, and optional `body` to inspect the response.
 */
export class HttpError extends RMPError {
  constructor(
    public readonly status_code: number,
    public readonly url: string,
    public readonly body?: string,
  ) {
    super(`HTTP ${status_code} for ${url}`);
    this.name = "HttpError";
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

/**
 * Thrown when all retries are exhausted (e.g. repeated 5xx or network errors).
 * The last error that caused the final failure is available as `last_error`.
 */
export class RetryError extends RMPError {
  constructor(public readonly last_error: Error) {
    super(`Request failed after retries: ${String(last_error)}`);
    this.name = "RetryError";
    Object.setPrototypeOf(this, RetryError.prototype);
  }
}

/**
 * Thrown when the RMP GraphQL API returns an `errors` array in the response body.
 * Optional `details` holds the raw error payload for inspection.
 */
export class RMPAPIError extends RMPError {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "RMPAPIError";
    Object.setPrototypeOf(this, RMPAPIError.prototype);
  }
}

/**
 * Thrown when parsing fails: e.g. missing __RELAY_STORE__ in HTML,
 * missing expected record in the store, or invalid response shape.
 */
export class ParsingError extends RMPError {
  constructor(message: string) {
    super(message);
    this.name = "ParsingError";
    Object.setPrototypeOf(this, ParsingError.prototype);
  }
}
