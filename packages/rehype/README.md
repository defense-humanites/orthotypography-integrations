# `@orthotypography/rehype`

Adaptateur rehype pour appliquer un moteur orthotypographique à des suites de
nœuds textuels HAST sans modifier la structure de l’arbre.

Le paquet est en prépublication. Tant que `@orthotypography/core` ne possède pas
de version publiée, le moteur est fourni explicitement :

```ts
import {
  IMPRIMERIE_NATIONALE_RULES,
  runTextNodePipeline,
} from "@orthotypography/core";
import { rehypeOrthotypography } from "@orthotypography/rehype";

const plugin = rehypeOrthotypography({
  runTextNodePipeline,
  rules: IMPRIMERIE_NATIONALE_RULES,
  locale: "fr-FR",
  mode: "lint",
});
```

Les modes sont intentionnellement explicites : `lint` produit des diagnostics
rapportés par `segmentId`, tandis que `fix` remplace uniquement la valeur des
nœuds. Les éléments de bloc, le HTML brut et `code`, `pre`, `script`, `style`
forment des frontières. Les prédicats `exclude` et `protect` permettent à une
intégration d’ajuster cette politique.
