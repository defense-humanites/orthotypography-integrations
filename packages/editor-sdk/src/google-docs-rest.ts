import type {
  GoogleDocsReadOptions,
  GoogleDocsTransport,
  GoogleDocsWriteFailureKind,
  GoogleDocsWriteInput,
  GoogleDocsWriteResult,
} from "./google-docs-transport.ts";

/** Explicit dependencies for the provider-specific Google Docs REST adapter. */
export interface GoogleDocsRestOptions {
  readonly getAccessToken: () => string | Promise<string>;
  readonly fetch?: typeof globalThis.fetch;
  readonly apiBaseUrl?: string;
}

/** Classified failure while obtaining a complete Google Docs read. */
export class GoogleDocsRestReadError extends Error {
  constructor(
    readonly kind: Exclude<
      GoogleDocsWriteFailureKind,
      "revision-conflict"
    >,
    readonly status?: number,
    message?: string,
  ) {
    super(message ?? `Google Docs read failed: ${kind}`);
    this.name = "GoogleDocsRestReadError";
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function errorDetails(
  response: Response,
): Promise<{ status?: string; message?: string }> {
  try {
    const payload = object(await response.json());
    const error = object(payload?.error);
    return {
      status: typeof error?.status === "string" ? error.status : undefined,
      message: typeof error?.message === "string" ? error.message : undefined,
    };
  } catch {
    return {};
  }
}

function classify(
  response: Response,
  details: { status?: string; message?: string },
): GoogleDocsWriteFailureKind {
  if (
    response.status === 400 && details.status === "INVALID_ARGUMENT" &&
    /required revision ID.+does not match the latest revision/is.test(
      details.message ?? "",
    )
  ) return "revision-conflict";
  if (response.status === 401 || response.status === 403) return "permission";
  if (response.status === 400) return "invalid-request";
  if (
    response.status === 408 || response.status === 429 || response.status >= 500
  ) {
    return "transient";
  }
  return "unknown";
}

function message(
  kind: GoogleDocsWriteFailureKind,
  details: { message?: string },
): string {
  return details.message?.trim() || `Google Docs request failed: ${kind}`;
}

/**
 * Creates a Google Docs v1 transport with injected authentication and fetch.
 * It performs no token storage, refresh policy, retries, or stale-plan replay.
 */
export function createGoogleDocsRestTransport(
  options: GoogleDocsRestOptions,
): GoogleDocsTransport {
  if (!options || typeof options.getAccessToken !== "function") {
    throw new Error("Missing Google Docs access-token provider");
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new Error("Missing Google Docs fetch implementation");
  }
  const base = (options.apiBaseUrl ?? "https://docs.googleapis.com/v1")
    .replace(/\/+$/u, "");

  async function authorization(): Promise<string> {
    const token = await options.getAccessToken();
    if (typeof token !== "string" || token.trim() === "") {
      throw new GoogleDocsRestReadError(
        "permission",
        undefined,
        "Google Docs access token is unavailable",
      );
    }
    return `Bearer ${token.trim()}`;
  }

  return Object.freeze({
    async read(documentId: string, readOptions: GoogleDocsReadOptions) {
      const url = new URL(
        `${base}/documents/${encodeURIComponent(documentId)}`,
      );
      url.searchParams.set(
        "includeTabsContent",
        String(readOptions.includeTabsContent),
      );
      url.searchParams.set(
        "suggestionsViewMode",
        readOptions.suggestionsViewMode,
      );
      let response: Response;
      try {
        response = await fetcher(url, {
          method: "GET",
          headers: { Authorization: await authorization() },
        });
      } catch (cause) {
        if (cause instanceof GoogleDocsRestReadError) throw cause;
        throw new GoogleDocsRestReadError(
          "transient",
          undefined,
          "Google Docs network read failed",
        );
      }
      if (!response.ok) {
        const details = await errorDetails(response);
        const kind = classify(response, details);
        throw new GoogleDocsRestReadError(
          kind === "revision-conflict" ? "invalid-request" : kind,
          response.status,
          message(kind, details),
        );
      }
      try {
        return await response.json();
      } catch {
        throw new GoogleDocsRestReadError(
          "unknown",
          response.status,
          "Google Docs returned invalid JSON",
        );
      }
    },

    async write(input: GoogleDocsWriteInput): Promise<GoogleDocsWriteResult> {
      let response: Response;
      try {
        response = await fetcher(
          `${base}/documents/${
            encodeURIComponent(input.documentId)
          }:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: await authorization(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: input.requests,
              writeControl: { requiredRevisionId: input.requiredRevisionId },
            }),
          },
        );
      } catch (cause) {
        if (cause instanceof GoogleDocsRestReadError) {
          return Object.freeze({
            ok: false,
            kind: cause.kind,
            message: cause.message,
          });
        }
        return Object.freeze({
          ok: false,
          kind: "transient",
          message: "Google Docs network write failed",
        });
      }
      if (response.ok) return Object.freeze({ ok: true });
      const details = await errorDetails(response);
      const kind = classify(response, details);
      return Object.freeze({
        ok: false,
        kind,
        message: message(kind, details),
      });
    },
  });
}
