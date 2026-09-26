import astroConfig from "../packages/astro/deno.json" with { type: "json" };
import rehypeConfig from "../packages/rehype/deno.json" with { type: "json" };
import satteriConfig from "../packages/satteri/deno.json" with {
  type: "json",
};
import {
  fetchRegistryPresence,
  fetchSelectedNpmTag,
  type RegistryPresence,
} from "./registry_presence.ts";
import { npmDistTag } from "./npm_dist_tag.ts";

export { fetchRegistryPresence } from "./registry_presence.ts";

export interface PackageRelease {
  readonly key: "astro" | "rehype" | "satteri";
  readonly name: string;
  readonly version: string;
}

const packages: readonly PackageRelease[] = [
  { key: "rehype", name: rehypeConfig.name, version: rehypeConfig.version },
  {
    key: "satteri",
    name: satteriConfig.name,
    version: satteriConfig.version,
  },
  { key: "astro", name: astroConfig.name, version: astroConfig.version },
];

async function allPresence(): Promise<
  readonly [PackageRelease, RegistryPresence][]
> {
  return await Promise.all(packages.map(async (packageRelease) =>
    [
      packageRelease,
      await fetchRegistryPresence(packageRelease.name, packageRelease.version),
    ] as const
  ));
}

async function writeOutputs(): Promise<void> {
  const outputPath = Deno.env.get("GITHUB_OUTPUT");
  if (outputPath === undefined) {
    throw new Error("GITHUB_OUTPUT is not available.");
  }
  const states = await allPresence();
  const output = states.flatMap(([packageRelease, presence]) => [
    `${packageRelease.key}_jsr_exists=${presence.jsr}`,
    `${packageRelease.key}_npm_exists=${presence.npm}`,
  ]).join("\n");
  await Deno.writeTextFile(outputPath, `${output}\n`, { append: true });
  for (const [packageRelease, presence] of states) {
    console.log(
      `${packageRelease.name}@${packageRelease.version}: JSR=${presence.jsr}, npm=${presence.npm}`,
    );
  }
}

async function requireCompleteRelease(): Promise<void> {
  const attempts = 30;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const states = await allPresence();
    const tagged = await Promise.all(
      states.map(([pkg, presence]) =>
        presence.npm ? fetchSelectedNpmTag(pkg.name, pkg.version) : undefined
      ),
    );
    if (
      states.every(([pkg, presence], index) =>
        presence.jsr && presence.npm && tagged[index] === pkg.version
      )
    ) return;
    if (attempt === attempts) {
      throw new Error(
        `Incomplete release: ${
          states.map(([pkg, presence], index) =>
            `${pkg.name}@${pkg.version}(JSR=${presence.jsr}, npm=${presence.npm}, npm ${
              npmDistTag(pkg.version)
            }=${tagged[index] ?? "unverified"})`
          ).join(", ")
        }`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

if (import.meta.main) {
  if (Deno.args.includes("--require-all")) {
    await requireCompleteRelease();
  } else {
    await writeOutputs();
  }
}
