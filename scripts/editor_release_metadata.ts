import editorSdkConfig from "../packages/editor-sdk/deno.json" with {
  type: "json",
};

export interface EditorReleaseMetadata {
  readonly version: string;
  readonly npmTag: string;
}

/** Validates an editor SDK release tag without coupling it to adapter versions. */
export function resolveEditorReleaseMetadata(
  tag: string,
  version: string,
): EditorReleaseMetadata {
  const expectedTag = `editor-sdk-v${version}`;
  if (tag !== expectedTag) {
    throw new Error(`Release tag ${tag} does not match ${expectedTag}.`);
  }
  const prerelease = version.split("-", 2)[1];
  const npmTag = prerelease === undefined
    ? "latest"
    : prerelease.startsWith("beta")
    ? "beta"
    : prerelease.startsWith("alpha")
    ? "alpha"
    : "next";
  return { version, npmTag };
}

if (import.meta.main) {
  const outputPath = Deno.env.get("GITHUB_OUTPUT");
  if (outputPath === undefined) {
    throw new Error("GITHUB_OUTPUT is not available.");
  }
  const metadata = resolveEditorReleaseMetadata(
    Deno.args[0],
    editorSdkConfig.version,
  );
  await Deno.writeTextFile(
    outputPath,
    `version=${metadata.version}\nnpm_tag=${metadata.npmTag}\n`,
    { append: true },
  );
}
