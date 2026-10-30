# Avancement · ligne restes-l8-immos

Trois corrections de défauts relevés à l'intégration de `restes-immos-budgets`
et `commercial-l8`. Aucune fonction nouvelle, aucune migration.

## Fait

1. PV d'inventaire · la quantité du registre et l'écart en unités imprimés
   (`inventaire/editions-inventaire.ts`, `unitesDeLaFiche` par `ecartEnUnites`,
   fiches lues avec `immobilisation.quantite`) ; colonnes « Quantité au
   registre » et « Écart en unités » à l'écran de l'édition
   (`client/src/lib/editions-inventaire.ts`) ; mentions du manquant et de
   l'excédent (AUDCIF art. 43).
2. Sortie entière · refus de l'exercice antérieur ouvert non doté, par la même
   règle que la partielle (`cession-partielle.ts`, `exerciceAnterieurNonDote`,
   `motifExerciceAnterieurNonDote`) ; source · fiche du compte 81 (AUDCIF
   Titre VII, « sous déduction des amortissements pratiqués », cumul « jusqu'à
   la date de sa cession », lu dans la compétence). Les unités d'un lot
   (`complementImpose`) restent jugées sur le lot.
3. Duplication d'un tiers · représentant et devise repris (règle de la fusion,
   `fusion-tiers.ts`), refus nommé s'ils ne passeraient pas la création ;
   encours maximum jamais, nommé.

## Vérification

`npx tsc --noEmit && npx jest && npm run build`, puis dans `client/`
`npx tsc --noEmit && npm test && npm run build`.

Aucune écriture comptable n'est créée ni modifiée (un refus ajouté avant le
verrou, une édition, une copie de formulaire) · pas de rejeu sur base.
