import assert from "node:assert/strict";
import { IMPRIMERIE_NATIONALE_PUNCTUATION_RULES as rules } from "@orthotypography/core";
import {
  commitGoogleDocsReview,
  GoogleDocsReadbackError,
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
  assert.equal(mock.reads.length, 1);
  assert.equal(mock.writes.length, 0);
  assert.ok(Object.isFrozen(review));
  await assert.rejects(
    commitGoogleDocsReview(mock.value, structuredClone(review)),
    /Unknown Google Docs review/,
  );
  await assert.rejects(
    commitGoogleDocsReview(transport().value, review),
    /original transport/,
  );
  const firstCommit = commitGoogleDocsReview(mock.value, review);
  await assert.rejects(
    commitGoogleDocsReview(mock.value, review),
    /already committed/,
  );
  const result = await firstCommit;
  assert.equal(result.status, "applied");
  assert.equal(mock.reads.length, 2);
  assert.equal(mock.writes.length, 1);
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
    /already committed/,
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
