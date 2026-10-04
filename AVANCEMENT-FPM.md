# Ligne FPM · balances et grands livres dans la présentation du cabinet

Branche de sauvegarde `travail/fpm`, partie de `main` 7e4aaa4. Fiche retirée à
l'intégration.

## Fait

- `src/modules/exports/presentation-fpm.ts` · cartouche des lignes 2 à 6,
  en-têtes `FF4F81BD` blanc gras, Arial 9, `#\ ##0.00` (espace insécable),
  `dd\/mm\/yy`, zéro = cellule vide, filets verticaux portés par la colonne,
  noms de feuille, liens `HYPERLINK` (l'écrivain en flux d'ExcelJS 4.4.0 range
  tout lien en relation externe et perd `location`, vérifié dans
  `stream/xlsx/sheet-rels-writer.js`).
- `src/modules/exports/export-fpm.service.ts` · balance des comptes (feuille
  par compte, retour à la ligne exacte), balance des tiers par famille
  (sous-total par collectif lu dans le plan, total général, contrôle et écart),
  grand livre des comptes FPM, grand-livre des tiers (nouveau). Tout en flux,
  volume compté avant le premier octet (balance + grands livres), lecture par
  lots (`pageApres`).
- `src/modules/comptabilite/familles-tiers.ts` · FOURNISSEURS (40), CLIENTS
  (41), SALARIES (42), AUTRES (classe 4 hors 40 à 42, rattachés à un tiers).
- Routes · `exports/balance` (`grandsLivres=non`), `exports/balance-auxiliaire`
  (`type` requis, TOUS refusé), `exports/grand-livre` (`format=plat` pour
  l'ancien), `exports/grand-livre-tiers`. `ecritures/balance-auxiliaire`
  accepte SALARIES et AUTRES.
- Retrait des deux balances bâties en mémoire d'`ExportService`.
- Écrans · double-clic balance vers grand livre (Journal, Balance auxiliaire),
  choix du format en select avec bulle Aide.

## Décisions

- Unité · `monnaieDuJeuLegal` (loi n° 23/053 art. 141, 1° ; AUDCIF art. 17, 1°).
- Classe 9 hors des « Totaux de la balance », une ligne par division
  mouvementée nommée par l'intitulé du plan du dossier (SYCEBNL Partie 2 ch. 1 ·
  « mémoire, sans impact bilan/résultat » ; AUDCIF Titre VII ch. 1).
- Sous-titre CLIENTS au SYCEBNL · « Adhérent et client-usager » (411 Adhérents,
  412 Clients-usagers), « Client » au SYSCOHADA.
- Brouillard dit au libellé (« · brouillard »), la présentation n'ayant pas de
  colonne Statut (audit final F99).
- Totaux de soldes en solde NET (présentation relevée).

## Vérifié

- Bloc § 3 · serveur (tsc, 10 541 tests, build), client (tsc, 1 806 tests,
  build).
- Rejeu sur vraie base (PostgreSQL jetable, serveur compilé, API) · SYCEBNL et
  SYSCOHADA, écritures en N, clôture de N, écritures en N+1 au brouillard,
  exports de N+1 relus par openpyxl · « Mouvements au » de N+1 = clôture de N
  compte par compte, chaque lien mène à une feuille existante, chaque retour à
  la bonne ligne, total de chaque grand livre = sa ligne de balance, contrôles
  tiers et grand livre contre la balance générale nuls, brouillard dit,
  format plat servi, « TOUS » refusé en 400.

## Reste

- Intégration sur `main` (bloc § 3 et tests navigateur), retrait de la fiche.
- Relectures des agents du dépôt (`silent-failure-hunter`,
  `typescript-reviewer`, `react-reviewer`) non lancées par cette session.

## Vérification

```bash
npx jest src/modules/exports/export-fpm.spec.ts
cd client && npx vitest run src/lib/export-livres.spec.ts
```
