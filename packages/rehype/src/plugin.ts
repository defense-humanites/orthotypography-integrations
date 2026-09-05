import { runTextNodePipeline as runCoreTextNodePipeline } from "@orthotypography/core";
import type {
  AdapterDiagnostic,
  AdapterTextNodeInput,
  HastNode,
  HastRoot,
  RehypeOrthotypographyOptions,
  VFileLike,
} from "./model.ts";
import type { TextChange } from "@orthotypography/core";

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
  readonly node: HastNode;
  readonly input: AdapterTextNodeInput;
}

function isElement(node: HastNode): boolean {
  return node.type === "element" && typeof node.tagName === "string";
}

function isBlock(node: HastNode): boolean {
  return isElement(node) && blockTags.has(node.tagName as string);
}

function isExcluded(
  node: HastNode,
  ancestors: readonly HastNode[],
  options: { readonly exclude?: RehypeOrthotypographyOptions["exclude"] },
): boolean {
  return boundaryTypes.has(node.type) ||
    (isElement(node) && excludedTags.has(node.tagName as string)) ||
    (options.exclude?.(node, ancestors) ?? false);
}

/** Creates a rehype-compatible transformer without importing unified at runtime. */
export function rehypeOrthotypography(
  options: RehypeOrthotypographyOptions,
): (tree: HastRoot, file?: VFileLike) => void {
  if (options.mode !== "lint" && options.mode !== "fix") {
    throw new Error(
      "rehype orthotypography requires an explicit lint or fix mode",
    );
  }

  return (tree, file): void => {
    const diagnostics: AdapterDiagnostic[] = [];
    const changes: TextChange[] = [];
    const runTextNodePipeline = options.runTextNodePipeline ??
      runCoreTextNodePipeline;

    const processContainer = (
      container: HastNode,
      path: readonly number[],
      ancestors: readonly HastNode[],
    ): void => {
      let run: CollectedNode[] = [];

      const flush = (): void => {
        if (run.length === 0) return;
        const result = runTextNodePipeline(
          run.map(({ input }) => input),
          options.rules,
          { locale: options.locale, mode: options.mode },
        );
        if (
          result.nodes.length !== run.length ||
          result.nodes.some((node, index) => node.id !== run[index].input.id)
        ) {
          throw new Error(
            "Pipeline must return exactly the source text nodes in source order",
          );
        }
        if (options.mode === "fix") {
          for (let index = 0; index < run.length; index++) {
            run[index].node.value = result.nodes[index].value;
          }
        }
        for (const diagnostic of result.diagnostics) {
          diagnostics.push(diagnostic);
          options.onDiagnostic?.(diagnostic);
        }
        for (const change of result.changes) {
          changes.push(change);
          options.onChange?.(change);
        }
        run = [];
      };

      const visit = (
        node: HastNode,
        nodePath: readonly number[],
        nodeAncestors: readonly HastNode[],
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
        if (node.type === "text" && typeof node.value === "string") {
          if (node.value.length > 0) {
            run.push({
              node,
              input: {
                id: nodePath.join("."),
                value: node.value,
                ...(protectedNode ? { protected: true } : {}),
              },
            });
          }
          return;
        }

        for (let index = 0; index < (node.children?.length ?? 0); index++) {
          visit(
            node.children![index],
            [...nodePath, index],
            [...nodeAncestors, node],
            protectedNode,
          );
        }
      };

      for (let index = 0; index < (container.children?.length ?? 0); index++) {
        visit(
          container.children![index],
          [...path, index],
          [...ancestors, container],
          false,
        );
      }
      flush();
    };

    processContainer(tree, [], []);
    if (file !== undefined) {
      file.data.orthotypographyDiagnostics = diagnostics;
      file.data.orthotypographyChanges = changes;
    }
  };
}
