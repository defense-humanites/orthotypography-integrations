# `@orthotypography/astro`

An Astro integration that applies `@orthotypography/rehype` to Markdown and MDX
documents rendered with the Unified processor.

```ts
import {
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "@orthotypography/core";
import orthotypography from "@orthotypography/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    orthotypography({
      runTextNodePipeline,
      rules: IMPRIMERIE_NATIONALE_RULES,
      locale: "fr-FR",
      mode: "lint",
    }),
  ],
});
```

The integration explicitly selects Astro's Unified processor, which is required
to run a rehype plugin. The `processorOptions` option can preserve other remark
or rehype plugins; any rehype plugins it contains run before orthotypography.

The official MDX integration inherits the Markdown configuration by default. If
`extendMarkdownConfig` is disabled or MDX receives its own processor, the
configuration must be reproduced there explicitly.

Modes remain required. `lint` collects diagnostics without modifying content;
`fix` only replaces text-node values allowed by the rehype adapter.
