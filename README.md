# orthotypography-integrations

Integrations of
[`@orthotypography/core`](https://github.com/defense-humanites/orthotypography)
for tools across the JavaScript ecosystem.

## Packages

| Package                   | Status              | Purpose                                             |
| ------------------------- | ------------------- | --------------------------------------------------- |
| `@orthotypography/rehype` | `0.1.0-alpha.0` ready | transforms and diagnoses HAST text nodes            |
| `@orthotypography/astro`  | `0.1.0-alpha.0` ready | configures Astro 7 on top of the rehype integration |

The repository is organized as a workspace. Deno provides the development
tooling; the published packages target the JavaScript ecosystem in general.

## Development

```sh
deno task check
deno task test
deno task npm:check
```

Both packages use the published `@orthotypography/core@0.1.0-alpha.0` directly.
Publication remains gated by the repository variable `PUBLISH_ENABLED`.
