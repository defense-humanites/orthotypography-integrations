import assert from "node:assert/strict";
import {
  createMemoryDocument,
  prepareDocumentPlan,
  validateDocumentPlan,
} from "../mod.ts";
import {
  commitGoogleDocsReview,
  createGoogleDocsRestTransport,
  discardGoogleDocsReview,
  extractGoogleDocsBody,
  normalizeGoogleDocsDocument,
  prepareGoogleDocsReview,
  previewGoogleDocsRequests,
  previewGoogleDocsStyledRequests,
} from "../google-docs.ts";

Deno.test("public entry points expose supported APIs", () => {
  for (
    const value of [
      createMemoryDocument,
      prepareDocumentPlan,
      validateDocumentPlan,
      commitGoogleDocsReview,
      createGoogleDocsRestTransport,
      discardGoogleDocsReview,
      extractGoogleDocsBody,
      normalizeGoogleDocsDocument,
      prepareGoogleDocsReview,
      previewGoogleDocsRequests,
      previewGoogleDocsStyledRequests,
    ]
  ) {
    assert.equal(typeof value, "function");
  }
});
