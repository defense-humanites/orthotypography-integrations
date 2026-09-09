import assert from "node:assert/strict";
import { IMPRIMERIE_NATIONALE_PUNCTUATION_RULES as rules } from "@orthotypography/core";
import {
  createGoogleDocsRestTransport,
  GoogleDocsRestReadError,
} from "../src/google-docs-rest.ts";
import { normalizeGoogleDocsDocument } from "../src/google-docs-transport.ts";
import { after, before } from "./fixtures/google_docs_live.ts";

const readOptions = {
  includeTabsContent: true as const,
  suggestionsViewMode: "SUGGESTIONS_INLINE" as const,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("REST adapter completes read-plan-write-read verification", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let reads = 0;
  let tokens = 0;
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => {
      tokens++;
      return "session-token";
    },
    fetch: (input, init) => {
      calls.push({ url: String(input), init });
      if (init?.method === "POST") return Promise.resolve(response({}));
      return Promise.resolve(response(reads++ === 0 ? before : after));
    },
  });
  const result = await normalizeGoogleDocsDocument(
    transport,
    "live-fixture",
    "fr-FR",
    rules,
    { preserveStyles: true },
  );
  assert.equal(result.status, "applied");
  assert.equal(result.preview.body.requests.length, 24);
  assert.deepEqual(calls.map((call) => call.init?.method), [
    "GET",
    "POST",
    "GET",
  ]);
  assert.equal(tokens, 3);
  const batch = JSON.parse(String(calls[1].init?.body));
  assert.deepEqual(batch, {
    requests: result.preview.body.requests,
    writeControl: { requiredRevisionId: "before" },
  });
  assert.ok(!JSON.stringify(batch).includes("session-token"));
  assert.equal(result.after.revision, "after");
});

Deno.test("REST adapter issues complete reads with an injected token", async () => {
  const calls: { input: string; init?: RequestInit }[] = [];
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => "secret-token",
    fetch: (input, init) => {
      calls.push({ input: String(input), init });
      return Promise.resolve(response({ documentId: "a/b" }));
    },
  });
  assert.deepEqual(await transport.read("a/b", readOptions), {
    documentId: "a/b",
  });
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].input);
  assert.equal(url.pathname, "/v1/documents/a%2Fb");
  assert.equal(url.searchParams.get("includeTabsContent"), "true");
  assert.equal(
    url.searchParams.get("suggestionsViewMode"),
    "SUGGESTIONS_INLINE",
  );
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer secret-token",
  });
});

Deno.test("REST adapter writes the exact conditional batch once", async () => {
  const calls: { input: string; init?: RequestInit }[] = [];
  const transport = createGoogleDocsRestTransport({
    apiBaseUrl: "https://example.test/custom/",
    getAccessToken: () => Promise.resolve("token"),
    fetch: (input, init) => {
      calls.push({ input: String(input), init });
      return Promise.resolve(response({}));
    },
  });
  const result = await transport.write({
    documentId: "doc",
    requests: [{
      insertText: {
        location: { tabId: "tab", index: 1 },
        text: "x",
      },
    }],
    requiredRevisionId: "revision",
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(
    calls[0].input,
    "https://example.test/custom/documents/doc:batchUpdate",
  );
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    requests: [{
      insertText: {
        location: { tabId: "tab", index: 1 },
        text: "x",
      },
    }],
    writeControl: { requiredRevisionId: "revision" },
  });
});

Deno.test("REST adapter recognizes the observed stale-revision response", async () => {
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => "token",
    fetch: () =>
      Promise.resolve(response({
        error: {
          code: 400,
          status: "INVALID_ARGUMENT",
          message:
            "The required revision ID 'old' does not match the latest revision.",
        },
      }, 400)),
  });
  assert.deepEqual(
    await transport.write({
      documentId: "doc",
      requests: [],
      requiredRevisionId: "old",
    }),
    {
      ok: false,
      kind: "revision-conflict",
      message:
        "The required revision ID 'old' does not match the latest revision.",
    },
  );
});

Deno.test("REST adapter does not confuse other invalid requests with conflicts", async () => {
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => "token",
    fetch: () =>
      Promise.resolve(response({
        error: { status: "INVALID_ARGUMENT", message: "Invalid range" },
      }, 400)),
  });
  const result = await transport.write({
    documentId: "doc",
    requests: [],
    requiredRevisionId: "revision",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.kind, "invalid-request");
});

Deno.test("REST adapter classifies provider write statuses", async () => {
  for (
    const [status, kind] of [[403, "permission"], [429, "transient"], [
      503,
      "transient",
    ], [404, "unknown"]] as const
  ) {
    const transport = createGoogleDocsRestTransport({
      getAccessToken: () => "token",
      fetch: () => Promise.resolve(response({}, status)),
    });
    const result = await transport.write({
      documentId: "doc",
      requests: [],
      requiredRevisionId: "revision",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.kind, kind);
  }
});

Deno.test("REST adapter turns network write failures into transient results", async () => {
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => "token",
    fetch: () => Promise.reject(new Error("contains private diagnostics")),
  });
  assert.deepEqual(
    await transport.write({
      documentId: "doc",
      requests: [],
      requiredRevisionId: "revision",
    }),
    {
      ok: false,
      kind: "transient",
      message: "Google Docs network write failed",
    },
  );
});

Deno.test("REST adapter exposes typed read failures without leaking tokens", async () => {
  let called = false;
  const transport = createGoogleDocsRestTransport({
    getAccessToken: () => "",
    fetch: () => {
      called = true;
      return Promise.resolve(response({}));
    },
  });
  await assert.rejects(
    transport.read("doc", readOptions),
    (error) =>
      error instanceof GoogleDocsRestReadError &&
      error.kind === "permission" && !error.message.includes("Bearer"),
  );
  assert.deepEqual(
    await transport.write({
      documentId: "doc",
      requests: [],
      requiredRevisionId: "revision",
    }),
    {
      ok: false,
      kind: "permission",
      message: "Google Docs access token is unavailable",
    },
  );
  assert.equal(called, false);
});
