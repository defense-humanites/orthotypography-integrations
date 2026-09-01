# Publication

Chaque paquet conserve le même nom et la même version sur JSR et npm. La
publication est déclenchée par une release GitHub et utilise la publication de
confiance. Elle reste bloquée tant que la variable de dépôt `PUBLISH_ENABLED`
n’est pas égale à `true`.

Avant la première publication :

1. publier une version compatible de `@orthotypography/core` ;
2. remplacer l’injection provisoire du moteur par un pont documenté vers cette
   version, sans supprimer le contrat structurel testable ;
3. valider les métadonnées JSR et npm ;
4. créer les paquets `@orthotypography/rehype` et `@orthotypography/astro` sur
   JSR ;
5. créer une release portant la version commune aux deux paquets.

Les paquets npm sont créés par leur première publication et n’ont pas à être
réservés. Comme leur publication de confiance ne peut être configurée qu’après
leur création, la première release utilise le secret d’environnement
`NPM_TOKEN`, contenant un jeton granulaire avec contournement de la 2FA. Le
workflow ne l’expose qu’aux deux commandes `npm publish`. Après cette release,
configurer `.github/workflows/publish.yml` et l’environnement `release` comme
éditeur de confiance de chaque paquet, puis supprimer `NPM_TOKEN` ; les releases
suivantes utiliseront automatiquement OIDC.

`rehype` est toujours publié avant `astro`, car le second en dépend. Les deux
paquets conservent une version commune pendant la phase alpha.

## Reprise d’une publication partielle

Avant chaque écriture, le workflow vérifie séparément la version exacte de
chaque paquet sur JSR et npm. Une version déjà présente est laissée intacte ;
seuls les couples paquet-registre manquants sont publiés. La vérification finale
attend que les quatre versions soient visibles.

Pour reprendre une publication, relancer le workflow échoué ou déclencher
manuellement `Publish` avec le tag de release existant. Le tag doit toujours
correspondre à la version commune déclarée dans les deux fichiers `deno.json`.
