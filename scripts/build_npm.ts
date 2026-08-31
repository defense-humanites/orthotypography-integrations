import { build, emptyDir } from "@deno/dnt";
import astroConfig from "../packages/astro/deno.json" with { type: "json" };
import rehypeConfig from "../packages/rehype/deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: [{ name: ".", path: "./packages/rehype/src/mod.ts" }],
  outDir: "./npm/rehype",
  esModule: true,
  scriptModule: false,
  declaration: "separate",
  declarationMap: true,
  typeCheck: "single",
  test: false,
  compilerOptions: { target: "ES2022" },
  shims: {},
  package: {
    name: rehypeConfig.name,
    version: rehypeConfig.version,
    description: "Rehype adapter for source-backed orthotypography rules",
    license: rehypeConfig.license,
    repository: {
      type: "git",
      url:
        "git+https://github.com/defense-humanites/orthotypography-integrations.git",
      directory: "packages/rehype",
    },
    sideEffects: false,
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/rehype/LICENSE");
    Deno.copyFileSync(
      "packages/rehype/README.md",
      "npm/rehype/README.md",
    );
  },
});

await build({
  entryPoints: [{ name: ".", path: "./packages/astro/src/mod.ts" }],
  outDir: "./npm/astro",
  esModule: true,
  scriptModule: false,
  declaration: "separate",
  declarationMap: true,
  // The workspace dependency is not available from npm before the first alpha.
  // Source types are checked by `deno task check`; npm:check installs the
  // freshly generated rehype package before running the Astro smoke test.
  typeCheck: false,
  test: false,
  compilerOptions: { target: "ES2022" },
  shims: {},
  package: {
    name: astroConfig.name,
    version: astroConfig.version,
    description:
      "Astro integration for source-backed orthotypography rules via rehype",
    license: astroConfig.license,
    repository: {
      type: "git",
      url:
        "git+https://github.com/defense-humanites/orthotypography-integrations.git",
      directory: "packages/astro",
    },
    sideEffects: false,
    dependencies: {
      "@astrojs/markdown-remark": "^7.2.4",
      "@orthotypography/rehype": astroConfig.version,
    },
    peerDependencies: {
      astro: "^7.0.0",
    },
  },
  mappings: {
    "@orthotypography/rehype": {
      name: "@orthotypography/rehype",
      version: astroConfig.version,
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/astro/LICENSE");
    Deno.copyFileSync(
      "packages/astro/README.md",
      "npm/astro/README.md",
    );
  },
});
