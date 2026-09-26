# Contributing to Orthotypography integrations

Thank you for helping improve Orthotypography integrations.

## Before contributing

For substantial changes, open an issue first so that the proposed behavior,
documentary sources, affected language or style presets, and compatibility
requirements can be discussed before implementation.

Every orthotypographic rule should be traceable to an identified authority.
Contributions should include relevant positive examples, negative examples,
exceptions, and tests whenever applicable.

## Development

The project uses Deno 2 as its canonical development environment. Deno is not
required to consume the published packages: source code must remain portable to
the supported JavaScript runtimes and browsers unless a runtime-specific entry
point explicitly states otherwise.

## Pull requests

Work on a dedicated branch based on the current `main` and keep each pull
request focused on one task. Describe the checks you ran and any known
limitation. Add user-facing changes to the `Unreleased` section of
[`CHANGELOG.md`](CHANGELOG.md).

Integrations stay independent of the
[orthotypography engine](https://github.com/defense-humanites/orthotypography).
