# Paquetage envisagé du SDK pour éditeurs

## Décision proposée

Le SDK expérimental doit devenir un seul paquet `@orthotypography/editor-sdk`
avec deux points d'entrée publics :

| Export | Contenu | Dépendances de production |
| --- | --- | --- |
| `@orthotypography/editor-sdk` | instantanés, plans, lots et adaptateur mémoire | `@orthotypography/core` |
| `@orthotypography/editor-sdk/google-docs` | extraction, prévisualisation, styles, transport, revue et REST Google Docs | `@orthotypography/core` et API Web standard |

Cette topologie conserve une version unique pour le contrat neutre et son
premier adaptateur, tout en empêchant l'import accidentel du code Google Docs
par un autre éditeur. Le sous-chemin Google Docs ne contient ni OAuth, ni
stockage d'identifiants, ni dépendance cliente Google. Une séparation en deux
paquets ne sera justifiée que si leurs cycles de version ou leurs dépendances
divergent réellement.

Le paquet n'entre pas dans le groupe de versions commun à `rehype`, `satteri`
et `astro`. Son évolution dépend du contrat d'éditeur et du cœur, non des
versions d'Astro. Sa première version pourra donc être
`0.1.0-alpha.0`, indépendamment de la prochaine version des trois intégrations
existantes.

## Périmètre de la première alpha

Le point d'entrée principal comprend les valeurs nominales `DocumentPlan` et
`DocumentBatch`, la préparation et la validation complètes, ainsi que
`createMemoryDocument`. Les instantanés, suites et nœuds restent structurels
afin que chaque hôte puisse les produire sans fabrique imposée.

Le sous-chemin Google Docs comprend le périmètre déjà testé :

- paragraphes du corps et onglets imbriqués ;
- coordonnées UTF-16 et suggestions incorporées ;
- prévisualisations textuelles ou avec restauration limitée des styles ;
- revue nominale, validation ou abandon à usage unique ;
- écriture conditionnée par `requiredRevisionId` et relecture complète ;
- transport REST fondé sur `fetch` et un fournisseur de jeton injectés.

Les en-têtes, pieds de page, notes, tableaux, objets incorporés, liens lors des
insertions stylées, OAuth, stockage de jetons, retries et interface utilisateur
restent exclus. Ces limites doivent apparaître dans le README publié.

## État des prérequis

`@orthotypography/core@0.1.0-alpha.2`, qui contient `applyTextChanges`, est
publié sous la même version immuable sur JSR et npm. La configuration autonome
du SDK utilise désormais cette version plutôt qu'une URL de commit.

Le répertoire `experimental/editor-sdk` reste hors du workspace racine, des
tâches `publish:check`, du workflow de publication et du registre de reprise
partielle. Aucune métadonnée `name` ou `version` n'est ajoutée à son `deno.json`
dans la présente PR.

## Critères d'activation

Une PR ultérieure pourra déplacer le module vers `packages/editor-sdk` et
activer sa publication seulement lorsque tous les points suivants seront
satisfaits :

1. publier une nouvelle alpha de `@orthotypography/core` contenant
   `applyTextChanges` — fait avec `0.1.0-alpha.2` ;
2. remplacer l'URL de commit par cette version dans les imports JSR — fait ;
   ajouter sa correspondance npm lors de l'activation du build ;
3. déclarer les exports `.` et `./google-docs` dans le `deno.json` du paquet ;
4. construire les deux points d'entrée avec dnt et vérifier leurs déclarations
   sous Node ;
5. ajouter des tests d'import JSR et npm pour les deux sous-chemins ;
6. exécuter `deno publish --dry-run --check` sur le nouveau paquet ;
7. étendre séparément la détection de présence JSR/npm et la reprise de
   publication, sans imposer sa version aux trois intégrations Astro ;
8. vérifier les métadonnées, la licence, les fichiers inclus et l'absence des
   fixtures de validation réelle dans les archives publiées.

La présente PR doit rester sans publication. Elle établit le contrat et les
preuves nécessaires à cette future opération, mais ne l'autorise pas.
