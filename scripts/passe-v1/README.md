# Passe V1 · banc rejouable des trois dossiers types

Le banc de la passe de la version 1 (`docs/plan-version-1.md`, § 2 et § 4).
Il tient les trois dossiers types sur DEUX exercices complets, 2026 (N) et
2027 (N+1), clôtures de N et de N+1 comprises, et depuis la deuxième passe un
quatrième scénario de CLOISONNEMENT entre trois sociétés, PAR L'API du serveur compilé,
sur une base PostgreSQL JETABLE, et compare chaque solde, chaque total d'état
et chaque déclaration à un montant ATTENDU calculé à la main (ci-dessous).

Trois règles le tiennent.

- **Il ne contourne aucune règle du logiciel.** Un geste juste refusé est un
  constat · le banc consigne le statut et le corps de la réponse, et continue
  avec ce qu'il peut. Il ne réessaie jamais autrement.
- **Il ne s'arrête jamais au premier écart.** Chaque contrôle dit `concorde`
  ou `ÉCART` (attendu, lu, différence) ; le bilan final compte les contrôles,
  les écarts et les erreurs HTTP, avec leur corps.
- **Aucun numéro de compte n'est deviné.** Chaque compte est lu dans le plan
  SEMÉ du dossier (`compte()` lève si le numéro manque) ; les numéros cités
  ici ont été relus dans les deux semis et dans les compétences `sycebnl`,
  `syscohada` et `fiscalite-rdc`.

## Lancer le banc

Prérequis · Node 22, une base PostgreSQL JETABLE (jamais celle de
production), `npm ci` à la racine (le client n'est pas utile).

```bash
PASSE_DATABASE_URL=<chaîne de la base jetable> scripts/passe-v1/lancer.sh [sortie.json]
```

`lancer.sh` migre la base (`prisma migrate deploy`), construit le serveur
(`npm run build`, sauf `PASSE_SANS_BUILD=1`), le démarre sur `PASSE_PORT`
(8745 par défaut) avec `INSCRIPTION_PUBLIQUE=true` et un `JWT_SECRET`
jetable, attend `/health`, joue le banc, puis arrête CE serveur par son seul
PID. La chaîne de connexion n'est jamais affichée.

Contre un serveur déjà démarré ·

```bash
OMEGAX_API=http://localhost:8745 node scripts/passe-v1/passe.mjs /tmp/passe.json
```

Variables · `PASSE_SCENARIOS=association,projet,sarl,cloisonnement` (un
sous-ensemble), `PASSE_PROJET_SANS_INTERETS=1` (voir le projet, constat P1),
`PASSE_HORLOGE` (« 2028-02-15 09:00:00 » par défaut, `aucune` pour l'heure
réelle · voir « L'horloge du serveur »). La sortie JSON
porte `nombreControles`, `concordances`, `nombreEcarts`, `ecarts`,
`erreursHttp` (geste, route, statut, corps), `notes` (gestes sautés faute d'un
préalable) et tous les `controles`.

Fichiers · `lib.mjs` (client à cookie de session et jeton CSRF, une adresse
cliente par dossier comme `e2e/tests/outils.ts`, registre des contrôles,
lectures, relecture de la restitution), `parcours.mjs` (rapprochement sur
relevé, contrôles de clôture, relecture de la liasse et évaluateur de ses
formules, import d'écritures par le modèle de fichier, déroulement d'un modèle
de saisie), `passe.mjs` (lanceur et bilan), `scenario-association.mjs`,
`scenario-projet.mjs`, `scenario-sarl.mjs`, `scenario-cloisonnement.mjs`.
Aucune dépendance ajoutée · ExcelJS est celle du serveur, JSZip vient avec
elle (`node_modules/jszip`).

## L'horloge du serveur (deuxième passe)

Le banc clôture 2026 et 2027 · un cabinet le fait au début de 2028. Plusieurs
règles du logiciel lisent « aujourd'hui » · le contrôle de la banque ne parle
qu'au lendemain de la clôture (`controles/banque-et-cloture-informatique.ts`),
un PV de caisse ne se dresse pas à une date à venir, une facture reçue ne se
déclare pas reçue dans le futur, une relance ne vise qu'une échéance passée.
`lancer.sh` démarre donc le serveur sous libfaketime (paquet système
`faketime`, aucune dépendance npm) au **2028-02-15 09:00:00 UTC**, l'horloge
avançant de là ; `LD_PRELOAD` est posé sur `node` lui-même, dont le PID reste
celui que le lanceur arrête. Seul le serveur est décalé · la base et le banc
gardent leur heure, et le banc lit la même date (`PASSE_HORLOGE`,
`aujourdhui()`). Effet sur la première passe · l'achat A4 (reçu le
01/02/2027) passe désormais par le module de facturation, montants inchangés.
`PASSE_HORLOGE=aucune` garde l'heure réelle · les parcours qui en dépendent le
disent alors en note (non rejoué ainsi à la deuxième passe).

## Conventions de calcul (lues dans les sources, pas de mémoire)

- **Amortissement linéaire, en mois** · première annuité « à compter du
  premier jour du mois de mise en service », mois de sortie compris
  (`common/mois-entre.ts` ; Guide SYSCOHADA, Application 16, « 180 × 9/12 »).
  Les acquisitions tombent un premier du mois.
- **Charge constatée d'avance** · prorata des jours qui débordent l'exercice,
  bornes comprises (`regularisation/dto`) · 3 650 000 sur 365 jours (01/10/2026
  au 30/09/2027), 273 jours en 2027 → 2 730 000.
- **Paie** (`personnel/cotisations-paie.ts`, `bareme-irpp.ts`,
  `fiscalite/arrondi-article-150.ts`) · CNSS 13 % employeur (prestations
  familiales 6,5 %, pension 5 %, risques professionnels 1,5 %) et 5 % ouvrier
  (décret n° 18/041, art. 2 à 4) ; INPP 3,5 % pour un employeur privé de
  moins de 50 salariés depuis le 24/09/2025 ; ONEM 0,5 % ; IRPP · mois
  annualisé net de la quote-part ouvrière, arrondi au millier inférieur,
  barème de l'art. 118 de la loi n° 23/053 (3 % jusqu'à 1 944 000, 15 %
  jusqu'à 21 600 000, 30 % jusqu'à 43 200 000), plafond de 30 %, retenue du
  mois arrondie à la centaine (art. 150). Comptes · 6611, 6641, 6415 (INPP),
  6413 (ONEM), 422, 4311, 4312, retraite 4321 (SYCEBNL) ou 4313 (SYSCOHADA),
  4472, 4428.
- **IS** · 30 % du bénéfice (loi n° 23/053, art. 56), minimum 1 % du chiffre
  d'affaires (art. 57) ; acomptes 30 %, 30 %, 20 % de l'impôt de N-1 au
  25 juillet, 25 septembre, 25 novembre (art. 57 bis LPF, LF n° 25/060).
- **TVA** · 16 %, régime des livraisons ; vente de biens datée à la facture,
  achat de biens déductible à la facture.
- **Dates à venir** · sans l'horloge du serveur, le module de facturation
  refuse une facture REÇUE à une date future · l'achat A4 de 2027 se saisit
  alors au journal des achats, ligne de TVA portant son taux (note dans le
  bilan). Avec l'horloge (par défaut), il passe par le module.

## Scénario 1 · Association (SYCEBNL, jeu associations)

Dossier « Association Lumière du Kasaï », cotisations à l'APPEL (§ 5.4.2.1).

### Opérations 2026

| Date | Opération | Écriture |
|---|---|---|
| 01/01 | Bilan d'ouverture importé | 5211 20 000 000 · 5215 14 000 000 (5 000 USD au cours 2 800) · 5710 1 000 000 · 4011 −2 000 000 · 1011 −30 000 000 · 1210 −3 000 000 |
| 15/01 | Appel des cotisations | D ADH-A 1 800 000, D ADH-B 200 000 / C 701 2 000 000 |
| 20/01 | Fournisseur repris payé | D 4011 / C 5211 2 000 000 |
| 01/02 | Fonds affecté reçu (Partie 3 ch. 2 § 1.2.1) | D 5211 / C 165 5 000 000 |
| 10/02 · 10/03 | Fournitures, puis Règlement des tiers | D 6055 / C FRS-1 1 500 000 ; D FRS-1 / C 5211 |
| 01/03 · 15/03 | Subvention · octroi (fiche du compte 14) puis encaissement | D 4731 / C 1417 6 000 000 ; D 5211 / C 4731 |
| 31/03 | Cotisations encaissées (Règlement des tiers) | D 5211 / C ADH-A 1 800 000 |
| 01/04 | Matériel informatique (module), subvention rattachée | D 2442 / C 5211 6 000 000, 5 ans |
| 10/04 | Don (registre) | D 5211 / C 7041 8 000 000 |
| 20/05 | Legs (registre) | D 5211 / C 7042 2 000 000 |
| 30/06 | Missions du projet, reprise du fonds | D 6384 / C 5211 3 000 000 ; D 165 / C 7925 3 000 000 |
| 01/07 | Véhicule reçu en don (module, § 1.2.2), registre | D 2451 / C 1671 9 000 000, 5 ans |
| 15/08 | Colloque payé 1 000 USD au cours 2 850 | D 6277 / C 5215 2 850 000 |
| 01/10 | Assurance annuelle | D 6251 / C 5211 3 650 000 |
| 31/10 | Créance de ADH-B reclassée douteuse | D 4161 / C ADH-B 200 000 |
| nov., déc. | Paie de deux salariés (1 500 000, classe 6 ; 900 000, classe 1), passation, nets payés | voir ci-dessous |
| 15/12 | Retenues et cotisations de novembre versées | 4311 156 000, 4312 36 000, 4321 240 000, 4472 303 100, 4428 12 000 / 5211 747 100 |
| 31/12 | Charge à payer (électricité) · charge constatée d'avance | D 6052 / C 4081 300 000 ; D 476 / C 6251 2 730 000 |
| 31/12 | Dotations et reprises des fonds | 6813 900 000 + 900 000 ; D 1417 / C 799 900 000 ; D 1671 / C 7923 900 000 |
| 31/12 | Revue de la créance douteuse (50 %) | D 6594 / C 4912 100 000 |
| 31/12 | Réévaluation de la banque en dollars au cours 2 900 | 4 000 USD × 2 900 = 11 600 000 contre 14 000 000 − 2 850 000 = 11 150 000 · gain 450 000 au 776 |

**Paie, un mois.** 1 500 000 · ouvrière 75 000 ; base fiscale 1 425 000 × 12
= 17 100 000 ; impôt 58 320 + 15 % × 15 156 000 = 2 331 720 ; mois 194 310 →
194 300 ; net 1 230 700 ; employeur 97 500 + 75 000 + 22 500, INPP 52 500,
ONEM 7 500. 900 000 · ouvrière 45 000 ; 855 000 × 12 = 10 260 000 ; impôt
58 320 + 15 % × 8 316 000 = 1 305 720 ; mois 108 810 → 108 800 ; net 746 200 ;
employeur 58 500 + 45 000 + 13 500, INPP 31 500, ONEM 4 500. Les deux · nets
1 976 900, 6641 312 000, 6415 84 000, 6413 12 000, 4472 303 100.

**Résultat 2026 = 1 164 000.** Produits 17 250 000 · 701 2 000 000, 7041
8 000 000, 7042 2 000 000, 7925 3 000 000, 799 900 000, 7923 900 000, 776
450 000. Charges 16 086 000 · 6055 1 500 000, 6384 3 000 000, 6277
2 850 000, 6052 300 000, 6251 920 000, 6611 4 800 000, 6641 624 000, 6415
168 000, 6413 24 000, 6594 100 000, 6813 1 800 000.

**Trésorerie 2026.** 5211 · 20 000 000 + 1 800 000 + 6 000 000 + 8 000 000 +
2 000 000 + 5 000 000 − 2 000 000 − 1 500 000 − 6 000 000 − 3 000 000 −
3 650 000 − 2 × 1 976 900 − 747 100 = 21 949 100 ; 5215 11 600 000 ; 5710
1 000 000 ; total 34 549 100 (ouverture 35 000 000, variation −450 900).

**Bilan 2026 = 50 579 100.** Actif · 2442 net 5 100 000, 2451 net 8 100 000,
4161 net 100 000, 476 2 730 000, trésorerie 34 549 100. Passif · 1011
30 000 000, 1210 3 000 000, résultat 1 164 000, 1417 5 100 000, 1671
8 100 000, 165 2 000 000, 4081 300 000, dettes sociales et fiscales 915 100.

Contrôles aussi · NOTE 5B (acquisitions 15 000 000, brut à la clôture
15 000 000), registre des donateurs (inscrit 19 000 000 = 7041 8 000 000 +
7042 2 000 000 + crédits du 1671 9 000 000, `correspondance-registre.ts`).

### 2027

À-nouveaux de la clôture, reprises d'ouverture (D 4081 / C 6052 300 000 ;
D 6251 / C 476 2 730 000), retenues de décembre versées (915 100), électricité facturée 300 000 puis réglée,
cotisations 2 200 000 appelées et encaissées, don 1 500 000, missions
2 000 000 et reprise du solde du 165, recouvrement de 50 000 et perte de
150 000 au 6512 sur la créance douteuse, dotations (1 200 000 et 1 800 000)
et reprises (799 1 200 000, 7923 1 800 000), revue à zéro (reprise 100 000 au
7594), réévaluation au cours 3 000 (4 000 USD · gain 400 000). Puis la
SITUATION AVANT L'ASSEMBLÉE · bilan de 2027 lu avec les opérations passées et
le résultat 2026 encore au 13 (actif = passif = 45 684 000 attendu), et
seulement ensuite l'affectation du résultat 2026 au 1210 (décision du
30/06/2027).

**Inventaire de la caisse au 31/12/2027 (deuxième passe).** Campagne
d'inventaire de 2027, sous-commission « Caisse du siège » (une caissière
INVENTORIANT, un trésorier TÉMOIN), fiche du 57100000 valorisée 995 000, PV de
comptage de la caisse (aperçu lu d'abord · solde du livre-journal au 31/12 =
1 000 000 ; espèces 995 000 ventilées 99 × 10 000 + 1 × 5 000 ; attestation
signée), écart figé −5 000, PV de la campagne, rapprochement des fiches
(écart du 57100000 −5 000), arbitrage « à redresser » avec la caissière pour
responsable, proposition du module (contrepartie VIDE, 57100000 crédité de
5 000), écriture passée par le cabinet D 65800000 « Charges diverses » / C
57100000 5 000 (fiche SYCEBNL du compte 65 · 658 Charges diverses, débité
« par le crédit d'un compte de tiers ou de trésorerie » ; aucun texte ne nomme
le compte d'un manquant de caisse, le choix est celui du banc), validée,
proposée parmi les candidates, rattachée, campagne close.

**Résultat 2027 = 1 315 000** (produits 9 200 000 · 701 2 200 000, 7041
1 500 000, 7925 2 000 000, 799 1 200 000, 7923 1 800 000, 7594 100 000, 776
400 000 ; charges 7 885 000 · 6251 2 730 000, 6384 2 000 000, 6512 150 000,
6813 3 000 000, 658 5 000, 6052 nul). Trésorerie 35 479 000 (5211 22 484 000,
caisse 995 000), variation 929 900. Bilan 45 679 000 (2442 net 3 900 000, 2451
net 6 300 000, trésorerie ; 1011, 1210 4 164 000, résultat, 1417 3 900 000,
1671 6 300 000). La situation avant l'assemblée, lue avant l'inventaire, reste
à 45 684 000. Colonne N-1 du bilan et du compte de résultat de 2027 = 2026.
Bilan de 2027 lu à l'ouverture (avant toute opération) et avant l'affectation
· actif = passif. 2028 · résultat 2027 au 13 = −1 315 000.

## Scénario 2 · Projet de développement (SYCEBNL, jeu projets)

Partie 3 ch. 3 · décaissement du bailleur au 162 et au 462, charges
neutralisées au fil de l'engagement (D 462 / C 702), immobilisations sans
amortissement (Acte uniforme art. 7 et 9). Nomenclature budgétaire en plan
analytique à budgets, classes 2 et 6 ventilées · R1 Équipements, R2
Fournitures, R3 Missions et transports, R4 Services extérieurs. `I` vaut
120 000 (intérêts du dépôt, 77470000, seul produit non neutralisé), 0 avec
`PASSE_PROJET_SANS_INTERETS=1`.

| 2026 | Opération | Section |
|---|---|---|
| 01/02 | D 5211 40 000 000 / C 162 22 000 000 / C 462 18 000 000 | |
| 15/03 | Pompe 24110000 15 000 000 (module, contrepartie 4812), payée le 15/04, lettrée | R1 |
| 01/06 | Véhicule 24510000 6 000 000 (module, payé en banque) | R1 |
| 10/05 | Fournitures 60470000 4 000 000 au fournisseur, payées le 10/06 et lettrées | R2 |
| 15/12 | Fournitures 60470000 1 000 000 au fournisseur, non payées | R2 |
| 20/07 | Missions 61810000 2 500 000 (banque) | R3 |
| 30/09 | Entretien 62420000 3 000 000 (banque) | R4 |
| 31/12 | Intérêts D 5211 / C 77470000 `I` | |

Budgets 2026 · R1 22 000 000, R2 6 000 000, R3 4 000 000, R4 5 000 000.

**Attendus 2026.** Banque 9 500 000 + I ; 162 −22 000 000 ; 462 −18 000 000
+ 10 500 000 = −7 500 000 ; fournisseurs −1 000 000. Emplois-ressources ·
FA 40 000 000, FD I, GR 40 000 000 + I ; FI 15 000 000 (variation du 481
nulle), FJ 6 000 000, GS 21 000 000 ; FM 5 000 000 − 1 000 000 (dette
fournisseur, renvoi 4) = 4 000 000, FN 2 500 000, FO 3 000 000, GT
9 500 000 ; GU 30 500 000 ; GV = GX = GY = 9 500 000 + I ; GW 0. Exécution
budgétaire (budget, décaissement, engagement, crédit disponible) · R1 22 M,
21 M, 0, 1 M ; R2 6 M, 4 M, 1 M, 1 M ; R3 4 M, 2,5 M, 0, 1,5 M ; R4 5 M, 3 M,
0, 2 M (une dépense au tiers est engagée tant que sa ligne n'est pas lettrée).
Réconciliation · A 0, B 40 000 000, C I, F 30 500 000, G 9 500 000 + I.
Bilan · total 30 500 000 + I ; CA 22 000 000, CC I, DF 7 500 000, DG
1 000 000, BW 9 500 000 + I. Compte d'exploitation · RA 10 500 000.

**2027.** Affectation de I au 1210 ; budgets R1 5 M, R2 1 M, R3 4 M, R4 7 M ;
fournisseur de 2026 payé le 20/01 (lettré à son à-nouveau) ; décaissement
20 000 000 (162 5 000 000, 462 15 000 000) ; ordinateurs 24420000 4 000 000
payés ; transport 61830000 3 000 000 ; maintenance 62430000 6 000 000.
Banque 15 500 000 + I ; 162 −27 000 000 ; 462 −13 500 000. Emplois-ressources
de l'exercice · GR 20 000 000, GS 4 000 000, FM 1 000 000 (dette de 2026
payée), GT 10 000 000, GU 14 000 000, GV 6 000 000, GW 9 500 000 + I, GX = GY
= 15 500 000 + I ; cumul début = colonne fin de 2026 ; cumul fin · GR
60 000 000 + I, GS 25 000 000, GT 19 500 000, GU 44 500 000, GY 15 500 000 + I.
Réconciliation · A 9 500 000 + I, B 20 000 000, F 14 000 000, G 15 500 000 + I.
Bilan · total 40 500 000 + I, N-1 30 500 000 + I, CB I, CC 0. À-nouveaux 2028
relus après la clôture de 2027.

## Scénario 3 · SARL (SYSCOHADA, système normal, assujettie)

Dossier « Kivu Distribution SARL », forme SARL, assujettie (TVA16 du plan semé,
4431 collectée, 4452 récupérable, 4441 due), inventaire INTERMITTENT.

### Opérations 2026

| Date | Opération |
|---|---|
| 01/01 | Bilan d'ouverture importé · 5211 30 000 000, 3111 8 000 000, 4011 −8 000 000, 1013 −25 000 000, 1210 −5 000 000 |
| 10/01 | Fournisseur repris payé 8 000 000 ; achat A1 HT 4 000 000 (TVA 640 000), payé le 10/02 |
| 15/01 · 25/01 | Acompte de C1 au 4191 2 320 000 ; vente V1 HT 5 000 000 (TTC 5 800 000) ; acompte imputé, lettré en PARTIEL avec V1 |
| 12/02 · 20/02 | Achat A2 HT 3 000 000 payé le 15/03 ; règlement partiel de V1 2 480 000 (groupe complété, reste 1 000 000) ; vente V2 HT 6 000 000 encaissée le 20/03 |
| janv., févr. | TVA déclarée et liquidée · janvier 800 000 − 640 000 = 160 000 ; février 960 000 − 480 000 = 480 000 ; payées le 15/02 et le 15/03 |
| 05/03 · 10/04 | Vente V5 HT 1 000 000 annulée par inscription en négatif, lettrée avec son négatif · TVA de mars et d'avril attendue nulle |
| 01/04 | Camion 24510000 24 000 000 (module, payé), 4 ans |
| 15/05 | Vente V6 à C3 HT 2 000 000 (TTC 2 320 000), jamais payée |
| 10/06 · 15/07 | Achat A3 HT 6 000 000 payé le 10/07 ; vente V3 HT 8 000 000 encaissée le 15/08 |
| 10/09 | Export à C2 · 10 000 USD au cours 2 850 = 28 500 000 (70120000) |
| 10/11 | C2 paie 6 000 USD au cours 2 880 · banque 17 280 000, tiers soldé au coût historique 17 100 000, gain réalisé 180 000 au 756 |
| 25/07, 25/09, 25/11 | Acomptes d'IS 3 × 300 000 au 4492 |
| 01/12 | Loyer 6 000 000 |
| nov., déc. | Paie · 2 000 000 (classe 7) · ouvrière 100 000 ; 1 900 000 × 12 = 22 800 000 ; impôt 58 320 + 2 948 400 + 30 % × 1 200 000 = 3 366 720 ; mois 280 560 → 280 600 ; net 1 619 400 ; employeur 130 000 + 100 000 + 30 000, INPP 70 000, ONEM 10 000 |
| 30/11 · 31/12 | V6 reclassée douteuse (4162 2 320 000), revue à 50 % du TTC (6594 / 4912 1 160 000) |
| 31/12 | Inventaire · 190 sacs, 9 500 000 → variation 6031 −1 500 000 ; dotation 24 000 000 / 4 × 9/12 = 4 500 000 ; réévaluation au cours 2 900 · 4 000 USD de 11 400 000 à 11 600 000, gain latent 200 000 au 479 |
| 31/12 | IS · résultat 21 840 000, impôt 6 552 000 (minimum 495 000), écriture D 891 / C 441, acomptes imputés 900 000, impôt réintégré |

**Résultat 2026.** Produits 49 680 000 (7011 21 000 000 · V1 + V2 + V3 + V6 ;
7012 28 500 000 ; 756 180 000) ; charges avant impôt 27 840 000 (6011
13 000 000, 6031 −1 500 000, 6222 6 000 000, 6611 4 000 000, 6641 520 000,
6415 140 000, 6413 20 000, 6813 4 500 000, 6594 1 160 000) ; résultat avant
impôt 21 840 000 ; IS 6 552 000 ; net 15 288 000. Acomptes 2027 · 1 965 600,
1 965 600, 1 310 400.

**Banque 2026 = 10 461 200** (30 000 000 − 8 000 000 + 2 320 000 − 4 640 000
+ 2 480 000 − 3 480 000 + 6 960 000 − 6 960 000 + 9 280 000 + 17 280 000 −
24 000 000 − 6 000 000 − 2 × 1 619 400 − 900 000 − 160 000 − 480 000).

**Bilan 2026 = 54 181 200.** Actif · camion net 19 500 000, stock 9 500 000,
clients 12 600 000 (C1 1 000 000, C2 11 600 000), 4162 net 1 160 000, 4452
960 000, banque. Passif · capital 25 000 000, report 5 000 000, résultat
15 288 000, 479 200 000, 4431 1 600 000, 441 5 652 000, dettes sociales
1 441 200. TFT · ouverture 30 000 000, variation −19 538 800, clôture
10 461 200. NOTE 3A · acquisitions 24 000 000. Liasse Excel relue (voir plus
bas).

**Rapprochement bancaire sur relevé importé (deuxième passe).** Premier
rapprochement du 52110000 · solde de départ DÉCLARÉ 30 000 000 au 01/01/2026
(le relevé, jamais l'à-nouveau ; l'écart d'ouverture se lit sur l'à-nouveau
importé, 30 000 000 − 30 000 000 = 0). Le relevé CSV (en-têtes Date, Libellé,
Débit, Crédit · un crédit de la banque est un débit du 52) porte les dix-sept
mouvements du livre à leur date de valeur, un ou deux jours après, et pas le
virement du salaire net du 31/12 (1 619 400), que la banque n'a pas encore
passé · crédits 38 320 000, débits 56 239 400, solde imprimé 30 000 000 +
38 320 000 − 56 239 400 = **12 080 600** (contrôle du relevé nul). Propositions
par montant et date (fenêtre de 15 jours, celle que l'écran envoie) · 17, une
par ligne · les trois acomptes de 300 000 sont à deux mois d'écart, les deux
nets de 1 619 400 à trente jours, les deux 6 960 000 de sens contraires.
Confirmées · solde pointé 12 080 600, écart nul, un suspens de −1 619 400
(livre 10 461 200 = relevé 12 080 600 − 1 619 400), rapprochement CLOS au
31/12/2026. Le contrôle BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE nomme le
52110000 avant, plus après. À part · la route des propositions SANS
`fenetreJours`, que le contrôleur déclare facultatif, doit répondre 200.

### 2027

Extourne de la réévaluation (D 479 / C 411 200 000), retenues 2026 versées
1 441 200,
solde de V1 1 000 000 (le groupe partiel doit traverser la clôture), achat A4
HT 7 000 000 payé, C2 paie 4 000 USD au cours 2 950 (11 800 000 contre
11 400 000 · gain réalisé 400 000), vente V4 HT 30 000 000 encaissée, IS 2026
soldé 5 652 000, perte de la créance de C3 avec duplicata (651 2 000 000 HT,
4431 débité de 320 000), cession du camion le 30/06 pour 18 000 000 (dotation
3 000 000, VNC 16 500 000), acomptes 5 241 600, loyer 6 000 000, inventaire
140 sacs 7 000 000 (6031 +2 500 000), revue à zéro (7594 1 160 000), IS
30 % × 12 560 000 = 3 768 000, acomptes imputés à hauteur de l'impôt (4492
garde 1 473 600, art. 57 ter LPF). Puis la SITUATION AVANT L'ASSEMBLÉE ·
bilan de 2027 lu avec les opérations passées, le résultat 2026 encore au 13
(actif = passif = 60 160 000 attendu), et seulement ensuite l'affectation
(réserve légale 10 % = 1 528 800, AUSCGIE art. 346 ; report 13 759 200).

**Résultat 2027 = 8 792 000** (avant impôt 12 560 000 = 30 000 000 + 400 000
+ 18 000 000 + 1 160 000 − 7 000 000 − 2 500 000 − 6 000 000 − 3 000 000 −
16 500 000 − 2 000 000). Banque 49 606 400. Bilan 60 160 000 (stock
7 000 000, 4452 2 080 000, 4492 1 473 600, banque ; capital, réserve légale
1 528 800, report 18 759 200, résultat, 4431 6 080 000). TFT · ouverture
10 461 200, variation 39 145 200, clôture 49 606 400.

### 2028 · modèle de saisie, import d'écritures, lettrage, relance (deuxième passe)

Après les deux clôtures, au 15/02/2028 (horloge du serveur).

- **Modèle de saisie** « Vente de ciment TVA 16 % (Mines du Sud) » sur VEN ·
  C1 au débit ÉQUILIBRER, 70110000 au crédit SAISIR, 44310000 au crédit
  CALCULER au taux TVA16 (fonctions relues dans cet ordre). Trois ventes
  passées en le déroulant (Sage i7 · la taxe sur la ligne précédente,
  l'équilibrage en dernier) · FV-2028-001 du 05/01 HT 1 000 000 → TTC
  1 160 000, échéance 20/01 ; FV-2028-002 du 08/01 HT 2 000 000 → 2 320 000,
  échéance 25/01 ; FV-2028-003 du 12/01 HT 500 000 → 580 000, échéance 25/01.
- **Import d'écritures** par le fichier du modèle (en-tête LU dans
  `client/src/lib/modele-import.ts`, correspondance des colonnes PROPOSÉE par
  l'analyse, aucune manquante) · deux virements reçus sur BQ, le 20/01 de
  1 160 000 (référence FV-2028-001) et le 25/01 de 2 320 000 (référence
  VIR-2028-778), puis validation au 31/01 · deux écritures BQ validées.
  Banque 49 606 400 + 1 160 000 + 2 320 000 = 53 086 400 ; C1 3 480 000 +
  580 000 − 3 480 000 = 580 000 ; 4431 = à-nouveau 6 080 000 + 560 000 =
  −6 640 000 ; 7011 −3 500 000 ; TVA de janvier 2028 collectée 560 000 (le
  taux est porté par la ligne « Calculer », la déclaration le lit).
- **Pré-lettrage de C1** · une paire par RÉFÉRENCE (FV-2028-001, la facture et
  le virement de même référence), une par MONTANT (2 320 000), une ligne non
  proposée (FV-2028-003). La première est CONFIRMÉE, la seconde laissée au
  **lettrage automatique** (un groupe posé). Reste ouverte FV-2028-003 seule ;
  origines gardées (AUTOMATIQUE_PIECE, AUTOMATIQUE_MONTANT).
- **Relance** · adresse de Mines du Sud posée, positions de RAPPEL · C1 doit
  580 000, retard de FV-2028-003 au 15/02 = 21 jours (échue le 25/01),
  niveau suggéré 2 (rappel à 15 jours, niveaux semés −7 / 15 / 45). Émise au
  niveau 2 · une lettre écrite et MISE EN FILE, rien d'envoyé (`/courrier`,
  statut EN_ATTENTE ou SANS_TRANSPORT ; le banc n'appelle jamais
  `/courrier/reprendre`), montant figé 580 000 à l'historique.
- **Restitution finale** relue après ces gestes.

## Deuxième passe · liasse, restitution et contrôles de clôture

**Liasse Excel relue.** Le classeur produit est ouvert (ExcelJS). Le serveur
écrit ses formules SANS résultat en cache · le banc les calcule lui-même
(`evaluateur` de `parcours.mjs` · références avec ou sans feuille, plages,
+ − × ÷, comparaisons, `&`, SUM, ABS, ROUND, MIN, MAX, IF, TEXT, AND, OR) pour
voir ce que le lecteur verra. Feuilles CONTROLES et CONTROLE BALANCE · aucune
formule en erreur (#REF!, #VALUE!, #DIV/0!, #NAME?) ; chaque ligne « doit être
0 » à zéro ; les totaux qu'elle désigne confrontés aux états servis par l'API
· SARL 2026 BZ = DZ = 54 181 200, XI = CJ = 15 288 000, ZH = 10 461 200 ; SARL
2027 BZ = DZ = 60 160 000, XI = CJ = 8 792 000, ZH = 49 606 400 ; association
2026 BZ = DZ = 50 579 100, 2027 BZ = DZ = 45 679 000 ; projet 2026 BZ = DZ =
30 620 000, 2027 BZ = DZ = 40 620 000. La ligne XC du projet (« doit boucler à
0 en régime normal ») vaut le résultat du projet · 120 000 en 2026 (intérêts),
0 en 2027 ; le banc la confronte à ce résultat, pas au zéro du modèle.

**Restitution relue** (`restitution()` de `lib.mjs`, à la fin de 2027 et, pour
la SARL, après 2028). Archive produite, `MANIFESTE.md` présent et nommant le
dossier, tables `tenant`, `exercice`, `journal`, `compte`, `tiers`,
`ecriture`, `ligne-ecriture`, `evenement-audit` présentes et non vides, une
ligne d'exercice par exercice du dossier, et `controles.txt` sans table en
écart · ses lignes « ECART » sont relevées, et le nombre de lignes du CSV des
écritures confronté au nombre que le contrôle dit annoncé et écrit.

**Contrôles de clôture** (`confronterControles`, GET `/controles` à la fin de
chaque exercice, avant la clôture). Chaque code levé est confronté à la liste
attendue du scénario, qui dit pourquoi il est juste ; un code de plus est un
contrôle levé à tort, un code de moins un contrôle manquant. Communs aux trois
dossiers et aux deux exercices · CLOTURE_INFORMATIQUE_EN_RETARD (aucune
clôture de période posée, l'échéance du premier trimestre, le 30/06, est
passée au 15/02/2028), DATE_ARRETE_NON_RENSEIGNEE, MANUEL_PROCEDURES_ABSENT,
SANS_PIECE (écritures du banc sans référence), VALIDATION_PAR_SON_AUTEUR (un
seul utilisateur), CHARGE_SANS_TIERS (charges payées directement par la
banque · assurance, missions, colloque ; missions, entretien, transport,
maintenance ; loyer). Par dossier ·
BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE (association 52110000 et 52150000,
projet 52110000, les deux années ; SARL 2027 seulement, 52110000 · le relevé
clos du 31/12/2026 ne couvre pas 2027) ; TIERS_ANCIEN_NON_LETTRE (INFORMATION ·
association 2026, dette fournisseur reprise et son règlement non lettrés, appel
de la créance reclassée, annoté « à ne pas lettrer » ; association 2027, 408
repris à l'ouverture et son à-nouveau ; SARL 2026, acompte 4191 et son
imputation, dette reprise et son règlement, groupe PARTIEL de V1 encore ouvert ;
SARL 2027, écart de réévaluation reporté sur C2 et son extourne). En plus ·
CHARGE_SANS_TIERS ne doit pas viser le redressement du manquant de caisse
(constat de la deuxième passe).

## Scénario 4 · Cloisonnement entre sociétés (deuxième passe)

Trois dossiers nés ensemble par l'inscription · A « Cloison Alpha SARL » et B
« Cloison Beta SARL » (SYSCOHADA normal, SARL, assujetties), C « Cloison Gamma
Association » (SYCEBNL, associations). Mêmes numéros de comptes (52110000,
62220000, 60520000, 40110001 et 41110001 nés avec les tiers), mêmes tiers
(« Fournisseur Commun » FRS-COMMUN, « Client Commun » CLI-COMMUN), mêmes
références (REF-0000, REF-0001, REF-E01 à E04), la même facture FV-0001 chez A
et chez B. Chaque montant de base reçoit l'écart du dossier · A +101, B
+202,47, C +303 · si bien qu'aucune somme des montants de A n'écrit un montant
de B (les 47 centimes) ; seuls un marqueur dans les libellés (ALPHA-QX19,
BETA-ZK47, GAMMA-MW83), les montants et les identifiants distinguent les
dossiers.

| Opération (étape après étape, les trois dossiers en Promise.all) | A | B | C |
|---|---|---|---|
| 02/01 apport D 52110000 / C 10130000 (C · 10210000) | 10 000 101 | 10 000 202,47 | 10 000 303 |
| 10/01 loyer D 62220000 / C 40110001 ; 20/01 réglé, lettré | 1 000 101 | 1 000 202,47 | 1 000 303 |
| 31/01, 28/02, 31/03, 30/04 électricité D 60520000 / C 52110000 | 4 × 75 101 | 4 × 75 202,47 | 4 × 75 303 |
| 15/02 FV-0001 HT au client homonyme, TVA 16 % (SARL) | 2 000 101 + 320 016,16 | 2 000 202,47 + 320 032,40 | · |
| Banque | 8 699 596 | 8 699 190,12 | 8 698 788 |
| Résultat | 699 596 | 699 190,12 | −1 301 515 |
| Bilan | 11 019 713,16 | 11 019 424,99 | 8 698 788 |

Banque = apport − loyer − 4 × électricité ; résultat SARL = HT − loyer − 4 ×
électricité, association = −(loyer + 4 × électricité) ; bilan SARL = banque +
TTC (passif · apport + résultat + TVA). Le grand livre du 52110000 a six lignes
dans chaque dossier, toutes à son marqueur. **Numérotation** · séquence par
journal (OD, ACH, VEN 1 à 1) et, la banque étant semée en numérotation
MENSUELLE, par mois (BQ janvier 1 à 2, février à avril 1 à 1), identique dans
les trois dossiers malgré les créations simultanées.

**Tentatives de A sur B** (session de A, identifiants réels de B · attendu 403
ou 404, jamais 2xx ni 5xx, réponse fouillée OUVERTE · un classeur se lit
dézippé) · lectures (grand livre, liste, balance, bilan, export du journal,
tiers, lettrage, rapprochement, bulletin, contrôles), écritures (modifier,
valider, supprimer la pièce au brouillard de B, corriger une écriture validée),
lettrage (délettrer, lettrer), comptes et tiers (renommer, supprimer), facture
(supprimer, note de crédit, comptabiliser dans A), exercice (clôturer, arrêter
les comptes), bien (doter, céder), rapprochement (pointer, départ, clôturer,
annuler, rouvrir), bulletin (annuler, remise), utilisateur (rôle, désactiver,
réinitialiser, journaux), puis les identifiants de B glissés dans un geste de
A (écriture sur ses comptes, règlement de sa facture, facture à son tiers,
rapprochement sur sa banque, bien sur son compte, créance douteuse sur son
client · refus 400, 403 ou 404 admis). B est photographié par SA session avant
et après (balance, écritures et leurs lignes avec lettrage et pointage, tiers,
comptes, factures, biens, exercices, rapprochements, bulletins, utilisateurs) ·
rien ne doit bouger ; A non plus (banque, aucun bien).

**Rien de B chez A** · listes, recherches (libellé « Loyer », référence
REF-0001, montant du loyer de B · aucune écriture), balance, tiers, comptes,
factures, biens, rapprochements, salariés, bulletins, utilisateurs, journal
d'audit, contrôles, exports du journal, du grand livre et de la balance,
liasse, restitution · aucune chaîne propre à B (marqueur, nom, adresse,
identifiants, montants à 47 centimes), et chaque artefact porte bien un témoin
de A (sans quoi la fouille ne prouverait rien).

**Utilisateurs** · un comptable et une lecture seule créés dans A, connectés
(mot de passe provisoire changé) à A et à A seul, refusés sur un tiers de B ;
une connexion qui nomme le dossier B ne mène pas à B ; A ne peut pas inviter
l'adresse de l'administrateur de B (refus sans un mot de B), qui se connecte
toujours à B avec son rôle. Changement de rôle du comptable de A (sa session
se ferme) et désactivation de sa lecture seule (elle ne se connecte plus) ·
dans B, les sessions de l'administrateur et d'un comptable restent ouvertes,
leurs rôles et la liste des utilisateurs de B inchangés.

**Clôtures simultanées** · B retire sa pièce au brouillard, annule son
bulletin et son rapprochement, chacun valide, puis les trois clôtures 2026
partent ensemble et aboutissent. À-nouveaux 2027 · banque, résultat au 13
(−699 596, −699 190,12, +1 301 515), apport, client homonyme, et pour B son
bien 1 200 202,47 et le 4812 opposé (A · aucun bien).

## Contrôles des deux corrections du gel

Écrits comme des contrôles au passage d'essai (2af9371, en écart), ils
concordent depuis l'intégration des deux lignes sur `main` (8f49df3, première
passe du 2026-10-08). Règle décidée pour la perte avec duplicata · retour
D 411 / C 4162, puis D 651 HT / D 443 / C 411 ; la dépréciation se calcule au
TTC.

- `lettrage-cloture` · « 2027 · lettrage partiel de V1 reconduit à la
  clôture » (SARL). Sans la correction, les lignes de V1 arrivent en 2027
  séparées et non lettrées ; le banc les lettre à la main avec le solde pour
  continuer (note).
- `tva-decisions` point A · « TVA 2026-03 · collectée » (SARL) · le négatif de
  V5 doit se lire à la date de la facture corrigée (mars nul).
- `tva-decisions` point D · « perte de C3 avec duplicata en une écriture » et
  les mouvements du 651 (débit 2 000 000, aucun crédit). Sans la correction,
  le banc passe la perte au TTC puis « Récupérer la TVA » (D 4431 / C 651) ;
  le 651 net est le même.

## Limites du banc

- Il relit la liasse (feuilles CONTROLES et CONTROLE BALANCE) et la
  restitution ; le journal, le grand livre et la balance exportés ne sont relus
  que par la fouille du cloisonnement, pas ligne à ligne.
- L'évaluateur de formules ne connaît que les fonctions que les feuilles de
  contrôle écrivent ; une autre est dite « non évaluée » en note, jamais
  comptée en erreur.
- Les parcours navigateur du plan (§ 4) restent à jouer par `e2e/`.
- Hors du banc · double authentification, encours d'ouverture d'un
  rapprochement, ligne de relevé sans écriture, PV de caisse compté après la
  clôture, relance au-delà de la mise en file (envoi réel).
- L'horloge du serveur est décalée (2028-02-15) ; la base et le banc gardent la
  leur.
- Une seule devise (USD), un seul taux de TVA (16 %), un seul plan
  analytique ; aucune note annexe n'est relue en entier (5B, 3A seulement).
