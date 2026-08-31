import assert from "node:assert/strict";
import { isUnifiedProcessor, type unified } from "@astrojs/markdown-remark";
import type { AstroIntegration } from "astro";
import orthotypography, {
  type AstroOrthotypographyOptions,
} from "../src/mod.ts";

const runner: AstroOrthotypographyOptions<string>["runTextNodePipeline"] = (
  nodes,
) => ({
  value: nodes.map(({ value }) => value).join(""),
  nodes,
  diagnostics: [],
  appliedRuleIds: [],
});

function setup(integration: AstroIntegration): Record<string, unknown> {
  let update: Record<string, unknown> | undefined;
  const hook = integration.hooks["astro:config:setup"];
  assert.equal(typeof hook, "function");
  hook!({
    updateConfig(value: Record<string, unknown>) {
      update = value as Record<string, unknown>;
      return value as never;
    },
  } as never);
  if (update === undefined) {
    throw new Error("Astro integration did not update the configuration");
  }
  return update;
}

Deno.test("Astro integration selects Unified and appends the rehype adapter", () => {
  const previousPlugin = () => undefined;
  const integration = orthotypography({
    runTextNodePipeline: runner,
    rules: ["test"],
    locale: "fr-FR",
    mode: "lint",
    processorOptions: {
      gfm: false,
      rehypePlugins: [previousPlugin],
    },
  });

  assert.equal(integration.name, "@orthotypography/astro");
  const update = setup(integration);
  const processor = (update.markdown as {
    processor: ReturnType<typeof unified>;
  }).processor;

  assert.ok(isUnifiedProcessor(processor));
  assert.equal(processor.options.gfm, false);
  assert.equal(processor.options.rehypePlugins.length, 2);
  assert.equal(processor.options.rehypePlugins[0], previousPlugin);
  const addedPlugin = processor.options.rehypePlugins[1];
  assert.ok(Array.isArray(addedPlugin));
  assert.equal(typeof addedPlugin[0], "function");
  assert.equal(
    (addedPlugin[0] as { readonly name: string }).name,
    "rehypeOrthotypography",
  );
});

Deno.test("each integration owns an isolated processor configuration", () => {
  const options = {
    runTextNodePipeline: runner,
    rules: ["test"],
    locale: "fr-FR",
    mode: "fix",
  } satisfies AstroOrthotypographyOptions<string>;

  const first = (setup(orthotypography(options)).markdown as {
    processor: { options: { rehypePlugins: unknown[] } };
  }).processor;
  const second = (setup(orthotypography(options)).markdown as {
    processor: { options: { rehypePlugins: unknown[] } };
  }).processor;

  assert.notEqual(first, second);
  assert.notEqual(first.options.rehypePlugins, second.options.rehypePlugins);
  assert.equal(first.options.rehypePlugins.length, 1);
  assert.equal(second.options.rehypePlugins.length, 1);
});
