import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function esmTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    return esmTarget(entry.import) ?? esmTarget(entry.default);
  }
}

async function importPackage(directory) {
  const packageJson = JSON.parse(
    await readFile(`npm/${directory}/package.json`, "utf8"),
  );
  const target = esmTarget(packageJson.exports["."]);
  assert.equal(typeof target, "string", "npm package must expose an ESM entry");
  const module = await import(pathToFileURL(`npm/${directory}/${target}`).href);
  return { module, packageJson };
}

const rehype = await importPackage("rehype");
assert.equal(typeof rehype.module.rehypeOrthotypography, "function");

const astro = await importPackage("astro");
assert.equal(typeof astro.module.default, "function");
assert.equal(typeof astro.module.orthotypography, "function");
assert.equal(
  astro.packageJson.dependencies["@orthotypography/rehype"],
  astro.packageJson.version,
);
assert.equal(astro.packageJson.peerDependencies.astro, "^7.0.0");
