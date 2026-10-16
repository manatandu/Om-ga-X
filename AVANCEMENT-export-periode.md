# Avancement · ligne export-periode

Balance et grand livre sur une PÉRIODE de l'exercice, à l'écran et en Excel.
Gel levé par Manasse le 2026-10-16 (« l'autorisation « Lève le gel pour
l'export par période » »), décision écrite au § 5 de CLAUDE.md et au § 10 de
`docs/plan-version-1.md`.

Branche `travail/export-periode`, partie de `main` d461c28.

## Les quatre conditions, et leur article

1. Solde de départ gardé · AUDCIF art. 19 (balance · « le solde à
   l'ouverture, le cumul des mouvements débiteurs et créditeurs depuis
   l'ouverture, le solde à la date considérée »).
2. Le titre dit l'extrait · AUDCIF art. 19 (grand-livre · « les différents
   mouvements de l'exercice »).
3. Numéroté et daté · AUDCIF art. 22, 7°.
4. Période dans un exercice · l'à-nouveau compterait deux fois ; brouillard
   dit (art. 22, 2°).

Aux deux référentiels · SYCEBNL art. 3 n'écarte que le quatrième tiret de
l'art. 19 et n'écarte pas l'art. 22.

## Décisions de conception

- **Période** · `du` et `au` facultatifs, chacun borné à l'exercice (refus
  nommé en 400 au-delà, illisible ou `du` après `au`). Une période qui couvre
  l'exercice entier N'EST PAS un extrait · balance et livre complets,
  inchangés, sans numéro.
- **Balance de la période** · trois colonnes, chaque ligne dans une seule ·
  « avant » = report à-nouveau (drapeau de clôture, hors solde de gestion)
  daté au plus tard `au` + toute ligne datée avant `du` ; « mouvements » =
  lignes ordinaires de `du` à `au` ; « clôture » = solde des comptes de
  gestion de `du` à `au`. Une période égale à l'exercice rend EXACTEMENT la
  balance de l'exercice (même convention, « report brut »).
- **Grand livre de la période** · par la date · une ligne « Report au
  <veille> » par compte (somme brute des lignes datées avant `du`), puis les
  lignes de `du` à `au` (à-nouveau compris s'il y tombe, comme le livre de
  l'exercice). Un compte sans ligne dans la période mais avec un report a son
  bloc. Total du livre = total de la balance de la période (tout ce qui est
  daté au plus tard `au`) · le contrôle « Solde à la balance générale » le
  vérifie.
- **Numérotation** · table `ExtraitPeriode` (suite continue par dossier,
  verrou du dossier), un numéro pour chaque extrait REMIS · fichier Excel
  produit, ou impression de l'écran par « Imprimer l'extrait ». Aucun lien
  vers l'exercice ni le compte (libellé figé) · un extrait ne doit jamais
  enfermer l'arrêt à la dissolution, comme l'impression du journal l'a fait
  (sage-l1, M6). Fichier interrompu · numéro gardé, échec dit, jamais
  rendu au suivant.
- **Hors ligne** (dit au rapport) · balance et grand livre des TIERS par
  période, livre « à plat » par période (refus nommé), impression différée
  par période.

## Fait

- Décision écrite (CLAUDE.md § 5, plan-version-1 § 10).

## Reste

- Serveur · `periode-extrait.ts` (pur), filtres de la période dans
  `balance-trois-colonnes.ts`, `EcritureService.balance` et grand livre,
  `ExtraitPeriode` (schéma, migration, registres), routes écran et export,
  FPM (cartouche, colonne « Mouvements au <veille> », report par compte).
- Client · période sur les onglets Balance et Grand livre, export et
  « Imprimer l'extrait ».
- Tests · unitaires, scénario sur vraie base à travers une clôture, e2e.
- Relectures, bloc § 3, intégration, déploiement vérifié.

## Vérification

Bloc § 3 · `/tmp/claude-0/-home-user/ac8187b8-6ad7-5085-a3b1-d7551f9bf74d/scratchpad/l6m-bloc.sh`
(à recopier pour cette copie).
