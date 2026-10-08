# Cas chiffrés · paie

Méthode décidée par Manasse le 2026-10-04 pour l'IS, reprise à l'identique ·
on part des CALCULS, non des obligations. Quinze situations de paie d'un
employeur congolais sont calculées à la main, texte par texte, puis rejouées
dans OmegaX sur une vraie base, par l'API du serveur compilé
(`scripts/cas-chiffres/rejeu-paie.mjs`). PHASE DE CONSTAT · rien n'est
corrigé dans `src/` ni dans `client/`, le document rend un constat.

Code relu · `main` au commit `a4970fd` (module `src/modules/personnel/`).
Rejeu · 2026-10-07, base PostgreSQL 16 jetable (`paiecas`), serveur compilé
(`node dist/main.js`, port 8131), dix-sept dossiers créés par l'inscription
(seize SYSCOHADA, un SYCEBNL « associations »), registre du personnel,
simulations, bulletins émis et annulés, décompte final émis, paie du mois
passée au journal OD et validée, clôture annuelle 2026 traversée au cas P15.

**Bilan du rejeu** · 282 comparaisons au centime, 273 concordantes, 9 écarts
répartis sur quatre cas (P07, P12, P13, P15). Douze cas sur quinze rendent
l'attendu en entier. Les constats corrigés et les décisions par la loi
codées, avec le rejeu qui les éprouve (323 comparaisons, 0 écart), sont à la
section « Après correction » en fin de document.

## Sources lues

Toutes dans les compétences installées, lues le 2026-10-07 avant d'écrire un
chiffre. Abréviations utilisées dans les tableaux :

| Abr. | Fichier | Contenu lu |
|---|---|---|
| [CT1] | `droit-travail-congolais/references/texte-loi-verbatim/01-titre-i-des-dispositions-generales.md` | Code du travail, art. 7, point 8 (rémunération, cinq exclusions) et point 9 (jour ouvrable) |
| [CT2] | `…/texte-loi-verbatim/02-titre-ii-de-la-formation-et-du-perfectionnement-professionnels.md` | art. 11 à 15 (INPP ; art. 15 b), cotisation « proportionnelle à la somme des rémunérations versées […] au cours du trimestre précédent ») |
| [CT4] | `…/texte-loi-verbatim/04-titre-iv-du-contrat-de-travail.md` | art. 62 à 72 (préavis, art. 63, 64, 65, 66, 67 ; faute lourde, art. 72) |
| [CT5] | `…/texte-loi-verbatim/05-titre-v-du-salaire.md` | art. 89, 103, 104, 112 (liste fermée des retenues), 114 (quotité) |
| [CT6] | `…/texte-loi-verbatim/06-titre-vi-des-conditions-generales-de-travail.md` | art. 138, 139 (logement), 140 à 145 (congé) |
| [OF] | `droit-travail-congolais/references/ordonnance-23-042-jours-feries.md` | ordonnance n° 23-042, art. 1er (dix fériés) et art. 2 (férié un dimanche, congé « pris le jour précédent ») |
| [D2522] | `droit-travail-congolais/references/smig-cotisations-textes-application/decret-25-22-2025-fixation-smig.md` | décret n° 25/22, art. 2, 3, 5, 6, 7 ; annexes 1 et 2 (grille, colonnes 19 et 20) |
| [D2521] | `…/smig-cotisations-textes-application/decret-25-21-2025-modalites-smig.md` | décret n° 25/21, art. 10, 11 (ajustement « à partir du mois de janvier »), 15 |
| [INPP] | `…/smig-cotisations-textes-application/arretes-inpp-taux-cotisation-2006-2025.md` | arrêtés INPP du 14 février 2006 et du 24 septembre 2025, art. 1er et 3 |
| [ONEM] | `onem-rdc/references/arrete-028-2025-contribution-patronale.md` | arrêté n° 028/2025, art. 1er (0,5 %), 10 ; taux antérieur 0,2 % |
| [D18041] | `cnss-cotisations-sociales-rdc/references/decret-18-041-2018-taux-cotisations-cnss.md` | décret n° 18/041, art. 2 à 5, 8 (plancher au SMIG), 10 |
| [L16009] | `cnss-cotisations-sociales-rdc/references/loi-16-009-2016-regime-general-securite-sociale.md` | loi n° 16/009, art. 13 (assiette, renvoi à l'art. 7 du Code), 16, 18, 19 |
| [AM146] | `cnss-cotisations-sociales-rdc/references/am-146-2018-affiliation-immatriculation-cotisations-liquidation-prestations.md` | arrêté n° 146/2018, art. 17 à 20 |
| [AM137] | `droit-travail-congolais/references/smig-cotisations-textes-application/arrete-137-2018-allocations-familiales.md` | arrêté n° 137/2018, art. 3 et 4 (8 100 FC servis par la Caisse) |
| [AR2005] | `droit-travail-congolais/references/logement-et-ration-alimentaire/arrete-12-110-2005-logement-contre-valeur.md` | arrêté n° 12/CAB.MIN/TPS/110/2005, art. 4 et 10 |
| [T3] | `fiscalite-rdc/code-general-2026/references/05-loi23-053-titre3-irpp.md` | loi n° 23/053, art. 68, 69, 70, 71, 116, 118, 119, 121 à 125 |
| [T47] | `fiscalite-rdc/code-general-2026/references/06-loi23-053-titre4-7-communes-autres-abrogatoires.md` | art. 150 (arrondis) |
| [AMIRPP] | `fiscalite-rdc-socle/references/am-2025-retenue-irpp-revenus-salariaux.md` | arrêté du 19 février 2025, art. 2 à 5 (calcul mensuel au barème de l'art. 118) |
| [AU1] | `audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md` | AUDCIF art. 20 (correction d'erreur), 22 (irréversibilité, date de valeur) |
| [AU4] | `audcif-acte-uniforme/references/titre-7-comptes-classe-4.md` | fiches des comptes 42 et 43 |
| [AU6] | `audcif-acte-uniforme/references/titre-7-comptes-classe-6.md` | fiches des comptes 64 et 66 |
| [SY] | `syscohada/comptes/references/plan-comptes.tsv` | 272, 2721 à 2728, 421, 4211, 422, 423, 4232, 431, 4311 à 4313, 432, 433, 4331, 4332, 4472, 641, 6413 à 6415, 661, 6611 à 6617, 663, 664, 6641, 781 |
| [SYG] | `syscohada/ecritures/references/partie-1-ch3-autres-operations-exploitation.md` | Guide, Partie 1 ch. 3, Application 10 (bulletin, charges patronales, avantage en nature) |
| [SB] | `sycebnl/references/partie2-ch2-plan-comptes.md` | SYCEBNL, comptes 42, 43 (« 432 Caisses de retraite (4321 obligatoire, …) »), 66, 78, 272 |
| [CPCC] | `droit-travail-congolais/references/decompte-final-calcul-pratique.md` | séminaire CPCC (« D/ 6641 · C/ 4331 INPP · C/ 4332 ONEM ») |

Rappel des règles lues, une fois pour toutes :

- **Assiette sociale** · la rémunération de l'art. 7, point 8 [CT1], « tel que
  prévu à l'article 7, litera h » (loi n° 16/009, art. 13 [L16009] ; arrêté
  n° 146/2018, art. 17 [AM146]) · soins de santé, logement ou son indemnité,
  allocations familiales légales, transport, frais de voyage n'en sont pas.
- **CNSS** · prestations aux familles 6,5 % (employeur), pensions 5 % + 5 %,
  risques professionnels 1,5 % (employeur) ; « En aucun cas, le montant des
  rémunérations servant de base de calcul des cotisations ne peut être
  inférieur au salaire minimum interprofessionnel garanti » (décret n° 18/041,
  art. 2 à 4 et 8 [D18041]).
- **INPP** · « cotisation mensuelle […] sur les rémunérations versées »,
  public 4 %, privé 3,5 % (1 à 50), 3 % (51 à 300), 2 % (plus de 300) depuis
  le 24 septembre 2025 ; 3 %, 3 %, 2 %, 1 % avant ; en vigueur à la signature
  (art. 1er et 3 [INPP]).
- **ONEM** · 0,5 % « de la rémunération mensuelle payée » depuis le 25
  septembre 2025, 0,2 % avant (art. 1er et 10 [ONEM]).
- **SMIG** · 21 500 FC par jour pour le manœuvre ordinaire (art. 2), payé
  14 500 FC de mai à décembre 2025 (art. 3), mois = 26 jours (art. 7) ;
  colonne 19 (allocation familiale par enfant et par jour) 796,30 FC en 2026,
  537,04 FC en 2025 ; colonne 20 (contre-valeur du logement) 159,26 FC
  [D2522].
- **IRPP** · base nette des retenues de l'art. 71 (« versements réellement
  effectués à titre définitif […] à des caisses de pension officielles »)
  [T3, art. 70, 71] ; barème de l'art. 118 « sur le revenu net global arrondi
  au millier de Francs congolais inférieur » (3 %, 15 %, 30 %, 40 %), « En
  aucun cas, l'impôt total ne peut excéder 30 % du revenu imposable » ;
  retenue mensuelle (art. 119 ; arrêté du 19 février 2025, art. 2 [AMIRPP]) ;
  réduction de 2 % par personne à charge, neuf au plus, « Aucune réduction
  n'est accordée sur l'impôt qui se rapporte à la partie du revenu imposable
  qui excède la troisième tranche » (art. 123) ; situation au 1er janvier
  (art. 125).
- **Immunités** · allocations familiales « dans la mesure où elles ne
  dépassent pas les taux légaux » (art. 69, 1) ; logement, transport, frais
  médicaux « pour autant que » (art. 69, 8, a à c) [T3].
- **Arrondi** · décimale à l'unité (première décimale ≥ 5 vers le haut), puis
  tranche ≥ 50 FC à la centaine supérieure, sinon inférieure (art. 150 [T47]).
- **Retenues** · liste fermée de l'art. 112 (avances, prêts, saisie-arrêt…)
  [CT5] ; quotité de l'art. 114 · un cinquième jusqu'à cinq fois le salaire
  mensuel minimum de la catégorie, un tiers au-delà, deux cinquièmes pour une
  obligation alimentaire, « après déduction des retenues fiscales et sociales
  et de l'évaluation forfaitaire du logement » [CT5] ; défalcation d'« 1/5 du
  taux journalier des allocations familiales » quand le logement est fourni en
  nature (arrêté de 2005, art. 10 [AR2005]).
- **Préavis et congé** · 14 jours ouvrables plus 7 par année entière (art. 64,
  al. 1), la moitié pour le travailleur (al. 2), le double pour un délégué
  sans être inférieur à trois mois (art. 258), aucun pour faute lourde
  (art. 72) ; indemnité = « la rémunération et [les] avantages de toute
  nature » du préavis non observé (art. 63, al. 3) ; congé d'un jour ouvrable
  par mois entier, plus un par tranche de cinq ans (art. 141), allocation sur
  la rémunération et la moyenne des douze mois (art. 142), indemnité
  compensatrice « quel que soit le moment » de la résiliation (art. 144)
  [CT4, CT6].
- **Passation** · 422 « crédité des rémunérations brutes […] par le débit des
  comptes de charges intéressés 66 », débité des cotisations salariales par
  le crédit du 43 ; 43 crédité de la part patronale par le débit du 664 et de
  la part salariale par le débit du 422 ; prêts au personnel au 272 (fiches
  des comptes 42 et 43 [AU4]) ; avantage en nature 6617 par le crédit du 781
  (Application 10 [SYG]) ; retraite obligatoire 4313 au SYSCOHADA [SY, AU4],
  4321 au SYCEBNL [SB].

Les montants s'entendent en francs congolais. Sauf mention, l'employeur est
privé, de trente travailleurs (INPP 3,5 %), le régime de la retenue est celui
de l'art. 118 déclaré, et le mois de paie est mars 2026 (annexe 2 du décret
n° 25/22).

---

## Synthèse

| Cas | Objet | Comparaisons | Écarts |
|---|---|---:|---:|
| P01 | salarié mensuel, sans avantage | 14 | 0 |
| P02 | personnes à charge | 12 | 0 |
| P03 | haut salaire, plafond de 30 % | 22 | 0 |
| P04 | indemnité de logement à 30 % et 40 % | 12 | 0 |
| P05 | transport et soins | 15 | 0 |
| P06 | avantages en nature | 12 | 0 |
| P07 | plancher CNSS | 25 | **3** |
| P08 | INPP et ONEM | 23 | 0 |
| P09 | salaire en dollars | 13 | 0 |
| P10 | avance et prêt | 15 | 0 |
| P11 | allocations familiales | 18 | 0 |
| P12 | quotité saisissable | 14 | **2** |
| P13 | décompte final | 29 | **1** |
| P14 | passation, deux bulletins, deux référentiels | 30 | 0 |
| P15 | clôture traversée, annulation en N+1, grille du cabinet | 25 | **3** |

Les constats sont classés dans la section finale « Constats ». En bref ·
deux MAJEURS (P07, P15), deux MINEURS (P12, P13), et une série de points que
le corpus ne tranche pas.

---

## Étape 1 · Hypothèses du code

Relevé de ce que le code prend pour une date, une base, un montant ou une
condition à la place de ce que dit le texte. Colonne « Dit ? » · si
l'utilisateur en est averti dans la réponse servie (réserve, abstention,
avertissement).

| # | Fichier:ligne | Ce que fait le code | Ce que dit le texte | Effet sur le montant | Dit ? |
|---|---|---|---|---|---|
| H1 | `bareme-irpp.ts` (`retenueMensuelle`) | Revenu du mois × 12, arrondi au millier sur l'année, barème, ÷ 12, arrondi de l'art. 150 sur la retenue du mois. | Art. 118 (barème annuel, arrondi au millier), art. 119 et arrêté du 19 février 2025, art. 2 (retenue mensuelle au barème), art. 150. Le passage du mois à l'année n'est pas écrit. | Convention, rejouée juste partout (P01 à P15). | Oui (réserve « MENSUALISATION ») |
| H2 | `cotisations-paie.ts:535` et `personnel.service.ts:1203-1204` | Quand la CNSS s'abstient (plancher non vérifiable), la quote-part ouvrière vaut zéro dans les retenues de l'art. 71, et l'impôt et le net se calculent quand même. | Art. 70 et 71 [T3] · la base est nette des versements « réellement effectués » à la caisse de pension ; la quote-part n'est pas chiffrée. | Simulation · IRPP 40 600 et net 359 400 affichés là où rien ne se chiffre (P07). | Pour la CNSS seulement, pas sur l'impôt ni le net · **constat C1** |
| H3 | `cotisations-paie.ts` (`plancherCnss`) | Base relevée au SMIG des jours payés pour TOUTES les branches, quote-part ouvrière comprise. | Décret n° 18/041, art. 8 · « le montant des rémunérations servant de base de calcul des cotisations ». | Juste (P07, P15). | Oui |
| H4 | `cotisations-paie.ts` (`plancherCnss`) | Mai à décembre 2025 · abstention quand l'assiette est entre 377 000 et 559 000 (SMIG payé contre fixé). | Décret n° 25/22, art. 2 et 3 ; décret n° 18/041, art. 8 ne dit pas lequel. | Aucun montant inventé (P07). | Oui (« PLANCHER NON TRANCHÉ ») |
| H5 | `cotisations-paie.ts:209-215` | Barème INPP et ONEM au MOIS · l'arrêté signé le 24 (ou 25) septembre 2025 vaut pour toute la paie de septembre. | Arrêtés en vigueur « à la date de [leur] signature » [INPP, ONEM] ; art. 15 b) du Code rapporte la cotisation aux rémunérations « versées au cours du trimestre précédent » [CT2]. | Septembre 2025 · 3,5 % au lieu de 3 % pour un privé de 50 (P08). | En commentaire de code seulement · voir « À trancher » T5 |
| H6 | `cotisations-paie.ts` (`RESERVE_ASSIETTE_INPP`) | INPP sur la rémunération du mois, au sens de l'art. 7. | Art. 15 b) · « proportionnelle à la somme des rémunérations versées […] au cours du trimestre précédent ». | Égal tant que la masse est stable. | Oui |
| H7 | `personnel.service.ts` (`tauxLegalAllocationsFamiliales`) | Taux légal de l'art. 69, 1 = colonne 19 × enfants bénéficiaires × 26 jours, sauf jours déclarés. | Décret n° 25/22, art. 5 et 7 ; art. 69, 1. | Juste (P11). | Oui |
| H8 | `assiettes-paie.ts` (`assiettes`) | Logement · CONDITION (tout ou rien) sur la rémunération de l'art. 7. | Art. 69, 8, a) · « pour autant que l'indemnité de logement ne dépasse 30 % de la rémunération ». | 183 100 au lieu de 138 100 si l'on lisait un plafond (P04). | Oui, avec le montant de l'autre lecture |
| H9 | `bareme-irpp.ts` (`impotAnnuel`) | Impôt plafonné · la quotité joue sur le plus petit de l'impôt de la part basse et de l'impôt plafonné. | Art. 118, al. 2 et art. 123, al. 2 ne disent pas comment répartir l'impôt plafonné. | Voir T2 (trois lectures, 2 216 800 à 2 225 600 par mois). | Oui (« LECTURE DE L'ÉDITEUR ») |
| H10 | `personnel.service.ts:1296` | La quotité ne défalque le logement que si la case `logementFourniEnNature` est cochée, même quand le bulletin porte un logement FOURNI EN NATURE. | Art. 114, al. 4 [CT5] ; arrêté de 2005, art. 10 [AR2005]. | Quotité surestimée de 828,15 par mois (P12 f). | Non · **constat C3** |
| H11 | `decompte-final.ts` (`congeLegal`) | La tranche d'ancienneté de l'art. 141 se prorate sur une année incomplète (10 mois · 10,8333 jours). | Art. 141 · « augmente d'un jour ouvrable par tranche de cinq années ». | 455 000 contre 462 000 si le jour entier était dû (P13). | Oui · voir T6 |
| H12 | `decompte-final.ts` (`decompteFinal`) | Moyenne des douze mois ramenée au jour par 26. | Art. 66, al. 3 et art. 142, al. 2 · « moyenne […] des douze mois précédents ». | Convention. | Oui |
| H13 | `decompte-final-emis.ts` (`RESERVE_VERSEMENT_UNIQUE`) | Le mois de cessation, indemnités comprises, est annualisé comme un bulletin. | Art. 68, 6°, 116, 119, 121 [T3] ; ni étalement ni taux distinct. | IRPP 628 500 sur le mois de cessation (P13). | Oui |
| H14 | `decompte-final-emis.ts` (`RESERVE_ASSIETTE_SOCIALE_INDEMNITE`) | L'indemnité de préavis reste dans l'assiette sociale. | Art. 7, point 8 ne la nomme ni ne l'exclut. | CNSS sur 2 646 000 (P13). | Oui |
| H15 | `decompte-final.ts:212-240` (`joursOuvrablesDeTroisMois`) | Le plancher de trois mois du délégué compte le samedi 16 mai 2026, veille du 17 mai (férié tombé un dimanche). | Ordonnance n° 23-042, art. 2 · « le congé relatif à ce jour est pris le jour précédent » [OF] ; art. 7, point 9 [CT1]. | 77 jours au lieu de 76 (P13). | Non · **constat C4** |
| H16 | `passation-paie.ts:158, 183, 189` | INPP et ONEM en charge au 6641 et en dette aux 4334 et 4335, deux subdivisions de 433 ouvertes par le logiciel. | Fiche du compte 66 · « Les impôts dont l'assiette repose sur la rémunération → 6413 » ; fiche du compte 64 et plan (6414, 6415) ; séminaire CPCC · 6641 [CPCC]. | Classement, pas montant. | En commentaire de code · voir T1 |
| H17 | `comptabilisation-paie.ts:171-176`, `comptabilisation-paie.service.ts:77-90` | Bulletin annulé après passation · rien n'est contre-passé, la paie du mois se passe quand même, une réserve le dit. | AUDCIF art. 20 et 22, 4° [AU1]. | 2027 surévalué de 600 000 (6611), 102 000 (6641), 503 900 (422) (P15). | Oui, mais avec le mauvais alinéa · **constat C2** |
| H18 | `conversion-usd.ts` (`usdEnFc`) | Conversion au cours du jour DU CALCUL à Kinshasa, arrondi au centime (demi-centime vers le haut). | Code du travail, art. 89 · « stipulée en monnaie ayant cours légal » ; aucun texte ne fixe le cours. | Juste au sens de la décision du cabinet (P09). | Oui (art. 89 rappelé) |

---

## Étapes 2 et 3 · Les cas

Chaque cas · données, calcul à la main, puis tableau « attendu (texte) ·
OmegaX · écart ». Les montants OmegaX sont ceux rendus par
`POST /personnel/simulation`, `POST /personnel/salaries/:id/bulletins`,
`POST /personnel/decompte-final`, `GET /personnel/paie-du-mois/:mois` et
`GET /ecritures/balance`. Un attendu `null` veut dire « non chiffré », jamais
zéro.

### P01 · Salarié mensuel en francs, sans avantage (SARL, mars 2026)

Données · salaire de base 1 000 100 ; contrat à durée indéterminée, classe 5.

| Ligne | Calcul | Texte |
|---|---|---|
| Assiette sociale | 1 000 100 | art. 7, point 8 ; loi n° 16/009, art. 13 |
| Plancher CNSS | 21 500 × 26 = 559 000 ≤ 1 000 100 · sans effet | décret n° 18/041, art. 8 ; décret n° 25/22, art. 2, 7 |
| CNSS employeur | 6,5 % = 65 006,50 ; 5 % = 50 005 ; 1,5 % = 15 001,50 | décret n° 18/041, art. 2 à 4 |
| CNSS ouvrière | 5 % = 50 005 | art. 3 |
| INPP (privé, 30) | 3,5 % = 35 003,50 | arrêté du 24 septembre 2025, art. 1er |
| ONEM | 0,5 % = 5 000,50 | arrêté n° 028/2025, art. 1er |
| Charge patronale | 130 013 + 35 003,50 + 5 000,50 = 170 017 | |
| Base fiscale nette | 1 000 100 − 50 005 = 950 095 | art. 70, 71 |
| Revenu annualisé | 950 095 × 12 = 11 401 140 → 11 401 000 | art. 118 (millier inférieur) |
| Barème | 3 % × 1 944 000 = 58 320 ; 15 % × 9 457 000 = 1 418 550 ; total 1 476 870 ; plafond 3 420 300 sans effet | art. 118 |
| Retenue du mois | 1 476 870 ÷ 12 = 123 072,50 → 123 073 → tranche 73 ≥ 50 → **123 100** | art. 119, 150 |
| Net | 1 000 100 − 50 005 − 123 100 = **826 995** | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Cotisations (cinq lignes, total patronal) | ci-dessus ; 170 017 | identiques ; 170 017 | 0 |
| Base nette, annualisé arrondi, impôt annuel | 950 095 ; 11 401 000 ; 1 476 870 | idem | 0 |
| Retenue avant arrondi, retenue | 123 072,50 ; 123 100 | idem | 0 |
| Net (simulé et émis, bulletin n° 1) | 826 995 | 826 995 | 0 |
| Passation proposée | D 6611 / C 422 1 000 100 ; D 422 173 105 / C 4313 50 005, C 4472 123 100 ; D 6641 170 017 / C 4311, 4313, 4312, 4334, 4335 | idem | 0 |

Conforme.

### P02 · Personnes à charge (art. 123 à 125)

Données · P01, registre · un conjoint et deux enfants.

| Ligne | Calcul | Texte |
|---|---|---|
| Proposition du registre | 1 + 2 = 3 · proposée, le cabinet décide (art. 124, ressources des enfants ; art. 125, 1er janvier) | art. 124, 125 |
| Sans déclaration | 0 personne · 123 100 | |
| Trois déclarées | 6 % × 1 476 870 = 88 612,20 ; 1 388 257,80 ÷ 12 = 115 688,15 → 115 688 → tranche 88 → **115 700** ; net 834 395 | art. 123, 150 |
| Onze déclarées | ramenées à neuf · 18 % = 265 836,60 ; 1 211 033,40 ÷ 12 = 100 919,45 → **100 900** ; net 849 195 | art. 123 (« maximum de 9 ») |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Proposition ; retenues sans déclaration ; IRPP | 3 ; 0 ; 123 100 | 3 ; 0 ; 123 100 | 0 |
| Trois · réduction, impôt annuel, retenue, net | 88 612,20 ; 1 388 257,80 ; 115 700 ; 834 395 | idem | 0 |
| Onze · réduction, impôt annuel, retenue, net | 265 836,60 ; 1 211 033,40 ; 100 900 ; 849 195 | idem | 0 |

Conforme.

### P03 · Haut salaire · plafond de 30 % (art. 118) et quotité (art. 123)

Données · salaire 8 000 000 ; puis 6 836 000 et 6 837 000 de part et d'autre
du seuil de 77 932 800 annuels.

| Ligne | Calcul | Texte |
|---|---|---|
| Base nette | 8 000 000 − 400 000 = 7 600 000 ; × 12 = 91 200 000 | art. 70, 71, 118 |
| Barème | 9 486 720 (jusqu'à 43 200 000) + 40 % × 48 000 000 = 28 686 720 | art. 118 |
| Plafond | 30 % × 91 200 000 = 27 360 000 < 28 686 720 · il joue | art. 118, al. 2 |
| Retenue ; net | 2 280 000 ; 5 320 000 | art. 119, 150 |
| Quatre personnes | quotité 8 % sur l'impôt de la part basse 9 486 720 (lecture du code) = 758 937,60 ; 26 601 062,40 ÷ 12 = 2 216 755,20 → **2 216 800** ; net 5 383 200 | art. 123, al. 2 |
| Sous le seuil | 6 836 000 → 6 494 200 × 12 = 77 930 400 → 77 930 000 ; barème 23 378 720 ≤ plafond 23 379 000 · **1 948 200** | art. 118 |
| Sur le seuil | 6 837 000 → 77 941 800 → 77 941 000 ; barème 23 383 120 > plafond 23 382 300 · 1 948 525 → **1 948 500** | art. 118, 150 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Barème, plafond, retenue, net | 28 686 720 ; 27 360 000 (joue) ; 2 280 000 ; 5 320 000 | idem | 0 |
| Quatre personnes · base de la quotité, réduction, retenue | 9 486 720 ; 758 937,60 ; 2 216 800 | idem | 0 |
| Seuil · en dessous, au-dessus | plafond non ; 1 948 200 · plafond oui ; 1 948 500 | idem | 0 |

Conforme. La quotité sur un impôt plafonné reste à trancher (T2).

### P04 · Indemnité de logement · 30 % et 40 % (art. 69, 8, a)

Données · salaire 1 000 000 ; indemnité de logement 300 000 (30 %), puis
400 000 (40 %).

| Ligne | Calcul | Texte |
|---|---|---|
| Assiette sociale | 1 000 000 (logement hors rémunération) ; CNSS ouvrière 50 000 | art. 7, point 8 |
| 30 % | 300 000 ≤ 30 % × 1 000 000 · immunisé ; base nette 950 000 → 11 400 000 → 1 476 720 → 123 060 → **123 100** ; net 1 300 000 − 50 000 − 123 100 = **1 126 900** | art. 69, 8, a ; 118 ; 150 |
| 40 % | 400 000 > 300 000 · « pour autant que » non rempli, le montant ENTIER est imposable ; base nette 1 350 000 → 16 200 000 → 2 196 720 → **183 100** ; net **1 166 900** | art. 69, 8, a |
| Autre lecture (plafond) | seul l'excédent de 100 000 imposable · base 1 050 000 → **138 100** (net 1 211 900) | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| 30 % · assiette sociale, base fiscale brute, retenue, net | 1 000 000 ; 1 000 000 ; 123 100 ; 1 126 900 | idem | 0 |
| 40 % · base brute, base nette, retenue, net | 1 400 000 ; 1 350 000 ; 183 100 ; 1 166 900 | idem | 0 |
| Autre lecture nommée avec son montant | « seul l'excédent de 100000.00 FC » | dite | 0 |

Conforme. Condition ou plafond · voir T3.

### P05 · Transport et soins (art. 69, 8, b et c)

Données · salaire 1 000 000 ; transport 100 000 ; frais médicaux 50 000.

| Ligne | Calcul | Texte |
|---|---|---|
| Non attestés | la réalité du transport et le justificatif médical ne sont dans aucun livre · ni immunisés ni imposés · base fiscale, impôt et net **non chiffrés** ; émission refusée | art. 69, 8, b et c |
| Attestés | immunisés · base nette 950 000 → **123 100** ; net 1 150 000 − 50 000 − 123 100 = **976 900** | art. 69, 8 |
| Non remplis | imposés · base nette 1 100 000 → 13 200 000 → 1 746 720 → **145 600** ; net **954 400** | art. 68 |
| Transport seul, attesté | **123 100** ; net 926 900 | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Non attestés · assiette sociale, CNSS ouvrière, base fiscale, impôt, net ; émission | 1 000 000 ; 50 000 ; null ; null ; null ; refus | idem ; 400 nommé | 0 |
| Attestés · base, impôt, net | 1 000 000 ; 123 100 ; 976 900 | idem | 0 |
| Non remplis · base, impôt, net | 1 150 000 ; 145 600 ; 954 400 | idem | 0 |
| Transport seul · impôt, net | 123 100 ; 926 900 | idem | 0 |

Conforme. Les frais médicaux bloquent la passation (aucune fiche ne nomme
leur compte), ce qu'OmegaX dit (`NATURE_SANS_IMPUTATION`).

### P06 · Avantages en nature · logement fourni et véhicule

Données · salaire 1 000 000 ; logement fourni en nature 250 000 ; usage privé
d'un véhicule 200 000 (avantage en nature).

| Ligne | Calcul | Texte |
|---|---|---|
| Assiette sociale | 1 000 000 + 200 000 = 1 200 000 (le logement en nature en est exclu, pas le véhicule) | art. 7, point 8 |
| CNSS ouvrière ; charge patronale | 60 000 ; 13 % × 1 200 000 + 3,5 % + 0,5 % = 156 000 + 42 000 + 6 000 = 204 000 | |
| Logement | 250 000 ≤ 30 % × 1 200 000 = 360 000 · immunisé | art. 69, 8, a |
| Base fiscale | 1 200 000 (« avantages en nature comptés pour leur valeur réelle ») − 60 000 = 1 140 000 → 13 680 000 → 1 818 720 → **151 600** | art. 68, 70, 71 |
| Net | versé 1 000 000 − 60 000 − 151 600 = **788 400** | |
| Passation | D 6611 / C 422 1 000 000 ; D 422 211 600 ; quatrième temps D 6617 / C 781 450 000 | Application 10 ; fiche du compte 66 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Assiette sociale, CNSS ouvrière, charge patronale | 1 200 000 ; 60 000 ; 204 000 | idem | 0 |
| Base brute, base nette, retenue, versé, net | 1 200 000 ; 1 140 000 ; 151 600 ; 1 000 000 ; 788 400 | idem | 0 |
| 6617 D, 781 C, 422 C du seul versé ; net émis | 450 000 ; 450 000 ; 1 000 000 ; 788 400 | idem | 0 |

Conforme.

### P07 · Plancher CNSS au SMIG du manœuvre (décret n° 18/041, art. 8)

Données · salaire 400 000, classe 1 (minimum 21 500 × 26 = 559 000).

| Ligne | Calcul | Texte |
|---|---|---|
| (a) mars 2026, 26 jours payés déclarés | base relevée à 559 000 · ouvrière 27 950 ; familles 36 335 ; risques 8 385 ; INPP et ONEM sur 400 000 (14 000 ; 2 000, aucun plancher) ; base fiscale 400 000 − 27 950 = 372 050 → 4 464 000 → 436 320 → 36 360 → **36 400** ; net **335 650** | décret n° 18/041, art. 8 ; art. 71 |
| (b) mars 2026, jours payés NON déclarés | 400 000 sous le plancher d'un mois entier · le mois est-il incomplet ? La base ne se fixe pas · quote-part ouvrière **non chiffrée**, donc base fiscale nette, impôt et net **non chiffrés** | art. 70, 71 (la base fiscale est nette des versements « réellement effectués ») |
| (c) avril 2026, 13 jours, 250 000 | plancher 21 500 × 13 = 279 500 · ouvrière 13 975 ; base 236 025 → 2 832 000 → 191 520 → 15 960 → **16 000** ; net **220 025** | |
| (d) novembre 2025, 400 000 | entre 377 000 (SMIG payé) et 559 000 (SMIG fixé) · le corpus ne dit pas lequel fait le plancher · CNSS non chiffrée ; impôt hors barème avant 2026 | décret n° 25/22, art. 2, 3 |
| (e) novembre 2025, 600 000 | au-dessus des deux · ouvrière 30 000 ; INPP 3,5 % = 21 000 ; ONEM 0,5 % = 3 000 | |
| Contrat | 400 000 par mois en classe 1 < 559 000 · non conforme au minimum | décret n° 25/22, art. 2, 7 ; Code, art. 37 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| (a) base, ouvrière, familles, risques, INPP, ONEM | 559 000 ; 27 950 ; 36 335 ; 8 385 ; 14 000 ; 2 000 | idem | 0 |
| (a) base nette, retenue, net | 372 050 ; 36 400 ; 335 650 | idem | 0 |
| (b) CNSS ouvrière | null | null (abstention nommée) | 0 |
| (b) base fiscale nette | null | **400 000** | **écart** |
| (b) retenue IRPP | null | **40 600** | **écart** |
| (b) net | null | **359 400** | **écart** |
| (b) émission | refusée | 400, « Cotisation non chiffrée · CNSS · ASSIETTE SOUS LE PLANCHER » | 0 |
| (c) base, ouvrière, retenue, net | 279 500 ; 13 975 ; 16 000 ; 220 025 | idem | 0 |
| (d) ouvrière, retenue, net | null ; null ; null | idem (« PLANCHER NON TRANCHÉ ») | 0 |
| (e) base, ouvrière, INPP, ONEM, retenue | 600 000 ; 30 000 ; 21 000 ; 3 000 ; null | idem | 0 |
| Contrat sous le minimum (confrontation du registre) | non conforme | `conforme: false` | 0 |

Écart (b) · **constat C1**. La simulation chiffre l'impôt sans la quote-part
ouvrière, que la CNSS en abstention n'a pas chiffrée, et un net qui n'en
retient aucune. Les deux sont faux (l'impôt de la lecture « mois entier »
serait 36 400 et le net 335 650 ; sur un mois incomplet, autre chose encore).
Le bulletin, lui, n'est pas émis, et la quotité s'abstient bien
(`COTISATION_NON_CHIFFREE`).

### P08 · INPP et ONEM · nature, tranches, dates

Données · rémunération 1 000 000, simulations sans salarié.

| Mois | Nature, effectif | INPP attendu | ONEM attendu | Texte |
|---|---|---:|---:|---|
| 2026-03 | public, 10 | 4 % = 40 000 | 0,5 % = 5 000 | arrêté 2025, art. 1er, 1° |
| 2026-03 | privé, 50 | 3,5 % = 35 000 | 5 000 | art. 1er, 2°, a |
| 2026-03 | privé, 51 ; 300 | 3 % = 30 000 | 5 000 | art. 1er, 2°, b |
| 2026-03 | privé, 301 | 2 % = 20 000 | 5 000 | art. 1er, 2°, c |
| 2025-08 | public, 10 | 3 % = 30 000 | 0,2 % = 2 000 | arrêté 2006, art. 1er ; ONEM 2018 |
| 2025-08 | privé, 50 ; 51 ; 301 | 30 000 ; 20 000 ; 10 000 | 2 000 | arrêté 2006, art. 1er |
| 2025-09 | privé, 50 | 35 000 (barème de 2025 pour tout le mois, voir T5) | 5 000 | arrêtés en vigueur à la signature |
| 2026-03 | privé, sans effectif | non chiffré | | « OmegaX ne choisit pas de tranche » |
| 2026-03 | sans nature | non chiffré ; net inchangé 826 900 (l'INPP est patronal) | | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Les dix lignes du tableau, INPP et ONEM | ci-dessus | identiques | 0 |
| Sans effectif ; sans nature | null ; null (abstentions nommées) | idem | 0 |
| Net sans nature | 826 900 | 826 900 | 0 |

Conforme. Le public est taxé à 4 % quel que soit l'effectif.

### P09 · Salaire stipulé en dollars (cours du jour de Kinshasa)

Données · 500 USD de salaire et 120,50 USD de prime ; cours coté le
2026-10-07 · 2 850,25 FC (cours de la veille, 2 800, coté aussi).

| Ligne | Calcul | Texte |
|---|---|---|
| Sans cours du jour | refus nommé ; le cours de la veille n'est pas repris | décision du cabinet (2026-09-24), art. 89 rappelé |
| Conversion | 500 × 2 850,25 = 1 425 125,00 ; 120,50 × 2 850,25 = 343 455,125 → 343 455,13 (demi-centime vers le haut) ; total 1 768 580,13 | aucun texte · voir T8 |
| Cotisations | ouvrière 88 429,0065 ; patronal 300 658,6221 | décret n° 18/041 ; arrêtés |
| Base fiscale | 1 680 151,1235 × 12 = 20 161 813,48 → 20 161 000 ; 58 320 + 15 % × 18 217 000 = 2 790 870 ; ÷ 12 = 232 572,50 → 232 573 → **232 600** | art. 118, 150 |
| Net | 1 768 580,13 − 88 429,0065 − 232 600 = 1 447 551,1235 → émis **1 447 551,12** | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Refus sans cours ; refus avec la seule veille | refus ; refus | 400 ; 400 | 0 |
| Cours, date, prime convertie | 2 850,25 ; 2026-10-07 ; 343 455,13 | idem | 0 |
| Assiette, ouvrière, patronal, base nette, annualisé | 1 768 580,13 ; 88 429,01 ; 300 658,62 ; 1 680 151,12 ; 20 161 000 | idem | 0 |
| Retenue ; net simulé ; net émis | 232 600 ; 1 447 551,12 ; 1 447 551,12 | idem | 0 |

Conforme.

### P10 · Avance (4211) et prêt (2728), art. 112, c et f

Données · salaire 1 000 000 ; avance de 300 000 (10 février 2026) ; prêt
« autre » de 1 200 000 (15 janvier 2026).

| Ligne | Calcul | Texte |
|---|---|---|
| Mars · retenues 100 000 (avance) et 200 000 (prêt) | impôt 123 100 ; net 1 000 000 − 50 000 − 123 100 − 300 000 = **526 900** | art. 112, c et f |
| Passation des retenues | D 422 473 100 ; C 4313 50 000, C 4472 123 100, C 4211 100 000, C 2728 200 000 | fiche du compte 42 (prêts au 272) |
| Soldes après mars | avance 200 000 ; prêt 1 000 000 | |
| Avril · 250 000 sur l'avance | refus · au-delà du solde, ce serait une réduction de rémunération | art. 112 |
| Avril · 200 000 et 200 000 | net 426 900 ; soldes 0 et 800 000 | |
| Avril annulé | soldes rendus · 200 000 et 1 000 000 | |
| Mai · 1 000 000 sur le prêt | net négatif · refus | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Mars · retenue, net simulé, net émis ; lignes 422, 4211, 2728 | 123 100 ; 526 900 ; 526 900 ; présentes | idem | 0 |
| Soldes après mars, après avril, après annulation | 200 000 / 1 000 000 ; 0 / 800 000 ; 200 000 / 1 000 000 | idem | 0 |
| Retenue au-delà du solde ; net négatif | refus ; refus | 400 ; 400 | 0 |

Conforme.

### P11 · Allocations familiales · colonne 19 et art. 69, 1

Données · salaire 1 000 000 ; allocations familiales versées par l'employeur
70 000 ; trois enfants bénéficiaires.

| Ligne | Calcul | Texte |
|---|---|---|
| Taux légal du mois | 796,30 × 3 × 26 = **62 111,40** (non les 8 100 FC servis par la Caisse) | décret n° 25/22, art. 5, 7 ; arrêté n° 137/2018, art. 3 et 4 |
| Excédent imposable | 70 000 − 62 111,40 = 7 888,60 | art. 69, 1 (« dans la mesure où ») |
| Base | 1 007 888,60 − 50 000 = 957 888,60 → 11 494 000 → 1 490 820 → 124 235 → **124 200** ; net 1 070 000 − 50 000 − 124 200 = **895 800** | art. 118, 150 |
| Vingt jours déclarés | 796,30 × 3 × 20 = 47 778 ; excédent 22 222 → **126 400** ; net 893 600 | |
| Allocation au taux exact | 62 111,40 · immunisée en entier · 123 100 ; net 889 011,40 | |
| Enfants non déclarés | plafond non chiffrable · base fiscale, impôt, net non chiffrés | |
| Novembre 2025 | 537,04 × 3 × 26 = 41 889,12 | annexe 1 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Taux légal, base brute, retenue, versé, net | 62 111,40 ; 1 007 888,60 ; 124 200 ; 1 070 000 ; 895 800 | idem | 0 |
| Vingt jours · taux, base, retenue, net | 47 778 ; 1 022 222 ; 126 400 ; 893 600 | idem | 0 |
| Taux exact · base, retenue, net | 1 000 000 ; 123 100 ; 889 011,40 | idem | 0 |
| Sans enfants · taux, base, retenue, net | null partout | idem | 0 |
| Annexe 1 ; passation refusée (aucune fiche ne nomme le compte) | 41 889,12 ; refus | idem | 0 |

Conforme.

### P12 · Quotité saisissable (art. 114), logement en nature défalqué

Données · mars 2026 ; (a) salaire 1 000 000, classe 5 (38 270 par jour),
logement fourni en nature.

| Ligne | Calcul | Texte |
|---|---|---|
| Forfait logement | 159,26 × 26 = 4 140,76 (colonne 20 = 796,30 ÷ 5) | arrêté de 2005, art. 10 ; décret n° 25/22, art. 6, 7 |
| (a) base | 1 000 000 − 123 100 − 50 000 − 4 140,76 = **822 759,24** | art. 114, al. 4 |
| (a) seuil | 5 × 26 × 38 270 = 4 975 100 · base en dessous | art. 114, al. 1 |
| (a) quotité | 822 759,24 ÷ 5 = **164 551,85** | |
| (b) obligation alimentaire | 2/5 = 329 103,70 ; cumul 493 655,54 (al. 3) | art. 114, al. 2 et 3 |
| (c) défalcation déjà opérée sur la paie | base 826 900 ; quotité 165 380 | arrêté de 2005, art. 10 (« il peut ») |
| (d) 4 000 000, classe 1, logement en nature | impôt 870 600 ; base 4 000 000 − 870 600 − 200 000 − 4 140,76 = 2 925 259,24 ; seuil 5 × 26 × 21 500 = 2 795 000 ; quotité 559 000 + 130 259,24 ÷ 3 = **602 419,75** | art. 114, al. 1 |
| (e) sans classe | non chiffrée | |
| (f) logement porté SUR LE BULLETIN comme fourni en nature (250 000), case de l'art. 114 non cochée | le logement EST fourni en nature · base **822 759,24**, forfait 4 140,76 | art. 114, al. 4 ; arrêté de 2005, art. 10 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| (a) forfait, base, seuil, quotité | 4 140,76 ; 822 759,24 ; 4 975 100 ; 164 551,85 | idem | 0 |
| (b) alimentaire, cumul | 329 103,70 ; 493 655,54 | idem | 0 |
| (c) base, quotité | 826 900 ; 165 380 | idem | 0 |
| (d) base, seuil, quotité | 2 925 259,24 ; 2 795 000 ; 602 419,75 | idem | 0 |
| (e) quotité | null | null | 0 |
| (f) forfait défalqué | 4 140,76 | **0** | **écart** |
| (f) base | 822 759,24 | **826 900** | **écart · quotité 165 380 au lieu de 164 551,85 (+ 828,15)** |

Écart (f) · **constat C3**.

### P13 · Décompte final

Données · contrat à durée indéterminée du 1er mars 2019 ; taux journalier
40 000 (1 040 000 par mois) ; moyenne des douze mois (primes, commissions)
52 000 par mois, soit 2 000 par jour (÷ 26, convention) ; ancienneté 7 ans ;
10 mois non couverts par un congé ; arriérés de mai 120 000 ; gratification
déclarée 0 ; aucun enfant.

| Ligne | Calcul | Texte |
|---|---|---|
| Préavis de l'employeur | 14 + 7 × 7 = **63** jours ouvrables (plancher) | art. 64, al. 1 |
| Licenciement, préavis dispensé | 63 × (40 000 + 2 000) = **2 646 000** | art. 63, al. 3 ; art. 66, al. 3 |
| Congé | 10 × 1 + 1 × 10/12 = 10,8333 jours ; × 42 000 = **455 000** | art. 141, 142, 144 |
| Total dû | 120 000 + 2 646 000 + 455 000 = **3 221 000** | art. 103 |
| Démission, préavis presté | préavis 31,5 jours, indemnité 0 ; total 575 000 | art. 64, al. 2 |
| Démission, préavis non observé | dû PAR le travailleur 31,5 × 42 000 = 1 323 000, ni retenu ni compté (art. 112) ; total dû au travailleur 575 000 | art. 63, al. 3 ; art. 112 |
| Faute lourde | aucun préavis ; congé dû « quel que soit le moment » ; total 575 000 | art. 72, 144 |
| Délégué, 7 ans | double 126 > trois mois · 126 jours ; 5 292 000 | art. 258 |
| Délégué, 3 ans | double 70 < trois mois · du 5 mai au 4 août 2026 · 92 jours − 13 dimanches − 30 juin − 1er août = 77 ; le 17 mai, férié, est un dimanche, son congé « est pris le jour précédent », samedi 16 mai · **76** | art. 258 ; art. 7, point 9 ; ordonnance n° 23-042, art. 1er et 2 |
| Émission | le bulletin de mai (120 000, 3 jours payés, net 110 600) doit être annulé d'abord · un seul document actif | décision de Manasse du 2026-10-02 |
| Paie du mois de cessation | assiette 3 221 000 ; ouvrière 161 050 ; patronal 547 570 ; base 3 059 950 → 36 719 000 → 58 320 + 2 948 400 + 30 % × 15 119 000 = 7 542 420 → 628 535 → **628 500** ; net **2 431 450** | art. 68, 6° ; 118 ; 150 |
| Passation | D 6611 120 000, D 6613 455 000, D 6614 2 646 000 / C 422 3 221 000 | fiche du compte 66 (6614) |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Licenciement · jours, congé (jours), préavis, congé, arriérés, total | 63 ; 10,83 ; 2 646 000 ; 455 000 ; 120 000 ; 3 221 000 | idem | 0 |
| Démission prestée · jours, préavis, congé, total | 31,5 ; 0 ; 455 000 ; 575 000 | idem | 0 |
| Démission non observée · dû par le travailleur, total | 1 323 000 ; 575 000 | idem | 0 |
| Faute lourde · préavis, congé, total | 0 ; 455 000 ; 575 000 | idem | 0 |
| Délégué 7 ans · jours, préavis | 126 ; 5 292 000 | idem | 0 |
| Délégué 3 ans · jours | 76 | **77** | **écart · 42 000 en faveur du travailleur** |
| Décompte refusé tant que le bulletin de mai est actif ; émis ensuite | refus ; émis | 400 ; 201 (`DECOMPTE_FINAL`) | 0 |
| Mois de cessation · assiette, ouvrière, patronal, base, annualisé, retenue, net | 3 221 000 ; 161 050 ; 547 570 ; 3 059 950 ; 36 719 000 ; 628 500 ; 2 431 450 | idem | 0 |
| Passation · 6614 et 6613 | 2 646 000 ; 455 000 | idem | 0 |

Écart du délégué de trois ans · **constat C4**. Le reste est conforme ;
l'impôt du mois de cessation (628 500 contre 3 400 pour le bulletin de mai
qu'il remplace) vient de l'annualisation du versement unique, dite (H13).

### P14 · Passation en trois temps, deux bulletins impairs, deux référentiels

Données · avril 2026 ; A · 1 234 567,89 ; B · 987 654,32 ; un dossier
SYSCOHADA (SARL), un dossier SYCEBNL (associations) ; paie passée au journal
OD le 30 avril, validée.

| Ligne | A | B | Texte |
|---|---|---|---|
| Familles 6,5 % | 80 246,91285 → 80 246,91 | 64 197,5308 → 64 197,53 | |
| Pensions 5 % (chaque part) | 61 728,3945 → 61 728,39 | 49 382,716 → 49 382,72 | |
| Risques 1,5 % | 18 518,51835 → 18 518,52 | 14 814,8148 → 14 814,81 | |
| INPP 3,5 % ; ONEM 0,5 % | 43 209,88 ; 6 172,84 | 34 567,90 ; 4 938,27 | |
| Base nette, annualisé | 1 172 839,4955 → 14 074 000 | 938 271,604 → 11 259 000 | art. 118 |
| Impôt annuel ÷ 12 | 1 877 820 → 156 485 → **156 500** | 1 455 570 → 121 297,50 → 121 298 → **121 300** | art. 150 |
| Net | 1 016 339,4955 → **1 016 339,50** | 816 971,604 → **816 971,60** | |

Écriture du mois (somme des lignes arrondies) · D 6611 2 222 222,21 / C 422
2 222 222,21 ; D 422 388 911,11 / C retraite 111 111,11, C 4472 277 800 ;
D 6641 377 777,77 / C 4311 144 444,44, C 4312 33 333,33, C retraite
111 111,11, C 4334 77 777,78, C 4335 11 111,11. Le 422 solde à
2 222 222,21 − 388 911,11 = **1 833 311,10**, la somme des deux nets
figés. La retraite obligatoire est au **43130000** au SYSCOHADA (4313
« Caisse de retraite obligatoire », sous 431) et au **43210000** au SYCEBNL
(« 432 Caisses de retraite (4321 obligatoire, …) ») [SY, AU4, SB].

| Grandeur (à la balance, débit moins crédit) | Attendu | OmegaX SYSCOHADA | OmegaX SYCEBNL | Écart |
|---|---|---|---|---|
| Nets A et B ; IRPP A et B | 1 016 339,50 ; 816 971,60 ; 156 500 ; 121 300 | idem | idem | 0 |
| 6611 ; 6641 | 2 222 222,21 ; 377 777,77 | idem | idem | 0 |
| 4311 ; 4312 | −144 444,44 ; −33 333,33 | idem | idem | 0 |
| Retraite obligatoire (4313 ou 4321), parts ouvrière et patronale | −222 222,22 | 43130000 · −222 222,22 | 43210000 · −222 222,22 | 0 |
| 4334 ; 4335 ; 4472 | −77 777,78 ; −11 111,11 ; −277 800 | idem | idem | 0 |
| 422 · soldé au net, au centime | −1 833 311,10 | idem | idem | 0 |

Conforme dans les deux référentiels, sans écart d'arrondi.

### P15 · Paie traversant la clôture

Données · SARL ; A · 1 000 100 (P01) ; B · 600 000, classe 1, 26 jours
payés ; grille SMIG du cabinet déclarée à partir de janvier 2027 · 25 000 FC
par jour (hypothétique, « arrêté du cas chiffré ») ; exercices 2026 et 2027.

| Étape | Calcul | Texte |
|---|---|---|
| Décembre 2026 | A · net 826 995 (P01). B · base 600 000 (≥ 559 000), ouvrière 30 000, base 570 000 → 6 840 000 → 792 720 → 66 060 → 66 100 ; net 503 900 ; patronal 13 % + 3,5 % + 0,5 % = 102 000 | |
| Passée le 31 décembre, validée | 6611 1 600 100 ; 6641 272 017 ; 422 −1 330 895 ; 4313 −(80 005 + 80 005) = −160 010 ; 4472 −189 200 | fiches 42, 43 |
| Clôture 2026, à-nouveau 2027 | 422 −1 330 895 ; 4313 −160 010 ; 4311 −104 006,50 ; 4334 −56 003,50 ; 4472 −189 200 ; 6611 soldé | AUDCIF art. 34 |
| Paiement le 5 janvier 2027 | D 422 / C 5211 1 330 895 · 422 à zéro | fiche du compte 42 |
| Janvier 2027, B | grille du cabinet · plancher 25 000 × 26 = 650 000 · ouvrière 32 500 ; base 567 500 → 6 810 000 → 788 220 → 65 685 → **65 700** ; net **501 800** | décret n° 18/041, art. 8 ; décret n° 25/21, art. 10, 11 |
| Retrait de la grille | refusé · deux bulletins de janvier calculés avec elle | |
| Bulletin de décembre de B annulé en janvier 2027 (salaire erroné, 620 000) puis réémis | net 620 000 − 31 000 − 68 900 = 520 100 ; patronal 105 400 | |
| Correction | l'erreur est d'un exercice CLOS · seule la DIFFÉRENCE pèse sur 2027 · 6611 + 20 000 ; 6641 + 3 400 ; 422 + 16 200 (520 100 − 503 900 déjà payés), l'ancien bulletin étant inscrit en négatif ; si l'erreur était significative, par le report à nouveau | AUDCIF art. 20, al. 1 à 3 ; art. 22, 4° |
| Fin janvier 2027, paie de janvier passée | 422 · −(1 328 795 + 16 200) = −1 344 995 ; 6611 · 1 600 100 + 20 000 = 1 620 100 ; 6641 · 278 517 + 3 400 = 281 917 | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Décembre · nets A et B | 826 995 ; 503 900 | idem | 0 |
| 2026 · 6611, 6641, 422, 4313, 4472 | 1 600 100 ; 272 017 ; −1 330 895 ; −160 010 ; −189 200 | idem | 0 |
| Clôture 2026 | acceptée | 201 | 0 |
| 2027 · à-nouveau 422, 4313, 4311, 4334, 4472 ; 6611 | −1 330 895 ; −160 010 ; −104 006,50 ; −56 003,50 ; −189 200 ; 0 | idem | 0 |
| 2027 · 422 après paiement | 0 | 0 | 0 |
| Janvier · net A ; B · base CNSS, retenue, net | 826 995 ; 650 000 ; 65 700 ; 501 800 | idem | 0 |
| Retrait de la grille | refusé | 400 nommé | 0 |
| Décembre B réémis · net ; passation dans 2026 (clos) | 520 100 ; refusée | 520 100 ; 403 | 0 |
| 2027 · 422 | −1 344 995 | **−1 848 895** | **−503 900 (le net de l'ancien bulletin, déjà payé)** |
| 2027 · 6611 | 1 620 100 | **2 220 100** | **+600 000 (l'ancien salaire, déjà en charge de 2026)** |
| 2027 · 6641 | 281 917 | **383 917** | **+102 000 (l'ancienne charge patronale)** |

Écarts · **constat C2**. Tout ce qui traverse la clôture concorde (422 et 43
repris à l'à-nouveau, paiement, grille du cabinet, retrait refusé) ; le
défaut est dans l'annulation après passation.

---

## À trancher · le corpus ne dit pas

| # | Question | Ce qui a été lu | Effet chiffré |
|---|---|---|---|
| T1 | INPP et ONEM · charge sociale (6641, ce que fait OmegaX, comme le séminaire CPCC) ou impôt et taxe (641 · 6413 « Taxes sur appointements et salaires », 6414 « Taxes d'apprentissage », 6415 « Formation professionnelle continue ») ? Et quelle dette, aucun des deux plans n'ouvrant 4334 ni 4335 ? | Fiche du compte 66 · « Exclusions. Les impôts dont l'assiette repose sur la rémunération → 6413 » ; fiche du compte 64 · « versements institués par les autorités pour le financement d'actions d'intérêt général » [AU6] ; arrêté INPP · « cotisation » ; arrêté ONEM · « contribution patronale » ; séminaire CPCC · D 6641, C 4331 et 4332 (comptes de mutuelle et d'assurances retraite, faux) [CPCC] ; plans [SY, SB] · 433 ouvre 4331 à 4333 seulement. | Classement de 3,5 % et 0,5 % de la masse (P14 · 88 888,89 sur deux salariés). Le total des charges ne change pas, la cascade des soldes de gestion si (charges de personnel contre impôts et taxes). |
| T2 | Art. 123 sur un impôt PLAFONNÉ · quelle part « se rapporte » à la tranche au-delà de 43 200 000 ? | Art. 118, al. 2 et art. 123, al. 2 [T3] · aucune clé. | P03, quatre personnes · OmegaX (plus petit des deux montants, 9 486 720) **2 216 800** ; impôt plafonné moins la part à 40 % (8 160 000) **2 225 600** ; prorata (9 047 972,69) **2 219 700**. |
| T3 | Art. 69, 8, a · condition (tout ou rien) ou plafond ? | « pour autant que » contre « dans la limite de » (art. 116, 1) [T3]. | P04, 40 % · 183 100 (OmegaX) contre 138 100. |
| T4 | Plancher CNSS de mai à décembre 2025 · SMIG fixé (21 500) ou payé (14 500) ? | Décret n° 25/22, art. 2 et 3 ; décret n° 18/041, art. 8 [D2522, D18041]. | P07 (d) · base 559 000 ou 400 000 ; OmegaX s'abstient. |
| T5 | Septembre 2025 · quel taux INPP et ONEM pour une paie dont une partie précède le 24 (25) septembre ? Et la cotisation INPP se calcule-t-elle sur le mois ou sur « le trimestre précédent » ? | Arrêtés, art. 3 et 10 (« à la date de sa signature ») [INPP, ONEM] ; Code, art. 15 b) [CT2]. | P08 · 35 000 (OmegaX, nouveau taux sur tout le mois) contre 30 000 ; le prorata au jour n'a aucun texte. |
| T6 | Tranche d'ancienneté de l'art. 141 sur une période de congé incomplète | « augmente d'un jour ouvrable par tranche de cinq années d'ancienneté » [CT6]. | P13 · 10,8333 jours, 455 000 (OmegaX, prorata) contre 11 jours, 462 000. |
| T7 | Indemnité de préavis · dans l'assiette sociale ? Impôt d'un versement unique ? | Art. 7, point 8 (liste d'exclusion fermée) ; art. 68, 6°, 116, 119, 121 [CT1, T3]. | P13 · CNSS sur 2 646 000 ; retenue 628 500 sur le mois de cessation. OmegaX le dit. |
| T8 | Conversion d'un salaire en dollars · cours de quel jour, arrondi du demi-centime ? | Code, art. 89 ; aucun texte ne fixe le cours [CT5]. | P09 · cours du jour du calcul (décision du cabinet), 343 455,125 → 343 455,13. |
| T9 | Ordonnance n° 23-042, art. 2 · le samedi qui reçoit le congé d'un férié tombé un dimanche est-il un « jour férié légal » au sens de l'art. 7, point 9 ? | [OF, CT1]. Le dépôt écrit déjà, pour l'échéance fiscale, que l'art. 2 n'est pas calculé. | P13 · 77 ou 76 jours, 42 000 de préavis (constat C4). |

---

## Rejouer

```bash
# serveur compilé contre une base JETABLE (jamais celle de production)
createdb -h /tmp -p 55439 -U postgres paiecas
DATABASE_URL="postgresql://postgres@localhost:55439/paiecas?host=/tmp" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres@localhost:55439/paiecas?host=/tmp" JWT_SECRET=<jetable> PORT=8131 \
  INSCRIPTION_PUBLIQUE=true node dist/main.js
OMEGAX_API=http://localhost:8131 node scripts/cas-chiffres/rejeu-paie.mjs rejeu-paie.json
dropdb -h /tmp -p 55439 -U postgres paiecas
```

`OMEGAX_CAS=P07,P15` ne rejoue que les cas nommés. Le script crée ses propres
dossiers à chaque passage, imprime les écarts au centime et écrit le détail
(montants, abstentions, lignes de passation, réponses) dans le fichier JSON
donné en argument. Le cas P09 lit le cours du JOUR de Kinshasa · il le cote
lui-même à la date du rejeu.

---

## Constats

Classement · **BLOQUANT** pour un montant faussé en silence (figé ou passé
au journal sans un mot), un geste juste refusé sans issue, un dossier
enfermé ; **MAJEUR** pour un montant faux servi ou passé avec un avertissement
qui ne suffit pas à l'éviter ; **MINEUR** pour une hypothèse non dite ou une
lecture discutable à faible effet. Aucun BLOQUANT n'a été trouvé.

### C1 · MAJEUR · la simulation chiffre l'impôt et le net quand la CNSS s'abstient (P07 b)

- **Ce qu'OmegaX rend** · salaire 400 000, mois de mars 2026 sans jours payés
  déclarés · la CNSS s'abstient (« ASSIETTE SOUS LE PLANCHER »), la
  quote-part ouvrière n'est pas chiffrée, et pourtant la simulation sert une
  base fiscale nette de **400 000**, une retenue IRPP de **40 600** et un net
  de **359 400**.
- **Attendu** · base fiscale nette, impôt et net non chiffrés (`null`). Si le
  mois est entier, 36 400 et 335 650 ; s'il est incomplet, autre chose
  encore. L'impôt affiché est surestimé, le net aussi (de la quote-part).
- **Source** · loi n° 23/053, art. 70 et 71 [T3] (base nette des versements
  « réellement effectués » à la caisse de pension) ; décret n° 18/041, art. 8
  [D18041] ; principe du dépôt « un impôt non chiffré n'est pas zéro », que la
  quotité applique déjà (`COTISATION_NON_CHIFFREE`).
- **Code** · `src/modules/personnel/personnel.service.ts:1203-1204` (la
  quote-part entre dans l'art. 71 par `totalTravailleurFc`, qui vaut 0 en
  abstention), `:1219-1226` (retenue calculée dès que l'assiette fiscale
  nette n'est pas nulle), `:1235` (net) ;
  `src/modules/personnel/cotisations-paie.ts:535` (abstention sans ligne) et
  `:704-707` (net calculé dès que l'impôt l'est).
- **Portée** · l'émission du bulletin est refusée
  (`bulletin-paie.ts:220`) et la passation aussi
  (`COTISATION_EN_ABSTENTION`) · rien n'est figé ni passé. Mais la simulation
  est l'écran où le cabinet « vérifie avant de payer », et l'impôt et le net
  n'y portent aucune réserve.

### C2 · MAJEUR · un bulletin annulé après passation, dans un exercice clos, se repasse en entier dans N+1 (P15)

- **Ce qu'OmegaX rend** · le bulletin de décembre 2026 de B, passé, validé,
  payé, puis l'exercice clos, s'annule en janvier 2027 ; le bulletin réémis
  (620 000) se passe au 1er janvier 2027 pour son montant ENTIER, l'ancien
  restant dans 2026. Fin janvier · 422 **−1 848 895** au lieu de
  −1 344 995 (503 900 de net déjà payé redevenus dus), 6611 **2 220 100** au
  lieu de 1 620 100 (le salaire de décembre de B en charge sur DEUX
  exercices), 6641 **383 917** au lieu de 281 917.
- **Ce qui est dit** · la proposition du mois porte « ANNULÉ APRÈS PASSATION
  · n° 2 […] Il se corrige par une écriture en négatif (AUDCIF art. 20),
  qu'OmegaX ne passe pas à la place du cabinet ». La passation ne s'arrête
  pas, et sa réponse ne le redit pas.
- **Attendu** · la correction d'une erreur d'un exercice CLOS ne s'inscrit
  pas en négatif dans cet exercice · elle passe par le report à nouveau si
  elle est significative (art. 20, al. 2) ou par l'exercice en cours, et se
  dit aux Notes annexes (al. 3) ; l'opération d'une période close s'inscrit
  au premier jour de la période ouverte « sa date de valeur étant mentionnée
  distinctement » (art. 22, 4°) [AU1]. La réserve cite l'alinéa de l'erreur
  « commise et découverte sur l'exercice en cours », qui n'est pas ce cas, et
  la passation n'a pas de date de valeur.
- **Code** · `src/modules/personnel/comptabilisation-paie.ts:171-176`
  (réserve), `src/modules/personnel/comptabilisation-paie.service.ts:77-90`
  (seul `refus` arrête la passation, `annulesApresPassation` non),
  `src/modules/personnel/dto/personnel.dto.ts:973-987`
  (`ComptabilisationPaieDto` sans date de valeur).
- **Portée** · le défaut n'est pas silencieux (la réserve existe), d'où
  MAJEUR et non BLOQUANT ; mais la passation de janvier 2027 boucle et rien
  en aval ne le verrait, exactement la forme du § 10 bis.

### C3 · MINEUR · la quotité ignore le logement fourni en nature porté sur le bulletin (P12 f)

- **Ce qu'OmegaX rend** · un bulletin qui déclare le logement FOURNI EN
  NATURE (élément `LOGEMENT_OU_SON_INDEMNITE`, `enNature`) sans cocher la
  case de l'art. 114 (`logementFourniEnNature`) rend une quotité sans
  défalcation · base 826 900 au lieu de 822 759,24, quotité 165 380 au lieu
  de 164 551,85 (+ 828,15 par mois).
- **Source** · Code du travail, art. 114, al. 4 [CT5] ; arrêté de 2005,
  art. 10 [AR2005] (« lorsque l'employeur assure le logement en nature »).
- **Code** · `src/modules/personnel/personnel.service.ts:1296` (seule la case
  est lue ; l'élément, lu deux lignes plus bas pour l'indemnité,
  `:1300-1303`, ne l'est pas pour la défalcation) ;
  `src/modules/personnel/quotite-saisissable.ts:424-425`.
- **Portée** · la quotité n'est retenue sur aucun bulletin (la saisie suit
  l'acte, la quotité est confrontée), mais c'est la part protégée qui est
  mal dite, dans le sens défavorable au travailleur. Deux saisies du même
  fait, sans rapprochement.

### C4 · MINEUR · le plancher de trois mois du délégué compte le samedi qui porte le congé d'un férié tombé un dimanche (P13)

- **Ce qu'OmegaX rend** · délégué de trois ans, notifié le 4 mai 2026 ·
  **77** jours ouvrables (du 5 mai au 4 août), dont le samedi 16 mai.
- **Attendu, sous réserve de T9** · le 17 mai 2026, férié, est un dimanche ;
  « le congé relatif à ce jour est pris le jour précédent » (ordonnance
  n° 23-042, art. 2 [OF]) · 76 jours, 42 000 de préavis en moins.
- **Code** · `src/modules/personnel/decompte-final.ts:212-240`
  (`joursOuvrablesDeTroisMois` exclut les dimanches et les dix dates fixes de
  `jourFerie`, jamais le jour précédent) ; aucune réserve ne le dit au
  décompte (le dépôt le dit pour l'échéance fiscale seulement).
- **Portée** · un jour, dans le sens favorable au travailleur, et seulement
  quand le double de l'art. 64 reste sous trois mois (ancienneté de trois ans
  au plus) et qu'un férié de la fenêtre tombe un dimanche. À trancher avant
  de coder (T9).

### Conforme

P01, P02, P03, P04, P05, P06, P08, P09, P10, P11, P14, et dans P07, P12,
P13 et P15 tout ce qui n'est pas nommé ci-dessus · 273 comparaisons sur 282.
En particulier · l'ordre assiette sociale, cotisations, quote-part dans
l'art. 71, impôt ; l'annualisation et ses deux arrondis ; le plafond de 30 %
de part et d'autre du seuil de 77 932 800 ; la condition des 30 % du
logement, l'attestation du transport et des soins ; l'avantage en nature
hors du net et au 6617 / 781 ; le plancher CNSS au SMIG des jours payés ;
l'INPP par nature puis par tranche, de part et d'autre du 24 septembre
2025 ; la conversion en dollars au seul cours du jour ; les retenues
d'avance et de prêt (4211, 2728) et leurs soldes ; la colonne 19 et
l'immunité de l'art. 69, 1 ; la quotité de l'art. 114 et la colonne 20 ; le
décompte final (art. 63, 64, 72, 141 à 144, 258), qui remplace le bulletin du
mois ; la passation en trois temps au centime, retraite obligatoire au 4313
et au 4321 ; la clôture traversée (422 et 43 à l'à-nouveau, paiement en
N+1) ; la grille du cabinet datée et son retrait refusé.

---

## Après correction (2026-10-07, branche `travail/paie-corrections`)

Rejeu · base PostgreSQL 16 jetable `paiecorr`, serveur compilé de la branche
(port 8147), `scripts/cas-chiffres/rejeu-paie.mjs`, attendus mis aux
décisions par la loi du 2026-10-07 (`docs/decisions-par-la-loi-paie-2026-10-07.md`,
T1 à T9). **310 comparaisons au centime, 0 écart**, P15 à travers la clôture
annuelle de 2026. Rejoué après l'alignement de T2 et T9 sur les décisions par
la loi du troisième lot (`docs/decisions-par-la-loi-2026-10-07-ter.md`,
points 2 et 3) sur une base jetable neuve (`paieter`, port 8148) · **313
comparaisons, 0 écart** (la réserve d'intervalle du P03 remplacée par la
règle, trois comparaisons du P13 au mois ajoutées) ; puis, le jumeau de T9
codé (conversion à 1/26 de la moyenne de l'art. 142, H12), sur `paiequater`
(port 8149) · **314 comparaisons, 0 écart**. Après la relecture unique (B1,
M1, M2, M3), sur `paiereleve` (port 8152) · **323 comparaisons, 0 écart** ·
délégué au mois notifié un samedi (3 276 000), temps restant de l'art. 66
(1 365 000) et période de l'art. 70 (2 160 000) au P13, fériés compris ; au
P14, dans les deux référentiels, une taxe étrangère portée au 4428 ni comptée
dans l'INPP et l'ONEM ni dite en retard, et nommée. Le contrôle 36 (dossier
semé avant T1) est relu à part sur la base `paiecorr` · un 43340000 mouvementé
et un 43350000 vierge, nommés avec leur issue.

### Les quatre constats

| # | Correction | Rejeu |
|---|---|---|
| C1 | Sous abstention de la CNSS, la quote-part ouvrière n'est pas chiffrée · base fiscale nette, retenue et net `null`, motif nommé (loi n° 23/053, art. 70 et 71). | P07 b · `null`, `null`, `null` (avant · 400 000, 40 600, 359 400). |
| C2 | La passation du mois reprend EN NÉGATIF le bulletin annulé après passation, en recopiant les lignes de l'écriture d'origine, comptes et montants (relecture M3 · ce qui a été passé, jamais un rejeu à la règle du jour ; écriture qui porte d'autres bulletins · rejeu des chiffres figés si elle s'y reconstitue au centime, sinon refus nommé), lignes à part du réémis · seule la différence pèse sur l'exercice de la correction (AUDCIF art. 20, al. 2 à 4). Une fois (`BulletinPaie.ecritureNegatifId`, RESTRICT), confirmée par le cabinet (`inscrireNegatifs`, refus nommé sans elle), jamais datée avant l'écriture reprise ; un mois d'un exercice antérieur porte la date de valeur de son dernier jour (art. 22, 4°). | P15 · 2027 · 422 −1 344 995 ; 6611 1 620 100 ; 6641 217 113 (T1) ; date 2027-01-01, date de valeur 2026-12-31 ; sans confirmation, 400 nommé. |
| C3 | Le logement `LOGEMENT_OU_SON_INDEMNITE` fourni en nature sur le bulletin déclenche la défalcation de l'art. 114, al. 4 (arrêté de 2005, art. 10), sans la case. | P12 f · forfait 4 140,76, base 822 759,24. |
| C4 | Voir T9 · le samedi qui porte le congé d'un férié tombé un dimanche n'est pas ouvrable au sens du Code du travail. | P13 · délégué de trois ans, 76 jours ouvrables. |

### Les neuf décisions

| # | Codé | Rejeu |
|---|---|---|
| T1 | INPP au 64150000, ONEM au 64130000, dette au 44280000, aux deux plans ; temps « impôts et taxes sur salaires » à part, la CNSS seule au 6641 ; 43340000 et 43350000 retirés des deux semis ; registre des retenues · une nature `inppOnem` (4428, 4334, 4335) ; contrôle 36 `INPP_ONEM_SOUS_LE_433` (INFORMATION). | P14 · 6641 288 888,88 ; 6415 77 777,78 ; 6413 11 111,11 ; 4428 −88 888,89, aux deux référentiels. P15 · 2026 · 6641 208 013 ; 4428 −64 004 repris à l'à-nouveau. |
| T2 | Tranché par la loi le 2026-10-07 (troisième lot, point 2, `docs/decisions-par-la-loi-2026-10-07-ter.md`) · la réduction opérée par le plafond de l'art. 118, al. 2 se rapporte à la seule part au-delà de la troisième tranche ; l'impôt du barème des trois premières (9 486 720, 21,96 %, sous les 30 %) reste la base de la quotité de l'art. 123, al. 1er et 2. Règle dite avec son fondement ; prorata (2 219 700) et borne basse (2 225 600) écartés, en commentaire de code seulement. Aucun changement de calcul. | P03 · règle servie, base 9 486 720, réduction 758 937,60 l'an ; retenue 2 216 800 inchangée. |
| T3 | L'autre lecture du logement à 30 % n'est plus chiffrée en réserve. | P04 · réserve absente ; 183 100 inchangé. |
| T4 | Plancher CNSS de mai à décembre 2025 · 14 500 × jours payés ; abstention sans jours. | P07 · novembre 2025 · 400 000 au-dessus du plancher (377 000) ; 300 000 relevé à 377 000 ; sans jours, abstention. |
| T5 | ONEM · réserve de l'art. 6 avant septembre 2025 ; INPP de septembre 2025 au barème du jour de la mise à disposition déclarée, sinon au mois avec réserve ; `RESERVE_ASSIETTE_INPP` nomme l'ordonnance n° 84/186. | P08 · versé le 20 septembre 2025, 30 000 (3 %) ; le 30, 35 000 (3,5 %). |
| T6 | Le jour de la tranche d'ancienneté est entier. | P13 · 11 jours, 462 000. |
| T7 | `FONDEMENT_ASSIETTE_SOCIALE_INDEMNITE` · l'indemnité de préavis est dans l'assiette sociale par le texte (art. 7, point 8 ; art. 63, al. 3 ; arrêté n° 146/2018, art. 20) ; versement unique · art. 121, al. 3, aucun taux spécial. | P13 · mois de cessation · assiette 3 312 000, ouvrière 165 600, patronal 563 040, retenue 654 500, net 2 491 900. |
| T8 | Conversion au centime supérieur ; cours de la date de mise à disposition déclarée, à défaut du jour du calcul, et c'est dit. | P09 · prime 343 455,13 ; mise à disposition la veille · cours 2 800, prime 337 400. |
| T9, jumeau (H12) | La moyenne des douze mois (art. 66, al. 3 ; art. 142, al. 2) ramenée au jour à 1/26 n'est plus une « convention » · règle citée au fondement de l'indemnité de congé et du temps restant à courir (`REGLE_MOYENNE_AU_JOUR`) · le Code (art. 141, 142, 144) ne fixe pas la conversion, le livre de paie porte un taux journalier de l'allocation de congé (arrêté du 8 août 2008, mentions 14 à 16), seule conversion légale celle du décret n° 25/22, art. 7, par analogie de la loi la plus proche. Aucun changement de calcul. | P13 · congé 11 × (40 000 + 52 000 / 26) = 462 000, règle au fondement ; art. 66 · 31,5 × 42 000 = 1 323 000 (test). |
| T9 | Samedi qui porte le congé d'un férié du dimanche non ouvrable (ordonnance n° 23-042, art. 2), dans le seul Code du travail ; l'indemnité de préavis est la rémunération du délai, fériés compris (art. 63, al. 3 ; art. 93) · journalier, jours du lundi au samedi du délai ; mensuel, mois entiers au salaire du mois, mois entamé à 1/26 du salaire mensuel par jour payable, du lundi au samedi, fériés compris, le dimanche exclu · règle tranchée par la loi le 2026-10-07 (troisième lot, point 3 · art. 63 al. 3, 93, 7 point 9, 121 al. 2 ; arrêté du 8 août 2008, mentions 5 et 6 ; vingt-six jours du décret n° 25/22, art. 7, par analogie), citée au fondement, plus une réserve ; vingt-six jours payables rendent un mois plein. Sans date de notification, `null`. | P13 · licenciement notifié le 4 mai 2026 · 63 jours ouvrables, 65 rémunérés, 2 730 000 ; total 3 312 000 ; au mois (1 040 000 + 52 000) · deux mois entiers et 12 jours payables du 6 au 18 juillet, 2 688 000, règle au fondement, aucune réserve ; démission non observée · 1 365 000 (32,5 jours) ; délégué 7 ans · 5 418 000 (129 jours) ; délégué 3 ans · 76 jours ouvrables, 79 rémunérés, 3 318 000. |

### Écarts au texte de la commande, et pourquoi

- **T1, registre des retenues** · les clés `inpp` et `onem` deviennent UNE
  nature `inppOnem`. Pointées toutes deux vers le 4428, chacune aurait lu
  toute la dette du compte · le registre et l'échéancier annonçaient le
  double, sur une balance qui boucle. Rien ne permet de couper un solde porté
  sur un seul compte (même parti que le prélèvement sur les capitaux
  mobiliers des non-résidents). La déclaration ONEM du 10 reste une
  obligation à part ; le bénéficiaire `ORGANISME_SOCIAL` est gardé, il
  commande le non-report de l'échéance (art. 110 bis LPF), que ni le Code du
  travail ni l'arrêté n° 028/2025 ne posent.
- **C2, confirmation** · la reprise en négatif se confirme · jusqu'ici la
  proposition faisait inscrire le négatif à la main, et le reprendre d'office
  aurait pu doubler la correction. Le refus dit l'issue (contre-passer le
  négatif manuel, puis passer la paie).

### Relecture unique de la ligne (2026-10-07)

| # | Correction | Rejeu |
|---|---|---|
| B1 | Au mois, les mois entiers du délai partent du premier jour CIVIL de la fenêtre, le lendemain de la notification (art. 64, al. 1), non du premier jour payable. | P13 · délégué de trois ans au mois notifié le samedi 2 mai 2026 · 3 276 000 (3 234 000 avant). |
| M1 | La nature INPP et ONEM du registre des retenues ne lit du 4428 que ce que la structure rattache (écriture de la paie, charge 6415 ou 6413, lettrage) ; un 4428 mêlé est nommé, son ouverture non comptée, et aucun retard n'est affirmé tant qu'un reversement reste non rattaché. | P14 · taxe étrangère de 50 000 en mars · INPP et ONEM 88 888,89, un mois en retard (avril), la taxe nommée, aux deux référentiels. |
| M2 | Temps restant à courir (art. 66) et période jusqu'au terme (art. 70) payés comme le délai de T9, fériés compris, mois entiers et 1/26 ; l'art. 70 placé par la date de la rupture et le terme déclarés. | P13 · 1 365 000 (art. 66, 32,5 jours) ; 2 160 000 (art. 70, 54 jours du 20 juin au 21 août 2026). |
| M3 | La reprise en négatif recopie l'écriture d'origine (comptes et montants) ; écriture commune rejouée seulement si elle se reconstitue au centime ; sinon, ou introuvable, refus nommé. | P15 · reprise au centime ; test · bulletin d'avant T1 repris au 6641, au 4334 et au 4335. |

### Restent ouverts

- **T5** · l'ordonnance n° 84/186 (assiette INPP) n'est pas au corpus. **Mise à jour du 2026-10-08** · l'ordonnance est au corpus (compétence `droit-travail-congolais`, copie `docs/sources/ordonnance-84-186-inpp-modalites-paiement.md`) et lue · voir `src/modules/retenues/inpp-trimestriel.ts`.
- **T9** · plus rien d'ouvert. Le mois entamé d'un salaire mensuel est
  tranché par la loi (troisième lot, point 3), la quotité sur un impôt
  plafonné aussi (T2, point 2). L'art. 66 (temps restant à courir après un
  départ à mi-préavis) et l'art. 70 (période restant à courir jusqu'au terme
  d'un contrat à durée déterminée) suivent la même règle (relecture M2) ·
  leur texte a la structure de l'art. 63, al. 3 (« la rémunération [...]
  pendant le temps restant à courir » ; « les salaires et avantages de toute
  nature dont le salarié aurait bénéficié pendant la période restant à
  courir »), fériés compris (art. 93), mois entiers et 1/26 par jour payable
  du mois entamé ; la période de l'art. 70 se place par la date de la
  rupture et le terme déclarés.
- **C2** · une erreur significative d'un exercice clos passe par le report à
  nouveau (art. 20, al. 3), hors de ce geste. Le négatif n'est plus rejoué à
  la règle du jour (relecture M3) · l'inscription en négatif annule ce qui a
  été passé (art. 20, al. 2), et reprend les lignes de l'écriture d'origine,
  comptes et montants · un bulletin passé avant T1 est repris au 6641, au
  4334 et au 4335.
