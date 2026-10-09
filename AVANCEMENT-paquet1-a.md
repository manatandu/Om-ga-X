# AVANCEMENT · paquet 1, ligne A (états et clôture)

Branche `travail/paquet1-a`, partie de `main` e31f4de. Fiche tenue à chaque
point fini (CLAUDE.md § 5), retirée à l'intégration.

Ordre de travail · A8, A4, A7, A3, A2, A10, A9, A5, A6.

## Commandes

```bash
# Scénario (non committé ici, tenu par le coordinateur)
#   /home/user/wt-passe/scripts/passe-v1/scenario-paquet1-a.mjs
# AVANT (main) et APRÈS (cette copie, après npm run build)
PAQUET1_A_POINTS=A8,A8M,A1 /tmp/claude-0/sim/verifier-ligne.sh /home/user/Comptaflow p1a_avant 8761 paquet1-a /tmp/claude-0/sim/p1a-avant.json
PAQUET1_A_POINTS=A8,A8M,A1 /tmp/claude-0/sim/verifier-ligne.sh /home/user/wt-p1a p1a_apres 8762 paquet1-a /tmp/claude-0/sim/p1a-apres.json
# Specs touchés
npx tsc --noEmit
npx jest src/modules/exercice/ouverture-passee.spec.ts src/modules/exercice/cloture-annuelle.spec.ts \
  src/modules/lettrage/reconduction-lettrage.spec.ts src/modules/groupe/virements-585-groupe.spec.ts \
  src/modules/exercice/arret-dissolution.spec.ts
npx jest src/modules/etats-financiers src/modules/etats-financiers-syscohada src/modules/exports
cd client && npx tsc --noEmit && npx vitest run src/components/resultat-anterieur-non-vire.spec.ts src/specs-sans-react.spec.ts
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
- G1 (relevé MAJEUR du second tour, suivi) · seul le cas de la contre-passation
  du module est réglé ici ; le cas « ouverture nulle » du relevé reste ouvert.
