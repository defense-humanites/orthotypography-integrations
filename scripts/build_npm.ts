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
    author: "Antoine Boquet",
    license: rehypeConfig.license,
    homepage:
      "https://github.com/defense-humanites/orthotypography-integrations/tree/main/packages/rehype#readme",
    repository: {
      type: "git",
      url:
        "git+https://github.com/defense-humanites/orthotypography-integrations.git",
      directory: "packages/rehype",
    },
    bugs: {
      url:
        "https://github.com/defense-humanites/orthotypography-integrations/issues",
    },
    keywords: ["rehype", "typography", "orthotypography", "hast", "unicode"],
    engines: { node: ">=18" },
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
    author: "Antoine Boquet",
    license: astroConfig.license,
    homepage:
      "https://github.com/defense-humanites/orthotypography-integrations/tree/main/packages/astro#readme",
    repository: {
      type: "git",
      url:
        "git+https://github.com/defense-humanites/orthotypography-integrations.git",
      directory: "packages/astro",
    },
    bugs: {
      url:
        "https://github.com/defense-humanites/orthotypography-integrations/issues",
    },
    keywords: ["astro", "rehype", "typography", "orthotypography", "unicode"],
    engines: { node: ">=18" },
    sideEffects: false,
    dependencies: {
      "@astrojs/markdown-remark": "^7.2.4",
      "@orthotypography/rehype": "file:../rehype",
    },
    peerDependencies: {
      astro: "^7.0.0",
    },
  },
  mappings: {
    "@orthotypography/rehype": {
      name: "@orthotypography/rehype",
      version: "file:../rehype",
    },
  },
  postBuild() {
    const packagePath = "npm/astro/package.json";
    const packageJson = JSON.parse(Deno.readTextFileSync(packagePath));
    packageJson.dependencies["@orthotypography/rehype"] = astroConfig.version;
    Deno.writeTextFileSync(
      packagePath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );
    Deno.copyFileSync("LICENSE", "npm/astro/LICENSE");
    Deno.copyFileSync(
      "packages/astro/README.md",
      "npm/astro/README.md",
    );
  },
});
