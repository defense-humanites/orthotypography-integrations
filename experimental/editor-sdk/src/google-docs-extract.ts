import type { DocumentRun, DocumentSnapshot } from "./mod.ts";
import type { GoogleDocsNodeRange } from "./google-docs.ts";
import { copyGoogleDocsTextStyle } from "./google-docs-style.ts";

/** Body-only snapshot and ranges from one unfiltered documents.get response. */
export interface GoogleDocsExtraction {
  readonly snapshot: DocumentSnapshot;
  readonly ranges: readonly GoogleDocsNodeRange[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected Google Docs object");
  }
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected Google Docs array");
  return value;
}
function id(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Missing Google Docs identity or locale");
  }
  return value;
}
function index(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Google Docs index");
  }
  return value;
}
function rejectSuggestions(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      (key.startsWith("suggested") || key === "suggestions") && child != null &&
      (typeof child !== "object" || Object.keys(child).length > 0)
    ) {
      throw new Error("Google Docs suggestions are not supported");
    }
    rejectSuggestions(child);
  }
}

/**
 * Extracts plain body paragraphs, including nested tabs, without network access.
 * Requires a full GET with includeTabsContent=true and SUGGESTIONS_INLINE.
 * Rejects unsupported body structures rather than silently omitting their text.
 * Locale is explicit; raw text styles are retained only on native ranges.
 * Headers, footers and footnotes are not extracted.
 */
export function extractGoogleDocsBody(
  response: unknown,
  locale: string,
): GoogleDocsExtraction {
  const document = object(response);
  const documentId = id(document.documentId);
  const revision = id(document.revisionId);
  id(locale);
  if (document.suggestionsViewMode !== "SUGGESTIONS_INLINE") {
    throw new Error("Google Docs extraction requires SUGGESTIONS_INLINE");
  }
  rejectSuggestions(document);
  const runs: DocumentRun[] = [];
  const ranges: GoogleDocsNodeRange[] = [];
  const tabIds = new Set<string>();
  function visit(value: unknown): void {
    const tab = object(value);
    const tabId = id(object(tab.tabProperties).tabId);
    if (tabIds.has(tabId)) throw new Error("Duplicate Google Docs tab ID");
    tabIds.add(tabId);
    const body = object(object(tab.documentTab).body);
    let end = 0;
    let paragraphCount = 0;
    const content = array(body.content);
    if (content.length === 0) {
      throw new Error("Missing Google Docs body content");
    }
    for (const [position, item] of content.entries()) {
      const element = object(item);
      const start = index(
        element.startIndex ?? (position === 0 ? 0 : undefined),
      );
      const stop = index(element.endIndex);
      if (start !== end || stop <= start) {
        throw new Error("Noncontiguous Google Docs body");
      }
      end = stop;
      if (
        position === 0 && start === 0 && stop === 1 && element.sectionBreak &&
        !element.paragraph && !element.table && !element.tableOfContents
      ) {
        object(element.sectionBreak);
        continue;
      }
      if (
        start < 1 || !element.paragraph || element.table ||
        element.tableOfContents || element.sectionBreak
      ) {
        throw new Error("Unsupported Google Docs body structure");
      }
      const paragraph = object(element.paragraph);
      paragraphCount++;
      if (
        paragraph.positionedObjectIds &&
        array(paragraph.positionedObjectIds).length
      ) {
        throw new Error("Google Docs positioned objects are not supported");
      }
      const elements = array(paragraph.elements);
      if (!elements.length) {
        throw new Error("Missing Google Docs paragraph elements");
      }
      const runId = JSON.stringify([tabId, start]);
      const nodes: { id: string; value: string }[] = [];
      let cursor = start;
      for (const [ordinal, input] of elements.entries()) {
        const part = object(input);
        if (
          Object.keys(part).some((key) =>
            !["startIndex", "endIndex", "textRun"].includes(key) &&
            !key.startsWith("suggested")
          )
        ) {
          throw new Error("Unsupported Google Docs paragraph element");
        }
        const partStart = index(part.startIndex);
        const partEnd = index(part.endIndex);
        const text = object(part.textRun).content;
        if (
          typeof text !== "string" || !text.isWellFormed() ||
          partStart !== cursor || partEnd <= partStart || partEnd > stop ||
          text.length !== partEnd - partStart
        ) {
          throw new Error("Invalid Google Docs text range");
        }
        const last = ordinal === elements.length - 1;
        if (last && !text.endsWith("\n")) {
          throw new Error("Missing Google Docs paragraph terminator");
        }
        const value = last ? text.slice(0, -1) : text;
        if (/[\r\n\ufffc]/u.test(value)) {
          throw new Error("Unsupported Google Docs paragraph text");
        }
        if (value.length) {
          const nodeId = String(partStart);
          nodes.push(Object.freeze({ id: nodeId, value }));
          ranges.push(
            Object.freeze({
              runId,
              nodeId,
              tabId,
              startIndex: partStart,
              endIndex: partStart + value.length,
              textStyle: copyGoogleDocsTextStyle(
                object(part.textRun).textStyle ?? {},
              ),
            }),
          );
        }
        cursor = partEnd;
      }
      if (cursor !== stop) throw new Error("Incomplete Google Docs paragraph");
      runs.push(
        Object.freeze({ id: runId, locale, nodes: Object.freeze(nodes) }),
      );
    }
    if (paragraphCount === 0) throw new Error("Missing Google Docs paragraphs");
    for (const child of array(tab.childTabs ?? [])) visit(child);
  }
  const tabs = array(document.tabs);
  if (!tabs.length) {
    throw new Error("Google Docs extraction requires populated tabs");
  }
  for (const tab of tabs) visit(tab);
  return Object.freeze({
    snapshot: Object.freeze({
      documentId,
      revision,
      runs: Object.freeze(runs),
    }),
    ranges: Object.freeze(ranges),
  });
}
