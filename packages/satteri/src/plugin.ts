import {
  type RuleDiagnostic,
  runTextNodePipeline,
} from "@orthotypography/core";
import {
  defineHastPlugin,
  type HastNode,
  type HastPluginDefinition,
  type HastVisitorContext,
} from "satteri";
import type { SatteriOrthotypographyOptions } from "./model.ts";

declare module "satteri" {
  interface DataMap {
    orthotypographyDiagnostics?: readonly RuleDiagnostic[];
  }
}

const blockTags = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const excludedTags = new Set(["code", "pre", "script", "style"]);
const boundaryTypes = new Set(["comment", "doctype", "raw"]);

interface CollectedNode {
  readonly id: string;
  readonly node: Readonly<HastNode>;
  readonly value: string;
  readonly protected?: boolean;
}

function isElement(
  node: Readonly<HastNode>,
): node is Extract<HastNode, { type: "element" }> {
  return node.type === "element";
}

function childrenOf(node: Readonly<HastNode>): readonly Readonly<HastNode>[] {
  return "children" in node && Array.isArray(node.children)
    ? node.children as readonly Readonly<HastNode>[]
    : [];
}

function isBlock(node: Readonly<HastNode>): boolean {
  return isElement(node) && blockTags.has(node.tagName);
}

function isExcluded(
  node: Readonly<HastNode>,
  ancestors: readonly Readonly<HastNode>[],
  options: SatteriOrthotypographyOptions,
): boolean {
  return boundaryTypes.has(node.type) ||
    (isElement(node) && excludedTags.has(node.tagName)) ||
    (options.exclude?.(node, ancestors) ?? false);
}

function processRoot(
  root: Readonly<HastNode>,
  context: HastVisitorContext,
  options: SatteriOrthotypographyOptions,
): readonly RuleDiagnostic[] {
  const diagnostics: RuleDiagnostic[] = [];
  const runPipeline = options.runTextNodePipeline ?? runTextNodePipeline;

  const processContainer = (
    container: Readonly<HastNode>,
    path: readonly number[],
    ancestors: readonly Readonly<HastNode>[],
  ): void => {
    let run: CollectedNode[] = [];

    const flush = (): void => {
      if (run.length === 0) return;
      const result = runPipeline(
        run.map(({ id, value, protected: isProtected }) => ({
          id,
          value,
          ...(isProtected === undefined ? {} : { protected: isProtected }),
        })),
        options.rules,
        { locale: options.locale, mode: options.mode },
      );
      if (
        result.nodes.length !== run.length ||
        result.nodes.some((node, index) => node.id !== run[index].id)
      ) {
        throw new Error(
          "Pipeline must return exactly the source text nodes in source order",
        );
      }
      if (options.mode === "fix") {
        for (let index = 0; index < run.length; index++) {
          if (result.nodes[index].value !== run[index].value) {
            context.setProperty(
              run[index].node,
              "value",
              result.nodes[index].value,
            );
          }
        }
      }
      const nodesById = new Map(run.map(({ id, node }) => [id, node]));
      for (const diagnostic of result.diagnostics) {
        diagnostics.push(diagnostic);
        options.onDiagnostic?.(diagnostic);
        context.report({
          message: `${diagnostic.ruleId}: ${diagnostic.message}`,
          ...(diagnostic.segmentId === undefined
            ? {}
            : { node: nodesById.get(diagnostic.segmentId) }),
          severity: "warning",
        });
      }
      run = [];
    };

    const visit = (
      node: Readonly<HastNode>,
      nodePath: readonly number[],
      nodeAncestors: readonly Readonly<HastNode>[],
      inheritedProtection: boolean,
    ): void => {
      if (isExcluded(node, nodeAncestors, options)) {
        flush();
        return;
      }
      if (isBlock(node)) {
        flush();
        processContainer(node, nodePath, nodeAncestors);
        flush();
        return;
      }

      const protectedNode = inheritedProtection ||
        (options.protect?.(node, nodeAncestors) ?? false);
      if (node.type === "text" && node.value.length > 0) {
        run.push({
          id: nodePath.join("."),
          node,
          value: node.value,
          ...(protectedNode ? { protected: true } : {}),
        });
        return;
      }

      const children = childrenOf(node);
      for (let index = 0; index < children.length; index++) {
        visit(
          children[index],
          [...nodePath, index],
          [...nodeAncestors, node],
          protectedNode,
        );
      }
    };

    const children = childrenOf(container);
    for (let index = 0; index < children.length; index++) {
      visit(
        children[index],
        [...path, index],
        [...ancestors, container],
        false,
      );
    }
    flush();
  };

  processContainer(root, [], []);
  return diagnostics;
}

/** Creates a native Sätteri HAST plugin backed by orthotypography core. */
export function satteriOrthotypography(
  options: SatteriOrthotypographyOptions,
): HastPluginDefinition {
  if (options.mode !== "lint" && options.mode !== "fix") {
    throw new Error(
      "Sätteri orthotypography requires an explicit lint or fix mode",
    );
  }

  return defineHastPlugin({
    name: "@orthotypography/satteri",
    after(root, context) {
      context.data.orthotypographyDiagnostics = processRoot(
        root,
        context,
        options,
      );
    },
  });
}
