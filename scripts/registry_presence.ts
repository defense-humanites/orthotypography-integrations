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
