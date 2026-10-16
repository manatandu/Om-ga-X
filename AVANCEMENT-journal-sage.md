# Avancement · ligne journal-sage

Journal exporté présenté comme l'édition de Sage (décision de Manasse du
2026-10-16, « Comme Sage (Recommandé) »). Branche de sauvegarde
`travail/journal-sage`, partie de `travail/export-periode` (1216eac) · elle
s'intègre APRÈS l'export par période.

## Fait

- `src/modules/exports/journal-edition.ts` · feuille « Journal », un bloc par
  journal (en-tête de quatre lignes · titre et période, journal et unité,
  tirage, mention du brouillard), sept colonnes, totaux du journal, saut de
  page, totaux de la période qui additionnent les journaux ; feuille « Piste
  de révision » (statut, saisie, validation, corrections) par `poserFeuille`.
- `export.service.ts` · `journalExcelEnFlux` réécrit · décomptes (lignes,
  écritures, `groupBy` journal et statut) avant le premier octet, deux
  passages par `ecrituresDuJournal` (clé date, pièce, id), chacun confronté à
  son décompte ; `bornesDuJournal` pour le format du jour.
- `classeur-en-flux.ts` · `poserFeuille` exporté.
- Tests · `journal-en-flux.spec.ts` réécrit (blocs, saut de page relu dans le
  XML, date de valeur, tiers, collectif, brouillard, piste, journal vide,
  formats, période longue), `test-ecritures-journal.spec.ts`,
  `cartouche-etats-periodiques.spec.ts`, `impressions-journal.spec.ts`.
- CLAUDE.md · § 5 (gel levé pour cette demande), « Journal et grand livre
  exportés en flux », § 10 ter.

## Décisions

- Date de valeur (AUDCIF art. 22, 4°) · dans le libellé de la ligne,
  « valeur au jj/mm/aaaa », et sa colonne dans la piste.
- Brouillard (art. 22, 2°) · dit au titre du bloc (JOURNAL, BROUILLARD,
  JOURNAL ET BROUILLARD, JOURNAL DE SITUATION · HORS LIVRE-JOURNAL), lignes
  en italique, mention en ligne 4.
- N° tiers · celui du tiers du compte individuel ; vide pour un collectif qui
  porte des comptes individuels (point 13).
- Page · en-tête d'impression `Page &P / &N` ; un saut de page sous les
  totaux de chaque journal.
- Jour · `DD/MM` quand la période tient en douze mois, `DD/MM/YY` sinon.
- Une pièce retirée ou ajoutée entre les deux passages · refus nommé, jamais
  une piste qui dirait un autre livre que le journal.

## Scénario sur vraie base

- Scénario sur vraie base (PostgreSQL jetable, serveur compilé, migration
  sans dérive), 34 contrôles au vert · journal de N avant la clôture
  (brouillard dit et en italique, tiers, totaux par journal et de la
  période), après la clôture (bloc du solde des comptes de gestion, totaux
  égaux à la balance report + mouvements + clôture, sauts de page relus dans
  le XML), N+1 (bloc de l'à-nouveau, opération reportée hors de janvier clos
  au 1er février « valeur au 25/01 », totaux égaux à la balance brouillard
  compris), filtre d'un journal sur un mois, impression différée du journal
  de N (même total, piste présente).

## Reste

- Bloc du § 3 des deux côtés.
- Relecture « échecs silencieux », premier tour · M1 à M3 et m1 à m6
  corrigés (b105a0e) · signatures confrontées, statuts par bloc, instant de
  lecture, collectif sans tiers, sélection dite, « & » échappés, date de
  Kinshasa. typescript-reviewer · rapport attendu.
- Intégration sur `main` après export-periode ; retirer cette fiche.

## Vérification

```bash
npx tsc --noEmit
npx jest src/modules/exports src/modules/journaux/impressions-journal.spec.ts src/modules/controles/test-ecritures-journal.spec.ts
```
