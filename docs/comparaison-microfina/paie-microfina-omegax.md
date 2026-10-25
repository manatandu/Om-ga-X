# La paie et le personnel · Microfina++ et OmegaX (2026-10-25)

Audit comparatif, sans décision. Rien de ce qui suit n'est codé : toute
amélioration nommée au § (d) est une FONCTION NOUVELLE, sous le gel des
nouveautés (CLAUDE.md § 5), et n'entre sur `main` que si Manasse lève le gel
pour elle (« une demande expresse vaut levée du gel pour elle seule »).

Conventions · « M p. N » renvoie au folio IMPRIMÉ du manuel Microfina++, lu
dans le texte ; « CAMEC p. N » à une page du manuel telle que la cite la note
de la CAMEC (source secondaire, page non lue par cet audit) ; un chemin renvoie
au fichier d'OmegaX lu sur la révision `e0cc3e1`. L'audit du parcours de paie
d'OmegaX (`docs/audit-parcours-paie-2026-10-25.md`, branche
`travail/audit-paie`) est la base côté OmegaX ; il n'est pas recopié, ses
constats sont renvoyés par leur numéro (« audit, étape 8 », « audit, (c) 1 »).

---

## (a) Sources lues, et ce qui ne l'a pas été

### Microfina++

| Source | Lu | Non lu | Pourquoi |
|---|---|---|---|
| Manuel « Guide de l'utilisateur · Microfina Plus », MEDIASOFT, version 0.1 (Drive `1OcCKxMz0aS1xRPqQ5SHwxm8bRJrlac_U`, 10 739 743 octets, 306 pages selon la note de la CAMEC) | texte des folios 1 à 79, du sommaire au plan d'épargne (« Consultation du tableau d'amortissement », M p. 79) | **folios 80 à 306, donc la totalité des modules Paie et GRH** | l'outil de lecture du Drive rend un texte coupé à 62 563 caractères, qui s'arrête au folio 79 puis à la liste des liens ; le téléchargement est refusé (« over limit of 10 MB ») ; le téléchargement direct par le réseau est refusé par le relais (`drive.google.com`, `connect_rejected`). Les captures d'écran n'ont été vues à aucune page. |
| Même manuel, recherche plein texte du Drive (présence d'un mot) | essayée | · | résultats contradictoires (« salaire » trouvé avec un filtre de titre, absent avec un autre ; « prime » trouvé alors que le mot n'apparaît que dans « PrimeFaces » et « supprimer ») · **aucune conclusion n'en est tirée** |
| Note CAMEC « Microfina++ : constats d'usage et manuel de l'utilisateur » (`1rG8lSpznEsi-GVjXKFkK2cXxcRDrbX4O`, 22/10/2026) | en entier | · | source SECONDAIRE · ses auteurs ont lu le manuel entier et en citent les pages |
| Note CAMEC « Constats, risques et recommandations » (`1LKlfFGVyEXDnRQByq6dMBqqvFbCmp_h2`, 70 constats) | en entier | · | constats 11, 55, 56 sur la paie et le personnel ; 3, 20, 27, 29 sur le contrôle interne qui touche aussi la paie |

**Ce que le manuel dit lui-même de la paie et du personnel, dans les folios
lus** · trois phrases, et rien d'autre :

1. « [Paie] : Pour la gestion de la paie des personnels » (M p. 6) ;
2. « [GRH] : Pour la gestion des ressources humaines » (M p. 6) ;
3. « Dans le module [GRH], nous trouverons essentiellement les informations
   concernant le personnel » (M p. 6-7, « Les données de base »).

**Ce que la note de la CAMEC en rapporte** (pages du manuel non lues ici) :

4. « Types d'avance, mise en place et visa des retenues sur salaire » ·
   « Module Paie, p. 275-279 » (CAMEC, constat 11) ;
5. le manuel « indique lui-même “l'onglet ne marche pas” pour […] virement des
   salaires du personnel et prélèvement automatique (p. 137) » (CAMEC, § 4).

Le folio 137 n'a pas été lu. Le seul « l'onglet ne marche pas » visible dans
le texte lu est au folio 70, entre « Chèque pour crédit » et « Emprunts
bancaires » (M p. 70) ; la note le place à la p. 71, ce qui donne l'écart de
pagination entre la note (qui suit vraisemblablement le folio du PDF) et le
folio imprimé · une à deux pages.

**Conséquence, à ne pas perdre de vue** · cet audit NE PEUT PAS dire ce que
calcule la paie de Microfina++ (brut, CNSS, INPP, ONEM, IRPP, net), ni ce que
tient son module GRH. Il ne prête à Microfina++ aucune fonction de paie au-delà
des cinq points ci-dessus. Pour trancher, il faut le PDF lui-même (le scinder
sous 10 Mo, ou l'exporter en texte, sur un poste qui l'ouvre), ou une
démonstration à l'écran chez la CAMEC avec le responsable SIG, comme la note
le propose (« à vérifier à l'écran avec le responsable SIG », CAMEC, Limites).

### OmegaX

Lus · `docs/audit-parcours-paie-2026-10-25.md` (branche `travail/audit-paie`) ;
dans le code, `src/modules/personnel/` (contrôleurs, `avances-salaire.ts`,
`avances-rubriques.service.ts`, `personnel.service.ts` aux lignes de la
retenue d'avance, `paiement-salaires.ts`, `bulletin-paie.ts`),
`src/modules/retenues/correspondance-retenues.ts`, `src/modules/import/dto/import.dto.ts`,
`prisma/schema.prisma` (modèles `Salarie`, `AvanceSalaire`,
`RetenueAvanceBulletin`), `client/src/lib/onglets-personnel.ts`,
`client/src/pages/PersonnelPage.tsx`, `client/src/pages/BulletinsPaie.tsx`,
`client/src/components/RubriquesAvancesPaie.tsx`.

Textes relus pour le § (d) · Code du travail, art. 103, 112 et 215
(compétence `droit-travail-congolais`, `texte-loi-verbatim/05-titre-v-du-salaire.md`,
`10-titre-x-des-moyens-de-controle.md`) ; arrêté n° 146/2018, art. 21 à 25
(compétence `cnss-cotisations-sociales-rdc`,
`am-146-2018-affiliation-immatriculation-cotisations-liquidation-prestations.md`).

---

## (b) Fonction par fonction

Légende · **oui** : la fonction existe dans OmegaX, vérifiée dans le code ;
**partiel** : un équivalent existe, avec un périmètre différent ; **non** :
rien.

### (b-1) Fonctions de paie et de GRH que le manuel décrit

| # | Fonction Microfina++ | Page | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|---|
| 1 | Module Paie, « gestion de la paie des personnels » | M p. 6 | oui | `src/modules/personnel/` (simulation, bulletin, passation, paiement) ; menu Registre du personnel et Paie du mois | le manuel lu n'en dit que le titre ; la comparaison du calcul est impossible (a) |
| 2 | Module GRH, « informations concernant le personnel » | M p. 6-7 | partiel | modèle `Salarie` (`prisma/schema.prisma`, l. 7940 · matricule, état civil, n° d'affiliation CNSS, nationalité, aptitude, engagement et départ), `ContratTravail`, `EnfantACharge`, `PieceJointeSalarie` ; onglets `registre`, `confrontation`, `effectif` (`client/src/lib/onglets-personnel.ts`) | OmegaX tient le REGISTRE du Code du travail (art. 212, quinze énonciations) ; aucune fonction de gestion des carrières, d'évaluation ni de formation (voir (c), constat 56) |
| 3 | Types d'avance | CAMEC p. 275-279 | oui | `TypeAvance` · AVANCE, ACOMPTE, PRET, SAISIE_ARRET (`src/modules/personnel/avances-salaire.ts`) ; compte par type, 42110000, 42120000, 272x, 42320000 (`compteDeLAvance`) | OmegaX ne laisse pas créer de type libre · chaque type porte son littera de l'art. 112 et son compte ; Microfina++ paramètre des types (le manuel n'est pas lu pour dire comment) |
| 4 | Mise en place d'une avance | CAMEC p. 275-279 | partiel | `POST /personnel/salaries/:salarieId/avances` (`avances-rubriques.controller.ts`), objet et pièce justificative exigés, retenue mensuelle facultative (`motifRefusAvance`) ; écran `RubriquesAvancesPaie.tsx` | le VERSEMENT de l'avance n'est pas passé par le module · aucun lien d'écriture dans `AvanceSalaire` (schéma, l. 8447), « le versement est une écriture de trésorerie du cabinet » (CLAUDE.md § 6, rubriques de paie, point 3) |
| 5 | Visa des retenues sur salaire | CAMEC p. 275-279 | non | `AvanceSalaire` n'a ni auteur du visa ni date de visa ; aucune route `viser` sous `/personnel/avances` (`avances-rubriques.controller.ts`, routes GET, POST, PATCH `fin`, DELETE) | OmegaX vise le RIB d'un salarié (`POST /personnel/ribs-salaries/:id/viser`, `paiement-salaires.controller.ts` ; `tiers/visa-rib.ts`), jamais une avance ni une retenue |
| 6 | Virement des salaires du personnel | CAMEC p. 137 (signalé en panne par le manuel, selon la note) | oui | `POST /personnel/paiement-salaires/:mois` (`paiement-salaires.controller.ts`), mode convenu par salarié (art. 98, al. 2, `paiement-salaires.ts`), écriture agrégée D 422 / C trésorerie, ORDRE DE VIREMENT numéroté, RIB du salarié visé si l'option est prise (CLAUDE.md § 6, « Visa des RIB ») | aucun FICHIER bancaire (audit, (c) 7) · l'ordre s'imprime ; mais il fonctionne, quand celui de Microfina++ est dit en panne par son propre manuel |

### (b-2) Ce qu'OmegaX fait et que le manuel lu ne décrit pas

Le manuel lu ne décrit AUCUN de ces points ; cela ne prouve pas que Microfina++
ne les ait pas (folios 80 à 306 non lus). La colonne « texte » cite le
fondement que le dépôt documente pour chaque fichier (CLAUDE.md § 6, P0 à P9
et ligne sage-l5) ; les textes n'ont pas été relus un à un pour cette
colonne, sauf ceux du § (d).

| Fonction OmegaX | Preuve | Texte que le code cite |
|---|---|---|
| Registre du personnel aux quinze énonciations, avec la confrontation de ce qui manque | `GET /personnel/confrontation` (`personnel.controller.ts`) | Code du travail, art. 212 |
| Contrat confronté au minimum de sa classe (dix-sept classes, SMIG) | `regles-contrat-travail.ts`, `bareme-smig.ts` | décret n° 25/22, art. 2 à 7 ; décret n° 25/21, art. 3 |
| Deux assiettes, sociale et fiscale | `assiettes-paie.ts` | Code du travail, art. 7, point 8 ; loi n° 23/053, art. 68, 69 |
| CNSS, plancher au SMIG des jours payés, barème daté | `cotisations-paie.ts`, `baremes-dossier.ts` | décret n° 18/041, art. 2 à 8 et 10 à 11 ; loi n° 16/009, art. 13 |
| INPP au taux de la nature de l'employeur et de l'effectif, payé par trimestre | `cotisations-paie.ts`, `retenues/inpp-trimestriel.ts` | arrêté n° 002/CAB/MET/2025 ; ordonnance n° 84/186, art. 1er et 3 |
| ONEM | `cotisations-paie.ts`, `retenues/correspondance-retenues.ts` | arrêté n° 028/2025 |
| IRPP mensualisé, plafond de 30 %, arrondi de l'art. 150 | `bareme-irpp.ts`, `fiscalite/arrondi-article-150.ts` | loi n° 23/053, art. 118, 119, 123, 150 |
| Salaire en dollars converti au cours du jour de mise à disposition | `conversion-usd.ts` | loi n° 23/053, art. 115 ; Code du travail, art. 89 |
| Bulletin émis, indélébile, numéroté, annulé avec motif | `bulletin-paie.ts`, `POST /personnel/bulletins/:id/annulation` | Code du travail, art. 103, 214 ; arrêté du 8 août 2008, art. 2 et 4 |
| Passation au journal en trois temps, au centime, reprise en négatif d'un bulletin annulé | `comptabilisation-paie.ts`, `passation-paie.ts` | Guide SYSCOHADA, Partie 1 ch. 3 § 4 ; fiche du compte 42 ; AUDCIF art. 20, al. 2 |
| Retenue d'avance, de prêt, de saisie-arrêt sur le bulletin, bornée au solde et au net | `personnel.service.ts` (`retenuesAvances`, `motifRefusRetenue`), `RetenueAvanceBulletin` | Code du travail, art. 112, c), f), g) ; AUPSRVE, art. 187 et 201 |
| Quotité saisissable montrée | `quotite-saisissable.ts` | Code du travail, art. 114 |
| Congés acquis, allocation de congé | `conges-acquis.ts`, `salaire-pendant-le-conge.ts` | Code du travail, art. 140 à 142 |
| Absences, treize causes, indemnité de la Caisse déclarée | `absences.ts` | Code du travail, art. 59, 93, 105, 106, 130, 146 ; arrêté n° 146/2018, art. 139 |
| Heures majorées à taux DÉCLARÉ | `heures-majorees.ts` | aucun taux au corpus, dit |
| Décompte final, préavis, art. 63 à 67, émis comme un bulletin | `decompte-final.ts`, `decompte-final-emis.ts`, `remuneration-du-delai.ts` | Code du travail, art. 63 à 72, 141 à 144, 258 |
| Paiement par caisse provisionnée, billetage déclaré | `paiement-salaires.ts`, `comptabilite/caisse-provisionnee.ts` | fiche du compte 57 des deux plans |
| Ventilation analytique de la paie | `ventilation-analytique-paie.ts` | SYCEBNL Partie 2 ch. 3, classe 9 |
| Registre des retenues et échéancier (CNSS, INPP, ONEM, IRPP) | `src/modules/retenues/retenues.service.ts`, `GET /retenues/registre`, `GET /retenues/echeancier` | arrêté n° 146/2018, art. 21 ; ordonnance n° 84/186 |
| Contrôle des 33 énonciations du livre de paie | `livre-de-paie.ts`, `POST /personnel/livre-de-paie` | arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008 |
| Rôle cantonné « gestionnaire de paie » | `common/guards/roles-cantonnes.ts` | décision de l'éditeur (CLAUDE.md § 8) |

Ce qu'OmegaX n'a pas, côté paie, est déjà nommé par l'audit du parcours :
aucune déclaration CNSS (Mod. DC), INPP, ONEM ni IRPPDR1 produite (audit,
étapes 12 à 14) ; bulletin imprimé par le navigateur, douze mentions sur
trente-trois, sans identité de l'employeur (étape 8, `BulletinsPaie.tsx`
l. 383, `bulletin-paie.ts` l. 109-146) ; aucun traitement en lot du mois
(étape 7) ; paramètres ressaisis à chaque simulation (étape 6) ; aucun import
du personnel (`TypeImport` ne connaît que `PLAN_COMPTES`, `BALANCE`,
`ECRITURES`, `src/modules/import/dto/import.dto.ts` l. 3-7) ; aucun export de
la paie (étape 19).

---

## (c) Ce que la CAMEC vit avec Microfina++, et si OmegaX le règle

| Constat | Ce que la note dit | OmegaX le règle ? | Preuve |
|---|---|---|---|
| Usage 11 · Recommandations 55 | « Les avances au personnel sont saisies sur Excel, puis importées dans le logiciel au moment de la paie. » Risque · « une avance peut être oubliée ou mal retenue sur le salaire » ; recommandation · « saisies directement dans le module Paie et validées par un responsable » | **en partie** · l'avance se saisit dans OmegaX, avec objet et pièce exigés, et la retenue sur le bulletin est bornée à son solde et au net. Mais (1) la retenue n'est PAS proposée d'office · la retenue mensuelle convenue n'est qu'un texte d'aide dans le champ, que le gestionnaire doit taper à chaque bulletin, donc une avance PEUT encore être oubliée ; (2) aucune validation par un responsable ; (3) aucun import, alors que la CAMEC importe aujourd'hui | `client/src/pages/PersonnelPage.tsx` l. 2958-2959 (`placeholder` = retenue mensuelle) ; `personnel.service.ts` l. 1120 (seules les retenues DEMANDÉES sont lues) ; schéma `AvanceSalaire` sans visa |
| Recommandations 56 | « Seuls deux services évaluent leur personnel, et la dernière rotation des postes remonte à deux ou trois ans. » | **non** · OmegaX ne tient ni évaluation, ni rotation, ni congé obligatoire sur un poste sensible | aucun modèle d'évaluation dans `prisma/schema.prisma` (recherche « evaluation » · seuls `EvaluationTitre` et les écarts de consolidation) |
| Usage § 4 | « virement des salaires du personnel et prélèvement automatique (p. 137) » signalés en panne par le manuel | **oui** pour le virement des salaires (ordre de virement numéroté, écriture D 422 / C banque) ; le prélèvement automatique n'a pas d'objet hors d'une institution de dépôt | `paiement-salaires.controller.ts`, `paiement-salaires.ts` |
| Usage 3 · Recommandations 27 | « Un même utilisateur peut saisir et valider une opération. » | **oui** pour l'écriture de paie · passée au brouillard, validée par le comptable, double regard en option ; **non** pour l'avance (aucun visa) | `@ReserveAuComptable()` sur la passation (`personnel.controller.ts` l. 253) ; `Tenant.doubleRegardValidation` (schéma, l. 664) |
| Recommandations 20 · 29 | une écriture validée peut être annulée par l'administrateur ; aucune trace des modifications | **oui** · un bulletin émis ne se modifie pas, il s'annule avec motif ; sa passation validée se reprend en NÉGATIF ; journal d'audit chaîné | `POST /personnel/bulletins/:id/annulation` ; CLAUDE.md § 6, P9 ; `src/common/audit/` |
| Recommandations 7 et 32 | la CAMEC paie des enseignants pour le compte d'une banque ; crédits aux enseignants non garantis par les salaires | **hors champ** · activité connexe d'un établissement de crédit, et domiciliation des salaires · OmegaX ne tient ni crédit ni compte de déposant | compétence `reglementation-microfinance-rdc` (activités connexes, non relue ici) |

---

## (d) Verdict

### Où OmegaX est en avance

Sur tout ce qui se CALCULE et se COMPTABILISE, autant qu'on puisse le dire sans
avoir lu la paie de Microfina++ :

1. **Un moteur de paie congolais sourcé article par article** (b-2) · deux
   assiettes, CNSS avec plancher, INPP selon la nature de l'employeur et
   payé par trimestre, ONEM, IRPP mensualisé, dollars, congés, absences,
   décompte final des art. 63 à 67. Le manuel lu ne dit RIEN de tout cela.
2. **Un virement des salaires qui fonctionne**, là où le manuel de
   Microfina++ dit le sien en panne (CAMEC, § 4), avec le RIB du salarié visé
   par un second utilisateur et la caisse qui ne paie que ce qu'elle contient.
3. **Une paie que l'on ne peut pas réécrire** · bulletin indélébile, annulation
   motivée, reprise en négatif, journal d'audit chaîné · ce que la CAMEC
   reproche précisément à son logiciel (recommandations 20 et 29).

### Où OmegaX est en retard

Sur la SORTIE et le GESTE RÉPÉTÉ, que le client voit chaque mois :

1. **Les avances** · Microfina++ décrit un VISA des retenues sur salaire
   (CAMEC p. 275-279) ; OmegaX n'en a pas, ne propose pas la retenue d'office
   et ne passe pas le versement de l'avance. C'est le seul point de paie sur
   lequel une fonction de Microfina++ est attestée et absente d'OmegaX.
2. **L'import** · la CAMEC importe ses avances dans Microfina++ ; OmegaX
   n'importe ni avance ni salarié.
3. **Les documents à remettre** (audit, (c) 1, 3, 5, 6) · aucun bulletin PDF
   à l'en-tête de l'employeur, aucun Mod. DC, aucun livre de paie édité. On ne
   sait pas si Microfina++ les produit (folios non lus) ; un client qui
   compare les deux à l'écran les cherchera d'abord.

Au-delà, le retard de Microfina++ ou d'OmegaX sur la GRH (évaluation,
formation, carrière) ne peut pas être jugé · le manuel lu n'en dit qu'un titre.

### Les cinq améliorations les plus rentables

Classées par valeur pour un client réel. Toutes sont des fonctions NOUVELLES
sous le gel de CLAUDE.md § 5 · aucune n'est codée, aucune ne l'est sans levée
expresse du gel par Manasse. Efforts en jours, relecture et rejeu sur vraie
base à travers une clôture compris (CLAUDE.md § 10).

| Rang | Amélioration | Valeur client | Effort | Risque comptable | Texte qui la fonde |
|---|---|---|---|---|---|
| 1 | **Paie du mois en un geste, sur des paramètres enregistrés** · nature de l'employeur, régime de retenue, effectif, classe déclarés UNE fois avec leur source ; salaire du contrat repris au bulletin ; proposition des bulletins de tous les salariés sous contrat, revus puis émis par lot (audit, (d) 1 et 2) | très forte · c'est le geste mensuel, et le refus INPP du premier bulletin disparaît | 8 à 12 j | moyen · un paramètre ne doit jamais être PRÉSUMÉ (il reste déclaré, figé au bulletin) et l'émission reste un geste explicite | Code du travail, art. 103 (décompte « au moment du paiement ») ; la règle « jamais présumé » de l'INPP (CLAUDE.md § 6, P2b) |
| 2 | **Avances tenues jusqu'au bout** · versement passé par le module (D 421 ou 272 / C trésorerie, au brouillard), retenue mensuelle convenue PROPOSÉE d'office sur chaque bulletin jusqu'au solde, modifiable, et VISA facultatif de l'avance par un second utilisateur, sur le modèle du visa des RIB · ferme la recommandation 55 de la CAMEC et rattrape la seule fonction de paie attestée chez Microfina++ | forte · « une avance peut être oubliée ou mal retenue » (CAMEC, 55) | 3 à 5 j | faible · la retenue reste bornée au solde et au net (`motifRefusRetenue`) ; le visa ne bloque que si l'option est prise, comme le double regard, aucun texte ne l'imposant | Code du travail, art. 112, c) et f) (retenues autorisées « à titre d'avances », « à titre de prêt ») ; fiche du compte 42 des deux plans, telle que la cite `avances-salaire.ts` (4211, 4212, exclusion des prêts vers le 272) |
| 3 | **Déclaration CNSS préparée** · état du Mod. DC sur les bulletins ÉMIS du mois (nom, n° d'affiliation, siège, période, brut, assiette, cotisations dues, travailleurs au dernier jour, enfants bénéficiaires, date et mode de paiement) et les feuilles de paie jointes, en Excel et à l'impression, présenté comme état de préparation et non comme l'imprimé de la Caisse | très forte · première obligation mensuelle de tout employeur | 5 à 7 j | moyen · montants lus sur les bulletins figés, jamais recalculés ; le gabarit de la télédéclaration n'est pas au corpus (« selon le modèle retenu par elle », art. 24) ; les deux voies de déclaration ne s'articulent pas (art. 21 et 22), le cabinet choisit | arrêté n° 146/2018, art. 21 (« dans les quinze jours suivant le mois civil »), art. 23 (dix mentions du Mod. DC), art. 24 (feuilles de paie jointes ; voie électronique au-delà de vingt-cinq travailleurs), art. 25 (mentions de la feuille de paie) |
| 4 | **Bulletin PDF à l'en-tête de l'employeur, et livre de paie édité** depuis les bulletins émis, le mois entier en un fichier, chaque mention non portée dite, jamais « conforme au modèle » | forte · le salarié et l'inspecteur du travail demandent un document | 5 à 8 j | faible sur les montants ; risque de présentation (le modèle annexé de 2008 est une reconstitution, CLAUDE.md § 6, P6) | Code du travail, art. 103, al. 2 (sans décompte écrit, les allégations de l'employeur « sont rejetées ») ; art. 215 (livre de paie conforme au modèle de l'arrêté ; « tout autre document » sur autorisation de l'Inspecteur ; moins de vingt-cinq travailleurs, « livre de paie inspiré du modèle ») |
| 5 | **Import Excel du personnel et des avances en cours** · une ligne par salarié, contrat ou avance, jugée par les règles de la saisie (sexe, monnaie exigée avec un montant, objet et pièce de l'avance), refus ligne par ligne | moyenne à forte · c'est la porte d'entrée d'un client qui quitte Microfina++ ou Excel, et la CAMEC importe déjà | 3 à 5 j | faible · aucune écriture ; une avance importée garde sa pièce exigée, son solde se lit sur les bulletins | Code du travail, art. 212 (énonciations du registre, déjà tenues par `confrontation`) ; art. 112, c) et f) |

Hors classement · un tableau des soldes de congés de tout le personnel
(lecture seule, audit, (c) 10) ; la lecture du registre des retenues par le
gestionnaire de paie et la mention du brouillard non lu (audit, (d) 5) ;
l'évaluation annuelle du personnel (CAMEC, 56), qui est une demande
d'organisation et non de comptabilité, et qu'aucun texte lu n'impose.

### Ce qui reste à lire avant de conclure davantage

Les folios 80 à 306 du manuel, et d'abord les pages que la note de la CAMEC
désigne pour la paie (275 à 279) et le virement des salaires (137). Sans eux,
cet audit compare OmegaX à cinq lignes de Microfina++ ; le verdict « en
avance » vaut contre le manuel LU, pas contre le logiciel.
