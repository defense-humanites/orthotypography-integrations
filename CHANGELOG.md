# Historique des changements

## Non publié

- Adaptateur REST Google Docs isolé avec `fetch` et fournisseur de jeton
  injectés, sans stockage d'identifiants ni nouvelle tentative automatique.
- Contrat de transport Google Docs sans authentification intégrée : lecture
  complète, écriture conditionnelle unique, conflits typés et relecture
  vérifiée.
- Prévisualisation Google Docs avec restauration explicite des styles des
  insertions intérieures, hors liens et frontières de paragraphes.
- Extraction des paragraphes Google Docs et de leurs plages UTF-16, avec
  parcours des onglets imbriqués et refus des structures non prises en charge.

- Prévisualisation de requêtes Google Docs : traduction des corrections en
  opérations natives ordonnées avec révision obligatoire, sans accès réseau.
- Adaptateur de référence en mémoire : commit atomique de lots complets,
  contrôle des conflits et simulation d'éditions concurrentes.
- Ajout d’un SDK expérimental pour les éditeurs de documents : plans immuables,
  diagnostics source, lots de corrections et validation de la révision
  documentaire.
- Tests séparés contre le commit du cœur introduisant `applyTextChanges`.

## 0.1.0-alpha.1 — 2026-09-05

- Ajout de l’adaptateur natif `@orthotypography/satteri` fondé sur les hooks
  HAST de document, avec conservation des suites textuelles multi-nœuds.
- Conservation du processeur Markdown configuré dans Astro 7 : Sätteri reçoit
  l’adaptateur natif et Unified reçoit l’adaptateur rehype.
- Maintien de `processorOptions` comme chemin de compatibilité explicite vers
  Unified.
- Ajout des validations de rendu Sätteri direct et Astro, des diagnostics et des
  segments exclus.
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
- Génération des deux paquets npm et publication coordonnée sur JSR et npm, avec
  reprise explicite des publications partielles.
