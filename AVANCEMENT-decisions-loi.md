# Avancement · ligne decisions-loi

Branche de sauvegarde · `travail/decisions-loi`. Source des décisions ·
`docs/decisions-par-la-loi-2026-10-04.md` (six décisions et la décision de
Manasse du 2026-10-04 sur le samedi).

## Fait

- **F8-D1 · samedi d'un pur paiement** · `retenues/jour-ouvrable.ts`
  (`NatureEcheance`, `estJourOuvrable` et `reporterAuJourOuvrable` qualifiés,
  DÉCLARATION par défaut), `natureEcheance: 'PAIEMENT'` sur les trois acomptes
  de l'art. 57 bis (`correspondance-retenues.ts`), câblé dans
  `prochaineEcheanceDeclarative`. Réserve (5) réécrite. Tests ·
  `report-jour-ouvrable.spec.ts`, `echeances-impot-societes.spec.ts` (le
  25 juillet 2026 reste le 25), `passes-f11-f8-d3.spec.ts`.

- **R2-A3 / R2-B6 · cases ZN à ZS** · `Exercice` porte
  `nombreEtablissementsPays`, `nombreEtablissementsHorsPays`,
  `premiereAnneeExercicePays`, `controleEntreprise` (enum `ControleEntreprise`),
  migration `20270142000000_fiche_r2_exercice`, route
  `POST /exercices/:id/fiche-r2` (`@ReferentielsAutorises(SYSCOHADA)`),
  feuille « Fiche R2 » de la liasse (« Non renseignée » à défaut, « X » sur la
  case du contrôle, deux ZQ), écran `FicheR2Exercice` dans Exercices. Tests ·
  `exercice/fiche-r2.spec.ts`, `liasse-syscohada.spec.ts`.

- **F14-D1 · entreprise du portefeuille de l'État** · `Tenant.entreprisePortefeuilleEtat`
  (oui, non, pas encore dit ; « oui » refusé hors SYSCOHADA), `Exercice.dateAssembleeGenerale`
  et `dateDepotEtatsPortefeuille` (migration `20270143000000_portefeuille_etat`, route
  `POST /exercices/:id/dates-portefeuille`, SYSCOHADA), `exercice/portefeuille-etat.ts`
  appliqué au planning (31 mars au lieu de six mois pour les étapes 21 et 23 d'un exercice
  clos au 31 décembre, étape 17 à 45 jours avant l'assemblée, PV à l'Administration des
  recettes non fiscales à +10 jours de l'assemblée déclarée, affectation à +60 jours du
  dépôt déclaré, `echeance: null` « Non calculée » sinon ; autre clôture dite). Écrans ·
  Paramètres du dossier (select), Exercices (`DatesPortefeuilleExercice`). Tests ·
  `portefeuille-etat.spec.ts`, `identifiants-referentiel.spec.ts`.

## Reste

- 20B / 29B à seize colonnes.
- R2-B5 · lignes répétables des notes 4, 13, 32, 33.
- O1a-D2 · liquidation.

## Décisions prises

- F8-D1 · LPF art. 110 bis al. 2 (dimanche, fériés reportés pour tout
  paiement) ; samedi ouvrable pour un pur paiement, décision de Manasse du
  2026-10-04. Seuls les acomptes de l'art. 57 bis sont qualifiés de pur
  paiement · les reversements de retenues se déclarent au guichet avec le
  paiement, laissés en DÉCLARATION faute de texte qui les dise « sans dépôt ».

- R2 · par EXERCICE (la décision le permet). ZP postérieure à l'année de
  clôture refusée (lecture d'OmegaX). Le nombre de cellules du groupe n'est
  PAS montré à côté de ZN/ZO (« peut être », facultatif).

- F14-D1 · point 5 (dividende prioritaire minier, 15 mai) NON codé · la décision le dit
  « à confirmer sur le texte même de la LF 2026 », que le corpus ne donne qu'en résumé
  sous deux numéros. Le lien « entreprise publique » et case ZQ public n'est pas proposé
  (facultatif). Jours calendaires (O.-L. n° 13/003 sans règle d'ouvrable).

## Vérification

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <base jetable> --exit-code
```


```bash
npx tsc --noEmit
npx jest src/modules/retenues
```
