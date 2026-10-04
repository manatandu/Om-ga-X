# Avancement · ligne IS-CAS (corrections des cas chiffrés de l'IS)

Branche de sauvegarde `travail/is-cas`. Constat de départ ·
`docs/cas-chiffres/is.md` (cas rejoués le 2026-10-04 sur `main` 8f6f003).

## Fait

- C05 · report déficitaire rejoué dans l'ordre depuis le premier exercice du
  dossier (`src/modules/fiscalite/report-deficitaire.ts`), fenêtre de trois
  exercices perte par perte · 2030 rend 500 000 imputés et 150 000 d'impôt.
  Le test « consomme les déficits dans l'ordre » gelait le défaut (11 000) ·
  corrigé à 15 000, motif écrit au test.
- C09 · art. 12, al. 3 (`periode-creation.ts`) · période de création imposée
  à part (comptes intermédiaires au 31 décembre, lus au livre-journal ou
  DÉCLARÉS, `DossierFiscalExercice.resultatPeriodeCreationSaisi`, migration
  `20270145100000_resultat_periode_creation_is`), minimum de l'art. 57
  appliqué à la période, bénéfices déduits du premier exercice clos, acomptes
  de l'année suivante servis (`periodeCreation.acomptesExercice`). A11 ·
  refus nommé avec les deux lignes à passer (le constat ne porte qu'un impôt).
- C10 · premier exercice long ouvert en 2025 · impôt du premier exercice clos
  sous la loi (période imposable 2026), période de 2025 non chiffrée et dite.
- C01-bis · brouillard compté et chiffré (`definitif`, `brouillard`),
  bandeau « Calcul provisoire » à l'écran.
- C02 · lecture du chiffre d'affaires (701 à 707) dite dans toutes les
  branches de l'explication et sur chaque plafond assis sur le chiffre
  d'affaires (`LECTURE_CHIFFRE_AFFAIRES`).
- C12a · « égaux » corrigé · égaux APRÈS l'arrondi seulement, ordre gardé,
  compte 891 et lecture inverse (895) dits.
- C15 · avertissement du déficit d'avant 2026 servi dans la vue qui l'impute
  (`avertissementDeficitsSimules`), montant inchangé.

## Décisions prises, avec leur article (loi n° 23/053, compilation DGI au 19/07/2026)

- C09, minimum sur la période de création · OUI · art. 12, al. 3 (« l'impôt
  est néanmoins établi ») et art. 57 (« les sociétés », sans exception de
  période) ; chapitre 3 du Titre II, liquidation par les art. 56 et 57.
- C10 · la part de 2026 relève de la loi · art. 12, al. 3 (période de création
  imposée à part, bénéfices déduits du premier exercice clos) et art. 153
  (entrée en vigueur au 1er janvier 2026) ; la période de 2025, art. 152, 2°,
  texte antérieur hors corpus · non chiffrée.
- C15 · la perte imputée est la perte CONSTATÉE pour 2025 sous le texte de
  l'époque (art. 51, al. 1er « pertes constatées » ; art. 153, aucune
  disposition de recalcul), son imputation suit l'art. 51 en vigueur ·
  montant recalculé gardé, dit simulation, saisie invitée.
- C12a · ni l'art. 150 ni l'art. 57 ne fixent l'ordre arrondi / comparaison ·
  ordre actuel gardé, libellé corrigé.

## Questions rendues (corpus muet)

- C14 · l'art. 57 dit « Les sociétés » ; l'art. 1er distingue « les sociétés
  et autres personnes morales », l'art. 3, al. 2, 2° soumet à l'IS les
  personnes morales de droit public « n'ayant pas la forme d'une société
  commerciale ». Le minimum vise-t-il ces dernières ? Rien codé.
- C09, chiffre d'affaires du minimum du premier exercice clos · l'art. 12,
  al. 3 ne déduit que les bénéfices · exercice entier gardé (lecture d'avant),
  dit à l'écran.
- C09, perte de la période de création · « ces bénéfices » seuls viennent en
  déduction · la perte reste dans le premier exercice clos.

- Rejeu sur base jetable (`iscas_1`, port 8119) · seize dossiers à
  l'attendu ; C04 et C05 lus à travers les clôtures 2026 à 2029. Colonne
  « OmegaX » de `docs/cas-chiffres/is.md` mise à jour.
- `prisma migrate diff` contre le schéma · aucune différence.

## Second tour (2026-10-04)

- B1 · `baseAvantReport` n'applique l'art. 12, al. 3 qu'à l'IS (filtre
  `physique`, comme le calcul principal) · test et rejeu.
- B2, P1 · `deficitAnterieurSaisi` fait foi dans le rejeu des exercices
  suivants (`rejouerReport`), chaque perte avec la fenêtre de son exercice
  d'origine, déclarée (`deficitAnterieurOrigines`, liste à l'écran, somme
  égale à la saisie) ou bornée par prudence à la fenêtre la plus courte, et
  dite (« REPORT DÉCLARÉ SANS ORIGINE », « REPORT PERDU PAR PRUDENCE »).
  Avertissement C15 · « le reste à reporter à l'ouverture de cet exercice ».
- Relevés 1, 2, 3, 5, 6, 7, 8, 10 corrigés (voir `docs/cas-chiffres/is.md`,
  « Second tour »). Relevé 7 · règle prudente · refus nommé sur exercice clos
  pour le report déclaré, son origine et la période de création ; les autres
  champs restent ouverts, au journal d'audit comme avant.
- Rejeu sur vraie base (`iscas_2`) · seize cas inchangés, B1, B2, P1 sur
  trois exercices à travers leurs clôtures, à l'attendu.

## Relevés en attente

- (4) La perte de la période de création de 2025 (C10) reste dans la base de
  2026 · « ces bénéfices » seuls viennent en déduction (art. 12, al. 3) ; son
  sort sous le texte antérieur n'est pas tranché.
- (9) La date de valeur de l'art. 22, 4° de l'AUDCIF · une écriture d'impôt
  de la période de création passée après la clôture d'une période devra
  porter sa date de valeur distinctement.
- L'écriture A11 à deux lignes pour l'art. 12, al. 3.

## Reste

- Relecture (silent-failure-hunter, typescript-reviewer, react-reviewer)
  par la session principale avant intégration.

## Vérification

```bash
createdb -h 127.0.0.1 -p 55439 -U postgres iscas_1
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/iscas_1 npx prisma migrate deploy
DATABASE_URL=… JWT_SECRET=… PORT=8119 INSCRIPTION_PUBLIQUE=true node dist/main.js
OMEGAX_API=http://localhost:8119 node scripts/cas-chiffres/rejeu-is.mjs rejeu-is.json
dropdb -h 127.0.0.1 -p 55439 -U postgres iscas_1
```
