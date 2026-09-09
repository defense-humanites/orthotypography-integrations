# Feuille de route des intégrations

État vérifié le 9 septembre 2026 sur
[`cd374d62`](https://github.com/defense-humanites/orthotypography-integrations/commit/cd374d6221e5089441660321ad09529d70dba332),
avant l'ajout de cette feuille de route. Les PR
[#1](https://github.com/defense-humanites/orthotypography-integrations/pull/1)
et
[#2](https://github.com/defense-humanites/orthotypography-integrations/pull/2)
sont fusionnées. Les tâches ci-dessous sont proposées, sans engagement de date.

## État acquis

| Chantier                   | État vérifié                                                                                                                                     | Preuve                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown / Astro           | Rehype, Sätteri et Astro publiés en `0.1.0-alpha.1`, cible Astro 7 ; processeur configuré préservé, diagnostics et changements localisés exposés | [Release](https://github.com/defense-humanites/orthotypography-integrations/releases/tag/v0.1.0-alpha.1), [configuration](../deno.json)                                 |
| Dépendance des adaptateurs | Cœur `0.1.0-alpha.1` ; mise à niveau indépendante du SDK                                                                                         | [Configuration](../deno.json)                                                                                                                                           |
| SDK neutre                 | `@orthotypography/editor-sdk@0.1.0-alpha.0` publié ; instantanés et plans immuables, validation complète, adaptateur atomique en mémoire         | [Release SDK](https://github.com/defense-humanites/orthotypography-integrations/releases/tag/editor-sdk-v0.1.0-alpha.0), [README SDK](../packages/editor-sdk/README.md) |
| Dépendance du SDK          | Cœur `0.1.0-alpha.2`, contenant `applyTextChanges`                                                                                               | [Manifeste SDK](../packages/editor-sdk/deno.json)                                                                                                                       |
| Google Docs                | Extraction des paragraphes et onglets imbriqués, coordonnées UTF-16, compilation conditionnelle, restauration limitée des styles                 | [Périmètre](google-docs-preview.md), [README SDK](../packages/editor-sdk/README.md)                                                                                     |
| Transport et révision      | Transport REST injecté, relecture vérifiée, préparation / validation / abandon d'une révision proposée ; objets à usage unique                   | [README SDK](../packages/editor-sdk/README.md)                                                                                                                          |
| Tests SDK                  | 67 tests annoncés pour la release alpha.0, vérification des deux points d'entrée npm sous Node                                                   | Release SDK ; ce nombre n'est pas une nouvelle exécution                                                                                                                |
| Validation réelle          | Scénario limité exécuté via le connecteur Google Drive le 6 septembre ; transport REST direct encore à valider en conditions réelles             | [Compte rendu](google-docs-live-validation.md)                                                                                                                          |

Le SDK est dans `packages/editor-sdk`. L'ancien état expérimental non publié ne
décrit plus la situation courante. Les deux points d'entrée `.` et
`./google-docs` sont livrés dans le même paquet ; la version du SDK est
indépendante de celle des trois adaptateurs Astro.

## Limites Google Docs

Le scénario réel couvre huit corrections, des onglets imbriqués, un emoji, des
styles hérités, gras, italiques et RGB, une relecture exacte, l'idempotence et
le rejet d'une ancienne révision. Il ne simule pas un second utilisateur
simultané. Les fixtures dérivées de ce scénario restent des tests hors ligne.

La restauration de styles est limitée aux insertions intérieures prises en
charge et sans liens. Les structures non prises en charge sont refusées. Les
en-têtes, pieds de page, notes, tableaux, objets incorporés, suggestions,
sélections et annulation ne disposent pas d'une garantie générale de prise en
charge. Le SDK ne fournit ni interface utilisateur, ni acquisition/stockage
OAuth, ni relance automatique. La persistance des plans et l'acceptation
partielle sont hors du contrat actuel.

## Prochaines tâches proposées

1. **Cohérence documentaire et linguistique.** Actualiser les mentions « non
   publié » et « aucun adaptateur natif » devenues obsolètes, notamment dans le
   README SDK et les notes documentaires. Traduire en anglais la prose hors de
   `docs/`, dont `RELEASING.md`, et auditer les autres fichiers. Terminé lorsque
   l'état publié, les limites et la politique linguistique concordent sans
   modifier les données de test.
2. **Markdown / Astro : vérifier la prochaine dépendance au cœur.** Évaluer
   alpha.2 dans une tâche dédiée avec tests des deux processeurs, diagnostics,
   changements localisés et contenu protégé. Décider ensuite d'une nouvelle
   version des adaptateurs ; ne pas aligner automatiquement leurs versions sur
   celle du SDK.
3. **Google Docs : valider le transport REST réel.** Utiliser un document
   jetable et des identifiants fournis par l'application hôte. Vérifier
   préparation sans écriture, écriture conditionnelle, relecture, idempotence,
   révision périmée et absence de rejeu. Conserver un compte rendu borné et des
   fixtures nettoyées ; distinguer ce test de celui effectué via le connecteur.
4. **Application cliente de référence.** Définir puis réaliser un parcours
   limité d'affichage des diagnostics et prévisualisations, acceptation ou
   abandon, application et présentation des conflits. L'application gère les
   identifiants ; le SDK conserve son contrat atomique et ses exclusions.
5. **Extension des capacités documentaires.** Prioriser une structure ou un cas
   de style à la fois après les validations précédentes. Exiger des scénarios
   réels et des refus explicites avant d'élargir les garanties.

## Coordination et releases

Le chat Markdown / Astro pilote les trois adaptateurs ; le chat SDK / Google
Docs pilote le contrat documentaire et son premier fournisseur. La
[feuille du cœur](https://github.com/defense-humanites/orthotypography/blob/main/docs/roadmap.md)
porte les règles et le contrat de changements. Coordonner toute évolution
partagée avant des implémentations parallèles.

Les tags `v<version>` publient les adaptateurs ; les tags
`editor-sdk-v<version>` publient uniquement le SDK. Consulter les workflows et
[RELEASING.md](../RELEASING.md) avant une release. Chaque tâche doit préciser
son périmètre, ses critères d'acceptation, ses validations et les liens
d'issue/PR disponibles. Mettre à jour cette feuille après fusion, validation
réelle ou publication, avec les preuves correspondantes.
