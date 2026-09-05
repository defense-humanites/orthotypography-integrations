import assert from "node:assert/strict";
import {
  FRENCH_GUILLEMETS_SPACING_RULE,
  IMPRIMERIE_NATIONALE_PUNCTUATION_RULES,
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "@orthotypography/core";
import {
  type DocumentSnapshot,
  prepareDocumentPlan,
  validateDocumentPlan,
} from "../src/mod.ts";

function source(): DocumentSnapshot {
  return {
    documentId: "document",
    revision: "revision-1",
    runs: [{
      id: "paragraph",
      locale: "fr-FR",
      nodes: [
        { id: "emphasis", value: "Bonjour " },
        { id: "plain", value: ":suite" },
      ],
    }],
  };
}

const rules = IMPRIMERIE_NATIONALE_PUNCTUATION_RULES;

Deno.test("plan separates source lint from fixes and preserves inline nodes", () => {
  const snapshot = source();
  const original = structuredClone(snapshot);
  const plan = prepareDocumentPlan(snapshot, rules);
  assert.deepEqual(snapshot, original);
  assert.deepEqual(plan.runs[0].preview, [
    { id: "emphasis", value: "Bonjour" },
    { id: "plain", value: "\u00a0: suite" },
  ]);
  assert.ok(plan.runs[0].diagnostics.length > 0);
  assert.ok(
    plan.runs[0].diagnostics.every((d) => d.coordinateSpace === "source"),
  );
  assert.ok(
    plan.runs[0].diagnostics.some((d) =>
      d.related?.some((location) => location.segmentId === "emphasis")
    ),
  );
});

Deno.test("batch reproduces preview with native descending replacements", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  const batch = validateDocumentPlan(plan, snapshot);
  assert.equal(batch.expectedRevision, "revision-1");
  assert.equal(batch.documentId, "document");
  const values = snapshot.runs[0].nodes.map((node) => node.value);
  for (const edit of batch.runs[0].changes) {
    assert.equal(
      values[edit.segmentIndex].slice(edit.start, edit.end),
      edit.expected,
    );
    values[edit.segmentIndex] = values[edit.segmentIndex].slice(0, edit.start) +
      edit.replacement + values[edit.segmentIndex].slice(edit.end);
  }
  assert.deepEqual(values, plan.runs[0].preview.map((node) => node.value));
  for (let index = 1; index < batch.runs[0].changes.length; index++) {
    assert.ok(
      batch.runs[0].changes[index - 1].segmentIndex >=
        batch.runs[0].changes[index].segmentIndex,
    );
  }
});

Deno.test("source and plan are detached and deeply immutable", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  assert.notEqual(plan.source, snapshot);
  assert.notEqual(plan.source.runs[0].nodes, snapshot.runs[0].nodes);
  assert.equal(Object.isFrozen(snapshot), false);
  assert.ok(Object.isFrozen(plan.source.runs[0].nodes[0]));
  assert.ok(Object.isFrozen(plan.runs[0].changes[0].ruleIds));
  assert.ok(Object.isFrozen(plan.runs[0].diagnostics[0]));
  assert.throws(
    () => Object.assign(plan.source.runs[0].nodes[0], { value: "edit" }),
    TypeError,
  );
  Object.assign(snapshot.runs[0].nodes[0], { value: "Changed " });
  assert.equal(plan.source.runs[0].nodes[0].value, "Bonjour ");
  assert.throws(() => validateDocumentPlan(plan, snapshot), /context changed/);
});

Deno.test("rejects different document identity and newer revisions", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  assert.throws(
    () => validateDocumentPlan(plan, { ...snapshot, documentId: "other" }),
    /Document ID/,
  );
  assert.throws(
    () => validateDocumentPlan(plan, { ...snapshot, revision: "revision-2" }),
    /Stale document revision/,
  );
});

Deno.test("rejects context edits even when expected substrings still match", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  const current = structuredClone(snapshot);
  Object.assign(current.runs[0].nodes[0], { value: "Bonsoir " });
  // Equal length and identical trailing space: individual expected guards pass.
  for (const edit of plan.runs[0].changes) {
    assert.equal(
      current.runs[0].nodes[edit.segmentIndex].value.slice(
        edit.start,
        edit.end,
      ),
      edit.expected,
    );
  }
  assert.throws(() => validateDocumentPlan(plan, current), /context changed/);
});

Deno.test("rejects changed identity, order, locale, protection and boundaries", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  const run = snapshot.runs[0];
  for (
    const replacement of [
      { ...run, id: "other" },
      { ...run, locale: "en-US" },
      { ...run, nodes: [...run.nodes].reverse() },
      { ...run, nodes: [{ ...run.nodes[0], id: "new" }, run.nodes[1]] },
      { ...run, nodes: [{ ...run.nodes[0], protected: true }, run.nodes[1]] },
      { ...run, nodes: [run.nodes[0]] },
    ]
  ) {
    assert.throws(
      () => validateDocumentPlan(plan, { ...snapshot, runs: [replacement] }),
      /context changed/,
    );
  }
  assert.throws(
    () => validateDocumentPlan(plan, { ...snapshot, runs: [] }),
    /context changed/,
  );
});

Deno.test("rejects duplicate and missing identities before analysis", () => {
  const snapshot = source();
  const run = snapshot.runs[0];
  for (
    const invalid of [
      { ...snapshot, documentId: "" },
      { ...snapshot, revision: " " },
      { ...snapshot, runs: [run, run] },
      { ...snapshot, runs: [{ ...run, id: "" }] },
      { ...snapshot, runs: [{ ...run, locale: "" }] },
      { ...snapshot, runs: [{ ...run, nodes: [run.nodes[0], run.nodes[0]] }] },
      { ...snapshot, runs: [{ ...run, nodes: [{ id: "", value: "text" }] }] },
    ]
  ) {
    assert.throws(
      () => prepareDocumentPlan(invalid, rules),
      /Missing|Duplicate/,
    );
  }
});

Deno.test("plans cannot be forged, cloned, filtered or deserialized", () => {
  const snapshot = source();
  const plan = prepareDocumentPlan(snapshot, rules);
  for (
    const altered of [
      { ...plan, runs: [] },
      structuredClone(plan),
      JSON.parse(JSON.stringify(plan)),
    ]
  ) {
    assert.throws(
      () => validateDocumentPlan(altered, snapshot),
      /Unknown document plan/,
    );
  }
});

Deno.test("protected nodes retain text and participate in quote context", () => {
  const snapshot: DocumentSnapshot = {
    ...source(),
    runs: [{
      id: "quote",
      locale: "fr-FR",
      nodes: [
        { id: "opening", value: "«Version " },
        { id: "code", value: "1.2.3", protected: true },
        { id: "closing", value: "»" },
      ],
    }],
  };
  const plan = prepareDocumentPlan(snapshot, [FRENCH_GUILLEMETS_SPACING_RULE]);
  assert.deepEqual(plan.runs[0].preview.map((n) => n.value), [
    "«\u00a0Version ",
    "1.2.3",
    "\u00a0»",
  ]);
  assert.ok(plan.runs[0].changes.every((c) => c.segmentId !== "code"));
  assert.equal(validateDocumentPlan(plan, snapshot).runs.length, 1);
});

Deno.test("separate runs never share quote context and node IDs are run scoped", () => {
  const snapshot: DocumentSnapshot = {
    ...source(),
    runs: [
      { id: "one", locale: "fr-FR", nodes: [{ id: "text", value: "«texte" }] },
      { id: "two", locale: "fr-FR", nodes: [{ id: "text", value: "»" }] },
    ],
  };
  const quoteRules = [FRENCH_GUILLEMETS_SPACING_RULE];
  const plan = prepareDocumentPlan(snapshot, quoteRules);
  for (const [index, run] of snapshot.runs.entries()) {
    const isolated = runTextNodePipeline(run.nodes, quoteRules, {
      locale: run.locale,
      mode: "fix",
    });
    assert.deepEqual(plan.runs[index].preview, isolated.nodes);
    assert.deepEqual(plan.runs[index].changes, isolated.changes);
  }
});

Deno.test("UTF-16 edits preserve astral characters and classifier protections", () => {
  const snapshot: DocumentSnapshot = {
    ...source(),
    runs: [{
      id: "p",
      locale: "fr-FR",
      nodes: [{ id: "n", value: "😀 Version 1.2.3 : 25%. Bonjour , monde." }],
    }],
  };
  const plan = prepareDocumentPlan(snapshot, IMPRIMERIE_NATIONALE_RULES);
  let value = snapshot.runs[0].nodes[0].value;
  for (const edit of validateDocumentPlan(plan, snapshot).runs[0].changes) {
    assert.equal(value.slice(edit.start, edit.end), edit.expected);
    value = value.slice(0, edit.start) + edit.replacement +
      value.slice(edit.end);
  }
  assert.equal(value, plan.runs[0].preview[0].value);
  assert.ok(value.startsWith("😀 Version 1.2.3"));
});

Deno.test("empty and unchanged documents produce no native operations", () => {
  for (
    const runs of [[], [{ id: "empty", locale: "fr-FR", nodes: [] }], [{
      id: "plain",
      locale: "fr-FR",
      nodes: [{ id: "n", value: "Bonjour." }],
    }]]
  ) {
    const snapshot = { ...source(), runs };
    const plan = prepareDocumentPlan(snapshot, rules);
    assert.deepEqual(validateDocumentPlan(plan, snapshot).runs, []);
  }
});

Deno.test("a changed untouched run invalidates the entire batch", () => {
  const snapshot = {
    ...source(),
    runs: [...source().runs, {
      id: "other",
      locale: "fr-FR",
      nodes: [{ id: "n", value: "Bonjour." }],
    }],
  };
  const plan = prepareDocumentPlan(snapshot, rules);
  assert.equal(validateDocumentPlan(plan, snapshot).runs.length, 1);
  const current = structuredClone(snapshot);
  Object.assign(current.runs[1].nodes[0], { value: "Bonsoir." });
  assert.throws(() => validateDocumentPlan(plan, current), /context changed/);
});
