# `@orthotypography/satteri`

A native Sätteri HAST plugin that applies source-backed orthotypographic rules
without switching an Astro 7 project to Unified.

This is an alpha release. Its API may change before `1.0.0`.

## Installation

```sh
npm install @orthotypography/core@alpha @orthotypography/satteri@alpha satteri
```

With Deno or another JSR client:

```sh
deno add jsr:@orthotypography/core@0.1.0-alpha.1 jsr:@orthotypography/satteri@0.1.0-alpha.1 npm:satteri@0.10.5
```

## Usage

```ts
import { IMPRIMERIE_NATIONALE_RULES } from "@orthotypography/core";
import { satteriOrthotypography } from "@orthotypography/satteri";
import { markdownToHtml } from "satteri";

const result = await markdownToHtml("Bonjour !", {
  hastPlugins: [
    satteriOrthotypography({
      rules: IMPRIMERIE_NATIONALE_RULES,
      locale: "fr-FR",
      mode: "fix",
    }),
  ],
});
```

The plugin processes logical text runs across inline HAST nodes while preserving
block boundaries, raw HTML, and `code`, `pre`, `script`, and `style` elements.
Diagnostics are passed to `onDiagnostic`, reported through Sätteri, and stored
in `result.data.orthotypographyDiagnostics` for direct Sätteri consumers.
Source-coordinate fixes are passed to `onChange` and stored in
`result.data.orthotypographyChanges`.
