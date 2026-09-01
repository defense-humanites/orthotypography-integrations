/** Minimal HAST shape consumed without taking ownership of the tree model. */
export interface HastNode {
  readonly type: string;
  readonly tagName?: string;
  readonly children?: HastNode[];
  value?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface HastRoot extends HastNode {
  readonly type: "root";
  readonly children: HastNode[];
}

export interface VFileLike {
  data: Record<string, unknown>;
}

export interface AdapterTextNodeInput {
  readonly id: string;
  readonly value: string;
  readonly protected?: boolean;
}

export interface AdapterTextNodeOutput {
  readonly id: string;
  readonly value: string;
  readonly protected?: boolean;
}

export interface AdapterDiagnosticLocation {
  readonly coordinateSpace: "source" | "runtime";
  readonly segmentIndex: number;
  readonly segmentId?: string;
  readonly segmentValue: string;
  readonly segmentRevision: number;
  readonly start: number;
  readonly end: number;
}

export interface AdapterDiagnostic extends AdapterDiagnosticLocation {
  readonly ruleId: string;
  readonly message: string;
  readonly replacement?: string;
  readonly related?: readonly AdapterDiagnosticLocation[];
}

export interface AdapterPipelineResult {
  readonly value: string;
  readonly nodes: readonly AdapterTextNodeOutput[];
  readonly diagnostics: readonly AdapterDiagnostic[];
  readonly appliedRuleIds: readonly string[];
}

/** Structural contract implemented by core's `runTextNodePipeline`. */
export type TextNodePipelineRunner = (
  nodes: readonly AdapterTextNodeInput[],
  rules: readonly RuntimeRule[],
  options: { readonly locale: string; readonly mode: "lint" | "fix" },
) => AdapterPipelineResult;

export type NodePredicate = (
  node: HastNode,
  ancestors: readonly HastNode[],
) => boolean;

export interface RehypeOrthotypographyOptions {
  /** Optional structural override; core's runner is used by default. */
  readonly runTextNodePipeline?: TextNodePipelineRunner;
  readonly rules: readonly RuntimeRule[];
  readonly locale: string;
  readonly mode: "lint" | "fix";
  /** Additional subtree exclusions. Excluded content is a run boundary. */
  readonly exclude?: NodePredicate;
  /** Known immutable content that remains part of the logical text run. */
  readonly protect?: NodePredicate;
  /** Receives source diagnostics after every logical run. */
  readonly onDiagnostic?: (diagnostic: AdapterDiagnostic) => void;
}
import type { RuntimeRule } from "@orthotypography/core";
