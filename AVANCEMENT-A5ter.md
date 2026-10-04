# AVANCEMENT · ligne A5 ter

Branche de sauvegarde `travail/a5ter`, partie de `main` 7e4aaa4. Fiche retirée
à l'intégration.

## Périmètre

Ligne A5 ter de `docs/suivi-immobilisations-verrouille.md`, plus les relevés
d'A5 bis renvoyés vers elle.

1. SYCEBNL · risque de change à moins d'un an hors du 194.
2. Titres de placement (50) et titres immobilisés (274) hors réévaluation.
3. Subdivisions 478 / 479 au SYCEBNL.
4. Le 54 en 4786 / 4797.
5. Message d'annulation dont l'issue ne lève rien.
6. Relevés d'A5 bis · (a) L1 et la contre-passation déjà juste ; (b) L1
   borné à l'exercice cible ; (c) contre-passation déclarée et
   `reevaluation-et-ecart-realise.ts` ; (d) contrôle 32 et OD déclarée qui
   inverse la banque ; (e) contre-passation sans à-nouveau qui fait foi.

## Fait

- Points 1 à 4 · familles de provision du SYCEBNL, subdivisions 478 / 479
  aux deux plans, 54 au 4786 / 4797, titres 274 et 50 hors réévaluation
  (`devises.service.ts`, `perimetre-reevaluation.ts`, specs
  `provision-change-ajustee`, `reevaluation`, `perimetre-reevaluation`,
  lexique client, CLAUDE.md).

- Point 5 · refus d'annuler sous une version d'ouverture · toutes les
  versions nommées, issue « retirez, annulez, déclarez de nouveau », jamais
  « une version nouvelle » (qui laissait l'ancienne et le refus).
- Relevés (a) et (b) · L1 retiré · les réévaluations du module de la cible
  sont des écarts EN PLACE (requête des écarts en place bornée au DÉBUT de
  la cible, `dateDebut <= cible.dateDebut`), dites en avertissement à la
  contre-passation, jamais à annuler.
- Relevé (c) · déjà fait par A6 bis (887e46b, sur `main`) ·
  `avertissementExtourneManquante` filtre `contrePassationDeclareeId: null`,
  spec `reevaluation-et-ecart-realise.spec.ts` l. 298 et 352. Rien à faire.

- Relevé (d) · contrôle 32 · la ligne de banque d'une OD DÉCLARÉE comme
  contre-passation, quand elle inverse EXACTEMENT l'écart passé sur ce compte
  (`disponibilitesInversees`), n'avance plus la dernière opération d'un
  compte fermé (`lignesDeDisponibilitesDesContrePassationsDeclarees`) ; un
  autre montant reste une opération ; lecture bornée dite.

- Relevé (e) · sans à-nouveau qui fait foi dans la cible, la contre-passation
  passe (jugée sur la clôture reconstituée) et le DIT · avertissement servi
  par le serveur, ajouté à la confirmation à l'écran (`DevisesPage`).

- Bloc du § 3 passé · serveur (typage, 750 suites, 10636 tests,
  `--maxWorkers=3`, construction), client (typage, 221 fichiers, 1802 tests,
  construction). Aucune migration.
- Vraie base (`a5ter_1`, serveur compilé sur 8114, script
  `scenario.mjs` du bloc-notes) · SYCEBNL et SYSCOHADA, N réévalué, validé,
  clôturé, N+1 contre-passé puis réévalué · 70 soldes lus contre le calcul
  à la main, tous concordants (détail au compte rendu) ; relevé (e) rejoué ·
  contre-passation avant la clôture de N, dite, 4791 de N+1 à +100 000
  avant la clôture puis soldé après.
- Test navigateur ajouté (`e2e/tests/devises.e2e.ts`, SYCEBNL A5 ter) ·
  les 19 tests des devises, la clôture et le règlement en devise passent
  sous Chromium contre le serveur compilé.

## Décisions, avec leur article

1. SYCEBNL, risque de change à moins d'un an · LE TEXTE TRANCHE, la règle
   « 194 seul » de CLAUDE.md était fausse. Fiche SYCEBNL du compte 19
   (Partie 2 ch. 3) · contenu « réalisation prévisible à plus d'un an » ;
   exclusions « les provisions correspondant à des risques à moins d'un an
   (utiliser 499 – Provisions pour risques à court terme) ». Fiche du 49 ·
   « 499 Provisions pour risques et charges à court terme (4991 sur
   opérations d'exploitation, 4998 sur opérations H.A.O.) », crédité par le
   659 (exploitation) ou le 839 (H.A.O.), repris par le 759 ou le 849. Fiche
   du 59 · 599 « Provisions pour risques à court terme à caractère
   financier », « exemple : provisions pour pertes de change », par le 679,
   repris par le 779. D'où, au SYCEBNL · exploitation 6591 / 4991 / 7591 ;
   H.A.O. (48) 839 / 4998 / 849 ; financier court (56) 6791 / 599 / 7791 ;
   financier long (18, 27) 6971 / 194 / 7971. Phrase de CLAUDE.md corrigée
   avec la citation. Une provision passée au 194 avant la ligne pour une
   créance se reprend d'elle-même au 7971 à la réévaluation suivante (rien
   à déclarer).
2. Titres 274 et 50 · TRANCHÉ. AUDCIF Titre VIII ch. 22 § 1.3 vise « les
   titres » sans distinction de classe (« prix d'acquisition, converti au
   cours du jour de l'opération ») ; la fiche du compte 50 range les titres
   aux 26, 274 et 50. Hors réévaluation, motif « § 1.3 ». Restent réévalués
   506 et 276 (intérêts courus · des créances de revenus, fiches 50 et 27).
   Le 508 « Autres titres de placement et créances assimilées » est lu comme
   titre (rangé sous « Titres de placement »).
3. Subdivisions 478 / 479 au SYCEBNL · TRANCHÉ par son plan (Partie 2 ch. 2,
   compte 47 · 4781 [47811, 47818], 4782, 4783 [47831, 47838], 4784, 4786,
   4788 ; 479 « 4791 à 4798, symétrique »), semés en détail. La racine
   générique rendait 47811000 / 47911000 pour tout. Le 48 est H.A.O. au
   SYCEBNL (47818 / 47838 / 47918 / 47938) ; au SYSCOHADA, dont le plan
   n'ouvre que 4781 « d'exploitation », il reste d'exploitation.
4. 54 · TRANCHÉ. Ch. 22 § 3.2.2 et fiche AUDCIF du compte 47 · « 4786 … et
   4797 … enregistrent les différences d'évaluation en contrepartie du compte
   54 » ; art. 58-2 · perte à l'actif, gain au passif, « provision
   financière » pour la perte latente · la provision reste 6791 / 4997
   (§ 2.3, court terme financier). Le SYCEBNL n'a pas de 54.

5. Annulation sous une version · le refus lit TOUTE version postérieure à
   la réévaluation ; seule la retirer le lève, et le retrait y est toujours
   ouvert (une version n'est figée que par une réévaluation non annulée dans
   sa période, donc postérieure, que le refus précédent nomme). AUDCIF
   art. 20, al. 2 (l'enregistrement exact suit l'inscription en négatif).
6. (a), (b) · une réévaluation de N+1 passée avant la contre-passation de N
   a mesuré la créance depuis son coût historique (`calculer` ne lit que les
   lignes en devise, l'écart de N étant sans devise) · son écart est juste et
   en place ; contre-passer N à l'ouverture de N+1 donne le montant juste
   (411 = 2 500 000 + 400 000 − 500 000 = 2 400 000, Guide Partie 2 ch. 22,
   Applications 84 et 85). Annuler et réévaluer de nouveau n'ajoutait rien.

7. (e) · la contre-passation se passe « au 01/01/N+1 » (Guide, Partie 2
   ch. 22, Application 84) ; aucun texte ne l'attache à la clôture de N.
   Refuser imposerait de clôturer N avant toute contre-passation · dit, non
   refusé ; la balance de N+1 s'équilibre à la clôture de N (AUDCIF art. 34,
   correspondance des bilans).

## Second tour (coordinateur, 2026-10-04)

1. BLOQUANT · 481 (aux deux) et 404 (SYSCOHADA) en FINANCIER COURT ·
   SYCEBNL 6791 / 599 / 7791, SYSCOHADA 6791 / 4997 / 7791 ; écart aux
   DETTES FINANCIÈRES 4784 / 4794 (lecture d'OmegaX · le plan ne nomme pas le
   481, « dettes d'exploitation » contredirait le § 1.1). Le H.A.O. du
   SYCEBNL garde 484, 485, 486, 488 (fiche du compte 48) · famille gardée.
   Gelé · dette de 1 000 USD à 2 000 000, clôture N à 2 100 · dotation
   financière en N, reprise financière en N+1, aux deux.
2. Intérêts courus (276 aux deux, 166 et 176 SYSCOHADA, 186 SYCEBNL) au court
   terme financier · fiche du compte 19 des deux plans (« à plus d'un an » ;
   exclusions → 499), fiche AUDCIF du 49 (« dette probable à moins d'un an »).
   Le 166, le 176 et le 186 ajoutés par la même règle (jumeau). L'étalement de
   l'art. 56 ne vise plus que le long terme.
3. Bascule SYCEBNL · `avertissementBasculeSycebnl` · reprise au 194 et
   dotation à court terme dans une même réévaluation, montants nommés, cause
   (fiche du compte 19), aucune écriture de reclassement.
4. Contrôle 32 · ligne par ligne (inverse exact au centime d'un écart passé,
   une ligne par écart), réévaluations non annulées seules. D6 refuse bien
   l'annulation tant qu'une contre-passation déclarée existe
   (`annulerSousVerrou`, refus « retirez la déclaration »).
5. Annulation · seules les versions dont le compte a été mouvementé par
   l'écriture de provision de la réévaluation, et de période postérieure.
6. Référentiel sans repli · `referentielDuDossier`, 404 nommé.
7. Motif du 508 · part « créances assimilées » sortie avec les titres,
   lecture d'OmegaX dite.

## Relevés en attente

- À DIRE AUX UTILISATEURS · au SYCEBNL, la réserve « non déclarée » s'impose
  désormais aux 4991, 4998 et 599 · un dossier qui y porte d'autres risques
  (un litige) déclare sa provision de change d'ouverture avant de réévaluer.
- QUESTION POUR MANASSE · le 54 de COUVERTURE (ch. 22 § 3.2.2, qui cite
  l'art. 57-3 ; le texte de l'Acte transcrit par la compétence numérote
  58-1 à 58-4 · numérotation divergente du corpus, signalée) se rapporte
  symétriquement à l'élément couvert, et la provision ne vaut que pour le
  risque non couvert ; l'or et les métaux précieux du 545 et les positions
  ouvertes isolées (§ 3.2.5, art. 57-4 · 6791 / 594 à la fiche du 54). Le module ne connaît pas la qualification et
  provisionne toute perte latente du 54 au 4997.

## Reste

- Relectures `silent-failure-hunter` et `typescript-reviewer` (§ 11) à
  l'intégration ; react-reviewer pour la ligne de `DevisesPage`.
- Bloc du § 3 complet, scénario sur vraie base aux deux référentiels.

## Vérification

```bash
npx tsc --noEmit
npx jest src/modules/devises src/modules/controles
cd client && npx tsc --noEmit && npx vitest run
```
