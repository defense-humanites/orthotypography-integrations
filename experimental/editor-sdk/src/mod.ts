import {
  applyTextChanges,
  type RuleDiagnostic,
  runTextNodePipeline,
  type RuntimeRule,
  type TextChange,
  type TextNodeInput,
  type TextNodeOutput,
} from "@orthotypography/core";

/** One logical text run; a paragraph or semantic boundary ends a run. */
export interface DocumentRun {
  readonly id: string;
  readonly locale: string;
  readonly nodes: readonly TextNodeInput[];
}

/** Adapter-owned revision must change for text, structure, or protection edits. */
export interface DocumentSnapshot {
  readonly documentId: string;
  readonly revision: string;
  readonly runs: readonly DocumentRun[];
}

/** Source diagnostics and the complete correction for one run. */
export interface PlannedRun {
  readonly id: string;
  readonly diagnostics: readonly RuleDiagnostic[];
  readonly changes: readonly TextChange[];
  readonly preview: readonly TextNodeOutput[];
}

/** Frozen, session-local plan created only by prepareDocumentPlan. */
export interface DocumentPlan {
  readonly source: DocumentSnapshot;
  readonly runs: readonly PlannedRun[];
}

/** Changes are ordered by descending segment index and UTF-16 source offset. */
export interface DocumentBatchRun {
  readonly id: string;
  readonly changes: readonly TextChange[];
}

/** All runs must be committed together against expectedRevision. */
export interface DocumentBatch {
  readonly documentId: string;
  readonly expectedRevision: string;
  readonly runs: readonly DocumentBatchRun[];
}

const plans = new WeakSet<DocumentPlan>();
const batches = new WeakMap<DocumentBatch, DocumentPlan>();

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function requireId(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${label}`);
  }
}

function copySnapshot(source: DocumentSnapshot): DocumentSnapshot {
  requireId(source.documentId, "document ID");
  requireId(source.revision, "document revision");
  const runIds = new Set<string>();
  return freeze({
    documentId: source.documentId,
    revision: source.revision,
    runs: source.runs.map((run) => {
      requireId(run.id, "run ID");
      requireId(run.locale, "run locale");
      if (runIds.has(run.id)) throw new Error(`Duplicate run ID: ${run.id}`);
      runIds.add(run.id);
      const nodeIds = new Set<string>();
      return {
        id: run.id,
        locale: run.locale,
        nodes: run.nodes.map((node) => {
          requireId(node.id, "node ID");
          if (nodeIds.has(node.id)) {
            throw new Error(`Duplicate node ID in run ${run.id}: ${node.id}`);
          }
          nodeIds.add(node.id);
          if (typeof node.value !== "string") {
            throw new Error(`Invalid node text in run ${run.id}`);
          }
          if (
            node.protected !== undefined && typeof node.protected !== "boolean"
          ) {
            throw new Error(`Invalid node protection in run ${run.id}`);
          }
          return {
            id: node.id,
            value: node.value,
            ...(node.protected === undefined
              ? {}
              : { protected: node.protected }),
          };
        }),
      };
    }),
  });
}

/** Runs lint and fix separately on a detached, immutable source snapshot. */
export function prepareDocumentPlan(
  source: DocumentSnapshot,
  rules: readonly RuntimeRule[],
): DocumentPlan {
  const snapshot = copySnapshot(source);
  const runs = snapshot.runs.map((run): PlannedRun => {
    const lint = runTextNodePipeline(run.nodes, rules, {
      locale: run.locale,
      mode: "lint",
    });
    const fix = runTextNodePipeline(run.nodes, rules, {
      locale: run.locale,
      mode: "fix",
    });
    // Validate the complete set before exposing a preview to an adapter.
    const applied = applyTextChanges(run.nodes, fix.changes);
    if (applied.some((node, index) => node.value !== fix.nodes[index]?.value)) {
      throw new Error(`Changes do not reproduce preview for run ${run.id}`);
    }
    return {
      id: run.id,
      diagnostics: lint.diagnostics,
      changes: fix.changes,
      preview: fix.nodes,
    };
  });
  const plan = freeze({ source: snapshot, runs });
  plans.add(plan);
  return plan;
}

/**
 * Validates the entire source and returns a complete batch without writing.
 * The adapter must recheck the revision inside its native atomic transaction.
 */
export function validateDocumentPlan(
  plan: DocumentPlan,
  current: DocumentSnapshot,
): DocumentBatch {
  if (!plans.has(plan)) {
    throw new Error(
      "Unknown document plan; prepare a new plan in this session",
    );
  }
  const snapshot = copySnapshot(current);
  if (snapshot.documentId !== plan.source.documentId) {
    throw new Error("Document ID does not match plan");
  }
  if (snapshot.revision !== plan.source.revision) {
    throw new Error("Stale document revision; prepare a new plan");
  }
  // Also catch adapter bugs that reuse a revision after a context change.
  // copySnapshot canonicalizes fields and retains run and node order.
  if (JSON.stringify(snapshot) !== JSON.stringify(plan.source)) {
    throw new Error("Document context changed; prepare a new plan");
  }
  const runs = plan.runs.map((run, index): DocumentBatchRun => {
    applyTextChanges(snapshot.runs[index].nodes, run.changes);
    return {
      id: run.id,
      changes: [...run.changes].sort((a, b) =>
        b.segmentIndex - a.segmentIndex || b.start - a.start || b.end - a.end
      ),
    };
  }).filter((run) => run.changes.length > 0);
  const batch = freeze({
    documentId: snapshot.documentId,
    expectedRevision: snapshot.revision,
    runs,
  });
  batches.set(batch, plan);
  return batch;
}

/** In-memory reference adapter; it does not model native formatting or undo. */
export interface MemoryDocument {
  /** Returns a detached-from-input, deeply frozen snapshot. */
  read(): DocumentSnapshot;
  /** Revalidates and commits a complete, original SDK batch synchronously. */
  commit(batch: DocumentBatch): DocumentSnapshot;
  /** Simulates an external edit, including structure and protection changes. */
  replaceRuns(
    expectedRevision: string,
    runs: readonly DocumentRun[],
  ): DocumentSnapshot;
}

/**
 * Owns a document for one adapter lifetime. Revisions are opaque and never reused.
 * All writes stage a complete snapshot before a single synchronous state swap.
 */
export function createMemoryDocument(
  initial: DocumentSnapshot,
): MemoryDocument {
  let current = copySnapshot(initial);
  const initialRevision = current.revision;
  let generation = 0n;

  function replace(
    expectedRevision: string,
    runs: readonly DocumentRun[],
  ): DocumentSnapshot {
    const before = current;
    if (before.revision !== expectedRevision) {
      throw new Error("Stale document revision; prepare a new plan");
    }
    const nextGeneration = generation + 1n;
    const next = copySnapshot({
      documentId: before.documentId,
      revision: `${initialRevision}:${nextGeneration}`,
      runs,
    });
    // Input accessors must not overwrite a reentrant external edit.
    if (current !== before) {
      throw new Error("Stale document revision; prepare a new plan");
    }
    generation = nextGeneration;
    current = next;
    return current;
  }

  return Object.freeze({
    read: () => current,
    commit(batch: DocumentBatch): DocumentSnapshot {
      const plan = batches.get(batch);
      if (!plan) {
        throw new Error(
          "Unknown document batch; validate a plan in this session",
        );
      }
      validateDocumentPlan(plan, current);
      if (batch.runs.length === 0) return current;
      const changes = new Map(batch.runs.map((run) => [run.id, run.changes]));
      const runs = current.runs.map((run) => ({
        ...run,
        nodes: applyTextChanges(run.nodes, changes.get(run.id) ?? []).map(
          (node, index) => ({ ...run.nodes[index], value: node.value }),
        ),
      }));
      return replace(batch.expectedRevision, runs);
    },
    replaceRuns: replace,
  });
}
