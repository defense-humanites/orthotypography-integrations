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

const googleDocsReviewBrand: unique symbol = Symbol("GoogleDocsReview");

interface GoogleDocsReviewBase {
  readonly [googleDocsReviewBrand]: true;
  readonly before: DocumentSnapshot;
  readonly plan: DocumentPlan;
}

/** Opaque review whose preview contains text operations only. */
export interface GoogleDocsTextReview extends GoogleDocsReviewBase {
  readonly mode: "text";
  readonly preview: GoogleDocsRequestPreview;
}

/** Opaque review whose preview also restores supported source styles. */
export interface GoogleDocsStyledReview extends GoogleDocsReviewBase {
  readonly mode: "preserve-styles";
  readonly preview: GoogleDocsStyledPreview;
}

/** Session-local review returned only by prepareGoogleDocsReview. */
export type GoogleDocsReview = GoogleDocsTextReview | GoogleDocsStyledReview;

export type GoogleDocsNormalizationResult<
  TReview extends GoogleDocsReview = GoogleDocsReview,
> =
  | (TReview & { readonly status: "unchanged" })
  | (TReview & { readonly status: "revision-conflict" })
  | (TReview & {
    readonly status: "applied";
    readonly after: DocumentSnapshot;
  });

export interface GoogleDocsReviewOptions {
  readonly preserveStyles?: boolean;
}

interface GoogleDocsReviewState {
  readonly transport: GoogleDocsTransport;
  readonly source: ReturnType<typeof extractGoogleDocsBody>;
  readonly locale: string;
  status: "prepared" | "committing" | "committed" | "discarded";
}

const reviews = new WeakMap<GoogleDocsReview, GoogleDocsReviewState>();

export type GoogleDocsReviewErrorKind =
  | "unknown-review"
  | "transport-mismatch"
  | "already-consumed";

/** Invalid origin, transport, or lifecycle state for an opaque review. */
export class GoogleDocsReviewError extends Error {
  constructor(readonly kind: GoogleDocsReviewErrorKind, message: string) {
    super(message);
    this.name = "GoogleDocsReviewError";
  }
}

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

/** Reads once and prepares a style-preserving review without writing. */
export function prepareGoogleDocsReview(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: { readonly preserveStyles: true },
): Promise<GoogleDocsStyledReview>;

/** Reads once and prepares a text-only review without writing. */
export function prepareGoogleDocsReview(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options?: { readonly preserveStyles?: false },
): Promise<GoogleDocsTextReview>;

/** Reads once and preserves the review mode selected at runtime. */
export function prepareGoogleDocsReview(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: GoogleDocsReviewOptions,
): Promise<GoogleDocsReview>;

export async function prepareGoogleDocsReview(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: GoogleDocsReviewOptions = {},
): Promise<GoogleDocsReview> {
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
  const review: GoogleDocsReview = styled
    ? Object.freeze({
      [googleDocsReviewBrand]: true as const,
      mode: "preserve-styles" as const,
      before: before.snapshot,
      plan,
      preview: previewGoogleDocsStyledRequests(
        plan,
        before.snapshot,
        before.ranges,
      ),
    })
    : Object.freeze({
      [googleDocsReviewBrand]: true as const,
      mode: "text" as const,
      before: before.snapshot,
      plan,
      preview: previewGoogleDocsRequests(plan, before.snapshot, before.ranges),
    });
  reviews.set(review, {
    transport,
    source: before,
    locale,
    status: "prepared",
  });
  return review;
}

/**
 * Commits one original review exactly once and verifies one full readback.
 * Revision conflicts consume the review and are returned without retry.
 */
export function commitGoogleDocsReview(
  transport: GoogleDocsTransport,
  review: GoogleDocsStyledReview,
): Promise<GoogleDocsNormalizationResult<GoogleDocsStyledReview>>;

export function commitGoogleDocsReview(
  transport: GoogleDocsTransport,
  review: GoogleDocsTextReview,
): Promise<GoogleDocsNormalizationResult<GoogleDocsTextReview>>;

export function commitGoogleDocsReview(
  transport: GoogleDocsTransport,
  review: GoogleDocsReview,
): Promise<GoogleDocsNormalizationResult>;

export async function commitGoogleDocsReview(
  transport: GoogleDocsTransport,
  review: GoogleDocsReview,
): Promise<GoogleDocsNormalizationResult> {
  const state = reviews.get(review);
  if (!state) {
    throw new GoogleDocsReviewError(
      "unknown-review",
      "Unknown Google Docs review; prepare it in this module session",
    );
  }
  if (state.transport !== transport) {
    throw new GoogleDocsReviewError(
      "transport-mismatch",
      "Google Docs review requires its original transport",
    );
  }
  if (state.status !== "prepared") {
    throw new GoogleDocsReviewError(
      "already-consumed",
      "Google Docs review was already consumed",
    );
  }
  state.status = "committing";
  if (review.preview.body.requests.length === 0) {
    state.status = "committed";
    return Object.freeze({ ...review, status: "unchanged" });
  }
  const result = await transport.write({
    documentId: review.preview.documentId,
    requests: review.preview.body.requests,
    requiredRevisionId: review.preview.body.writeControl.requiredRevisionId,
  });
  state.status = "committed";
  if (!result.ok) {
    if (result.kind === "revision-conflict") {
      return Object.freeze({ ...review, status: "revision-conflict" });
    }
    throw new GoogleDocsTransportFailure(result.kind, result.message);
  }
  const after = extractGoogleDocsBody(
    await transport.read(review.before.documentId, {
      includeTabsContent: true,
      suggestionsViewMode: "SUGGESTIONS_INLINE",
    }),
    state.locale,
  );
  verifyReadback(
    state.source,
    review.plan,
    after,
    review.mode === "preserve-styles",
  );
  return Object.freeze({ ...review, status: "applied", after: after.snapshot });
}

/**
 * Irreversibly consumes an original review without writing. Applications should
 * call this when a user rejects or closes a prepared review.
 */
export function discardGoogleDocsReview(
  transport: GoogleDocsTransport,
  review: GoogleDocsReview,
): void {
  const state = reviews.get(review);
  if (!state) {
    throw new GoogleDocsReviewError(
      "unknown-review",
      "Unknown Google Docs review; prepare it in this module session",
    );
  }
  if (state.transport !== transport) {
    throw new GoogleDocsReviewError(
      "transport-mismatch",
      "Google Docs review requires its original transport",
    );
  }
  if (state.status !== "prepared") {
    throw new GoogleDocsReviewError(
      "already-consumed",
      "Google Docs review was already consumed",
    );
  }
  state.status = "discarded";
}

/** Reads, writes, and verifies a style-preserving normalization. */
export function normalizeGoogleDocsDocument(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: { readonly preserveStyles: true },
): Promise<GoogleDocsNormalizationResult<GoogleDocsStyledReview>>;

/** Reads, writes, and verifies a text-only normalization. */
export function normalizeGoogleDocsDocument(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options?: { readonly preserveStyles?: false },
): Promise<GoogleDocsNormalizationResult<GoogleDocsTextReview>>;

/** Reads, writes, and verifies the normalization mode selected at runtime. */
export function normalizeGoogleDocsDocument(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: GoogleDocsReviewOptions,
): Promise<GoogleDocsNormalizationResult>;

export async function normalizeGoogleDocsDocument(
  transport: GoogleDocsTransport,
  documentId: string,
  locale: string,
  rules: readonly RuntimeRule[],
  options: GoogleDocsReviewOptions = {},
): Promise<GoogleDocsNormalizationResult> {
  return await commitGoogleDocsReview(
    transport,
    await prepareGoogleDocsReview(
      transport,
      documentId,
      locale,
      rules,
      options,
    ),
  );
}
