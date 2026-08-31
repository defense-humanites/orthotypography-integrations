import astroConfig from "../packages/astro/deno.json" with { type: "json" };
import rehypeConfig from "../packages/rehype/deno.json" with { type: "json" };

if (astroConfig.version !== rehypeConfig.version) {
  throw new Error(
    `Package versions differ: astro=${astroConfig.version}, rehype=${rehypeConfig.version}`,
  );
}

const tag = Deno.args[0];
const expectedTag = `v${rehypeConfig.version}`;
if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag} does not match ${expectedTag}.`);
}

const prerelease = rehypeConfig.version.split("-", 2)[1];
const npmTag = prerelease === undefined
  ? "latest"
  : prerelease.startsWith("beta")
  ? "beta"
  : prerelease.startsWith("alpha")
  ? "alpha"
  : "next";
const outputPath = Deno.env.get("GITHUB_OUTPUT");
if (outputPath === undefined) {
  throw new Error("GITHUB_OUTPUT is not available.");
}

await Deno.writeTextFile(
  outputPath,
  `version=${rehypeConfig.version}\nnpm_tag=${npmTag}\n`,
  { append: true },
);
