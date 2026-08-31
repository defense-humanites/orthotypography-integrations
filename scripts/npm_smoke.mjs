import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const packageJson = JSON.parse(
  await readFile("npm/rehype/package.json", "utf8"),
);

function esmTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    return esmTarget(entry.import) ?? esmTarget(entry.default);
  }
}

const target = esmTarget(packageJson.exports["."]);
assert.equal(typeof target, "string", "npm package must expose an ESM entry");
const module = await import(pathToFileURL(`npm/rehype/${target}`).href);
assert.equal(typeof module.rehypeOrthotypography, "function");
