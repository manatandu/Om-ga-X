# AVANCEMENT · ligne A7 bis, partie 1 (défauts du moteur de TVA)

Branche de sauvegarde · `travail/a7bis`. Partie 2 (récupération de l'art. 52
sur créance irrécouvrable) hors de cette passe.

## Textes lus (compétence fiscalite-rdc, code-general-2026)

- O.-L. n° 10/001, art. 25, 2° · exigibilité « au moment de l'encaissement du
  prix, des acomptes ou avances, pour les prestations de services et les
  travaux immobiliers ».
- O.-L. n° 10/001, art. 26 al. 1 et 3 ; décret n° 011/42, art. 61 et 62 ·
  régime des débits, inchangé.
- O.-L. n° 10/001, art. 37 al. 1 ; décret n° 011/42, art. 96 · la déduction
  naît à l'exigibilité chez le fournisseur.
- Décret n° 011/42, art. 52 (troisième tiret, même règle) et art. 57
  (« l'encaissement s'entend de la perception des sommes [...] notamment
  avances, acomptes et règlement pour solde »).

## Fait

- (1) `exigibilite` · une créance (ou dette) non lettrée n'est plus un
  comptant ; part réglée dans l'écriture (classe 5) ou imputée sur 419 / 409
  exigible à sa date, le reste en attente. Symétrique côté déduction.
- (2) une tranche par règlement dans un groupe à une seule facture (B-2).
- Créance de N réglée en N+1 par sa ligne d'à-nouveau (`relierAuxANouveaux`).
- Mémoire · `LiquidationTva.tvaEncaissementFigee` (migration
  20270136000000, diff vide), `repartirEncaissement` (période liquidée =
  son figé ; report une fois au premier jour libre ; trop-déclaré absorbé).
- TRANSITION (décision écrite) · figé `null` = ancien moteur · ligne non
  lettrée à l'instant de la liquidation réputée déclarée EN ENTIER à la
  facture ; sinon aux dates de ses règlements.
- Tests · `tva-encaissement-a7bis.spec.ts` (20 cas chiffrés),
  `tva-exigibilite.spec.ts` adapté (deux acomptes), mocks complétés ;
  `e2e/tests/tva-encaissement.e2e.ts`.
- Vraie base `a7bis_1`, serveur compilé, clôture 2026 traversée · tous les
  montants attendus retrouvés (voir rapport).

- SECOND TOUR (BLOQUANT du coordinateur) · le recouvrement d'une créance
  douteuse est l'encaissement de ses factures DÉSIGNÉES · table
  `FactureCreanceDouteuse` (migration 20270139000000, diff vide), geste
  « Désigner les factures » (POST/GET `/creances-douteuses/:id/factures`,
  et `factures` facultatif au reclassement), `motifRefusDesignation` ;
  moteur · tranche par recouvrement non annulé et validé, au prorata
  recouvré / reclassé ; perte sans effet ; recouvrement sans facture
  désignée NOMMÉ. Vraie base · 80 000 en mars N+1 (50 % de F2), 290 000
  sans facture nommés, recouvrement d'avril annulé = 0, F4 désignée après
  la liquidation de mars reportée une fois en avril (40 000), mai 0 ;
  4432 −120 000, 4441 −200 000 en N+1.

- TROISIÈME REPRISE (trois BLOQUANTs de la vérification indépendante) ·
  (1) groupe à plusieurs factures · règlements au prorata des factures
  (`exigibiliteDuGroupe`), recouvrements rattachés par identifiant de ligne
  hors de tout groupe (`groupeAvecRecouvrements` retiré), encours propre
  (`ouvertDeLaLigne`) ; (2) facture à deux échéances · même rattachement,
  et une facture lettrée en partie seulement ne date plus que sa part
  lettrée ; tout recouvrement non reçu par une ligne de TVA est NOMMÉ ;
  (3) « Retirer la désignation » (POST `:id/factures/:designationId/retirer`,
  motif, `update` unitaire, exercice clos admis ; colonnes `retireeLe`,
  `retireePar`, `motifRetrait`, clé unique retirée, migration
  20270139000000 réécrite, jamais appliquée hors de cette branche, diff
  vide). Relevés · liste sans facture bornée avec total et `tronque`,
  `take` sur les relations imbriquées, `ParseUUIDPipe`, GET d'une créance
  annulée qui liste ses désignations passées. Vraie base · décembre N
  68 965,52 ; mars N+1 451 034,48 (251 034,48 + 160 000 + 40 000), seul
  Lusamba nommé (290 000) ; retrait au journal d'audit avec son motif,
  avril 40 000 reporté une fois, mai 0 ; 4432 nul, 4441 −560 000 en N+1.

- QUATRIÈME REPRISE (décision · aucun prorata entre factures d'un groupe) ·
  prorata retiré, groupes lus par la règle de `main` (`datesDuGroupeDeMain`),
  gelé par `tva-groupes-comme-main.spec.ts` contre les valeurs relevées en
  faisant tourner le moteur de `main` (partiel à une facture, biens et
  services, avoir dans le groupe, deux factures, facture B ajoutée, liquidation
  ancienne relue, à-nouveau F0 + F1 sans double compte) ; avoir dans un groupe
  à une facture · lu comme `main` (pas une perception) ; désignation d'une
  ligne au lettrage partagé REFUSÉE avec le motif fixé, et une ligne désignée
  entrée ensuite dans un tel groupe voit ses recouvrements NOMMÉS (`motifs`) ;
  BLOQUANT 4 · `declareParAncienMoteur` reconstitue l'ancien moteur (fraction
  cumulée au dernier règlement vu à l'instant de la liquidation) · 32 000,
  64 000, puis 64 000 en mai, 160 000 au total. Deux échéances dont une seule
  lettrée · règle de la branche gardée, `main` faussait le montant (160 000
  déclarés au paiement d'une échéance de 580 000, 80 000 encaissés).

- CINQUIÈME REPRISE · (1) `declareParAncienMoteur` lit l'instant de saisie
  de l'écriture de la taxe · saisie après la liquidation, 0 (facture du 20
  mars saisie le 15 avril · mars 0, mai 160 000, comme main) ; (2) faute de
  colonne datant un lettrage, le journal d'audit (Lettrage, MODELES_AUDITES)
  sert de signal · reste modifié ou groupe supprimé après une liquidation de
  l'ancien moteur, reconstitution INCERTAINE nommée avec son montant ; (3)
  lecture des groupes de l'à-nouveau alignée (instant de saisie, avoirs via
  `FILTRE_LIGNES_D_AVOIR`).

## Relevés en attente

- Signal d'incertitude · un journal d'audit dont un maillon a manqué (échec
  avalé par conception) taira la modification ; un délettrage suivi d'un
  relettrage avant la liquidation suivante est nommé pour chaque liquidation
  de l'ancien moteur postérieure à la suppression du groupe né avant elle.

- Recouvrement plafonné en silence (la part qui dépasse ce qui reste en
  attente n'est pas nommée, vers le rattachement des recouvrements).
- Désignation retirée après une liquidation figée · la TVA figée reste
  sans mention.
- `ouvertDeLaLigne` ignore les paiements de N+1 portés sur l'à-nouveau.
- Recouvrement annulé après liquidation · non nommé.
- Facture sur le compte collectif contre créance sur le compte individuel ·
  refus « pas au compte » sans issue.
- Une facture dont une échéance est lettrée et l'autre non se lit par
  prorata TTC (part lettrée datée par son groupe).
- La liste des factures candidates prend les 200 lignes les plus récentes
  du compte, `tronque` le dit.
- Plusieurs exercices de report lettrés pour une même facture (chaîne N,
  N+1, N+2) · reconstitués ensemble seulement si aucun groupe n'est
  partagé, sinon la taxe reste en attente sans être nommée.
- Transition · une ligne saisie avant une liquidation de l'ancien moteur et
  lettrée après (« compléter ») est réputée vue par elle.

## Reste (hors partie 1)

- Partie 2 · art. 52 sur créance irrécouvrable ; groupes
  facture-reclassement déjà posés (le reclassement y est lu comme un
  règlement).
- Limites dites · compte au mode SOLDE réglé après la clôture (aucun lien
  facture / à-nouveau) ; groupe défait puis refait après une liquidation
  de l'ancien moteur ; ligne ajoutée par « compléter » à un groupe né avant
  une liquidation de l'ancien moteur.

## Vérification

```
npx tsc --noEmit && npx jest --maxWorkers=2 src/modules/tva
```
