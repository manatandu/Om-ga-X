# Six décisions tranchées par la loi (lecture du 2026-10-04)

Préfixe des compétences : `/root/.claude/skills/synced/80921ba8-…/` (abrégé `SK/`).
Les constats d'origine sont dans `docs/recensement-corrections-restantes.md` (F14-D1 l. 156, F8-D1 l. 174, R2-A3 l. 474, R2-B5 l. 506, R2-B6 l. 514, O1a-D2 l. 822). Pour le 20B, voir `docs/releve-de-manques-referentiels.md` l. 1937.

---

## 1. F14-D1 · entreprise du portefeuille de l'État

**Texte lu**
- O.-L. n° 13/003 du 23 février 2013, art. 112, 113, 114 et 115 (`SK/recettes-non-fiscales-rdc/references/03-ol-13-003-…md`, l. 2154-2203).
  - Art. 112 : « Les entreprises relevant du portefeuille de l'Etat ont l'obligation de tenir leurs assemblées générales ordinaires statuant sur les résultats de l'exercice clos au 31 décembre de chaque année au plus tard le 31 mars de l'année qui suit celle de réalisation des revenus, et d'en communiquer le procès-verbal à l'Administration des recettes non fiscales dans les dix (10) jours qui suivent la tenue de ces assemblées. »
  - Art. 113 : l'affectation des résultats « doit intervenir endéans soixante (60) jours, à compter de la date de dépôt des états financiers à l'administration compétente du ministère ayant le portefeuille de l'Etat dans ses attributions ».
  - Art. 114 : ce ministère communique les états à l'Administration des recettes non fiscales dans les dix jours du dépôt. C'est une obligation du ministère, pas de l'entreprise.
  - Art. 115 : entrée en vigueur à la publication au J.O., le 27 février 2013.
- Loi n° 08/010 du 7 juillet 2008, art. 3 (`SK/rgcp-comptabilite-publique/portefeuille-etat-fonds-speciaux/references/loi-08-010-…md`).
  - L'**entreprise du portefeuille** est « toute société dans laquelle l'État ou toute personne morale de droit public détient la totalité des actions ou une participation ».
  - L'**entreprise publique** est l'entreprise du portefeuille où l'État détient « la totalité ou la majorité absolue ».
  - Attention : ce fichier résume le texte, il n'en est pas la transcription mot pour mot.
- AUSCGIE, art. 140 (`SK/auscgie-acte-uniforme/references/partie1-livre2-fonctionnement.md`, l. 193-200).
  - L'assemblée générale ordinaire se tient « dans les six (6) mois de la clôture de l'exercice ».
  - Les états financiers et le rapport de gestion sont adressés aux commissaires aux comptes « quarante-cinq (45) jours au moins avant » l'assemblée.
- Lois de finances qui ont modifié l'O.-L. n° 13/003 (résumés dans `SK/rgcp-comptabilite-publique/finances-publiques/references/`) :
  - LF 2024, art. 49 à 56 ;
  - LF 2025, art. 73, qui insère l'**art. 112 quater** (dividende prioritaire et intangible des entreprises **minières** du portefeuille) ;
  - LF 2026, qui reconduit ces mesures (art. 50). Elle pose aussi un dividende prioritaire minier « déclaré au plus tard le 15 mai », payé dans les 8 jours du titre de perception. Ce sont les art. 63-64 dans `lf-2026.md`, et l'art. 52 dans `fiscalite-rdc/lois-de-finances-annuelles/…/lf-2026-mesures-fiscales.md` : les deux résumés ne donnent pas le même numéro.

**En vigueur au 4 octobre 2026 : oui, sous une réserve.**
- Aucun texte lu ne modifie ni n'abroge les art. 112 et 113.
- Les LF 2024, 2025 et 2026 modifient d'autres articles et insèrent l'art. 112 quater.
- Réserve : l'existence d'un art. 112 quater suppose des art. 112 bis et ter, probablement insérés par la LF 2023 (n° 22/071). Cette loi n'est pas au corpus, et l'O.-L. n'y figure que dans sa version de 2013, sans consolidation.
- Aucune contradiction avec l'AUSCGIE : le 31 mars respecte le plafond de six mois de l'art. 140, il ne le contredit pas.

**Décision**
- Un fait déclaré est nécessaire. La qualité tient à l'actionnariat (art. 3 de la loi n° 08/010 : une seule action détenue par l'État ou par une personne morale de droit public suffit). Elle ne se déduit ni de la forme juridique ni du référentiel.
- Réponses possibles : oui, non, pas encore dit (`null` par défaut).
- Champ : tout dossier SYSCOHADA. Les art. 112 et 113 visent des « entreprises » et la loi n° 08/010 des « sociétés ». Un dossier SYCEBNL n'est pas concerné.

**Effet pour OmegaX (sur « oui »)**
1. **Assemblée générale ordinaire au plus tard le 31 mars de N+1.** Ce jalon remplace l'échéance des six mois pour l'approbation. Il ne vaut que pour un exercice clos au 31 décembre. Pour toute autre clôture, rien n'est calculé, et l'écran le dit (le texte ne vise que le 31 décembre).
2. **Procès-verbal à l'Administration des recettes non fiscales (DGRAD) dans les dix jours de l'assemblée.**
   - Ce jalon s'ajoute à celui de la DGI (art. 13 bis LPF), il ne le remplace pas.
   - L'échéance se compte depuis la **date de l'assemblée, déclarée**.
   - Les dix jours sont calendaires : l'O.-L. n° 13/003 ne pose aucune règle de jour ouvrable pour ce délai, et l'art. 110 bis LPF ne régit que la « législation fiscale ».
3. **Affectation dans les 60 jours du dépôt des états financiers au ministère du Portefeuille.**
   - La **date de dépôt est déclarée** sur l'exercice.
   - L'échéance n'est calculée qu'une fois cette date posée, sans elle rien n'est calculé.
4. **Conséquence arithmétique de l'art. 140 AUSCGIE, à servir en information :** pour une assemblée au 31 mars, les états doivent parvenir aux commissaires aux comptes au plus tard le 14 février (le 15 février en année bissextile).
5. **Entreprise minière du portefeuille :** dividende prioritaire déclaré au plus tard le 15 mai, sans attendre l'assemblée.
   - Cela n'est servi que sur un **second fait déclaré** (entreprise minière).
   - Ce point est **à confirmer sur le texte même de la LF 2026**, que le corpus ne donne qu'en résumé, avec des numéros divergents.
6. Aucune sanction n'est chiffrée : les art. 112 et 113 n'en posent pas.

**Ce que le corpus ne tranche pas**
- Le contenu des art. 112 bis et ter.
- L'alignement de l'art. 112 sur une clôture autre que le 31 décembre.
- Le lien entre ce fait et la case « contrôle public » de la fiche R2 (point 5). L'« entreprise publique », à participation majoritaire, peut être **proposée** comme sous contrôle public, jamais substituée.

---

## 2. R2-B5 · lignes répétables des notes SYSCOHADA 4, 13, 32 et 33

**Texte lu**
- AUDCIF, Titre IX ch. 6 (`SK/audcif-acte-uniforme/references/titre-9-ch6-7-notes-annexes-correspondance.md`).
  - § 1.2 : « Les modèles de Notes non documentés ne doivent pas être joints […]. Leur contenu peut être amélioré par les entités. »
  - NOTE 4 : second tableau « Liste des filiales et participations », colonnes Dénomination sociale, Localisation, Valeur d'acquisition, % détenu, capitaux propres, résultat.
  - NOTE 13 : colonnes Nom et prénoms, Nationalité, Nature des actions ou parts, Nombre, Montant total, Cessions ou remboursements. Ligne finale « Apporteurs, capital non appelé », puis TOTAL.
  - NOTE 32 : colonne « DÉSIGNATION DU PRODUIT », lignes finales NON VENTILÉ et TOTAL.
  - NOTE 33 : colonne « DÉSIGNATION DES MATIÈRES ET PRODUITS », lignes finales NON VENTILÉS et TOTAL. En-têtes désalignés, signalés [texte officiel].
- AUDCIF, Titre IX ch. 2 (`titre-9-ch1-5-bilan-resultat-flux.md`, l. 95-114), conditions de recevabilité :
  - « Reproduire à l'identique la contexture des imprimés normalisés » ;
  - « Ne créer aucune rubrique » ;
  - « les Notes annexes non chiffrés peuvent être supprimés ».

**En vigueur : oui.** AUDCIF révisé de 2017, en vigueur au 1er janvier 2018 (art. 113). Aucune modification au corpus.

**Décision**
- Le modèle n'impose **aucun nombre de lignes**. Ces tableaux sont des listes : une ligne par associé, par filiale, par produit ou par matière. La colonne de désignation ou d'identité n'a de sens que répétée.
- Ajouter une ligne d'élément n'est pas « créer une rubrique » : la rubrique est le tableau et ses colonnes, la ligne en est une occurrence. Le § 1.2 autorise expressément d'améliorer le contenu.
- Une limite tient à la contexture : les colonnes, leur ordre, et les lignes finales (« Apporteurs, capital non appelé », NON VENTILÉ(S), TOTAL) restent **telles quelles et à leur place**.
- Le corpus est une transcription : il ne dit pas combien de lignes vierges porte la maquette imprimée. Ce nombre n'a de toute façon aucune portée normative au regard du § 1.2.

**Effet pour OmegaX**
- La migration décrite peut se faire : `SaisieNote.rang`, unicité recréée, ancres gardées.
- Rien n'est prérempli ni déduit d'un compte.
- Le TOTAL de la NOTE 13 est contrôlé contre le capital du bilan, en information, sans refus.

**Ce que le corpus ne tranche pas**
- Le nombre de lignes vierges imprimées sur le PDF officiel. Sans conséquence.

---

## 3. Tableau 20B (projets), 29B (associations), et pour mémoire 27B SYSCOHADA

**Texte lu**
- SYCEBNL, Partie 4 ch. 3, NOTE 20B (`SK/sycebnl/references/partie4-ch3-etats-projets-developpement.md`, l. 461-470).
  - « **1. Personnel propre** · Colonnes EFFECTIFS (Nationaux / Autres Etats de la Région / Hors Région / Total) et MASSE SALARIALE (Nationaux / Autres Etats de la Région / Hors Région / Total), **ventilées M / F**. »
  - Rubriques YA à YG.
  - « **2. Personnel extérieur et bénévole** · Colonne Facturation à l'entité », rubriques YH à YO.
- SYCEBNL, Partie 4 ch. 2, NOTE 29B (`…/partie4-ch2-etats-associations.md`, l. 675-684) : texte identique, « chacune ventilée M (Masculin) / F (Féminin) ».
- Le jeu des associations n'a **pas de 27B** : sa NOTE 27 porte sur les impôts et taxes.
- AUDCIF, Titre IX ch. 6, NOTE 27B (SYSCOHADA), pour comparaison : « chaque colonne subdivisée M / F ». Le texte précise aussi : « La colonne masse salariale du personnel extérieur est intitulée "Facturation à l'entité" ». Le personnel extérieur a donc là les mêmes colonnes d'effectifs, la masse salariale devenant la facturation.

**En vigueur : oui.**
- SYCEBNL : acte uniforme du 22 décembre 2022, applicable au 1er janvier 2024, publié au J.O. OHADA n° spécial du 22 février 2023.
- AUDCIF : 2017.

**Décision**
- **Personnel propre (20B et 29B) : seize colonnes**, soit deux tableaux × quatre zones × M/F. Le texte est explicite (« ventilées M / F »). Les huit colonnes actuelles, qui portent « (M / F) » dans une seule cellule, ne reproduisent pas la contexture.
- Le SYSCOHADA 27B est déjà à seize colonnes (`correspondance-notes-syscohada-2.ts`, `colonnesEffectifs`), ce qui est conforme.

**Effet pour OmegaX**
- 20B et 29B passent à seize colonnes LIBRES, dans l'ordre du texte : EFFECTIFS (Nationaux M, F ; Région M, F ; Hors Région M, F ; Total M, F), puis MASSE SALARIALE dans le même ordre.
- Une saisie ancienne « M / F » n'est **jamais scindée d'office**. La découper reviendrait à deviner la répartition par sexe.
  - Elle est gardée, montrée comme saisie antérieure au format à huit colonnes.
  - Les seize cellules restent vides jusqu'à ce que le cabinet les remplisse.
  - Le rang d'arrivée est : ancien rang k vers aucune cellule nouvelle, conservé à part. C'est un choix technique qu'aucun texte ne régit.
- Le Total (M et F) peut être **contrôlé** contre la somme des zones, en avertissement.
- L'effectif proposé par le registre reste proposé, jamais substitué.

**Ce que le corpus ne tranche pas**
- **Le personnel extérieur et bénévole des 20B et 29B.** La transcription SYCEBNL ne nomme que « Colonne Facturation à l'entité ». Elle ne dit pas si le bloc porte aussi les effectifs ventilés par zone et par sexe, comme le 27B SYSCOHADA.
- On ne transpose pas le SYSCOHADA au SYCEBNL : c'est à lire sur le PDF du J.O. OHADA, comme E5.
- D'ici là, la colonne unique actuelle reste en place.

---

## 4. O1a-D2 · liquidation d'une société

**Texte lu**
- AUDCIF, art. 7 al. 2 et 4 (`titre-1-ch1-3-champ-organisation-etats.md`, l. 47-53).
  - Al. 2 : « L'exercice coïncide avec l'année civile. »
  - Al. 4 : « En cas de cessation d'activité, pour quelque cause que ce soit, la durée des opérations de liquidation est comptée pour un seul exercice, sous réserve de l'établissement de situations annuelles provisoires. »
- AUDCIF, art. 39 : continuité d'exploitation. En cas de liquidation, « l'évaluation de ses biens doit être reconsidérée ».
- AUDCIF, Titre VIII ch. 40 (`titre-8-ch31-41-…/10-chapitre-40-liquidation.md`) :
  - quatre étapes : inventaire et **bilan avant liquidation**, opérations, compte définitif sous forme de bilan (boni, mali ou insuffisance d'actif), clôture ;
  - comptes 837, 847, 1374 et 4619 ;
  - entité individuelle : états financiers à l'ouverture de la liquidation.
- AUSCGIE, art. 200 à 241 (`partie1-livre7-dissolution-liquidation.md`) et art. 266 (`partie1-livre9-10-…md`). Les articles utiles :
  - Art. 201 al. 4 et 5 : associé unique personne morale, transmission universelle **sans liquidation**.
  - Art. 203 : chapitre 1 non applicable sous les procédures collectives.
  - Art. 204 : « en liquidation dès l'instant de sa dissolution » ; mention « société en liquidation » et nom du liquidateur sur tous actes et documents destinés aux tiers.
  - Art. 216 : clôture dans les **3 ans** de la dissolution.
  - Art. 217 à 219 : assemblée de clôture (comptes définitifs, quitus, décharge), à défaut décision de justice, puis **dépôt des comptes définitifs au RCCM**.
  - Art. 220 : radiation demandée dans **1 mois** de la publication de la clôture.
  - Art. 223 : le chapitre 2 (art. 224 à 241) ne s'applique **que** dans ses deux cas.
  - Art. 225 : le commissaire aux comptes reste en fonctions.
  - Art. 227 : mandat judiciaire de 3 ans au plus.
  - Art. 228 : rapport à l'assemblée dans les **6 mois de la nomination** du liquidateur (12 mois par décision de justice).
  - Art. 232 : « dans les trois (3) mois de la clôture de chaque exercice », états financiers de synthèse annuels au vu de l'inventaire, et rapport écrit.
  - Art. 233 : assemblée au moins une fois par an et « dans les six (6) mois de la clôture de l'exercice » ; à défaut, rapport déposé au RCCM.
  - Art. 266 : publication de l'acte de nomination dans **1 mois**.

**En vigueur : oui.**
- AUSCGIE révisé du 30 janvier 2014, AUDCIF de 2017.
- Aucune révision postérieure au corpus.

**Décision**
- **La contradiction apparente se résout par l'art. 7 al. 2.**
  - L'AUDCIF ne fait de la liquidation un seul exercice que pour la **durée** (al. 4). Il exige des situations « annuelles ».
  - L'exercice coïncide avec l'année civile (al. 2), et aucune dérogation n'est posée pour la liquidation.
  - Les situations annuelles provisoires, que l'art. 232 AUSCGIE appelle « états financiers de synthèse annuels » pour les cas de l'art. 223, s'arrêtent donc au **31 décembre**.
  - Aucun « anniversaire » de la dissolution n'est à calculer.
- **Le point de départ est une situation à la date de dissolution.** Le ch. 40 § 2.1 impose un « bilan avant liquidation » au début de la liquidation. Le ch. 40 § 3 impose des états à l'ouverture pour l'entité individuelle.

**Effet pour OmegaX**
1. **Sur l'exercice, stocker :**
   - le drapeau de liquidation ;
   - la **date de dissolution**, déclarée (elle ouvre la liquidation, art. 204) ;
   - la **date de nomination du liquidateur** ;
   - le **régime** : amiable statutaire, ou art. 223 1°, ou art. 223 2° judiciaire. Le cas des procédures collectives est exclu (art. 203) et doit être dit.
   - Rien n'est déduit.
2. **Jalons pour toutes les sociétés commerciales** (chapitre 1) :
   - bilan avant liquidation à la date de dissolution ;
   - publication de la nomination dans 1 mois (art. 266) ;
   - clôture au plus tard 3 ans après la dissolution (art. 216) ;
   - comptes définitifs, assemblée de clôture et dépôt au RCCM (art. 217 et 219) ;
   - radiation dans 1 mois de la publication de la clôture (art. 220).
3. **Jalons supplémentaires seulement dans les cas de l'art. 223**, déclarés :
   - rapport à l'assemblée dans les 6 mois de la nomination (art. 228) ;
   - chaque 31 décembre : états annuels et rapport du liquidateur dans les 3 mois (art. 232), puis assemblée dans les 6 mois, ou à défaut dépôt du rapport au RCCM (art. 233).
   - **Hors art. 223**, seule la situation annuelle provisoire de l'AUDCIF est due au 31 décembre. Elle se produit par la situation intermédiaire existante.
4. **Pièces imprimées** : mention « société en liquidation » et nom du liquidateur (art. 204).
5. **Comptes et évaluation** :
   - comptes 837, 847, 1374 et 4619 (ch. 40) ;
   - rappel de l'art. 39 sur l'évaluation, à la clôture de l'exercice de dissolution.
6. **Associé unique personne morale** : aucune liquidation (art. 201 al. 4). Le drapeau est alors refusé, avec ce motif.

**Ce que le corpus ne tranche pas**
- Le sort de la période qui va du 1er janvier à la date de dissolution : exercice clos à cette date, ou simple bilan avant liquidation. L'art. 7 ne le dit pas, le ch. 40 parle seulement d'un « bilan avant liquidation ».
- Le régime d'une **association ou ONG** dissoute : non lu ici (loi n° 004/2001 et SYCEBNL hors de ce point).

---

## 5. R2-A3 / R2-B6 · cases ZN à ZS de la fiche R2

**Texte lu**
- AUDCIF, Titre IX ch. 2, fiche R2 (`titre-9-ch1-5-bilan-resultat-flux.md`, l. 154-172) :
  - ZN « Nombre d'établissements dans le pays » ;
  - ZO « Nombre d'établissements hors du pays pour lesquels une comptabilité distincte est tenue » ;
  - ZP « Première année d'exercice dans le pays » ;
  - ZQ « contrôle public (cocher la case) » ;
  - ZQ « contrôle privé national » [texte officiel : ZQ employé deux fois, pas de ZR] ;
  - ZS « contrôle privé étranger ».
  - Recevabilité (l. 95-114) : « N'utiliser que les codes indiqués dans les tables ».
- NOTE 36 (`titre-9-ch6-7…md`, l. 709-752) : aucune table pour ZN à ZS. Le renvoi (1) agrément prioritaire ne touche que ZK.
- Le glossaire (Titre VI) ne définit ni « établissement » ni « contrôle public / privé ».

**En vigueur : oui** (AUDCIF 2017).
Le corpus ne dit pas si la DGI de RDC reçoit cette fiche telle quelle ou un gabarit propre.

**Décision, case par case**
- **ZN** : un nombre entier déclaré (au moins 0). Le texte ne dit pas si le siège compte comme établissement.
- **ZO** : un nombre entier déclaré. Seuls comptent les établissements hors du pays **qui tiennent une comptabilité distincte**.
- **ZP** : une année (quatre chiffres), déclarée. Elle n'est jamais tirée du premier exercice du dossier : un dossier repris n'a pas commencé son activité avec OmegaX.
- **Contrôle (ZQ, ZQ, ZS)** : une seule réponse parmi public, privé national, privé étranger, ou pas encore dit.
  - Le texte ne dit pas expressément que les trois cases s'excluent. Elles forment pourtant une partition (public / privé national / privé étranger) : lecture d'OmegaX, dite.
  - À l'impression, on reproduit **deux fois « ZQ »** avec la mention [texte officiel], sans créer de ZR, puisque l'imprimé ne connaît pas ce code.

**Effet pour OmegaX**
- Ces données se stockent par exercice (comme SaisieNote) ou sur le dossier avec une date d'effet, SYSCOHADA seul (`@ReferentielsAutorises(SYSCOHADA)`).
- Elles sont toutes nullables, et une case non déclarée s'imprime « non renseignée ».
- Le nombre de cellules du module groupe peut être montré à côté de ZN et ZO, jamais substitué.
- Pour le contrôle, une entreprise du portefeuille à participation majoritaire (point 1) peut être proposée en « contrôle public », jamais imposée.

**Ce que le corpus ne tranche pas**
- La définition d'« établissement » (siège compris ou non).
- Le critère du « contrôle », par exemple le capital ou les droits de vote. L'art. 78 AUDCIF (contrôle, consolidation) n'est pas relié à la fiche par le texte et ne s'emprunte pas.
- L'usage effectif de la fiche R2 par la DGI congolaise.

---

## 6. F8-D1 · report au jour ouvrable des échéances de pur paiement

**Texte lu**
- LPF (loi n° 004/2003), **art. 110 bis**, créé et modifié par la L.F. n° 21/029 du 31 décembre 2021. Lu dans la compilation DGI au 19/07/2026 (`SK/fiscalite-rdc/code-general-2026/references/21-procedures-titre5-7-…md`, l. 245-260).
  - Al. 2 : « Si le dernier jour du délai prescrit par la législation fiscale pour l'exécution d'une obligation ou l'exercice d'un droit est un jour non ouvrable, la date de l'exécution d'une obligation ou l'exercice d'un droit est reportée au premier jour ouvrable qui suit. »
  - Al. 3 : « Par dérogation […], l'Administration des Impôts peut, **en matière de déclaration et de paiement des impôts**, fixer l'échéance déclarative et de paiement au jour ouvrable précédant la date de l'échéance légale. »
- Art. 57 bis LPF, modifié par la LF n° 25/060, art. 31 : acomptes « au plus tard le 25 juillet, le 25 septembre et le 25 novembre », sur bordereau (`procedures-fiscales/references/08-…md`).
- Décret n° 20/019, art. 1er et 2 : paiement auprès des intervenants (banques, établissements de crédit agréés, BCC). Circulaire n° 002 du 1er octobre 2020, III.2.2 : acomptes payés « auprès de l'intervenant ou de la Banque Centrale du Congo sur base du bordereau » (`24-mesures-execution-recouvrement.md`, l. 15-37 et 432-463).
- Décret n° 24/09, art. 1er : services publics « du lundi au vendredi ». Ordonnance n° 23-042, art. 1er : jours fériés.

**En vigueur : oui.**
- La compilation au 19/07/2026 ne mentionne aucune modification après 2021.
- La LF 2026 n'y touche pas.

**Décision**
- **Oui, le report de l'al. 2 s'applique aux échéances de pur paiement.**
  - L'al. 2 vise toute « obligation » dont le délai est prescrit par la législation fiscale. Payer un acompte à une date légale en est une.
  - L'al. 3 le confirme a contrario : il ne déroge à l'al. 2 « en matière de déclaration **et de paiement** » que parce que l'al. 2 couvre le paiement.
  - Il appelle aussi les dates fixes « échéance légale », ce qui range « au plus tard le 25 juillet » dans le champ de l'article.
- Sont donc reportés, sans doute possible :
  - le **dimanche** (Code du travail art. 7, 9°, et 121, déjà retenus) ;
  - les **dix jours fériés** de l'ordonnance n° 23-042.
- **Le samedi n'est pas tranché par la loi.**
  - L'art. 110 bis ne définit pas le « jour ouvrable ».
  - Le décret n° 24/09 fonde le samedi non ouvrable pour un acte fait **à la DGI** (déclaration), pas pour un paiement fait **à la banque** (décret n° 20/019).
  - Aucun texte lu ne dit si l'ouverture d'une banque le samedi rend ce jour ouvrable au sens de l'art. 110 bis.

**Effet pour OmegaX**
- Garder un seul calcul (`jour-ouvrable.ts`), et le **qualifier par nature d'échéance** :
  - **déclaration**, ou déclaration et paiement à la DGI : dimanche, fériés et samedi exclus, comme aujourd'hui ;
  - **pur paiement** (acomptes de l'art. 57 bis, reversements sur bordereau sans dépôt) : dimanche et fériés reportés au titre de l'art. 110 bis, al. 2.
- Pour le **samedi** d'une échéance de pur paiement, la règle de prudence du fichier (« sur un doute, on ne se trompe pas dans ce sens-là ») commande de **ne pas reporter**.
  - Le 25 juillet 2026 reste l'échéance affichée, avec une réserve qui nomme le lundi 27 comme report possible, non fondé sur un texte lu.
  - Jamais l'inverse : annoncer le 27 offrirait un délai que la loi lue n'accorde pas.
- Corriger la réserve imprimée : la **déclaration** se dépose à la DGI ; le **paiement** se fait chez l'intervenant (décret n° 20/019).
- La faculté d'avancer l'échéance (al. 3) n'est jamais calculée. Elle reste en réserve.

**Ce que le corpus ne tranche pas**
- Le caractère ouvrable du samedi pour un paiement en banque.
- Le corpus rapporte un communiqué DGI qui reporte le premier acompte de 2026 au lundi 27 juillet 2026 (`lois-de-finances-annuelles/references/lf-2026-mesures-fiscales.md`, l. 48). Le texte de ce communiqué n'est pas au corpus, et l'al. 3 ne donne à l'Administration que le pouvoir d'**avancer** l'échéance. C'est une corroboration, pas une source : elle ne fonde aucune règle.
- Si Manasse veut suivre ce report, c'est une décision **hors du texte**, à écrire comme telle. C'est le seul point des six qui remonte à Manasse.


## Décision de Manasse du 2026-10-04 · le samedi des échéances de pur paiement

« Le texte dit au plus tard le 25, donc il faut s'arranger pour payer avant cette date. En RDC, les banques travaillent samedi jusqu'à 12h. » · pour une échéance de PUR PAIEMENT (paiement en banque, sans dépôt au guichet), le SAMEDI EST OUVRABLE · une échéance qui tombe un samedi n'est PAS reportée au lundi (le 25 juillet 2026 reste le 25). Le dimanche et les jours fériés restent reportés (LPF art. 110 bis al. 2). L'exclusion du samedi tirée du décret n° 24/09 (horaire des services publics) ne vaut que pour une obligation qui s'exécute au GUICHET de l'Administration (dépôt d'une déclaration). Le communiqué de la DGI reportant au 27 juillet n'est pas suivi.
