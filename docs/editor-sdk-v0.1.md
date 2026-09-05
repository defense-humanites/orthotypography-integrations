# SDK pour éditeurs de documents : première base expérimentale

Le module `experimental/editor-sdk` appartient aux intégrations. Le cœur reste
indépendant de Word, Google Docs, ONLYOFFICE et LibreOffice. Aucune API propre à
ces éditeurs n'est introduite dans cette étape.

## Contrat

`prepareDocumentPlan(snapshot, rules)` copie et fige l'instantané, puis analyse
chaque suite logique séparément en modes `lint` et `fix`. Le plan expose les
diagnostics source, les changements et les nœuds de prévisualisation. Les offsets
restent exprimés en unités UTF-16 dans chaque nœud source. Un identifiant de nœud
est unique dans sa suite ; un identifiant de suite est unique dans le document.

`validateDocumentPlan(plan, currentSnapshot)` compare l'identité du document,
sa révision et l'intégralité du contexte extrait. Il vérifie à nouveau les
changements avec `applyTextChanges`, puis retourne un lot complet. Il n'écrit
jamais dans l'éditeur. Un plan n'est accepté que s'il provient de la même instance
du module ; la sérialisation et la sélection partielle sont exclues de cette API.

La vérification de `expected` seule ne suffit pas : un mot voisin peut avoir
changé sans modifier la sous-chaîne visée. La comparaison complète couvre aussi
les identifiants, l'ordre, la langue et les protections, y compris les suites sans
correction. Les métadonnées natives non extraites, notamment les styles, doivent
être couvertes par la révision fournie par l'adaptateur.

## Application native

Le lot constitue une transaction indivisible, y compris lorsqu'une correction
porte sur plusieurs nœuds. Les changements sont triés par indice de segment puis
par position décroissants dans chaque suite. L'adaptateur construit les plages
natives et détermine l'ordre global éventuellement nécessaire entre suites.

L'adaptateur doit vérifier la révision à l'intérieur de l'opération atomique
native, préserver les styles et garantir l'annulation de l'ensemble en cas
de conflit ou d'échec d'écriture. Une validation JavaScript préalable
n'empêche pas une modification concurrente entre lecture et écriture. Si l'hôte
ne fournit pas de mécanisme équivalent, limiter l'intégration à l'analyse et à la
prévisualisation tant que cette garantie n'est pas résolue.

## Versionnement et suite

L'alpha publiée du cœur précède `applyTextChanges`. La configuration autonome
pointe donc vers le commit immuable `2d6af076bb32af2caa0e4171fbb7905396bd2c24`.
Ce module ne figure pas dans le workspace des paquets publiés et ne sera pas
publié par les workflows existants. Deno sert uniquement au développement ; le
code de production utilise des fonctions JavaScript standard.

La prochaine étape est un adaptateur de référence en mémoire, capable de simuler
une révision concurrente entre validation et commit, puis un premier adaptateur
natif dont les garanties auront été vérifiées. La publication du SDK nécessite
une nouvelle version du cœur et son intégration explicite aux builds JSR/npm.
