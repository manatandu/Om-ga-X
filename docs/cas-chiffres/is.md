# Cas chiffrés · impôt sur les sociétés (IS)

Méthode décidée par Manasse le 2026-10-04 · on part des CALCULS, non des
obligations. Quinze situations d'une société congolaise tenue au SYSCOHADA
(seize dossiers, le cas 1 ayant une variante) sont calculées à la main,
article par article, puis rejouées dans OmegaX sur une vraie base, par l'API
du serveur compilé (`scripts/cas-chiffres/rejeu-is.mjs`). Rien n'est corrigé
dans le code · le document rend un constat.

Code relu · `main` au commit `8f6f003` (module `src/modules/fiscalite/`).
Rejeu · 2026-10-04, base PostgreSQL 16 jetable, serveur compilé
(`node dist/main.js`), seize dossiers créés par l'inscription, écritures au
journal OD, validation, clôtures annuelles 2026 à 2029 traversées au cas 4.

**CORRIGÉ le 2026-10-04 (branche `travail/is-cas`).** Les écarts ci-dessous
ont été corrigés et le script rejoué sur une base PostgreSQL 16 jetable,
serveur compilé de la branche · les seize dossiers rendent l'attendu, C04 et
C05 lus avant ET après les clôtures de 2026 à 2029. La colonne « OmegaX » des
tableaux porte le rejeu APRÈS correction ; ce qu'OmegaX rendait avant est
gardé entre parenthèses (« avant : … »). Décisions et questions rendues ·
section « Après correction » en fin de document.

## Sources lues

Toutes dans les compétences installées, lues le 2026-10-04 avant d'écrire un
chiffre. Abréviations utilisées dans les tableaux :

| Abr. | Fichier | Contenu lu |
|---|---|---|
| [T2] | `fiscalite-rdc/code-general-2026/references/04-loi23-053-titre2-impot-societes.md` | loi n° 23/053, art. 3 à 7, 9, 12, 44, 45, 49 à 52, 55 à 57 |
| [T3] | `fiscalite-rdc/code-general-2026/references/05-loi23-053-titre3-irpp.md` | art. 63, 107, 109, 112, 122 |
| [T47] | `fiscalite-rdc/code-general-2026/references/06-loi23-053-titre4-7-communes-autres-abrogatoires.md` | art. 150 (arrondis), 152, 153 (entrée en vigueur) |
| [LPF1] | `fiscalite-rdc/code-general-2026/references/17-procedures-titre1-obligations-declaratives.md` | LPF art. 12 (déclaration au 30 avril) |
| [LPF3] | `fiscalite-rdc/code-general-2026/references/19-procedures-titre3-recouvrement.md` | LPF art. 57, 57 bis (modifié par la L.F. n° 25/060), 57 ter |
| [LPF4] | `fiscalite-rdc/code-general-2026/references/20-procedures-titre4-sanctions-fiscales-penales.md` | LPF art. 98 bis (« amende égale à 50% du montant de l'acompte non versé ») |
| [LF26] | `fiscalite-rdc/lois-de-finances-annuelles/references/lf-2026-mesures-fiscales.md` | L.F. n° 25/060 · échéances des acomptes ; taux de l'IS et minimum inchangés |
| [SOCLE] | `fiscalite-rdc-socle/references/parametres-2026.md` | entrée en vigueur au 1er janvier 2026 ; « point non tranché » sur le premier exercice déclaré sous l'IS |
| [AU1] | `audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md` | AUDCIF art. 22, 2° (validation) |
| [AU89] | `audcif-acte-uniforme/references/titre-7-comptes-classe-8.md` | fiche du compte 89 (891, 895, crédit du 441) |

Rappel des règles lues, une fois pour toutes :

- **Taux** · « 30 % du bénéfice net imposable » (art. 56, [T2]).
- **Minimum** · « 1 % du chiffre d'affaires déclaré, lorsque les résultats
  sont déficitaires ou bénéficiaires mais susceptibles de donner lieu à une
  imposition inférieure à ce montant » (art. 57, [T2]).
- **Base** · « l'excédent des produits sur les charges de l'exercice en
  application de la législation et de la réglementation comptable en vigueur,
  sous réserve des dispositions fiscales contraires » (art. 9, al. 3, [T2]).
- **Report** · déficit déductible de l'exercice suivant, puis reporté
  « jusqu'au troisième exercice qui suit l'exercice déficitaire » (art. 51,
  [T2]) ; caractère déficitaire apprécié « abstraction faite des déficits
  reportables des exercices antérieurs » (art. 52, 2°). Ni plafond de 60 %, ni
  imputation du minimum dans les art. 51 et 52 (lus).
- **Arrondi** · décimale à l'unité (première décimale ≥ 5 vers le haut), puis
  tranche ≥ 50 FC à la centaine supérieure, sinon inférieure (art. 150, [T47]).
- **Acomptes** · base = « l'impôt déclaré au titre de l'exercice précédent,
  augmenté des suppléments éventuels établis par l'Administration »,
  30 %, 30 %, 20 %, au plus tard les 25 juillet, 25 septembre, 25 novembre
  « de l'année de réalisation des revenus imposables », imputés sur l'impôt de
  l'exercice (LPF art. 57 bis, [LPF3], [LF26]) ; excédent = crédit au compte
  courant fiscal (art. 57 ter).
- **Période** · « L'Impôt sur les Sociétés est établi chaque année sur les
  bénéfices réalisés l'exercice précédent » ; création après le 30 juin ·
  premier exercice clos le 31 décembre de l'année suivante, mais « l'impôt est
  néanmoins établi sur les bénéfices réalisés au cours de la période allant du
  jour de la création de l'entreprise au 31 décembre de la même année […]. Ils
  viennent ensuite en déduction des résultats du premier exercice comptable
  clos » (art. 12, al. 1 et 3, [T2]).
- **Entrée en vigueur** · « après vingt-quatre mois à compter du 31 décembre de
  l'année de sa promulgation » (art. 153, [T47]), soit le 1er janvier 2026
  ([SOCLE]).

---

## Synthèse · les écarts, classés

### Montant faux

| Cas | Ce qu'OmegaX rend | Attendu | Écart | Cause (fichier:ligne) |
|---|---|---|---|---|
| **C05** · report déficitaire au bord de la fenêtre · CORRIGÉ (rejoué depuis le premier exercice, `report-deficitaire.ts`) | IS 2030 = **177 000** (déficit imputé 410 000, base 590 000) | **150 000** (déficit 500 000, base 500 000) | **+27 000** d'impôt ; acomptes 2031 surévalués de 8 100, 8 100, 5 400 | `fiscalite.service.ts:979-1008` · la fenêtre de lecture commence au troisième exercice précédent, si bien que le bénéfice de 2028 est réimputé sur le déficit de 2027 alors qu'OmegaX lui-même l'avait imputé sur celui de 2026 en lisant 2029. Voir le cas. |
| **C09** · premier exercice de plus de douze mois (création le 1er septembre 2026) · CORRIGÉ (`periode-creation.ts`) | IS = **1 530 000** sur 16 mois ; « AUCUN acompte n'est dû » en 2027 | **300 000** (période du 1er septembre au 31 décembre 2026) **+ 1 500 000** (exercice clos le 31 décembre 2027) = **1 800 000** ; acomptes 2027 de **90 000, 90 000, 60 000** | **−270 000** d'impôt ; 240 000 d'acomptes dits non dus (exposition à l'amende de 50 % de l'acompte non versé, LPF art. 98 bis [LPF4]) | `fiscalite.service.ts:1382-1409` (un exercice = une période imposable) et `:1399-1403`, `:1471` (« sans exercice antérieur ») · l'art. 12, al. 3 [T2] n'est appliqué nulle part. |

### Montant juste, mais hypothèse non dite à l'utilisateur

| Cas | Hypothèse | Fichier:ligne | Effet |
|---|---|---|---|
| **C01-bis** | Le résultat fiscal ne lit que le livre-journal ; une charge au brouillard est ignorée **sans un mot sur l'écran du résultat fiscal** (seule l'écriture A11 le dit, en refusant). | `fiscalite.service.ts:423` | Écran : IS **3 000 000** au lieu de **600 000** tant que 8 000 000 de charges restent au brouillard ; acomptes suivants annoncés sur 3 000 000. |
| **C02** (et tout cas où le minimum joue) | Le « chiffre d'affaires **déclaré** » de l'art. 57 est le mouvement net des comptes 701 à 707 (poste XB). Dit seulement dans la branche « déficit et chiffre d'affaires nul ». | `fiscalite.service.ts:464-466`, phrase servie `:1614` | Juste pour une société dont tout le produit d'activité est en 701 à 707 ; faux (sans le dire) si le chiffre d'affaires déclaré à la DGI diffère (produits accessoires classés ailleurs, 75, 77). Même lecture pour les plafonds des art. 43, 44, 49, 1°. |
| **C12a** | L'arrondi de l'art. 150 est appliqué AVANT la comparaison de l'art. 57. | `fiscalite.service.ts:1589-1591` ; compte de charge `ecriture-impot-resultat.ts:253-255` | Montant identique (1 234 600) ; mais l'impôt passe au **891** (impôt au taux) au lieu du **895** (minimum), et l'écran dit « les deux impôts sont égaux » alors qu'avant arrondi le minimum était supérieur. Lecture défendable (l'art. 150 vise « le montant de l'Impôt sur les Sociétés, de l'Impôt minimum »), non dite. |
| **C15** | Un déficit d'un exercice ouvert AVANT le 1er janvier 2026 est recalculé sous la loi n° 23/053 et imputé sur 2026 ; l'avertissement « SIMULATION » ne s'affiche que dans la vue de l'exercice ancien, jamais dans la vue 2026 qui l'impute. | `fiscalite.service.ts:986-1012` (aucune borne de date) ; avertissement `:925-929` (exercice courant seul) | Vue 2026 : déficit 2 000 000 imputé, IS 900 000, sans réserve. Le déficit « constaté » (art. 51) de 2025 est celui de la déclaration faite sous le régime antérieur, hors corpus ; la saisie manuelle (`deficitAnterieurSaisi`) existe mais rien ne la suggère. |

### À trancher · le corpus ne dit pas

| Cas | Question | Ce qui a été lu |
|---|---|---|
| **C10** | Premier exercice du 1er septembre 2025 au 31 décembre 2026 · OmegaX traite tout l'exercice en SIMULATION et refuse l'écriture A11 (« la loi ne régissait pas cet exercice »). La part de 2026 (bénéfice 5 000 000) relève-t-elle de la loi n° 23/053 par la mécanique de l'art. 12, al. 3 (impôt de la période 2025 établi à part, puis déduit), soit 1 500 000 ? | Art. 12, al. 3 et art. 153 [T2], [T47] ; [SOCLE] : « la première déclaration sous ce régime porte vraisemblablement sur l'exercice 2026 […]. Le texte ne le dit pas explicitement. » Aucune disposition transitoire lue. |
| **C15** | Le déficit de 2025 imputable en 2026 est-il le déficit déclaré sous l'ancien régime (et selon quelles règles d'imputation) ? | Même lecture ; l'ancien régime (O.-L. n° 69/009, titres III et IV) est abrogé (art. 152, 2°) et hors corpus de calcul. |
| **C09** | Sur la période intermédiaire de l'art. 12, al. 3, le minimum de l'art. 57 s'applique-t-il (1 % du chiffre d'affaires de la seule période) ? | Art. 57 vise « les sociétés », sans exception de période ; lu comme applicable dans le calcul ci-dessous. Le chiffre d'affaires retenu pour le minimum du premier exercice (16 mois ou 12 mois) est sans effet ici (impôt au taux supérieur dans les deux cas). |
| **C14** | L'art. 57 assujettit au minimum « les sociétés » ; s'applique-t-il à une personne morale de droit public imposable « en raison de son activité » (art. 3, al. 2, 2°) qui n'a pas la forme d'une société ? OmegaX l'applique. | Art. 3, 5, 57 [T2]. Sans effet sur ce cas (impôt au taux supérieur). |

### Conforme

C01, C02 (montant), C03, C04 (à travers quatre clôtures), C06, C07, C08,
C11, C12b, C13, C14 (hypothèse dite par une observation et une attestation
exigée à l'écriture A11).

---

## Étape 1 · Hypothèses tues dans le code

Relevé exhaustif de ce que le code prend pour une date, une base, un montant
ou une condition à la place de ce que dit le texte. Colonne « Dit ? » · si
l'utilisateur en est averti à l'écran du résultat fiscal.

| # | Fichier:ligne | Ce que fait le code | Ce que dit le texte | Effet sur le montant | Dit ? |
|---|---|---|---|---|---|
| H1 | `fiscalite.service.ts:464-466` | Chiffre d'affaires = mouvements nets (crédit − débit, écriture de clôture exclue) des comptes du poste XB (701 à 707, rabais 7019 et suivants compris). | Art. 57 · « chiffre d'affaires **déclaré** » ; art. 44 · « chiffre d'affaires de l'exercice » ; art. 49, 1° et 43 · « hors taxes ». Aucune définition au Titre I. | Minimum et plafonds faux si le chiffre d'affaires déclaré diffère du XB. | Seulement dans la branche « déficit, chiffre d'affaires nul » (`:1617`). |
| H2 | `fiscalite.service.ts:423` (`balance(…, false)`) | Résultat, chiffre d'affaires et 4492 lus sur les écritures VALIDÉES seules. | AUDCIF art. 22, 2° [AU1] · « Toute donnée entrée fait l'objet d'une validation ». Le résultat déclaré est celui des comptes arrêtés. | Une charge ou un produit au brouillard est absent de l'impôt affiché (C01-bis). | Non à l'écran fiscal ; oui au refus de l'A11 (`constat-impot.service.ts:71-86`). |
| H3 | `fiscalite.service.ts:1382-1409` | Un exercice comptable = une période imposable, quelle que soit sa durée. | Art. 12, al. 3 [T2] · premier exercice long (création après le 30 juin) · impôt établi d'abord sur la période jusqu'au 31 décembre de l'année de création, puis déduction. | Minimum calculé une fois au lieu de deux, impôt de l'année de création non isolé (C09 : −270 000). | Non. |
| H4 | `fiscalite.service.ts:1399-1403`, `:1471`, phrase `:1349` | Sans exercice antérieur DANS LE DOSSIER, « AUCUN acompte n'est dû au titre de la présente année ». | LPF art. 57 bis [LPF3] · la base est l'impôt déclaré de l'exercice précédent ; au cas de l'art. 12, al. 3, l'impôt de la période de création EST cet impôt déclaré. | 240 000 d'acomptes 2027 dits non dus au cas C09. | La phrase invite à vérifier « si l'entreprise était suivie ailleurs », pas le cas de l'art. 12, al. 3. |
| H5 | `fiscalite.service.ts:979-1008` | Les déficits se consomment sur les bénéfices intermédiaires, du plus ancien au plus récent (commentaire `:955-956`), mais SEULEMENT parmi les trois exercices de la fenêtre de l'exercice lu. | Art. 51 [T2] · report « jusqu'au troisième exercice qui suit ». L'ordre d'imputation n'est pas écrit ; OmegaX déclare le plus ancien d'abord. | Un bénéfice déjà imputé sur un déficit sorti de la fenêtre est réimputé sur un déficit plus récent : déficit restant sous-évalué, impôt surévalué (C05 : +27 000). | Non. |
| H6 | `fiscalite.service.ts:986-1012` ; `:925-929` | Les déficits d'exercices ouverts avant le 1er janvier 2026 sont recalculés avec les règles et les retraitements de la loi n° 23/053 et imputés ; l'avertissement de simulation ne vise que l'exercice affiché. | Art. 153 [T47] ; transition non écrite ([SOCLE], « point non tranché »). | Déficit 2025 imputé en 2026 au montant recalculé, non au montant déclaré (C15). | Non dans la vue 2026. |
| H7 | `fiscalite.service.ts:1589-1591` | Arrondi de l'art. 150 avant la comparaison de l'art. 57. | Art. 150 [T47] vise le montant de l'IS et de l'impôt minimum ; art. 57 compare des « impositions ». | Montant inchangé ; compte 891 au lieu de 895 et libellé « égaux » (C12a). | Non. |
| H8 | `fiscalite.service.ts:1533`, `:1539-1545` | Base des acomptes suivants = impôt CALCULÉ par OmegaX + suppléments saisis. | LPF art. 57 bis · impôt DÉCLARÉ (ou reconstitué d'office). | Juste si la déclaration reprend le calcul. | Oui (observation « la base servie ci-dessous est la première branche »). |
| H9 | `arrondi-article-150.ts:32-38` | Acomptes laissés au centime, non arrondis par l'art. 150. | Art. 150 vise « les prélèvements prévus dans la présente Loi » ; les acomptes sont prévus par la LPF, qui n'a pas d'arrondi lu. | Nul dans les cas rejoués (base multiple de 100 · 30 % et 20 % tombent au franc). Possible au centime si un supplément saisi n'est pas rond. | Non (commentaire de code seulement). |
| H10 | `fiscalite.service.ts:1259-1262` | Forme juridique non renseignée · supposée personne morale à l'IS. | Art. 3 [T2] · imposable en raison de la forme ou de l'activité. | Impôt affiché sur une supposition. | Oui (observation) ; l'A11 refuse (`ecriture-impot-resultat.ts:162-167`). |
| H11 | `fiscalite.service.ts:1218-1238` | SNC, SCS (option supposée levée), GIE (quote-part non retranchée), coopérative, entité publique · impôt calculé comme pour une SA. | Art. 3, al. 3, art. 4, 5, 1° et 2°, art. 6, 1° [T2]. | Impôt affiché peut-être non dû. | Oui (observations) ; A11 exige une attestation écrite (`ecriture-impot-resultat.ts:110-123`, refus rejoué au cas C14). |
| H12 | `fiscalite.service.ts:1239-1243` | SA, SARL, SAS unipersonnelle à associé personne physique · calcul à l'IS. | Art. 3 [T2] contre art. 63, al. 2, 1° [T3]. | Selon la lecture retenue. | Oui (observation, et le texte est signalé non articulé). |
| H13 | `fiscalite.service.ts:921-924` | Résultat entier, sans découpage territorial. | Art. 7 et 51, al. 3 [T2]. | Base trop large ou trop étroite pour une exploitation étrangère. | Oui (observation, deux sens). |
| H14 | `fiscalite.service.ts:1589-1590` | Aucun prorata du minimum pour un exercice de moins de douze mois. | Art. 57 ne proratise rien ; art. 12, al. 2 admet le premier exercice court. | Aucun · conforme (C08). | Sans objet. |

Ce qui a été vérifié et n'est PAS une hypothèse tue · l'égalité de l'art. 57
(trois cas servis, `:1612-1619`), la condition d'ouverture de l'art. 44
(`:743-755`, rejouée au cas C07), le plafond global par nature
(`:841-870`, rejoué au cas C06), la borne de date du report (`:979-990`,
rejouée au cas C04), la réintégration de l'impôt (`:383-396`, rejouée au cas
C01), la personne physique hors IS (`:1191-1215`, cas C13).

---

## Étapes 2 et 3 · Les cas

Chaque cas · données, calcul à la main ligne à ligne, puis tableau
« attendu (article) · OmegaX · écart ». Les écritures du rejeu sont au journal
OD : chiffre d'affaires D 52110000 / C 70110000, charges D 60410000 (ou le
compte nommé) / C 52110000, toutes validées avant lecture sauf mention. Les
montants OmegaX sont ceux rendus par `GET /fiscalite/resultat-fiscal` et
`GET /fiscalite/exercices/:id/ecriture-impot`.

### C01 · Bénéfice simple (SARL, exercice 2026), puis l'écriture de l'impôt

Données · chiffre d'affaires 100 000 000 ; achats 60 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Résultat comptable | 100 000 000 − 60 000 000 = 40 000 000 | art. 9, al. 3 |
| Bénéfice net imposable | 40 000 000 (aucun retraitement) | art. 9 |
| Impôt au taux | 30 % × 40 000 000 = 12 000 000 | art. 56 |
| Minimum | 1 % × 100 000 000 = 1 000 000 | art. 57 |
| Impôt dû | 12 000 000 (le minimum ne joue pas) | art. 57 |
| Arrondi | 12 000 000 (tranche 00) | art. 150 |
| Acomptes 2027 | 3 600 000 · 3 600 000 · 2 400 000 | LPF art. 57 bis |
| Écriture | D 8911 12 000 000 / C 441 12 000 000 | fiche du compte 89 [AU89] |
| Après validation de l'écriture | résultat comptable 28 000 000 ; réintégration de l'impôt 12 000 000 ; base 40 000 000 ; impôt 12 000 000 | art. 45, art. 50, 2° |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Base | 40 000 000 | 40 000 000 | 0 |
| Impôt au taux / minimum | 12 000 000 / 1 000 000 | 12 000 000 / 1 000 000 | 0 |
| Impôt dû | 12 000 000 | 12 000 000 | 0 |
| Acomptes 2027 | 3 600 000 · 3 600 000 · 2 400 000 | idem | 0 |
| Écriture A11 proposée | 89110000 D 12 000 000 / 44100000 C | idem, passée au brouillard (pièce 3) | 0 |
| Après validation, sans réintégration | 8 400 000 (faux tant que l'impôt n'est pas réintégré) | 8 400 000, avec l'observation « IMPÔT NON RÉINTÉGRÉ À SA MESURE » | dit |
| Après réintégration 12 000 000 | 12 000 000 | 12 000 000 ; constat 12 000 000, compte 89110000 | 0 |

Conforme.

### C01-bis · Même société, charges restées au brouillard

Données · chiffre d'affaires 10 000 000 validé ; achats 8 000 000 saisis, NON
validés.

| Ligne | Calcul | Article |
|---|---|---|
| Résultat des comptes arrêtés (après validation de la charge) | 10 000 000 − 8 000 000 = 2 000 000 | art. 9 ; AUDCIF art. 22, 2° |
| Impôt | 30 % × 2 000 000 = 600 000 ; minimum 100 000 | art. 56, 57 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt affiché à l'écran du résultat fiscal | 600 000, ou un avertissement que 8 000 000 de charges sont au brouillard | 3 000 000, `definitif` faux, « CHIFFRE PROVISOIRE · 1 écriture(s) au brouillard […] changeraient le résultat comptable de −8 000 000 » en tête, bandeau « Calcul provisoire » (avant : aucune observation) | dit |
| Écriture A11 | refusée tant que la charge n'est pas validée | refusée : « 1 écriture(s) au brouillard touchent les classes 6 à 8 » | 0 |

Montant juste au sens du livre-journal (art. 22, 2°), hypothèse non dite à
l'écran du résultat fiscal (H2).

### C02 · Déficit avec chiffre d'affaires (SA)

Données · chiffre d'affaires 50 000 000 ; achats 53 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Résultat | −3 000 000 | art. 9 |
| Impôt au taux | 0 | art. 56 |
| Minimum | 1 % × 50 000 000 = 500 000 | art. 57 (« lorsque les résultats sont déficitaires ») |
| Impôt dû | 500 000 | art. 57 |
| Déficit reportable | 3 000 000, le minimum n'en change rien | art. 51 ; art. 52, 2° |
| Acomptes 2027 | 150 000 · 150 000 · 100 000 | LPF art. 57 bis |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt dû | 500 000 (minimum) | 500 000, `minimumApplique` vrai | 0 |
| Écriture A11 | D 895 500 000 / C 441 (lecture d'OmegaX · la fiche du compte 89 ouvre 895 « Impôt minimum forfaitaire ») | 89500000 D 500 000 / 44100000 C | 0 |
| Acomptes 2027 | 150 000 · 150 000 · 100 000 | idem | 0 |
| Libellé | « chiffre d'affaires déclaré » | « 1 % du chiffre d'affaires déclaré », et la lecture « comptes 701 à 707 (poste XB) » dite dans chaque branche de l'explication et sur chaque plafond assis sur le chiffre d'affaires (avant : non dite) | dit |

### C03 · Égalité entre l'impôt au taux et le minimum (SARL)

Données · chiffre d'affaires 30 000 000 ; achats 29 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Base | 1 000 000 | art. 9 |
| Impôt au taux | 300 000 | art. 56 |
| Minimum | 300 000 | art. 57 |
| Impôt dû | 300 000 ; le minimum ne joue que pour une imposition « inférieure », il ne joue donc pas | art. 57 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt dû | 300 000 au taux | 300 000, `minimumApplique` faux, libellé « Les deux impôts sont ÉGAUX » | 0 |
| Écriture A11 | 891 | 89110000 D 300 000 | 0 |

Conforme.

### C04 · Report déficitaire sur trois exercices, puis expiration (SARL, 2026 à 2030, quatre clôtures)

Données (chiffre d'affaires ; achats) · 2026 · 5 000 000 ; 6 000 000 ·
2027 · 20 000 000 ; 19 800 000 · 2028 · 20 000 000 ; 19 700 000 · 2029 ·
20 000 000 ; 19 900 000 · 2030 · 20 000 000 ; 19 000 000. Exercices 2026 à
2029 CLÔTURÉS dans l'ordre avant lecture.

| Exercice | Résultat | Déficit disponible | Imputé | Base | Taux | Minimum | Impôt dû | Article |
|---|---|---|---|---|---|---|---|---|
| 2026 | −1 000 000 | 0 | 0 | −1 000 000 | 0 | 50 000 | 50 000 | art. 57 |
| 2027 | 200 000 | 1 000 000 | 200 000 | 0 | 0 | 200 000 | 200 000 | art. 51, 57 |
| 2028 | 300 000 | 800 000 | 300 000 | 0 | 0 | 200 000 | 200 000 | art. 51, 57 |
| 2029 | 100 000 | 500 000 | 100 000 | 0 | 0 | 200 000 | 200 000 | art. 51 (troisième exercice qui suit 2026), 57 |
| 2030 | 1 000 000 | **0** (400 000 de 2026 éteints au 31 décembre 2029) | 0 | 1 000 000 | 300 000 | 200 000 | 300 000 | art. 51, 56 |

| Exercice | Attendu (déficit · impôt dû) | OmegaX | Écart |
|---|---|---|---|
| 2026 | 0 · 50 000 | 0 · 50 000 | 0 |
| 2027 | 1 000 000 · 200 000 | 1 000 000 · 200 000 | 0 |
| 2028 | 800 000 · 200 000 | 800 000 · 200 000 | 0 |
| 2029 | 500 000 · 200 000 | 500 000 · 200 000 | 0 |
| 2030 | 0 · 300 000 | 0 · 300 000 | 0 |

Conforme, y compris sur les exercices clos (le résultat est relu avant
l'écriture qui solde les classes 6 à 8).

### C05 · Ordre d'imputation au bord de la fenêtre (SARL, 2026 à 2030)

Données (chiffre d'affaires ; achats) · 2026 · 10 000 000 ; 10 100 000 ·
2027 · 10 000 000 ; 10 500 000 · 2028 · 10 000 000 ; 9 940 000 · 2029 ·
10 000 000 ; 9 970 000 · 2030 · 10 000 000 ; 9 000 000.

Déficits · D1 = 100 000 (2026, reportable jusqu'en 2029) ; D2 = 500 000
(2027, reportable jusqu'en 2030), art. 51.

| Exercice | Calcul à la main, le plus ancien d'abord (règle que le code déclare, `:955-956`) | Impôt dû |
|---|---|---|
| 2028 | bénéfice 60 000 imputé sur D1 · D1 reste 40 000, D2 500 000 · base 0 | minimum 100 000 |
| 2029 | bénéfice 30 000 imputé sur D1 · D1 reste 10 000 (éteint au 31 décembre 2029), D2 500 000 · base 0 | minimum 100 000 |
| 2030 | D1 éteint ; D2 500 000 disponible · base 1 000 000 − 500 000 = 500 000 · 30 % = 150 000 > minimum 100 000 | **150 000** |

| Exercice | Attendu (déficit disponible · impôt) | OmegaX | Écart |
|---|---|---|---|
| 2028 | 600 000 · 100 000 | 600 000 · 100 000 | 0 |
| 2029 | 540 000 (D1 40 000 + D2 500 000) · 100 000 | 540 000 · 100 000 | 0 |
| 2030 | **500 000** · **150 000** | **500 000** · **150 000**, acomptes 2031 45 000 · 45 000 · 30 000 ; identique avant et après les clôtures de 2026 à 2029 (avant : 410 000 · 177 000) | 0 |

Corrigé · le report se rejoue du premier exercice du dossier, chaque perte dans sa fenêtre (`report-deficitaire.ts`). Constat d'origine · montant faux (H5). OmegaX se contredisait d'un exercice à l'autre · en 2029, il
lit 540 000, ce qui suppose que le bénéfice de 2028 a consommé D1 ; en 2030, sa
fenêtre (2027 à 2029) ne voit plus D1 et fait consommer à ce même bénéfice
D2, qui tombe à 410 000. Le texte ne fixe pas l'ordre d'imputation ; la règle
« le plus ancien d'abord » est celle qu'OmegaX écrit et applique en 2029. Sous
la règle inverse (le plus récent d'abord), 2030 rendrait aussi 410 000 · ce
qui ne se peut pas, c'est d'appliquer l'une en 2029 et l'autre en 2030.

### C06 · Dons au-delà du plafond de l'art. 44 et pénalités (SA)

Données · chiffre d'affaires 200 000 000 ; achats 183 500 000 ; dons
65820000 3 000 000 (versements supposés à des organismes de l'art. 44,
relevé joint) ; pénalités 64710000 500 000. Comptes qualifiés par le cabinet
(`codeRetraitementFiscal`), propositions reprises telles quelles.

| Ligne | Calcul | Article |
|---|---|---|
| Résultat comptable | 200 000 000 − 183 500 000 − 3 000 000 − 500 000 = 13 000 000 | art. 9 |
| Condition du 2° | résultat avant dons 16 000 000 > 0 · ouverte | art. 44, al. 2, 2° |
| Plafond | 0,5 % × 200 000 000 = 1 000 000 ; réintégration 3 000 000 − 1 000 000 = 2 000 000 | art. 44 |
| Pénalités | 500 000 réintégrés | art. 50, 3° |
| Base | 13 000 000 + 2 000 000 + 500 000 = 15 500 000 | |
| Impôt | 30 % = 4 650 000 ; minimum 2 000 000 ; dû 4 650 000 | art. 56, 57 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Proposition dons | 2 000 000 (admis 1 000 000) | 2 000 000 (montantAdmis 1 000 000) | 0 |
| Proposition pénalités | 500 000 | 500 000 | 0 |
| Base | 15 500 000 | 15 500 000 | 0 |
| Impôt dû | 4 650 000 | 4 650 000 | 0 |

Conforme. La condition du 1° (relevé joint) et la qualité des bénéficiaires ne
se lisent dans aucune balance · OmegaX le dit.

### C07 · Dons sur un exercice déficitaire, puis report (SARL, 2026 et 2027)

Données · 2026 · chiffre d'affaires 20 000 000 ; achats 20 200 000 ; dons
300 000. 2027 · chiffre d'affaires 10 000 000 ; achats 9 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Résultat 2026 | −500 000 | art. 9 |
| Condition du 2° | résultat avant dons −200 000 · NON remplie, aucun don déductible | art. 44, al. 2, 2° |
| Réintégration | 300 000 (le versement entier, pas l'excédent) | art. 44 |
| Résultat fiscal 2026 | −200 000 · minimum 200 000 dû | art. 52, 2° ; art. 57 |
| 2027 | bénéfice 1 000 000 − déficit 200 000 = 800 000 · 30 % = 240 000 > minimum 100 000 | art. 51, 56 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Proposition 2026 | 300 000, plafond sans effet | 300 000, montantAdmis 0, « la condition n'est PAS remplie » | 0 |
| Résultat fiscal 2026 · impôt | −200 000 · 200 000 | −200 000 · 200 000 | 0 |
| 2027 · déficit imputé · impôt | 200 000 · 240 000 | 200 000 · 240 000 | 0 |

Conforme.

### C08 · Premier exercice de moins de douze mois (1er mars au 31 décembre 2026)

Données · chiffre d'affaires 40 000 000 ; achats 38 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Durée | premier exercice débutant au premier semestre, inférieur à douze mois, admis | art. 12, al. 2 |
| Impôt | 30 % × 2 000 000 = 600 000 ; minimum 400 000 (aucun prorata, l'art. 57 n'en prévoit pas) ; dû 600 000 | art. 56, 57 |
| Acomptes 2026 | aucun · pas d'exercice précédent | LPF art. 57 bis |
| Acomptes 2027 | 180 000 · 180 000 · 120 000 | LPF art. 57 bis |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt dû | 600 000 | 600 000 | 0 |
| Acomptes | aucun en 2026 ; 180 000 · 180 000 · 120 000 en 2027 | idem (observation « AUCUN acompte n'est dû au titre de la présente année ») | 0 |

Conforme.

### C09 · Premier exercice de plus de douze mois (création le 1er septembre 2026, clôture le 31 décembre 2027)

Données · du 1er septembre au 31 décembre 2026 · chiffre d'affaires
30 000 000, achats 29 900 000 (bénéfice 100 000). Du 1er janvier au
31 décembre 2027 · chiffre d'affaires 40 000 000, achats 35 000 000
(bénéfice 5 000 000).

| Ligne | Calcul | Article |
|---|---|---|
| Durée | création après le 30 juin · premier exercice clos le 31 décembre 2027, admis | art. 12, al. 3 |
| Impôt de la période de création | bénéfice des comptes intermédiaires au 31 décembre 2026 · 100 000 · taux 30 000 · minimum 1 % × 30 000 000 = 300 000 · **dû 300 000** | art. 12, al. 3 ; art. 56, 57 |
| Déclaration | au plus tard le 30 avril 2027 | LPF art. 12 [LPF1] |
| Acomptes 2027 | base 300 000 · **90 000** (25 juillet) · **90 000** (25 septembre) · **60 000** (25 novembre) | LPF art. 57 bis |
| Premier exercice clos | 5 100 000 − 100 000 déjà imposés = 5 000 000 · 30 % = **1 500 000** (minimum 700 000 ou 400 000, sans effet) | art. 12, al. 3 (« viennent ensuite en déduction ») ; art. 56, 57 |
| Solde à la déclaration de 2028 | 1 500 000 − 240 000 d'acomptes = 1 260 000 | LPF art. 57 bis, al. 3 |
| Total d'impôt | **1 800 000** | |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt de la période de création | 300 000 | 300 000 (minimum retenu, chiffre d'affaires de la période 30 000 000 ; avant : non calculé) | 0 |
| Impôt du premier exercice | 1 500 000 | 1 500 000 (5 100 000 − 100 000 ; avant : 1 530 000) | 0 |
| Total | **1 800 000** | **1 800 000** (`impotTotalExercice` ; avant : 1 530 000) | 0 |
| Acomptes 2027 | 90 000 · 90 000 · 60 000 | 90 000 · 90 000 · 60 000 au 25 juillet, 25 septembre, 25 novembre 2027 (avant : « AUCUN acompte n'est dû ») | 0 |
| Écriture A11 | deux impôts, chacun dans son exercice fiscal | refusée avec les deux lignes nommées · D 89500000 300 000, D 89110000 1 500 000, C 44100000 1 800 000 (avant : proposée à 1 530 000) | issue dite ; écriture à deux lignes au relevé en attente |

Corrigé (`periode-creation.ts`) · le bénéfice de la période se lit au livre-journal au 31 décembre, ou se DÉCLARE d'après les comptes intermédiaires (`resultatPeriodeCreationSaisi`), qui prime. Constat d'origine · montant faux (H3, H4). L'écart vient du minimum de la période de création, qui
n'existe que si cette période est imposée à part ; quand les deux périodes sont
bénéficiaires au-dessus du minimum, le total coïncide, et seul le calendrier
(déclaration 2027, acomptes 2027) est faux.

### C10 · Premier exercice ouvert en 2025 et clos en 2026 (1er septembre 2025 au 31 décembre 2026)

Données · 2025 · chiffre d'affaires 10 000 000, achats 9 000 000 (bénéfice
1 000 000). 2026 · chiffre d'affaires 50 000 000, achats 45 000 000 (bénéfice
5 000 000).

| Ligne | Calcul | Article |
|---|---|---|
| Période de création (2025) | régime antérieur au 1er janvier 2026, hors corpus de calcul · non chiffré | art. 153 ; art. 152, 2° |
| Part 2026, SI la mécanique de l'art. 12, al. 3 s'applique | 5 000 000 · 30 % = 1 500 000 ; minimum 500 000 ; dû 1 500 000 | art. 12, al. 3 ; art. 56, 57 |

| Grandeur | Attendu (lecture à confirmer) | OmegaX | Écart |
|---|---|---|---|
| Impôt affiché | 1 500 000 pour 2026, la part 2025 sous l'ancien texte | 1 500 000, sous la loi (`simulationAvantLaLoi` faux) ; période de 2025 lue (bénéfice 1 000 000, déduit), son impôt non chiffré et dit (avant : 1 800 000 dit « SIMULATION ») | 0 |
| Écriture A11 | constat de l'impôt 2026 | refusée avec issue · D 89110000 1 500 000 plus l'impôt déclaré pour 2025, au crédit du 441 (avant : refusée, « la loi ne régissait pas cet exercice ») | issue dite |

Tranché par la loi (art. 12, al. 3 et art. 153) et corrigé · voir « Après
correction ».

### C11 · Acomptes versés, imputés, et acomptes suivants avec supplément (SARL)

Données · chiffre d'affaires 80 000 000 ; achats 70 000 000 ; acompte versé
au 4492 le 25 juillet 2026 · 900 000 ; acomptes déclarés 900 000 ; supplément
établi par l'Administration 500 000.

| Ligne | Calcul | Article |
|---|---|---|
| Impôt | 30 % × 10 000 000 = 3 000 000 ; minimum 800 000 ; dû 3 000 000 | art. 56, 57 |
| Solde à payer | 3 000 000 − 900 000 = 2 100 000 | LPF art. 57 bis, al. 3 |
| Base des acomptes 2027 | 3 000 000 + 500 000 = 3 500 000 | LPF art. 57 bis, al. 1 |
| Acomptes 2027 | 1 050 000 · 1 050 000 · 700 000 | LPF art. 57 bis, al. 2 |
| Écriture | D 891 3 000 000 / C 441 ; D 441 900 000 / C 4492 900 000 | fiche du compte 89 ; LPF art. 57 bis, al. 3 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Solde à payer | 2 100 000 | 2 100 000 | 0 |
| Base et acomptes 2027 | 3 500 000 · 1 050 000 · 1 050 000 · 700 000 | idem | 0 |
| Écriture A11 avec imputation | 891 D 3 000 000 / 441 C ; 441 D 900 000 / 4492 C | idem, constat montantImpute 900 000 | 0 |
| Rapprochement 4492 | déclaré 900 000 = versé 900 000 | écart 0 | 0 |

Conforme.

### C12 · Arrondi de l'art. 150

(a) Données · chiffre d'affaires 123 456 789 ; achats 119 341 567 ; résultat
4 115 222.

| Ligne | Calcul | Article |
|---|---|---|
| Impôt au taux brut | 30 % × 4 115 222 = 1 234 566,60 | art. 56 |
| Arrondi | première décimale 6 → 1 234 567 ; tranche 67 ≥ 50 → **1 234 600** | art. 150 |
| Minimum brut | 1 % × 123 456 789 = 1 234 567,89 | art. 57 |
| Arrondi | première décimale 8 → 1 234 568 ; tranche 68 → **1 234 600** | art. 150 |
| Impôt dû | 1 234 600 dans les deux lectures | |
| Compte | AVANT arrondi, minimum > taux → 895 ; APRÈS arrondi, égaux → 891 | art. 57 ; fiche du compte 89 |
| Acomptes 2027 | 370 380 · 370 380 · 246 920 | LPF art. 57 bis |

(b) Données · chiffre d'affaires 10 000 000 ; achats 8 999 833 ; résultat
1 000 167.

| Ligne | Calcul | Article |
|---|---|---|
| Impôt au taux brut | 300 050,10 → 300 050 ; tranche 50 ≥ 50 → **300 100** | art. 56, 150 |
| Minimum | 100 000 ; dû 300 100 | art. 57 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| (a) Impôt dû | 1 234 600 | 1 234 600 | 0 |
| (a) Compte de charge | 891 ou 895 selon l'ordre arrondi / comparaison | 89110000, libellé « égaux APRÈS l'arrondi de l'art. 150 […] pas avant », valeurs avant arrondi (1 234 566,6 et 1 234 567,89) et lecture inverse (895) dites (avant : « égaux ») | dit |
| (a) Acomptes | 370 380 · 370 380 · 246 920 | idem | 0 |
| (b) Impôt dû | 300 100 | 300 100 | 0 |

### C13 · Entreprise individuelle, hors IS

Données · forme « entreprise individuelle » ; chiffre d'affaires
400 000 000 ; achats 350 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Champ | l'art. 3 n'énumère que des sociétés et personnes morales · pas d'IS | art. 3 [T2] |
| Régime | chiffre d'affaires > 300 000 000 · régime réel | art. 109, 112 [T3] |
| Impôt | barème sur le revenu net global de l'exploitant, non détenu · non chiffrable ; minimum 1 % × 400 000 000 = 4 000 000 | art. 122 [T3] |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Régime | IRPP, régime réel | `IRPP_REGIME_REEL` | 0 |
| Impôt dû | non chiffrable ici | `null` | 0 |
| Minimum de l'art. 122 | 4 000 000 | 4 000 000 | 0 |
| Écriture A11 | aucune | refusée (« Une personne physique […] n'est pas redevable de l'impôt sur les sociétés ») | 0 |

Conforme.

### C14 · Entité publique (art. 5, 1°)

Données · forme « entité publique » ; chiffre d'affaires 10 000 000 ;
achats 8 000 000.

| Ligne | Calcul | Article |
|---|---|---|
| Champ | exemptée si établissement public « en vertu de [ses] statuts » ou organisme « dont les ressources proviennent uniquement de subventions budgétaires » ; imposable si exploitation lucrative | art. 5, 1° ; art. 3, al. 2, 2° |
| Si imposable | 30 % × 2 000 000 = 600 000 ; minimum 100 000 ; dû 600 000 | art. 56, 57 |
| Si exemptée | 0 | art. 5, 1° |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Impôt affiché | 600 000 ou 0 selon le fait | 600 000, observation qui nomme l'exemption | dit |
| Écriture A11 sans attestation | refus | 400 · « Assujettissement à déclarer · entité publique · exemptée si … » | 0 |

Conforme (hypothèse dite). Voir « À trancher » sur le minimum de l'art. 57.

### C15 · Déficit de l'exercice 2025 imputé sur 2026 (SARL)

Données · 2025 · chiffre d'affaires 10 000 000, achats 12 000 000
(−2 000 000). 2026 · chiffre d'affaires 30 000 000, achats 25 000 000
(+5 000 000).

| Ligne | Calcul | Article |
|---|---|---|
| Perte 2025 | constatée et déclarée sous le régime antérieur (hors corpus) · supposée ici égale à 2 000 000 | art. 152, 153 |
| 2026, si la perte 2025 est déductible | 5 000 000 − 2 000 000 = 3 000 000 · 30 % = 900 000 ; minimum 300 000 | art. 51, 56, 57 |

| Grandeur | Attendu | OmegaX | Écart |
|---|---|---|---|
| Vue 2025 | non applicable (simulation) | impôt 100 000, avertissement « SIMULATION […] Il ne doit servir […] ni de base à un report déficitaire » | dit |
| Vue 2026 · déficit imputé · impôt | 2 000 000 · 900 000 (sous la supposition) | 2 000 000 · 900 000 | 0 |
| Vue 2026 · réserve | le déficit vient d'un exercice antérieur à la loi, recalculé | « DÉFICIT D'AVANT LA LOI, RECALCULÉ · 2 000 000 de l'exercice clos le 2025-12-31 […] » et `simulation` sur la ligne du détail (avant : aucune) | dit |

---

## Rejouer

```bash
# serveur compilé contre une base JETABLE (jamais celle de production)
createdb -h 127.0.0.1 -p 55439 -U postgres casis_1
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/casis_1 npx prisma migrate deploy
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/casis_1 JWT_SECRET=<jetable> PORT=8118 \
  INSCRIPTION_PUBLIQUE=true node dist/main.js
OMEGAX_API=http://localhost:8118 node scripts/cas-chiffres/rejeu-is.mjs rejeu-is.json
dropdb -h 127.0.0.1 -p 55439 -U postgres casis_1
```

Le script imprime un résultat par cas et écrit le détail (montants,
observations, écriture A11) dans le fichier JSON donné en argument.

---

## Après correction (2026-10-04, branche `travail/is-cas`)

Rejeu · base PostgreSQL 16 jetable `iscas_1`, serveur compilé de la branche
sur le port 8119, `scripts/cas-chiffres/rejeu-is.mjs`. Les seize dossiers
rendent l'attendu de ce document. C04 traverse les clôtures de 2026 à 2029 ;
C05 est lu avant puis après ces quatre clôtures et rend les mêmes chiffres
(2028 · 600 000 et 100 000 ; 2029 · 540 000 et 100 000 ; 2030 · 500 000 et
150 000).

### Tranché par la loi (compilation DGI au 19/07/2026, lue le 2026-10-04)

- **C09, minimum sur la période de création** · oui. Art. 12, al. 3,
  « l'impôt est néanmoins établi sur les bénéfices réalisés au cours de la
  période » · c'est l'Impôt sur les Sociétés, que le chapitre 3 du Titre II
  liquide par l'art. 56 et l'art. 57 ; l'art. 57 assujettit « les sociétés »
  sans exception de période. Le minimum joue au chiffre d'affaires de la
  période.
- **C10** · la part de 2026 relève de la loi n° 23/053. Art. 12, al. 3 · la
  période de création est imposée à part et ses bénéfices « viennent ensuite
  en déduction des résultats du premier exercice comptable clos » · l'impôt de
  ce premier exercice clos porte sur 2026, après l'entrée en vigueur du
  1er janvier 2026 (art. 153). La période de 2025 relève du texte qui la
  régissait (art. 152, 2°, hors corpus de calcul) · non chiffrée, dite.
- **C15** · ce qui s'impute en 2026 est la perte CONSTATÉE pour 2025 (art. 51,
  al. 1er, « les pertes constatées au cours d'un exercice »), sous le texte de
  l'époque · la loi n'en commande aucun recalcul (art. 153). L'imputation
  suit l'art. 51 en vigueur. OmegaX garde le montant recalculé, le dit
  simulation dans la vue 2026 et invite à saisir le déficit constaté.
- **C12a** · ni l'art. 150 (« le montant de l'Impôt sur les Sociétés, de
  l'Impôt minimum […] ») ni l'art. 57 ne fixent l'ordre de l'arrondi et de la
  comparaison · l'ordre actuel est gardé, le libellé dit l'égalité « après
  l'arrondi » et la lecture inverse.

### Rendu à Manasse (le corpus ne tranche pas) · rien codé

- **C14** · l'art. 57 dit « Les sociétés sont assujetties à un impôt
  minimum » ; l'art. 1er distingue « les sociétés et autres personnes
  morales », et l'art. 3, al. 2, 2° soumet à l'IS les « personnes morales de
  droit public n'ayant pas la forme d'une société commerciale ». Le minimum
  vise-t-il ces dernières ? OmegaX l'applique toujours (sans effet au cas).
- **C09, chiffre d'affaires du minimum du premier exercice clos** · l'art. 12,
  al. 3 ne déduit que les BÉNÉFICES de la période de création · OmegaX garde
  le chiffre d'affaires de l'exercice entier (lecture littérale d'avant), et
  le dit à l'écran.
- **C09, perte de la période de création** · « ces bénéfices » seuls viennent
  en déduction · une perte reste dans le résultat du premier exercice clos.

### Relevé en attente

- L'écriture A11 ne porte qu'un impôt et qu'un compte · au premier exercice
  long, elle se refuse en nommant les deux lignes à passer à la main.
