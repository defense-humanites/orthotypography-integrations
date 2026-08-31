# `@orthotypography/astro`

Intégration Astro pour appliquer `@orthotypography/rehype` aux documents
Markdown et MDX rendus avec le processeur Unified.

```ts
import {
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "@orthotypography/core";
import orthotypography from "@orthotypography/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    orthotypography({
      runTextNodePipeline,
      rules: IMPRIMERIE_NATIONALE_RULES,
      locale: "fr-FR",
      mode: "lint",
    }),
  ],
});
```

L’intégration sélectionne explicitement le processeur Unified d’Astro, requis
pour exécuter un plugin rehype. Les options `processorOptions` permettent de
conserver d’autres plugins remark ou rehype ; les plugins rehype qui y figurent
s’exécutent avant orthotypography.

L’intégration MDX officielle hérite de la configuration Markdown par défaut. Si
`extendMarkdownConfig` est désactivé ou si MDX reçoit son propre processeur, la
configuration doit y être reproduite explicitement.

Les modes restent obligatoires. `lint` collecte les diagnostics sans modifier le
contenu ; `fix` remplace uniquement les valeurs des nœuds textuels autorisés par
l’adaptateur rehype.
