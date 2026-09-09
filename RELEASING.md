# Publication

Chaque paquet conserve le même nom et la même version sur JSR et npm. La
publication est déclenchée par une release GitHub et utilise la publication de
confiance. Elle reste bloquée tant que la variable de dépôt `PUBLISH_ENABLED`
n’est pas égale à `true`.

Deux voies de release sont indépendantes :

- `v<version>` publie ensemble `rehype`, `satteri` et `astro` avec leur version
  commune via `publish.yml` ;
- `editor-sdk-v<version>` publie uniquement `editor-sdk` via
  `publish-editor-sdk.yml`.

Une release d'une voie ne vérifie, ne construit et ne publie aucun paquet de
l'autre voie.

## Adaptateurs Astro

Avant la première publication :

1. publier une version compatible de `@orthotypography/core` ;
2. valider les métadonnées JSR et npm ;
3. créer les paquets `@orthotypography/rehype`, `@orthotypography/satteri` et
   `@orthotypography/astro` sur JSR ;
4. créer une release portant la version commune aux trois paquets.

Les paquets npm sont créés par leur première publication et n’ont pas à être
réservés. Comme leur publication de confiance ne peut être configurée qu’après
leur création, la première release utilise le secret d’environnement
`NPM_TOKEN`, contenant un jeton granulaire avec contournement de la 2FA. Le
workflow ne l’expose qu’aux trois commandes `npm publish`. Après cette release,
configurer `.github/workflows/publish.yml` et l’environnement `release` comme
éditeur de confiance de chaque paquet, puis supprimer `NPM_TOKEN` ; les releases
suivantes utiliseront automatiquement OIDC.

Les adaptateurs `rehype` et `satteri` sont toujours publiés avant `astro`, qui
dépend des deux. Les trois paquets conservent une version commune pendant la
phase alpha.

## Reprise d’une publication partielle

Avant chaque écriture, le workflow vérifie séparément la version exacte de
chaque paquet sur JSR et npm. Une version déjà présente est laissée intacte ;
seuls les couples paquet-registre manquants sont publiés. La vérification finale
attend que les six versions soient visibles.

Pour reprendre une publication, relancer le workflow échoué ou déclencher
manuellement `Publish` avec le tag de release existant. Le tag doit toujours
correspondre à la version commune déclarée dans les trois fichiers `deno.json`.

## SDK pour éditeurs

`@orthotypography/editor-sdk` possède sa propre version. Ses deux points
d'entrée, `.` et `./google-docs`, sont toujours publiés ensemble dans un seul
paquet. Pour préparer une release :

1. mettre à jour `packages/editor-sdk/deno.json` sans modifier les versions des
   trois adaptateurs ;
2. exécuter `deno task editor:check`, `deno task editor:test`,
   `deno task npm:build:editor-sdk`, `node scripts/npm_editor_smoke.mjs` et les
   contrôles d'archives avec `node scripts/npm_editor_pack_check.mjs` ;
3. créer une release avec le tag exact `editor-sdk-v<version>`, par exemple
   `editor-sdk-v0.1.0-alpha.0`.

Avant la première publication JSR, créer `@orthotypography/editor-sdk` dans le
scope existant et lier le paquet au dépôt GitHub
`defense-humanites/orthotypography-integrations`. La publication utilise alors
le jeton OIDC éphémère du workflow, sans secret JSR.

Avant la première publication npm, le secret d'environnement `NPM_TOKEN` doit
autoriser la création du paquet public dans le scope `@orthotypography`. Après
cette première publication, configurer `publish-editor-sdk.yml` avec
l'environnement `release` comme éditeur de confiance du paquet npm et autoriser
explicitement l'action directe `npm publish`. Le jeton d'amorçage pourra alors
être retiré du workflow et révoqué.

Le workflow vérifie séparément la présence exacte du SDK sur JSR et npm. Pour
reprendre une publication partielle, relancer le workflow échoué ou déclencher
manuellement `Publish editor SDK` avec le tag existant ; une version déjà
présente n'est jamais republiée.
