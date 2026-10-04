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

### Second tour (2026-10-04)

- F5 regelé dans `export-fpm.spec.ts` · exercice CLOS au jeu d'essai (601 à
  `clotureCredit` 3 000, 13 en face), colonnes C à F de sa ligne et sa feuille ;
  retirer `+ l.clotureDebit` fait tomber le test.
- Relevé A · contrôle des tiers contre une lecture INDÉPENDANTE des collectifs
  (agrégat en base sur le divisionnaire, ou les collectifs pour AUTRES), testé
  avec un compte sans tiers porteur d'un solde.
- Relevé B · curseur à plusieurs lots (`lotExport` abaissé dans le test, valeurs
  du curseur, aucun doublon) ; ligne « Solde à la balance générale » et écart au
  bas de chaque feuille de compte.
- Relevé C · `MAX_LIGNES_EXPORT` et `LOT_EXPORT` définis une fois
  (`classeur-en-flux.ts`) ; banc de 2 000 comptes écrit dans
  `docs/capacite-mesuree.md` · aucun plafond de feuilles (le nombre de feuilles
  ne pèse pas) ; RSS hors tas déjà hors marge sur le livre à plat de `main`,
  relevé OUVERT.
- Relevé D · mention du brouillard en ligne 7.
- Relevé E · route bornée `GET /ecritures/grand-livre/:compteId` ; l'écran passe
  au compte seul quand le livre complet est refusé ; jeton d'ouverture dans
  l'adresse du double-clic.
- Relevé F · « Tous » propose la famille à exporter, présélectionnée seule.
- Relevé G · paragraphe de CLAUDE.md reformulé ; libellé SYSCOHADA « Client »
  testé.
- LIASSE (décision de Manasse du 2026-10-04) · BALANCE N et BALANCE N-1 des
  quatre liasses dans la présentation FPM (`balance-fpm.ts`, en mémoire),
  CONTROLE BALANCE et CONTROLES repointés sur les rangs écrits, premier
  contrôle relibellé « Mouvements bruts avant la période » ;
  `relecture-balances-liasse.ts` rejoue chaque formule (plage = lignes de
  compte, colonne annoncée, somme refaite à la main, verdict « Equilibre » ou
  écart d'une balance faussée).

## Notes (second tour)

- Un tiers rattaché à un compte HORS classe 4 (16 emprunts, 27 prêts) n'entre
  dans aucune famille · AUTRES ne lit que la classe 4. Non tranché, à remonter
  si un cabinet en tient.
- La balance de la liasse se lit sur le LIVRE-JOURNAL seul et avant l'écriture
  qui solde les comptes de gestion, comme les états du classeur ; la balance
  exportée du même exercice porte ce solde dans ses mouvements (F5). Les deux
  diffèrent à dessein, la feuille de la liasse le dit en ligne 7.
- Le report d'un compte lettrable sort BRUT dans la liasse de N+1 (à-nouveau
  en DÉTAIL · 401 à 200 000 D / 300 000 C, solde net 100 000 C).

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

- Second tour, vraie base · export de N APRÈS sa clôture (52, 60, 70, 13, 40,
  41 confrontés au calcul à la main) ; liasses de N (clos) et N+1 aux deux
  référentiels · BALANCE N avant le solde des comptes de gestion, 13 absent,
  veille de chaque période, plages et verdicts de CONTROLE BALANCE et
  CONTROLES recalculés (`verifier2.py` du bloc-notes de session), tout juste.

## Reste

- Intégration sur `main` (bloc § 3 et tests navigateur), retrait de la fiche.
- Relectures des agents du dépôt (`silent-failure-hunter`,
  `typescript-reviewer`, `react-reviewer`) non lancées par cette session.

## Vérification

```bash
npx jest src/modules/exports/export-fpm.spec.ts
cd client && npx vitest run src/lib/export-livres.spec.ts
```
