import { build, emptyDir } from "@deno/dnt";
import denoConfig from "../packages/rehype/deno.json" with { type: "json" };

await emptyDir("./npm/rehype");

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
    name: denoConfig.name,
    version: denoConfig.version,
    description: "Rehype adapter for source-backed orthotypography rules",
    license: denoConfig.license,
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
