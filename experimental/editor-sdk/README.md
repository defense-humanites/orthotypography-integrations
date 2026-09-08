# Experimental document editor SDK

A JavaScript-compatible foundation for document editor adapters. It prepares
immutable correction plans and validates their complete source before a native
editor transaction. The module contains no editor API or Deno runtime
dependency.

This is **unpublished and experimental**. Its standalone development
configuration pins core commit `2d6af076bb32af2caa0e4171fbb7905396bd2c24`,
because `applyTextChanges` is newer than core `0.1.0-alpha.1`. Existing
workspace packages continue to use the published core. A new core release and a
packaging decision are required before publishing this SDK.

## Prepare and validate

```ts
import { IMPRIMERIE_NATIONALE_RULES } from "@orthotypography/core";
import { prepareDocumentPlan, validateDocumentPlan } from "./src/mod.ts";

const source = {
  documentId: "document-42",
  revision: "revision-7",
  runs: [{
    id: "paragraph-1",
    locale: "fr-FR",
    nodes: [
      { id: "emphasis", value: "Bonjour " },
      { id: "plain", value: ":suite" },
    ],
  }],
};

const plan = prepareDocumentPlan(source, IMPRIMERIE_NATIONALE_RULES);
// Display plan.runs: source diagnostics, complete changes, and preview nodes.
// In an actual editor, read a fresh snapshot before validation.
const batch = validateDocumentPlan(plan, source);
// The adapter must atomically check batch.expectedRevision and commit ALL edits.
```

Node identities are scoped to a run; run identities are scoped to a document.
All IDs, revisions, and locales must be nonempty. A run ends at each semantic
boundary. Known read-only text can participate as a protected node.

The SDK runs lint and fix separately. Diagnostics, including related locations,
refer to the original run's UTF-16 node coordinates. Use `changes`, never a
diagnostic's `replacement`, to build native edits. `preview` is display data;
replacing whole native text nodes can destroy formatting.

Plans are detached and deeply frozen. Keep the original plan object in the same
module session: cloned, filtered, reconstructed, or deserialized plans are
rejected. Plan persistence and partial acceptance are deliberately outside this
first API.

Validation checks document identity, revision, and the full extracted context:
run and node order, IDs, locale, text, and protection. It also revalidates every
change through core. No document is modified by either function. Empty
corrections produce an empty batch. All changed runs form one indivisible batch.

## In-memory reference adapter

```ts
import { createMemoryDocument } from "./src/mod.ts";

const document = createMemoryDocument(source);
const snapshot = document.read();
const plan = prepareDocumentPlan(snapshot, IMPRIMERIE_NATIONALE_RULES);
const batch = validateDocumentPlan(plan, snapshot);
const corrected = document.commit(batch);
```

`commit` accepts only original batches from this module session and rechecks the
complete plan against the current state. It stages all runs before swapping the
state synchronously, so a failure leaves the document unchanged. A nonempty
batch advances the revision once; an empty batch preserves it but still checks
for conflicts. Read snapshots are deeply frozen and detached from caller input.

Use `document.replaceRuns(expectedRevision, runs)` to simulate external text,
structure, language, or protection edits between validation and commit. Every
successful replacement advances the revision, even if the original text is
restored. A stale batch must be replaced with a fresh plan. Revisions are opaque
and unique within one adapter lifetime; do not use separate instances as writers
for the same document.

This adapter models extracted text only. Its synchronous state swap demonstrates
atomicity within one JavaScript instance; it does not implement native
formatting, selections, undo, persistence, or coordination between workers or
processes.

## Adapter responsibilities

An initial [Google Docs request compiler](../../docs/google-docs-preview.md) is
available separately in `src/google-docs.ts`. It produces review-only native
request payloads from caller-supplied body-text ranges. The companion
`extractGoogleDocsBody` function in `src/google-docs-extract.ts` extracts plain
body paragraphs and ranges from a full Google Docs GET response, including
nested tabs. It requires `SUGGESTIONS_INLINE`, rejects suggestions and
unsupported body structures, and takes an explicit locale. Neither module
performs network requests. Raw text styles are retained on native ranges,
outside the editor-neutral snapshot. `previewGoogleDocsStyledRequests`, from
`src/google-docs-style.ts`, additionally restores source-node styles on interior
insertions using an explicit reset mask. This opt-in mode requires style
metadata for every range and rejects links, unsupported properties, ambiguous
insertions, and paragraph-edge insertions. Its behavior is tested with synthetic
request replay and a
[limited live Google Docs validation](../../docs/google-docs-live-validation.md)
covering nested tabs, mixed styles, UTF-16 offsets, idempotence, and
stale-revision rejection. This is not a general style-preservation guarantee.
The original text-only preview remains unchanged.

`normalizeGoogleDocsDocument`, from `src/google-docs-transport.ts`, composes the
extractor and either request compiler behind a minimal asynchronous transport
interface. The host must provide complete inline-suggestions reads and map its
provider responses to the explicit write result categories. The orchestrator:

- reads and extracts once, prepares one plan, and writes its complete request
  batch once with the original required revision;
- returns `revision-conflict` without retrying or reconstructing the stale plan;
- throws `GoogleDocsTransportFailure` for classified permission,
  invalid-request, transient, and unknown failures;
- performs one complete readback after a reported success and throws
  `GoogleDocsReadbackError` unless document identity, revision, paragraph text,
  tab placement, and (in styled mode) source styles reproduce the plan;
- skips both the write and second read when the plan is unchanged.

The interface contains no HTTP client, OAuth flow, provider error parser, retry
policy, or connector-specific response conversion. In particular, an adapter for
a flattened connector response must reconstruct and validate native tab topology
before returning it from `read`.

`createGoogleDocsRestTransport`, from `src/google-docs-rest.ts`, is the isolated
Google Docs v1 implementation. It uses an injected `getAccessToken` callback and
an injectable standards-compatible `fetch`; it does not acquire, refresh, store,
or log credentials. Reads request complete tab content with inline suggestions.
Writes send the compiler requests and `requiredRevisionId` unchanged to
`documents.batchUpdate`. HTTP 401/403 responses become permission failures,
408/429/5xx responses become transient failures, and other 400 responses become
invalid requests. The live-observed Google `INVALID_ARGUMENT` response is
recognized as a revision conflict only when its message states that the required
revision does not match the latest revision. Unknown or changed provider error
shapes remain `unknown` or `invalid-request`; they are never guessed to be safe
conflicts. Network failures are classified without exposing their raw diagnostic
messages.

```ts
import { IMPRIMERIE_NATIONALE_RULES } from "@orthotypography/core";
import { createGoogleDocsRestTransport } from "./src/google-docs-rest.ts";
import { normalizeGoogleDocsDocument } from "./src/google-docs-transport.ts";

const transport = createGoogleDocsRestTransport({
  // Credential acquisition and refresh remain application responsibilities.
  getAccessToken: () => applicationAccessToken,
});
const result = await normalizeGoogleDocsDocument(
  transport,
  documentId,
  "fr-FR",
  IMPRIMERIE_NATIONALE_RULES,
  { preserveStyles: true },
);
if (result.status === "revision-conflict") {
  // Ask the user to review a newly prepared plan; never replay this one.
}
```

Calling `normalizeGoogleDocsDocument` authorizes the transport to write when the
prepared plan is nonempty. Applications that require human review should use the
lower-level extraction and preview functions, display that immutable plan, and
only invoke their write boundary after explicit acceptance.

- Read text and its revision consistently. Advance the revision for relevant
  text, structure, formatting, language, and protection changes, including
  undo/redo.
- Maintain the mapping from `(runId, segmentId)` to native ranges. Offsets are
  UTF-16, half-open, and measured against the original text.
- Translate every edit before writing. Changes within each run are sorted by
  descending segment index and offset. For editors with global offsets,
  establish a safe global order across runs; the SDK does not know native range
  semantics.
- Recheck `expectedRevision` **inside** an atomic native transaction or use the
  host's equivalent conditional batch API. Validation alone cannot close the
  race between reading the snapshot and writing. Also verify native ranges and
  expected text as required by the host. Reject the entire batch on conflict.
- Preserve styles, structure, selections, and undo semantics. Never commit a
  subset or retry a stale batch; obtain a new snapshot and prepare a new plan.

If the host cannot guarantee an atomic conditional commit, this contract
supports preview and diagnostics only until the adapter supplies an equivalent
mechanism. No native adapter is implemented here yet.

## Development

From this directory:

```sh
deno task check
deno task test
```

The independent configuration and CI job do not alter the released packages'
builds, dependency versions, or publishing workflow.
