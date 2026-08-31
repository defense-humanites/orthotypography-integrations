# Publication

Chaque paquet conserve le même nom et la même version sur JSR et npm. La
publication est déclenchée par une release GitHub et utilise la publication de
confiance. Elle reste bloquée tant que la variable de dépôt
`PUBLISH_ENABLED` n’est pas égale à `true`.

Avant la première publication :

1. publier une version compatible de `@orthotypography/core` ;
2. remplacer l’injection provisoire du moteur par un pont documenté vers cette
   version, sans supprimer le contrat structurel testable ;
3. valider les métadonnées JSR et npm ;
4. créer une release portant la version du paquet concerné.
