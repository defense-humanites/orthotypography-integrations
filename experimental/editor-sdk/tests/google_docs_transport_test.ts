import assert from "node:assert/strict";
import { IMPRIMERIE_NATIONALE_PUNCTUATION_RULES as rules } from "@orthotypography/core";
import {
  commitGoogleDocsReview,
  discardGoogleDocsReview,
  GoogleDocsReadbackError,
  type GoogleDocsReview,
  GoogleDocsReviewError,
  type GoogleDocsTransport,
  GoogleDocsTransportFailure,
  normalizeGoogleDocsDocument,
  prepareGoogleDocsReview,
} from "../src/google-docs-transport.ts";
import { after, before } from "./fixtures/google_docs_live.ts";

function transport(
  writeResult: Awaited<ReturnType<GoogleDocsTransport["write"]>> = { ok: true },
  readback: unknown = after,
) {
  const reads: unknown[] = [];
  const writes: unknown[] = [];
  const value: GoogleDocsTransport = {
    read(documentId, options) {
      reads.push({ documentId, options });
      return Promise.resolve(reads.length === 1 ? before : readback);
    },
    write(input) {
      writes.push(input);
      return Promise.resolve(writeResult);
    },
  };
  return { value, reads, writes };
}

Deno.test("review separates preparation from one explicit commit", async () => {
  const mock = transport();
  const review = await prepareGoogleDocsReview(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  assert.equal(review.mode, "preserve-styles");
  assert.equal(mock.reads.length, 1);
  assert.equal(mock.writes.length, 0);
  assert.ok(Object.isFrozen(review));
  await assert.rejects(
    commitGoogleDocsReview(mock.value, structuredClone(review)),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "unknown-review",
  );
  await assert.rejects(
    commitGoogleDocsReview(transport().value, review),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "transport-mismatch",
  );
  const firstCommit = commitGoogleDocsReview(mock.value, review);
  await assert.rejects(
    commitGoogleDocsReview(mock.value, review),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "already-consumed",
  );
  const result = await firstCommit;
  assert.equal(result.status, "applied");
  assert.equal(mock.reads.length, 2);
  assert.equal(mock.writes.length, 1);
});

Deno.test("review can be explicitly discarded without writing", async () => {
  const mock = transport();
  const review = await prepareGoogleDocsReview(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  discardGoogleDocsReview(mock.value, review);
  assert.equal(mock.writes.length, 0);
  await assert.rejects(
    commitGoogleDocsReview(mock.value, review),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "already-consumed",
  );
  assert.throws(
    () => discardGoogleDocsReview(mock.value, review),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "already-consumed",
  );
  assert.equal(mock.writes.length, 0);
});

Deno.test("review is nominal and cannot be reconstructed structurally", async () => {
  const mock = transport();
  const review = await prepareGoogleDocsReview(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
  );
  assert.equal(review.mode, "text");
  if (review.mode !== "text") assert.fail("Expected a text-only review");
  assert.ok(
    review.preview.body.requests.every((request) =>
      "deleteContentRange" in request || "insertText" in request
    ),
  );
  // @ts-expect-error reconstructed data is not an opaque GoogleDocsReview
  const reconstructed: GoogleDocsReview = {
    mode: "text",
    before: review.before,
    plan: review.plan,
    preview: review.preview,
  };
  await assert.rejects(
    commitGoogleDocsReview(mock.value, reconstructed),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "unknown-review",
  );
});

Deno.test("transport applies once with exact read and revision contracts", async () => {
  const mock = transport();
  const result = await normalizeGoogleDocsDocument(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  assert.equal(result.status, "applied");
  assert.equal(mock.reads.length, 2);
  assert.deepEqual(mock.reads[0], {
    documentId: "live-fixture",
    options: {
      includeTabsContent: true,
      suggestionsViewMode: "SUGGESTIONS_INLINE",
    },
  });
  assert.equal(mock.writes.length, 1);
  assert.deepEqual(mock.writes[0], {
    documentId: "live-fixture",
    requests: result.preview.body.requests,
    requiredRevisionId: "before",
  });
  assert.equal(result.after.revision, "after");
});

Deno.test("transport returns revision conflicts without retry or readback", async () => {
  const mock = transport({ ok: false, kind: "revision-conflict" });
  const review = await prepareGoogleDocsReview(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  const result = await commitGoogleDocsReview(mock.value, review);
  assert.equal(result.status, "revision-conflict");
  assert.equal(mock.writes.length, 1);
  assert.equal(mock.reads.length, 1);
  await assert.rejects(
    commitGoogleDocsReview(mock.value, review),
    (error) =>
      error instanceof GoogleDocsReviewError &&
      error.kind === "already-consumed",
  );
  assert.equal(mock.writes.length, 1);
});

Deno.test("transport exposes classified non-conflict failures", async () => {
  const mock = transport({
    ok: false,
    kind: "permission",
    message: "denied",
  });
  await assert.rejects(
    normalizeGoogleDocsDocument(
      mock.value,
      "live-fixture",
      "fr-FR",
      rules,
      { preserveStyles: true },
    ),
    (error) =>
      error instanceof GoogleDocsTransportFailure &&
      error.kind === "permission" && error.message === "denied",
  );
  assert.equal(mock.reads.length, 1);
});

Deno.test("transport skips writes and readback for unchanged documents", async () => {
  const mock = transport();
  mock.value.read = (_documentId, _options) => Promise.resolve(after);
  const result = await normalizeGoogleDocsDocument(
    mock.value,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  assert.equal(result.status, "unchanged");
  assert.equal(mock.writes.length, 0);
});

Deno.test("transport rejects successful writes with mismatched readback", async () => {
  const changed = structuredClone(after);
  changed.revisionId = "different";
  changed.tabs[0].documentTab.body.content[1].paragraph!.elements[0].textRun
    .content = "XX ";
  const mock = transport({ ok: true }, changed);
  await assert.rejects(
    normalizeGoogleDocsDocument(
      mock.value,
      "live-fixture",
      "fr-FR",
      rules,
      { preserveStyles: true },
    ),
    GoogleDocsReadbackError,
  );
  assert.equal(mock.writes.length, 1);
  assert.equal(mock.reads.length, 2);
});
