# Historique des changements

## 0.1.0-alpha.1 — non publié

- Ajout de l’adaptateur natif `@orthotypography/satteri` fondé sur les hooks
  HAST de document, avec conservation des suites textuelles multi-nœuds.
- Conservation du processeur Markdown configuré dans Astro 7 : Sätteri reçoit
  l’adaptateur natif et Unified reçoit l’adaptateur rehype.
- Maintien de `processorOptions` comme chemin de compatibilité explicite vers
  Unified.
- Ajout des validations de rendu Sätteri direct et Astro, des diagnostics et
  des segments exclus.
- Extension de la publication coordonnée et de sa reprise partielle aux trois
  paquets sur JSR et npm.
- Mise à niveau vers `@orthotypography/core@0.1.0-alpha.1`.
- Exposition des changements localisés par `onChange` et
  `orthotypographyChanges` dans Rehype, Sätteri et Astro.

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
