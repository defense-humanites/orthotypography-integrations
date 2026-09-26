import assert from "node:assert/strict";
import { fetchRegistryPresence } from "../../../scripts/release_registry.ts";
import { npmDistTag } from "../../../scripts/npm_dist_tag.ts";
import {
  fetchNpmDistTags,
  fetchSelectedNpmTag,
} from "../../../scripts/registry_presence.ts";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("registry state distinguishes a partial package publication", async () => {
  const requested: string[] = [];
  const fetcher = (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    requested.push(url);
    return Promise.resolve(
      url.includes("jsr.io")
        ? response({ versions: { "0.1.0-alpha.0": {} } })
        : response({ error: "not found" }, 404),
    );
  };

  assert.deepEqual(
    await fetchRegistryPresence(
      "@orthotypography/astro",
      "0.1.0-alpha.0",
      fetcher,
    ),
    { jsr: true, npm: false },
  );
  assert.deepEqual(requested, [
    "https://jsr.io/@orthotypography/astro/meta.json",
    "https://registry.npmjs.org/%40orthotypography%2Fastro/0.1.0-alpha.0",
  ]);
});

Deno.test("missing packages are treated as unpublished", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.resolve(response({ error: "not found" }, 404));

  assert.deepEqual(
    await fetchRegistryPresence("@orthotypography/rehype", "0.1.0", fetcher),
    { jsr: false, npm: false },
  );
});

Deno.test("registry errors fail closed", async () => {
  await assert.rejects(
    () =>
      fetchRegistryPresence(
        "@orthotypography/astro",
        "0.1.0",
        () => Promise.resolve(response({}, 503)),
      ),
    Error,
    "registry returned 503",
  );
});

Deno.test("every 0.x version is published as latest on npm", () => {
  assert.equal(npmDistTag("0.1.0-alpha.2"), "latest");
  assert.equal(npmDistTag("0.2.0-beta.1"), "latest");
  assert.equal(npmDistTag("0.9.0"), "latest");
});

Deno.test("prereleases from 1.0.0 never displace the stable latest tag", () => {
  assert.equal(npmDistTag("1.0.0"), "latest");
  assert.equal(npmDistTag("1.0.0-alpha.0"), "alpha");
  assert.equal(npmDistTag("1.0.0-beta.2"), "beta");
  assert.equal(npmDistTag("1.1.0-rc.1"), "next");
  assert.throws(() => npmDistTag("v0.1.0"), /Unsupported version/);
});

Deno.test("npm dist-tags are read from the scoped package endpoint", async () => {
  const requested: string[] = [];
  const fetcher = (input: string | URL | Request): Promise<Response> => {
    requested.push(String(input));
    return Promise.resolve(
      response({ latest: "0.1.0-alpha.2", alpha: "0.1.0-alpha.1" }),
    );
  };

  assert.equal(
    await fetchSelectedNpmTag(
      "@orthotypography/astro",
      "0.1.0-alpha.2",
      fetcher,
    ),
    "0.1.0-alpha.2",
  );
  assert.deepEqual(requested, [
    "https://registry.npmjs.org/-/package/%40orthotypography%2Fastro/dist-tags",
  ]);
});

Deno.test("npm dist-tag errors and malformed metadata fail closed", async () => {
  await assert.rejects(
    fetchNpmDistTags(
      "@orthotypography/astro",
      () => Promise.resolve(response({ error: "unavailable" }, 503)),
    ),
    /npm registry returned 503/,
  );
  for (const body of [null, ["0.1.0"], { latest: 1 }]) {
    await assert.rejects(
      fetchNpmDistTags(
        "@orthotypography/astro",
        () => Promise.resolve(response(body)),
      ),
      /Invalid npm dist-tags metadata/,
    );
  }
});
