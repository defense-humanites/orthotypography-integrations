import assert from "node:assert/strict";
import type { RuntimeRule } from "@orthotypography/core";
import type { Root } from "hast";
import { unified } from "unified";
import {
  rehypeOrthotypography,
  type TextNodePipelineRunner,
} from "../src/mod.ts";

const runner: TextNodePipelineRunner = (nodes) => ({
  value: nodes.map(({ value }) => value).join(""),
  nodes,
  diagnostics: [],
  appliedRuleIds: [],
});
const testRule = {} as RuntimeRule;

Deno.test("plugin signature is accepted by unified for a HAST root", async () => {
  const processor = unified().use(rehypeOrthotypography, {
    runTextNodePipeline: runner,
    rules: [testRule],
    locale: "fr-FR",
    mode: "lint",
  });
  const tree: Root = {
    type: "root",
    children: [{ type: "text", value: "texte" }],
  };

  const result = await processor.run(tree);
  assert.equal(result, tree);
});
