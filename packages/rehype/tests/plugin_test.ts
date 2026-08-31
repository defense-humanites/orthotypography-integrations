import assert from "node:assert/strict";
import {
  type AdapterDiagnostic,
  type AdapterPipelineResult,
  type AdapterTextNodeInput,
  type HastRoot,
  rehypeOrthotypography,
  type TextNodePipelineRunner,
} from "../src/mod.ts";

function fixRunner(
  calls: AdapterTextNodeInput[][],
): TextNodePipelineRunner<string> {
  return (nodes, _rules, options): AdapterPipelineResult => {
    calls.push(nodes.map((node) => ({ ...node })));
    return {
      value: nodes.map(({ value }) => value).join(""),
      nodes: nodes.map((node) => ({
        ...node,
        value: options.mode === "fix"
          ? node.value.replace("«", "«\u00a0").replace("»", "\u00a0»")
          : node.value,
      })),
      diagnostics: [],
      appliedRuleIds: ["test"],
    };
  };
}

Deno.test("inline descendants form one logical text run", () => {
  const calls: AdapterTextNodeInput[][] = [];
  const tree: HastRoot = {
    type: "root",
    children: [{
      type: "element",
      tagName: "p",
      children: [
        { type: "text", value: "«bonjour " },
        {
          type: "element",
          tagName: "em",
          children: [{ type: "text", value: "monde" }],
        },
        { type: "text", value: "»" },
      ],
    }],
  };

  rehypeOrthotypography({
    runTextNodePipeline: fixRunner(calls),
    rules: ["test"],
    locale: "fr-FR",
    mode: "fix",
  })(tree);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map(({ id }) => id), ["0.0", "0.1.0", "0.2"]);
  assert.equal(tree.children[0].children?.[0].value, "«\u00a0bonjour ");
  assert.equal(tree.children[0].children?.[1].children?.[0].value, "monde");
  assert.equal(tree.children[0].children?.[2].value, "\u00a0»");
});

Deno.test("block and excluded subtrees are logical run boundaries", () => {
  const calls: AdapterTextNodeInput[][] = [];
  const tree: HastRoot = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        children: [
          { type: "text", value: "avant" },
          {
            type: "element",
            tagName: "code",
            children: [{ type: "text", value: "intouchable" }],
          },
          { type: "text", value: "après" },
        ],
      },
      {
        type: "element",
        tagName: "p",
        children: [{ type: "text", value: "autre bloc" }],
      },
    ],
  };

  rehypeOrthotypography({
    runTextNodePipeline: fixRunner(calls),
    rules: ["test"],
    locale: "fr-FR",
    mode: "fix",
  })(tree);

  assert.deepEqual(
    calls.map((run) => run.map(({ value }) => value)),
    [["avant"], ["après"], ["autre bloc"]],
  );
});

Deno.test("protected inline content stays inside its logical run", () => {
  const calls: AdapterTextNodeInput[][] = [];
  const tree: HastRoot = {
    type: "root",
    children: [{
      type: "element",
      tagName: "p",
      children: [
        { type: "text", value: "«Version " },
        {
          type: "element",
          tagName: "span",
          data: { immutable: true },
          children: [{ type: "text", value: "1.2.3" }],
        },
        { type: "text", value: "»" },
      ],
    }],
  };

  rehypeOrthotypography({
    runTextNodePipeline: fixRunner(calls),
    rules: ["test"],
    locale: "fr-FR",
    mode: "fix",
    protect: (node) => node.data?.immutable === true,
  })(tree);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map(({ protected: value }) => value), [
    undefined,
    true,
    undefined,
  ]);
});

Deno.test("lint diagnostics are reported without mutating the tree", () => {
  const diagnostic: AdapterDiagnostic = {
    coordinateSpace: "source",
    segmentIndex: 0,
    segmentId: "0.0",
    segmentValue: "texte",
    segmentRevision: 0,
    start: 0,
    end: 1,
    ruleId: "test",
    message: "test diagnostic",
  };
  const runner: TextNodePipelineRunner<string> = (nodes) => ({
    value: nodes.map(({ value }) => value).join(""),
    nodes,
    diagnostics: [diagnostic],
    appliedRuleIds: ["test"],
  });
  const tree: HastRoot = {
    type: "root",
    children: [{ type: "text", value: "texte" }],
  };
  const file = { data: {} as Record<string, unknown> };
  const reported: AdapterDiagnostic[] = [];

  rehypeOrthotypography({
    runTextNodePipeline: runner,
    rules: ["test"],
    locale: "fr-FR",
    mode: "lint",
    onDiagnostic: (value) => reported.push(value),
  })(tree, file);

  assert.equal(tree.children[0].value, "texte");
  assert.deepEqual(reported, [diagnostic]);
  assert.deepEqual(file.data.orthotypographyDiagnostics, [diagnostic]);
});

Deno.test("adapter rejects reordered pipeline output", () => {
  const runner: TextNodePipelineRunner<string> = (nodes) => ({
    value: nodes.map(({ value }) => value).join(""),
    nodes: [...nodes].reverse(),
    diagnostics: [],
    appliedRuleIds: [],
  });
  const tree: HastRoot = {
    type: "root",
    children: [
      { type: "text", value: "premier" },
      { type: "text", value: "second" },
    ],
  };

  assert.throws(
    () =>
      rehypeOrthotypography({
        runTextNodePipeline: runner,
        rules: ["test"],
        locale: "fr-FR",
        mode: "fix",
      })(tree),
    Error,
    "exactly the source text nodes in source order",
  );
});
