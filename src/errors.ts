/**
 * Errors raised by the RMP client.
 */

export class RMPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RMPError";
    Object.setPrototypeOf(this, RMPError.prototype);
  }
}

export class ConfigurationError extends RMPError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class HttpError extends RMPError {
  constructor(
    public readonly status_code: number,
    public readonly url: string,
    public readonly body?: string
  ) {
    super(`HTTP ${status_code} for ${url}`);
    this.name = "HttpError";
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class RateLimitError extends RMPError {
  constructor(message: string = "Local rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class RetryError extends RMPError {
  constructor(public readonly last_error: Error) {
    super(`Request failed after retries: ${String(last_error)}`);
    this.name = "RetryError";
    Object.setPrototypeOf(this, RetryError.prototype);
  }
}

export class RMPAPIError extends RMPError {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "RMPAPIError";
    Object.setPrototypeOf(this, RMPAPIError.prototype);
  }
}

export class ParsingError extends RMPError {
  constructor(message: string) {
    super(message);
    this.name = "ParsingError";
    Object.setPrototypeOf(this, ParsingError.prototype);
  }
}
