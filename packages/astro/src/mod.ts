import {
  type RehypePlugin,
  unified,
  type UnifiedProcessorOptions,
} from "@astrojs/markdown-remark";
import {
  rehypeOrthotypography,
  type RehypeOrthotypographyOptions,
} from "@orthotypography/rehype";
import type { AstroIntegration } from "astro";

/** Options for Astro's Unified processor, including plugins run before orthotypography. */
export type AstroUnifiedOptions = UnifiedProcessorOptions;

/** Configuration shared with the rehype adapter and Astro's Markdown processor. */
export interface AstroOrthotypographyOptions
  extends RehypeOrthotypographyOptions {
  /**
   * Unified processor options. Any rehype plugins supplied here run before
   * orthotypography.
   */
  readonly processorOptions?: AstroUnifiedOptions;
}

/**
 * Configures Astro Markdown and inherited MDX processing with the
 * orthotypography rehype adapter.
 *
 * This integration deliberately selects Astro's Unified processor because a
 * rehype plugin cannot run in the default Satteri processor.
 */
export function orthotypography(
  options: AstroOrthotypographyOptions,
): AstroIntegration {
  const { processorOptions = {}, ...rehypeOptions } = options;
  const plugin = rehypeOrthotypography as unknown as RehypePlugin<
    [RehypeOrthotypographyOptions]
  >;

  return {
    name: "@orthotypography/astro",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          markdown: {
            processor: unified({
              ...processorOptions,
              rehypePlugins: [
                ...(processorOptions.rehypePlugins ?? []),
                [plugin, rehypeOptions],
              ],
            }),
          },
        });
      },
    },
  };
}

export default orthotypography;
