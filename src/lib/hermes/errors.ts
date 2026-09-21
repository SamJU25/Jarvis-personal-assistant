/**
 * Typed error hierarchy for the Hermes client.
 */

export class HermesClientError extends Error {
  readonly code: string;

  constructor(message: string, code = "hermes_error") {
    super(message);
    this.name = "HermesClientError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HermesConnectionError extends HermesClientError {
  constructor(message: string, cause?: unknown) {
    super(`Hermes connection failed: ${message}`, "connection_failed");
    this.name = "HermesConnectionError";
    if (cause) {
      this.cause = cause;
    }
  }
}

export class HermesTimeoutError extends HermesClientError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Hermes request timed out after ${timeoutMs}ms`, "timeout");
    this.name = "HermesTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class HermesAuthError extends HermesClientError {
  readonly status: number;

  constructor(message = "Hermes authentication failed (invalid or missing API key)", status = 401) {
    super(message, "auth_failed");
    this.name = "HermesAuthError";
    this.status = status;
  }
}

export class HermesMalformedResponseError extends HermesClientError {
  readonly validationIssues?: string[];

  constructor(message: string, validationIssues?: string[]) {
    super(`Hermes malformed response: ${message}`, "malformed_response");
    this.name = "HermesMalformedResponseError";
    this.validationIssues = validationIssues;
  }
}

export class HermesApiError extends HermesClientError {
  readonly status: number;
  readonly errorType?: string;

  constructor(status: number, message: string, errorType?: string) {
    super(`Hermes API error (${status}): ${message}`, "api_error");
    this.name = "HermesApiError";
    this.status = status;
    this.errorType = errorType;
  }
}
