# Cinq questions tranchées par la loi (lecture du 2026-10-07, second lot)

Préfixe des compétences : `/root/.claude/skills/synced/80921ba8-…/` (abrégé `SK/`).
Les cinq questions sont celles que trois lignes avaient laissées ouvertes · la
ligne des cas chiffrés de l'IS (`docs/cas-chiffres/is.md`, « Rendu à Manasse »
et relevés du 2026-10-07 : C14, C09, ordre d'imputation des pertes), la ligne
TVA 24-26 (relevé du 2026-10-04 : imputation des paiements) et la ligne A7 ter
(`docs/suivi-immobilisations-verrouille.md`, décision en attente D7). Règle
appliquée : décision de Manasse du 2026-10-03, « réfère-toi toujours à la
loi ». Chaque décision cite le texte lu ; ce qu'aucun texte ne dit est écrit
comme tel. Rien n'est codé ici.

Fichiers lus, abréviations :

| Abr. | Fichier |
|---|---|
| [T1] | `SK/fiscalite-rdc/code-general-2026/references/03-loi23-053-titre1-dispositions-generales.md` |
| [T2] | `SK/fiscalite-rdc/code-general-2026/references/04-loi23-053-titre2-impot-societes.md` (Titre II en entier) |
| [T3] | `SK/fiscalite-rdc/code-general-2026/references/05-loi23-053-titre3-irpp.md` |
| [T47] | `SK/fiscalite-rdc/code-general-2026/references/06-loi23-053-titre4-7-communes-autres-abrogatoires.md` |
| [LPF1] | `SK/fiscalite-rdc/code-general-2026/references/17-procedures-titre1-obligations-declaratives.md` |
| [LPF2] | `SK/fiscalite-rdc/code-general-2026/references/18-procedures-titre2-controle.md` |
| [LPF3] | `SK/fiscalite-rdc/code-general-2026/references/19-procedures-titre3-recouvrement.md` |
| [TVA-L] | `SK/fiscalite-rdc/code-general-2026/references/10-tva-ol10-001-loi-base-ch1-10.md` |
| [TVA-D] | `SK/fiscalite-rdc/code-general-2026/references/11-tva-decret-application-ch1-4.md` et `12-tva-decret-application-ch5-8.md` |
| [CC] | `SK/code-civil-livre-iii-rdc/references/titre-01-des-contrats-ou-des-obligations-conven.md` |
| [CONST] | `SK/constitution-rdc/references/titre-3-finances-publiques-police-armees-administration.md` |
| [SY-CC] | `SK/sycebnl/references/partie1-ch2-cadre-conceptuel.md` |
| [SY-4] | `SK/sycebnl/references/partie2-ch3-classe4-comptes40-49.md` |
| [SY-5] | `SK/sycebnl/references/partie2-ch3-classe5-comptes50-59.md` |
| [SY-6] | `SK/sycebnl/references/partie2-ch3-classe6-comptes60-69.md` |
| [SY-P3] | `SK/sycebnl/references/partie3-ch5-cotisations-fondateurs.md` |
| [SY-GA] | `SK/sycebnl/references/guide-application-cas-pratiques.md` |

Lus aussi, sans y trouver de règle sur les points tranchés : `SK/fiscalite-rdc/is/NOTES.md`,
`SK/fiscalite-rdc-socle/references/parametres-2026.md`, `SK/precis-droit-fiscal-congolais-kalonji/references/`
(recherche sur le report et l'ordre des pertes), `SK/audcg-acte-uniforme/references/` (recherche sur
l'imputation des paiements).

## Synthèse

| # | Question | Issue | Effet sur le code |
|---|---|---|---|
| 1 | C14 · minimum de l'art. 57 et personne morale de droit public | TRANCHÉ · le minimum vaut pour tout redevable de l'IS | aucun changement de calcul, la question rendue est close |
| 2a | C09 · chiffre d'affaires du minimum du premier exercice long | TRANCHÉ · le chiffre d'affaires de l'année qui suit la création, sans celui de la période déjà imposée | CHANGE |
| 2b | C09 · perte de la période de création | TRANCHÉ · elle reste dans le résultat du premier exercice clos, ni déduite ni reportée à part | inchangé, message à réécrire |
| 3 | Ordre d'imputation entre plusieurs pertes (art. 51) | NON TRANCHÉ · texte muet ; la plus ancienne d'abord est la seule règle qui ne fait jamais perdre une déduction | inchangé, question gardée au suivi |
| 4 | Imputation d'un paiement partiel entre factures (TVA à l'encaissement) | TRANCHÉ · Code civil, Livre III, art. 151 à 154, applicable à l'exigibilité | CHANGE |
| 5 | D7 · impayé d'adhérent (4131, 4133) sous la méthode de l'encaissement | TRANCHÉ · aucun reclassement au 4161 | CHANGE (l'avertissement devient un refus) |

---

## 1. C14 · Le minimum de l'art. 57 et la personne morale de droit public

**Texte lu**
- Loi n° 23/053, art. 1er [T1] · l'IS est « un impôt sur l'ensemble des bénéfices réalisés par les sociétés et autres personnes morales. Cet impôt est désigné sous le nom d'Impôt sur les Sociétés ».
- Art. 3 [T2] · par la forme, « les Sociétés anonymes », « les Sociétés à responsabilité limitée », « les sociétés par actions simplifiées » ; par l'activité, notamment « 2. les personnes morales de droit public n'ayant pas la forme d'une société commerciale ou autres qui se livrent à une exploitation ou à des opérations à caractère lucratif », « 4. les associations momentanées », « 6. toutes autres personnes morales se livrant à une exploitation ou à des opérations à caractère lucratif ».
- Art. 5 et 6 [T2], « Section 2 : Des exemptions et exonérations » · art. 5, 1°, exemptés « l'Etat, les Provinces et les Entités Territoriales Décentralisées, les établissements publics, en vertu de leurs statuts, et les autres organismes de droit public dont les ressources proviennent uniquement de subventions budgétaires ».
- Dans le Titre II, le mot « société » nomme le redevable, sans condition de forme, là où la règle vaut nécessairement pour tous :
  - art. 7, al. 2 (territorialité) · « sont réputées exploitées en République Démocratique du Congo : 1. les sociétés résidentes […] 2. les sociétés non-résidentes » ; art. 8 · « Les sociétés non-résidentes sont considérées comme ayant un établissement stable » ;
  - art. 20, in fine (conditions générales de déductibilité) · « La société apporte la preuve de la déclaration et du paiement de la retenue correspondante » ;
  - art. 45 · les dégrèvements entrent « dans les recettes de l'exercice au cours duquel la société est avisée de ces dégrèvements », pendant de l'art. 14, 10°, qui compte parmi les produits de tout redevable « les dégrèvements obtenus de l'Administration au titre des impôts déductibles ».
- Quand le Titre II vise une forme, il la nomme · art. 3, al. 2, 2° (« société commerciale ») ; art. 54 (« fusion de sociétés anonymes, par actions simplifiées ou à responsabilité limitée »).
- Art. 56 et 57 forment le « CHAPITRE 3 : DU TAUX ET DE LA LIQUIDATION DE L'IMPOT ». Art. 57 · « Les sociétés sont assujetties à un impôt minimum fixé à 1 % du chiffre d'affaires déclaré, lorsque les résultats sont déficitaires ou bénéficiaires mais susceptibles de donner lieu à une imposition inférieure à ce montant. » Le même Titre nomme ce minimum, à côté de l'IS, « impôt minimum forfaitaire » (art. 42) et « minimum forfaitaire de perception » (art. 45).
- En sens contraire, lu · art. 117 [T3], « Les sociétés et autres personnes morales passibles de l'Impôt sur les Sociétés » ; LPF, art. 13 bis [LPF1] (inséré par la L.F. n° 25/060), « Les sociétés et les autres personnes morales soumises à l'impôt sur les sociétés ».
- Constitution, art. 174, al. 3 [CONST] · « Il ne peut être établi d'exemption ou d'allègement fiscal qu'en vertu de la loi. »

**Décision**
- Oui, l'art. 57 vise la personne morale de droit public imposable en raison de son activité (art. 3, al. 2, 2°) et non exemptée par l'art. 5, 1°. Dans le Titre II, une fois les redevables fixés par l'art. 3, « société(s) » désigne le redevable de l'IS quelle que soit sa forme (art. 7, 8, 20, 45) ; quand la forme compte, le texte la nomme (art. 3, art. 54). L'art. 57 appartient au chapitre de la liquidation de l'impôt de tout redevable.
- La lecture étroite (« sociétés » au sens de la forme) ferait échapper au minimum, avec la personne morale de droit public, les associations momentanées (art. 3, al. 2, 4°) et « toutes autres personnes morales » (6°) · un allègement qu'aucune disposition de la section des exemptions et exonérations (art. 5 et 6) n'accorde, alors que la Constitution exige qu'il soit établi « en vertu de la loi » (art. 174, al. 3). Les doublets « sociétés et autres personnes morales » de l'art. 1er, de l'art. 117 et de la LPF, art. 13 bis, parlent de l'IS depuis l'extérieur du Titre II (objet de la loi, IRPP, procédure) ; ils ne disent pas que le mot employé seul, à l'intérieur du Titre, exclut les autres redevables, et les art. 7, 20 et 45 montrent le contraire.

**Effet pour OmegaX**
- Aucun changement de calcul · OmegaX applique déjà le minimum à l'entité publique (cas C14, 600 000 au taux, minimum 100 000 calculé). C14 sort de « Rendu à Manasse » et passe à « Tranché par la loi ». La bulle `Aide` de l'entité publique peut dire la règle en une ligne (« le minimum de l'art. 57 s'applique à tout redevable de l'IS · art. 3, 7, 45 et 57 »).
- L'attestation exigée à l'écriture A11 pour l'entité publique reste · elle porte sur l'exemption de l'art. 5, 1° (statuts, ressources uniquement budgétaires), fait que le dossier ne dit pas, et non sur le minimum.
- Jumeau vérifié, rien à changer · l'art. 31 (« Les sociétés peuvent opter pour un système d'amortissement dégressif ») est lu de la même façon par `immobilisations/amortissement-degressif.ts`, qui n'en écarte que la personne physique.

**Hiérarchie**
- Aucun texte contraire à arbitrer · une seule loi, dont l'usage interne tranche. La Constitution (art. 174, al. 3) confirme qu'un allègement ne se tire pas d'un a contrario sur un mot.

---

## 2. C09 · Le premier exercice long · chiffre d'affaires du minimum et perte de la période de création

**Texte lu**
- Art. 12 [T2], « Section 2 : De la période imposable » ·
  - al. 1 · « L'Impôt sur les Sociétés est établi chaque année sur les bénéfices réalisés l'exercice précédent. » ;
  - al. 3 · « Les contribuables qui créent leurs entreprises postérieurement au 30 juin sont autorisés à arrêter leur premier exercice comptable le 31 décembre de l'année suivante. L'impôt est néanmoins établi sur les bénéfices réalisés au cours de la période allant du jour de la création de l'entreprise au 31 décembre de la même année. Ces bénéfices sont déterminés d'après les comptes intermédiaires arrêtés à la date du 31 décembre de l'année de création de l'entreprise. Ils viennent ensuite en déduction des résultats du premier exercice comptable clos. » ;
  - al. 4 · « Lorsqu'il est dressé des bilans successifs au cours d'une même année, les résultats en sont totalisés pour l'assiette de l'impôt dû au titre de ladite année. »
- Art. 9, al. 1 · le bénéfice imposable est « déterminé d'après le résultat de l'ensemble des activités de l'entreprise effectuées au cours de la période servant de base à l'impôt ».
- Art. 51, al. 1 · « Les pertes constatées au cours d'un exercice sont considérées comme une charge déductible du bénéfice imposable de l'exercice suivant. » ; art. 52, 2° · « le caractère bénéficiaire ou déficitaire d'un exercice doit s'apprécier par référence au résultat fiscal ».
- Art. 55 · « Les éléments déjà imposés au cours d'un exercice sont déduits du montant des revenus imposables à l'Impôt sur les Sociétés réalisés durant cet exercice, en vue d'éviter la double imposition d'un même revenu dans le chef d'un même redevable. »
- Art. 57 · « 1 % du chiffre d'affaires déclaré ».
- LPF, art. 12 [LPF1] · « Le redevable de l'impôt sur les sociétés est tenu de souscrire chaque année, au plus tard le 30 avril de l'année qui suit celle de la réalisation des revenus, une déclaration de ses revenus. » ; LPF, art. 13, al. 3 · le relevé joint à la déclaration porte sur « les ventes réelles effectuées au cours de l'année de réalisation des revenus » (aux commerçants et fabricants). Loi n° 23/053, art. 151 [T47] · ces dispositions de procédure « sont applicables à l'Impôt sur les Sociétés ».
- Art. 153 [T47] · entrée en vigueur « après vingt-quatre mois à compter du 31 décembre de l'année de sa promulgation », soit le 1er janvier 2026 ; Constitution, art. 174, al. 1 [CONST] · « Il ne peut être établi d'impôts que par la loi. »
- Décisions déjà prises (`docs/cas-chiffres/is.md`, « Tranché par la loi », 2026-10-04) · le minimum joue sur la période de création, au chiffre d'affaires de la période ; au cas C10, l'impôt du premier exercice clos « porte sur 2026 », la période de 2025 relevant du texte antérieur.

**Décision · chiffre d'affaires du minimum du premier exercice clos**
- Le minimum du premier exercice clos se calcule sur le chiffre d'affaires de l'année qui suit la création, SANS celui de la période de création. Trois raisons, toutes tirées du texte.
  1. L'impôt est annuel · « établi chaque année » (art. 12, al. 1), « dû au titre de ladite année » (al. 4). L'al. 3 découpe le premier exercice long en deux impositions · celle de la période (année de création), puis celle du premier exercice clos, dont la période déjà imposée est retranchée.
  2. Le chiffre d'affaires de l'art. 57 est « déclaré ». La déclaration est annuelle et porte sur « l'année de réalisation des revenus » (LPF, art. 12 et 13, al. 3) · le chiffre d'affaires de la période figure dans la première déclaration, où il a porté son propre minimum ; la seconde déclaration porte sur l'année suivante. Compter deux fois le même chiffre d'affaires au minimum serait la double imposition d'un même élément que l'art. 55 écarte dans son principe (l'article vise les revenus ; son objet dit l'intention).
  3. Le cas C10 rend cette lecture nécessaire · période de création en 2025, premier exercice clos en 2026. Avec le chiffre d'affaires de l'exercice entier, le minimum de la loi n° 23/053 porterait sur des ventes de 2025, antérieures à son entrée en vigueur (art. 153 ; Constitution, art. 174, al. 1). La même règle valant pour C09 et pour C10, elle ne peut retenir que le chiffre d'affaires de l'année qui suit la création. Le calcul à la main de C10 (minimum de 500 000 sur les 50 000 000 de 2026) la suivait déjà.
- L'autre lecture (chiffre d'affaires de l'exercice entier, au motif que l'al. 3 ne retranche que les « bénéfices ») est écartée · l'al. 3 règle la base du bénéfice, pas le chiffre d'affaires, et l'art. 57 renvoie au chiffre d'affaires DÉCLARÉ, que la loi de procédure rattache à l'année.

**Décision · perte de la période de création**
- La période déficitaire porte son propre minimum (art. 57, « lorsque les résultats sont déficitaires », décision du 2026-10-04). Sa perte n'est ni déduite à part ni reportée à part · l'al. 3 ne fait venir en déduction que « ces bénéfices », et l'art. 51 ne reporte que les « pertes constatées au cours d'un exercice », or la période n'est pas un exercice (le premier exercice comptable est l'exercice long, art. 12, al. 3). La perte reste donc dans les « résultats du premier exercice comptable clos » et en diminue la base.
- Si le premier exercice clos est lui-même déficitaire, c'est SA perte qui se reporte (art. 51), la fenêtre de trois exercices comptée à partir de lui ; son caractère s'apprécie sur son résultat fiscal (art. 52, 2°).
- L'impôt minimum payé sur la période ne s'impute sur rien · les art. 51 et 52 n'en prévoient pas l'imputation (règle déjà écrite dans CLAUDE.md).

**Effet pour OmegaX**
- CHANGE · `fiscalite/periode-creation.ts` et l'appel du minimum dans `fiscalite.service.ts` · chiffre d'affaires du minimum du premier exercice clos = chiffre d'affaires de l'exercice (poste XB, lecture H1 inchangée) MOINS celui de la période de création, que le module lit déjà pour le minimum de la période. `OBSERVATION_CHIFFRE_AFFAIRES_PREMIER_EXERCICE` dit la règle et ses articles (art. 12, al. 1, 3 et 4 ; art. 57 ; LPF, art. 12 et 13 ; art. 153) et perd « Lecture littérale, que le texte ne tranche pas · à faire confirmer ». La base des acomptes de l'année qui suit change avec l'impôt quand le minimum est retenu.
- Chiffres rejoués à la main · C09, minimum du premier exercice 1 % × 40 000 000 = 400 000 (au lieu de 700 000), impôt dû inchangé (1 500 000 au taux) ; C10, 1 % × 50 000 000 = 500 000, comme le calcul à la main. Un cas à ajouter où l'écart change l'impôt (période à fort chiffre d'affaires, premier exercice clos à faible bénéfice), rejoué sur vraie base à travers la clôture (§ 10 de CLAUDE.md).
- Si le bénéfice de la période est DÉCLARÉ d'après les comptes intermédiaires (`resultatPeriodeCreationSaisi`), le chiffre d'affaires retranché est celui de ces mêmes comptes · à saisir de la même façon, à défaut le livre-journal au 31 décembre de l'année de création, dit.
- INCHANGÉ · la perte de la période (`deductionPeriodeCreation` ne retient que les bénéfices). Le texte « une perte n'est pas visée » devient la règle citée (art. 12, al. 3 ; art. 51 ; art. 52, 2°), et les deux points C09 sortent de « Rendu à Manasse ».
- Hors de cette décision · la perte d'une période de création de 2025, sous le texte antérieur (relevé du 2026-10-07), reste au suivi.

**Hiérarchie**
- Pas de conflit · la loi n° 23/053 et la loi de procédure (loi n° 004/2003, modifiée par la loi n° 23/052) se lisent ensemble, l'art. 151 de la loi n° 23/053 rendant la seconde applicable à l'IS. L'art. 153 et la Constitution (art. 174, al. 1) bornent la lecture dans le temps.

---

## 3. Ordre d'imputation entre plusieurs pertes reportables (art. 51)

**Texte lu**
- Art. 51, al. 1 [T2] · « Les pertes constatées au cours d'un exercice sont considérées comme une charge déductible du bénéfice imposable de l'exercice suivant. Si ce bénéfice n'est pas suffisant pour que la déduction puisse être intégralement opérée, il est procédé à un report déficitaire sur les exercices suivants jusqu'au troisième exercice qui suit l'exercice déficitaire. »
- Art. 52 [T2] · 1° (pas de report pour le nouvel exploitant ni l'entreprise transformée) ; 2° « abstraction faite des déficits reportables des exercices antérieurs » ; 3° (amortissements réputés différés).
- LPF, art. 43, al. 3 [LPF2] · l'Administration peut remonter sur des exercices déficitaires prescrits « dès lors que les déficits réalisés au titre d'un exercice sont reportables et s'imputent sur les résultats bénéficiaires du premier exercice non prescrit dont ils constituent des charges ».
- Art. 101 [T3] (IRPP) · même fenêtre, même silence sur l'ordre.
- `SK/fiscalite-rdc-socle/references/parametres-2026.md` (« Report des déficits ») et `SK/fiscalite-rdc/is/NOTES.md` · la fenêtre, rien sur l'ordre.
- Doctrine, non source · le Précis de T.-G. Kalonji (2014) ne traite pas de l'ordre entre pertes (il ne cite le report qu'au régime minier). Témoins hors vigueur, non sources · O.-L. n° 69/009, art. 42 bis, 2°, dans la rédaction de `SK/fiscalite-rdc/historique-fiscal-abroge/references/ol-69-009-1969-impots-cedulaires-texte-origine.md` (titres III et IV abrogés, loi n° 23/053, art. 152, 2°) · « le déficit doit obligatoirement être reporté sur les résultats du premier exercice bénéficiaire […]. Les échelonnements ne sont pas autorisés », qui interdisait d'échelonner sans ordonner plusieurs déficits ; séminaire CPCC (`SK/organisation-comptable-cpcc/references/08-resultat-comptable-fiscal-ibp.md`) · un ordre plafond, pertes, amortissements différés, impôt minimum, sous le régime abrogé, rien entre deux pertes.

**Décision**
- NON TRANCHÉ par le texte. Aucun article lu ne dit quelle perte s'impute d'abord quand un bénéfice ne suffit pas à toutes. La fenêtre de trois exercices ne l'impose pas à elle seule · elle borne chaque perte, elle ne les classe pas. La lettre de l'art. 51 se prête même à deux lectures · la perte de l'exercice précédent est « une charge déductible du bénéfice imposable de l'exercice suivant », la plus ancienne n'étant plus qu'en « report » (la plus récente d'abord) ; ou toutes sont des charges égales du premier bénéfice (LPF, art. 43, al. 3).
- Ce que le texte permet de dire · l'imputation est obligatoire et sans échelonnement possible (« considérées comme une charge déductible », report seulement si « ce bénéfice n'est pas suffisant »), et toutes les fenêtres ont la même longueur, si bien que la plus ancienne s'éteint toujours la première. Imputer la plus ancienne d'abord est donc la seule règle qui ne fait jamais expirer une perte qu'un autre ordre aurait permis de déduire. Exemple · perte D1 = 100 en A, perte D2 = 100 en A+1, bénéfices de 100 en A+2 et en A+4 · la plus ancienne d'abord déduit les 200 ; la plus récente d'abord laisse D1 s'éteindre au 31 décembre de A+3 et perd 100.
- Question rendue à Manasse, avec ce qui a été lu · garder la règle d'OmegaX (la plus ancienne d'abord, la plus favorable, dite comme lecture), faute de pratique contraire de la DGI, dont le corpus ne porte aucune trace. L'enjeu est réel · si l'Administration lisait « la plus récente d'abord », la déduction de A+4 de l'exemple serait redressée.

**Effet pour OmegaX**
- Aucun changement de calcul (`fiscalite/report-deficitaire.ts`, « le plus ancien d'abord »). Le message garde « le texte ne fixe pas l'ordre » et ajoute pourquoi cette règle est retenue (aucune perte perdue qu'un autre ordre aurait sauvée). La question reste au suivi.

**Hiérarchie**
- Sans objet · aucun texte ne règle l'ordre, aucun texte n'en contredit un autre.

---

## 4. Imputation d'un paiement partiel entre plusieurs factures (TVA à l'encaissement)

**Texte lu**
- Code civil congolais, Livre III (décret du 30 juillet 1888), Titre I, « § 3 De l'imputation des payements » [CC] ·
  - art. 151 · « Le débiteur de plusieurs dettes a le droit de déclarer, lorsqu'il paye, quelle dette il entend acquitter. » ;
  - art. 152 · le paiement partiel d'une dette qui porte intérêt « s'impute d'abord sur les intérêts » ;
  - art. 153 · « Lorsque le débiteur de diverses dettes a accepté une quittance par laquelle le créancier a imputé ce qu'il a reçu sur l'une de ces dettes spécialement, le débiteur ne peut plus demander l'imputation sur une dette différente, à moins qu'il n'y ait eu dol ou surprise de la part du créancier. » ;
  - art. 154 · « Lorsque la quittance ne porte aucune imputation, le payement doit être imputé sur la dette que le débiteur avait pour lors le plus d'intérêt d'acquitter entre celles qui sont pareillement échues, sinon sur la dette échue, quoique moins onéreuse que celles qui ne le sont point. Si les dettes sont d'égale nature, l'imputation se fait sur la plus ancienne: toutes choses égales, elle se fait proportionnellement. » ;
  - art. 189 · la compensation entre plusieurs dettes suit « les règles établies pour l'imputation par l'article 154 ».
- O.-L. n° 10/001, art. 25, 2° [TVA-L] · l'exigibilité intervient « au moment de l'encaissement du prix, des acomptes ou avances, pour les prestations de services et les travaux immobiliers ».
- Décret n° 011/42, art. 57 [TVA-D] · « L'encaissement s'entend de la perception des sommes, à quelque titre que ce soit, notamment avances, acomptes et règlement pour solde, du fait de la réalisation de l'opération ou de l'exécution des travaux. » ; art. 96 · le droit à déduction naît « lorsque la taxe devient exigible chez l'assujetti », qui « s'entend du fournisseur de biens ou du prestataire de services ».
- Aucun texte de la TVA lu (O.-L. n° 10/001, décret n° 011/42) ne règle l'imputation d'un paiement entre factures. L'AUDCG n'en porte aucune (recherche sur « imputation » et « imputer » dans `SK/audcg-acte-uniforme/references/`). AUDCIF, Titre VI, définition « ACTE UNIFORME (OHADA) » (`SK/audcif-acte-uniforme/references/titre-6-definitions-termes/05-a.md`) · les Actes uniformes sont applicables « nonobstant toute disposition contraire de droit interne antérieure ou postérieure ».
- Ce qu'OmegaX fait aujourd'hui (CLAUDE.md, « TVA à l'encaissement (ligne A7 bis) » ; `tva/taux-tva.service.ts`, `fractionsDuGroupe`) · « AUCUN PRORATA ENTRE FACTURES D'UN GROUPE (décision du 2026-10-04, convention qu'aucun texte ne fixe) » ; groupe à plusieurs factures de même composition, taxe exigible à chaque encaissement, la même « quelle que soit l'imputation » ; groupe de composition différente, règle de `main` (fraction cumulée du groupe, qui retarde la taxe) et groupe NOMMÉ (`groupesImputationIndeterminee`), au motif, écrit dans le code, que « le Code civil congolais des obligations n'y est pas ». Il y est désormais.

**Décision · ce que la règle civile commande**
- Une somme partielle reçue d'un débiteur de plusieurs factures s'impute, dans cet ordre ·
  1. sur la facture que le CLIENT a désignée en payant (art. 151) · par exemple la facture citée sur l'ordre de virement ou la lettre qui accompagne le paiement ;
  2. à défaut, sur celle qu'a désignée une quittance du créancier que le client a acceptée (art. 153) ;
  3. à défaut, selon l'imputation légale (art. 154) · d'abord les factures ÉCHUES à la date du paiement, avant celles qui ne le sont pas ; entre factures dans la même situation, celle que le débiteur avait le plus d'intérêt à acquitter (dette productive d'intérêts, assortie d'une pénalité ou d'une sûreté ; l'art. 152 met les intérêts avant le capital) ; entre factures d'égale nature, la PLUS ANCIENNE ; toutes choses égales, au PRORATA.
- Deux lectures dites · (a) un lettrage posé par le cabinet du créancier n'est ni la déclaration du débiteur (art. 151) ni une quittance acceptée par lui (art. 153) · il ne fixe pas l'imputation ; (b) « la plus ancienne » n'est pas définie · OmegaX lira la dette née la première (date de la facture), l'échéance servant déjà au premier critère (échue ou non) ; l'autre lecture (échéance la plus ancienne) est dite en réserve, les deux coïncidant pour des factures à même délai de paiement.

**Décision · la règle s'applique à l'exigibilité**
- Oui. L'art. 25, 2° rend la taxe exigible à « l'encaissement du prix » d'une prestation, et l'art. 57 du décret définit l'encaissement comme la perception des sommes « du fait de la réalisation de l'opération » · la taxe rendue exigible est celle de l'opération dont la somme paie le prix. Savoir quelle dette une somme paie est une question du droit des obligations, que les textes de la TVA ne règlent ni ne modifient · le droit commun s'applique.
- Conséquence · une somme perçue est toujours imputée sur une facture déterminable ; l'imputation n'est jamais « indéterminée », et rien dans le texte ne permet d'attendre le solde du groupe pour rendre la taxe exigible.
- Côté achats, le dossier est le débiteur · son imputation est celle qu'il déclare en payant (art. 151 ; la désignation des factures dans son règlement), et le droit à déduction suit l'exigibilité chez le prestataire (décret, art. 96), donc cette même imputation.

**Effet pour OmegaX**
- CHANGE · groupe de composition différente · la taxe de chaque somme perçue devient exigible à sa date sur la ou les factures que désigne l'imputation (déclarée, sinon légale), au lieu de la fraction cumulée de `main`. `groupesImputationIndeterminee` cesse de nommer ces groupes comme indéterminés ; la déclaration dit l'imputation retenue et son fondement (« imputation légale, Code civil, Livre III, art. 154 », ou « déclarée par le client, art. 151 »). Restent nommés pour leurs propres motifs · avoir dans le groupe (une note de crédit annule sa facture, ce n'est pas un paiement), ligne illisible, à-nouveau dont la facture n'est pas retrouvée.
- CHANGE · une IMPUTATION DÉCLARÉE se saisit par règlement (factures désignées par le client, ou par la quittance qu'il a acceptée, avec la pièce qui le prouve), au journal d'audit, et prime sur l'imputation légale. Un mois déjà liquidé reste ce qu'il a déclaré (`tvaEncaissementFigee`) ; l'écart se reporte au premier jour non liquidé, même mécanique que la règle (4) d'A7 bis.
- CHANGE · la convention « aucun prorata entre factures d'un groupe » tombe · le prorata est la règle de dernier rang de l'art. 154 (« toutes choses égales ») ; entre factures de dates différentes, la plus ancienne d'abord. OmegaX ne lit sur une facture ni intérêt, ni pénalité, ni sûreté · il les tient pour d'égale nature et le dit ; le cabinet peut déclarer une dette plus onéreuse, qui passe alors devant.
- INCHANGÉ · groupe de même composition (toute imputation rend la même taxe, `fractionsDuGroupe`) ; facture seule ; créance non lettrée sans paiement.
- JUMEAUX, à reprendre dans la même ligne ·
  1. le recouvrement d'une créance douteuse à plusieurs factures désignées est réparti « au prorata de ce qui est recouvré sur le montant reclassé » (`creances-douteuses.service.ts`, `designerFactures`) · sauf imputation déclarée, ces factures sont toutes échues et l'art. 154 impute sur la plus ancienne d'abord, le prorata ne valant qu'entre factures de même date ;
  2. le paiement reçu sur le compte du client et laissé sans lettrage (« paiement non rattaché », AU1) s'impute lui aussi, par l'art. 154, sur les factures échues ouvertes · la déclaration peut dire cette imputation au lieu de la renvoyer au cabinet ; l'avance sans facture (419) reste exigible à sa date (art. 25, 2°, « acomptes ou avances ») ;
  3. côté fournisseurs, le Règlement des tiers fixe l'imputation du dossier débiteur (art. 151) · un règlement partiel dit quelles factures il paie, et c'est cette désignation qui date la déduction.
- `tva-groupes-comme-main.spec.ts`, qui gèle la règle de `main` pour les groupes sans créance désignée, est à revoir pour les seuls groupes de composition différente ; le commentaire de `fractionsDuGroupe` (« OmegaX NE CHOISIT DONC AUCUNE RÈGLE D'IMPUTATION ») et la phrase de CLAUDE.md sur la convention sont à réécrire à l'intégration de la ligne qui code la règle.

**Hiérarchie**
- Pas de conflit · la loi de la TVA et son décret (textes spéciaux) fixent le moment de l'exigibilité et le rattachent à l'encaissement du prix d'une opération ; ils se taisent sur l'imputation, que le Code civil, Livre III, droit commun des obligations, règle. Le texte spécial ne déroge au général que là où il dispose ; il ne dispose pas ici. Aucun Acte uniforme (AUDCG) ne porte de règle contraire, si bien que la primauté des Actes uniformes ne l'écarte pas. Le décret n° 011/42, acte d'exécution de l'O.-L. n° 10/001, ne contredit ni l'une ni l'autre.

---

## 5. D7 · Impayé d'adhérent sous la méthode des cotisations à l'encaissement (SYCEBNL)

**Texte lu**
- Cadre conceptuel du SYCEBNL, § 5.4.2.1 [SY-CC] · « Le fait générateur de la comptabilisation des cotisations et du droit d'entrée est l'appel de cotisation ou de paiement du droit d'entrée. Toutefois, si l'entité ne peut justifier d'un droit d'agir en recouvrement, les cotisations et le droit d'entrée sont comptabilisés lors de leur encaissement effectif. » Repris pour les cotisations en Partie 3, ch. 5, section 1, § 1.1 [SY-P3].
- Même cadre · § 5.4.1, « Un actif est pris en compte dans le bilan à la date de prise de son contrôle par l'entité à but non lucratif », « Un produit est pris en compte dans le compte de résultat dès qu'il est acquis » ; § 3.3.1.2.2 (prudence), « Les actifs et les produits ne doivent pas être surévalués » ; § 3.3.1.2.4, les produits et charges d'exercices précédents omis « doivent transiter par le compte de résultat du nouvel exercice ».
- Partie 3, ch. 5, § 1.2 [SY-P3], et Guide d'application, Application 13 [SY-GA] · « Pour le transfert de la créance en créance douteuse », D 4161 / C 411, après un APPEL (D 411 / C 701). Application 2, note préliminaire · « Si l'entité peut justifier le droit d'agir pour recouvrer l'appel, le compte 411 Adhérents peut être utilisé pour constater la créance. Sinon, constater le produit lors de l'encaissement effectif. »
- Fiche SYCEBNL du compte 41 [SY-4] · subdivisions « 4131 Adhérents, chèques impayés », « 4133 Adhérents, autres valeurs impayées », « 4161 Adhérents cotisations litigieuses ou douteuses » ; Commentaires, « Figurent à ce compte les créances liées aux appels de cotisations des adhérents et à la vente de biens et de services », et « Les chèques, effets à payer et autres valeurs revenus impayés doivent être enregistrés dans le compte 413 Adhérents, clients-usagers chèques, et autres valeurs impayés pour un meilleur suivi des incidents de paiements » ; Fonctionnement, « Pour les créances litigieuses ou douteuses : sont crédités les comptes 411 et 412 […] des créances litigieuses ou douteuses ; par le débit : du compte 416 […] ».
- Fiche SYCEBNL du compte 51 [SY-5] · « Les valeurs à encaisser sont les effets, chèques et autres valeurs transmis à la banque et dont l'entité attend l'encaissement à l'échéance. » ; « Les chèques à l'encaissement sont les chèques transmis à la banque qui n'ont pas encore été crédités par cette dernière. » ; le compte se solde « lors de la réception de l'avis de crédit ».
- Fiche SYCEBNL du compte 49 [SY-4] · « La dépréciation doit être certaine quant à sa nature et l'élément d'actif en cause doit être individualisé » ; elle se constitue « Lorsqu'au jour de l'inventaire, la valeur économique réelle des créances est inférieure à leur valeur comptable ».
- Fiche SYCEBNL du compte 65 [SY-6] · « Les créances des adhérents, clients et autres débiteurs irrécouvrables sont enregistrées au débit du compte 651 ».

**Décision**
- Non, l'impayé ne se reclasse pas au 4161. Sous la méthode de l'encaissement, la cotisation (comme le droit d'entrée) n'a pas d'autre fait générateur que son « encaissement effectif » (§ 5.4.2.1). Le SYCEBNL dit lui-même ce qu'est l'encaissement d'une valeur · le chèque remis est une valeur « à encaisser », dont l'entité « attend l'encaissement », et l'encaissement se constate à l'avis de crédit (fiche du compte 51). Une valeur « revenue impayée » (fiche du compte 41) n'a donc jamais été encaissée · la cotisation n'a pas de fait générateur, le produit n'est pas acquis (§ 5.4.1), et le 4131 ou le 4133 ne porte aucune créance de cotisation, faute du droit d'agir que la méthode suppose précisément absent. Les créances d'adhérents du compte 41 sont celles « liées aux appels de cotisations » (fiche du compte 41), et le transfert au 4161 suit un appel (Partie 3, ch. 5, § 1.2 ; Application 13).
- Il n'y a donc rien à reclasser au 4161, rien à déprécier au 491 (fiche du compte 49 · un élément d'actif), rien à passer en perte au 6512 (fiche du compte 65 · une créance irrécouvrable).
- Le 413 garde son rôle, le suivi des incidents (fiche du compte 41) · l'impayé y est enregistré, puis soldé contre le produit (ou le droit d'entrée) constaté à tort à la remise de la valeur. Dans le même exercice, c'est la contre-passation de cette écriture. Si la remise et l'impayé tombent dans deux exercices, la correction passe par le résultat de l'exercice de l'impayé (§ 3.3.1.2.4, qui ne réserve aux capitaux propres que le changement de méthode à impact fort significatif et la correction d'une erreur significative) ; aucune fiche lue ne nomme le compte de cette correction.
- Si l'entité peut en réalité justifier d'un droit d'agir en recouvrement, c'est la méthode déclarée qui est fausse · l'APPEL s'applique (§ 5.4.2.1 ; Application 2), la créance naît au 411 et suit le 4161.
- Les deux textes que la question opposait ne se contredisent pas · la fiche du compte 41 dit OÙ s'enregistre un impayé ; le § 5.4.2.1 dit SI la cotisation et la créance existent ; la fiche du compte 51 dit ce qu'est l'encaissement.

**Effet pour OmegaX**
- CHANGE · `creances-douteuses/creances-douteuses.ts`, `motifRefusCotisationsEncaissement` · sous `ENCAISSEMENT`, le 4131 et le 4133 sont REFUSÉS comme le 411, par un refus nommé (§ 5.4.2.1 ; fiches des comptes 41 et 51) qui dit les deux issues · solder l'impayé contre le produit ou le droit d'entrée constaté à la remise ; ou déclarer la méthode de l'APPEL si l'entité justifie d'un droit d'agir. `avertissementMethodeCotisations` perd sa branche « impayé d'adhérent sous l'encaissement ». Même refus pour la perte au 6512 d'un impayé d'adhérent sous l'encaissement.
- Les créances déjà reclassées depuis un 4131 ou un 4133 sous l'encaissement (admises avec avertissement jusqu'ici) sont SIGNALÉES (information, liste bornée qui dit son total), jamais défaites d'office · issue nommée · annuler la revue puis le reclassement (gestes existants, A7 B2 et m2), puis solder l'impayé.
- INCHANGÉ · la méthode lue reste celle déclarée au jour du geste (relevé m-f, `Tenant.methodeCotisations` sans historique) ; méthode non déclarée, avertissement seulement.
- D7 sort du tableau « Décisions en attente de Manasse » du suivi.
- Connexe, non tranché ici · la fiche du compte 41 ne nomme que le 411 et le 412 au crédit du transfert vers le 416 ; l'admission du 413 comme compte d'origine SOUS L'APPEL (relevé du 2026-10-03) reste à relire.

**Hiérarchie**
- Aucun conflit à arbitrer · tous les passages appartiennent au même Acte uniforme (le SYCEBNL et son annexe). S'il fallait les classer, la règle spéciale des cotisations (§ 5.4.2.1 ; Partie 3, ch. 5) l'emporterait sur la règle générale d'enregistrement des impayés (fiche du compte 41).

---

## Suites dans les documents de suivi

- `docs/cas-chiffres/is.md`, « Rendu à Manasse » · C14 et les deux points de C09 passent à « Tranché par la loi » avec les articles ci-dessus ; l'ordre d'imputation des pertes reste rendu, avec la lecture de la section 3.
- `docs/suivi-immobilisations-verrouille.md` · D7 réglée par la loi ; la question du relevé TVA 24-26 (« règle d'IMPUTATION DES PAIEMENTS (Code civil congolais, Livre III, hors corpus) ») est réglée, le texte étant au corpus ; les lignes de travail sont celles marquées CHANGE.
- CLAUDE.md · « AUCUN PRORATA ENTRE FACTURES D'UN GROUPE (décision du 2026-10-04, convention qu'aucun texte ne fixe) » et « l'imputation, que le corpus ne règle pas » sont à remplacer par la règle des art. 151 à 154 du Code civil, à l'intégration de la ligne qui la code.
