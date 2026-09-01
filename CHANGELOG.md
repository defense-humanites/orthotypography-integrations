# Historique des changements

## 0.1.0-alpha.0 — 2026-09-01

- Ajout de l’adaptateur `@orthotypography/rehype`, qui applique directement le
  moteur publié aux suites de nœuds textuels HAST sans modifier l’arbre.
- Préservation des frontières de blocs, du HTML brut et des éléments `code`,
  `pre`, `script` et `style`.
- Association des diagnostics aux segments textuels sources.
- Ajout de l’intégration `@orthotypography/astro` pour le processeur Unified
  d’Astro 7 et sa configuration Markdown/MDX héritée.
- Génération des deux paquets npm et publication coordonnée sur JSR et npm,
  avec reprise explicite des publications partielles.
