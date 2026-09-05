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

## Adapter responsibilities

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
