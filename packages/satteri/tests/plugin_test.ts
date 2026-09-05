import assert from "node:assert/strict";
import {
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  SAFE_PUNCTUATION_RULES,
  type TextChange,
} from "@orthotypography/core";
import { markdownToHtml } from "satteri";
import { satteriOrthotypography } from "../src/mod.ts";

Deno.test("native Sätteri plugin fixes text in inline descendants", async () => {
  const result = await markdownToHtml("Bonjour , *monde !*", {
    features: { smartPunctuation: false },
    hastPlugins: [
      satteriOrthotypography({
        rules: IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
        locale: "fr-FR",
        mode: "fix",
      }),
    ],
  });

  assert.equal(result.html.trim(), "<p>Bonjour, <em>monde !</em></p>");
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
  const diagnostics = result.data["orthotypographyDiagnostics"] as
    | readonly unknown[]
    | undefined;
  assert.equal(diagnostics?.length, 1);
});

Deno.test("native Sätteri plugin exposes source-coordinate changes", async () => {
  const observed: TextChange[] = [];
  const result = await markdownToHtml("Bonjour , monde.", {
    features: { smartPunctuation: false },
    hastPlugins: [
      satteriOrthotypography({
        rules: SAFE_PUNCTUATION_RULES,
        locale: "fr-FR",
        mode: "fix",
        onChange(change) {
          observed.push(change);
        },
      }),
    ],
  });

  assert.equal(result.html.trim(), "<p>Bonjour, monde.</p>");
  assert.equal(observed.length, 1);
  assert.equal(observed[0].expected, " ,");
  assert.deepEqual(result.data["orthotypographyChanges"], observed);
});
