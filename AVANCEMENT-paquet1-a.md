# AVANCEMENT · paquet 1, ligne A (états et clôture)

Branche `travail/paquet1-a`, partie de `main` e31f4de. Fiche tenue à chaque
point fini (CLAUDE.md § 5), retirée à l'intégration.

Ordre de travail · A8, A1, A9, A5, A6.

## Commandes

```bash
# Scénario (non committé ici, tenu par le coordinateur)
#   /home/user/wt-passe/scripts/passe-v1/scenario-paquet1-a.mjs
# AVANT (main) et APRÈS (cette copie, après npm run build)
PAQUET1_A_COPIE=/home/user/Comptaflow PAQUET1_A_POINTS=A8,A8M,A1,A4,A7,A3,A2,A10,A9,A5,A6 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1a_avant 8761 paquet1-a /tmp/claude-0/sim/p1a-avant.json
PAQUET1_A_COPIE=/home/user/wt-p1a PAQUET1_A_POINTS=A8,A8M,A1,A4,A7,A3,A2,A10,A9,A5,A6 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1a p1a_apres 8762 paquet1-a /tmp/claude-0/sim/p1a-apres.json
# Specs touchés
npx tsc --noEmit
npx jest src/modules/exercice/ouverture-passee.spec.ts src/modules/exercice/cloture-annuelle.spec.ts \
  src/modules/lettrage/reconduction-lettrage.spec.ts src/modules/groupe/virements-585-groupe.spec.ts \
  src/modules/exercice/arret-dissolution.spec.ts
npx jest src/modules/etats-financiers src/modules/etats-financiers-syscohada src/modules/exports
npx jest src/modules/comptabilite/balance.spec.ts src/modules/notes-annexes src/modules/consolidation src/modules/ifrs
cd client && npx tsc --noEmit && npx vitest run src/components/resultat-anterieur-non-vire.spec.ts src/lib/postes-de-flux-vides.spec.ts \
  src/components/notes-part-non-ventilee.spec.ts src/components/notes-ecarts-saisie.spec.ts src/specs-sans-react.spec.ts
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

### A10 · la part non ventilée par échéance, dite à l'écran des notes

REPRODUIT sur vraie base contre `main` (SYSCOHADA, note 7). Facture F1 de
1 000 000 au 01/03/2026, échéance 31/03/2027 ; facture F2 de 400 000 au
01/06/2026, sans échéance ; validées. Le serveur sert déjà la ligne « Clients
(hors réserves de propriété Groupe) » · N 1 400 000, à un an au plus
1 000 000, `echeanceNonVentilee` 400 000 (trois contrôles concordants avant
comme après) ; l'écran (`NotesAnnexesRendu.tsx`) ne lisait le champ nulle
part · contrôle `NotesAnnexesRendu (ou un module qu'il importe) lit
echeanceNonVentilee` lu `false` (le scénario relit la source de la copie
jouée, `PAQUET1_A_COPIE`, `lib/types.ts` écarté, qui déclare sans lire).
1 écart sur 4 (`/tmp/claude-0/sim/p1a-a10-avant.json`). Les colonnes
d'échéance s'y lisaient complètes alors qu'elles laissaient 400 000 de côté ;
seule la liasse le disait (commentaire de cellule).

CORRECTION ·
- `client/src/lib/part-non-ventilee.ts` · la phrase (« Part non ventilée par
  échéance : <montant> · rangée dans aucune colonne d'échéance. »), montant par
  `lib/montants.ts`, `null` sous le demi-centime ; la bulle dit le pourquoi,
  et pour une part NÉGATIVE qu'elle n'est ni due ni recouvrable (même lecture
  que `NOTE_PART_NON_VENTILEE_NEGATIVE` de `etat-etafi.ts`).
- `NotesAnnexesRendu.tsx` · sous la ligne qui la porte (`LigneTableauNote`),
  avec sa bulle `Aide`, comme les écarts de saisie. Commun aux deux écrans de
  notes · aucun poste, compte ni libellé de référentiel.

TESTS · `client/src/components/notes-part-non-ventilee.spec.ts` (phrase,
absence, part négative et sa bulle, câblage dans le corps de
`LigneTableauNote`) · le câblage tombe sur le composant d'avant.

APRÈS · 4 contrôles sur 4 (`/tmp/claude-0/sim/p1a-a10-apres.json`), client
construit (la phrase est dans le paquet de `NotesAnnexesPage`). Aucune
clôture à traverser · le point est d'écran, le serveur n'est pas touché.

### A9 · la feuille CONTROLES de la liasse projet ne tient plus XC à zéro

REPRODUIT sur vraie base contre `main` (SYCEBNL, projets de développement).
Décaissement du bailleur 10 000 000 au 462 ; missions 2 500 000 payées par la
banque et neutralisées (D 462 / C 702) ; intérêts du dépôt 120 000 au 7747,
non neutralisés · XC = 120 000, CC = 120 000. AVANT (main) · la feuille
CONTROLES portait « Solde du compte d'exploitation (XC · doit boucler à 0 en
régime normal) », Attendu 0, et aucune ligne ne lisait CC ; l'export du
compte d'exploitation seul imprimait « CONTRÔLE : XC = 120 000 · le compte
d'exploitation ne boucle pas à zéro ». 14 écarts sur 47
(`/tmp/claude-0/sim/p1a-a9-avant.json`), en 2026, 2026 relu après la clôture
et 2027.

DÉCISION PAR LA LOI · SYCEBNL Partie 4 ch. 3, tableaux de correspondance ·
XC « SOLDE DES OPERATIONS DE L'EXERCICE (+excédent, -déficit) XA - XB » ; CC
« Solde des opérations de l'exercice (+ ou déficit -) », « 13 (131 ou
139) » ; CB « Report à nouveau (+ ou -) » pour le recevoir. La fiche du
compte 13 (Partie 2 ch. 3) le dit « toujours nul », parce que chaque charge
engagée sur les fonds d'administration est neutralisée par le 702 (Partie 3
ch. 3 § 2.2, note (2), « neutralité de l'opération (engagement des
charges) ») ; le corpus lui-même passe un produit hors de cette
neutralisation (prix de cession au 82, Partie 3 ch. 3 § 2.5.1). Un XC non nul
n'est donc pas une égalité tombée · les lignes « Attendu 0 » de CONTROLES
sont des égalités qui doivent tenir, et celle du texte est XC = CC, le même
« solde des opérations de l'exercice » imprimé dans les deux états. « Régime
normal » n'est dans aucun texte. Un XC non nul reste « à vérifier » à la
feuille ANOMALIES (la fiche du compte 13 le dit nul quand tout est
neutralisé).

CORRECTION ·
- `ExportService.liasseProjetsEtafi`, feuille CONTROLES · XC lu (Attendu
  vide), CC lu sur la ligne CC de `Bilan-Passif`, « Écart compte
  d'exploitation / bilan (XC-CC, doit être 0) » ; l'écart de réconciliation
  suit ses deux lignes (B12-B13).
- `compteExploitationProjetExcel` · la ligne sous l'état dit le solde
  (« XC = 0. » ; non nul, « à expliquer en Notes (produit ou charge hors de
  la neutralisation par le 702) »), sans « régime normal » ni « ne boucle
  pas ».
- Commentaires de doctrine · `correspondance-projet-compte-exploitation.ts`
  et `EtatsFinanciersProjetService.compteExploitation` disent la lecture.

TESTS · `liasse-etafi.spec.ts`, « Paquet 1, A9 » (balance de projet à
120 000 d'intérêts) · XC sans attente, CC lu au passif (120 000), écart sur
ses deux lignes, aucun « régime normal » ; chaque écart de la feuille se lit
sur les deux lignes qui le précèdent ; la ligne de l'export seul, non nul et
nul. Les trois tombent sur le service d'avant.

APRÈS · 50 contrôles sur 50 (`/tmp/claude-0/sim/p1a-a9-apres.json`), à
travers la clôture de 2026 · 2026 relu clos, XC = CC = 120 000, écart 0 ;
2027, l'affectation au 121 encore au brouillard, l'écart XC-CC vaut −120 000
(le 13 porte encore le solde de 2026, que CC lit et XC non) ; affectation
validée, XC = CC = 0.

### A5 · les intérêts courus sur emprunts au tableau des flux SYSCOHADA · pas de défaut

NON REPRODUIT comme défaut · le comportement de `main` est celui que le texte
prescrit, rien n'est corrigé. Scénario sur vraie base (SARL, 2026 puis 2027
à travers la clôture) · apport 2 000 000, emprunt 1 000 000 au 162, vente
500 000, intérêts courus 50 000 au 31/12 (D 6712 / C 1662) ; 2027,
contre-passation au 01/01 (D 1662 / C 6712), intérêts payés 50 000,
principal remboursé 200 000. 13 contrôles sur 13 concordants AVANT et APRÈS
(`/tmp/claude-0/sim/p1a-a5-avant.json`, `p1a-a5-apres.json`) · 2026 FA
450 000, FE +50 000, FO 1 000 000, ZB 500 000, ZH 3 500 000, DA au bilan
1 050 000 ; 2027 FA 0, FE −50 000, FQ −200 000, ZA 3 500 000, ZH 3 250 000,
FE N-1 50 000.

DÉCISION PAR LA LOI · AUDCIF Titre IX ch. 5 § 1.2.1.3, passage de la CAFG au
flux opérationnel · « + Variation du passif circulant ET DES INTÉRÊTS DES
EMPRUNTS ET DETTES FINANCIÈRES COURUS (exercices N–N-1) (b) et (1) » (et,
à l'actif, « des intérêts courus des immobilisations financières » avec les
créances). Le ch. 7 range bien le 166 en DA (« 16, 181, 182, 183, 184 »),
mais c'est le ch. 5 qui dit où va sa VARIATION au tableau des flux · en FE,
hors de FO à FQ, cohérent avec la CAFG qui porte déjà la charge 671 courus
compris. `correspondance-tft-syscohada.ts` l'écrit déjà (anomalie n° 4,
FE · « intérêts des emprunts et dettes financières courus », FP et FQ les
excluent) ; la matrice du praticien qui les met en financement est une
source secondaire que le fichier écarte nommément. Le skill `syscohada`
(Partie 3 ch. 1, « Variation des comptes 16 (hors intérêts courus) et 18 »
pour les capitaux étrangers) dit la même chose.

### A6 · le 130 « Résultat en instance d'affectation » · le corpus ne tranche pas, point pour Manasse

CONSTATÉ sur vraie base contre `main` (SARL) · 2026 (apport 1 000 000,
vente 300 000) clôturé ; le 02/01/2027 le cabinet reclasse le résultat de
2026 au 1301 (D 131 / C 1301, 300 000), comme la fiche du compte 13 le lui
permet. Bilan de 2027 avant l'affectation · actif 1 300 000, passif
1 000 000, CJ 0, déséquilibré de 300 000, « 13010000 −300 000 » parmi les
comptes non rattachés (`/tmp/claude-0/sim/p1a-a6-avant.json`). La clôture de
2027 passe et VIRE le 1301 au report à nouveau (bilan clos équilibré, CH
300 000 ; à-nouveau de 2028 · 12 créditeur de 300 000, 1301 à zéro) ·
l'exercice clos est conforme à la fiche (« en fin d'exercice […] viré au
compte de report à nouveau »). Seul un bilan INTERMÉDIAIRE (avant
l'assemblée ou la clôture) reste déséquilibré du montant du 130. Rien n'est
corrigé.

LU · AUDCIF Titre VII, fiche du compte 13 · subdivisions « 130 Résultat en
instance d'affectation (1301 Bénéfice, 1309 Perte) », « 131 Résultat net :
Bénéfice » à « 139 Résultat net : Perte » ; « À la réouverture des comptes
de l'exercice suivant, les entités ont la possibilité d'utiliser un compte
spécial "Résultat en instance d'affectation" (130) » ; « En fin d'exercice,
le résultat de l'exercice précédent non affecté à un compte de réserves et
non distribué est viré au compte de report à nouveau ». Fiche du compte 11 ·
crédité « par le débit du 131 (Résultat net : Bénéfice) ou du 1301 ».
AUDCIF Titre VIII ch. 19 (attribution gratuite d'actions) et Guide
d'application SYSCOHADA, Partie 2 ch. 16, Application 65 · l'affectation
décidée par l'assemblée débite le 1301.
Titre IX ch. 3 (modèle) · CJ « Résultat net de l'exercice (bénéfice + ou
perte -) » ; ch. 7 · CJ « 13 (131 ou 139) », CH « 12 (121 ou 129) ».
Titre VIII ch. 39 (comptes intermédiaires) · « les mêmes états de synthèse
que ceux établis à la clôture », mêmes méthodes, rien sur le 130. Code ·
`resultat-de-l-exercice.ts` (« 131 à 139, et jamais le 130 »),
`correspondance-bilan-syscohada.ts` (anomalie n° 7, le 130 orphelin voulu,
à solder à la clôture), `correspondance-smt-syscohada.ts` (SP2, même
lecture).

POURQUOI LE CORPUS NE TRANCHE PAS · deux lectures tiennent. (1) Le ch. 7
nomme pour CJ « 13 (131 ou 139) », et le libellé est le résultat « de
l'exercice » · le 130, résultat de l'exercice PRÉCÉDENT, n'y est pas, et
l'exercice clos ne le porte jamais (la fiche le fait virer au 12). (2) La
fiche fait du 130 une subdivision du 13, que le ch. 7 met en tête de la
case ; la parenthèse « (131 ou 139) » peut se lire comme les deux sens du
libellé (bénéfice +, perte −), à la façon de « 12 (121 ou 129) » pour CH.
Aucun texte ne dit où se lit le 130 dans un état INTERMÉDIAIRE (ch. 39
muet).

PROPOSITION pour Manasse · garder le résultat DE L'EXERCICE sur 131 à 139
(impôt, affectation, `estCompteDuResultatDeLExercice` inchangés, sans quoi
le bénéfice de N-1 serait imposé deux fois), mais lire le 130 avec CJ (et
SP2 au Système minimal) AU BILAN, comme OmegaX lit déjà un résultat
précédent resté au 131 ou au 139 à la réouverture (passe V1, B1), avec un
avis qui le nomme « résultat de l'exercice précédent en instance
d'affectation » · le bilan intermédiaire s'équilibre et dit ce qu'il
contient. Autre issue · une ligne à part, sous CJ, que le ch. 3 ne prévoit
pas. Sans décision, l'état actuel reste (130 nommé en compte sans poste).

## Relecture 1 (échecs silencieux, 2026-10-09)

Constats B1, B2, M1 à M4, m1 à m5. Chacun vérifié avant correction,
reproduit sur vraie base par un contrôle ajouté au scénario
(`scenario-paquet1-a.mjs`, modifié dans `wt-passe`, non committé), corrigé
avec le test qui l'aurait attrapé, rejoué après, un commit par constat.

### B1 · la mémoire de la balance des notes jetait `avantLaCloture`

- Vérifié · `balanceMemorisee` (notes annexes) ne prenait que quatre
  paramètres, ni sa clé ni son appel ne portaient `{ avantLaCloture }` (A4) ·
  `chargerOuverture`, appelé par les trois états que les notes 33 et 34
  résument, recevait la balance COMPLÈTE d'un exercice clôturé (virement du
  13 compris), l'ouverture n'était plus vide et l'OD du premier jour (A7)
  n'était plus vue. Défaut introduit par A4 dans la ligne (`main` n'a pas
  l'option).
- AVANT (copie à 3615aa2) · A7 à travers la clôture, notes de 2026 ·
  note 33 « flux de trésorerie des activités de financement » lu 10000,
  « variation de la trésorerie nette » lu 10500 ; note 34 « flux-financement »
  lu 10000 (milliers), quand le tableau des flux les laisse vides.
- Correction · tous les paramètres repris EN BLOC (`Parameters<…>`), clé de
  lecture qui porte chaque paramètre et les options triées
  (`cleDeLectureDeBalance`), et une garde de type qui fait tomber la
  compilation si `balance` change de signature (`ParametresDeBalanceConnus`).
- APRÈS · les trois contrôles concordent (25 sur 25 au point A7).
- Tests · `balance-memorisee-f214.spec.ts`, quatre cas (lectures
  distinctes, option transmise à sa place, mémoire d'une même lecture,
  ouverture lue avant la clôture à travers la mémoire).

### B2 · une OD d'ouverture du premier jour corrigée par un négatif daté plus tard

- Vérifié · le périmètre (`filtreOuverturePasseeAuPremierJour`) exigeait la
  date ou la date de valeur au premier jour, y compris pour le négatif lié ·
  « Corriger » depuis le Journal date le négatif du jour de la correction,
  il sortait du périmètre et l'OD annulée y restait seule. Défaut antérieur
  à la ligne (même filtre sur `main`).
- Lu au texte · AUDCIF art. 20, al. 2 (« Toute correction d'erreur commise
  et découverte sur l'exercice en cours s'effectue exclusivement par
  inscription en négatif des éléments erronés ; l'enregistrement exact est
  ensuite opéré ») et art. 34 (le bilan d'ouverture correspond au bilan de
  clôture précédent) · la position d'ouverture est ce qui reste APRÈS la
  correction. Tranché · le négatif lié d'une écriture du premier jour fait
  partie du périmètre quelle que soit sa date (tous les écrivains de
  `corrigeEcritureId` inscrivent l'origine ENTIÈRE en négatif, liaison
  unique), et l'OD et son négatif se soldent (`ouvertureNulle`).
- AVANT (copie avant correction ; `main` non joué dans cette session, la
  commande contre `/home/user/Comptaflow` a été refusée par le garde-fou de
  l'environnement · le filtre y est le même hors A8) · OD CONCORDANTE avec le
  report · clôture passée sans rien ajouter, 2027 banque 0 au lieu de
  10 500 000, capital 0 au lieu de -10 000 000, 13 à 0 au lieu de -500 000,
  balance bouclée. OD DIVERGENTE (3 000 000) · aperçu « déclaration requise »,
  clôture refusée, RECTIFIER · banque 7 500 000, capital -7 000 000 (report
  moins l'OD).
- Correction · le filtre admet le négatif lié (`corrigeEcriture` datée du
  premier jour) ; un lecteur NET pour ceux qui ne demandaient qu'« y a-t-il
  une écriture » (`ouverturePasseeNonNulle` · même périmètre, mêmes lignes
  écartées que la clôture, nulle compte par compte et devise par devise) ·
  le 585 du groupe (G1) le lit ; la reconduction du lettrage n'accueille ni
  une écriture corrigée ni son négatif (`correction: { is: null }`,
  `corrigeEcritureId: null`). Message du brouillard de la clôture complété
  (« ou en correction d'une écriture du premier jour »).
- APRÈS · 14 contrôles sur 14 (deux variantes) ; A8, A8M et A7 rejoués, 61
  sur 61.
- Tests · `ouverture-passee.spec.ts` (cinq cas du filtre, quatre du lecteur
  net), `virements-585-groupe.spec.ts` (doublure qui ÉVALUE les trois
  lectures, cas B2), `reconduction-lettrage.spec.ts` (l'OD annulée
  n'accueille rien, sans elle elle rivalise). Doublures complétées, jamais
  contournées · `correction` honoré (`report-a-nouveau-agrege.spec.ts`,
  `reconduction-lettrage.spec.ts`), colonne absente lue NULL comme en base ;
  la forme figée du filtre (`cloture-annuelle.spec.ts`, R1) suit la règle.

### M4 · une OD du premier jour neutralisée vidait le tableau des flux sans issue

- Vérifié · `EcritureService.ouverturePasseeAuPremierJour` comptait les
  écritures du périmètre · OD et négatif présents, le tableau des flux d'un
  exercice sans précédent vidait tous ses postes et nommait une OD qui
  n'existe plus. Antérieur au SYSCOHADA, étendu aux associations par A7.
- AVANT (copie avec B2) · SYSCOHADA et SYCEBNL, OD du 01/01/2026 annulée le
  01/03/2026, apport de 10 000 000 encaissé le 02/03 · tous les postes vides
  (ZA, FA à FQ, ZB à ZH), mention « opérations diverses », FK et FM non servis.
- Correction · le lecteur des états juge la position NETTE
  (`ouverturePasseeNonNulle`, celui de B2) · une ouverture qui se solde n'en
  est pas une, l'entité naît (mention de l'ouverture présumée nulle).
- APRÈS · 10 contrôles sur 10 (FK et FM à 10 000 000, ZA à 0, aucun poste
  vide) ; A7 rejoué, 25 sur 25.
- Test · `ouverture-passee.spec.ts`, câblage du service (OD et négatif ·
  `null` ; OD seule · pièce nommée).

### M1 · ZA ou la variation laissées vides · le contrôle du tableau des flux n'est pas effectué

- Vérifié · le contrôle (`controle.coherent`, `ecart`) relisait les postes
  vides comme des zéros, et trois reprises le suivaient · bandeau rouge de
  l'écran, liasse (ANOMALIES « à traiter », CONTROLES jugeant à zéro une
  formule qui lit la cellule vide de ZG), rapport d'activité (ouverture 0,
  variation 0, « non bouclé »). Même défaut au SYSCOHADA (ZA, ZG, ZH), dont la
  feuille TFT écrivait en plus 0 dans les cellules N des postes vides et des
  totaux qui en dépendent.
- Lu au texte · le modèle confronte la trésorerie de clôture par les flux
  (G + A) à celle du bilan (SYCEBNL Partie 4 ch. 1 § 4 ; AUDCIF Titre IX
  ch. 5, ZH « Contrôle : Trésorerie actif N - Trésorerie passif N ») · sans
  A ou sans G, le premier terme n'est pas connu, ni bouclage ni écart.
- AVANT (copie à e9ee485) · A7 SYCEBNL · `coherent` false, écart -12 500 000,
  ouverture 0, variation 0 ; liasse « Écart de bouclage de -12500000.00 » à
  traiter, CONTROLES juge « Écart trésorerie TFT / bilan » ; rapport
  [0, 0, false]. A7 SYSCOHADA · écart -12 000 000, ouverture 0, variation
  500 000 ; liasse « Écart de -12000000.00 entre ZH par les flux et BT - DT »,
  CONTROLES juge « Écart de bouclage du TFT » ; export « diffère de BT - DT ».
- Correction · `controleDuTableauDesFlux` (commun aux deux référentiels) ·
  ZA ou la variation vide, `coherent`, `ecart` et la clôture par les flux à
  `null`, l'ouverture ou la variation inconnue à `null`, motif dit. Liasses ·
  anomalie « à traiter » sur un écart CONSTATÉ seulement, le contrôle non
  effectué en information avec son motif ; lignes de CONTROLES écrites en
  texte, sans attendu. Feuille TFT SYSCOHADA · cellule N vide pour un poste
  vide, total sans formule. Rapport · ouverture, variation et `boucle` à
  `null`, motif figé avec la raison des postes vides (posé seulement dans ce
  cas, la forme d'un tableau contrôlé ne change pas), « non servie » à
  l'export. Écran · trois issues (`client/src/lib/controle-flux.ts`), en
  avertissement, jamais dans la couleur d'un écart.
- APRÈS · 43 contrôles sur 45 au point A7, les deux restants sont ceux de M2.
- Tests · `etats-financiers.communs.spec.ts` (trois cas), deux services,
  `liasse-etafi.spec.ts` et `liasse-syscohada.spec.ts` (ANOMALIES, CONTROLES,
  export seul, cellules vides), `documents-obligatoires.spec.ts` (rapport),
  `client/src/lib/controle-flux.spec.ts` (issues et câblage des trois écrans).

## Reste

Rien · les dix points sont traités (A5 sans défaut, A6 remonté à Manasse).

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
- A10 · à l'écran des notes, deux autres champs servis par le serveur ne
  sont lus nulle part · `ecartCloture` (clôture recalculée D = A + B − C
  différente du solde de la balance, que la liasse dit en commentaire de
  cellule) et `natureNonVentilee` (mouvements de provision de la note 30 dont
  la contrepartie ne relève d'aucune des trois natures). Même forme que A10,
  non codés (hors du point).
- A9 · l'écran des états du projet (`EtatsFinanciersPage`) dit encore
  « XC = … (≈ 0) · régime normal pour ce jeu », et le type client
  `CompteExploitationProjet.solde` « attendu à 0 en régime normal » · la
  branche non nulle dit déjà « pas nécessairement une erreur ». La feuille
  ANOMALIES garde son « à vérifier » sur un XC non nul, avec « ne boucle pas
  à zéro ». Non codés (hors du point, l'écran n'était pas visé).
- A6 · après la clôture qui a viré le 1301 au 12, le bilan de l'exercice
  clos liste encore « 13010000 » parmi les comptes non rattachés, pour un
  montant nul (ligne mouvementée, soldée). Cosmétique, non codé.
- A6 · OmegaX ne propose aucun geste pour passer le résultat au 130 à la
  réouverture, et le module d'affectation lit les résultats antérieurs sur
  le « 13 hors clôture » (130 compris) · non éprouvé ici au-delà de la
  clôture.
