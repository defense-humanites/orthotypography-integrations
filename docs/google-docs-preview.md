# Google Docs : prévisualisation des requêtes natives

Le module expérimental `editor-sdk/src/google-docs.ts` constitue une première
étape vers un adaptateur Google Docs. Il compile un plan en requêtes textuelles
révisables ; il ne lit ni ne modifie aucun document distant.

## Choix de la cible

La documentation officielle de
[`documents.batchUpdate`](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate)
garantit l'application atomique du lot. `writeControl.requiredRevisionId` fait
échouer la requête si la révision n'est plus courante. Ce mécanisme correspond
au contrat de commit conditionnel du SDK. `targetRevisionId`, qui autorise une
résolution des modifications concurrentes par Google, ne convient pas à ce
contrat strict et n'est pas généré.

Les
[requêtes textuelles](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request)
utilisent des indices UTF-16 et acceptent un `tabId`. Le compilateur fournit
explicitement cet identifiant, ordonne les corrections par position décroissante
sur l'ensemble de chaque onglet et produit, selon le changement, une suppression
puis une insertion au même indice.

## Entrées et résultat

```ts
import { IMPRIMERIE_NATIONALE_RULES } from "@orthotypography/core";
import { prepareDocumentPlan } from "../experimental/editor-sdk/src/mod.ts";
import { previewGoogleDocsRequests } from "../experimental/editor-sdk/src/google-docs.ts";

// Exemple synthétique : dans un adaptateur, ces données viennent du même GET.
const snapshot = {
  documentId: "document-id",
  revision: "revision-id",
  runs: [{
    id: "paragraph-1",
    locale: "fr-FR",
    nodes: [{ id: "text-1", value: "Bonjour !" }],
  }],
};
const ranges = [{
  runId: "paragraph-1",
  nodeId: "text-1",
  tabId: "tab-id",
  startIndex: 1,
  endIndex: 10,
}];
const plan = prepareDocumentPlan(snapshot, IMPRIMERIE_NATIONALE_RULES);
const preview = previewGoogleDocsRequests(plan, snapshot, ranges);
// Examiner preview.body.requests et preview.body.writeControl.
```

L'appel revalide le plan complet. La table doit couvrir exactement ses nœuds,
avec les longueurs UTF-16 correspondantes, sans doublon ni chevauchement. Les
nœuds d'une suite doivent être contigus dans un même onglet. L'ordre des suites
fournies n'a pas besoin d'être l'ordre natif. Les identifiants de nœuds restent
locaux à chaque suite. Le résultat est profondément figé. Un plan sans
correction produit une liste vide ; aucun appel distant n'est nécessaire.

Le périmètre initial est le texte non vide du corps, à l'intérieur de
paragraphes. L'extracteur doit exclure les terminateurs de paragraphes et
séparer les suites aux frontières sémantiques. Les notes, en-têtes, pieds de
page et objets intégrés ne sont pas pris en charge. Les nœuds protégés
participent au contexte, mais ne reçoivent pas de corrections. Le compilateur
rejette les limites qui coupent une paire de substituts UTF-16, les chaînes mal
formées, les retours de ligne et les caractères de contrôle ou privés BMP dans
les insertions. Ce sous-ensemble est volontairement plus strict que les
caractères acceptés par Google.

## Garanties restant à construire

La table de plages est une entrée de confiance de l'extracteur : vérifier sa
cohérence numérique ne prouve pas qu'elle correspond au document distant.
L'identité, la révision, le texte et les plages doivent provenir de la même
lecture. Une table ancienne de mêmes longueurs n'est pas détectable localement.
Il faudra traiter explicitement les onglets, suggestions et éléments non
textuels lors de l'extraction.

Google détermine automatiquement le style des insertions à partir du voisinage.
Le compilateur ne rétablit pas encore les styles. La conservation des styles,
liens et autres propriétés natives doit donc être implémentée et testée avant
l'activation d'une écriture. La révision conditionnelle ne résout pas ce point.

Aucun transport HTTP, OAuth, retry ou commit automatique n'est inclus. Les tests
rejouent les requêtes sur des chaînes, vérifient leur résultat contre les
prévisualisations du SDK et couvrent les refus. Ils ne constituent pas une
validation dans Google Docs. L’extracteur dispose maintenant de fixtures
synthétiques (voir ci-dessous). La prochaine étape est la politique de
conservation des styles, puis un test natif.

Sources officielles consultées le 5 septembre 2026 : références `batchUpdate` et
`Request` ci-dessus. Le module reste hors des paquets publiés.

## Extraction des paragraphes

`extractGoogleDocsBody(response, locale)`, dans `src/google-docs-extract.ts`,
transforme une réponse JSON complète en `{ snapshot, ranges }`, sans accès
réseau. Les deux objets proviennent ainsi de la même lecture et sont
profondément figés.

```ts
import { extractGoogleDocsBody } from "../experimental/editor-sdk/src/google-docs-extract.ts";

// response : réponse complète de documents.get obtenue par le futur transport.
const { snapshot, ranges } = extractGoogleDocsBody(response, "fr-FR");
const plan = prepareDocumentPlan(snapshot, IMPRIMERIE_NATIONALE_RULES);
const preview = previewGoogleDocsRequests(plan, snapshot, ranges);
```

Le futur transport devra demander `includeTabsContent=true` et
`suggestionsViewMode=SUGGESTIONS_INLINE`, sans masque de champs. La fonction
exige des onglets renseignés, une identité documentaire et une révision. Elle ne
peut pas détecter un JSON tronqué qui conserverait une apparence cohérente : ne
pas fournir de réponse filtrée ou fabriquée dans un usage natif.

Chaque paragraphe forme une suite indépendante. Les limites entre `TextRun` sont
conservées ; seul le dernier retour à la ligne du paragraphe est retiré. Un
paragraphe vide conserve une suite sans nœuds. Les identifiants dérivent de
l'onglet et de l'indice source : ils sont locaux à la révision, pas persistants.
La langue est imposée explicitement pour l'ensemble de l'extraction ; aucune
inférence de langue ni de protection native n'est effectuée.

Le parcours inclut récursivement les onglets enfants. Les indices doivent être
contigus, entiers et conformes aux longueurs UTF-16. L'extraction échoue en
entier sur un tableau, une table des matières, un objet intégré ou positionné,
un saut de section autre que celui d'ouverture, ou une suggestion non vide. Les
styles textuels sont acceptés en entrée mais ne sont ni conservés ni
réappliqués. Les corps d'en-tête, de pied de page et de note restent hors du
périmètre ; une référence de note dans un paragraphe fait échouer ce paragraphe
et l'extraction.

Les tests utilisent des fixtures synthétiques conformes au sous-ensemble retenu.
Ils rejouent une sortie du compilateur, vérifient les onglets imbriqués, les
paragraphes vides et les refus. Aucun essai sur un compte Google n'a été
réalisé.

Références officielles vérifiées le 6 septembre 2026 :

- [documents.get](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get)
  pour les paramètres de lecture ;
- [Document, Tab et TextRun](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents)
  pour la structure, les suggestions et la révision. Google indique que la
  révision dépend de l'utilisateur et n'est disponible qu'avec un accès en
  modification ; elle ne doit pas être partagée entre utilisateurs.
