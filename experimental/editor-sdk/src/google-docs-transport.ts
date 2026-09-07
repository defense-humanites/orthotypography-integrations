import type { RuntimeRule } from "@orthotypography/core";
import { extractGoogleDocsBody } from "./google-docs-extract.ts";
import {
  type GoogleDocsRequestPreview,
  type GoogleDocsTextRequest,
  previewGoogleDocsRequests,
} from "./google-docs.ts";
import {
  type GoogleDocsStyledPreview,
  type GoogleDocsStyleRequest,
  previewGoogleDocsStyledRequests,
} from "./google-docs-style.ts";
import {
  type DocumentPlan,
  type DocumentSnapshot,
  prepareDocumentPlan,
} from "./mod.ts";

/** Exact read requirements for a response accepted by the extractor. */
export interface GoogleDocsReadOptions {
  readonly includeTabsContent: true;
  readonly suggestionsViewMode: "SUGGESTIONS_INLINE";
}

/** Failure categories supplied by a host adapter, without vendor error parsing. */
export type GoogleDocsWriteFailureKind =
  | "revision-conflict"
  | "permission"
  | "invalid-request"
  | "transient"
  | "unknown";

export type GoogleDocsWriteResult =
  | { readonly ok: true }
  | {
    readonly ok: false;
    readonly kind: GoogleDocsWriteFailureKind;
    readonly message?: string;
  };

export interface GoogleDocsWriteInput {
  readonly documentId: string;
  readonly requests: readonly (
    | GoogleDocsTextRequest
    | GoogleDocsStyleRequest
  )[];
  readonly requiredRevisionId: string;
}

/** Minimal authenticated boundary implemented outside this package. */
export interface GoogleDocsTransport {
  read(documentId: string, options: GoogleDocsReadOptions): Promise<unknown>;
  write(input: GoogleDocsWriteInput): Promise<GoogleDocsWriteResult>;
}

export type GoogleDocsNormalizationPreview =
  | GoogleDocsRequestPreview
  | GoogleDocsStyledPreview;

interface GoogleDocsNormalizationBase {
  readonly before: DocumentSnapshot;
  readonly plan: DocumentPlan;
  readonly preview: GoogleDocsNormalizationPreview;
}

export type GoogleDocsNormalizationResult =
  | (GoogleDocsNormalizationBase & { readonly status: "unchanged" })
  | (GoogleDocsNormalizationBase & { readonly status: "revision-conflict" })
  | (GoogleDocsNormalizationBase & {
    readonly status: "applied";
    readonly after: DocumentSnapshot;
  });

/** Non-conflict write failure reported explicitly by the host adapter. */
export class GoogleDocsTransportFailure extends Error {
  constructor(
    readonly kind: Exclude<
      GoogleDocsWriteFailureKind,
      "revision-conflict"
    >,
    message?: string,
  ) {
    super(message ?? `Google Docs transport failure: ${kind}`);
    this.name = "GoogleDocsTransportFailure";
  }
}

/** Successful write whose full readback does not reproduce the prepared plan. */
export class GoogleDocsReadbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDocsReadbackError";
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    ).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(
      ",",
    )
  }}`;
}

function verifyReadback(
  before: ReturnType<typeof extractGoogleDocsBody>,
  plan: DocumentPlan,
  after: ReturnType<typeof extractGoogleDocsBody>,
  styled: boolean,
): void {
  if (after.snapshot.documentId !== before.snapshot.documentId) {
    throw new GoogleDocsReadbackError("Google Docs readback identity changed");
  }
  if (after.snapshot.revision === before.snapshot.revision) {
    throw new GoogleDocsReadbackError(
      "Google Docs readback revision did not advance",
    );
  }
  if (after.snapshot.runs.length !== plan.runs.length) {
    throw new GoogleDocsReadbackError("Google Docs readback structure changed");
  }
  for (const [index, planned] of plan.runs.entries()) {
    const source = before.snapshot.runs[index];
    const observed = after.snapshot.runs[index];
    const expectedText = planned.preview.map((node) => node.value).join("");
    const observedText = observed.nodes.map((node) => node.value).join("");
    if (observedText !== expectedText) {
      throw new GoogleDocsReadbackError(
        "Google Docs readback text differs from plan",
      );
    }
    const expectedTab = before.ranges.find((range) => range.runId === source.id)
      ?.tabId;
    const observedTab = after.ranges.find((range) =>
      range.runId === observed.id
    )
      ?.tabId;
    if (expectedTab !== observedTab && (expectedTab || observedTab)) {
      throw new GoogleDocsReadbackError("Google Docs readback tab changed");
    }
    if (!styled) continue;
    const expectedStyles = planned.preview.flatMap((node) => {
      const range = before.ranges.find((item) =>
        item.runId === source.id && item.nodeId === node.id
      );
      if (!range?.textStyle) {
        throw new GoogleDocsReadbackError(
          "Missing source style during readback",
        );
      }
      return Array.from({ length: node.value.length }, () => range.textStyle);
    });
    const observedStyles = observed.nodes.flatMap((node) => {
      const range = after.ranges.find((item) =>
        item.runId === observed.id && item.nodeId === node.id
      );
      if (!range?.textStyle) {
        throw new GoogleDocsReadbackError(
          "Missing observed style during readback",
        );
      }
      return Array.from({ length: node.value.length }, () => range.textStyle);
    });
    if (canonical(observedStyles) !== canonical(expectedStyles)) {
      throw new GoogleDocsReadbackError(
        "Google Docs readback styles differ from plan",
      );
    }
  }
}

/**
 * Reads, plans, conditionally writes once, and verifies one full readback.
 * Revision conflicts are returned for replanning by the caller; they are never
 * retried. Other write failures and readback mismatches throw typed errors.
 */
export async function normalizeGoogleDocsDocument(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: { readonly preserveStyles?: boolean } = {},
): Promise<GoogleDocsNormalizationResult> {
  const readOptions = Object.freeze({
    includeTabsContent: true as const,
    suggestionsViewMode: "SUGGESTIONS_INLINE" as const,
  });
  const before = extractGoogleDocsBody(
    await transport.read(documentId, readOptions),
    locale,
  );
  if (before.snapshot.documentId !== documentId) {
    throw new Error("Google Docs transport returned a different document");
  }
  const plan = prepareDocumentPlan(before.snapshot, rules);
  const styled = options.preserveStyles === true;
  const preview = styled
    ? previewGoogleDocsStyledRequests(plan, before.snapshot, before.ranges)
    : previewGoogleDocsRequests(plan, before.snapshot, before.ranges);
  const base = { before: before.snapshot, plan, preview };
  if (preview.body.requests.length === 0) {
    return Object.freeze({ ...base, status: "unchanged" });
  }
  const result = await transport.write({
    documentId: preview.documentId,
    requests: preview.body.requests,
    requiredRevisionId: preview.body.writeControl.requiredRevisionId,
  });
  if (!result.ok) {
    if (result.kind === "revision-conflict") {
      return Object.freeze({ ...base, status: "revision-conflict" });
    }
    throw new GoogleDocsTransportFailure(result.kind, result.message);
  }
  const after = extractGoogleDocsBody(
    await transport.read(documentId, readOptions),
    locale,
  );
  verifyReadback(before, plan, after, styled);
  return Object.freeze({ ...base, status: "applied", after: after.snapshot });
}
