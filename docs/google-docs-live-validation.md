# Google Docs : validation réelle du 6 septembre 2026

## Résultat et périmètre

Le SDK au commit `cf17660ca38aa0a284855974d9bed671c6eeb62f`, avec le cœur
`2d6af076bb32af2caa0e4171fbb7905396bd2c24`, a été exécuté sous Node 24.19.0
contre un document Google Docs jetable créé avec autorisation. Le transport
utilisé est le connecteur Google Drive de la session ; aucun transport ni
identifiant OAuth n'est ajouté au SDK.

Le scénario utilise `IMPRIMERIE_NATIONALE_PUNCTUATION_RULES` et la langue
`fr-FR`, pas le preset typographique complet. Il couvre deux paragraphes dans
l'onglet principal, un paragraphe dans un onglet enfant, leurs paragraphes vides
terminaux, des frontières de styles et un emoji avant les corrections.

- Huit corrections ont produit 24 requêtes : huit suppressions, huit insertions
  et huit restaurations de style, dans un seul lot conditionné par révision.
- La relecture correspond exactement au plan pour les cinq paragraphes : 117
  unités UTF-16 et leurs styles bruts, caractère par caractère. Les styles
  observés incluent l'héritage vide, le gras, l'italique et une couleur RGB.
- L'ordre et l'identité des onglets, ainsi que leur relation parent-enfant, ont
  été conservés. Une insertion allonge le premier paragraphe et décale les
  suivants ; les corrections restent correctement positionnées.
- Une nouvelle extraction et normalisation de la relecture produisent zéro
  correction et zéro requête.
- Le rejeu du lot avec sa révision initiale est refusé par Google : HTTP 400,
  `INVALID_ARGUMENT`, révision requise différente de la dernière révision. La
  réponse documentaire complète après ce refus est identique à celle lue avant
  le rejeu, révision comprise. Ce test utilise la première écriture comme
  modification intervenante ; il ne simule pas un second utilisateur connecté.

Un premier scénario a été refusé localement parce qu'une correction remplaçait
la ponctuation finale et touchait la frontière du paragraphe. Aucune requête de
correction n'a été envoyée pour ce plan. Un suffixe a été ajouté au texte du
scénario pour tester le sous-ensemble intérieur autorisé, sans assouplir le SDK.

## Particularité du connecteur

`get_document` expose ici une liste aplatie avec `tabId`, `parentTabId`, `body`
et `suggestionsViewMode`, et non la forme native `tabProperties`, `documentTab`,
`childTabs` attendue par l'extracteur. Le banc d'essai a explicitement
reconstruit les enveloppes et les liens parent-enfant à partir de cette lecture
complète, sans modifier les corps, indices ou styles. La révision et l'identité
du document proviennent de la même réponse. Aucun masque de champs n'a été
utilisé.

Cette conversion locale n'est pas un adaptateur public et ne démontre pas que le
connecteur préserve toutes les propriétés d'une réponse native quelconque.
L'extracteur conserve donc son contrat strict de réponse native complète ; il
n'accepte pas implicitement les données aplaties. Un futur transport devra
traiter cette différence explicitement et refuser les topologies incohérentes ou
les réponses incomplètes.

Les requêtes transmises sont celles produites par
`previewGoogleDocsStyledRequests`, sans réécriture de leur contenu.
`preview.body.writeControl` est passé au paramètre `write_control` du
connecteur, avec `requiredRevisionId` uniquement. Aucun retry ou repli sans
styles n'a été employé.

## Régression conservée dans le dépôt

`experimental/editor-sdk/tests/fixtures/google_docs_live.ts` conserve les corps
avant/après observés et la topologie reconstruite. Les identifiants
documentaires, d'onglets et de révisions sont remplacés par des valeurs de
fixture ; les URL et métadonnées sans rapport avec le scénario sont omises. Ce
fichier est une fixture dérivée de lectures réelles, pas une réponse native
brute archivée.

`google_docs_live_test.ts` vérifie le nombre de corrections et de requêtes, puis
compare le texte et les styles source au résultat observé, indépendamment de la
fusion éventuelle des TextRun par Google. Un second test vérifie l'idempotence.
Ces tests restent hors ligne : ils ne réexécutent pas le conflit distant. Les 48
tests SDK passent localement sous Deno 2.9.6 et Node 24.19.0, avec résolution
locale du cœur au commit épinglé (et transformation TypeScript sous Node).

## Limites et suite

Ce résultat valide ce scénario, pas tous les styles acceptés par le compilateur.
Les tailles et familles de polices, les autres couleurs et indicateurs, les
listes, les liens, les suggestions, les tableaux, les contrôles, les sélections,
l'annulation et les effets de collaboration restent hors de cette validation.
Les refus et le périmètre expérimental existants restent en vigueur.

La prochaine étape est un contrat de transport explicite : lecture complète,
validation de la réponse, écriture conditionnelle, classification des conflits
et relecture. Il devra rester indépendant des connecteurs de cette session et ne
jamais reconstruire un plan ancien après un conflit. Aucun paquet n'a été publié
et aucun adaptateur natif général n'est annoncé.
