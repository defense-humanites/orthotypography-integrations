# orthotypography-integrations

Integrations of
[`@orthotypography/core`](https://github.com/defense-humanites/orthotypography)
for tools across the JavaScript ecosystem.

## Packages

| Package                    | Status          | Purpose                                      |
| -------------------------- | --------------- | -------------------------------------------- |
| `@orthotypography/rehype`  | `0.1.0-alpha.1` | adapts the core to Unified and rehype        |
| `@orthotypography/satteri` | `0.1.0-alpha.1` | adapts the core to native Sätteri HAST hooks |
| `@orthotypography/astro`   | `0.1.0-alpha.1` | preserves and extends either Astro processor |

The repository is organized as a workspace. Deno provides the development
tooling; the published packages target the JavaScript ecosystem in general.

## Development

```sh
deno task check
deno task test
deno task npm:check
```

All adapters use the published `@orthotypography/core@0.1.0-alpha.0` directly.
Publication remains gated by the repository variable `PUBLISH_ENABLED`.
