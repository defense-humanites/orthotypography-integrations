import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function esmTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    return esmTarget(entry.import) ?? esmTarget(entry.default);
  }
}

const packageJson = JSON.parse(
  await readFile("npm/editor-sdk/package.json", "utf8"),
);

async function importEntry(exportName) {
  const target = esmTarget(packageJson.exports[exportName]);
  assert.equal(typeof target, "string", `${exportName} must expose ESM`);
  return await import(pathToFileURL(`npm/editor-sdk/${target}`).href);
}

const editorSdk = await importEntry(".");
assert.equal(typeof editorSdk.prepareDocumentPlan, "function");
assert.equal(typeof editorSdk.createMemoryDocument, "function");

const googleDocs = await importEntry("./google-docs");
assert.equal(typeof googleDocs.extractGoogleDocsBody, "function");
assert.equal(typeof googleDocs.prepareGoogleDocsReview, "function");
assert.equal(typeof googleDocs.createGoogleDocsRestTransport, "function");

assert.equal(packageJson.name, "@orthotypography/editor-sdk");
assert.equal(packageJson.version, "0.1.0-alpha.0");
assert.equal(
  packageJson.dependencies["@orthotypography/core"],
  "0.1.0-alpha.2",
);
