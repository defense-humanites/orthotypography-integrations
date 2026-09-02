import type {
  RuleDiagnostic,
  RuntimeRule,
  runTextNodePipeline,
} from "@orthotypography/core";
import type { HastNode } from "satteri";

export type SatteriNodePredicate = (
  node: Readonly<HastNode>,
  ancestors: readonly Readonly<HastNode>[],
) => boolean;

export interface SatteriOrthotypographyOptions {
  /** Optional structural override; core's runner is used by default. */
  readonly runTextNodePipeline?: typeof runTextNodePipeline;
  readonly rules: readonly RuntimeRule[];
  readonly locale: string;
  readonly mode: "lint" | "fix";
  /** Additional subtree exclusions. Excluded content is a run boundary. */
  readonly exclude?: SatteriNodePredicate;
  /** Known immutable content that remains part of the logical text run. */
  readonly protect?: SatteriNodePredicate;
  /** Receives source diagnostics while the document is compiled. */
  readonly onDiagnostic?: (diagnostic: RuleDiagnostic) => void;
}
