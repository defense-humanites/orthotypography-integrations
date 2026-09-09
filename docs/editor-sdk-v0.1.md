# SDK pour éditeurs de documents : première base expérimentale

Le module `experimental/editor-sdk` appartient aux intégrations. Le cœur reste
indépendant de Word, Google Docs, ONLYOFFICE et LibreOffice. Aucune API propre à
ces éditeurs n'est introduite dans cette étape.

## Contrat

`prepareDocumentPlan(snapshot, rules)` copie et fige l'instantané, puis analyse
chaque suite logique séparément en modes `lint` et `fix`. Le plan expose les
diagnostics source, les changements et les nœuds de prévisualisation. Les
offsets restent exprimés en unités UTF-16 dans chaque nœud source. Le plan est
un type nominal opaque. Un identifiant de nœud est unique dans sa suite ; un
identifiant de suite est unique dans le document.

`validateDocumentPlan(plan, currentSnapshot)` compare l'identité du document, sa
révision et l'intégralité du contexte extrait. Il vérifie à nouveau les
changements avec `applyTextChanges`, puis retourne un lot complet. Il n'écrit
jamais dans l'éditeur. Un plan n'est accepté que s'il provient de la même
instance du module ; le lot validé possède la même opacité nominale. La
sérialisation et la sélection partielle sont exclues de cette API.

La vérification de `expected` seule ne suffit pas : un mot voisin peut avoir
changé sans modifier la sous-chaîne visée. La comparaison complète couvre aussi
les identifiants, l'ordre, la langue et les protections, y compris les suites
sans correction. Les métadonnées natives non extraites, notamment les styles,
doivent être couvertes par la révision fournie par l'adaptateur.

## Application native

Le lot constitue une transaction indivisible, y compris lorsqu'une correction
porte sur plusieurs nœuds. Les changements sont triés par indice de segment puis
par position décroissants dans chaque suite. L'adaptateur construit les plages
natives et détermine l'ordre global éventuellement nécessaire entre suites.

L'adaptateur doit vérifier la révision à l'intérieur de l'opération atomique
native, préserver les styles et garantir l'annulation de l'ensemble en cas de
conflit ou d'échec d'écriture. Une validation JavaScript préalable n'empêche pas
une modification concurrente entre lecture et écriture. Si l'hôte ne fournit pas
de mécanisme équivalent, limiter l'intégration à l'analyse et à la
prévisualisation tant que cette garantie n'est pas résolue.

## Versionnement et suite

La configuration autonome dépend de la version immuable publiée
`@orthotypography/core@0.1.0-alpha.2`, qui contient `applyTextChanges` sur JSR et
npm. Ce module ne figure pas dans le workspace des paquets publiés et ne sera
pas publié par les workflows existants. Deno sert uniquement au développement ;
le code de production utilise des fonctions JavaScript standard.

L'adaptateur de référence `createMemoryDocument` expose `read`, `commit` et
`replaceRuns`. Il accepte uniquement les lots originaux du module, revalide le
plan lors du commit et prépare toutes les suites avant un remplacement synchrone
de l'état. Les instantanés sont figés ; une erreur ne produit aucune écriture
partielle. Un lot vide conserve la révision mais reste soumis aux contrôles.

`replaceRuns` simule les éditions concurrentes avec contrôle de révision. Chaque
remplacement réussi avance la révision, même si le texte initial est rétabli.
Ces révisions sont opaques et propres à la durée de vie d'une instance. Cette
référence ne modélise ni les styles natifs, ni la sélection, ni l'historique
d'annulation, ni la coordination entre processus.

Les points d'entrée expérimentaux `mod.ts` et `google-docs.ts` séparent
respectivement le contrat neutre et l'intégration Google Docs. Cette dernière
couvre désormais l'extraction, la prévisualisation, la restauration limitée
des styles, le transport conditionnel, la revue explicite et l'adaptateur REST.

La publication du SDK nécessite toujours son intégration explicite aux builds
JSR/npm. Aucun de ces points d'entrée ne fait partie des paquets publiés à ce
stade.

La [proposition de paquetage](./editor-sdk-packaging-v0.1.md) retient un paquet
`@orthotypography/editor-sdk` indépendant du groupe de versions Astro, avec les
exports `.` et `./google-docs`. Elle énumère les blocages et les critères
d'activation sans modifier les workflows de publication actuels.
