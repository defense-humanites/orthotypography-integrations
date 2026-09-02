import assert from "node:assert/strict";
import {
  HIGH_PUNCTUATION_RULES,
  SAFE_PUNCTUATION_RULES,
} from "@orthotypography/core";
import { markdownToHtml } from "satteri";
import { satteriOrthotypography } from "../src/mod.ts";

Deno.test("native Sätteri plugin fixes text across inline nodes", async () => {
  const result = await markdownToHtml("Bonjour , *monde* !", {
    features: { smartPunctuation: false },
    hastPlugins: [
      satteriOrthotypography({
        rules: [...SAFE_PUNCTUATION_RULES, ...HIGH_PUNCTUATION_RULES],
        locale: "fr-FR",
        mode: "fix",
      }),
    ],
  });

  assert.equal(result.html.trim(), "<p>Bonjour, <em>monde</em> !</p>");
});

Deno.test("native Sätteri plugin preserves excluded code", async () => {
  const result = await markdownToHtml("Bonjour , `code , test`.", {
    features: { smartPunctuation: false },
    hastPlugins: [
      satteriOrthotypography({
        rules: SAFE_PUNCTUATION_RULES,
        locale: "fr-FR",
        mode: "fix",
      }),
    ],
  });

  assert.equal(
    result.html.trim(),
    "<p>Bonjour, <code>code , test</code>.</p>",
  );
});

Deno.test("native Sätteri plugin exposes lint diagnostics", async () => {
  const observed: unknown[] = [];
  const result = await markdownToHtml("Bonjour , monde.", {
    features: { smartPunctuation: false },
    hastPlugins: [
      satteriOrthotypography({
        rules: SAFE_PUNCTUATION_RULES,
        locale: "fr-FR",
        mode: "lint",
        onDiagnostic(diagnostic) {
          observed.push(diagnostic);
        },
      }),
    ],
  });

  assert.equal(result.html.trim(), "<p>Bonjour , monde.</p>");
  assert.equal(observed.length, 1);
  assert.equal(result.data.orthotypographyDiagnostics?.length, 1);
});
