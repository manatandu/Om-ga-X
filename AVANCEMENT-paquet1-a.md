# AVANCEMENT · paquet 1, ligne A (états et clôture)

Branche `travail/paquet1-a`, partie de `main` e31f4de. Fiche tenue à chaque
point fini (CLAUDE.md § 5), retirée à l'intégration.

Ordre de travail · A8, A10, A9, A5, A6.

## Commandes

```bash
# Scénario (non committé ici, tenu par le coordinateur)
#   /home/user/wt-passe/scripts/passe-v1/scenario-paquet1-a.mjs
# AVANT (main) et APRÈS (cette copie, après npm run build)
PAQUET1_A_POINTS=A8,A8M,A1,A4,A7,A3,A2 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1a_avant 8761 paquet1-a /tmp/claude-0/sim/p1a-avant.json
PAQUET1_A_POINTS=A8,A8M,A1,A4,A7,A3,A2 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1a p1a_apres 8762 paquet1-a /tmp/claude-0/sim/p1a-apres.json
# Specs touchés
npx tsc --noEmit
npx jest src/modules/exercice/ouverture-passee.spec.ts src/modules/exercice/cloture-annuelle.spec.ts \
  src/modules/lettrage/reconduction-lettrage.spec.ts src/modules/groupe/virements-585-groupe.spec.ts \
  src/modules/exercice/arret-dissolution.spec.ts
npx jest src/modules/etats-financiers src/modules/etats-financiers-syscohada src/modules/exports
npx jest src/modules/comptabilite/balance.spec.ts src/modules/notes-annexes src/modules/consolidation src/modules/ifrs
cd client && npx tsc --noEmit && npx vitest run src/components/resultat-anterieur-non-vire.spec.ts src/lib/postes-de-flux-vides.spec.ts src/specs-sans-react.spec.ts
```

## Fait

### A8 · la contre-passation d'une réévaluation au 01/01 de N+1, N ouvert

REPRODUIT sur vraie base contre `main`, par les deux voies (module et main
déclarée). SARL SYSCOHADA, vente 1 000 USD et achat 500 USD au cours 2 800,
réévaluation au 31/12/2026 au cours 2 900 (client 2 900 000, 479 -100 000,
478 50 000, 4991 -50 000), 2027 ouvert par ses reports provisoires,
contre-passation au 01/01/2027 pendant que 2026 est ouvert (A5 ter), puis
clôture de 2026.

AVANT (main) · `A8 · aperçu · aucune déclaration requise` lu `true` (attendu
`false`) ; `aucune position divergente` lu 10 (attendu 0) ; `clôture de 2026
sans déclaration · passe` lu `false` (400 « L'exercice suivant porte déjà une
ouverture (OD n° 2) qui diffère du bilan de clôture … sur 10 position(s) ») ;
avec la seule issue offerte, RECTIFIER · 2027 client 2 900 000 (attendu
2 800 000), fournisseur -1 450 000 (attendu -1 400 000), 479 -100 000 et 478
50 000 (attendus à zéro), balance équilibrée · montant faussé en silence. Même
résultat pour la contre-passation faite à la main et déclarée (A8M).

DÉCISION PAR LA LOI · AUDCIF art. 34 (« le bilan d'ouverture d'un exercice
doit correspondre au bilan de clôture de l'exercice précédent ») · le bilan de
clôture de 2026 porte l'écart au 478 et au 479, l'ouverture aussi ; la
contre-passation est une OPÉRATION de N+1 qui suit l'ouverture (Guide
SYSCOHADA, Partie 2 ch. 22, Application 84, « Contrepassation de l'écart au
01/01/N+1 : 411 · 4781 »). Elle n'appartient donc pas à la position
d'ouverture que AU2 confronte au report.

CORRECTION ·
- `src/modules/exercice/ouverture-passee.ts` · le filtre partagé
  `filtreOuverturePasseeAuPremierJour` écarte, dans son `AND`, la
  contre-passation du MODULE reconnue par sa LIAISON
  (`reevaluationExtourne`), et son négatif (annulation D6, qui garde la
  liaison). Une contre-passation annulée seule est déliée · elle et son
  négatif restent et se soldent. Nouvelle fonction
  `lignesDeContrePassationDeclaree` · pour une OD DÉCLARÉE (qui peut grouper
  d'autres gestes, un bilan d'ouverture saisi à la main compris), seules ses
  lignes sur les comptes de l'écart (lus comme la déclaration les juge,
  `partagerLignesDEcarts`, `montantsAContrePasser`) sortent de l'ouverture.
- `src/modules/exercice/exercice.service.ts` · `ouvertureDejaPassee` lit la
  déclaration de chaque écriture du périmètre et écarte ces lignes-là, ligne à
  ligne ; une écriture dont il ne reste aucune ligne ne compte plus.

LECTEURS du filtre, chacun testé ·
- clôture AU2 et aperçu (`ouvertureDejaPassee`) · `cloture-annuelle.spec.ts`
  (attente du filtre mise à jour, deux tests A8 sur la déclaration, dont l'OD
  qui groupe aussi un bilan d'ouverture) ;
- reconduction du lettrage (`reconduction-lettrage.ts`, reprend `AND` et
  `lignes`) · `reconduction-lettrage.spec.ts` (doublure complétée, test A8) ;
- 585 du groupe G1 (`GroupeService.virements585DuGroupe`) ·
  `virements-585-groupe.spec.ts` (test A8, la remontée vers l'exercice
  précédent ouvert n'est plus arrêtée) ;
- arrêt à la dissolution · `arret-dissolution.spec.ts` (doublure complétée) ;
- états financiers sans exercice précédent
  (`EcritureService.ouverturePasseeAuPremierJour`) · inchangé en pratique
  (ne joue que sans N-1) ;
- évaluation du filtre lui-même · `ouverture-passee.spec.ts` (nouveau, huit
  tests, évaluateur qui lève sur tout opérateur non honoré).

APRÈS · 18 contrôles sur 18 concordent pour A8 et pour A8M
(`/tmp/claude-0/sim/p1a-apres.json`, `/tmp/claude-0/sim/p1a-apres-a8m.json`) ·
clôture sans déclaration, 2027 client 2 800 000, fournisseur -1 400 000, 478
et 479 à zéro, 4991 -50 000, résultat 2026 au 13 -1 350 000, balance
équilibrée.

### A1 · un exercice clôturé avant le virement du résultat non affecté, lu en N-1

REPRODUIT sur vraie base contre `main`, aux deux référentiels (SYSCOHADA
normal, poste CJ ; SYCEBNL associations, poste CH). Dossier né en 2025,
produit 2025 de 1 000 000 (clôturé, rien à virer), produit 2026 de 400 000,
2026 clôturé sans affectation. L'état d'un dossier clôturé AVANT la correction
du virement (qu'aucune route ne produit plus) est reconstitué par psql sur la
base jetable du banc · virement de 2026 retiré, report de 2027 rendu au 13.

AVANT (main) · `A1 · bilan 2026 · résultat antérieur non viré nommé` concorde
(1 000 000, le bilan de N le disait déjà) ; `bilan 2027 · CJ N-1 reprend R1 +
R2` concorde (1 400 000) ; mais `bilan 2027 · la colonne N-1 nomme le résultat
2025 non viré` lu `null` (attendu 1 000 000), `au poste CJ` lu `null`, et
`liasse 2027 · l'anomalie de la colonne N-1 est levée` lu `false` (la feuille
ANOMALIES ne portait que « Aucune anomalie détectée »). Même chose au SYCEBNL
(CH). 6 écarts sur 18.

DÉCISION PAR LA LOI · « chacun des postes des états financiers comporte
l'indication du chiffre relatif au poste correspondant de l'exercice
précédent » (AUDCIF art. 34, dernier tiret ; SYCEBNL art. 16, 7)) · la colonne
N-1 reprend le poste tel que l'exercice précédent l'a présenté, RIEN N'EST
RECALCULÉ ; la fiche du compte 13 (AUDCIF Titre VII ; SYCEBNL Partie 2 ch. 3)
dit que ce résultat antérieur aurait dû être viré au report à nouveau · la
colonne le DIT.

CORRECTION ·
- `src/modules/etats-financiers/resultat-de-l-exercice.ts` ·
  `resultatAnterieurNonVireDuComparatif` · même règle que
  `resultatAnterieurNonVire`, lue sur l'exercice précédent, seulement quand la
  colonne vient de lui (`EXERCICE_N1`) et qu'il est clôturé ; motif propre à la
  colonne N-1 (fiche du compte 13, art. 34 ou art. 16, 7), « rien n'est
  recalculé »).
- `etats-financiers.communs.ts` · `exercicePrecedentCloture`.
- les cinq bilans (associations CH, projets CC, SMT SYCEBNL HB, SYSCOHADA
  normal CJ, SMT SYSCOHADA SP2) servent `resultatAnterieurNonVireN1`.
- `src/modules/exports/export.service.ts` · `anomalieResultatAnterieurNonVire`
  lève aussi l'anomalie « Résultat net de l'exercice · colonne N-1 » (A_TRAITER)
  dans les cinq liasses.
- écran · `client/src/lib/resultat-anterieur-non-vire.ts` (phrases),
  `AvisResultatAnterieurNonVire` rend l'avis de la colonne N-1, passé par les
  cinq écrans de bilan. L'écran du SYSCOHADA normal ne rendait PAS l'avis de N
  non plus (seule la liste des comptes à solder le portait) · il rend
  désormais les deux, comme les quatre autres écrans.

TESTS · `resultat-de-l-exercice.spec.ts` (règle, deux plans, quatre cas
muets) ; câblage dans les cinq specs de service (exercice précédent clôturé
nommé, ouvert muet, premier exercice muet) ; `liasse-syscohada.spec.ts`
(anomalie de la colonne N-1) ;
`client/src/components/resultat-anterieur-non-vire.spec.ts` (texte affiché,
composant, cinq écrans) · les specs client ne chargent pas React
(`specs-sans-react.spec.ts`, le jest de la racine les lit avant
l'installation du client), le texte se teste sur ses phrases et le composant
sur sa source.

APRÈS · 18 contrôles sur 18 concordent pour A1 (et A8, A8M toujours au vert,
`/tmp/claude-0/sim/p1a-apres-a1.json`).

### A4 · l'ouverture d'un premier exercice clôturé, lue avant le virement du 13

REPRODUIT sur vraie base contre `main`, aux deux référentiels (SARL SYSCOHADA
normal, postes CJ / CH ; association SYCEBNL, postes CH / CG). Dossier repris
· bilan d'ouverture importé au 01/01/2026 (banque 12 000 000, fonds
10 000 000, 13100000 « résultat 2025 non affecté » 2 000 000), produit 2026 de
500 000, 2026 clôturé (la clôture vire les 2 000 000 du 13 au 12100000).

AVANT (main) · `A4 (SYSCOHADA) · CJ N-1 · le résultat 2025 au 01/01/2026` lu
0 (attendu 2 000 000) ; `CH N-1 · aucun report à nouveau au 01/01/2026` lu
2 000 000 (attendu 0). Même chose au SYCEBNL (CH N-1 lu 0, CG N-1 lu
2 000 000). 4 écarts sur 16 ; total du passif N-1, bilan N et ZA concordaient
(`/tmp/claude-0/sim/p1a-avant-a4.json`).

CAUSE · la clôture passe le virement du résultat antérieur non affecté à la
date de FIN de l'exercice, avec le drapeau de clôture et sans celui du solde
des comptes de gestion · la balance le range en colonne REPORT
(`filtresDesTroisColonnes`), où le bilan de N doit le lire. Or l'ouverture
d'un exercice sans N-1 tenu était lue sur cette même colonne
(`lignesALOuverture(lignesN)`) · elle présentait le virement comme fait au
premier jour.

DÉCISION PAR LA LOI · « Le bilan d'ouverture d'un exercice doit correspondre
au bilan de clôture de l'exercice précédent » (AUDCIF art. 34 ; SYCEBNL
art. 16, 4) et Partie 4 ch. 1 § 1.4 pour le comparatif) ; le virement est une
opération « en fin d'exercice » (fiche du compte 13, AUDCIF Titre VII et
SYCEBNL Partie 2 ch. 3) · il n'appartient pas à l'ouverture. La colonne N-1
d'un dossier repris porte le 13 tel que le bilan d'ouverture le porte.

CORRECTION ·
- `EcritureService.balance` · option `avantLaCloture` · les trois colonnes
  bornées aux écritures datées AVANT la date de fin de l'exercice (lue sur
  l'exercice du dossier, 404 nommé sinon), où la clôture écrit les siennes ;
  `arreteAu` se garde à côté.
- `etats-financiers.communs.ts` · `chargerOuverture` (balance du
  livre-journal avant la clôture, ramenée à l'ouverture), que
  `comparatifDuBilan` et `lireOuverturePasseeEnOd` reçoivent à la place des
  lignes de N.
- les cinq bilans (associations, projets, SMT SYCEBNL, SYSCOHADA normal, SMT
  SYSCOHADA), leurs comptes de résultat (motif de la colonne N-1) et les deux
  tableaux des flux (positions d'ouverture de N et de N-1, mentions) lisent
  `chargerOuverture`, seulement quand l'exercice précédent n'est pas tenu. Au
  SYSCOHADA, les soldes N-1 des variations (`soldesAnterieurs`) se lisent sur
  l'ouverture passée par l'appelant, plus sur le report de N.
- Choix de la borne · « avant la date de fin » et non « au premier jour » ·
  l'API d'import accepte une date de reprise dans l'exercice
  (`dateOperation`), et la borne au premier jour aurait retiré de
  l'ouverture un bilan d'ouverture importé en cours d'exercice (l'écran,
  lui, l'importe toujours au premier jour). Seul ce que la clôture date de
  la fin sort.

TESTS · `balance.spec.ts` (borne sur les trois colonnes, date d'arrêté
gardée, exercice d'un autre dossier refusé) ; `etats-financiers.communs.spec.ts`
(`chargerOuverture`) ; un test par bilan dans les cinq specs de service, plus
l'appel de l'ouverture par bilan, compte de résultat et tableau des flux
(associations, SYSCOHADA) et la colonne N-1 du tableau des flux de N+1
(SYSCOHADA) · les six tests de bilan tombent sur les services d'avant.

APRÈS · 70 contrôles sur 70 concordent pour A4, A1, A8, A8M
(`/tmp/claude-0/sim/p1a-apres-a4.json`).

### A7 · le tableau des flux des associations et l'ouverture passée en OD au premier jour

REPRODUIT sur vraie base contre `main`, aux deux référentiels, à travers une
clôture. Dossier sans exercice précédent ni report · bilan d'ouverture saisi
en OD au 01/01/2026 (banque 12 000 000, fonds 10 000 000, 13100000
2 000 000), produit 500 000, puis 2026 clôturé et le tableau de 2027 lu.

AVANT (main) · SYCEBNL, tableau de 2026 · `mention d'ouverture nomme l'OD du
premier jour` lu `false` (servi « Aucun exercice précédent ni bilan
d'ouverture… l'ouverture est présumée nulle »), `ZA laissée vide` lu `false`,
`FM (apports) laissé vide` lu `false` (FM servi 10 000 000, la reprise lue
comme un encaissement de la dotation), `le motif de FM nomme la pièce` lu
`false`. Tableau de 2027, colonne N-1 · `FM N-1 laissé vide`, `ZA N-1
laissée vide`, `motif de la colonne N-1` lus `false`. Et LE SYSCOHADA AUSSI,
à travers la clôture · son tableau de 2026 concordait, mais la colonne N-1 de
2027 lisait l'OD comme des flux (FK, ZA, motif · trois écarts) · le virement
du 13 passé par la clôture, en colonne report, faisait passer 2026 pour un
exercice ouvert par un report (le défaut d'A4). 10 écarts sur 20
(`/tmp/claude-0/sim/p1a-avant-a7.json`).

DÉCISION PAR LA LOI · « le Bilan d'ouverture d'un exercice doit correspondre
au Bilan de clôture de l'exercice précédent » (SYCEBNL art. 16, 4) ; cadre
conceptuel § 3.3.1.2.4) · une position passée en OD au premier jour, sans
exercice précédent ni report, peut être ce bilan d'ouverture (dossier repris)
ou l'apport qui fait naître l'association, et le livre ne les distingue pas.
Même règle qu'au SYSCOHADA (bloquant 2 du 2026-10-07) · ni flux ni
ouverture, postes vides, motif qui nomme les pièces et les deux issues. ZA est
« Trésorerie nette au 1er janvier (Trésorerie actif N-1 – Trésorerie passif
N-1) » (Partie 4 ch. 2, tableau des flux) · elle lit l'ouverture, vide aussi.

CORRECTION ·
- `EtatsFinanciersService.tableauFluxTresorerie` (associations) · l'OD du
  premier jour est cherchée pour chaque colonne (`lireOuverturePasseeEnOd`,
  sur l'ouverture d'A4) ; `resoudreFluxPourExercice` reçoit le motif · ZA et
  chaque poste FA à FQ (tous lisent les mouvements et leurs contreparties à
  l'ouverture) sont laissés vides, leurs totaux aussi (ZG compris) ; la
  colonne N-1 n'a pas de montant pour un poste vide ; la mention d'ouverture
  est le motif ; le tableau sert `postesVides`, `postesNonCalculables`,
  `postesNonCalculablesN1` ; les 12 et 13 ne sont plus nommés en suspects d'un
  écart que le motif explique.
- note 33 (`indicateurs-note-33.ts`) · un indicateur qui lit un poste vide du
  tableau vaut null, jamais le 0 servi (colonne N par `postesVides`, colonne
  N-1 par l'absence de `montantN1`).
- liasse des associations · la cellule d'un poste vide reste vide ; la feuille
  ANOMALIES dit les motifs (colonne N et N-1) et la provenance de
  l'ouverture du tableau (`provenanceDuComparatif` reçoit le tableau, comme
  au SYSCOHADA).
- écran des associations · un poste vide s'écrit « · » et ses motifs se
  disent une fois par motif (`client/src/lib/postes-de-flux-vides.ts`).
- SYSCOHADA · rien à corriger ici · la lecture de l'ouverture avant la
  clôture (A4) suffit à la colonne N-1 de 2027.

TESTS · `etats-financiers.service.spec.ts` (colonne N vide et motif, colonne
N-1 vide, report tenu sans recherche) ; `etats-financiers-syscohada.service.spec.ts`
(premier exercice ouvert en OD et clôturé, lu en N-1 · tombe sur le service
d'avant A4) ; `passe-r6-notes-associations.spec.ts` (note 33, N et N-1) ;
`liasse-etafi.spec.ts` (cellule vide, ANOMALIES) ;
`client/src/lib/postes-de-flux-vides.spec.ts` (règle d'écriture, regroupement,
page). Les trois tests de service tombent sur le service d'avant.

APRÈS · 90 contrôles sur 90 concordent pour A7, A4, A1, A8, A8M
(`/tmp/claude-0/sim/p1a-apres-a7.json`).

### A3 · la colonne N-1 du tableau des flux des associations, exercice précédent vide

REPRODUIT sur vraie base contre `main`. Association · 2025 ouvert sans
écriture, 2026 tenu (apport 1 000 000, produit 500 000) ; puis 2025, vide,
clôturé et le tableau de 2026 relu.

AVANT (main) · `colonne N-1 vide, aucun montant servi (ZA, ZB, ZF)` lu
`false` (ZA N-1 0, ZB N-1 0), `aucune ligne de la colonne N-1 n'est chiffrée`
lu `false`, `la colonne N-1 dit pourquoi elle est vide` lu `false` ; même
chose après la clôture de 2025. 5 écarts sur 7
(`/tmp/claude-0/sim/p1a-avant-a3.json`).

CE QUE FONT LE BILAN ET LE COMPTE DE RÉSULTAT (lu sur la même base) · aux deux
référentiels, l'exercice précédent vide est « disponible » et sa colonne N-1
sort en zéros, sans mention · ils ne disent pas « vide » non plus. Le
tableau des flux du SYSCOHADA aussi (ZA N-1 0, ZB N-1 0, aucun poste nommé).
Aligner le tableau des associations sur eux ne corrigerait donc rien.

DÉCISION PAR LA LOI · « chacun des postes des états financiers comporte
l'indication du chiffre relatif au poste correspondant de l'exercice
précédent » (SYCEBNL art. 16, 7)) · un exercice ouvert sans écriture au
livre-journal ne tient ni positions ni flux (doctrine déjà écrite,
`exercicePrecedentTenu`, relecture de la passe V1, qui en écarte les
positions pour la colonne N) ; ses chiffres ne sont pas connus, et des zéros
diraient une entité sans aucune opération. La colonne N-1 reste VIDE, et le
motif le dit. L'exercice précédent reste « disponible » (il existe), comme au
bilan et au compte de résultat · c'est la seule chose à y aligner.

CORRECTION ·
- `etats-financiers.communs.ts` · `motifColonneN1NonTenue` (SYCEBNL art. 16,
  7) ; AUDCIF art. 34 pour l'autre référentiel).
- `EtatsFinanciersService.tableauFluxTresorerie` · un exercice N-1 non tenu
  passe ce motif à `resoudreFluxPourExercice` (la mécanique d'A7) · tous les
  postes de la colonne N-1 vides, aucun `montantN1`, motif dans
  `postesNonCalculablesN1`.
- liasse des associations · une ligne d'ANOMALIES par MOTIF (postes nommés),
  et non plus une par poste · la colonne N-1 entière en aurait aligné dix-neuf.
- écran · rien de neuf · la colonne vide s'écrit « · » et le motif se dit
  (A7).

TESTS · `etats-financiers.service.spec.ts` (colonne N-1 vide et dite, colonne
N chiffrée · tombe sur le service d'avant) ; `liasse-etafi.spec.ts` (une
ligne par motif).

APRÈS · 94 contrôles sur 94 pour A3, A7, A4, A1, A8, A8M
(`/tmp/claude-0/sim/p1a-apres-a3.json`), et 7 sur 7 pour A3 à travers la
clôture de 2025 (`/tmp/claude-0/sim/p1a-apres-a3b.json`).

### A2 · l'exercice précédent qui n'a que du brouillard · la mention dit de le valider

REPRODUIT sur vraie base contre `main`, aux deux référentiels. 2025 tenu au
brouillard seulement (apport 1 000 000, produit 300 000, jamais validés), 2026
validé sans bilan d'ouverture ; puis 2025 validé et clôturé.

AVANT (main) · tableau des flux de 2026, mention servie « L'exercice précédent
est ouvert sans aucune écriture au livre-journal […] Importez la balance de
clôture de l'exercice précédent et clôturez-le » · `la mention dit que
l'exercice précédent n'a que du brouillard`, `dit de valider ses écritures
(AUDCIF art. 22, 2°)`, `ne conseille plus d'importer la balance de clôture`
lus `false` aux deux référentiels ; au SYCEBNL, le motif de la colonne N-1
(A3) ne le disait pas non plus. 7 écarts sur 13
(`/tmp/claude-0/sim/p1a-avant-a2.json`). Importer la balance, comme la
mention le conseillait, aurait DOUBLÉ les écritures au brouillard.

DÉCISION PAR LA LOI · « Toute donnée entrée fait l'objet d'une validation,
mise en œuvre au terme de chaque période qui ne peut excéder un mois »
(AUDCIF art. 22, 2°, non exclu par l'art. 3 du SYCEBNL) · les états ne lisent
que le livre-journal ; des écritures au brouillard existent et attendent leur
validation, ce n'est pas un exercice vide. Deux cas, deux issues.

CORRECTION ·
- `EcritureService.nombreAuBrouillard` · les écritures au brouillard d'un
  exercice, à-nouveau provisoire exclu (il ne se valide jamais).
- `etats-financiers.communs.ts` · `mentionExercicePrecedentVide` et
  `motifColonneN1NonTenue` prennent ce nombre · au brouillard, « n'a que des
  écritures au brouillard (n), hors du livre-journal […] Validez-les (AUDCIF
  art. 22, 2°) » ; sans aucune écriture, l'issue de l'import reste.
  `brouillardDuPrecedentNonTenu` ne compte que pour un exercice précédent qui
  ne tient rien.
- les deux tableaux des flux (SYSCOHADA normal, associations) le lisent.

TESTS · `etats-financiers.communs.spec.ts` (deux référentiels, deux cas, le
comptage borné) ; `balance.spec.ts` (requête du comptage) ; un test par
tableau des flux (tombent sur les services d'avant) ; doublures complétées.

APRÈS · 104 contrôles sur 104 pour A2, A3, A7, A4, A1, A8, A8M
(`/tmp/claude-0/sim/p1a-apres-a2.json`) ; A2 à travers la clôture de 2025,
13 sur 13 (`/tmp/claude-0/sim/p1a-apres-a2b.json` · 2025 validé et clôturé,
plus de mention, ZA de 2026 = 1 300 000).

## Reste

A4, A7, A3, A2, A10, A9, A5, A6.

## Relevés (voisins, non codés)

- A8 · la contre-passation DÉCLARÉE n'est écartée que par la clôture et son
  aperçu (ligne à ligne). Les autres lecteurs du filtre (585 du groupe G1,
  candidates de la reconduction du lettrage) la lisent encore comme une
  ouverture · pour G1, une OD déclarée au premier jour qui ne touche aucun 585
  arrête la remontée vers l'exercice précédent ouvert ; pour le lettrage, ses
  lignes de tiers peuvent être offertes comme lignes d'accueil. Rien n'est
  faussé dans les montants, mais la lecture diffère de celle de la clôture.
- A4 · d'autres lecteurs prennent la colonne report (ou le filtre
  `estGenereeParCloture && !estSoldeDesComptesDeGestion`) pour l'à-nouveau et
  y comptent donc le virement du 13 d'un exercice clôturé · balance en
  monnaie fonctionnelle (`A_NOUVEAU`, « ouverture = clôture du même jeu
  N-1 »), état d'ouverture IFRS 1 (« report à-nouveau des classes 1 à 5
  projeté »), « Mouvements au <veille> » de la balance FPM. Seuls les 12, 13
  et 103 en sont touchés ; non codé ici.
- A4 · les variations VA, VB, VC du SMT SYCEBNL lisent encore
  `aLOuverture(lignesN)` · sans effet (stocks, créances, dettes, jamais le 12
  ni le 13), laissé tel quel.
- A7 · au SYSCOHADA, un poste laissé vide garde son 0 servi en colonne N, à
  l'écran (`EtatsFinanciersSyscohadaPage`) et dans la feuille TFT de la
  liasse, la liste des postes non calculables le disant à côté · les
  associations l'écrivent désormais « · » et laissent la cellule vide.
- A7 · le rapport d'activité (`tresorerieDuTft`) et le livre d'inventaire
  reprennent le tableau des flux tel quel · dans le cas d'une ouverture en OD
  au premier jour, ouverture et variation y valent 0 sans le dire (les deux
  référentiels).
- A7 · `effectifs-seize-colonnes.spec.ts` est tombé une fois sous une suite
  chargée, puis a passé trois fois seul et deux fois avec la suite · instable,
  sans lien avec la ligne.
- A3 · PROPOSITION pour le coordinateur · les bilans et les comptes de
  résultat (les cinq jeux) et le tableau des flux du SYSCOHADA servent encore
  des zéros en colonne N-1 quand l'exercice précédent est ouvert sans
  écriture, sans le dire. Même lecture de l'art. 16, 7) (SYCEBNL) et de
  l'art. 34 (AUDCIF) · colonne vide et motif. Pour le BILAN, le texte va plus
  loin · le bilan de clôture N-1 EST le bilan d'ouverture de N (art. 34 ;
  art. 16, 4)), et `comparatifDuBilan` pourrait le lire sur l'ouverture de N
  comme sans exercice précédent (provenance `BILAN_D_OUVERTURE`). Non codé
  (hors du point).
- G1 (relevé MAJEUR du second tour, suivi) · seul le cas de la contre-passation
  du module est réglé ici ; le cas « ouverture nulle » du relevé reste ouvert.
