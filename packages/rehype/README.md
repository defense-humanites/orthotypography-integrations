# `@orthotypography/rehype`

A rehype adapter that applies an orthotypographic engine to sequences of HAST
text nodes without changing the tree structure.

The package is in prerelease. Until a version of `@orthotypography/core` is
published, the engine must be supplied explicitly:

```ts
import {
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "@orthotypography/core";
import { rehypeOrthotypography } from "@orthotypography/rehype";

const plugin = rehypeOrthotypography({
  runTextNodePipeline,
  rules: IMPRIMERIE_NATIONALE_RULES,
  locale: "fr-FR",
  mode: "lint",
});
```

Modes are intentionally explicit: `lint` produces diagnostics associated with
their `segmentId`, while `fix` only replaces node values. Block elements, raw
HTML, and `code`, `pre`, `script`, and `style` form boundaries. The `exclude`
and `protect` predicates let an integration adjust this policy.
