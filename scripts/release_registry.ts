import astroConfig from "../packages/astro/deno.json" with { type: "json" };
import rehypeConfig from "../packages/rehype/deno.json" with { type: "json" };

export interface RegistryPresence {
  readonly jsr: boolean;
  readonly npm: boolean;
}

export interface PackageRelease {
  readonly key: "astro" | "rehype";
  readonly name: string;
  readonly version: string;
}

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const packages: readonly PackageRelease[] = [
  { key: "rehype", name: rehypeConfig.name, version: rehypeConfig.version },
  { key: "astro", name: astroConfig.name, version: astroConfig.version },
];

function hasVersion(
  metadata: unknown,
  version: string,
  label: string,
): boolean {
  if (typeof metadata !== "object" || metadata === null) {
    throw new Error(`Invalid ${label} registry metadata`);
  }
  const versions = (metadata as { versions?: unknown }).versions;
  if (typeof versions !== "object" || versions === null) {
    throw new Error(`Invalid ${label} versions metadata`);
  }
  return Object.hasOwn(versions, version);
}

async function fetchMetadata(
  url: string,
  label: string,
  fetcher: Fetcher,
): Promise<unknown> {
  const response = await fetcher(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
    },
  });
  if (response.status === 404) return { versions: {} };
  if (!response.ok) {
    throw new Error(
      `${label} registry returned ${response.status} ${response.statusText}`,
    );
  }
  return await response.json();
}

async function versionEndpointExists(
  url: string,
  label: string,
  fetcher: Fetcher,
): Promise<boolean> {
  const response = await fetcher(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
    },
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(
      `${label} registry returned ${response.status} ${response.statusText}`,
    );
  }
  return true;
}

/** Resolves whether one exact immutable package version exists. */
export async function fetchRegistryPresence(
  packageName: string,
  version: string,
  fetcher: Fetcher = fetch,
): Promise<RegistryPresence> {
  const [jsrMetadata, npm] = await Promise.all([
    fetchMetadata(`https://jsr.io/${packageName}/meta.json`, "JSR", fetcher),
    versionEndpointExists(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${
        encodeURIComponent(version)
      }`,
      "npm",
      fetcher,
    ),
  ]);
  return {
    jsr: hasVersion(jsrMetadata, version, "JSR"),
    npm,
  };
}

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
    if (states.every(([, presence]) => presence.jsr && presence.npm)) return;
    if (attempt === attempts) {
      throw new Error(
        `Incomplete release: ${
          states.map(([pkg, presence]) =>
            `${pkg.name}@${pkg.version}(JSR=${presence.jsr}, npm=${presence.npm})`
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
