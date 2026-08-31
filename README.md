# orthotypography-integrations

Integrations of
[`@orthotypography/core`](https://github.com/defense-humanites/orthotypography)
for tools across the JavaScript ecosystem.

## Packages

| Package                   | Status            | Purpose                                             |
| ------------------------- | ----------------- | --------------------------------------------------- |
| `@orthotypography/rehype` | unpublished alpha | transforms and diagnoses HAST text nodes            |
| `@orthotypography/astro`  | unpublished alpha | configures Astro 7 on top of the rehype integration |

The repository is organized as a workspace. Deno provides the development
tooling; the published packages target the JavaScript ecosystem in general.

## Development

```sh
deno task check
deno task test
deno task npm:check
```

JSR and npm publication remains disabled until the first version of the core
package is published.
