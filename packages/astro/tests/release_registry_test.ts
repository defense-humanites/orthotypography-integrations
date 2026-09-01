import assert from "node:assert/strict";
import { fetchRegistryPresence } from "../../../scripts/release_registry.ts";

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
