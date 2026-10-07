# Cas chiffrés · clôture et états financiers

Même méthode que `docs/cas-chiffres/is.md` · on part des CALCULS, non des
obligations. Douze situations (neuf dossiers, la première société portant les
situations C01 à C04) sont calculées à la main, poste par poste, d'après les
textes lus dans les compétences, puis rejouées dans OmegaX sur une vraie base,
par l'API du serveur compilé (`scripts/cas-chiffres/rejeu-cloture.mjs`). Rien
n'est corrigé dans `src/` · le document rend un constat.

Code relu · `main` au commit `c0c3fb7` (modules `exercice/`, `affectation/`,
`etats-financiers/`, `etats-financiers-syscohada/`, `import/`, `controles/`).
Rejeu · 2026-10-07, base PostgreSQL 16 jetable (créée pour le rejeu, supprimée
après), serveur compilé (`node dist/main.js`), neuf dossiers nés par
l'inscription, écritures au journal OD, validation, clôtures annuelles de N et
de N+1 traversées dans chaque dossier (de N+1 et N+2 pour C05), affectation du
résultat par sa route.

**Bilan du rejeu · 1 081 comparaisons, 74 écarts**, regroupés en quatre
constats BLOQUANTS, sept constats non bloquants et trois questions, tranchées
depuis (section « Corrections à coder », qui donne aussi la correction de
chaque constat). Les
comparaisons comptent chaque poste de chaque lecture (avant et après clôture,
colonne N et colonne N-1, gestes et contrôles) · un même défaut y paraît donc
plusieurs fois.

## Sources lues

Toutes dans les compétences installées, lues le 2026-10-07 avant d'écrire un
chiffre.

| Abr. | Fichier | Contenu lu |
|---|---|---|
| [AU1] | `audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md` | art. 22 (1° à 7°, dont 2° validation et 4° date de valeur), art. 23, art. 34 (correspondance des bilans, comparatif N-1) |
| [AU5] | `audcif-acte-uniforme/references/titre-5-cadre-conceptuel.md` | correspondance bilan de clôture et bilan d'ouverture (« les produits/charges d'exercices précédents omis […] transitent par le compte de résultat »), omission d'un exercice antérieur « comptabilisée en AO de l'exercice de rectification » |
| [AU7-1] | `audcif-acte-uniforme/references/titre-7-comptes-classe-1.md` | fiches des comptes 11 (réserve légale, 10 % jusqu'au cinquième du capital), 12, 13 (« Dans les entités individuelles, le solde du compte 13 est viré au compte 103 »), 14 |
| [AU7-6] | `audcif-acte-uniforme/references/titre-7-comptes-classe-6.md` | fiches 637 et 667 (« à la clôture de l'exercice, le compte 637 est viré, pour solde, au débit du compte 667 ») |
| [AU9] | `audcif-acte-uniforme/references/titre-9-ch1-5-bilan-resultat-flux.md` | ch. 3 (bilan AD à DZ), ch. 4 (compte de résultat TA à XI, logique de signe), ch. 5 (TFT ZA à ZH, CAFG, variations N moins N-1, reconstitution des acquisitions, financement) |
| [AU9-7] | `audcif-acte-uniforme/references/titre-9-ch6-7-notes-annexes-correspondance.md` | ch. 7, correspondance postes et comptes du bilan et du compte de résultat, clés de lecture |
| [AU10] | `audcif-acte-uniforme/references/titre-10-systeme-minimal-tresorerie.md` | ch. 1 (comptabilité de trésorerie, inventaire extra-comptable, amortissement linéaire sans prorata), ch. 2 (bilan et compte de résultat SMT, G = C − D + E − F), ch. 3 (notes 1 à 4, journal de trésorerie) |
| [CGIE] | `auscgie-acte-uniforme/references/partie1-livre2-fonctionnement.md`, `partie2-livre3-sarl.md` | art. 142, 143 (bénéfice distribuable), art. 346 (réserve légale de la SARL, nullité), art. 371 (capitaux propres sous la moitié du capital) |
| [FIS] | `fiscalite-rdc/code-general-2026/references/04-loi23-053-titre2-impot-societes.md` | art. 56 (30 %), art. 57 (minimum de 1 % du chiffre d'affaires déclaré) · seulement pour chiffrer la charge d'impôt des cas, l'impôt n'étant pas l'objet ici (voir `is.md`) |
| [SYS] | `syscohada/comptes/references/plan-comptes.tsv` | chaque compte SYSCOHADA utilisé (1013, 103, 1048, 111, 121, 1291, 131, 139, 162, 2441, 2451, 2844, 2845, 3111, 4011, 4111, 422, 441, 465, 5211, 5711, 6011, 6031, 6222, 6241, 6371, 6611, 6671, 6712, 6813, 7011, 812, 822, 8911, 895) |
| [SY2] | `sycebnl/references/partie2-ch2-plan-comptes.md`, `partie2-ch3-classe6-comptes60-69.md`, `partie2-ch3-classe7-comptes70-79.md` | chaque compte SYCEBNL utilisé (1011, 118, 121, 1417, 162, 165, 2441, 2451, 2844, 2845, 311, 401, 411, 462, 463, 4812, 5211, 571, 6011, 6031, 6047, 6181, 6222, 6327, 6413, 6611, 6813, 701, 702, 7041, 711, 7925, 799, 901, 904, 911, 914) |
| [SY1] | `sycebnl/references/partie2-ch3-classe1-comptes10-19.md` | fiches 12, 13 (« variation des fonds propres […] hors nouveaux apports et retraits d'apports »), 14 (reprise au 799), 16 (165 fonds affectés à un projet spécifique, repris au 7925), 17 (fonds reportés) |
| [SY9] | `sycebnl/references/partie2-ch3-classe9-comptes90-99.md` | contributions volontaires en nature, débit 900 à 904 par le crédit 910 à 914 |
| [SY21] | `sycebnl/references/partie2-ch1-cadre-comptable.md` | classe 9 · « ne répond pas à la définition […] d'un actif ou d'un passif […] ne doit pas impacter le bilan et le compte de résultat » |
| [SYF] | `sycebnl/references/partie3-ch2-fonds-affectes-reportes.md` | § 1.1, § 1.2.1 (réception D 5 / C 165, consommation D 165 / C 7925) |
| [SYP1] | `sycebnl/references/partie4-ch1-principes-generaux.md` | § 1.2, § 1.3 (SMT, fait générateur à l'encaissement), § 1.4 (comparatif), section 4 (TFT, méthode directe, deux égalités de contrôle) |
| [SYP2] | `sycebnl/references/partie4-ch2-etats-associations.md` | bilan AA à DZ, compte de résultat RA à XE, TFT ZA à ZG, tableaux de correspondance |
| [SYP3] | `sycebnl/references/partie4-ch3-etats-projets-developpement.md` | sections 1 (emplois-ressources, trois colonnes, FA à GZ) et 2 (exécution budgétaire) |
| [SYP4] | `sycebnl/references/partie4-ch4-etats-smt.md` | bilan GA à HZ, compte de résultat KA à KZC (« + Variations des stocks [N - (N-1)] », « + Variation des créances », « - Variation des dettes »), note 4 |
| [SYG] | `sycebnl/references/guide-application-cas-pratiques.md` | Application 8 (projet, 162, 462, neutralisation D 462 / C 702, aucune dotation), Application 20 (contributions en nature), Application 21 (correspondance des emplois-ressources et renvois 1 à 8), Application 22 (exécution budgétaire, règles (c) et (d)) |

Les comptes ont aussi été retrouvés dans les deux semis du dépôt
(`compte-seed-syscohada.ts`, engendré depuis [SYS], et `compte-seed.ts`), sans
quoi le rejeu n'aurait pu les mouvementer.

**Écart avec la demande, dit avant tout chiffre (CLAUDE.md § 1).** La mission
demandait des « fonds affectés (17) » au SYCEBNL. La fiche du compte 16 [SY1]
range les fonds affectés à un projet spécifique au **165**, repris au **7925**
([SYF] § 1.2.1) ; le **17** est celui des fonds REPORTÉS (donations et legs non
encore reçus d'immobilisations destinées à la vente, usufruit temporaire). Le
cas C09 suit le texte · 165 et 7925.

---

## Synthèse · les constats, classés

BLOQUANT · un montant faussé en silence, un geste juste refusé sans issue, un
dossier enfermé. Le reste est non bloquant.

### Bloquants

| # | Situation chiffrée | Ce qu'OmegaX rend | Attendu | Source | Code |
|---|---|---|---|---|---|
| **B1** | **C01** · SARL créée le 5 janvier 2025, premier exercice. | TFT 2025 · ZA, FB à FG laissés vides (« Aucun exercice antérieur dans le dossier »), puis ZB = 3 890 000, ZC = 0, ZG = ZH = **18 890 000**, contrôle `coherent: false` (écart 6 590 000). Colonne N-1 du TFT 2026 vide sur les mêmes postes. | ZA 0, FC −1 000 000, FD −3 000 000, FE +3 410 000, ZB 3 300 000, FG −6 000 000, ZC −6 000 000, ZG = ZH = **12 300 000** = BT − DT. | [AU9] ch. 5 § 1.2.1.3 (variations « exercices N–N-1 »), modèle ZA « Trésorerie actif N-1 – Trésorerie passif N-1 », contrôle ZH ; [AU1] art. 34 (le bilan d'ouverture d'une société qui naît est nul). Le moteur SYCEBNL chiffre le même premier exercice (C09, ZA 0, cohérent). | `etats-financiers-syscohada.service.ts:1356-1373` (`exigeExerciceAnterieur`, `exerciceAnterieurDisponible`) |
| **B2** | **C11** · association au SMT, dotation de 1 000 000 encaissée et matériel de 600 000 payé en caisse en 2026. | KB 2 500 000 (dotation comprise), JF 600 000 (matériel), KZ 1 400 000, **KZC « Résultat net de l'exercice » = 1 450 000**, alors que le bilan imprime HB = 1 050 000 ; le contrôle dit `concordant: true` en expliquant l'écart par des « flux hors exploitation ». | KX 3 500 000, JX 2 500 000, KZ 1 000 000, **KZC 1 050 000** = HB. | [SYP4] KB « Autres recettes sur ACTIVITÉS », KZC « RÉSULTAT NET DE L'EXERCICE » ; [SY1] fiche 13 (résultat « hors nouveaux apports et retraits d'apports »). Le moteur SMT SYSCOHADA écarte ces flux (C08, apport et matériel hors de A et B, SG = SP2). | `correspondance-smt.ts:283-295` (KB, comptes `1` à `8`), `:346-357` (JF, classe 2 comprise) ; `etats-financiers-smt.service.ts:539-560`, `:666-673` (`fluxHorsExploitation`, `concordant`) |
| **B3** | **C10** · projet, facture B de 500 000 (ligne B1) restée due au 31 décembre 2026, réglée le 20 janvier 2027. | Exécution 2027, ligne B1 · décaissement **1 000 000**, réalisation 1 000 000, crédit disponible **+200 000**, 83 %. Le règlement n'est compté nulle part · engagement en 2026, jamais décaissement en 2027. Aucun avertissement. | Décaissement **1 500 000** (1 000 000 + 500 000 de dette N-1 réglée), réalisation 1 500 000, crédit disponible **−300 000**, 125 % · le dépassement est masqué. | [SYG] Application 22, règle (c) · « mouvement débit balance N des comptes de charges […] + (solde créditeur N-1 du compte 40 sauf 409 − solde créditeur N du compte 40 sauf 409) ». | `etats-financiers-projet-budget.service.ts:233-280` (classement écriture par écriture, le règlement de N+1 n'a pas de ventilation) |
| **B4** | **C10** · projet, la seule dette fournisseur (500 000) naît d'un achat de fournitures (compte 60). | Emplois-ressources 2026 · FM 1 705 882,35, FN 341 176,47, FO 852 941,18 ; 2027 · FM 1 277 777,78, FO 1 022 222,22. La variation du 401 est RÉPARTIE AU PRORATA entre FM, FN et FO ; la part imputée n'est pas servie dans l'état (le commentaire du code annonce un champ `deduction` que la réponse ne porte pas), et aucun avertissement ne le dit. Les totaux GT, GU, GV, GX, GY sont exacts. | 2026 · FM 1 500 000, FN 400 000, FO 1 000 000 ; 2027 · FM 1 500 000, FO 800 000. | [SYG] Application 21, renvoi (4) · « Déduire la variation des dettes fournisseurs d'exploitation (+ solde […] N-1 du compte 401 **concerné** − solde […] N du compte 401 concerné) ». Aucun texte n'écrit de prorata ; subdiviser le 401 n'y change rien (la déduction est la même clé pour FM, FN et FO). | `etats-financiers-projet.service.ts:578-585`, `:796-847` ; `correspondance-projet-emplois-ressources.ts:275-302` (`DEDUCTION_DETTES_EXPLOITATION` partagée) |

Sur B1 · le défaut est DIT (postes nommés, contrôle incohérent), il n'est pas
silencieux ; il est bloquant parce que le geste est juste (le TFT du premier
exercice fait partie du jeu « indissociable » de l'art. 8) et qu'aucune issue
légitime ne s'offre au cabinet · créer un exercice antérieur vide pour une
société qui n'existait pas inventerait un exercice. Pour un dossier REPRIS (C06,
bilan d'ouverture importé), le même mécanisme laisse ZA à 0 au lieu de 200 000
et ZH à 3 000 000 au lieu de 3 200 000 ; là une issue existe (porter la balance
de clôture N-1 dans un exercice N-1 et le clôturer), ce qui en fait, pour ce
cas seul, un constat non bloquant (voir N1).

### Non bloquants

| # | Situation chiffrée | Constat | Source | Code |
|---|---|---|---|---|
| **N1** | **C06** · SARL reprise, bilan d'ouverture importé au 1er janvier 2026. | Bilan 2026 · colonne N-1 vide (`exerciceN1Disponible: false`) alors que l'à-nouveau importé EST le bilan de clôture 2025 (AM 2 100 000, BI 800 000, BS 200 000, CA 2 000 000, CH 500 000, DJ 600 000, BZ = DZ = 3 100 000). TFT 2026 · ZA 0 au lieu de 200 000, ZH 3 000 000 au lieu de 3 200 000, contrôle incohérent. Le code dit ce choix (« le report n'est un équivalent que pour une variation de COMPTES, pas pour une variation de POSTE »). | [AU1] art. 34, 1er tiret (ouverture = clôture précédente) et 4e tiret (« chacun des postes comporte l'indication du chiffre relatif au poste correspondant de l'exercice précédent ») ; [AU9] ch. 3, colonne N-1 NET. | `etats-financiers-syscohada.service.ts:1356-1373` ; `trouverExerciceN1` |
| **N2** | **C01** (2026) et **C12** (2027) · aucune réévaluation, une simple dotation au 28. | TFT · FG déclaré en réserve « Réévaluation passée HORS du module […] part “amortissements” de l'écart de réévaluation » dès que le 28 a bougé. Le montant de FG est juste ; le signalement est faux (§ 10 bis, le contrôle qui fabrique une anomalie). | [AU9] ch. 5 § 1.3, reconstitution des acquisitions ; aucune réévaluation au dossier. | `correspondance-tft-syscohada.ts:917-925` (`nonDeterminables`, comptes `28`) ; `etats-financiers-syscohada.service.ts:1387-1395` (déclenché par tout mouvement du 28) |
| **N3** | **C08** · SMT SYSCOHADA, créance client de 500 000 et dette fournisseur de 300 000 de 2026, réglées en 2027. | CR SMT 2027 · SR1 « Recettes sur ventes » 6 500 000 au lieu de 7 000 000 (le recouvrement va en SR2 « Autres recettes ») ; SD1 « Dépenses sur achats » 3 700 000 au lieu de 4 000 000 (le règlement va en SD6 « Autres dépenses »). A, B, C et G exacts. | [AU10] ch. 1 § 1 (« état des recettes et des dépenses […] dressé à partir d'une comptabilité de trésorerie » · la vente entre en recette à l'encaissement) ; ch. 3, NOTE 4, ventilation « Ventes » et « Achats marchandises ». | `correspondance-smt-syscohada.ts:872-885` (SR2, classe 4), `:949-970` (SD6) |
| **N4** | **C11** · SMT SYCEBNL, cotisations 2026 de 300 000 encaissées en 2027, dette fournisseur de 200 000 réglée en 2027. | KA « Revenus encaissés » 2 200 000 au lieu de 2 500 000 (le recouvrement va en KB) ; JA « Dépenses sur achats » 1 300 000 au lieu de 1 500 000 (le règlement va en JF). Totaux et KZC 2027 exacts. Même lecture que N3, même correction. | [SYP1] § 1.3 (« le fait générateur de l'enregistrement comptable est l'encaissement (recette) ou le décaissement (dépense) ») ; [SYP4] NOTE 4, ventilation « Cotisations ». | `correspondance-smt.ts:274-295` (KA, KB), `:300`, `:346-357` (JA, JF) |
| **N5** | **C09** · association, bénévolat (904 / 914) et locaux mis à disposition (901 / 911). | Bilan et compte de résultat justes (classe 9 hors des deux). Mais le TFT liste les 901, 904, 911, 914 parmi les `comptesNonVentiles` (comptes « encaissables qu'aucun poste ne réclame »), alors qu'ils sont sans trésorerie par nature ; et, reportés en SOLDE à la clôture, leurs soldes s'additionnent d'un exercice à l'autre (904 à 1 900 000 en 2027 pour 1 000 000 de l'année). La note 1 lit les mouvements · elle reste juste. | [SY9] (900 à 904 par le crédit des 910 à 914) ; [SY21] (ni actif ni passif, « ne doit pas impacter le bilan et le compte de résultat ») ; [AU1] art. 34 (l'à-nouveau est le bilan de clôture, qui ne les porte pas). | `etats-financiers.service.ts:778-793` (filtre des classes 5 et 3 seulement) ; `correspondance-tft.ts:756` (`COMPTES_SANS_TRESORERIE` sans 90 ni 91) ; `compte-seed.ts:1193` (classe 9 en report SOLDE) |
| **N6** | **C07** · charge de décembre 2026 découverte après la clôture de 2026. | Refus « Impossible d'enregistrer une écriture sur un exercice clôturé », sans l'issue. Le geste juste (la passer dans 2027, par le résultat de l'exercice de rectification) est accepté · il n'est simplement pas nommé, quand le refus de la période close, lui, nomme l'art. 22, 4°. | [AU5] (« les produits/charges d'exercices précédents omis […] transitent par le compte de résultat » ; « comptabilisé en AO de l'exercice de rectification »). | `comptabilite/ecriture.service.ts:653` |
| **N7** | **C10** · emplois-ressources, fonds de contrepartie de l'État logés dans une caisse à part. | FY et FV restent à zéro, le montant est porté en FZ « Autres fonds » ; c'est DIT (avertissement servi) et GY est exact. Le guide veut la ventilation par nature de fonds ; aucun modèle d'OmegaX ne désigne le compte qui porte la contrepartie de l'État. | [SYG] Application 21, FU à FZ. | `correspondance-projet-emplois-ressources.ts:396-414` |

### Questions · tranchées le 2026-10-07

Posées par le constat, tranchées ensuite (détail, textes cités et effet à
coder dans « Corrections à coder »). Aucune ne remonte à Manasse.

| # | Question | Décision | Fondement |
|---|---|---|---|
| **Q1** | TFT des associations · où va la réception d'un fonds affecté (D 52 / C 165) ? | **FM** (et sa restitution en **FO**) · un fonds affecté est un apport rangé dans les ressources propres et assimilées ; FP et FQ ne gardent que le 18. | [SYF] § 1.1 ; cadre conceptuel SYCEBNL § 4.1.1.2.1, § 4.1.1.2.2, § 4.1.1.2.4 ; [SYP2] CW dans CZ, hors DD ; [SYP1] section 4 ; définitions (« ni des dotations ni des fonds affectés ») |
| **Q2** | Emplois-ressources · quel compte de trésorerie porte la contrepartie de l'État (FV, FY) ? | **Convention d'OmegaX**, aucun texte ne la régit · le cabinet déclare le compte de trésorerie (`Compte.porteFondsContrepartieEtat`), dit à l'écran ; jamais déduit. | [SYG] Application 21 (« comptes 51, 52, 53, 55, 57 » pour les trois natures) ; [SY2] |
| **Q3** | Dossier repris · d'où vient la colonne N-1 du bilan ? | **De l'à-nouveau qui fait foi** au premier jour de N (art. 34 · l'ouverture EST la clôture N-1), comme les positions N-1 du TFT ; sans à-nouveau, ouverture nulle ; compte de résultat N-1 vide, motif et issue dits. | [AU1] art. 34 ; [SYP1] § 1.4 ; cadre conceptuel SYCEBNL § 3.3.1.2.4 ; [AU9] ch. 5 (ZA) |

### Tranché par la loi (aucune question à remonter)

- **XA du compte de résultat SYCEBNL.** Le modèle écrit « REVENUS DES ACTIVITES
  ORDINAIRES (Somme RA à RG) » alors que RH (reprises) est listé au-dessus de
  XA. Le résultat est « la différence entre les revenus […] et les charges »
  ([SY1] fiche 13) · RH entre dans XA, sans quoi XE ne serait plus le 13.
  OmegaX le fait (anomalie n° 4 de `correspondance-compte-resultat.ts`) ;
  rejoué juste (C09).
- **Renvoi (4) de l'Application 21.** Il écrit « solde DÉBITEUR » du 401 pour
  une variation de DETTES. Lu à la lettre (solde débiteur nul), FM vaudrait
  2 000 000 et le contrôle VII (« TOTAL V = TOTAL VI ») tomberait de 500 000.
  Le verbe (« Déduire la variation des dettes ») et le contrôle du tableau
  imposent le solde CRÉDITEUR · c'est ce qu'OmegaX lit (totaux justes en C10).
- **TFT du premier exercice d'une société nouvelle.** ZA se définit « Trésorerie
  actif N-1 – Trésorerie passif N-1 » ; une société qui naît n'en a aucune, et
  son bilan d'ouverture est nul ([AU1] art. 34). ZA vaut 0 et les variations se
  lisent contre zéro (B1).
- **Lettres D et E du SMT SYSCOHADA.** La maquette les invoque sans les
  attribuer ; le résultat G doit être le résultat (« recette nette ou perte
  nette ») · D = variations des stocks et des créances lues (N-1) − N, E = celle
  des dettes. Le SYCEBNL l'écrit en clair (« [N - (N-1)] » avec les signes).
  OmegaX le lit ainsi ; rejoué juste (C08, C11).
- **Report des contributions volontaires en nature.** Elles ne sont ni actif
  ni passif et « ne doi[vent] pas impacter le bilan » ([SY21]) ; l'à-nouveau
  est le bilan de clôture ([AU1] art. 34) · elles ne se reportent pas, et
  l'information qu'elles portent est celle de l'année (« l'importance du
  bénévolat dans l'activité »). Le report SOLDE du semis (N5) n'est donc pas
  une lecture du texte.
- **Recette d'une vente en comptabilité de trésorerie.** Le fait générateur est
  l'encaissement ([AU10] ch. 1 § 1, [SYP1] § 1.3) · le client qui paie une
  facture de N-1 fait une recette sur ventes (N3, N4).

### Conforme

Rejoué sans écart · bilan et compte de résultat SYSCOHADA de N et N+1, avant
et après chaque clôture, colonnes N-1 comprises (C01, C03, C05, C12 · le défaut
F4 du résultat nul après clôture ne revient pas) ; affectation avec réserve
légale exigée et refus à peine de nullité sous le dixième (C02) ; perte affectée
au 1291 et bénéfice suivant sans réserve légale sur pertes antérieures (C05) ;
contrôles du 637 (C04), de la moitié du capital (C05), de la méthode des
cotisations (C09) qui se lèvent puis se taisent quand il le faut ; écriture de
N saisie après l'ouverture de N+1, à-nouveau provisoire remplacé par le report
définitif, art. 22, 4° (report au premier jour ouvert, date de valeur gardée),
clôture refusée hors de l'ordre et sur du brouillard (C07, C12) ; bilan, résultat
et journal de trésorerie du SMT SYSCOHADA sur deux exercices (C08, hors N3) ;
bilan, compte de résultat et TFT des associations SYCEBNL sur deux exercices,
premier exercice compris (C09, hors N5) ; flux d'investissement d'une cession
HAO et d'une acquisition (C12).

---

## Corrections à coder

Rien n'est encore codé · l'étape 2 (fusion de `origin/main`, code, tests, rejeu
à zéro écart, bloc du § 3) attend le signal. Les trois questions sont tranchées
d'abord, parce que trois corrections en dépendent · Q1 change l'attendu de C09,
Q2 celui de C10, Q3 porte B1 et N1. **Aucune question ne remonte à Manasse** ·
Q1 et Q3 se tranchent par le texte, Q2 n'est régie par aucun texte et devient
une convention d'OmegaX, déclarée et dite à l'écran.

Ordre proposé pour l'étape 2, du plus isolé au plus partagé · N6, N2, Q1, Q3
(B1 et N1), B2, N5, N3 et N4, Q2 (N7), puis B3 et B4, qui partagent la lecture
des dettes fournisseurs ouvertes.

### Les trois questions, tranchées

#### Q1 · Le 165 au TFT des associations · FM et FO, jamais FP ni FQ

Lu, le 2026-10-07 :

- [SYF] Partie 3 ch. 2 § 1.1 · « Les **Fonds affectés** sont constitués par
  des apports que l'EBNL a l'obligation d'utiliser d'une façon prescrite à un
  projet ou des biens spécifiques », dont « des fonds affectés aux exercices
  futurs par des tiers financeurs pour un projet bien défini non consommés en
  fin d'exercice (**compte 165**) ».
- Cadre conceptuel SYCEBNL (`partie1-ch2-cadre-conceptuel.md`) § 4.1.1.2.1 ·
  « Un passif est composé des ressources propres et assimilées et du passif
  externe (dette) » ; § 4.1.1.2.2 · le passif externe est « une obligation
  actuelle de l'entité […] qu'elle ne peut régler que par une sortie de
  ressources économiques » ; § 4.1.1.2.4 · « Les fonds propres correspondent
  aux ressources formées : des apports ; […] », et y sont incluses « les fonds
  affectés aux investissements ».
- [SYP2] bilan des associations · CW « Fonds affectés et provenant de dons et
  legs d'immobilisations » est totalisé en CY puis en CZ « TOTAL RESSOURCES
  PROPRES ET ASSIMILEES », hors de DD « TOTAL DETTES FINANCIERES ET
  RESSOURCES ASSIMILEES ».
- [SYP1] section 4 · le financement se compose « des flux de trésorerie
  provenant des capitaux propres, et des flux de trésorerie provenant des
  capitaux étrangers » ; Acte uniforme SYCEBNL (`acte-uniforme-articles-1-28.md`)
  · « les flux de trésorerie provenant des fonds propres, les flux de
  trésorerie provenant des fonds extérieurs ». Le modèle titre ZD « fonds
  propres » (FM à FO) et ZE « fonds étrangers » (FP, FQ).
- Définitions SYCEBNL (`partie1-ch1-definitions.md`) · « Les subventions
  d'exploitation reçues ne sont ni des dotations ni des fonds affectés » · FB
  est écarté.

**Décision.** Un fonds affecté est un APPORT rangé dans les ressources propres
et assimilées, jamais dans le passif externe · sa réception (crédit du 16 par
la trésorerie) est un encaissement de fonds propres, **FM** « Encaissement des
dotations et autres fonds propres » ; sa restitution au financeur (débit du 16
par la trésorerie, que la fiche ne décrit pas) est un **FO** « Décaissement des
dotations et autres fonds propres ». FP et FQ ne gardent que le 18 (emprunts et
dettes assimilées). ZF ne bouge pas ; ZD et ZE changent.

**Effet à coder** · `src/modules/etats-financiers/correspondance-tft.ts`,
`POSTES_FONDS_PROPRES` et `POSTES_FONDS_ETRANGERS` :

- FM · `comptesFlux: ['10', '16']`, exclusions `['106', '1049']` et
  contrepartie 45 inchangées.
- FO · `comptesFlux: ['10', '16']`, exclusions `['106', '1049', '1679']`, et
  le `creditsARetrancher` du 792 repris de FQ tel quel (les reprises au 7923 et
  au 7925 ne sont pas des décaissements, fiche du compte 79).
- FP · `comptesFlux: ['18']`, exclusions `['186']` ; FQ · `comptesFlux:
  ['18']`, exclusions `['186']`, sans `creditsARetrancher`.
- En-tête · l'anomalie n° 11 devient « tranchée », avec les sources ci-dessus ;
  le commentaire de FI sur le legs conservé (le 167 gonfle FI ET le poste de
  financement du même montant) dit désormais FI et FM · la limite reste
  entière, rien de plus n'est corrigé.
- Tests · le spec de la table gèle le 16 en FM et FO et son absence de FP et
  FQ. Rejeu C09 2026 · **FM 7 000 000** (dotation 5 000 000 et fonds affectés
  2 000 000), **FP 0**, **ZD 11 000 000**, **ZE 0**, ZF et ZG inchangés.

#### Q2 · La trésorerie qui porte la contrepartie de l'État · convention d'OmegaX, déclarée

Lu · [SYG] Application 21 · FU « Balance solde débiteur N-1 des fonds
bailleurs : comptes 51, 52, 53, 55, 57 », FV « […] des fonds de contrepartie
État : comptes 51, 52, 53, 55, 57 », FW « […] des autres fonds : comptes 51,
52, 53, 55, 57 », et FX, FY, FZ au solde N ; [SY2] plan des comptes (le 52 se
subdivise par lieu et par monnaie, 5211 à 526, le 57 par monnaie, 571 et 572,
jamais par source de financement) ; Partie 3 ch. 3 (« par le débit d'un compte
de trésorerie (classe 5) »). Aucun texte ne dit quel compte porte quel fonds.

**Décision.** Pur choix de conception · **convention d'OmegaX**, déclarée et
dite. Le cabinet DÉCLARE sur un compte de trésorerie de détail (51, 52, 53, 55,
57) d'un dossier « projets de développement » qu'il porte les fonds de
contrepartie de l'État. Compte déclaré · FV et FY ; compte rattaché à un
bailleur (`Compte.bailleurId`, existant) · FU et FX ; le reste · FW et FZ.
Jamais déduit (ni de l'intitulé, ni d'un mouvement du 163 ou du 463), jamais
réparti au jugé.

**Effet à coder** :

- `prisma/schema.prisma` · `Compte.porteFondsContrepartieEtat Boolean
  @default(false)`, migration écrite à la main puis `migrate diff` (§ 6). Le
  défaut faux est le comportement d'aujourd'hui, avertissement compris.
- `src/modules/comptes/compte.service.ts` (`modifier`) et son DTO · refus
  nommés en 400 · compte hors 51, 52, 53, 55, 57 ou de type TOTAL ; dossier
  autre que SYCEBNL au jeu « projets de développement » (le champ refusé
  ailleurs, comme `refuserBailleurHorsSycebnl`) ; compte à la fois rattaché à
  un bailleur et déclaré État (les deux s'excluent). Route de structure
  existante, réservée à l'administrateur, au journal d'audit (`Compte` est
  audité).
- `src/modules/etats-financiers/etats-financiers-projet.service.ts`, fonds
  disponibles (l. 882 à 889) · `fonds('FV', (l) => etat.has(l.compteId),
  'OUVERTURE')`, `fonds('FY', …, 'CLOTURE')`, FW et FZ hors bailleur ET hors
  État. L'avertissement de la l. 952 ne parle plus que si FC (163, 463) n'est
  pas nul dans la colonne et qu'aucun compte n'est déclaré.
  `COMPTES_TRESORERIE_PROJET` (`correspondance-projet-emplois-ressources.ts`,
  l. 396 à 414) et son commentaire disent la convention.
- Écran · Plan comptable, fiche d'un compte de trésorerie d'un dossier projets ·
  case « Fonds de contrepartie de l'État » sous `estAdmin` ; état
  emplois-ressources · bulle `Aide` sur FV et FY (« Désignation déclarée par le
  cabinet sur le compte · le guide, Application 21, ne nomme que les comptes
  51, 52, 53, 55, 57 »).
- Rejeu C10 · déclarer le 57100000 ; attendu 2026 **FY 1 000 000**, FZ 0 ;
  2027 **FV 1 000 000**, **FY 1 000 000**, FW = FZ = 0 ; GW, GY inchangés.

#### Q3 · La colonne N-1 d'un dossier repris · lue sur l'à-nouveau qui fait foi

Lu · [AU1] art. 34 · « le bilan d'ouverture d'un exercice doit correspondre au
bilan de clôture de l'exercice précédent » et « chacun des postes des états
financiers comporte l'indication du chiffre relatif au poste correspondant de
l'exercice précédent » ; [SYP1] § 1.4 · « Pour chaque poste et rubrique, les
chiffres correspondants de l'exercice précédent doivent être mentionnés » ;
cadre conceptuel SYCEBNL § 3.3.1.2.4 (même correspondance) ; [AU9] ch. 5, ZA
« Trésorerie actif N-1 – Trésorerie passif N-1 ».

**Décision.** Le texte tranche · le comparatif est dû, et le bilan de clôture
N-1 EST, par l'art. 34, le bilan d'ouverture de N. Sans exercice N-1 dans le
dossier, la colonne N-1 du BILAN et les positions N-1 du TFT (ZA, variations
FB à FE, reconstitution des acquisitions) se lisent sur l'à-nouveau qui fait
foi au premier jour de N (bilan d'ouverture importé, ou report validé · jamais
l'à-nouveau provisoire, qui n'existe que derrière un N-1 tenu dans OmegaX).
Sans à-nouveau, l'ouverture est nulle · c'est la société qui naît (B1). Le
COMPTE DE RÉSULTAT N-1 ne se tire pas d'un bilan · sa colonne reste vide, avec
le motif et l'issue (ouvrir l'exercice précédent, y importer sa balance de
clôture, le clôturer). Ce n'est pas un silence du texte, c'est une donnée
absente du dossier.

**Effet à coder** · voir B1 et N1, une seule correction.

### Bloquants

#### B1 et N1 · l'ouverture du premier exercice tient lieu de clôture N-1

- `src/modules/etats-financiers/etats-financiers.communs.ts` · fonction
  partagée `lignesALOuverture(lignes)`, déplacée de
  `EtatsFinanciersSmtService.aLOuverture` sans changer son corps (solde =
  report, mouvements nuls), et un résolveur du comparatif qui rend, quand
  `trouverExerciceN1` rend `null`, les lignes de N ramenées à l'ouverture et
  leur provenance (`EXERCICE_N1`, `BILAN_D_OUVERTURE`, `OUVERTURE_NULLE`).
- `src/modules/etats-financiers-syscohada/etats-financiers-syscohada.service.ts` ·
  `bilan` (l. 796 à 856) · colonne N-1 sur ces lignes, `exerciceN1Disponible`
  gardé faux et la provenance servie, mention en tête (« Colonne N-1 · bilan
  d'ouverture du dossier, AUDCIF art. 34 ») ; `compteDeResultat` · colonne N-1
  vide, motif et issue servis. `tableauFluxTresorerie` et
  `resoudreFluxPourExercice` (l. 1324 à 1373, 1420 à 1442) · `lignesAnterieur`
  = lignes à l'ouverture quand l'exercice N-1 manque ; le refus de
  `exigeExerciceAnterieur` ne vise plus que les termes qui lisent le COMPTE DE
  RÉSULTAT N-1 (aucun dans le modèle, la garde reste) ; la colonne N-1 du TFT
  de N+1 se calcule de même sur l'ouverture de N quand N-2 manque.
- Même lecture pour les bilans SYCEBNL · `etats-financiers.service.ts`
  (`bilan`, l. 272), `etats-financiers-projet.service.ts` (l. 159 et 266),
  `etats-financiers-smt.service.ts` (l. 315). Le TFT des associations lit déjà
  le report (C09 juste).
- Source · [AU1] art. 34, premier et quatrième tirets ; [AU9] ch. 5 (ZA et
  variations « N–N-1 ») ; [SYP1] § 1.4.
- Tests · spec du service, doublure qui honore le `where` · premier exercice
  sans à-nouveau, ZA 0 et ZH = BT − DT, contrôle cohérent ; dossier repris,
  colonne N-1 égale à l'à-nouveau importé. Rejeu C01 · ZB 3 300 000, ZC
  −6 000 000, **ZG = ZH 12 300 000**, colonne N-1 du TFT 2026 chiffrée ; C06 ·
  bilan N-1 (AM 2 100 000, BI 800 000, BS 200 000, CA 2 000 000, CH 500 000,
  DJ 600 000, BZ = DZ 3 100 000), **ZA 200 000**, **ZH 3 200 000**, compte de
  résultat N-1 vide avec son motif.
- Limite dite · un à-nouveau que `chargerLignes` ne lit pas (laissé au
  brouillard) n'entre pas, comme dans toutes les autres colonnes.

#### B2 · SMT SYCEBNL · apports et immobilisations hors de KB et JF

- `src/modules/etats-financiers/correspondance-smt.ts` · KB (l. 283 à 295) et
  JF (l. 346 à 357) perdent les classes 1 et 2 et le 481
  (`DETTES_HORS_EXPLOITATION`) ; un `CONTREPARTIES_HORS_RESULTAT_SMT`
  (financement · classe 1 ; investissement · classe 2 et dettes hors
  exploitation) sur le modèle de `CONTREPARTIES_HORS_RESULTAT_SMT_SYSCOHADA`.
- `src/modules/etats-financiers/etats-financiers-smt.service.ts`,
  `compteDeResultat` (l. 640 à 675) · `ecart = KZC − HB`, `concordant: |KZC −
  HB| < 0.01` ; `fluxHorsExploitation` (l. 539 à 560) reste servi, à part,
  comme ce qui sépare KZ de la variation de la caisse, jamais dans le contrôle.
  La NOTE 4 garde tous les flux (colonne « Matériel Mobilier et autres »).
- Source · [SYP4] (KB « Autres recettes sur activités », JF « Autres dépenses
  sur activités », JG « DOTATIONS AUX AMORTISSEMENTS », KZC « RESULTAT NET DE
  L'EXERCICE ») ; [SY1] fiche 13 (« hors nouveaux apports et retraits
  d'apports ») ; [AU10] ch. 1 § 1, déjà codé au SMT SYSCOHADA. Compter
  l'achat du matériel en JF ET sa dotation en JG le passe deux fois en charge.
- Tests · rejeu C11 2026 · KB 1 500 000, JF 0, KX 3 500 000, JX 2 500 000, KZ
  1 000 000, **KZC 1 050 000 = HB** ; spec qui refuse un compte de classe 1 ou
  2 dans KB ou JF et un contrôle qui retranche les flux hors exploitation.

#### B3 · Exécution budgétaire · la dette N-1 réglée en N est un décaissement de N

- `src/modules/etats-financiers/etats-financiers-projet-budget.service.ts`,
  `executionBudgetaire` (l. 175 à 405) · après le parcours des écritures de N,
  un second parcours par lots (`lireParLots`, borné) des écritures de N-1
  ventilées sur le plan et ENGAGÉES à la clôture de N-1 (le critère
  d'aujourd'hui · aucune trésorerie, ligne 40 sauf 409 ouverte à `dateFin` de
  N-1). Chacune est suivie en N par sa ligne d'à-nouveau (appariement de
  `paires-a-cheval.ts`, celui de `relierAuxANouveaux`) · soldée à la clôture
  de N, elle va en `decaisseParSection` de N ; encore ouverte, en
  `engageParSection` de N (règle (d), « solde créditeur balance N des comptes
  fournisseurs ») ; appariement impossible ou ambigu, montant NOMMÉ en
  avertissement, jamais deviné. Même règle au 481 (premier tiret de (c)) et
  au 409 (troisième terme) quand le plan les ventile.
- Source · [SYG] Application 22, règle (c) · « mouvement débit balance N des
  comptes de charges (comptes 6 et 8) + (solde créditeur N-1 du compte 40
  sauf 409 − solde créditeur N du compte 40 sauf 409) + (solde débiteur
  balance N du compte 409 − solde débiteur balance N-1 du compte 409) », et
  règle (d).
- Tests · rejeu C10 2027, ligne B1 · **décaissement 1 500 000**, réalisation
  1 500 000, **crédit disponible −300 000**, 125 % ; spec · facture de N-1
  encore due à la clôture de N, engagement de N.

#### B4 · Emplois-ressources · la dette « concernée », jamais un prorata

- `src/modules/etats-financiers/etats-financiers-projet.service.ts`,
  `calculerEmplois` (l. 792 à 847) · `DEDUCTION_DETTES_EXPLOITATION` cesse
  d'être une clé partagée au prorata du brut. Chaque poste (FM 60 hors 603, FN
  61, FO 62 et 63) reçoit la variation des dettes NÉES DE SES CHARGES · dette
  à une date = lignes 40 sauf 409 ouvertes à cette date (même lecture que B3,
  `lignesOuvertesParmi`, à-nouveaux appariés), chacune rattachée au poste des
  lignes de charge de SON écriture. Une écriture qui mêle plusieurs postes
  partage sa dette au prorata de ses propres lignes (composition de la
  facture, convention dite) ; une dette sans écriture de charge lisible
  (à-nouveau non apparié, dette contre un compte hors des trois postes) est la
  seule part encore répartie au prorata du brut, et elle est NOMMÉE avec son
  montant. Même règle au renvoi (2), 481 « concerné », pour FE à FL.
  `deduction` est servi sur chaque ligne (annoncé l. 578 à 585, absent de la
  réponse).
- `src/modules/etats-financiers/correspondance-projet-emplois-ressources.ts`
  (l. 275 à 302) · la déduction devient « par nature de la dette », commentaire
  réécrit.
- Source · [SYG] Application 21, renvoi (4) (« solde […] N-1 du compte 401
  concerné − solde […] N du compte 401 concerné ») et renvoi (2).
- Tests · rejeu C10 · 2026 **FM 1 500 000, FN 400 000, FO 1 000 000** ; 2027
  **FM 1 500 000, FO 800 000** ; colonnes cumulées (FM 3 000 000, FO
  1 800 000) ; totaux GT à GY inchangés.

### Non bloquants

#### N2 · FG · la réserve « réévaluation hors module » se lève sur le 106 et le 154

- `src/modules/etats-financiers-syscohada/correspondance-tft-syscohada.ts`
  (l. 917 à 925) · l'entrée `{ comptes: ['28'], … }` devient `{ comptes:
  ['106', '154'], sens: 'CREDIT', motif inchangé }`. Une réévaluation passée à
  la main CRÉDITE le 1061 ou le 154 (Titre VIII ch. 28 § 4.2.4.1, cité par le
  motif) ; une dotation aux amortissements ne les touche jamais.
- `etats-financiers-syscohada.service.ts` (l. 1387 à 1395) · le déclenchement
  lit le seul sens déclaré (`sens` facultatif sur `nonDeterminables`, défaut ·
  les deux) ; la neutralisation par liaison du lot 14 reste.
- Source · [AU9] ch. 5 § 1.3 ; AUDCIF Titre VIII ch. 28 § 4.2.4.1 ; CLAUDE.md
  § 10 bis (le contrôle qui fabrique une anomalie).
- Tests · rejeu C01 2026 et C12 2027 · aucune réserve sur FG ; spec · un crédit
  du 1061 hors module lève la réserve, une dotation au 28 non.

#### N3 et N4 · SMT · le règlement prend la ligne de la pièce qu'il règle

- Lu · [AU10] ch. 1 § 1 (« état des recettes et des dépenses […] dressé à
  partir d'une comptabilité de trésorerie ») ; [SYP1] § 1.3 (« le fait
  générateur de l'enregistrement comptable est l'encaissement (recette) ou le
  décaissement (dépense) ») et section 4 (« Encaissements au cours de
  l'exercice N = Revenus (N) + Créances (N – 1) – Créances (N) », et l'exemple
  des cotisations) ; fiche du compte 41 des deux plans (« les clients
  d'exploitation sont des tiers auxquels l'entité vend les biens ou services,
  objet de son activité », et au SYCEBNL les cotisations des adhérents) ;
  fiche du compte 40 (« achats de fournitures de toutes natures et de
  services »).
- CRÉANCES · le 41 ne naît que de ventes et de cotisations · son
  encaissement entre en **SR1** (`correspondance-smt-syscohada.ts`, l. 863) ou
  en **KA** (`correspondance-smt.ts`, l. 274), sauf 414 (cessions, SYSCOHADA),
  4186 (intérêts courus) et 4194 (consignations), qui restent en SR2 ou KB.
- DETTES · le 40 porte achats, transports, loyers et services · son numéro ne
  dit pas la ligne. Le règlement prend la ligne de la CHARGE de la facture
  qu'il solde, lue par le lettrage (la ligne d'à-nouveau appariée à sa facture
  de N-1, `paires-a-cheval.ts`), au prorata des lignes de cette facture ; non
  lettré ou non apparié, il reste en SD6 ou JF et le montant est NOMMÉ
  (information). Lecture dans `cumulsTresorerie` des deux services SMT, la
  requête apportant le groupe de lettrage des lignes 40.
- Tests · rejeu C08 2027 · **SR1 7 000 000**, **SD1 4 000 000** ; C11 2027 ·
  **KA 2 500 000**, **JA 1 500 000** (le rejeu lettre les deux règlements avec
  leur à-nouveau) ; A, B, C, G, KX, JX, KZC inchangés.

#### N5 · Classe 9 SYCEBNL · ni flux, ni report

- `src/modules/etats-financiers/correspondance-tft.ts` (l. 756) ·
  `COMPTES_SANS_TRESORERIE` reçoit la classe 9 entière (90 et 91
  contributions volontaires, 92 à 99 analytique), sans trésorerie par
  construction.
- `src/modules/exercice/report-a-nouveau.ts` (le calcul unique) · au SYCEBNL,
  les 90 et 91 ne se reportent jamais, quel que soit le mode du compte ;
  `src/modules/comptes/compte-seed.ts` (l. 1193) · classe 9 semée en `AUCUN`.
  Le mode des dossiers existants n'est pas réécrit d'office (§ 6, natures de
  compte) ; le calcul l'ignore. Les à-nouveaux déjà passés ne se retouchent
  pas (art. 20) · la note des contributions lit les mouvements.
- Source · [SY21] (« ne répond pas à la définition […] d'un actif ou d'un
  passif […] ne doit pas impacter le bilan et le compte de résultat ») ; [SY9] ;
  [AU1] art. 34 (l'à-nouveau est le bilan de clôture).
- Tests · rejeu C09 · aucun 90 ni 91 dans `comptesNonVentiles` ; 2027, 904 et
  914 sans report, soldés au seul mouvement de l'année.

#### N6 · Refus sur un exercice clôturé · l'issue nommée

- `src/modules/comptabilite/ecriture.service.ts` (l. 653) · le message garde le
  refus et nomme l'issue · « Une charge ou un produit omis se passe dans
  l'exercice ouvert suivant, par son compte de résultat ; seuls un changement
  de méthode à impact fort significatif et la correction d'une erreur
  significative vont aux capitaux propres d'ouverture (fenêtre Exercices). »
  Une constante par référentiel, jamais l'une servie à l'autre (§ 6).
- Source · SYSCOHADA · [AU5] (« ni les produits/charges d'exercices précédents
  omis (qui transitent par le compte de résultat) », « Deux seules exceptions
  ») ; SYCEBNL · cadre conceptuel § 3.3.1.2.4 (« Ces corrections doivent
  transiter par le compte de résultat du nouvel exercice ») et art. 16, 4).
- Tests · spec du service · le refus porte l'issue, par référentiel ; rejeu C07
  inchangé (refus 4xx, geste juste accepté).

#### N7 · FV et FY · voir Q2

Correction entière en Q2.

---
## Situations et calculs

Conventions communes · montants en francs congolais, écritures au journal OD,
validées avant toute lecture (AUDCIF art. 22, 2° · les états ne lisent que le
livre-journal). Les charges du compte de résultat SYSCOHADA sont signées en
négatif, comme le modèle le veut ([AU9] ch. 4, « Logique de signe »). La
charge d'impôt des sociétés n'est pas l'objet ici · elle est chiffrée par
l'art. 56 (30 % du résultat avant impôt, sans retraitement) ou l'art. 57
(minimum de 1 % du chiffre d'affaires) [FIS], pour que le poste RS et le
compte 441 soient mouvementés ; la retenue sur les dividendes n'est pas
modélisée.

### C01 · SARL bénéficiaire, clôture de N (2025)

Société à responsabilité limitée, Système normal, premier exercice du
1er janvier au 31 décembre 2025.

| Date | Opération | Débit | Crédit | Montant |
|---|---|---|---|---|
| 05/01 | Apport du capital | 5211 | 1013 | 10 000 000 |
| 10/01 | Emprunt bancaire | 5211 | 162 | 5 000 000 |
| 01/07 | Matériel de bureau | 2441 | 5211 | 6 000 000 |
| 30/06 | Ventes de marchandises | 4111 | 7011 | 20 000 000 |
| 30/09 | Encaissement clients | 5211 | 4111 | 17 000 000 |
| 30/06 | Achats de marchandises | 6011 | 4011 | 12 000 000 |
| 30/09 | Règlement fournisseurs | 4011 | 5211 | 10 000 000 |
| 31/12 | Salaires, puis leur paiement | 6611 puis 422 | 422 puis 5211 | 3 000 000 |
| 30/09 | Personnel intérimaire (non viré au 667) | 6371 | 5211 | 400 000 |
| 31/12 | Intérêts de l'emprunt | 6712 | 5211 | 300 000 |
| 31/12 | Stock final de marchandises | 3111 | 6031 | 1 000 000 |
| 31/12 | Dotation (6 000 000 sur 5 ans, 6 mois) | 6813 | 2844 | 600 000 |
| 31/12 | Impôt sur le résultat (30 % de 4 700 000) | 8911 | 441 | 1 410 000 |

**Compte de résultat** ([AU9] ch. 4, [AU9-7] ch. 7) · TA = 701 = 20 000 000 ;
RA = 601 = −12 000 000 ; RB = 6031 = +1 000 000 (crédit) ; XA = TA + RA + RB =
9 000 000 ; XB = 20 000 000 ; RH = 62, 63 = −400 000 (le 637, non viré) ;
XC = XB + RA + RB + (TE à RJ) = 20 000 000 − 12 000 000 + 1 000 000 − 400 000 =
8 600 000 ; RK = 66 = −3 000 000 ; XD = 5 600 000 ; RL = 681 = −600 000 ;
XE = 5 000 000 ; RM = 67 = −300 000 ; XF = −300 000 ; XG = 4 700 000 ; XH = 0 ;
RS = 89 = −1 410 000 ; **XI = 3 290 000**.

**Bilan au 31/12/2025** · banque 10 000 000 + 5 000 000 − 6 000 000 + 17 000 000
− 10 000 000 − 3 000 000 − 400 000 − 300 000 = 12 300 000. AM brut 6 000 000,
amortissements 600 000, net 5 400 000 (= AI = AZ) ; BB 1 000 000 ; BI = BG =
3 000 000 ; BK = 4 000 000 ; BS = BT = 12 300 000 ; **BZ = 21 700 000**. CA
10 000 000 ; CJ 3 290 000 ; CP 13 290 000 ; DA = DD = 5 000 000 ; DF
18 290 000 ; DJ 2 000 000 ; DK 1 410 000 (441) ; DP 3 410 000 ; **DZ =
21 700 000**.

**TFT 2025** ([AU9] ch. 5) · société créée le 5 janvier, aucune trésorerie
avant · ZA = 0. CAFG = EBE − frais financiers − impôt = 5 600 000 − 300 000 −
1 410 000 = 3 890 000 (= résultat 3 290 000 + dotation 600 000) = FA. FC =
−(1 000 000 − 0) ; FD = −(3 000 000 − 0) ; FE = +(2 000 000 + 1 410 000 − 0) =
3 410 000 ; ZB = 3 300 000. FG = Δ immobilisations corporelles nettes
5 400 000 + dotations 600 000 = 6 000 000 décaissés · −6 000 000 = ZC. FK
10 000 000 = ZD ; FO 5 000 000 = ZE ; ZF = 15 000 000 ; ZG = 3 300 000 −
6 000 000 + 15 000 000 = 12 300 000 ; **ZH = 12 300 000 = BT − DT**.

**Contrôle à lever (C04)** · le 637 reste débiteur à la clôture ·
`PERSONNEL_EXTERIEUR_NON_VIRE` attendu ([AU7-6]).

Puis clôture de 2025 · bilan et compte de résultat relus après la clôture,
inchangés.

### C02 · Affectation du résultat 2025, décidée le 30 juin 2026

Fiche du compte 11 [AU7-1] et AUSCGIE art. 346 [CGIE] · dotation « égale à un
dixième au moins » du bénéfice diminué des pertes antérieures, tant que la
réserve n'atteint pas le cinquième du capital (2 000 000). Pertes antérieures
nulles · 10 % × 3 290 000 = **329 000**. Décision · 329 000 au 111, 1 000 000
de dividendes au 465, 1 961 000 au 121 (D 131 3 290 000).

Deux gestes rejoués · une décision à 300 000 seulement au 111 doit être
REFUSÉE (« Toute délibération prise en violation du présent alinéa est
nulle »), la décision conforme acceptée.

### C03 · Exercice 2026 (N+1), puis clôture de 2026

| Date | Opération | Débit | Crédit | Montant |
|---|---|---|---|---|
| 30/04 | Paiement de l'impôt 2025 | 441 | 5211 | 1 410 000 |
| 15/07 | Paiement des dividendes | 465 | 5211 | 1 000 000 |
| 15/02 | Encaissement des clients 2025 | 5211 | 4111 | 3 000 000 |
| 15/02 | Règlement des fournisseurs 2025 | 4011 | 5211 | 2 000 000 |
| 30/06 | Ventes, puis encaissement | 4111 puis 5211 | 7011 puis 4111 | 25 000 000 et 21 000 000 |
| 30/06 | Achats, puis règlement | 6011 puis 4011 | 4011 puis 5211 | 15 000 000 et 14 000 000 |
| 31/12 | Annulation du stock initial, stock final | 6031, 3111 | 3111, 6031 | 1 000 000, 1 500 000 |
| 31/12 | Salaires, puis leur paiement | 6611, 422 | 422, 5211 | 3 500 000 |
| 30/09 | Personnel intérimaire | 6371 | 5211 | 400 000 |
| 31/12 | **Virement du 637 au 667** (C04) | 6671 | 6371 | 400 000 |
| 31/12 | Intérêts, remboursement d'emprunt | 6712, 162 | 5211 | 250 000, 1 000 000 |
| 31/12 | Dotation | 6813 | 2844 | 1 200 000 |
| 31/12 | Impôt (30 % de 5 150 000) | 8911 | 441 | 1 545 000 |

**Compte de résultat 2026** · TA 25 000 000 ; RA −15 000 000 ; RB +500 000 ;
XA 10 500 000 ; RH 0 (637 viré) ; XC 10 500 000 ; RK −3 900 000 (66, dont 667) ;
XD 6 600 000 ; RL −1 200 000 ; XE 5 400 000 ; RM −250 000 ; XF −250 000 ;
XG 5 150 000 ; RS −1 545 000 ; **XI 3 605 000**. Colonne N-1 = C01.

**Bilan au 31/12/2026** · banque 12 300 000 − 1 410 000 − 1 000 000 + 3 000 000
− 2 000 000 + 21 000 000 − 14 000 000 − 3 500 000 − 400 000 − 250 000 −
1 000 000 = 12 740 000. AM 4 200 000 (6 000 000 − 1 800 000) ; BB 1 500 000 ;
BI 4 000 000 ; BK 5 500 000 ; BS 12 740 000 ; **BZ 22 440 000**. CA
10 000 000 ; CF 329 000 (111 · réserves indisponibles) ; CH 1 961 000 ;
CJ 3 605 000 ; CP 15 895 000 ; DA 4 000 000 ; DF 19 895 000 ; DJ 1 000 000 ;
DK 1 545 000 ; DP 2 545 000 ; **DZ 22 440 000**.

**TFT 2026** · ZA = 12 300 000. FA = 3 605 000 + 1 200 000 = 4 805 000 ;
FC = −(1 500 000 − 1 000 000) = −500 000 ; FD = −(4 000 000 − 3 000 000) =
−1 000 000 ; FE = (1 000 000 + 1 545 000) − (2 000 000 + 1 410 000) = −865 000
(les dividendes à payer, nés et payés dans l'année, ne varient pas) ;
ZB 2 440 000. FG = (4 200 000 − 5 400 000) + 1 200 000 = 0 ; ZC 0.
FN −1 000 000 = ZD ; FQ −1 000 000 = ZE ; ZF −2 000 000 ; ZG 440 000 ;
**ZH 12 740 000 = BT − DT**. Colonne N-1 = TFT 2025.

**Contrôle à taire (C04)** · le 637 est soldé · plus de
`PERSONNEL_EXTERIEUR_NON_VIRE`.

Puis clôture de 2026 · états 2026 relus après la clôture ; bilan et compte de
résultat 2027, colonne N-1 = 2026.

### C05 · SARL déficitaire en 2026, bénéficiaire en 2027

| Exercice | Opérations (toutes au comptant, banque 5211) |
|---|---|
| 2026 | capital 5 000 000 (1013) ; ventes 8 000 000 (7011) ; achats 9 000 000 (6011) ; salaires 1 500 000 (6611) ; impôt minimum 80 000 (895 / 441 · 1 % de 8 000 000, art. 57) |
| 2027 | paiement de l'impôt 2026 ; ventes 10 000 000 ; achats 7 000 000 ; salaires 1 500 000 ; impôt minimum 100 000 (base nulle après imputation du déficit de 2026, minimum 1 % de 10 000 000) |

**2026** · XA = 8 000 000 − 9 000 000 = −1 000 000 ; XB 8 000 000 ;
XC −1 000 000 ; RK −1 500 000 ; XD = XE = XG = −2 500 000 ; RS −80 000 ;
**XI −2 580 000**. Bilan · banque 2 500 000 ; CA 5 000 000 ; CJ −2 580 000 ;
CP 2 420 000 ; DK 80 000 ; BZ = DZ = 2 500 000. Capitaux propres sous la
moitié du capital (2 420 000 < 2 500 000) · `CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL`
attendu (AUSCGIE art. 371).

**Affectation de la perte (30/06/2027)** · D 1291 / C 139 2 580 000 (fiche
du compte 12 · le report débiteur reçoit la perte non compensée).

**2027** · XA = XC = 3 000 000 ; XD = XE = XG = 1 500 000 ; RS −100 000 ;
**XI 1 400 000**. Bilan · banque 2 500 000 − 80 000 + 10 000 000 − 7 000 000
− 1 500 000 = 3 920 000 ; CA 5 000 000 ; CH −2 580 000 ; CJ 1 400 000 ;
CP 3 820 000 ; DK 100 000 ; BZ = DZ = 3 920 000. Capitaux propres revenus au-
dessus de la moitié · le contrôle doit se taire.

**Affectation 2027 (30/06/2028)** · bénéfice 1 400 000 diminué des pertes
antérieures 2 580 000 · négatif, **aucune dotation obligatoire** (art. 346) ;
1 400 000 au 1291. Bilan 2028 après validation · CH −1 180 000, CJ 0,
CP 3 820 000.

### C06 · SARL reprise, bilan d'ouverture importé au 1er janvier 2026

Balance importée (route `/import/executer`, `bilanDOuverture: true`) · 1013
C 2 000 000 ; 121 C 500 000 ; 2441 D 3 000 000 ; 2844 C 900 000 ; 4111 D
800 000 ; 4011 C 600 000 ; 5211 D 200 000 (4 000 000 de part et d'autre).
Opérations 2026 · ventes au comptant 5 000 000 ; entretien 2 000 000 (6241) ;
dotation 600 000.

**Compte de résultat** · TA = XB = 5 000 000 ; RH −2 000 000 ; XC = XD =
3 000 000 ; RL −600 000 ; **XI 2 400 000**.

**Bilan 2026** · AM 1 500 000 (3 000 000 − 1 500 000) ; BI 800 000 ; BS
3 200 000 ; BZ 5 500 000 ; CA 2 000 000 ; CH 500 000 ; CJ 2 400 000 ; CP
4 900 000 ; DJ 600 000 ; DZ 5 500 000. **Colonne N-1** (l'à-nouveau importé,
qui est le bilan de clôture 2025, art. 34) · AM 2 100 000 ; BI 800 000 ; BS
200 000 ; BZ 3 100 000 ; CA 2 000 000 ; CH 500 000 ; CP 2 500 000 ; DJ
600 000 ; DZ 3 100 000.

**TFT 2026** · ZA = 200 000 (5211 à l'ouverture) ; FA = 2 400 000 + 600 000 =
3 000 000 ; FC = FD = FE = 0 (clients et fournisseurs inchangés) ; ZB
3 000 000 ; ZC = ZD = ZE = 0 ; ZG 3 000 000 ; **ZH 3 200 000 = BT − DT**.

Puis clôture · le bilan 2027 porte en N-1 le bilan 2026.

### C07 · Écriture de N après l'ouverture de N+1, période close, art. 22, 4°

SARL, 2026 · capital 3 000 000 ; ventes au comptant 4 000 000 ; entretien
1 000 000 ; validation. Ouverture de 2027 avec à-nouveaux PROVISOIRES (route
`/exercices/:id/a-nouveaux-provisoires`) ; vente de 2 000 000 en février 2027,
validée. Puis, dans 2026 encore ouvert ·

1. clôture de PÉRIODE au 30 novembre 2026 (art. 22, 3°) ;
2. facture d'entretien de décembre reçue en février, enregistrée au
   20/12/2026 · D 6241 / C 4011 500 000 ;
3. frais du 15 novembre découverts après la clôture de période · sans demande
   de report, REFUS attendu ; avec la demande, l'opération est enregistrée
   **au 1er décembre 2026, date de valeur le 15 novembre** (art. 22, 4° ·
   « enregistrée au premier jour de la période non encore clôturée, sa date
   de valeur étant mentionnée distinctement ») · D 6241 / C 5211 200 000 ;
4. clôture de 2027 demandée avant celle de 2026 · REFUS attendu (clôture
   dans l'ordre).

Clôture de 2026 · résultat 4 000 000 − 1 000 000 − 500 000 − 200 000 =
**2 300 000** ; banque 3 000 000 + 4 000 000 − 1 000 000 − 200 000 =
5 800 000 ; DJ 500 000. L'à-nouveau DÉFINITIF de 2027 remplace le provisoire ·
5211 au débit 5 800 000, 4011 au crédit 500 000 (absent du provisoire), 131
au crédit 2 300 000. Après la clôture, une charge de décembre 2026 oubliée
passe dans 2027 (par le résultat de l'exercice de rectification, [AU5]).

### C08 · SYSCOHADA, Système minimal de trésorerie, entreprise individuelle

Entreprise individuelle, caisse 5711.

| Exercice | Encaissements | Décaissements | Inventaire extra-comptable du 31/12 ([AU10] ch. 1) |
|---|---|---|---|
| 2026 | apport 2 000 000 (103) ; ventes 6 000 000 | matériel 1 200 000 (2441) ; achats 3 500 000 ; loyer 600 000 (6222) ; salaires 800 000 ; impôts 100 000 (6411) | créances 500 000 (4111 / 7011) ; dettes 300 000 (6011 / 4011) ; stock 700 000 (3111 / 6031) ; amortissement 400 000 (1 200 000 sur 3 ans, sans prorata) |
| 2027 | créance 2026 500 000 ; ventes 6 500 000 | dette 2026 300 000 ; achats 3 700 000 ; loyer 600 000 ; salaires 900 000 ; prélèvement de l'exploitant 500 000 (1048) | créances 200 000 ; dettes 400 000 ; stock 900 000 (stock initial annulé) ; amortissement 400 000 |

Le résultat 2026 (1 500 000) est viré au 103 le 31 mars 2027 (fiche du compte
13 · « dans les entités individuelles, le solde du compte 13 est viré au compte
103 »).

**Compte de résultat 2026** ([AU10] ch. 2) · A = recettes sur ventes 6 000 000 ;
B = achats 3 500 000 + loyers 600 000 + salaires 800 000 + impôts 100 000 =
5 000 000 ; C = 1 000 000 ; variations · stocks +700 000, créances +500 000,
dettes −300 000 ; F = 400 000 ; **G = 1 500 000** (contre-épreuve en
engagement · 6 500 000 − 5 000 000).

**Compte de résultat 2027** · A = 7 000 000 (6 500 000 de ventes de l'année et
500 000 de la créance 2026, recette sur VENTES en comptabilité de trésorerie) ;
B = achats 4 000 000 (dont la dette 2026) + loyers 600 000 + salaires 900 000 =
5 500 000 ; C = 1 500 000 ; stocks +200 000, créances −300 000, dettes
−100 000 ; F = 400 000 ; **G = 900 000** (contre-épreuve · ventes 6 700 000 −
achats consommés 3 900 000 − 600 000 − 900 000 − 400 000).

**Bilans** · 2026 · immobilisations 800 000, stocks 700 000, clients 500 000,
caisse 1 800 000, total 3 800 000 ; compte exploitant 2 000 000, résultat
1 500 000, fournisseurs 300 000. 2027 · 400 000, 900 000, 200 000, caisse
2 800 000, total 4 300 000 ; compte exploitant 3 000 000 (2 000 000 + 1 500 000
− 500 000), résultat 900 000, fournisseurs 400 000.

**Journal de trésorerie (NOTE 4)** · 2026 · report 0, recettes 8 000 000,
dépenses 6 200 000, solde 1 800 000 ; 2027 · report 1 800 000, recettes
7 000 000, dépenses 6 000 000, solde 2 800 000. Rendus tels quels par OmegaX.

### C09 · SYCEBNL, association · fonds affectés, subvention reprise, classe 9

| Exercice | Opérations (banque 5211 sauf mention) |
|---|---|
| 2026 | dotation non consomptible 5 000 000 (1011) ; cotisations appelées 3 000 000 (411 / 701), encaissées 2 500 000 ; dons manuels 1 000 000 (7041) ; subvention d'équipement 4 000 000 (1417) ; véhicule 4 000 000 (2451), amorti 1 000 000 (6813 / 2845) ; reprise de subvention 1 000 000 (1417 / 799) ; fonds affectés à un projet spécifique 2 000 000 (165), consommés 1 200 000 (kits au 6011, puis D 165 / C 7925) ; salaires 1 800 000 ; loyer 600 000 (6222) ; fournitures 300 000 dues (6047 / 401) ; locaux mis à disposition 500 000 (901 / 911) ; bénévolat 900 000 (904 / 914) |
| 2027 | méthode des cotisations déclarée (appel) ; affectation de l'excédent 2026 · 300 000 au 118, 1 000 000 au 121 ; cotisations appelées 3 200 000, encaissées 3 000 000 ; dons 1 500 000 ; fonds affectés consommés 800 000 ; fournisseur 2026 réglé 300 000 ; fournitures 400 000 dues ; salaires 2 000 000 ; loyer 600 000 ; dotation et reprise 1 000 000 chacune ; bénévolat 1 000 000 |

**Compte de résultat 2026** ([SYP2]) · RA 3 000 000 ; RC 1 000 000 ; RH
2 200 000 (7925 1 200 000 et 799 1 000 000) ; **XA 6 200 000** (RH compris,
voir « tranché par la loi ») ; TA 1 200 000 ; TD 300 000 ; TG 600 000 ;
TJ 1 800 000 ; TL 1 000 000 ; XB 4 900 000 ; XC 1 300 000 ; XD 0 ;
**XE 1 300 000**. La classe 9 n'y entre pas.

**Bilan 2026** · AM = AH = AZ 3 000 000 ; BD = BT 500 000 ; BW = BX 6 900 000
(5 000 000 + 2 500 000 + 1 000 000 + 4 000 000 − 4 000 000 + 2 000 000 −
1 200 000 − 1 800 000 − 600 000) ; **BZ 10 400 000**. CA 5 000 000 ;
CH 1 300 000 ; CI 3 000 000 ; CK 9 300 000 ; CW = CY 800 000 (reste du 165) ;
CZ = DE 10 100 000 ; DH = DV 300 000 ; **DZ 10 400 000**.

**TFT 2026** ([SYP1] section 4, méthode directe) · ZA 0 ; FA = 3 000 000 + 0 −
500 000 = 2 500 000 ; FC 1 000 000 ; FF = −(1 200 000 + 300 000 + 600 000 −
300 000) = −1 800 000 ; FG −1 800 000 ; ZB −100 000 ; FI −4 000 000 = ZC ;
FM 5 000 000 ; FN 4 000 000 ; ZD 9 000 000 ; FP 2 000 000 (rangement d'OmegaX
pour le 165, question Q1) = ZE ; ZF 6 900 000 ; **ZG 6 900 000 = BX − DX**.

**2027** · RA 3 200 000 ; RC 1 500 000 ; RH 1 800 000 ; XA 6 500 000 ; TA
800 000 ; TD 400 000 ; TG 600 000 ; TJ 2 000 000 ; TL 1 000 000 ; XB
4 800 000 ; **XE 1 700 000**. Bilan · AM 2 000 000 ; BD 700 000 ; BW 7 700 000 ;
BZ 10 400 000 ; CA 5 000 000 ; CF 300 000 ; CG 1 000 000 ; CH 1 700 000 ;
CI 2 000 000 ; CK = CZ 10 000 000 ; CW 0 ; DH 400 000 ; DZ 10 400 000. TFT ·
ZA 6 900 000 ; FA 3 000 000 ; FC 1 500 000 ; FF −1 700 000 ; FG −2 000 000 ;
ZB 800 000 ; ZF 800 000 ; **ZG 7 700 000**.

**Contrôles** · `METHODE_COTISATIONS_NON_PRECISEE` doit se lever en 2026 (le
701 a bougé, aucune méthode déclarée · cadre conceptuel § 5.4.2.1) et se taire
en 2027 (méthode déclarée) ; aucun compte de classe 9 parmi les comptes non
rattachés du bilan.

### C10 · SYCEBNL, projet de développement · emplois-ressources et budget

Un bailleur (« BM ») porte les comptes 162, 462 et 5211 (`Compte.bailleurId`) ;
la contrepartie de l'État est logée en caisse (571). Nomenclature budgétaire ·
plan analytique à budgets, sections B1 Fournitures, B2 Transports, B3 Services,
B4 Personnel. Aucune dotation aux amortissements (Application 8, « Aucune
dotation aux amortissements n'est constatée »).

| Exercice | Opérations |
|---|---|
| 2026 | fonds d'investissement 3 000 000 (5211 / 162) ; fonds d'administration 10 000 000 (5211 / 462) ; contrepartie de l'État 1 000 000 (571 / 463) ; véhicule 3 000 000 (2451 / 4812, réglé) ; facture A 1 500 000 (6011 / 401, B1, réglée et LETTRÉE) ; facture B 500 000 (6011 / 401, B1, **due au 31/12**) ; transports 400 000 (6181, B2) ; prestataires 1 000 000 (6327, B3) ; salaires 3 000 000 (6611, B4) ; taxe sur salaires 100 000 (6413, B4) ; neutralisation D 462 / C 702 6 500 000. Budgets · B1 2 500 000, B2 500 000, B3 1 200 000, B4 3 200 000 |
| 2027 | fonds d'administration 6 000 000 ; **facture B réglée le 20/01** et lettrée avec sa ligne d'à-nouveau ; fournitures au comptant 1 000 000 (B1) ; prestataires 800 000 (B3) ; salaires 3 000 000 (B4) ; neutralisation 4 800 000. Budgets · B1 1 200 000, B3 1 000 000, B4 3 000 000 |

**Emplois-ressources 2026** (Application 21) · FA = crédits 162 + 462 =
13 000 000 ; FC = 463 = 1 000 000 ; GR 14 000 000 ; FJ = 3 000 000 (Δ 481
nulle) ; GS 3 000 000 ; FM = 2 000 000 + (0 − 500 000) = **1 500 000** (renvoi
4, la dette au 401 « concerné » naît d'un achat du 60) ; FN 400 000 ; FO
1 000 000 ; FP 100 000 ; FR 3 000 000 ; GT 6 000 000 ; GU 9 000 000 ; GV
5 000 000 ; GW 0 ; GX 5 000 000 ; FX 4 000 000 (5211) ; FY ou FZ 1 000 000
(571) ; GY 5 000 000 ; GZ · V = VI.

**Emplois-ressources 2027** · colonne de l'exercice · FA 6 000 000 ; GR
6 000 000 ; FM = 1 000 000 + (500 000 − 0) = **1 500 000** ; FO **800 000** ;
FR 3 000 000 ; GT = GU 5 300 000 ; GV 700 000 ; GW 5 000 000 ; GX = GY
5 700 000. Cumul début = cumul fin 2026. Cumul fin · FA 19 000 000 ; FC
1 000 000 ; GR 20 000 000 ; FJ 3 000 000 ; FM 3 000 000 ; FN 400 000 ; FO
1 800 000 ; FP 100 000 ; FR 6 000 000 ; GT 11 300 000 ; GU 14 300 000 ; GV
5 700 000 ; GW 0 ; GX = GY 5 700 000.

**Exécution budgétaire** (Application 22) · 2026 · B1 · décaissement 2 000 000
+ (0 − 500 000) = 1 500 000, engagement (solde créditeur du 40) 500 000,
réalisation 2 000 000, disponible 500 000 ; B2 400 000, disponible 100 000 ;
B3 1 000 000, disponible 200 000 ; B4 3 100 000, disponible 100 000. 2027 ·
B1 · décaissement 1 000 000 + (500 000 − 0) = **1 500 000**, engagement 0,
réalisation 1 500 000, disponible **−300 000** (125 %) ; B3 800 000,
disponible 200 000 ; B4 3 000 000, disponible 0.

### C11 · SYCEBNL, Système minimal de trésorerie · petite association

Caisse 571.

| Exercice | Encaissements | Décaissements | Inventaire du 31/12 |
|---|---|---|---|
| 2026 | dotation 1 000 000 (1011) ; cotisations 2 000 000 (701) ; subvention d'exploitation 1 500 000 (711) | matériel 600 000 (2441) ; achats de biens liés à l'activité 1 200 000 (6011) ; loyer 400 000 (6222) ; salaires 900 000 | cotisations dues 300 000 (411 / 701) ; dettes 200 000 (6011 / 401) ; stock 150 000 (311 / 6031) ; amortissement 200 000 |
| 2027 | cotisations 2026 300 000 ; cotisations 2 200 000 ; subvention 1 500 000 | dette 2026 200 000 ; achats 1 300 000 ; loyer 400 000 ; salaires 1 000 000 | cotisations dues 100 000 ; stock 100 000 (stock initial annulé) ; amortissement 200 000 |

L'excédent 2026 (1 050 000) est affecté au 121 le 31 mars 2027.

**Compte de résultat 2026** ([SYP4]) · KA (revenus encaissés) 2 000 000 ; KB
1 500 000 (la subvention · la dotation n'est ni un revenu ni une recette « sur
activités », fiche 13 · « hors nouveaux apports ») ; **KX 3 500 000** ; JA
1 200 000 ; JB 400 000 ; JC 900 000 ; **JX 2 500 000** (le matériel n'est pas
une dépense « sur activités ») ; **KZ 1 000 000** ; VA +150 000 ; VB +300 000 ;
VC −200 000 ; JG 200 000 ; **KZC 1 050 000** (contre-épreuve en engagement ·
revenus 3 800 000 − charges 2 750 000).

**Bilan 2026** · GA 400 000 ; GB 150 000 ; GC 300 000 ; GD 1 400 000 ; GZ
2 250 000 ; HA 1 000 000 ; **HB 1 050 000** ; HD 200 000 ; HZ 2 250 000.

**2027** · KA 2 500 000 (dont 300 000 de cotisations 2026, recette en
comptabilité de trésorerie) ; KX 4 000 000 ; JA 1 500 000 (dont la dette 2026) ;
JB 400 000 ; JC 1 000 000 ; JX 2 900 000 ; KZ 1 100 000 ; VA −50 000 ; VB
−200 000 ; VC +200 000 ; JG 200 000 ; **KZC 850 000**. Bilan · GA 200 000 ;
GB 100 000 ; GC 100 000 ; GD 2 500 000 ; GZ 2 900 000 ; HA 1 000 000 ; HB
850 000 ; HC 1 050 000 ; HZ 2 900 000.

### C12 · SARL · acquisition et cession HAO en N+1, flux d'investissement

2026 · capital 8 000 000 ; matériel 5 000 000 au 2 janvier (5 ans) ; ventes
6 000 000 ; entretien 3 000 000 ; dotation 1 000 000 ; résultat 2 000 000,
affecté en 2027 (200 000 au 111, dixième de l'art. 346 ; 1 800 000 au 121).
2027 · véhicule 3 000 000 au 2 janvier (5 ans, dotation 600 000) ; dotation
du matériel jusqu'à la cession 500 000 ; sortie du matériel le 30 juin
(D 2844 1 500 000, D 812 3 500 000 / C 2441 5 000 000) ; prix de cession
4 000 000 au 822 ; ventes 7 000 000 ; entretien 3 500 000. Avant la
validation, une clôture demandée avec du brouillard doit être REFUSÉE.

**Compte de résultat 2027** · TA = XB 7 000 000 ; RH −3 500 000 ; XC = XD
3 500 000 ; RL −1 100 000 ; XE = XG 2 400 000 ; TN 4 000 000 ; RO −3 500 000 ;
XH 500 000 ; **XI 2 900 000**.

**TFT 2027** · ZA 6 000 000 ; FA = CAFG = EBE 3 500 000 (les cessions HAO
« n'entrent pas » dans la CAFG, [AU9] ch. 5 § 1.2.1.1) ; ZB 3 500 000 ; FG =
Δ immobilisations nettes (2 400 000 − 4 000 000) + dotations 1 100 000 + VNC
cédée 3 500 000 = 3 000 000 · −3 000 000 ; FI = prix de cession 4 000 000 ;
ZC 1 000 000 ; ZF 0 ; ZG 4 500 000 ; **ZH 10 500 000 = BT − DT**.

---

## Tableau attendu / OmegaX

Recopié du rejeu (`rejeu-cloture.json`). « vide » · OmegaX ne rend pas le
poste. Les lectures après clôture et les colonnes N-1 sont résumées quand elles
ne portent aucun écart.

### Rejeu C01 à C04 (une société)


**Bilan 2025 avant clôture** · 20 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AI | 5 400 000 | 5 400 000 | 0 |
| AM | 5 400 000 | 5 400 000 | 0 |
| AZ | 5 400 000 | 5 400 000 | 0 |
| BB | 1 000 000 | 1 000 000 | 0 |
| BG | 3 000 000 | 3 000 000 | 0 |
| BI | 3 000 000 | 3 000 000 | 0 |
| BK | 4 000 000 | 4 000 000 | 0 |
| BS | 12 300 000 | 12 300 000 | 0 |
| BT | 12 300 000 | 12 300 000 | 0 |
| BZ | 21 700 000 | 21 700 000 | 0 |
| CA | 10 000 000 | 10 000 000 | 0 |
| CJ | 3 290 000 | 3 290 000 | 0 |
| CP | 13 290 000 | 13 290 000 | 0 |
| DA | 5 000 000 | 5 000 000 | 0 |
| DD | 5 000 000 | 5 000 000 | 0 |
| DF | 18 290 000 | 18 290 000 | 0 |
| DJ | 2 000 000 | 2 000 000 | 0 |
| DK | 1 410 000 | 1 410 000 | 0 |
| DP | 3 410 000 | 3 410 000 | 0 |
| DZ | 21 700 000 | 21 700 000 | 0 |


**CR 2025 avant clôture** · 17 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 20 000 000 | 20 000 000 | 0 |
| RA | -12 000 000 | -12 000 000 | 0 |
| RB | 1 000 000 | 1 000 000 | 0 |
| XA | 9 000 000 | 9 000 000 | 0 |
| XB | 20 000 000 | 20 000 000 | 0 |
| RH | -400 000 | -400 000 | 0 |
| XC | 8 600 000 | 8 600 000 | 0 |
| RK | -3 000 000 | -3 000 000 | 0 |
| XD | 5 600 000 | 5 600 000 | 0 |
| RL | -600 000 | -600 000 | 0 |
| XE | 5 000 000 | 5 000 000 | 0 |
| RM | -300 000 | -300 000 | 0 |
| XF | -300 000 | -300 000 | 0 |
| XG | 4 700 000 | 4 700 000 | 0 |
| XH | 0 | 0 | 0 |
| RS | -1 410 000 | -1 410 000 | 0 |
| XI | 3 290 000 | 3 290 000 | 0 |


**TFT 2025** · 25 comparaisons, 8 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 0 | 0 | 0 |
| FA | 3 890 000 | 3 890 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | -1 000 000 | 0 | 1 000 000 |
| FD | -3 000 000 | 0 | 3 000 000 |
| FE | 3 410 000 | 0 | -3 410 000 |
| ZB | 3 300 000 | 3 890 000 | 590 000 |
| FF | 0 | 0 | 0 |
| FG | -6 000 000 | 0 | 6 000 000 |
| FH | 0 | 0 | 0 |
| FI | 0 | 0 | 0 |
| FJ | 0 | 0 | 0 |
| ZC | -6 000 000 | 0 | 6 000 000 |
| FK | 10 000 000 | 10 000 000 | 0 |
| FL | 0 | 0 | 0 |
| FM | 0 | 0 | 0 |
| FN | 0 | 0 | 0 |
| ZD | 10 000 000 | 10 000 000 | 0 |
| FO | 5 000 000 | 5 000 000 | 0 |
| FP | 0 | 0 | 0 |
| FQ | 0 | 0 | 0 |
| ZE | 5 000 000 | 5 000 000 | 0 |
| ZF | 15 000 000 | 15 000 000 | 0 |
| ZG | 12 300 000 | 18 890 000 | 6 590 000 |
| ZH | 12 300 000 | 18 890 000 | 6 590 000 |

- **Bilan 2025 après clôture** · 20 postes, aucun écart.
- **CR 2025 après clôture** · 17 postes, aucun écart.
- **TFT 2025 après clôture** · 25 postes, 8 écart(s) · FC attendu -1 000 000, OmegaX 0; FD attendu -3 000 000, OmegaX 0; FE attendu 3 410 000, OmegaX 0; ZB attendu 3 300 000, OmegaX 3 890 000; FG attendu -6 000 000, OmegaX 0; ZC attendu -6 000 000, OmegaX 0; ZG attendu 12 300 000, OmegaX 18 890 000; ZH attendu 12 300 000, OmegaX 18 890 000.

**Bilan 2026 avant clôture** · 22 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AI | 4 200 000 | 4 200 000 | 0 |
| AM | 4 200 000 | 4 200 000 | 0 |
| AZ | 4 200 000 | 4 200 000 | 0 |
| BB | 1 500 000 | 1 500 000 | 0 |
| BG | 4 000 000 | 4 000 000 | 0 |
| BI | 4 000 000 | 4 000 000 | 0 |
| BK | 5 500 000 | 5 500 000 | 0 |
| BS | 12 740 000 | 12 740 000 | 0 |
| BT | 12 740 000 | 12 740 000 | 0 |
| BZ | 22 440 000 | 22 440 000 | 0 |
| CA | 10 000 000 | 10 000 000 | 0 |
| CF | 329 000 | 329 000 | 0 |
| CH | 1 961 000 | 1 961 000 | 0 |
| CJ | 3 605 000 | 3 605 000 | 0 |
| CP | 15 895 000 | 15 895 000 | 0 |
| DA | 4 000 000 | 4 000 000 | 0 |
| DD | 4 000 000 | 4 000 000 | 0 |
| DF | 19 895 000 | 19 895 000 | 0 |
| DJ | 1 000 000 | 1 000 000 | 0 |
| DK | 1 545 000 | 1 545 000 | 0 |
| DP | 2 545 000 | 2 545 000 | 0 |
| DZ | 22 440 000 | 22 440 000 | 0 |

- **Bilan 2026, colonne N-1** · 20 postes, aucun écart.

**CR 2026 avant clôture** · 17 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 25 000 000 | 25 000 000 | 0 |
| RA | -15 000 000 | -15 000 000 | 0 |
| RB | 500 000 | 500 000 | 0 |
| XA | 10 500 000 | 10 500 000 | 0 |
| XB | 25 000 000 | 25 000 000 | 0 |
| RH | 0 | 0 | 0 |
| XC | 10 500 000 | 10 500 000 | 0 |
| RK | -3 900 000 | -3 900 000 | 0 |
| XD | 6 600 000 | 6 600 000 | 0 |
| RL | -1 200 000 | -1 200 000 | 0 |
| XE | 5 400 000 | 5 400 000 | 0 |
| RM | -250 000 | -250 000 | 0 |
| XF | -250 000 | -250 000 | 0 |
| XG | 5 150 000 | 5 150 000 | 0 |
| XH | 0 | 0 | 0 |
| RS | -1 545 000 | -1 545 000 | 0 |
| XI | 3 605 000 | 3 605 000 | 0 |

- **CR 2026, colonne N-1** · 17 postes, aucun écart.

**TFT 2026** · 25 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 12 300 000 | 12 300 000 | 0 |
| FA | 4 805 000 | 4 805 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | -500 000 | -500 000 | 0 |
| FD | -1 000 000 | -1 000 000 | 0 |
| FE | -865 000 | -865 000 | 0 |
| ZB | 2 440 000 | 2 440 000 | 0 |
| FF | 0 | 0 | 0 |
| FG | 0 | 0 | 0 |
| FH | 0 | 0 | 0 |
| FI | 0 | 0 | 0 |
| FJ | 0 | 0 | 0 |
| ZC | 0 | 0 | 0 |
| FK | 0 | 0 | 0 |
| FL | 0 | 0 | 0 |
| FM | 0 | 0 | 0 |
| FN | -1 000 000 | -1 000 000 | 0 |
| ZD | -1 000 000 | -1 000 000 | 0 |
| FO | 0 | 0 | 0 |
| FP | 0 | 0 | 0 |
| FQ | -1 000 000 | -1 000 000 | 0 |
| ZE | -1 000 000 | -1 000 000 | 0 |
| ZF | -2 000 000 | -2 000 000 | 0 |
| ZG | 440 000 | 440 000 | 0 |
| ZH | 12 740 000 | 12 740 000 | 0 |

- **TFT 2026, colonne N-1** · 25 postes, 11 écart(s) · ZA attendu 0, OmegaX vide; FB attendu 0, OmegaX vide; FC attendu -1 000 000, OmegaX vide; FD attendu -3 000 000, OmegaX vide; FE attendu 3 410 000, OmegaX vide; ZB attendu 3 300 000, OmegaX vide; FF attendu 0, OmegaX vide; FG attendu -6 000 000, OmegaX vide; ZC attendu -6 000 000, OmegaX vide; ZG attendu 12 300 000, OmegaX vide; ZH attendu 12 300 000, OmegaX vide.
- **Bilan 2026 après clôture** · 22 postes, aucun écart.
- **CR 2026 après clôture** · 17 postes, aucun écart.
- **TFT 2026 après clôture** · 25 postes, aucun écart.
- **Bilan 2027, colonne N-1** · 22 postes, aucun écart.
- **CR 2027, colonne N-1** · 17 postes, aucun écart.

**Contrôles et gestes** · 4 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| Contrôle 637 en 2025 (non viré, doit se lever) | PERSONNEL_EXTERIEUR_NON_VIRE | 1 | 1 | 0 |
| Contrôle 637 en 2026 (viré, doit se taire) | PERSONNEL_EXTERIEUR_NON_VIRE | 0 | 0 | 0 |
| Réserve légale sous le dixième (refus attendu) | AUSCGIE art. 346 | 400 | 400 | 0 |
| Affectation conforme (acceptée) | AUSCGIE art. 346 | 201 | 201 | 0 |


### Rejeu C05


**CR 2026** · 13 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 8 000 000 | 8 000 000 | 0 |
| RA | -9 000 000 | -9 000 000 | 0 |
| XA | -1 000 000 | -1 000 000 | 0 |
| XB | 8 000 000 | 8 000 000 | 0 |
| XC | -1 000 000 | -1 000 000 | 0 |
| RK | -1 500 000 | -1 500 000 | 0 |
| XD | -2 500 000 | -2 500 000 | 0 |
| XE | -2 500 000 | -2 500 000 | 0 |
| XF | 0 | 0 | 0 |
| XG | -2 500 000 | -2 500 000 | 0 |
| XH | 0 | 0 | 0 |
| RS | -80 000 | -80 000 | 0 |
| XI | -2 580 000 | -2 580 000 | 0 |


**Bilan 2026** · 10 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| BS | 2 500 000 | 2 500 000 | 0 |
| BT | 2 500 000 | 2 500 000 | 0 |
| BZ | 2 500 000 | 2 500 000 | 0 |
| CA | 5 000 000 | 5 000 000 | 0 |
| CH | 0 | 0 | 0 |
| CJ | -2 580 000 | -2 580 000 | 0 |
| CP | 2 420 000 | 2 420 000 | 0 |
| DK | 80 000 | 80 000 | 0 |
| DP | 80 000 | 80 000 | 0 |
| DZ | 2 500 000 | 2 500 000 | 0 |


**CR 2027** · 11 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 10 000 000 | 10 000 000 | 0 |
| RA | -7 000 000 | -7 000 000 | 0 |
| XA | 3 000 000 | 3 000 000 | 0 |
| XB | 10 000 000 | 10 000 000 | 0 |
| XC | 3 000 000 | 3 000 000 | 0 |
| RK | -1 500 000 | -1 500 000 | 0 |
| XD | 1 500 000 | 1 500 000 | 0 |
| XE | 1 500 000 | 1 500 000 | 0 |
| XG | 1 500 000 | 1 500 000 | 0 |
| RS | -100 000 | -100 000 | 0 |
| XI | 1 400 000 | 1 400 000 | 0 |

- **CR 2027, colonne N-1** · 13 postes, aucun écart.

**Bilan 2027** · 10 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| BS | 3 920 000 | 3 920 000 | 0 |
| BT | 3 920 000 | 3 920 000 | 0 |
| BZ | 3 920 000 | 3 920 000 | 0 |
| CA | 5 000 000 | 5 000 000 | 0 |
| CH | -2 580 000 | -2 580 000 | 0 |
| CJ | 1 400 000 | 1 400 000 | 0 |
| CP | 3 820 000 | 3 820 000 | 0 |
| DK | 100 000 | 100 000 | 0 |
| DP | 100 000 | 100 000 | 0 |
| DZ | 3 920 000 | 3 920 000 | 0 |

- **Bilan 2027, colonne N-1** · 10 postes, aucun écart.

**Bilan 2028 après affectation de 2027 (report)** · 3 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| CH | -1 180 000 | -1 180 000 | 0 |
| CJ | 0 | 0 | 0 |
| CP | 3 820 000 | 3 820 000 | 0 |


**Gestes et contrôles** · 4 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| Moitié du capital en 2026 (doit se lever) | CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL | 1 | 1 | 0 |
| Moitié du capital en 2027 (doit se taire) | CAPITAUX_PROPRES_INFERIEURS_MOITIE_CAPITAL | 0 | 0 | 0 |
| Affectation de la perte 2026 au 1291 | Titre VII compte 12 | 201 | 201 | 0 |
| Affectation 2027 sans réserve légale (pertes antérieures) | AUSCGIE art. 346 | 201 | 201 | 0 |


### Rejeu C06


**Bilan 2026** · 14 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AM | 1 500 000 | 1 500 000 | 0 |
| AZ | 1 500 000 | 1 500 000 | 0 |
| BI | 800 000 | 800 000 | 0 |
| BG | 800 000 | 800 000 | 0 |
| BS | 3 200 000 | 3 200 000 | 0 |
| BT | 3 200 000 | 3 200 000 | 0 |
| BZ | 5 500 000 | 5 500 000 | 0 |
| CA | 2 000 000 | 2 000 000 | 0 |
| CH | 500 000 | 500 000 | 0 |
| CJ | 2 400 000 | 2 400 000 | 0 |
| CP | 4 900 000 | 4 900 000 | 0 |
| DJ | 600 000 | 600 000 | 0 |
| DP | 600 000 | 600 000 | 0 |
| DZ | 5 500 000 | 5 500 000 | 0 |

- **Bilan 2026, colonne N-1 (bilan d’ouverture importé)** · 10 postes, 10 écart(s) · AM attendu 2 100 000, OmegaX vide; AZ attendu 2 100 000, OmegaX vide; BI attendu 800 000, OmegaX vide; BS attendu 200 000, OmegaX vide; BZ attendu 3 100 000, OmegaX vide; CA attendu 2 000 000, OmegaX vide; CH attendu 500 000, OmegaX vide; CP attendu 2 500 000, OmegaX vide; DJ attendu 600 000, OmegaX vide; DZ attendu 3 100 000, OmegaX vide.

**CR 2026** · 8 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 5 000 000 | 5 000 000 | 0 |
| XB | 5 000 000 | 5 000 000 | 0 |
| RH | -2 000 000 | -2 000 000 | 0 |
| XC | 3 000 000 | 3 000 000 | 0 |
| XD | 3 000 000 | 3 000 000 | 0 |
| RL | -600 000 | -600 000 | 0 |
| XE | 2 400 000 | 2 400 000 | 0 |
| XI | 2 400 000 | 2 400 000 | 0 |


**TFT 2026** · 14 comparaisons, 2 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 200 000 | 0 | -200 000 |
| FA | 3 000 000 | 3 000 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | 0 | 0 | 0 |
| FD | 0 | 0 | 0 |
| FE | 0 | 0 | 0 |
| ZB | 3 000 000 | 3 000 000 | 0 |
| FG | 0 | 0 | 0 |
| ZC | 0 | 0 | 0 |
| ZD | 0 | 0 | 0 |
| ZE | 0 | 0 | 0 |
| ZF | 0 | 0 | 0 |
| ZG | 3 000 000 | 3 000 000 | 0 |
| ZH | 3 200 000 | 3 000 000 | -200 000 |

- **Bilan 2027, colonne N-1** · 14 postes, aucun écart.

**Bilan 2027 (ouverture = clôture 2026)** · 5 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AM | 1 500 000 | 1 500 000 | 0 |
| BI | 800 000 | 800 000 | 0 |
| BS | 3 200 000 | 3 200 000 | 0 |
| CA | 2 000 000 | 2 000 000 | 0 |
| DJ | 600 000 | 600 000 | 0 |


### Rejeu C07

- **Bilan 2026 après clôture** · 6 postes, aucun écart.
- **CR 2026 après clôture** · 3 postes, aucun écart.
- **Bilan 2027, colonne N-1** · 6 postes, aucun écart.

**À-nouveau 2027** · 2 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| À-nouveau 2027 (définitif) | 40110000 crédit | 500 000 | 500 000 | 0 |
| À-nouveau 2027 (définitif) | 52110000 débit | 5 800 000 | 5 800 000 | 0 |


**Gestes et contrôles** · 6 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| Opération d’une période close sans demande de report (refus attendu, motif qui nomme le report) | art. 22, 4° | refus 4xx | 403 | 0 |
| Opération d’une période close avec demande de report (acceptée) | art. 22, 4° | 201 | 201 | 0 |
| Date de l’opération reportée | date | 2026-12-01 | 2026-12-01 | 0 |
| Date de valeur mentionnée distinctement | dateValeur | 2026-11-15 | 2026-11-15 | 0 |
| Charge omise de N après la clôture de N, passée en N+1 (acceptée) | Titre V | 201 | 201 | 0 |
| Clôture de N+1 avant N (refus attendu) | clôture dans l’ordre | 400 | 400 | 0 |


### Rejeu C08


**Bilan SMT 2026** · 11 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| SA1 | 800 000 | 800 000 | 0 |
| SA2 | 700 000 | 700 000 | 0 |
| SA3 | 500 000 | 500 000 | 0 |
| SA4 | 1 800 000 | 1 800 000 | 0 |
| SA5 | 0 | 0 | 0 |
| SAZ | 3 800 000 | 3 800 000 | 0 |
| SP1 | 2 000 000 | 2 000 000 | 0 |
| SP2 | 1 500 000 | 1 500 000 | 0 |
| SP3 | 0 | 0 | 0 |
| SP4 | 300 000 | 300 000 | 0 |
| SPZ | 3 800 000 | 3 800 000 | 0 |


**CR SMT 2026** · 12 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| SR1 | 6 000 000 | 6 000 000 | 0 |
| SR2 | 0 | 0 | 0 |
| SRA | 6 000 000 | 6 000 000 | 0 |
| SD1 | 3 500 000 | 3 500 000 | 0 |
| SD2 | 600 000 | 600 000 | 0 |
| SD3 | 800 000 | 800 000 | 0 |
| SD4 | 100 000 | 100 000 | 0 |
| SD5 | 0 | 0 | 0 |
| SD6 | 0 | 0 | 0 |
| SDB | 5 000 000 | 5 000 000 | 0 |
| SC | 1 000 000 | 1 000 000 | 0 |
| SG | 1 500 000 | 1 500 000 | 0 |


**Bilan SMT 2027** · 11 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| SA1 | 400 000 | 400 000 | 0 |
| SA2 | 900 000 | 900 000 | 0 |
| SA3 | 200 000 | 200 000 | 0 |
| SA4 | 2 800 000 | 2 800 000 | 0 |
| SA5 | 0 | 0 | 0 |
| SAZ | 4 300 000 | 4 300 000 | 0 |
| SP1 | 3 000 000 | 3 000 000 | 0 |
| SP2 | 900 000 | 900 000 | 0 |
| SP3 | 0 | 0 | 0 |
| SP4 | 400 000 | 400 000 | 0 |
| SPZ | 4 300 000 | 4 300 000 | 0 |

- **Bilan SMT 2027, colonne N-1** · 11 postes, aucun écart.

**CR SMT 2027** · 12 comparaisons, 4 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| SR1 | 7 000 000 | 6 500 000 | -500 000 |
| SR2 | 0 | 500 000 | 500 000 |
| SRA | 7 000 000 | 7 000 000 | 0 |
| SD1 | 4 000 000 | 3 700 000 | -300 000 |
| SD2 | 600 000 | 600 000 | 0 |
| SD3 | 900 000 | 900 000 | 0 |
| SD4 | 0 | 0 | 0 |
| SD5 | 0 | 0 | 0 |
| SD6 | 0 | 300 000 | 300 000 |
| SDB | 5 500 000 | 5 500 000 | 0 |
| SC | 1 500 000 | 1 500 000 | 0 |
| SG | 900 000 | 900 000 | 0 |

- **CR SMT 2027, colonne N-1** · 12 postes, aucun écart.
- **Bilan SMT 2027 après clôture** · 11 postes, aucun écart.
- **CR SMT 2027 après clôture** · 12 postes, 4 écart(s) · SR1 attendu 7 000 000, OmegaX 6 500 000; SR2 attendu 0, OmegaX 500 000; SD1 attendu 4 000 000, OmegaX 3 700 000; SD6 attendu 0, OmegaX 300 000.

### Rejeu C09


**Bilan 2026** · 19 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AM | 3 000 000 | 3 000 000 | 0 |
| AH | 3 000 000 | 3 000 000 | 0 |
| AZ | 3 000 000 | 3 000 000 | 0 |
| BD | 500 000 | 500 000 | 0 |
| BT | 500 000 | 500 000 | 0 |
| BW | 6 900 000 | 6 900 000 | 0 |
| BX | 6 900 000 | 6 900 000 | 0 |
| BZ | 10 400 000 | 10 400 000 | 0 |
| CA | 5 000 000 | 5 000 000 | 0 |
| CH | 1 300 000 | 1 300 000 | 0 |
| CI | 3 000 000 | 3 000 000 | 0 |
| CK | 9 300 000 | 9 300 000 | 0 |
| CW | 800 000 | 800 000 | 0 |
| CY | 800 000 | 800 000 | 0 |
| CZ | 10 100 000 | 10 100 000 | 0 |
| DE | 10 100 000 | 10 100 000 | 0 |
| DH | 300 000 | 300 000 | 0 |
| DV | 300 000 | 300 000 | 0 |
| DZ | 10 400 000 | 10 400 000 | 0 |


**CR 2026** · 13 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| RA | 3 000 000 | 3 000 000 | 0 |
| RC | 1 000 000 | 1 000 000 | 0 |
| RH | 2 200 000 | 2 200 000 | 0 |
| XA | 6 200 000 | 6 200 000 | 0 |
| TA | 1 200 000 | 1 200 000 | 0 |
| TD | 300 000 | 300 000 | 0 |
| TG | 600 000 | 600 000 | 0 |
| TJ | 1 800 000 | 1 800 000 | 0 |
| TL | 1 000 000 | 1 000 000 | 0 |
| XB | 4 900 000 | 4 900 000 | 0 |
| XC | 1 300 000 | 1 300 000 | 0 |
| XD | 0 | 0 | 0 |
| XE | 1 300 000 | 1 300 000 | 0 |


**TFT 2026** · 24 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 0 | 0 | 0 |
| FA | 2 500 000 | 2 500 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | 1 000 000 | 1 000 000 | 0 |
| FD | 0 | 0 | 0 |
| FE | 0 | 0 | 0 |
| FF | -1 800 000 | -1 800 000 | 0 |
| FG | -1 800 000 | -1 800 000 | 0 |
| FH | 0 | 0 | 0 |
| ZB | -100 000 | -100 000 | 0 |
| FI | -4 000 000 | -4 000 000 | 0 |
| FJ | 0 | 0 | 0 |
| FK | 0 | 0 | 0 |
| FL | 0 | 0 | 0 |
| ZC | -4 000 000 | -4 000 000 | 0 |
| FM | 5 000 000 | 5 000 000 | 0 |
| FN | 4 000 000 | 4 000 000 | 0 |
| FO | 0 | 0 | 0 |
| ZD | 9 000 000 | 9 000 000 | 0 |
| FP | 2 000 000 | 2 000 000 | 0 |
| FQ | 0 | 0 | 0 |
| ZE | 2 000 000 | 2 000 000 | 0 |
| ZF | 6 900 000 | 6 900 000 | 0 |
| ZG | 6 900 000 | 6 900 000 | 0 |


**Bilan 2027** · 21 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AM | 2 000 000 | 2 000 000 | 0 |
| AH | 2 000 000 | 2 000 000 | 0 |
| AZ | 2 000 000 | 2 000 000 | 0 |
| BD | 700 000 | 700 000 | 0 |
| BT | 700 000 | 700 000 | 0 |
| BW | 7 700 000 | 7 700 000 | 0 |
| BX | 7 700 000 | 7 700 000 | 0 |
| BZ | 10 400 000 | 10 400 000 | 0 |
| CA | 5 000 000 | 5 000 000 | 0 |
| CF | 300 000 | 300 000 | 0 |
| CG | 1 000 000 | 1 000 000 | 0 |
| CH | 1 700 000 | 1 700 000 | 0 |
| CI | 2 000 000 | 2 000 000 | 0 |
| CK | 10 000 000 | 10 000 000 | 0 |
| CW | 0 | 0 | 0 |
| CY | 0 | 0 | 0 |
| CZ | 10 000 000 | 10 000 000 | 0 |
| DE | 10 000 000 | 10 000 000 | 0 |
| DH | 400 000 | 400 000 | 0 |
| DV | 400 000 | 400 000 | 0 |
| DZ | 10 400 000 | 10 400 000 | 0 |

- **Bilan 2027, colonne N-1** · 19 postes, aucun écart.

**CR 2027** · 13 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| RA | 3 200 000 | 3 200 000 | 0 |
| RC | 1 500 000 | 1 500 000 | 0 |
| RH | 1 800 000 | 1 800 000 | 0 |
| XA | 6 500 000 | 6 500 000 | 0 |
| TA | 800 000 | 800 000 | 0 |
| TD | 400 000 | 400 000 | 0 |
| TG | 600 000 | 600 000 | 0 |
| TJ | 2 000 000 | 2 000 000 | 0 |
| TL | 1 000 000 | 1 000 000 | 0 |
| XB | 4 800 000 | 4 800 000 | 0 |
| XC | 1 700 000 | 1 700 000 | 0 |
| XD | 0 | 0 | 0 |
| XE | 1 700 000 | 1 700 000 | 0 |

- **CR 2027, colonne N-1** · 13 postes, aucun écart.

**TFT 2027** · 21 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 6 900 000 | 6 900 000 | 0 |
| FA | 3 000 000 | 3 000 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | 1 500 000 | 1 500 000 | 0 |
| FD | 0 | 0 | 0 |
| FE | 0 | 0 | 0 |
| FF | -1 700 000 | -1 700 000 | 0 |
| FG | -2 000 000 | -2 000 000 | 0 |
| FH | 0 | 0 | 0 |
| ZB | 800 000 | 800 000 | 0 |
| FI | 0 | 0 | 0 |
| ZC | 0 | 0 | 0 |
| FM | 0 | 0 | 0 |
| FN | 0 | 0 | 0 |
| FO | 0 | 0 | 0 |
| ZD | 0 | 0 | 0 |
| FP | 0 | 0 | 0 |
| FQ | 0 | 0 | 0 |
| ZE | 0 | 0 | 0 |
| ZF | 800 000 | 800 000 | 0 |
| ZG | 7 700 000 | 7 700 000 | 0 |

- **TFT 2027, colonne N-1** · 24 postes, aucun écart.
- **Bilan 2027 après clôture** · 21 postes, aucun écart.
- **CR 2027 après clôture** · 13 postes, aucun écart.

**Gestes et contrôles** · 4 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| Méthode des cotisations non déclarée en 2026 (doit se lever) | METHODE_COTISATIONS_NON_PRECISEE | 1 | 1 | 0 |
| Méthode déclarée (APPEL) en 2027 (doit se taire) | METHODE_COTISATIONS_NON_PRECISEE | 0 | 0 | 0 |
| Classe 9 hors bilan (aucun compte 9 non rattaché) | classe 9 | 1 | 1 | 0 |
| Affectation de l’excédent (11 et 12) | SYCEBNL compte 13 | 201 | 201 | 0 |


### Rejeu C10


**Emplois-ressources 2026, exercice** · 17 comparaisons, 3 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| FA | 13 000 000 | 13 000 000 | 0 |
| FC | 1 000 000 | 1 000 000 | 0 |
| FD | 0 | 0 | 0 |
| GR | 14 000 000 | 14 000 000 | 0 |
| FJ | 3 000 000 | 3 000 000 | 0 |
| GS | 3 000 000 | 3 000 000 | 0 |
| FM | 1 500 000 | 1 705 882,35 | 205 882,35 |
| FN | 400 000 | 341 176,47 | -58 823,53 |
| FO | 1 000 000 | 852 941,18 | -147 058,82 |
| FP | 100 000 | 100 000 | 0 |
| FR | 3 000 000 | 3 000 000 | 0 |
| GT | 6 000 000 | 6 000 000 | 0 |
| GU | 9 000 000 | 9 000 000 | 0 |
| GV | 5 000 000 | 5 000 000 | 0 |
| GW | 0 | 0 | 0 |
| GX | 5 000 000 | 5 000 000 | 0 |
| GY | 5 000 000 | 5 000 000 | 0 |


**Emplois-ressources 2026, cumul fin** · 17 comparaisons, 3 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| FA | 13 000 000 | 13 000 000 | 0 |
| FC | 1 000 000 | 1 000 000 | 0 |
| FD | 0 | 0 | 0 |
| GR | 14 000 000 | 14 000 000 | 0 |
| FJ | 3 000 000 | 3 000 000 | 0 |
| GS | 3 000 000 | 3 000 000 | 0 |
| FM | 1 500 000 | 1 705 882,35 | 205 882,35 |
| FN | 400 000 | 341 176,47 | -58 823,53 |
| FO | 1 000 000 | 852 941,18 | -147 058,82 |
| FP | 100 000 | 100 000 | 0 |
| FR | 3 000 000 | 3 000 000 | 0 |
| GT | 6 000 000 | 6 000 000 | 0 |
| GU | 9 000 000 | 9 000 000 | 0 |
| GV | 5 000 000 | 5 000 000 | 0 |
| GW | 0 | 0 | 0 |
| GX | 5 000 000 | 5 000 000 | 0 |
| GY | 5 000 000 | 5 000 000 | 0 |


**Emplois-ressources 2027, exercice** · 14 comparaisons, 2 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| FA | 6 000 000 | 6 000 000 | 0 |
| FC | 0 | 0 | 0 |
| GR | 6 000 000 | 6 000 000 | 0 |
| FJ | 0 | 0 | 0 |
| GS | 0 | 0 | 0 |
| FM | 1 500 000 | 1 277 777,78 | -222 222,22 |
| FO | 800 000 | 1 022 222,22 | 222 222,22 |
| FR | 3 000 000 | 3 000 000 | 0 |
| GT | 5 300 000 | 5 300 000 | 0 |
| GU | 5 300 000 | 5 300 000 | 0 |
| GV | 700 000 | 700 000 | 0 |
| GW | 5 000 000 | 5 000 000 | 0 |
| GX | 5 700 000 | 5 700 000 | 0 |
| GY | 5 700 000 | 5 700 000 | 0 |


**Emplois-ressources 2027, cumul début** · 13 comparaisons, 2 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| FA | 13 000 000 | 13 000 000 | 0 |
| FC | 1 000 000 | 1 000 000 | 0 |
| GR | 14 000 000 | 14 000 000 | 0 |
| FJ | 3 000 000 | 3 000 000 | 0 |
| FM | 1 500 000 | 1 705 882,35 | 205 882,35 |
| FO | 1 000 000 | 852 941,18 | -147 058,82 |
| FR | 3 000 000 | 3 000 000 | 0 |
| GT | 6 000 000 | 6 000 000 | 0 |
| GU | 9 000 000 | 9 000 000 | 0 |
| GV | 5 000 000 | 5 000 000 | 0 |
| GW | 0 | 0 | 0 |
| GX | 5 000 000 | 5 000 000 | 0 |
| GY | 5 000 000 | 5 000 000 | 0 |


**Emplois-ressources 2027, cumul fin** · 15 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| FA | 19 000 000 | 19 000 000 | 0 |
| FC | 1 000 000 | 1 000 000 | 0 |
| GR | 20 000 000 | 20 000 000 | 0 |
| FJ | 3 000 000 | 3 000 000 | 0 |
| FM | 3 000 000 | 3 000 000 | 0 |
| FN | 400 000 | 400 000 | 0 |
| FO | 1 800 000 | 1 800 000 | 0 |
| FP | 100 000 | 100 000 | 0 |
| FR | 6 000 000 | 6 000 000 | 0 |
| GT | 11 300 000 | 11 300 000 | 0 |
| GU | 14 300 000 | 14 300 000 | 0 |
| GV | 5 700 000 | 5 700 000 | 0 |
| GW | 0 | 0 | 0 |
| GX | 5 700 000 | 5 700 000 | 0 |
| GY | 5 700 000 | 5 700 000 | 0 |

- **Emplois-ressources 2027 après clôture, exercice** · 14 postes, 2 écart(s) · FM attendu 1 500 000, OmegaX 1 277 777,78; FO attendu 800 000, OmegaX 1 022 222,22.

**Exécution budgétaire 2026** · 20 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| B1.budget | 2 500 000 | 2 500 000 | 0 |
| B1.decaissement | 1 500 000 | 1 500 000 | 0 |
| B1.engagement | 500 000 | 500 000 | 0 |
| B1.realisation | 2 000 000 | 2 000 000 | 0 |
| B1.creditDisponible | 500 000 | 500 000 | 0 |
| B2.budget | 500 000 | 500 000 | 0 |
| B2.decaissement | 400 000 | 400 000 | 0 |
| B2.engagement | 0 | 0 | 0 |
| B2.realisation | 400 000 | 400 000 | 0 |
| B2.creditDisponible | 100 000 | 100 000 | 0 |
| B3.budget | 1 200 000 | 1 200 000 | 0 |
| B3.decaissement | 1 000 000 | 1 000 000 | 0 |
| B3.engagement | 0 | 0 | 0 |
| B3.realisation | 1 000 000 | 1 000 000 | 0 |
| B3.creditDisponible | 200 000 | 200 000 | 0 |
| B4.budget | 3 200 000 | 3 200 000 | 0 |
| B4.decaissement | 3 100 000 | 3 100 000 | 0 |
| B4.engagement | 0 | 0 | 0 |
| B4.realisation | 3 100 000 | 3 100 000 | 0 |
| B4.creditDisponible | 100 000 | 100 000 | 0 |


**Exécution budgétaire 2027** · 15 comparaisons, 3 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| B1.budget | 1 200 000 | 1 200 000 | 0 |
| B1.decaissement | 1 500 000 | 1 000 000 | -500 000 |
| B1.engagement | 0 | 0 | 0 |
| B1.realisation | 1 500 000 | 1 000 000 | -500 000 |
| B1.creditDisponible | -300 000 | 200 000 | 500 000 |
| B3.budget | 1 000 000 | 1 000 000 | 0 |
| B3.decaissement | 800 000 | 800 000 | 0 |
| B3.engagement | 0 | 0 | 0 |
| B3.realisation | 800 000 | 800 000 | 0 |
| B3.creditDisponible | 200 000 | 200 000 | 0 |
| B4.budget | 3 000 000 | 3 000 000 | 0 |
| B4.decaissement | 3 000 000 | 3 000 000 | 0 |
| B4.engagement | 0 | 0 | 0 |
| B4.realisation | 3 000 000 | 3 000 000 | 0 |
| B4.creditDisponible | 0 | 0 | 0 |

- **Exécution budgétaire 2026 relue après le règlement de 2027** · 2 postes, aucun écart.

### Rejeu C11


**Bilan SMT 2026** · 11 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| GA | 400 000 | 400 000 | 0 |
| GB | 150 000 | 150 000 | 0 |
| GC | 300 000 | 300 000 | 0 |
| GD | 1 400 000 | 1 400 000 | 0 |
| GE | 0 | 0 | 0 |
| GZ | 2 250 000 | 2 250 000 | 0 |
| HA | 1 000 000 | 1 000 000 | 0 |
| HB | 1 050 000 | 1 050 000 | 0 |
| HC | 0 | 0 | 0 |
| HD | 200 000 | 200 000 | 0 |
| HZ | 2 250 000 | 2 250 000 | 0 |


**CR SMT 2026** · 8 comparaisons, 4 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| KA | 2 000 000 | 2 000 000 | 0 |
| KX | 3 500 000 | 4 500 000 | 1 000 000 |
| JA | 1 200 000 | 1 200 000 | 0 |
| JB | 400 000 | 400 000 | 0 |
| JC | 900 000 | 900 000 | 0 |
| JX | 2 500 000 | 3 100 000 | 600 000 |
| KZ | 1 000 000 | 1 400 000 | 400 000 |
| KZC | 1 050 000 | 1 450 000 | 400 000 |


**Bilan SMT 2027** · 11 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| GA | 200 000 | 200 000 | 0 |
| GB | 100 000 | 100 000 | 0 |
| GC | 100 000 | 100 000 | 0 |
| GD | 2 500 000 | 2 500 000 | 0 |
| GE | 0 | 0 | 0 |
| GZ | 2 900 000 | 2 900 000 | 0 |
| HA | 1 000 000 | 1 000 000 | 0 |
| HB | 850 000 | 850 000 | 0 |
| HC | 1 050 000 | 1 050 000 | 0 |
| HD | 0 | 0 | 0 |
| HZ | 2 900 000 | 2 900 000 | 0 |

- **Bilan SMT 2027, colonne N-1** · 11 postes, aucun écart.

**CR SMT 2027** · 8 comparaisons, 2 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| KA | 2 500 000 | 2 200 000 | -300 000 |
| KX | 4 000 000 | 4 000 000 | 0 |
| JA | 1 500 000 | 1 300 000 | -200 000 |
| JB | 400 000 | 400 000 | 0 |
| JC | 1 000 000 | 1 000 000 | 0 |
| JX | 2 900 000 | 2 900 000 | 0 |
| KZ | 1 100 000 | 1 100 000 | 0 |
| KZC | 850 000 | 850 000 | 0 |

- **CR SMT 2027, colonne N-1** · 8 postes, 4 écart(s) · KX attendu 3 500 000, OmegaX 4 500 000; JX attendu 2 500 000, OmegaX 3 100 000; KZ attendu 1 000 000, OmegaX 1 400 000; KZC attendu 1 050 000, OmegaX 1 450 000.
- **Bilan SMT 2027 après clôture** · 11 postes, aucun écart.
- **CR SMT 2027 après clôture** · 8 postes, 2 écart(s) · KA attendu 2 500 000, OmegaX 2 200 000; JA attendu 1 500 000, OmegaX 1 300 000.

### Rejeu C12


**CR 2027** · 12 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| TA | 7 000 000 | 7 000 000 | 0 |
| XB | 7 000 000 | 7 000 000 | 0 |
| RH | -3 500 000 | -3 500 000 | 0 |
| XC | 3 500 000 | 3 500 000 | 0 |
| XD | 3 500 000 | 3 500 000 | 0 |
| RL | -1 100 000 | -1 100 000 | 0 |
| XE | 2 400 000 | 2 400 000 | 0 |
| XG | 2 400 000 | 2 400 000 | 0 |
| TN | 4 000 000 | 4 000 000 | 0 |
| RO | -3 500 000 | -3 500 000 | 0 |
| XH | 500 000 | 500 000 | 0 |
| XI | 2 900 000 | 2 900 000 | 0 |


**Bilan 2027** · 13 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| AM | 0 | 0 | 0 |
| AN | 2 400 000 | 2 400 000 | 0 |
| AI | 2 400 000 | 2 400 000 | 0 |
| AZ | 2 400 000 | 2 400 000 | 0 |
| BS | 10 500 000 | 10 500 000 | 0 |
| BT | 10 500 000 | 10 500 000 | 0 |
| BZ | 12 900 000 | 12 900 000 | 0 |
| CA | 8 000 000 | 8 000 000 | 0 |
| CF | 200 000 | 200 000 | 0 |
| CH | 1 800 000 | 1 800 000 | 0 |
| CJ | 2 900 000 | 2 900 000 | 0 |
| CP | 12 900 000 | 12 900 000 | 0 |
| DZ | 12 900 000 | 12 900 000 | 0 |


**TFT 2027** · 18 comparaisons, 0 écart(s)

| Poste | Attendu | OmegaX | Écart |
|---|---|---|---|
| ZA | 6 000 000 | 6 000 000 | 0 |
| FA | 3 500 000 | 3 500 000 | 0 |
| FB | 0 | 0 | 0 |
| FC | 0 | 0 | 0 |
| FD | 0 | 0 | 0 |
| FE | 0 | 0 | 0 |
| ZB | 3 500 000 | 3 500 000 | 0 |
| FF | 0 | 0 | 0 |
| FG | -3 000 000 | -3 000 000 | 0 |
| FH | 0 | 0 | 0 |
| FI | 4 000 000 | 4 000 000 | 0 |
| FJ | 0 | 0 | 0 |
| ZC | 1 000 000 | 1 000 000 | 0 |
| ZD | 0 | 0 | 0 |
| ZE | 0 | 0 | 0 |
| ZF | 0 | 0 | 0 |
| ZG | 4 500 000 | 4 500 000 | 0 |
| ZH | 10 500 000 | 10 500 000 | 0 |

- **TFT 2027 après clôture** · 18 postes, aucun écart.

**Gestes et contrôles** · 1 comparaisons, 0 écart(s)

| Geste ou contrôle | Référence | Attendu | OmegaX | Écart |
|---|---|---|---|---|
| Clôture avec du brouillard (refus attendu) | art. 22, 2° | 400 | 400 | 0 |



---

## Rejouer

Sur une base PostgreSQL JETABLE, jamais celle de production ·

```bash
npm ci && npm run build
DATABASE_URL=<base jetable> npx prisma migrate deploy
DATABASE_URL=<base jetable> JWT_SECRET=<valeur jetable> PORT=8231 \
  INSCRIPTION_PUBLIQUE=true node dist/main.js
OMEGAX_API=http://localhost:8231 node scripts/cas-chiffres/rejeu-cloture.mjs rejeu-cloture.json
```

`OMEGAX_CAS=C05,C09` ne rejoue que les situations nommées. Le script imprime
chaque écart (attendu, OmegaX, écart) et écrit le détail lu (refus, motifs,
contrôles, réserves du TFT) dans le fichier de sortie. Rejeu du 2026-10-07 ·
1 081 comparaisons, 74 écarts, 21 secondes.

## Relecture unique du 2026-10-07 · corrections

- **Bloquant 1 (B3)** · seul le reste dû se suit · la facture de N-1 réglée
  en partie avant sa clôture ne pèse en N que pour son reste (Application
  22, règle (c)), lu sur le groupe de la ligne à la date
  (`resteDuALaDate`, `suiteEnNDesDettes`), porté au prorata des
  ventilations. Le même défaut côté N (facture de l'exercice réglée en
  partie, engagée en entier) est corrigé par la même lecture · décaissé le
  réglé, engagé le reste (règle (d), « solde créditeur balance N »). Un
  groupe à plusieurs factures (Code civil, Livre III, art. 151 à 154) est
  nommé, compté nulle part. Rejeu · C13.
- **Bloquant 2 (B1, N1, Q3)** · AUDCIF art. 34 relu · il fait correspondre
  les bilans sans dire comment l'ouverture s'inscrit. Une position de bilan
  passée en OD au premier jour d'un premier exercice (périmètre d'AU2,
  `filtreOuverturePasseeAuPremierJour`) peut être la reprise d'un dossier
  ou l'apport qui fait naître l'entité · lecture non sûre, donc ni flux ni
  ouverture · postes du tableau des flux qui lisent l'ouverture ou les
  mouvements vides, colonne N-1 du bilan non servie, motif qui nomme les
  pièces et les deux issues. Sans elle, l'ouverture présumée nulle est
  dite sur les cinq bilans et le tableau des flux. Rejeu · C14.
- **Majeur 3 (N3, N4) et sa suite** · « variation des dettes
  d'EXPLOITATION » (SYCEBNL Partie 4 ch. 4, ligne VC ; AUDCIF Titre X,
  ligne E) · la fiche du compte 40 des deux plans renvoie les fournisseurs
  d'immobilisations au 481, que VC ne lit pas. Une immobilisation passée au
  401 se lit par la composition de sa pièce, une seule règle pour la dette
  et pour son règlement · la part de classe 2 du règlement est un flux hors
  exploitation, et la dette qui en est née sort de VC (de la ligne E au
  SYSCOHADA), à l'ouverture comme à la clôture
  (`dettesFournisseursNeesDImmobilisations`) ; les classes 6 à 8 font la
  dépense ; tout autre compte (taxe) reste au 40, nommé, et sa dette dans
  VC. Les trois cas sont justes · facture due à la clôture, réglée en N+1,
  réglée dans l'exercice. Au SYSCOHADA, l'identité de concordance compte la
  variation de ces dettes et leurs règlements avec la classe 2, résiduel
  nul. Rejeu · C15, deux exercices, deux référentiels.
- **Mineurs** · (4) l'acompte lettré se rattache à la facture de son
  groupe ; (5) provenance de la colonne N-1 aux deux écrans SMT et dans la
  feuille ANOMALIES de chaque liasse ; (7) le refus de C02 se juge à son
  motif.

### Relevés en attente

- **(6) `factureDOrigine`** · une requête par ligne d'à-nouveau (et par
  degré de report), menées par paquets de dix · à regrouper par tranche
  sur les clés de report si le volume le demande. Non trivial (l'appariement
  se fait par libellé recopié), laissé tel quel.
