import {
  isUnifiedProcessor,
  type RehypePlugin,
  unified,
  type UnifiedProcessorOptions,
} from "@astrojs/markdown-remark";
import { isSatteriProcessor } from "@astrojs/markdown-satteri";
import {
  rehypeOrthotypography,
  type RehypeOrthotypographyOptions,
} from "@orthotypography/rehype";
import {
  satteriOrthotypography,
  type SatteriOrthotypographyOptions,
} from "@orthotypography/satteri";
import type { AstroIntegration } from "astro";

/** Options for Astro's Unified processor, including plugins run before orthotypography. */
export type AstroUnifiedOptions = UnifiedProcessorOptions;

/** Configuration shared with the rehype adapter and Astro's Markdown processor. */
export interface AstroOrthotypographyOptions
  extends RehypeOrthotypographyOptions {
  /**
   * Legacy opt-in to Unified. When omitted, the integration preserves Astro's
   * current Sätteri or Unified processor and appends the matching adapter.
   * Any rehype plugins supplied here run before orthotypography.
   */
  readonly processorOptions?: AstroUnifiedOptions;
}

/**
 * Configures Astro Markdown and inherited MDX processing with the native
 * adapter for the project's current Sätteri or Unified processor.
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
      "astro:config:setup": ({ config, updateConfig }) => {
        if (options.processorOptions !== undefined) {
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
          return;
        }

        const processor = config.markdown.processor;
        if (isUnifiedProcessor(processor)) {
          processor.options.rehypePlugins.push([plugin, rehypeOptions]);
        } else if (isSatteriProcessor(processor)) {
          processor.options.hastPlugins.push(
            satteriOrthotypography(
              rehypeOptions as SatteriOrthotypographyOptions,
            ),
          );
        } else {
          throw new Error(
            `Unsupported Astro Markdown processor: ${processor.name}`,
          );
        }
        updateConfig({ markdown: { processor } });
      },
    },
  };
}

export default orthotypography;
