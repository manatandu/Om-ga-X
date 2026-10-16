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
- **Balance et grand livre de la période · UNE règle** (relecture du
  2026-10-16, `ecrituresAvantLaPeriode` / `ecrituresDansLaPeriode`) · au
  REPORT, ce qui est daté avant `du`, et l'à-nouveau (drapeau de clôture,
  hors solde de gestion) daté de `du` même, sauf si `du` est le dernier jour
  de l'exercice (virement du résultat non affecté) ; en MOUVEMENTS, le reste
  de la période, une écriture de clôture datée dans la période comprise
  (bilan d'ouverture importé en cours de période, virement du résultat) ; en
  CLÔTURE, le solde des comptes de gestion de la période. La colonne « au
  <veille> » est DATÉE · la règle « drapeau d'abord » de la première version
  mettait au report ce que le grand livre du même classeur montrait en
  ligne. Un compte sans ligne dans la période mais avec un report a son bloc,
  à l'écran comme en Excel.
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
- Serveur · `periode-extrait.ts`, `filtresDesTroisColonnesDeLaPeriode`,
  balance et grand livre de l'écran sur une période, `ExtraitPeriode`
  (schéma, migration `20270185000100`, registres), `POST
  /extraits-periode/impression`, exports Excel (cartouche, « Mouvements au
  <veille> », report par compte, compte seul).
- Client · période sur Balance et Grand livre, export et « Imprimer
  l'extrait ».
- Relectures, premier tour (échecs silencieux, TypeScript, React) · deux
  BLOQUANTS d'écran corrigés (chiffres d'une autre période montrés et
  imprimables ; compte à report seul masqué), règle unique balance et livre,
  audit complet de l'extrait, jour de Kinshasa, extrait vide refusé avant
  son numéro, combinaisons refusées, libellés.
- Scénario sur vraie base à travers la clôture de N (N et N+1, soldes contre
  le calcul à la main, numéros 1 à 5, refus, journal d'audit) · 0 écart
  (`scratchpad/ep-scenario.mjs`). `prisma migrate diff` · aucune dérive.

## Relevés en attente (non bloquants, gardés pour la suite)

- Registre des extraits sans route de lecture (`GET` borné) · lisible au
  journal d'audit seulement ; une impression dont la boîte est annulée reste
  « remise ».
- Licence échue (lecture seule) · « Imprimer l'extrait » refusé (POST) quand
  l'export Excel (GET) numérote · même défaut que l'impression du journal ;
  un GET qui numérote se déclenche aussi par HEAD ou préchargement.
- Le refus de volume du grand livre complet se reconnaît au statut 400, pas à
  un code · un refus de période qui arriverait en course serait lu comme un
  refus de volume.
- Le numéro d'un extrait exporté n'est dit qu'au fichier, pas à l'écran.
- Pied du grand livre · l'écran dit « Total de la période » (report exclu),
  l'Excel « Total du compte » (report inclus).

## Reste

- Bloc § 3 des deux côtés, second tour de relecture, tests navigateur.
- Intégration sur `main` (fiche retirée), déploiement vérifié.

## Vérification

Bloc § 3 · `scratchpad/epb-bloc.sh` · scénario · `scratchpad/ep-serveur.sh`
puis `node scratchpad/ep-scenario.mjs` (serveur sur 8082, base jetable
`omegax_rs_ep`).
