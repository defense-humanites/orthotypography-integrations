import assert from "node:assert/strict";
import { resolveEditorReleaseMetadata } from "../../../scripts/editor_release_metadata.ts";

Deno.test("editor release tags are independent from adapter tags", () => {
  assert.deepEqual(
    resolveEditorReleaseMetadata(
      "editor-sdk-v0.1.0-alpha.0",
      "0.1.0-alpha.0",
    ),
    { version: "0.1.0-alpha.0", npmTag: "alpha" },
  );
  assert.deepEqual(
    resolveEditorReleaseMetadata("editor-sdk-v1.0.0", "1.0.0"),
    { version: "1.0.0", npmTag: "latest" },
  );
  assert.throws(
    () => resolveEditorReleaseMetadata("v0.1.0-alpha.0", "0.1.0-alpha.0"),
    /does not match editor-sdk-v0\.1\.0-alpha\.0/u,
  );
});
