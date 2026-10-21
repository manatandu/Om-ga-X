# Avancement · caisse provisionnée

Demande de Manasse du 2026-10-16 · « on ne peut pas payer un tiers par caisse
pour un montant supérieur au solde de cette caisse. Idem pour les virements.
[…] Pour la banque, la banque peut être négative ça passe ».

## Fait
- `src/modules/comptabilite/caisse-provisionnee.ts` · règle et message (fiche du
  compte 57 des deux plans, SYCEBNL Partie 2 ch. 3 classe 5 ; AUDCIF Titre VII).
- Branchée · contrôleur des écritures (saisie, modification), règlement des tiers,
  virement de fonds, paiement des salaires, avant la première pièce.
- `caisse-provisionnee.spec.ts` · 21 tests ; doublures des modules complétées.
- CLAUDE.md · § 5 (levée du gel) et paragraphe au § 6.

## Décisions
- 57 seul refusé ; 52 et 53 libres (découvert) ; 55 garde son avertissement
  (fiche 55, « débiteur ou nul » sans présomption).
- Dossier déjà créditeur non enfermé · seul ce qui l'enfonce est refusé.

## Vérifier
npx tsc --noEmit ; npx jest src/modules/comptabilite src/modules/reglements src/modules/virements-fonds src/modules/personnel src/common

## Relectures du 2026-10-16 · corrigées le 2026-10-21
- À-nouveau provisoire exclu de la lecture, il n'arrête plus la remontée ;
  seule une ouverture qui porte CETTE caisse l'arrête (A7 ter, B1).
- Lecture agrégée par jour en base (`$queryRaw`, § 8 bis), centimes entiers,
  `tenantId` sur la devise, jugement à la date inscrite (art. 22, 4°), après les
  contrôles propres de creer et modifier (option `jugerLaCaisse`), journal du
  règlement lu une fois, JSDoc du sommeil remise.
- Chemins jugés · acquisition d'un bien (bouquet compris), réimputation sur un 57.
  Transfert depuis la situation · non rejugé, il ne fait que repousser la date.
- Décision par la loi · SEULE UNE SORTIE NOUVELLE SE JUGE (fiche du 57,
  « débourser ») ; entrée réduite ou retirée jamais refusée, CAISSE_CREDITRICE
  la dit.

## Scénario sur vraie base (2026-10-21, vert)
Serveur compilé, PostgreSQL jetable, dossier SYSCOHADA, N puis N+1 à travers
la clôture · sortie au-delà refusée (il manque 50 000), sortie antidatée qui
rend une sortie postérieure impossible refusée, sortie égale au disponible
admise, entrée réduite admise même caisse créditrice, N+1 avant la clôture de
N (à-nouveau provisoire et OD du premier jour sans caisse) lit N, après la
clôture l'à-nouveau réel porte 121 000 (lu en base), un franc de plus refusé,
banque découverte admise, virement caisse vers banque et règlement par caisse
au-delà refusés, approvisionnement puis règlement partiel admis.

## Reste
- silent-failure-hunter et typescript-reviewer (second tour), intégration, déploiement.
