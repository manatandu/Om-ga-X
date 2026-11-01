# Avancement · releves-simulation-majeurs

Périmètre · `docs/suivi-immobilisations-verrouille.md`, « Relevés en attente »,
entrée « SIMULATION DU LOGICIEL COMPLET (2026-10-08) », points MAJEUR seulement
(G2, SMT D2, F D2 K1, F D3, MAG-LIEN, H D1, PA1, J1, J2) et le MAJEUR relevé
après le second tour de G1 (585 du groupe, et le point « À VÉRIFIER » sur AU2).
Gel levé par Manasse le 2026-11-01 (« Enchaîne le point 3 »).

## Fait

- PA1 · liste du prévisionnel ramenée aux onze pièces de la note circulaire
  n° 003/2013, section B.II, dans l'ordre du texte (test du même commit).

- J1 · le cumul de consolidation lit le 13 par la règle des états individuels
  (`resultatDeLExerciceAuxClassesDeGestion`) · un résultat antérieur non
  affecté y est des capitaux propres (lu sous 130), plus le résultat.
- J2 · TFT consolidé · la CAFG retranche le poste des 478 et 479 retraités
  (`ECARTS_CONVERSION_INDIVIDUELS_RESULTAT`), et un contrôle par le bilan en
  échec devient un motif du jeu non publiable.
- F D2 K1 · `DEPRECIATION_IMMO_HORS_MODULE` et `REEVALUATION_IMMO_HORS_MODULE`
  retranchent aussi, sur les comptes dont l'à-nouveau est passé, ce que le
  module a posté dans les exercices antérieurs (dépréciations de la table ;
  écritures de réévaluation, de transfert de l'écart et leurs annulations).
- F D3 · TFT SYSCOHADA · la reprise D 28 / C 798 d'une révision rétroactive
  se reconnaît par sa liaison (`mouvementsDeRevisionPlan`), relue en sens
  inverse en FF et FG, et ne déclenche plus la réserve du 798. Le TFT
  SYCEBNL ne lit pas le débit du 28 (« sans flux »), rien à y faire.
- G2 · canevas de trésorerie · chaque ligne va à l'exercice OUVERT de la
  cellule qui contient sa date (N+1 ouvert avant la clôture de N), le
  canevas nomme tous les exercices ouverts.
- D2 · NOTE 4 des deux SMT · le règlement d'un fournisseur se ventile sur la
  nature de sa facture par la lecture du compte de résultat
  (`partsDuReglement`) ; au SYSCOHADA la colonne « Ventes » lit les comptes de
  SR1 (`COMPTES_RECETTES_SUR_VENTES_SMT_SYSCOHADA`, une liste pour les deux).
  Au SYCEBNL, les recettes restent découpées par la maquette (colonne
  « Cotisations » au 701 seul) · le fondement de son poste dit déjà que les
  deux découpages ne se recoupent pas ; rien de plus n'est tranché.
- MAG-LIEN · un mouvement lié exige que l'écriture porte le compte de l'article
  au débit (entrée) ou au crédit (sortie), et que la valeur des mouvements
  liés à elle sur ce compte et ce sens (sortie valorisée par la méthode) ne
  dépasse pas ce qu'elle y porte.
- H D1 · verrou du garnissage de la vitrine (`Tenant.garnissageDemonstrationDepuis`,
  migration `20270247000000_verrou_garnissage_demonstration`, diff vérifié),
  pris au marquage ou à la reprise, rendu en `finally` ; un second « Ouvrir »
  reçoit un 409 qui dit depuis quand ; tombé, repris après trente minutes.
- Rejeu sur vraie base · `scripts/rejouer-releves-simulation-majeurs.cjs`
  (PostgreSQL 16 jetable, serveur compilé, à travers la clôture de 2025) ·
  K1 (2026 ne nomme que les 50 000 passés à la main) et F D3 (FG de 2026 à
  zéro après une reprise de 100 000), TOUT CONCORDE.
- 585 du groupe (relevé après le second tour de G1) · DÉJÀ CORRIGÉ par le
  paquet 1 (B2, A8, m4) · `GroupeService.virements585DuGroupe` ne s'arrête
  plus que sur une ouverture NON NULLE (`ouverturePasseeNonNulle`), et
  `filtreOuverturePasseeAuPremierJour` écarte la contre-passation de
  réévaluation reconnue par sa liaison (`HORS_CONTRE_PASSATION_DU_MODULE`,
  `reevaluationExtourne`) et la contre-passation déclarée
  (`lignesDeContrePassationDeclaree`). Tests · `virements-585-groupe.spec.ts`
  (« A8 », « m4 », « B2 »). Le refus à tort ne se produit plus, le message
  n'a donc plus à nommer l'exercice précédent ouvert.
- AU2, « À VÉRIFIER » · DÉJÀ CORRIGÉ · la clôture lit l'ouverture de N+1 par
  le même filtre (`ouvertureDejaPassee`, exercice.service.ts), qui écarte la
  contre-passation de réévaluation du module et celle déclarée ligne à ligne ;
  RECTIFIER ne l'inscrit plus en négatif (commentaire de
  `ouverture-passee.ts`, client à 2 900 000 et 479 à -100 000 cités ;
  `cloture-annuelle.spec.ts`, filtre `reevaluationExtourne: { is: null }`).

## Reste

Rien dans le périmètre.

## Décisions et points ouverts

- D2, recettes du SMT SYCEBNL · la colonne « Cotisations » (701) n'est pas
  élargie aux créances d'adhérents (411) · le fondement du poste du compte de
  résultat dit déjà que les deux découpages ne se recoupent pas, et la
  maquette n'ouvre pas de colonne « Ventes ». Non tranché, rien codé.
- H D1 · trente minutes avant de reprendre un garnissage tombé, convention
  d'OmegaX.


## Commandes de vérification

- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <base jetable> --exit-code`
- `DATABASE_URL=<base jetable migrée> node scripts/rejouer-releves-simulation-majeurs.cjs`
- `npx tsc --noEmit`, `npx jest`, `npm run build` (racine et `client/`).
