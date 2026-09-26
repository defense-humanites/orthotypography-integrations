/**
 * Selects the npm distribution tag for a version.
 *
 * Every `0.x` version, prereleases included, is published as `latest` so that
 * an unversioned install resolves to the newest preview. npm trusted publishing
 * cannot move distribution tags after publication, so the tag must be chosen
 * before `npm publish`. From `1.0.0`, prereleases use a dedicated tag and never
 * displace a stable `latest`.
 */
export function npmDistTag(version: string): string {
  const match = /^(\d+)\.\d+\.\d+(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (match === null) {
    throw new Error(`Unsupported version ${version}.`);
  }
  const [, major, prerelease] = match;
  if (prerelease === undefined || major === "0") return "latest";
  if (prerelease.startsWith("beta")) return "beta";
  if (prerelease.startsWith("alpha")) return "alpha";
  return "next";
}
