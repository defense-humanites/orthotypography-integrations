import editorSdkConfig from "../packages/editor-sdk/deno.json" with {
  type: "json",
};
import { npmDistTag } from "./npm_dist_tag.ts";
import {
  fetchRegistryPresence,
  fetchSelectedNpmTag,
} from "./registry_presence.ts";

async function presence() {
  return await fetchRegistryPresence(
    editorSdkConfig.name,
    editorSdkConfig.version,
  );
}

async function writeOutputs(): Promise<void> {
  const outputPath = Deno.env.get("GITHUB_OUTPUT");
  if (outputPath === undefined) {
    throw new Error("GITHUB_OUTPUT is not available.");
  }
  const state = await presence();
  await Deno.writeTextFile(
    outputPath,
    `editor_jsr_exists=${state.jsr}\neditor_npm_exists=${state.npm}\n`,
    { append: true },
  );
  console.log(
    `${editorSdkConfig.name}@${editorSdkConfig.version}: JSR=${state.jsr}, npm=${state.npm}`,
  );
}

async function requireCompleteRelease(): Promise<void> {
  const attempts = 30;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const state = await presence();
    const tagged = state.npm
      ? await fetchSelectedNpmTag(editorSdkConfig.name, editorSdkConfig.version)
      : undefined;
    if (state.jsr && state.npm && tagged === editorSdkConfig.version) return;
    if (attempt === attempts) {
      throw new Error(
        `Incomplete release: ${editorSdkConfig.name}@${editorSdkConfig.version}(JSR=${state.jsr}, npm=${state.npm}, npm ${
          npmDistTag(editorSdkConfig.version)
        }=${tagged ?? "unverified"})`,
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
