# Changelog

All notable changes to this repository are documented in this file. The Markdown
and Astro adapters (`rehype`, `satteri`, and `astro`) share one version and the
`v<version>` release tags; the editor SDK has its own version and the
`editor-sdk-v<version>` release tags.

## Unreleased

- Publish every `0.x` version of all packages under the npm `latest` tag instead
  of `alpha`, and verify the tag at the end of each release. The packages
  install without the `@alpha` suffix.
- Publish to npm through trusted publishing only, without a long-lived token.

## Editor SDK 0.1.0-alpha.0 - 2026-09-09

- Add `@orthotypography/editor-sdk` with a neutral `.` entry point and a
  `./google-docs` entry point, released independently of the adapters.
- Prepare immutable, nominal document plans with source diagnostics, previews,
  and complete correction batches, and validate the document revision and source
  context before any native transaction.
- Add an in-memory reference adapter that commits complete batches atomically,
  detects conflicts, and simulates concurrent edits.
- Extract Google Docs paragraphs and their UTF-16 ranges across nested tabs, and
  reject unsupported structures explicitly.
- Translate corrections into ordered Google Docs requests guarded by the
  document revision, without network access.
- Restore styles for interior insertions explicitly, excluding links and
  paragraph boundaries; review previews distinguish plain-text and
  style-restoring modes in their types.
- Add a two-phase Google Docs review: preparation without writing, then a single
  commit of the same frozen object with its original transport and revision, or
  an explicit abort; lifecycle errors are typed.
- Add an authentication-neutral transport contract with full reads, one
  conditional write, typed conflicts, and verified readback.
- Add a REST adapter with injected `fetch` and access-token provider, without
  credential storage or automatic retries.
- Depend on `@orthotypography/core@0.1.0-alpha.2`.

## Adapters 0.1.0-alpha.1 - 2026-09-05

- Add the native `@orthotypography/satteri` adapter based on Sätteri's document
  HAST hooks, preserving logical text runs across nodes.
- Preserve Astro 7's configured Markdown processor: Sätteri receives the native
  adapter and Unified receives the rehype adapter.
- Keep `processorOptions` as an explicit compatibility path to Unified.
- Expose source-coordinate changes through `onChange` and
  `orthotypographyChanges` in the rehype, Sätteri, and Astro adapters.
- Add rendering checks for direct Sätteri and Astro use, diagnostics, and
  excluded segments.
- Extend coordinated publication and partial recovery to the three packages on
  JSR and npm.
- Upgrade to `@orthotypography/core@0.1.0-alpha.1`.

## Adapters 0.1.0-alpha.0 - 2026-09-02

- Add `@orthotypography/rehype`, which applies the published engine directly to
  runs of HAST text nodes without altering the tree.
- Preserve block boundaries, raw HTML, and `code`, `pre`, `script`, and `style`
  elements.
- Associate diagnostics with their source text segments.
- Add `@orthotypography/astro` for Astro 7's Unified processor and its inherited
  Markdown and MDX configuration.
- Generate both npm packages and publish them together on JSR and npm, with
  explicit recovery of partial publications.
