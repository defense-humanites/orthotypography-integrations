# orthotypography-integrations

Integrations of
[`@orthotypography/core`](https://github.com/defense-humanites/orthotypography)
for tools across the JavaScript ecosystem.

## Packages

| Package                       | Status          | Purpose                                      |
| ----------------------------- | --------------- | -------------------------------------------- |
| `@orthotypography/rehype`     | `0.1.0-alpha.1` | adapts the core to Unified and rehype        |
| `@orthotypography/satteri`    | `0.1.0-alpha.1` | adapts the core to native Sätteri HAST hooks |
| `@orthotypography/astro`      | `0.1.0-alpha.1` | preserves and extends either Astro processor |
| `@orthotypography/editor-sdk` | `0.1.0-alpha.0` | prepares guarded native editor transactions  |

The repository is organized as a workspace. Deno provides the development
tooling; the published packages target the JavaScript ecosystem in general.

## Development

```sh
deno task check
deno task test
deno task npm:check
```

The three content adapters use `@orthotypography/core@0.1.0-alpha.1` directly.
The independently versioned editor SDK uses core `0.1.0-alpha.2`. Publication
remains gated by the repository variable `PUBLISH_ENABLED`.

## Document editor SDK

[`packages/editor-sdk`](packages/editor-sdk/README.md) prepares immutable
document correction plans and validates revisions and source context before
native editor transactions. Its Google Docs subpath adds extraction, guarded
review and an authentication-neutral REST transport.

```sh
deno task editor:check
deno task editor:test
```
