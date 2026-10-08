# AVANCEMENT · ligne tva-decisions

Branche de sauvegarde `travail/tva-decisions` (jamais `main`). Fiche retirée à
l'intégration.

## Fait

- (C) Délai de la récupération de TVA d'une créance irrécouvrable · décision
  par la loi du 2026-10-08 (`creances-douteuses/recuperation-tva.ts`,
  `derniereDateEcriture`, refus et message, proposition servie à l'écran).
  Paragraphe A7 bis partie 2 de CLAUDE.md NON retouché (consigne du
  coordinateur · il sera réécrit avec D) · la phrase « après le 31 décembre de
  l'année qui suit » y est à remplacer par la règle ci-dessous à l'intégration.
- (A) Négatif d'une facture (vente et achat) lu au signe près, à la date de la
  facture corrigée ; reprise une fois au premier jour non liquidé, nommée
  (`negatifsDeFactures`) ; liquidation à collecte négative ; facture lettrée
  avec son propre négatif jamais « encaissée » (`datesDuGroupeDeMain`).
- (B) Ligne validée après la liquidation qui devait la lire · rattachée au
  premier jour non liquidé (`rattachementTardif`, `recuperationTardive`),
  nommée (`rattachementsTardifs`). Spec
  `tva/tva-negatifs-et-rattachements-tardifs.spec.ts` (14 cas). Paragraphe
  nouveau de CLAUDE.md après « TVA · le livre-journal seul ».

- (E) Liquidation · réglé au-delà séparé (`bilansSuccessifsDe` ·
  `cotisationDeLExercice`, `tropPayePremiereCotisation`, `excedentAcomptes`) ;
  l'écriture de l'impôt (A11) constate dans l'exercice de liquidation la
  seconde cotisation et le trop-payé D 441 / C 8994
  (`ConstatImpotService.impotDeLExercice`, colonne `tropPayeLiquidation`,
  migration `20270161000000_trop_paye_liquidation`). CLAUDE.md, paragraphe
  « Liquidation d'une société commerciale » mis à jour.

- (D) Perte et récupération de la TVA d'une créance irrécouvrable, version
  finale de Manasse (2026-10-08) · aucun montant négatif, aucun crédit au 651.
  Règle 1 · avec duplicatas, retour D compte d'origine / C 416 puis D 651 HT /
  D 443 au taux / C compte d'origine (`perteAvecTva`, `motifRefusPerteAvecTva`,
  `ventilerPerte`, colonnes `ecriturePerteId`, `montantTva`,
  `montantTvaAnnulee`, `detailTva`, migration
  `20270162000000_perte_avec_tva`) ; règle 2 · D 443 SANS taux pour la taxe à
  l'encaissement ; règle 3 · « Récupérer la TVA » D 443 / C 751, mention
  AUDCIF art. 61 quand la perte est d'un exercice antérieur. Moteur de TVA ·
  la perte qui récupère justifie son avoir (`mouvementCreanceDouteusePerte`).
  Écran · duplicatas facultatifs dans la modale de la perte. CLAUDE.md, A7 et
  A7 bis partie 2 réécrits (avec le délai du point C).

- (D, suite du rejeu) L'annulation d'une perte qui récupère lettre entre
  elles les lignes du compte d'origine qui survivent (retour, perte et leurs
  négatifs) · laissées ouvertes, un lettrage automatique pouvait rapprocher la
  facture d'une perte annulée, lu comme un encaissement.
- Bloc du § 3 · serveur `tsc`, jest complet (805 suites, 11 640 tests),
  `nest build` ; client `tsc`, vitest (238 fichiers, 1 931 tests),
  `vite build` ; `cadratins.spec`, `reglement-interieur.spec` verts.
- Rejeu sur vraie base (PostgreSQL 16 jetable, port 55744, serveur compilé
  port 8744), `prisma migrate diff --exit-code` · « No difference detected ».
  Tous les montants lus contre le calcul à la main (journal ci-dessous).
- Tests navigateur écrits, non lancés · `e2e/tests/tva-decisions.e2e.ts`
  (A, B, D exemple de référence), `tva-art52.e2e.ts` mis à la règle 3
  (C 751) ; `npx tsc --noEmit -p e2e` vert.

- PREMIER TOUR DE RELECTURE (2026-10-08, TypeScript et « échecs silencieux »).
  Côté créances (commit ca71c83) · une seule transaction pour retour, perte,
  mouvement et lettrage `MODULE` (MAJEUR 2, mineur 9), garde du lettrage
  étendue aux lignes du compte d'origine de la perte, retrait des DEUX pièces
  au brouillard (BLOQUANT 1), annulation refusée par une seule LIQUIDATION
  couvrante, négatif au premier jour ouvert en période close (MAJEUR 3),
  perte avec duplicata refusée quand la taxe à l'encaissement a pu être
  déclarée (B2), information TTC protégée (mineur 8), `maxWait` et lecture
  dans la transaction (mineur 10). Côté moteur de TVA (ce commit) ·
  `LiquidationTva.regleTardifs` et `instantLecture` (migration
  `20270163000000_liquidation_regle_tardifs`) · une liquidation d'avant la
  règle ne voit que les lignes datées dans sa période et aucun négatif, le
  reste est porté plus loin et NOMMÉ `ancienMoteur` (MAJEUR 4, M1) ; instant
  de lecture pris avant la déclaration (mineur 11, course) ; annulation d'une
  liquidation refusée tant qu'une postérieure existe (B1) ; trou entre
  liquidations dit ; récupération portée hors du délai de l'art. 37 al. 2
  dite (mineur 6) ; négatif d'une facture · attente de la période de la
  facture (mineur 7), nommé sans peser pour une période jamais liquidée
  (MAJEUR 5), un achat à l'encaissement (M2), une déduction d'origine déchue ;
  facture et négatif tardifs du même jour compensés ; négatif orphelin d'un
  groupe sans effet de règlement, nommé ; taxe annulée par une perte jamais
  exigible après elle (M4, moteur) ; report au détail du reclassement gardé
  comme le reclassement (M4, lettrage) ; première cotisation lue sur son
  constat, refus nommé sans lui ou sans réintégration (M3) ; borne
  trimestrielle du point C dite (30 septembre) ; casts retirés, `role` en
  union, `compteId` inutile retiré (mineur 12) ; commentaire de la migration
  `20270162000000_perte_avec_tva` corrigé AVANT application, JSDoc orphelines
  remises, « au TTC entier » complété (mineur 13).

## Reste

- Intégration sur `main` (hors de cette ligne) · fiche à retirer.

## Rejeu sur vraie base (2026-10-08)

Dossier 1 · SARL SYSCOHADA assujettie, N = 2026, N+1 = 2027.

| Contrôle | Calcul à la main | Lu |
|---|---|---|
| février N · collecte (V1 160 000 + V6 80 000) | 240 000 | 240 000 |
| février N · attente (prestation M à l'encaissement) | 80 000 | 80 000 |
| (A) février relu après le négatif de V1 daté de mars | 240 000 | 240 000 |
| (A) mars N · récupération du négatif, nommée `REPRISE_ICI` | −160 000 net | −160 000 |
| (A) avril N · V2 annulée dans sa période | 0 | 0 |
| (B) mai relu après V3 (15 mai) validée tard | 32 000 | 32 000 |
| (B) juillet N · V3 rattachée au 1er juillet, nommée | 16 000 | 16 000 |
| 4431 fin juillet N · 4441 (240 − 160 + 32 + 176 + 16) | 0 · −304 000 | 0 · −304 000 |
| perte K au TTC en N · message de la règle 3 | dit | dit |
| clôture N · 4162 reporté (L 1 160 000 + M 580 000) · 4912 | 1 740 000 · −580 000 | idem |
| (C) récupération K datée du 1er décembre N+1 | refusée | refusée |
| (D3) K · récupération N+1 · D 4431 / C 751 · 6511 N+1 | −80 000 · 0 | idem |
| (D3) K · annulée (négatif), refaite · janvier avoir constaté | 80 000 | 80 000 |
| (D3) février N+1 · déduction art. 52 | 80 000 | 80 000 |
| (D1) L · perte datée de février (liquidé) | refusée | refusée |
| (D1) L · HT 651 / TVA 4431 | 1 000 000 / 160 000 | idem |
| (D1) L · annulée validée · 6511 / 4162 | 0 / 1 740 000 | idem |
| (D2) M · TVA annulée sans taux / récupérée | 80 000 / 0 | idem |
| mars N+1 · collecte (comptant seul, la perte de M n'encaisse rien) | 16 000 | 16 000 |
| mars N+1 · avoir constaté (L, son négatif, refaite) | 160 000 | 160 000 |
| avril N+1 · 443 débité lu en déduction (art. 126) | 160 000 | 160 000 |
| 6511 N+1 (L 1 000 000 + M 500 000) | 1 500 000 | 1 500 000 |
| 41110102 · 41110105 · 4162 · 4431 · 4432 | 0 | 0 |
| 751 · 4912 · 7594 | −80 000 · 0 · −580 000 | idem |
| annulation d'une perte P (116 000) · lettrage du compte d'origine | 4 lignes lettrées | `A`, 4 lignes |
| juin N+1 · avoir net (perte P puis négatif) · collecte | 0 · 0 | 0 · 0 |

Dossier 2 · SARL, dissolution au 30/06/2026, exercice arrêté, liquidation du
01/07 au 31/12/2026 · ventes 20 000 000 (activité), charges 18 000 000
(liquidation).

| Contrôle | Calcul à la main | Lu |
|---|---|---|
| première cotisation (20 000 000 × 30 %, art. 56) | 6 000 000 | 6 000 000 |
| impôt totalisé (2 000 000 × 30 % > 1 % de 20 000 000) | 600 000 | 600 000 |
| trop-payé de la première cotisation | 5 400 000 | 5 400 000 |
| 8994 (liquidation) | −5 400 000 | −5 400 000 |
| 441 après paiement de la première (−6 000 000 + 6 000 000 + 5 400 000) | 5 400 000 débiteur | 5 400 000 |
| 891 et 4492 (liquidation) | 0 | 0 |
| trop-payé recalculé, 8994 déduit par le cabinet | 5 400 000 | 5 400 000 |

### Rejeu du premier tour de relecture (2026-10-08, base jetable neuve, migrations rejouées, `migrate diff` sans écart)

Dossier 3 · SARL SYSCOHADA assujettie, N = 2026 clôturé, N+1 = 2027.

| Contrôle | Calcul à la main | Lu |
|---|---|---|
| B1 · février · V3 de janvier validée après janvier (au brouillard), portée au 1er février | 80 000 | 80 000 |
| B1 · annulation de janvier avec février liquidé | refusée, nommée | refusée |
| B1 · février puis janvier annulés, janvier refait · V1 + V3 | 240 000 | 240 000 |
| B1 · février relu · V3 jamais deux fois | 0 | 0 |
| mars · P4 payée à moitié · taxe exigible, figée | 80 000 | 80 000 |
| M1 · avril tenu d'avant la règle · V4 portée en mai, `ancienMoteur` | 32 000 | 32 000 |
| M1 · avril sous la règle · mai sans V4 | 0 | 0 |
| MAJEUR 4 · juin d'avant la règle · négatif de V5 repris en juillet, `ancienMoteur` | 80 000 | 80 000 |
| MAJEUR 4 · juin sous la règle · juillet sans reprise | 0 | 0 |
| MAJEUR 2 · P1 · perte qui récupère, lettrage `MODULE` posé dans la transaction | code A, 2 lignes | A, 2 lignes |
| BLOQUANT 1 · P2 au brouillard retirée · lignes au 651, pertes et retours de P2 restants | 1 retirée · 0 · 0 | idem |
| B2 · P4 · moitié déclarée en mars · perte avec duplicata, AVANT l'affinage ci-dessous | refusée · perte au TTC (issue) | refusée · TTC passée |
| B2 · P5 (même cas, octobre) · perte avec duplicata | passe, 4432 soldé | passe |
| B2 · P6 · payée, figée, délettrée, chèque impayé, reclassée | refusée, nommée | refusée |
| MAJEUR 3 · P3 · perte validée, période close au 30/09, annulation | négatifs au 01/10, valeur 15/09 | idem |
| 41110206 après annulation (la créance reste au 416) | 0 | 0 |
| garde · facture P6 / reclassement | refusé | refusé |
| novembre · collecte (pertes P1, P5 · aucun encaissement) | 0 | 0 |
| 4432 fin N · seul le reste de P4 (perte au TTC passée avant l'affinage) | −80 000 | −80 000 |
| clôture N | faite | faite |
| M4 · N+1 · reports au détail de la facture P1 et du reclassement | 2 ouverts | 2 |
| M4 · lettrage automatique · passes par montant suspendues | 0 groupe | 0 |
| M4 · lettrage manuel des deux reports | refusé (motif du reclassement) | refusé |
| M4 · janvier N+1 · collecte | 0 | 0 |
| M4 · moteur · groupe des reports posé en base · collecte, taxe annulée comptée | 0 · 160 000 | 0 · 160 000 |

Dossier 4 · SARL dissoute au 30/06/2026, exercice arrêté (M3).

| Contrôle | Calcul à la main | Lu |
|---|---|---|
| sans constat de la première · totalisation | refusée, nommée | refusée |
| constat 6 000 000 sans réintégration · totalisation | refusée, nommée | refusée |
| réintégration · première lue sur le constat | 6 000 000 | 6 000 000 |
| impôt totalisé · trop-payé | 600 000 · 5 400 000 | idem |

B2 AFFINÉ PENDANT LE REJEU · refuser dès qu'une part était figée laissait,
pour une facture payée à moitié, la moitié impayée de la taxe au 4432 pour
toujours (perte au TTC, rien à récupérer à l'encaissement) · le refus ne
joue plus que si la part déclarée et la part que la perte annulerait
dépassent ensemble la taxe de la ligne (recouvrement), test à l'appui.

## Décisions prises, avec leurs articles

### (C) Délai de l'art. 37, al. 2, par le renvoi de l'art. 126

- Le délai COURT de la constatation du non-paiement (décret n° 011/42,
  art. 126, « constatation [...] de non-paiement »), qui tient la place de
  l'exigibilité de l'art. 37, al. 1 (« dans les conditions prévues pour
  exercer le droit à déduction »). OmegaX la constate par la perte validée
  (D 651 / C 416) ; la DERNIÈRE, la récupération ne s'ouvrant qu'à la créance
  éteinte (O.-L. n° 10/001, art. 52, al. 3, « définitivement »). Ni l'envoi du
  duplicata (forme de la rectification, art. 52 al. 3, décret art. 127 al. 2,
  comme la facture de l'art. 38 dont la réception ne déplace pas le délai,
  lecture d'A21), ni l'irrécouvrabilité comme fait distinct.
- Le délai SE JUGE à la déclaration qui inscrit la récupération (art. 37,
  al. 2, « exercé » ; art. 126, « inscrite dans les déductions afférentes à la
  déclaration ») · déclaration mensuelle (décret art. 102), période lue comme
  pour la déchéance de la déduction (`limiteDecheance`). OmegaX l'inscrit au
  mois qui suit son écriture · l'écriture se date au plus tard le 30 novembre
  de l'année qui suit la constatation. La date du geste n'entre pas en compte.

### (A) Négatif d'une facture

- La taxe se déclare pour la période où elle est exigible (O.-L. n° 10/001,
  art. 25) · une vente annulée par inscription en négatif (AUDCIF art. 20,
  al. 2) n'a pas de taxe à porter · le négatif se lit à la date de la facture
  corrigée, dans sa période tant qu'elle n'est pas liquidée.
- Période liquidée · la taxe déclarée se récupère par imputation (art. 52,
  al. 1 ; décret n° 011/42, art. 126, « inscrite dans les déductions »), une
  fois, au premier jour non liquidé à partir du négatif (AUDCIF art. 22, 4°).
  Pour un achat, reprise de la déduction (décret, art. 127). Note de crédit
  (art. 52, al. 2) dite, non exigée (OmegaX ne la voit pas sur un négatif).
- À l'encaissement (art. 25, 2°) · rien n'était exigible, le négatif retire
  de l'attente.

### (B) Ligne validée après une liquidation

- La taxe exigible reste due (art. 25), la déduction s'exerce jusqu'au
  31 décembre de l'année qui suit (art. 37, al. 2), l'avoir s'inscrit dans
  « la déclaration du ou des mois suivants » (décret, art. 126) · rien ne
  tombe parce qu'une déclaration est passée ; une période liquidée ne se
  redéclare pas · rattachement au premier jour non liquidé (AUDCIF art. 22,
  4°), nommé avec la date d'origine. Une liquidation postérieure à la
  validation a vu la ligne · rien ne bouge.

### (E) Trop-payé de la liquidation (décision de Manasse du 2026-10-08)

- L'impôt de l'année s'éteint d'abord par la première cotisation, puis par les
  acomptes. Excédent d'ACOMPTES · au 4492 (LPF art. 57 ter, « Si les acomptes
  provisionnels versés [...] sont supérieurs à l'impôt dû »). Première
  cotisation (loi n° 23/053, art. 13, al. 1) au-delà de l'impôt totalisé
  (art. 12, al. 4) · dette de l'État, D 441 (fiche du compte 44, « Débité lors
  de la constatation de la dette de l'État envers l'entité [...] par le crédit
  des comptes [...] des classes 7 et 8 ») / C 8994 (fiche du compte 89, 899
  « Dégrèvements et annulations d'impôts sur résultats antérieurs »), semé au
  SYSCOHADA (89940000, détail) ; 441 débiteur rangé en BJ « Autres créances »
  (solde débiteur par compte), 8994 au poste RS (comptes 89).
- Dans l'exercice de liquidation, A11 constate la seconde cotisation
  (impôt totalisé moins la première) et non l'impôt de la seule liquidation
  (défaut d'avant, l'A11 ignorait la totalisation) ; totalisation non
  calculée · refus nommé.

### (D) Perte et récupération (décision de Manasse du 2026-10-08)

- Rien d'acquitté, rien à récupérer (O.-L. n° 10/001, art. 52, al. 1) ;
  rectification par duplicata surchargé (art. 52, al. 3 ; décret n° 011/42,
  art. 127, al. 2 et 3) ; inscription en déduction de la période qui suit
  (décret, art. 126). La taxe à l'encaissement n'a jamais été exigible
  (art. 25, 2°) · annulée au 443 sans déduction.
- Le retour au compte d'origine · texte muet (fiche du compte 65, « par le
  crédit d'un compte de tiers »), décision de Manasse. Les deux pièces se
  lettrent entre elles (origine MODULE) · le moteur de TVA ne lit l'encaissement
  d'une facture que sur SON groupe, que le reclassement ne lettre pas (A7 ter,
  B3) · rien n'est lu comme un encaissement.
- Règle 3 · produit au 751 « Profits sur créances » (fiche du compte 75 des
  deux plans) ; perte antérieure · AUDCIF art. 61 (non exclu par l'art. 3 du
  SYCEBNL), mention aux Notes annexes dite.
- Lecture d'OmegaX (non dictée) · la perte qui récupère est la perte qui
  ÉTEINT la créance (art. 52, al. 3, « définitivement ») · refusée après une
  perte au TTC déjà passée (la règle 3 sert alors), et la perte partielle après
  recouvrement ne sort que le reste.

## Commandes de vérification

```bash
npx jest src/modules/creances-douteuses/recuperation-tva.spec.ts
npx jest src/modules/tva
npx jest src/modules/fiscalite src/modules/exercice/echeancier-dissolution.spec.ts
npx jest src/modules/creances-douteuses src/modules/tva/tva-recuperation-creance-art52.spec.ts
(cd client && npx vitest run src/lib/creances-douteuses.spec.ts)
```

## Relevés non bloquants

- (D) La perte au TTC (sans duplicata) reste une écriture D 651 / C 416,
  comme avant · la consigne ne la ramène pas au compte d'origine, lecture
  gardée ; la perte qui récupère est refusée après une perte au TTC déjà
  passée (la règle 3 sert alors).
- (D) Créance reclassée en N, perdue en N+1 · le lettrage du 416 reste à
  désigner (« Lettrer au 416 », A7 ter B2), comme avant ; au compte
  d'origine, les lignes d'à-nouveau de la facture et du reclassement restent
  ouvertes (règle d'A7, le reclassement ne lettre pas le 411).
- (E) Réglé au premier tour (M3) · la première cotisation se lit sur le
  constat A11 de l'exercice arrêté ; sans constat, ou sans la réintégration
  de l'impôt (art. 45), la totalisation est refusée, nommée.
- (Relecture, mineur) La cadence trimestrielle d'une TVA n'est pas connue
  d'OmegaX · la borne du 30 septembre est dite à côté de celle du 30
  novembre, jamais imposée.
- (Relecture, M4) Le moteur ne rend jamais exigible, après la perte, la taxe
  qu'elle a annulée ; une taxe à l'encaissement d'une facture NON cochée de
  la perte (sans duplicata) reste lue par son groupe, la garde du lettrage
  (reclassement et son report) étant ce qui la protège.
- (Relecture, M2) Le négatif d'un achat à l'encaissement est NOMMÉ sans
  reprendre la déduction prise au règlement · reprendre la part figée au
  premier jour non liquidé est laissé au cabinet (sûreté non établie sur un
  groupe partiellement réglé).

- Le négatif d'une facture À L'ENCAISSEMENT déjà en partie encaissée · la
  taxe des règlements reste déclarée (figée) ; la restitution au client
  relève de la note de crédit (art. 52, al. 2), non chiffrée.
- Les compteurs descriptifs (biens datés à la facture, services aux débits,
  acomptes imputés) restent lus à la date d'écriture · une ligne rattachée
  tard y figure dans sa période d'origine, pas dans celle qui la déclare.
- (E) Le crédit du 8994 entre au résultat comptable de l'exercice de
  liquidation · tant que le cabinet ne le déduit pas (doctrine du 899 d'A11,
  `observationDegrevement`), la totalisation recalculée après validation
  l'inclut, et le constat dit l'écart du trop-payé. Neutralisation d'office
  non codée (aucun texte exprès, même parti que le dégrèvement).
