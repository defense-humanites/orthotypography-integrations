# `@orthotypography/rehype`

A rehype adapter that applies an orthotypographic engine to sequences of HAST
text nodes without changing the tree structure.

This is an alpha release. Its API may change before `1.0.0`.

## Installation

```sh
npm install @orthotypography/core@alpha @orthotypography/rehype@alpha
```

With Deno or another JSR client:

```sh
deno add jsr:@orthotypography/core@0.1.0-alpha.0 jsr:@orthotypography/rehype@0.1.0-alpha.0
```

## Usage

The package uses `@orthotypography/core` directly while keeping the adapter's
tree policy independently testable:

```ts
import { IMPRIMERIE_NATIONALE_RULES } from "@orthotypography/core";
import { rehypeOrthotypography } from "@orthotypography/rehype";

const plugin = rehypeOrthotypography({
  rules: IMPRIMERIE_NATIONALE_RULES,
  locale: "fr-FR",
  mode: "lint",
});
```

Modes are intentionally explicit: `lint` produces diagnostics associated with
their `segmentId`, while `fix` only replaces node values. Block elements, raw
HTML, and `code`, `pre`, `script`, and `style` form boundaries. The `exclude`
and `protect` predicates let an integration adjust this policy.
