# Décisions par la loi · paie (questions T1 à T9)

Date · 2026-10-07. Objet · trancher par la loi les neuf questions de la section « À trancher » de `docs/cas-chiffres/paie.md` (branche `travail/paie-cas`), selon la décision de Manasse du 2026-10-03 (« réfère-toi toujours à la loi »). Analyse en lecture seule : aucun code n'a été touché.

**Sources.** Toutes les sources sont dans les compétences installées, sous `/root/.claude/skills/synced/80921ba8-2ca0-4a8a-b7c1-4d4972fcb762_a1cd7539-5871-4b3d-820b-8de8737ca38b/`. Les chemins ci-dessous sont relatifs à ce dossier. Chaque citation est recopiée mot pour mot du fichier nommé.

**Règle P5.** La règle du dépôt (CLAUDE.md, P5 : « Une règle de protection ne se tranche pas contre celui qu'elle protège ») n'est employée que là où c'est dit (T8 et T9).

## Synthèse

| # | Question | Décision | Statut | Effet dans les cas chiffrés |
|---|---|---|---|---|
| T1 | INPP et ONEM | Impôts et taxes, pas charges sociales. INPP au 6415, ONEM au 6413, dette au 4428. Les comptes 4334 et 4335 ne sont pas admis pour cet usage. | Tranché | P14 · 88 888,89 passent de 6641 à 6415 et 6413. La valeur ajoutée baisse d'autant, l'EBE ne bouge pas. |
| T2 | Art. 123 sur un impôt plafonné | Ordre · plafond puis quotité (OmegaX juste). Répartition · le texte la borne sans choisir dans l'intervalle. | Tranché en partie | P03 · 2 216 800 (OmegaX, borne haute) à 2 225 600 (borne basse) |
| T3 | Logement à 30 % | Condition (tout ou rien) | Tranché | P04 · 183 100 gardé |
| T4 | Plancher CNSS de mai à décembre 2025 | SMIG payé, 14 500 FC par jour | Tranché | P07 (d) · base 400 000, part ouvrière 20 000 |
| T5 | Septembre 2025 | ONEM à 0,5 % (art. 6). INPP selon la date de versement. Base trimestrielle de l'INPP non tranchée. | Tranché en partie | P08 · ONEM 5 000 ; INPP 35 000 si la paie est versée le 24/09 ou après, 30 000 sinon |
| T6 | Tranche d'ancienneté (art. 141) | Jour entier, sans prorata | Tranché | P13 · 462 000 (+7 000) |
| T7 | Indemnité de préavis | Dans l'assiette sociale. Impôt au mois de mise à disposition, sans taux spécial. | Tranché (méthode mensuelle · convention H1) | P13 · inchangé |
| T8 | Salaire en dollars | Date du cours = mise à disposition. Source du cours non fixée par la loi. Arrondi au centime supérieur (P5). | Tranché en partie | P09 · inchangé (343 455,13) |
| T9 | Samedi qui porte le congé d'un férié tombé un dimanche | Non ouvrable (P5). L'indemnité se lit sur la rémunération du délai : C4 ne se corrige pas vers 76. | Tranché avec P5, et constat nouveau | P13 délégué · 79 jours rémunérés, 3 318 000 (salaire à la journée) |

---

## T1 · INPP et ONEM : charge sociale ou impôt et taxe ? Et quelle dette ?

### Texte lu

1. **AUDCIF, Titre VII, fiche du compte 64** (`audcif-acte-uniforme/references/titre-7-comptes-classe-6.md`).
   - Contenu : « versements obligatoires à l'État et aux collectivités publiques pour subvenir à des dépenses publiques, ou encore des versements institués par les autorités pour le financement d'actions d'intérêt général ».
   - Subdivisions : « 6413 taxes sur appointements et salaires · 6414 taxes d'apprentissage · 6415 formation professionnelle continue ».
   - Commentaires : « 6413 Taxes sur appointements et salaires : versements obligatoires dont l'entité est redevable en qualité d'employeur, au titre des traitements, salaires, indemnités et émoluments versés. »
   - Fonctionnement : « Débité du montant de l'impôt dû, par le crédit du compte 44 (État et Collectivités publiques) ou par le crédit des comptes de trésorerie. »
2. **Même fichier, fiche du compte 66.**
   - Contenu : « les charges sociales payées par l'entité au titre des salaires ».
   - Exclusions : « Les impôts dont l'assiette repose sur la rémunération → 6413 (Taxes sur appointements et salaires). »
3. **AUDCIF, fiche du compte 43** (`audcif-acte-uniforme/references/titre-7-comptes-classe-4.md`).
   - Contenu : « le montant des cotisations sociales salariales et patronales dues aux organismes sociaux ».
   - Subdivisions : 431 Sécurité sociale, 432 Caisses de retraite complémentaire, 433 Autres organismes sociaux (« 4331 mutuelle · 4332 assurances retraite · 4333 assurances et organismes de santé »).
   - Au compte 44 : 442 (« 4421 impôts et taxes d'État · 4422 impôts et taxes pour les collectivités publiques · [...] · 4428 autres impôts et taxes »).
4. **SYCEBNL, Partie 2 ch. 3** (`sycebnl/references/partie2-ch3-classe6-comptes60-69.md`, `partie2-ch3-classe4-comptes40-49.md`).
   - Mêmes contenus pour les comptes 64 et 43. Les comptes 6413, 6414, 6415 et 4428 sont ouverts sous les mêmes intitulés.
   - Le compte 66 « ne doit pas servir à enregistrer : les impôts dont l'assiette repose sur la rémunération », avec renvoi au 6413.
   - Le Guide d'application (`sycebnl/references/guide-application-cas-pratiques.md`) distingue les « Charges fiscales sur salaires » (6413 / 4421) des « Charges sociales » (664 / 431).
5. **Code du travail** (`droit-travail-congolais/references/texte-loi-verbatim/02-titre-ii-de-la-formation-et-du-perfectionnement-professionnels.md`).
   - Art. 8 : « Tout employeur public ou privé a l'obligation d'assurer la formation, le perfectionnement ou l'adaptation professionnelle des travailleurs qu'il emploie. A cette fin, il pourra utiliser les moyens mis à sa disposition [...] par l'Institut National de Préparation Professionnelle. »
   - Art. 15 b) : « la cotisation mensuelle des employeurs proportionnelle à la somme des rémunérations versées par eux à leur personnel au cours du trimestre précédent ».
6. **Code du travail, art. 204 et 205** (`.../09-titre-ix-de-l-administration-du-travail.md`).
   - L'ONEM est un « établissement public à caractère technique et social ».
   - Sa mission est « de promouvoir l'emploi et de réaliser, en collaboration avec les organismes publics ou privés intéressés, la meilleure organisation du marché de l'emploi ».
   - Arrêté n° 028/2025, art. 1er (`onem-rdc/references/arrete-028-2025-contribution-patronale.md`) : « Le taux de contribution due à l'Office National de l'Emploi [...] par chaque employeur [...] est fixé à 0,5 % de la rémunération mensuelle payée par l'employeur à ses travailleurs. »
7. **Loi n° 16/009, art. 1er** (`cnss-cotisations-sociales-rdc/references/loi-16-009-2016-regime-general-securite-sociale.md`). Le régime général de sécurité sociale « couvre les branches suivantes » : risques professionnels, prestations aux familles, pensions. Ni la formation professionnelle ni l'emploi n'en font partie.
8. **Règles d'ouverture des subdivisions.**
   - AUDCIF art. 18, al. 3 et 4 (`audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md`) : « Lorsque les comptes prévus par le Système comptable OHADA ne suffisent pas, l'entité peut ouvrir toutes subdivisions nécessaires. » ; « Les opérations sont enregistrées dans les comptes dont les intitulés correspondent à leur nature. »
   - Titre VII ch. 2 sect. 2 (`titre-7-ch1-2-cadre-codification.md`) : « la codification et l'intitulé des comptes du Système comptable OHADA doivent être respectés ; les nouveaux comptes non prévus sont approuvés selon les procédures en vigueur ».
   - L'art. 3 de l'Acte uniforme SYCEBNL (`sycebnl/references/acte-uniforme-articles-1-28.md`) écarte l'art. 18 de l'AUDCIF. La règle propre du SYCEBNL, Partie 2 ch. 2 sect. 1 (`sycebnl/references/partie2-ch2-plan-comptes.md`) : « Le Plan des comptes peut être complété par des codes établis en fonction des besoins et en respectant l'arborescence et les principes d'élaboration. »

### Décision

**La charge va au compte 64, pas au 664.**
- La cotisation INPP et la contribution ONEM sont des « versements institués par les autorités pour le financement d'actions d'intérêt général » : la formation de la population active pour l'INPP (art. 12), la promotion de l'emploi pour l'ONEM (art. 205). Elles sont assises sur la rémunération et dues par l'employeur en cette qualité. C'est la définition du compte 64, et la fiche du 66 exclut expressément « les impôts dont l'assiette repose sur la rémunération ».
- Ce ne sont pas des cotisations sociales au sens du 43 :
  - ni l'INPP ni l'ONEM ne gère une branche de sécurité sociale (loi n° 16/009, art. 1er) ;
  - toutes les subdivisions du 43 désignent des organismes de protection (sécurité sociale, retraite, mutuelle, assurance, santé).
- Le mot « cotisation » (art. 15 b) ou « contribution » (arrêté n° 028/2025) ne fait pas le compte. Le plan classe par nature (AUDCIF art. 18, al. 4).

**Le sous-compte de chaque prélèvement.**
- **INPP → 6415 « Formation professionnelle continue »**, aux deux plans. L'intitulé correspond à l'objet du prélèvement : l'art. 8 oblige l'employeur à former « les travailleurs qu'il emploie ». Le 6414 « Taxes d'apprentissage » ne convient pas : le contrat d'apprentissage (Titre III) ne porte aucun prélèvement.
- **ONEM → 6413 « Taxes sur appointements et salaires »**, aux deux plans. La fiche du 66 y renvoie tout impôt assis sur la rémunération, et la définition du 6413 (« versements obligatoires dont l'entité est redevable en qualité d'employeur, au titre des traitements, salaires... ») décrit la contribution ONEM mot pour mot. Au SYCEBNL, la définition du 6413 dit « à l'Etat », mais c'est le renvoi de la fiche 66 qui décide.

**La dette va au 4428.**
- La fiche du 64 débite la charge « par le crédit du compte 44 ».
- Au 442, la subdivision qui reçoit ce qui n'est ni un impôt d'État proprement dit ni un impôt des collectivités est **4428 « Autres impôts et taxes »**, ouverte aux deux plans.
- Ce n'est pas le 447, puisque rien n'est retenu sur le salarié.

**Les comptes 4334 et 4335 ne sont pas admis pour cet usage.**
- Une entité peut ouvrir des subdivisions (AUDCIF art. 18, al. 3 ; SYCEBNL Partie 2 ch. 2 sect. 1), à trois conditions lues :
  1. les comptes prévus ne suffisent pas ;
  2. la subdivision respecte l'arborescence, donc la nature du parent (art. 18, al. 4) ;
  3. les numéros et intitulés officiels sont respectés.
- Ici, les deux premières conditions manquent : le plan prévoit déjà 4428, et ranger une dette d'impôt sous 433 « Autres organismes sociaux » contredit la nature du parent et la fiche du 64.
- Ce qui est permis : des subdivisions de 4428 au cinquième chiffre, une pour l'INPP et une pour l'ONEM, si le cabinet veut les suivre à part.

**Effet chiffré dans P14.**
- 6641 : 377 777,77 devient 288 888,88.
- 6415 : 77 777,78 ; 6413 : 11 111,11.
- 4428 : −88 888,89, au lieu des comptes 4334 et 4335.
- Le total des charges ne change pas. Au compte de résultat SYSCOHADA (`audcif-acte-uniforme/references/titre-9-ch1-5-bilan-resultat-flux.md`), la somme passe de RK « Charges de personnel » (note 27) à RI « Impôts et taxes » (note 25). La valeur ajoutée XC baisse de 88 888,89. L'excédent brut d'exploitation XD (= XC + RK) ne bouge pas.

### Effet pour OmegaX

- **`passation-paie.ts`** :
  - charges de l'INPP et de l'ONEM au 64150000 et au 64130000 au lieu du 66410000 ;
  - dette au 44280000 au lieu des 43340000 et 43350000, aux deux référentiels (numéros vérifiés dans les deux semis) ;
  - le temps « PATRONALES » se scinde : la CNSS reste au 6641 contre le 431 et le 4313 (ou 4321), l'INPP et l'ONEM vont au 64 contre le 4428.
- **`retenues/correspondance-retenues.ts`** : clés `inpp` et `onem` vers le 4428.
- **Semis** :
  - retirer les comptes 43340000 et 43350000 des deux plans pour les dossiers nouveaux. Au SYSCOHADA, leur ajout à la main contredit déjà le § 7 du CLAUDE.md (« Ne pas le retoucher à la main ») ;
  - dossiers existants : les comptes mouvementés sont mis en sommeil, jamais supprimés. Les écritures déjà passées se corrigent par la réimputation (point 9) dans les exercices ouverts ; rien n'est touché dans un exercice clos.
- **Documentation et tests** : réécrire CLAUDE.md P0 et P3 (« DIX-HUIT RÔLES ») et inverser les tests qui gèlent 4334 et 4335.

### Hiérarchie

- Aucune contradiction. Les textes congolais nomment le prélèvement ; l'Acte uniforme et le SYCEBNL décident du compte par la nature de l'opération.
- Le séminaire CPCC (D 6641, C 4331 et 4332) est une doctrine, déjà relevée fausse sur les comptes.
- La note `fiscalite-rdc/parafiscalite-sociale/NOTES.md` renvoie au 4331 (mutuelle) : à corriger dans la compétence.

---

## T2 · Art. 123 de la loi n° 23/053 appliqué à un impôt plafonné

### Texte lu

- **Loi n° 23/053, art. 118** (`fiscalite-rdc/code-general-2026/references/05-loi23-053-titre3-irpp.md`). Le barème s'applique « sur le revenu net global arrondi au millier de Francs congolais inférieur ». Al. 2 : « En aucun cas, l'impôt total ne peut excéder 30 % du revenu imposable. »
- **Art. 123.**
  - Al. 1 : « L'impôt établi par application de l'article 118 ci-dessus est réduit d'une quotité de 2 % pour chacun des membres de la famille à charge au sens de l'article 124 ci-dessous, avec un maximum de 9 personnes. »
  - Al. 2 : « Aucune réduction n'est accordée sur l'impôt qui se rapporte à la partie du revenu imposable qui excède la troisième tranche du barème fixé à l'article 118 ci-dessus. »
- **Art. 119** : l'impôt est « calculé par application du barème d'imposition visé à l'article 118, alinéa 1er ». Art. 121, al. 1 : « L'impôt obtenu par l'application du barème d'imposition visé à l'article 118 ».
- **Même clause dans le texte d'origine**, O.-L. n° 69/009 rédaction 2012, abrogée et lue seulement pour la rédaction (`fiscalite-rdc/historique-fiscal-abroge/references/ordonnances-lois-21-septembre-2012/04-ol-004-2012-impots-cedulaires.md`).
  - Art. 84, par. 2 : « En aucun cas, l'impôt total ne peut excéder 30 % du revenu imposable. »
  - Par. 4 : « l'impôt professionnel individuel, après déduction des charges de famille prévues à l'article 89 de la présente Ordonnance-loi, ne peut être inférieur à 1.500 Francs congolais par mois ».
  - Art. 89 : « L'impôt établi par application de l'article 84 [...] est réduit d'une quotité de 2% » et « la septième tranche du barème fixé au paragraphe premier de l'article 84 ».
- **Commentaire de compétence** (pas une source), `fiscalite-rdc/irpp/NOTES.md` : « Barème, puis réduction, puis plafond, puis arrondi. L'article 118 in fine vise « l'impôt total », ce qui suppose la réduction déjà opérée ».

### Décision

**1. L'ordre est tranché : plafond d'abord, quotité ensuite.**
- « L'impôt établi par application de l'article 118 » est l'impôt des deux alinéas de l'art. 118, plafond compris.
- Quand le législateur ne vise que le barème, il l'écrit :
  - deux articles plus haut, à l'art. 119 (« article 118, alinéa 1er ») ;
  - à l'art. 121 (« barème [...] visé à l'article 118 ») ;
  - dans l'art. 123 même, al. 2 (« troisième tranche du barème fixé à l'article 118 »).
- Le texte d'origine faisait la même distinction (« article 84 » contre « paragraphe premier de l'article 84 »). Quand il voulait un montant après charges de famille, il l'écrivait (« après déduction des charges de famille », par. 4) ; le mot « l'impôt total » du plafond ne le dit pas.
- L'ordre de la note de compétence est donc contraire au texte. Sur P03 avec quatre personnes, il rendrait 2 280 000 par mois, la quotité étant absorbée.

**2. La répartition de l'impôt plafonné n'est écrite nulle part.**
- Le texte la borne seulement :
  - la part de l'impôt « qui se rapporte » au revenu en deçà de la troisième tranche ne peut dépasser ce que le barème lui impute (9 486 720), puisque le plafond ne fait que réduire ;
  - la part au-delà ne peut dépasser 19 200 000 ; la base de la quotité est donc au moins 27 360 000 − 19 200 000 = 8 160 000.
- Les trois lectures du document tombent dans l'intervalle [8 160 000 ; 9 486 720] :
  - 2 216 800 par mois, lecture d'OmegaX (borne haute) ;
  - 2 219 700, prorata (base 9 047 972,69) ;
  - 2 225 600, borne basse.
- Une lecture « 30 % pour chaque part » (base 12 960 000) est exclue : elle ferait porter au bas du revenu plus d'impôt que le barème.
- Un élément arithmétique va dans le sens d'OmegaX, sans être décisif. Le barème jusqu'à 43 200 000 donne 21,96 % (9 486 720 / 43 200 000), sous les 30 %. Seule la tranche à 40 % peut faire mordre le plafond, et la réduction du plafond se rapporte donc à elle.
- La règle P5 ne s'applique pas : l'art. 123 est une règle fiscale, non une protection du Code du travail.
- **Non tranché dans l'intervalle**, remonte à Manasse. L'écart maximal est de 8 800 FC par mois sur P03, et la retenue reste un acompte (art. 121).

### Effet pour OmegaX

- `bareme-irpp.ts` (`impotAnnuel`) : ordre et montant gardés.
- La réserve « LECTURE DE L'ÉDITEUR » est gardée, réécrite pour dire l'intervalle que le texte impose et ses deux bornes.
- À signaler à Manasse : la note et le script `fiscalite-rdc/irpp/scripts/irpp_bareme.py` posent l'ordre inverse, contraire aux art. 119, 121 et 123.

### Hiérarchie

Un seul texte, la loi n° 23/053. La note de compétence est un commentaire ; le texte abrogé n'est lu que pour la cohérence de rédaction.

---

## T3 · Indemnité de logement à 30 % : condition ou plafond ?

### Texte lu

- **Loi n° 23/053, art. 69** (`05-loi23-053-titre3-irpp.md`) : « Sont immunisés de l'impôt : 1. les indemnités ou allocations familiales réellement accordées aux employés dans la mesure où elles ne dépassent pas les taux légaux ; [...] 8. les indemnités et avantages en nature concernant le logement, le transport et les frais médicaux pour autant que : a) l'indemnité de logement ne dépasse 30 % de la rémunération ; b) [...] Dans tous les cas, la réalité et la nécessité du transport alloué à l'employé doivent être démontrées ; c) les frais médicaux soient justifiés par les documents probants. »
- **Art. 116, 1** : « dans la limite de 5 % du revenu brut imposable ».
- **Circulaire départementale n° 4133 du 23 décembre 1988** (`fiscalite-rdc/historique-fiscal-abroge/references/loi-83-004-1983-modif-69-009-revenus-locatifs.md`).
  - Elle interprète l'art. 48-3° de l'O.-L. n° 69/009 « dans sa rédaction issue de l'ordonnance-loi 84-022 du 30 mars 1984 », qui portait « dans la mesure où ils ne revêtent pas un caractère exagéré ».
  - Elle conclut : « L'indemnité de logement est immunisée à concurrence de 30 % de Z 48.184 soit Z 14.455, le surplus étant imposable. »
- **Rédaction postérieure du même article** (`ol-69-009-1969-impots-cedulaires-texte-origine.md`, art. 48, 3°) : « pour autant que : l'indemnité de logement ne dépasse 30 % du traitement brut ».

### Décision

C'est une **condition (tout ou rien)**.
- Le même art. 69 emploie « dans la mesure où » pour un plafond (point 1) et « pour autant que » pour le point 8. L'art. 116 écrit « dans la limite de ».
- Le connecteur « pour autant que » gouverne a), b) et c). Les points b) et c) sont des conditions pures (« doivent être démontrées », « soient justifiés ») : un même mot ne prend pas deux sens dans une même phrase.
- La circulaire de 1988, seule pièce qui lise un plafond, interprète une rédaction antérieure (« dans la mesure où [...] caractère exagéré »). Le législateur l'a ensuite remplacée par « pour autant que », et la loi n° 23/053 a repris cette formule.
- P04 à 40 % : 183 100 (OmegaX) est gardé, 138 100 écarté.

### Effet pour OmegaX

- `assiettes-paie.ts` reste inchangé.
- L'« autre lecture » servie avec son montant n'a plus d'objet comme réserve. Si elle reste, ce sera dans la bulle Aide, avec la circulaire et sa date (§ 9 ter : aucun historique à l'écran).

### Hiérarchie

La loi de 2023 prime sur une circulaire de 1988 qui porte sur un texte abrogé et sur une autre phrase.

---

## T4 · Plancher CNSS de mai à décembre 2025 : SMIG payé ou fixé ?

### Texte lu

- **Loi n° 16/009, art. 13** : « En aucun cas, le montant des rémunérations servant de base de calcul des cotisations ne peut être inférieur au salaire minimum légal. »
- **Décret n° 18/041, art. 8** (`cnss-cotisations-sociales-rdc/references/decret-18-041-2018-taux-cotisations-cnss.md`) : « En aucun cas, le montant des rémunérations servant de base de calcul des cotisations ne peut être inférieur au salaire minimum interprofessionnel garanti. »
- **Décret n° 25/22** (`droit-travail-congolais/references/smig-cotisations-textes-application/decret-25-22-2025-fixation-smig.md`).
  - Art. 2 : « Le taux journalier du Salaire Minimum Interprofessionnel Garanti est fixé à 21.500 Francs Congolais pour le travailleur manœuvre ordinaire. »
  - Art. 3 : « est payé : à partir de la paie du mois de mai 2025, à 14.500 Francs Congolais ; à partir de la paie du mois de janvier 2026, à 21.500 Francs Congolais. »
  - L'annexe 1 (mai à décembre 2025) porte, pour la classe 1 (manœuvre ordinaire, tension 100), un taux de 14 500 FC.
- **Décret n° 25/21, art. 3** (`.../decret-25-21-2025-modalites-smig.md`), qui définit le SMIG : « La somme minimale fixée par le pouvoir public en deçà de laquelle aucun travailleur ne peut être rémunéré sous peine de sanction. »
- **Code du travail, art. 88, al. 2** : la clause « fixant des rémunérations inférieures aux salaires minima interprofessionnels garantis » est nulle de plein droit.

### Décision

De mai à décembre 2025, le plancher est le **SMIG payé, 14 500 FC par jour**, soit 377 000 FC pour 26 jours.
- La loi, qui prime sur le décret n° 18/041, dit « salaire minimum légal », c'est-à-dire le minimum que la loi oblige à payer.
- Pendant ces huit mois, l'art. 3 du décret n° 25/22 permet de payer 14 500 FC sans infraction.
- Le décret n° 25/21 définit le SMIG par la sanction. Aucune sanction ne frappe un salaire de 14 500 FC en 2025.
- L'annexe 1, partie du décret et applicable à ces mois, porte le manœuvre ordinaire à 14 500 FC.
- Asseoir les cotisations sur 21 500 FC reviendrait à les asseoir sur un salaire que la loi ne fait pas encore devoir.

**P07 (d)**, novembre 2025, 400 000 FC sur 26 jours. Comme 400 000 ≥ 377 000, le plancher est sans effet et la base est de 400 000 FC :

| Ligne | Montant |
|---|---:|
| Part ouvrière (5 %) | 20 000 |
| Pensions, part employeur (5 %) | 20 000 |
| Prestations aux familles (6,5 %) | 26 000 |
| Risques professionnels (1,5 %) | 6 000 |
| INPP (privé, 30 travailleurs, après le 24 septembre) | 14 000 |
| ONEM | 2 000 |

L'impôt reste non servi, la loi n° 23/053 n'étant en vigueur qu'au 1er janvier 2026.

### Effet pour OmegaX

- `cotisations-paie.ts` (`plancherCnss`) :
  - retirer l'abstention « PLANCHER NON TRANCHÉ » pour mai à décembre 2025 ;
  - plancher = 14 500 × jours payés ;
  - abstention gardée seulement sous 377 000 FC sans jours déclarés, comme en 2026.
- C'est le même minimum que celui qu'OmegaX oppose déjà au contrat pour 2025 (P1b).
- CLAUDE.md, paragraphe « DÉCRET n° 25/22 » (« la fiche en donne les deux lectures sans trancher ») : à réécrire.

### Hiérarchie

La loi n° 16/009 prime sur le décret n° 18/041. Les décrets n° 25/21 et n° 25/22, de même date (le second vise le premier), concordent.

---

## T5 · Septembre 2025 (INPP et ONEM) et base « trimestre précédent »

### Texte lu

- **Arrêté INPP du 24 septembre 2025** (`droit-travail-congolais/references/smig-cotisations-textes-application/arretes-inpp-taux-cotisation-2006-2025.md`).
  - Art. 1er : « Le taux de la cotisation mensuelle due à l'Institut National de Préparation Professionnelle, par chaque employeur, sur les rémunérations versées à ses travailleurs est fixé à : [...] ».
  - Art. 3 : « [...] l'exécution du présent Arrêté qui entre en vigueur à la date de sa signature. »
  - Aucun article transitoire.
  - Visa : « l'Ordonnance n° 84/186 du 15 octobre 1984 fixant les modalités de paiement de la cotisation due par les employeurs à l'Institut National de Préparation Professionnelle ». Ce texte n'est pas au corpus.
- **Code du travail, art. 15 b)** : « la cotisation mensuelle des employeurs proportionnelle à la somme des rémunérations versées par eux à leur personnel au cours du trimestre précédent ».
- **Arrêté ONEM n° 028/2025.**
  - Art. 1er : « 0,5 % de la rémunération mensuelle payée ».
  - Art. 3 : « payable au plus tard dans les quinze (15) jours qui suivent le mois pendant lequel la rémunération a été payée ».
  - Art. 6 : « Les contributions non acquittées à la date d'entrée en vigueur du présent Arrêté ainsi que les pénalités y applicables sont calculées conformément au taux fixé aux articles 1er et 3, alinéa 2. »
  - Art. 10 : entrée en vigueur « à la date de sa signature » ; « Fait à Kinshasa, le 25 septembre 2025 ». Le titre dit « du 24 septembre 2025 » : anomalie du texte.

### Décision

**ONEM · tranché.**
- Toute contribution non acquittée le 25 septembre 2025 se calcule à 0,5 % (art. 6).
- La contribution de la paie de septembre est payable au plus tard le 15 octobre (art. 3). Elle se calcule donc entièrement à 0,5 %, quel que soit le jour de paie, sauf si elle a été acquittée avant le 25 septembre.
- P08 : 5 000, OmegaX est juste.
- L'art. 6 vise aussi une contribution d'un mois antérieur encore impayée le 25 septembre, avec ses pénalités au nouveau taux.

**INPP, le taux · tranché.**
- Le taux s'attache aux « rémunérations versées », et l'arrêté vaut dès sa signature, sans disposition transitoire ni prorata au jour.
- Une rémunération versée à partir du 24 septembre 2025 porte le nouveau barème ; une rémunération versée avant porte l'ancien.
- P08 (privé, 50 travailleurs) : 35 000 si la paie de septembre est versée le 24 ou après, 30 000 si elle l'est avant.

**INPP, la base · non tranché.**
- La loi (art. 15 b) rapporte la cotisation mensuelle aux rémunérations « versées [...] au cours du trimestre précédent ». L'arrêté ne fixe que le taux et ne peut pas changer la base.
- Le texte ne dit pas comment la somme d'un trimestre devient une cotisation de mois (un tiers ? la somme entière ?). Il ne dit donc pas non plus quel taux porte la cotisation d'un mois dont le trimestre de référence chevauche le 24 septembre.
- Ces modalités relèvent de l'ordonnance n° 84/186, absente du corpus. Il faut demander ce texte.

### Effet pour OmegaX

- **ONEM** : inchangé. Ajouter, pour une paie antérieure à septembre 2025, la réserve de l'art. 6.
- **INPP** : le barème « au mois » de `cotisations-paie.ts` est juste pour une paie versée le 24 septembre ou après. Pour septembre 2025, il faut lire la date de versement (ancien barème si elle précède le 24) ou le dire en réserve.
- `RESERVE_ASSIETTE_INPP` est gardée, et nomme l'ordonnance n° 84/186 comme texte manquant.

### Hiérarchie

Le Code du travail prime sur les arrêtés. L'art. 6 de l'arrêté ONEM est une règle d'application immédiate que rien dans le corpus ne contredit.

---

## T6 · Congé (art. 141) : tranche d'ancienneté sur une période incomplète

### Texte lu

**Code du travail** (`droit-travail-congolais/references/texte-loi-verbatim/06-titre-vi-des-conditions-generales-de-travail.md`).
- Art. 141, al. 1 : « La durée du congé est d'au moins un jour ouvrable par mois entier de service pour le travailleur âgé de plus de dix-huit ans. [...] Elle augmente d'un jour ouvrable par tranche de cinq années d'ancienneté chez le même employeur ou l'employeur substitué. »
- Art. 144, al. 1 : « En cas de résiliation du contrat, quel que soit le moment où celle-ci intervient, le congé est remplacé par une indemnité compensatoire calculée conformément à l'article 142 ci-dessus. »

### Décision

Le jour de la tranche est dû **entier** : 11 jours, 462 000.
- L'art. 141 rapporte la durée de base au « mois entier de service », mais il rapporte l'augmentation à l'ancienneté (« par tranche de cinq années »), non au mois. Aucun mot ne la répartit sur douze mois.
- L'art. 144 remplace « le congé », c'est-à-dire la durée que donne l'art. 141 à la date de la résiliation, « quel que soit le moment ».
- Proratiser ajouterait une règle absente, au détriment du travailleur. La règle P5 irait dans le même sens, mais le texte suffit.

Chiffres de P13 :

| Ligne | Montant |
|---|---:|
| Congé · 11 × 42 000 | 462 000 (+7 000) |
| Total du licenciement | 3 228 000 |
| Démission (prestée ou non observée), faute lourde | 582 000 |

Mois de cessation, au traitement actuel de T7 :

| Ligne | Montant |
|---|---:|
| Assiette | 3 228 000 |
| Part ouvrière | 161 400 |
| Charge patronale | 548 760 |
| Base nette | 3 066 600 |
| Revenu annualisé | 36 799 000 |
| Retenue (630 535 avant arrondi, art. 150) | 630 500 |
| Net | 2 436 100 |

Limite : une période qui ne compte aucun mois entier n'est pas posée par P13 et n'est pas tranchée ici.

### Effet pour OmegaX

`decompte-final.ts` (`congeLegal`) : la tranche s'ajoute sans prorata. L'hypothèse H11 tombe.

### Hiérarchie

Un seul texte, la loi. Le « congé prorata [...] / 312 » du séminaire CPCC est une doctrine, et le séminaire dit lui-même que l'article prime.

---

## T7 · Indemnité de préavis : assiette sociale et impôt d'un versement unique

### Texte lu

**Assiette sociale.**
- Loi n° 16/009, art. 13 : les cotisations sont « assises sur l'ensemble de la rémunération du travailleur assujetti tel que prévu à l'article 7, litera h, du Code du travail ».
- Code du travail, art. 7, point 8 (`.../01-titre-i-des-dispositions-generales.md`) : « Rémunération : la somme représentative de l'ensemble des gains susceptibles d'être évalués en espèces et fixés par un accord ou par les dispositions légales ou réglementaires qui sont dus en vertu d'un contrat de travail, par un employeur à un travailleur. » La liste des éléments est ouverte (« notamment ») et comprend « l'indemnité compensatoire de congé ». La liste des exclusions est fermée (soins de santé, logement, allocations familiales légales, transport, frais de voyage).
- Art. 63, al. 3 : « une indemnité dont le montant correspond à la rémunération et aux avantages de toute nature dont aurait bénéficié le travailleur durant le délai de préavis qui n'a pas été effectivement respecté ».
- Arrêté n° 146/2018 (`cnss-cotisations-sociales-rdc/references/am-146-2018-...md`), art. 17 (même définition) et art. 20 : « Les cotisations sont dues pour chaque mois au cours duquel se situent une période de service effectif, une période de congés rémunérés ou toute autre période pour laquelle l'employeur est tenu au paiement de tout ou partie de la rémunération conformément aux dispositions légales. »

**Impôt.**
- Loi n° 23/053, art. 68, 6° : sont imposables « les sommes payées par l'employeur ou le mandant, contractuellement ou non par suite de cessation de travail ou de rupture de contrat d'emploi ».
- Art. 115 : exigibilité « au moment de la mise à disposition ».
- Art. 116 : impôt établi « d'après le montant total du revenu net annuel ».
- Art. 119 : retenue « mensuellement par l'employeur ».
- Art. 121, al. 3 : « Toute retenue à la source qui s'avère supérieure au montant de l'impôt exigible calculé conformément à l'article 118 ci-dessus est prise en compte par l'Administration des Impôts pour le règlement d'obligations fiscales antérieures ou futures. »
- Arrêté du 19 février 2025 (`fiscalite-rdc-socle/references/am-2025-retenue-irpp-revenus-salariaux.md`) : art. 2, calcul « chaque mois » au barème de l'art. 118 ; art. 3, retenue « au moment du paiement » ou de la « mise à disposition ».
- O.-L. n° 69/009, art. 86 (taux de 10 % sur ces indemnités), au Titre 4, abrogé par l'art. 152, point 2 de la loi n° 23/053.

### Décision

**Assiette sociale · tranché : l'indemnité est dans l'assiette.**
- C'est un gain évaluable en espèces, fixé par une disposition légale (art. 63, al. 3), dû par l'employeur au travailleur du fait du contrat.
- Elle n'est pas dans la liste fermée des exclusions.
- L'art. 63 la définit par la rémunération du délai, et l'arrêté n° 146/2018, art. 20, fait naître des cotisations pour toute période où l'employeur doit la rémunération.
- Ses composantes exclues par nature (logement, transport) restent exclues, ventilées (déjà fait par P8 (3)).
- Les dommages-intérêts de l'art. 63, al. 1, fixés par le tribunal, sont autre chose et restent hors de cette décision.
- L'INPP et l'ONEM suivent, par la même lecture du mot « rémunération ».
- P13 : CNSS sur 2 646 000, gardée.

**Impôt · tranché sur le fond, convention sur la méthode.**
- L'indemnité est imposable (art. 68, 6°), en entier au mois de sa mise à disposition (art. 115 ; arrêté, art. 3), au barème de l'art. 118. Aucun taux spécial ne s'applique : l'ancien taux de 10 % est abrogé.
- Aucun texte n'écrit comment un barème annuel donne la retenue d'un mois. C'est la convention de mensualisation déjà déclarée (H1), appliquée au mois de cessation comme à tout autre mois.
- L'impôt définitif reste celui du revenu annuel (art. 116 et 118). Ce que l'annualisation d'un versement unique fait retenir en trop relève de l'art. 121, al. 3.
- P13 : 628 500, gardé.

### Effet pour OmegaX

- `decompte-final-emis.ts` : `RESERVE_ASSIETTE_SOCIALE_INDEMNITE` cesse d'être une réserve, car « le corpus se tait » est inexact. Elle devient une mention de fondement (art. 63, al. 3 ; art. 7, point 8 ; arrêté n° 146/2018, art. 20).
- `RESERVE_VERSEMENT_UNIQUE` est gardée, complétée de l'art. 121, al. 3 et de l'absence de taux spécial.
- CLAUDE.md P8 (3) (« avec RÉSERVE, le corpus se tait ») : à corriger.
- Résidu non tranché ici : l'art. 20 de l'arrêté n° 146/2018 rattache les cotisations aux mois de la période. Cela touche la déclaration mensuelle, pas le montant, l'assiette n'ayant pas de plafond.

### Hiérarchie

La loi n° 16/009 renvoie au Code du travail ; l'arrêté n° 146/2018 en reprend la définition. Aucun conflit.

---

## T8 · Salaire en dollars : cours du jour et arrondi

### Texte lu

- **Code du travail, art. 89, al. 1** (`.../05-titre-v-du-salaire.md`) : « La rémunération doit être stipulée en monnaie ayant cours légal en République Démocratique du Congo. »
- **Date des prélèvements** :
  - loi n° 23/053, art. 115 (exigibilité « au moment de la mise à disposition ») ;
  - arrêté du 19 février 2025, art. 3 (retenue « au moment du paiement [...] ou de leur mise à disposition ») ;
  - loi n° 16/009, art. 20 (déclaration du « montant total des rémunérations perçues ») ;
  - arrêté ONEM, art. 1er (« rémunération mensuelle payée ») ;
  - arrêtés INPP, art. 1er (« rémunérations versées »).
- **Arrondis existants.**
  - Loi n° 23/053, art. 150 (`.../06-loi23-053-titre4-7-communes-autres-abrogatoires.md`) : il vise « le montant de l'Impôt sur les Sociétés, de l'Impôt minimum, de l'Impôt sur le Revenu des Personnes Physiques et de tous autres prélèvements prévus dans la présente Loi ».
  - Loi n° 16/009, art. 121 : « Les montants mensuels des pensions et des rentes sont arrondis à la dizaine de francs supérieure la plus proche. »
- Les arrêtés n° 015/2025 et n° 019/2025 renvoient le change à une circulaire non obtenue (`fiscalite-rdc-socle/references/parametres-2026.md`).

### Décision

**La source du cours n'est fixée par aucun texte.** La stipulation en dollars méconnaît d'ailleurs l'art. 89, dont le rappel est gardé. La décision du cabinet du 2026-09-24 (cours coté dans Devises) reste un choix que nul texte ne régit.

**La date du cours se lit dans les textes.**
- Tous les prélèvements s'attachent au moment où la rémunération est payée ou mise à disposition : art. 115, arrêté du 19 février 2025 art. 3, et les mots « perçues », « payée », « versées ».
- Le montant en francs du revenu est donc celui de ce jour.
- Le « jour du calcul » d'OmegaX est conforme quand le bulletin est émis le jour du paiement. S'il l'est avant, le cours à retenir est celui du jour de la mise à disposition.

**L'arrondi n'est réglé par aucun texte.**
- L'art. 150 arrondit l'impôt, pas le salaire converti ; l'art. 121 de la loi n° 16/009 arrondit des prestations, pas une assiette.
- La conversion fixe ce que l'employeur doit au travailleur (Titre V du Code, « Du salaire »). **J'applique ici la règle P5** : chaque élément converti s'arrondit au centime supérieur dès qu'une fraction reste.
- P09 : 343 455,125 donne 343 455,13, inchangé (le demi-centime montait déjà). Seul un reste inférieur au demi-centime change, d'au plus 0,01 FC par élément.

### Effet pour OmegaX

`conversion-usd.ts` (`usdEnFc`) :
- arrondi au centime supérieur au lieu du demi-centime vers le haut ;
- date du cours = date de mise à disposition déclarée sur le bulletin, le jour du calcul par défaut, en le disant ;
- rappel de l'art. 89 gardé.

### Hiérarchie

Aucune contradiction : le corpus est silencieux sur la source du cours et sur l'arrondi.

---

## T9 · Le samedi qui porte le congé d'un férié tombé un dimanche (constat C4)

### Texte lu

- **Code du travail.**
  - Art. 7, point 9 : « Jour ouvrable : chaque jour de la semaine à l'exception du jour de repos hebdomadaire et des jours fériés légaux. »
  - Art. 121, al. 2 : le repos « a lieu le dimanche ».
  - Art. 123, al. 1 : la liste des jours fériés légaux est fixée par le Président de la République.
  - Art. 93 : « La rémunération est due pour le temps où le travailleur a effectivement fourni ses services ; elle est également due lorsque le travailleur a été mis dans l'impossibilité de travailler du fait de l'employeur ainsi que pour les jours fériés légaux ».
  - Art. 63, al. 3 (cité en T7).
  - Art. 258 : le préavis du délégué est « le double de la période applicable en vertu des dispositions de l'article 64 du présent Code, sans pouvoir être inférieure à trois mois ».
- **Ordonnance n° 23-042** (`droit-travail-congolais/references/ordonnance-23-042-jours-feries.md`).
  - Art. 1er : liste fermée et datée, dont « le 17 mai ».
  - Art. 2 : « Dans le cas où l'un des jours fériés légaux visés à l'article 1er coïncide avec un dimanche, le congé relatif à ce jour est pris le jour précédent. »

### Décision

**Le samedi 16 mai 2026 est chômé et rémunéré.** C'est le jour où se prend le congé du férié (art. 2), payé comme le férié (art. 93).

**Il n'est pas un jour ouvrable (règle P5).**
- La lettre ne le classe pas parmi les jours fériés : l'art. 2 déplace « le congé », pas « le jour férié ».
- Elle ne dit pas non plus qu'un jour rendu chômé par l'art. 2 reste ouvrable.
- Le compter ouvrable ôterait à l'art. 2 tout effet dans les décomptes du Code (préavis, congé de l'art. 141) : le férié tombé un dimanche disparaîtrait.
- S'agissant d'un minimum protecteur (art. 64, al. 1 ; art. 258), **j'applique la règle P5** : ce samedi n'est pas un jour ouvrable. La fenêtre du 5 mai au 4 août 2026 compte donc 76 jours ouvrables.
- Résidu : pour le préavis dû par le travailleur, qui est un maximum (art. 64, al. 2), cette lecture l'allonge d'au plus un jour. La définition du jour ouvrable étant une, elle n'est pas dédoublée.

**Mais le décompte des jours ouvrables ne fait pas le montant de l'indemnité.**
- L'indemnité est « la rémunération [...] dont aurait bénéficié le travailleur durant le délai » (art. 63, al. 3), et la rémunération est due pour les jours fériés légaux (art. 93).
- Pendant les trois mois, le travailleur aurait été payé pour les 79 jours du lundi au samedi : 76 jours ouvrables, plus le samedi 16 mai (congé du 17), le 30 juin et le 1er août.
- La question du samedi est donc **sans effet sur l'indemnité** : il est payé dans les deux lectures. Corriger C4 vers 76 jours réduirait une indemnité que le texte fixe plus haut.

| Stipulation du salaire | Indemnité de trois mois selon le texte | OmegaX (77 jours) | Écart |
|---|---:|---:|---:|
| À la journée · 79 × 42 000 | 3 318 000 | 3 234 000 | 84 000 en moins |
| Au mois · 3 × (1 040 000 + 52 000) | 3 276 000 | 3 234 000 | 42 000 en moins |

### Effet pour OmegaX

- **C4 n'est pas un défaut de comptage à corriger vers 76.** Le défaut, plus large, est ailleurs : `decompte-final.ts` chiffre l'indemnité en jours ouvrables × taux journalier, alors que l'art. 63, al. 3 la chiffre sur la rémunération du délai, jours fériés compris (art. 93).
- **Constat nouveau**, en faveur du travailleur, à rejouer dans `docs/cas-chiffres/paie.md`. Pour le préavis ordinaire de 63 jours ouvrables, si la notification est du 4 mai 2026 comme pour le délégué : le délai court jusqu'au 18 juillet et contient le samedi 16 mai et le 30 juin. Cela fait 65 jours rémunérés, soit 2 730 000 au lieu de 2 646 000 pour un salaire à la journée. Le prorata d'un mois entamé, pour un salaire mensuel, n'est écrit nulle part : à décider avant de coder.
- `joursOuvrablesDeTroisMois` et tout comptage de jours ouvrables (fin d'un préavis exécuté, moitié de l'art. 66) : exclure le samedi qui porte le congé d'un férié tombé un dimanche.
- Le jour ouvrable fiscal (`retenues/jour-ouvrable.ts`) n'est pas concerné : autre notion, autre texte (CLAUDE.md, « LE JOUR OUVRABLE FISCAL »).

### Hiérarchie

L'ordonnance est prise sur l'art. 123 du Code, sans conflit avec lui. La lacune d'articulation entre l'art. 2 de l'ordonnance et l'art. 7, point 9 est comblée par la règle P5.

---

## Ce qui remonte à Manasse

Le corpus ne tranche pas les points suivants :

1. **T2.** La répartition de l'impôt plafonné entre les deux parts du revenu. Le texte n'impose que l'intervalle [8 160 000 ; 9 486 720] pour la base de la quotité, soit 2 216 800 à 2 225 600 par mois sur P03. OmegaX garde la borne haute.
2. **T5.** L'ordonnance n° 84/186 du 15 octobre 1984 (modalités de paiement INPP), citée par les deux arrêtés et absente du corpus. Elle seule dit comment la base « trimestre précédent » de l'art. 15 b) devient une cotisation de mois.
3. **T9.** La conversion d'un salaire mensuel en indemnité pour un délai exprimé en jours ouvrables (prorata d'un mois entamé), que le constat nouveau oblige à décider.
4. **Compétences, que Manasse seul déploie.**
   - `fiscalite-rdc/irpp/NOTES.md` et son script posent l'ordre réduction puis plafond, contraire aux art. 119, 121 et 123.
   - `fiscalite-rdc/parafiscalite-sociale/NOTES.md` renvoie l'INPP au 4331 (mutuelle).

## Anomalies relevées en lisant

- **Arrêté ONEM n° 028/2025.** Le titre le date « du 24 septembre 2025 », la signature porte « le 25 septembre 2025 ». La date d'effet est celle de la signature. Sans conséquence pour septembre 2025, à cause de l'art. 6.
- **Arrêté INPP de 2025.** Le numéro des Finances est illisible (déjà consigné dans la compétence).
