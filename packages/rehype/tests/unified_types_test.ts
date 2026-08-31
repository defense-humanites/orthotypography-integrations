import assert from "node:assert/strict";
import type { Root } from "@types/hast";
import { unified } from "unified";
import {
  rehypeOrthotypography,
  type TextNodePipelineRunner,
} from "../src/mod.ts";

const runner: TextNodePipelineRunner<string> = (nodes) => ({
  value: nodes.map(({ value }) => value).join(""),
  nodes,
  diagnostics: [],
  appliedRuleIds: [],
});

Deno.test("plugin signature is accepted by unified for a HAST root", async () => {
  const processor = unified().use(rehypeOrthotypography, {
    runTextNodePipeline: runner,
    rules: ["test"],
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
