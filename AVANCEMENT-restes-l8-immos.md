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

## Relecture indépendante (trois bloquants, trois majeurs, trois mineurs)

- Cœur · `ImmobilisationService.anterieurNonDote` juge l'ANNUITÉ de
  l'antérieur ouvert (calcul de `passerDotation`), pour la sortie entière, la
  partielle et le remplacement d'une partie.
- B1 · remplacement imprévu · la structure est jugée avant le détachement, la
  partie née dans l'opération ne l'est pas (`sansJugerAnterieurs`).
- B2 · bien sans écriture d'acquisition · jugé seulement après sa première
  dotation dans OmegaX (exercice de reprise non gardé).
- B3 · `debutAmortissement(immo)` · l'annuité nulle ne réclame rien.
- M1 · unités d'œuvre sans relevé · rien réclamé.
- M2 · réévalué après · motif `motifDotationAnterieureHorsModule` (à la
  main, puis clôturer l'exercice).
- M3 · PV · « Quantité attendue au comptage », « Registre aujourd'hui »,
  `manquantATraduire` (dans `ecartEnUnites`), mention à part du manquant
  déjà traduit ; écran de la campagne de même.
- m1 · type changé dans le formulaire · représentant retiré, dit.
- m2 · représentant ou devise introuvables · nommés.
- m3 · fiche d'un bien non recopiée · dite telle au PV.

## Vérification

`npx tsc --noEmit && npx jest && npm run build`, puis dans `client/`
`npx tsc --noEmit && npm test && npm run build`.

Rejeu sur base jetable · `DATABASE_URL=… node scripts/rejouer-restes-l8-immos.cjs`
(points 1 à 4, à travers la clôture de 2025).
