import type {
  ApiHealth,
  HistoryResponse,
  HostInfo,
  Snapshot,
} from "./types";

const LOCAL_API_BASE = "http://127.0.0.1:43871";

const configuredBase = import.meta.env.VITE_TELEMETRY_API_BASE_URL?.trim();
const sameOrigin = configuredBase === "same-origin" || configuredBase === ".";

export const TELEMETRY_API_BASE_URL = sameOrigin
  ? ""
  : (configuredBase || LOCAL_API_BASE).replace(/\/+$/, "");

export class TelemetryApiError extends Error {
  status?: number;
  url?: string;
  cause?: unknown;

  constructor(message: string, options?: { status?: number; url?: string; cause?: unknown }) {
    super(message);
    this.name = "TelemetryApiError";
    this.status = options?.status;
    this.url = options?.url;
    this.cause = options?.cause;
  }
}

function assertBrowserContext() {
  if (typeof window === "undefined") return;

  if (window.location.protocol === "https:" && TELEMETRY_API_BASE_URL.startsWith("http://")) {
    throw new TelemetryApiError(
      "The site is running over HTTPS, so the browser is blocking the local HTTP telemetry API. " +
        "Open the dashboard via the site's HTTP/local address, or serve the telemetry endpoint over the same HTTP origin.",
      { url: TELEMETRY_API_BASE_URL },
    );
  }
}

function endpoint(path: string): string {
  if (TELEMETRY_API_BASE_URL.startsWith("/")) {
    return `${TELEMETRY_API_BASE_URL}${path}`;
  }
  return `${TELEMETRY_API_BASE_URL}${path}`;
}

async function getJson<T>(path: string, externalSignal?: AbortSignal, timeoutMs = 10_000): Promise<T> {
  assertBrowserContext();

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, controller.signal])
    : controller.signal;
  const url = endpoint(path);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new TelemetryApiError(`Telemetry API returned HTTP ${response.status}.`, {
        status: response.status,
        url,
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TelemetryApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new TelemetryApiError("The telemetry API did not respond within 10 seconds.", {
        url,
        cause: error,
      });
    }

    const message =
      error instanceof TypeError
        ? `Could not reach the telemetry API at ${TELEMETRY_API_BASE_URL}.`
        : "The telemetry API request failed.";

    throw new TelemetryApiError(message, { url, cause: error });
  } finally {
    window.clearTimeout(timeout);
  }
}

export const telemetryApi = {
  baseUrl: TELEMETRY_API_BASE_URL,

  health(signal?: AbortSignal) {
    return getJson<ApiHealth>("/api/v1/health", signal, 6_000);
  },

  host(signal?: AbortSignal) {
    return getJson<HostInfo>("/api/v1/host", signal, 10_000);
  },

  snapshot(signal?: AbortSignal) {
    return getJson<Snapshot>("/api/v1/snapshot", signal, 10_000);
  },

  history(seconds = 120, signal?: AbortSignal) {
    const safeSeconds = Math.max(1, Math.min(120, Math.round(seconds)));
    return getJson<HistoryResponse>(`/api/v1/history?seconds=${safeSeconds}`, signal, 10_000);
  },
};

export function describeApiError(error: unknown): string {
  if (error instanceof TelemetryApiError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "Request cancelled.";
  if (error instanceof Error) return error.message;
  return "Unknown telemetry API error.";
}
