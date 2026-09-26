import { npmDistTag } from "./npm_dist_tag.ts";

export interface RegistryPresence {
  readonly jsr: boolean;
  readonly npm: boolean;
}

export type RegistryFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

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
  fetcher: RegistryFetcher,
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
  fetcher: RegistryFetcher,
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
  fetcher: RegistryFetcher = fetch,
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

/** Resolves the npm distribution tags of a package. */
export async function fetchNpmDistTags(
  packageName: string,
  fetcher: RegistryFetcher = fetch,
): Promise<Readonly<Record<string, string>>> {
  const response = await fetcher(
    `https://registry.npmjs.org/-/package/${
      encodeURIComponent(packageName)
    }/dist-tags`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} ${response.statusText}`,
    );
  }
  const tags: unknown = await response.json();
  if (
    typeof tags !== "object" || tags === null || Array.isArray(tags) ||
    Object.values(tags).some((value) => typeof value !== "string")
  ) {
    throw new Error("Invalid npm dist-tags metadata");
  }
  return tags as Readonly<Record<string, string>>;
}

/** Resolves the version npm reports for the tag selected for a version. */
export async function fetchSelectedNpmTag(
  packageName: string,
  version: string,
  fetcher: RegistryFetcher = fetch,
): Promise<string | undefined> {
  return (await fetchNpmDistTags(packageName, fetcher))[npmDistTag(version)];
}
