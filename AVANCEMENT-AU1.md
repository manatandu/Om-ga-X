# AVANCEMENT · ligne AU1 (audit · AU1 et AU2)

Branche de sauvegarde `travail/au1`, partie de `main` d32e22a. Fiche retirée à l'intégration.

## Fait

- AU1 reproduit sur vraie base (SYSCOHADA, serveur compilé, port 8116) · lettrage manuel d'une ligne
  d'à-nouveau PROVISOIRE de N+1 (201), clôture de période de N+1 au 31/01 (201), clôture de N refusée
  (« délettrez-les »), délettrage refusé (ligne figée) · N enfermé.
- AU2 reproduit sur vraie base · bilan d'ouverture importé et validé dans N+1, clôture de N · deux
  à-nouveaux, client 600 000 au lieu de 300 000, banque 400 000, résultat 1 000 000.

- AU1 corrigé · lettrage d'une ligne d'à-nouveau provisoire refusé par tous les chemins (`verifierLignes` ·
  manuel, complément, pré-lettrage confirmé, module ; l'automatique et le pré-lettrage ne le proposaient
  déjà pas, le Règlement des tiers le refusait, le pointage écarte tout à-nouveau). Dossiers hérités · la
  clôture reporte lettrage et pointage sur la ligne qui remplace (`apparierTenues`), groupe figé sans
  équivalent laissé partiel et dit, pointée sans équivalent refusée (dépointer).
- AU2 corrigé · `issueDeLOuverture` (clôture) · brouillard refusé (valider), concordant rien ajouté, N sans
  écriture l'import fait foi, divergent déclaration RECTIFIER (négatif + report exact) ou CONSERVER (motif sur
  `Exercice.motifOuvertureSuivanteConservee`, migration 20270141000000). Provisoire · rien quand une ouverture
  existe. Aperçu `GET /exercices/:id/ouverture-suivante`, déclaration à l'écran Fin d'exercice.
- Tests · `cloture-annuelle.spec.ts` (AU1, AU2), `report-a-nouveau.spec.ts` (fonctions pures),
  `lettrage.service.spec.ts` (AU1), e2e `ouverture-suivante.e2e.ts` (3 parcours, verts en local).
- Bloc § 3 passé · tsc et jest serveur (752 suites, 10 721 tests), build ; client tsc, vitest (1 804), build ;
  `prisma migrate diff` sans différence.
- Vraie base, deux référentiels, à travers N, N+1 et N+2 · AU2 (egal, ecart → RECTIFIER, conserver, vide,
  brouillard puis valider), AU1 (hérité apparié, hérité orphelin figé), provisoire avec import.

- SECOND TOUR (R1 à R10, et R4 révisé).
  - R1 · périmètre de l'ouverture de N+1 · toute écriture datée ou valorisée au premier jour, toutes origines,
    hors provisoire et hors écriture touchant un compte de gestion (classes 6 à 8). Pourquoi · l'art. 34 compare
    des BILANS, une ressaisie par OD en fait partie autant que l'import ; « un bilan ne contient aucun compte de
    gestion » (règle de l'import). Limite écrite · une opération de trésorerie ou de tiers datée du premier jour
    (férié légal, ordonnance n° 23-042, art. 1er) se lit comme ouverture · l'aperçu nomme chaque ligne, la
    redater au lendemain l'en sort. RECTIFIER inscrit en négatif TOUTES les lignes du premier jour des comptes
    divergents. Vraie base · import 600 000 + négatif lié + OD 300 000 → client 300 000 (jamais 600 000), OD seule
    → concordant, import faux + OD correctrice → concordant.
  - R2 · confrontation par (compte, devise), francs ET montant en devise · un import sans devise contre un report
    en USD est un écart nommé « en USD ». Vraie base · RECTIFIER rend 1 500 USD au client de N+1, et la
    réévaluation de N+1 passe 300 000 au 479 (1 500 × (2 600 − 2 400)).
  - R3 · `apparierTenues` · exact, puis échéance relâchée seulement si la candidate est unique (et sans rivale),
    devise jamais relâchée. Vraie base · deux factures de même montant → délettré, une seule → appariée.
  - R4 révisé et R5 · sans équivalent sûr, le groupe est DÉLETTRÉ et le pointage défait, dans la transaction de
    clôture, écrits sur l'exercice (`Exercice.defaitsParLaCloture`, journal d'audit avec motif, suppression du
    groupe auditée), lignes marquées `LigneEcriture.aRelettrerDepuis`, compte rendu nommé (compte, paiement, date,
    « à relettrer »). Le pré-lettrage PROPOSE le relettrage (candidates de même montant, même devise, même
    exercice), confirmé par le comptable, toléré en période close (`estRelettrageDeCloture`), jamais en exercice
    clos. La déclaration de TVA NOMME le paiement non rattaché tant que son exercice est ouvert
    (`paiementsARelettrer`, mention « PAIEMENT NON RATTACHÉ À SA FACTURE »).
  - R6 · RECTIFIER nomme les lignes lettrées ou pointées qu'il inscrit en négatif (aperçu et compte rendu) et
    lettre chaque négatif avec la ligne libre qu'il annule (groupe `MODULE`, `poserGroupeSoldeDuModule`).
  - R8 · CONSERVER fige motif ET positions sur l'exercice ; contrôle d'INFORMATION
    `OUVERTURE_DIFFERENTE_DE_LA_CLOTURE_DECLAREE` dans N+1 ; `justificatifSolde` et `balanceCumulee` rendent
    `rupturesOuverture`, l'écran du justificatif le dit.
  - R9 · lectures bornées (50 000 lignes, refus nommé au-delà), écarts servis 200 au plus avec `total` et
    `tronque`. R10 · aperçu en échec, la déclaration reste proposée avec le motif ; ouverture nulle, report entier.
  - TVA (demande de Manasse) · cas (a) ligne définitive équivalente · lettrage reporté, 160 000 de TVA de la
    prestation exigibles en février N+1 (date du paiement). Cas (b) sans équivalent (facture lettrée en N par un
    avoir après le provisoire) · la TVA de la facture suit l'avoir de N (rien de perdu) ; le règlement de N+1 est
    délettré, nommé à la déclaration de février, 41110101 créditeur de 1 160 000 à la balance âgée (aucune tranche),
    rien au relevé ni aux relances (rien de dû) ; reporté en N+2 au détail, il s'y lettre avec la facture F3
    (201). Cas (b) à facture ouverte (échéance ambiguë) · délettré, NOMMÉ entre les deux gestes, relettré par le
    pré-lettrage en période close, TVA de 160 000 datée de février (SYSCOHADA). Au SYCEBNL, le 706 n'est pas lu
    « service » (table des produits au SYSCOHADA seul, passe F3a), la taxe est à la facture (décembre) · la mention
    le dit (« sauf si la déclaration de sa facture l'a déjà comptée »).
  - Phrases TVA corrigées en « exigible » · commentaire de `tvaEnAttenteEncaissement`, deux textes de
    `DeclarationTvaPage.tsx`. Laissées · « TVA due » (montant net à payer) et « TVA d'amont due à des
    fournisseurs », qui ne parlent pas d'exigibilité ; « le droit à déduction prend naissance » est le mot de
    l'art. 37, al. 1.

- TROISIÈME TOUR (décision du coordinateur, limite de R1) · le périmètre de l'ouverture de N+1 se borne aux
  écritures du premier jour passées en À-NOUVEAU ou au journal d'OPÉRATIONS DIVERSES (type général), et à ce qui
  les corrige (`corrigeEcritureId`), hors provisoire et hors classes 6 à 8 (`ESTUNE_OUVERTURE`). Une ouverture de
  bilan ne passe jamais par un journal d'achats, de ventes ou de trésorerie (AUDCIF art. 34 · on compare des
  BILANS d'ouverture). Gelé par `cloture-annuelle.spec.ts`. Vraie base, deux référentiels · import faux + encaissement
  de banque du 1er janvier · la banque n'est ni confrontée ni inscrite en négatif, banque 100 000, client 200 000.
- Seconde question RÉGLÉE (coordinateur) · la mention « paiement non rattaché » disparaît de la déclaration une fois
  l'exercice du paiement clos · acceptable, car la déclaration du mois de l'encaissement l'a nommé tant que son
  exercice était ouvert.

## Reste

- Intégration sur `main` (appelant), relectures des agents.
- Relevés, sans les traiter ·
  - R4 (ancienne règle, remplacée) · un groupe laissé partiel laissait un reste ouvert de sens contraire jusqu'en
    N+2 · l'issue proposée à Manasse était « laisser partiel et le dire » ; le coordinateur l'a remplacée par le
    délettrage.
  - R7 · la rectification (comme le report définitif) s'écrit au premier jour même s'il est dans une période close,
    sans date de valeur (AUDCIF art. 22, 4°).
  - AU3 (reste) · l'IMPORT d'une balance ne porte aucune devise · R2 nomme l'écart à la clôture et RECTIFIER rend la
    devise, mais un dossier dont N n'est pas tenu dans OmegaX (CONSERVER, ou N vide) garde un import sans devise ·
    il faut que l'import lise une colonne devise et montant en devise.
  - Balance âgée · une ligne d'un groupe partiel ou un paiement non lettré créditeur sort en solde sans tranche
    (`montants: []`).
  - TVA · un paiement en avance lettré en N+2 avec une facture postérieure est daté par le moteur au mois de la
    facture, alors que l'art. 26, al. 3 (acompte avant les débits) et l'art. 25, 2° le datent à l'encaissement ·
    hors périmètre.
  - `balanceCumulee` · une ressaisie de l'ouverture par OD au premier jour (R1) entre dans les mouvements du cumul
    pluriannuel et le double · hors périmètre, rare.

## Décisions prises

- AU1 · AUDCIF art. 22, 2° · l'à-nouveau provisoire n'est jamais validé, donc jamais au livre-journal · il
  ne se lettre pas (même parti qu'A6 bis au Règlement des tiers). Art. 22, 3° · la clôture de période n'est
  jamais refusée ; l'issue des dossiers hérités est le report du lettrage sur la ligne qui remplace.
- AU2 · AUDCIF art. 34 / SYCEBNL art. 16, 4) · une seule ouverture ; AUDCIF art. 20, al. 2 · la correction
  d'un import faux passe par l'inscription en négatif puis l'enregistrement exact, jamais par un écart en
  une ligne, jamais par le retrait d'une écriture validée (art. 22, 2°). Lequel des deux bilans est faux
  est un FAIT que le texte ne tranche pas · le cabinet le déclare (RECTIFIER ou CONSERVER, motif).

## Vérification

- scénarios `au1b.mjs`, `au2.mjs`, `au2p.mjs` (scratchpad de la session), grappe jetable 55439, bases `au1_*`.
- `npx jest src/modules/exercice src/modules/lettrage` ; e2e `tests/ouverture-suivante.e2e.ts`.
