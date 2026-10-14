# Sage 100 i7, Structure des fichiers · table par table

Manuel 6 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Sage 100 i7, version 17.50, Structure des fichiers », Sage, mise à
jour de mars 2013, 703 pages (Drive, id 1_BTjaaQiwXYPiXtPZ8-5huzW4Z8w1Q3Y).
Le texte a été extrait du PDF puis lu en entier le 2026-10-14 : les pages 1 à
36 et les jointures par la session, les pages 37 à 628 par trois relevés
parallèles, chacun allé jusqu'à la dernière ligne de sa plage. Les pages 630
à 632, 656 à 658 et 673 à 674 ne portent que des titres en texte : ce sont
des schémas de jointures, lus ensuite en image le même jour (comptabilité :
tiers et écritures, budgets et écritures, taxes ; gestion commerciale :
lignes de documents, articles, familles ; paie : salariés et paramètres).
Ils relient des tables déjà comparées ligne par ligne et n'ajoutent aucune
fonction ; ils confirment les lignes 171 et 172. Seule la page 630 se lit
sans réserve ; sur les sept autres, des traits sans libellé et des
cardinalités restent illisibles, et rien n'en est tiré.

Ce manuel ne décrit pas des écrans mais les tables de la base de données de
Sage 100 : Comptabilité, Gestion commerciale, Immobilisations, Moyens de
paiement et Trésorerie, Paie Maestria, Manager. Une table est ici une
fonction : elle dit ce que Sage retient et quelles règles il pose. La
comparaison porte donc sur ce qu'OmegaX retient (schéma Prisma, 156 modèles)
et sur les règles qui s'y attachent. Les tables qui ne servent qu'à ranger
des colonnes ou des listes sont regroupées, chacune nommée. Les champs
techniques (marqueur, créateur, date de modification, réplication) ne sont
pas comparés.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M4 » et « M5 » renvoient aux manuels Immobilisations et Moyens de paiement,
dont ces tables sont la base. Les statuts ont été lus dans le code le même
jour, sur la branche `travail/virement-fonds`, et aucune ligne n'est restée
non vérifiée.

## Accès aux tables (p. 1 à 36)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Pilote ODBC : lecture de toutes les tables, écriture (ajout, modification, suppression) dans la plupart, avec des exemples d'insertion | 18 à 36 | DIFFÉRENT, VOULU | Aucun accès direct à la base. Toute écriture passe par le serveur, qui refuse à la racine ce qui casserait en silence (CLAUDE.md, § 10 bis) et tient le journal d'audit. Le dossier se restitue en lecture : une archive d'un CSV par table (`exports/restitution/`). |

## Comptabilité (p. 37 à 218)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 2 | P_DOSSIER, identification et exercices : cinq exercices, période clôturée par exercice, date de clôture, dernière période archivée | 38 à 44 | FIDÈLE | `Tenant` et `Exercice`. Le nombre d'exercices n'est pas limité à cinq. |
| 3 | P_DOSSIER, numérotation continue et protection de la zone pièce | 38 à 44 | FIDÈLE | `Journal.numerotation` (manuelle, continue par journal, continue pour le dossier, mensuelle). Toute écriture porte le numéro que son journal impose (`journaux/numerotation-piece.ts`). |
| 4 | P_DOSSIER, type de validation et suppression après validation | 38 à 44 | DIFFÉRENT, VOULU | La validation est irréversible et une écriture validée ne se supprime pas (AUDCIF art. 22, 2°). Elle se corrige par inscription en négatif (art. 20, al. 2). Le double regard à la validation est une option du dossier (`Tenant.doubleRegardValidation`). |
| 5 | P_DOSSIER, éléments en sommeil interdits en saisie, ouverture de compte en saisie, confirmation des suppressions | 38 à 44 | PARTIEL | Un compte en sommeil est refusé en saisie sauf confirmation expresse (`confirmerComptesEnSommeil`). La grille de saisie n'ouvre pas de compte : elle nomme le compte non personnalisé et renvoie au Plan comptable. |
| 6 | P_DOSSIER, saisie des à-nouveaux, journal et comptes de l'à-nouveau (ouverture, bénéfice, perte) | 38 à 44 | FIDÈLE | Report calculé par la clôture ou en à-nouveau provisoire, résultat au compte 13 (`exercice/report-a-nouveau.ts`). |
| 7 | P_DOSSIER, longueur des comptes généraux (libre ou 3 à 13) et des sections analytiques | 38 à 44 | PARTIEL | `Tenant.longueurCompte`, de 3 à 13, jamais sous le plus long numéro déjà ouvert. La longueur des codes de section n'est pas paramétrée. |
| 8 | P_DOSSIER, options analytiques : plan par défaut, ventilation en quantité ou en devise, affectation automatique, budgets général et analytique, pré-ventilation à l'import | 38 à 44 | PARTIEL | `PlanAnalytique` (classes ventilées, ventilation obligatoire, gestion des budgets). Ni ventilation en quantité ou en devise, ni affectation automatique, ni budget par compte général. |
| 9 | P_DOSSIER, équilibre à l'import (par journal, analytique), comptes d'écart d'import | 38 à 44 | DIFFÉRENT, VOULU | L'import refuse une pièce déséquilibrée et nomme la ligne (`import/import.service.ts`). Aucun compte d'écart ne boucle une pièce fausse. |
| 10 | P_DOSSIER, équilibre en devise (alerte, modifier le montant ou le cours), devise de tenue et d'équivalence | 38 à 44 | DIFFÉRENT, VOULU | La monnaie de tenue ne se choisit pas (loi n° 23/053 art. 141, 1° ; AUDCIF art. 17, 1°). Une ligne en devise dont le montant n'est pas la contrevaleur au centime est refusée, jamais ajustée (`comptabilite/ligne-en-devise.ts`). La monnaie fonctionnelle donne un second jeu sans valeur légale. |
| 11 | P_DOSSIER, extourne ou annulation en négatif (option) | 38 à 44 | DIFFÉRENT, VOULU | Toujours en négatif, sans option : l'art. 20, al. 2 de l'AUDCIF l'impose. |
| 12 | P_DOSSIER, TVA sur encaissement (registre, affectation), mise à jour du registre de taxe, norme DGI, seuil d'équilibre TVA | 38 à 44 | PARTIEL | La TVA à l'encaissement est lue sur les règlements lettrés par la déclaration (`TauxTvaService.exigibilite`). Aucun registre de taxe tenu à part, aucune norme française. |
| 13 | P_DOSSIER, gestion IFRS et saisie dans des journaux IFRS | 38 à 44 | DIFFÉRENT, VOULU | IFRS par retraitements tenus à côté, jamais dans les écritures (`docs/decision-multi-classification.md`). |
| 14 | P_DOSSIER, rapprochement : devise, recherche systématique, écart de montant admis, contrepartie unique ; numéro de pièce des règlements | 38 à 44 | DIFFÉRENT, VOULU | Le rapprochement proposé n'admet aucune tolérance : l'écart se comptabilise (`rapprochement/releve-bancaire.ts`). |
| 15 | P_DOSSIER, pénalités de retard (imputation, taux), frais d'impayés, solde minimum de rappel, délai client maximum | 38 à 44 | ABSENT | Ni pénalités ni frais d'impayé ; aucun délai maximum par client. |
| 16 | P_ANALYTIQUE : dix plans, six ruptures (zone géographique, secteur), type d'imputation, plan obligatoire, section d'attente | 45, 46 | PARTIEL | Plans analytiques sans limite de nombre, classes ventilées et ventilation obligatoire. Ni ruptures, ni section d'attente. |
| 17 | P_ANALYSE, P_STATISTIQUE, F_ENUMSTAT, F_ENUMANAL : niveaux d'analyse, statistiques des tiers et leurs valeurs, énumérés des ruptures | 46, 47, 69, 70, 176, 177 | ABSENT | Aucun champ statistique. |
| 18 | P_COLONNCPTA et toutes les tables de colonnage (P_ORGAVEN, P_ORGAACH, P_ORGASTO, P_ORGATIERS, P_ORGAART, P_REAPPRO, P_ABOCLI, P_ABOFOUR, P_ABOINT, P_CONTREMARQUECOM, P_CONTREMARQUELIV, P_INTERROSTO, P_INTERROTAR, P_REGULINV, P_RECHDOC, P_RECHLIG, P_AFFAIRE, P_COLREGLEMENT, P_INTERROCAISSE, P_REMISEBANQUE, P_CMDALIVRER, P_CMDDETAIL, P_CMDARTICLES, P_VALIDPLUNITAIRE, P_VALIDPLGLOBALE, P_INTERROSTONOMENCL, P_INTERRONOMENCL, P_INTERROTARNOMENCL, P_INTERROREPRES, P_INTERRORESS, P_INTERROCOMPTERESS, P_DOCAFFAIRE, P_INTERRODOCREPRES, P_AVANCEMENT, P_TRACABILITE, P_COLONNTRES) : colonne disponible, obligatoire, impossible ou masquée, par écran | 47, 48, 230 à 269, 502, 503 | ABSENT | Les colonnes des écrans ne se paramètrent pas. |
| 19 | P_REGLEMENT : trente modes de règlement, modes de paiement, codes interbancaires principaux, RIB associés | 48, 49 | ABSENT | Aucun mode de règlement (voir M5, ligne 8). |
| 20 | P_RAPPEL : dix périodes de rappel (début, fin, intervalle) | 49 | FIDÈLE | Niveaux de relance avec leur nombre de jours après l'échéance (`NiveauRelance`). |
| 21 | P_NATURE : quatorze natures de comptes, dix fourchettes chacune, options par défaut (regroupement, analytique, échéance, quantité, devise, lettrage, tiers, report) | 50, 51 | PARTIEL | Sept natures, fourchettes, et deux défauts seulement : report et lettrage (`comptes/natures-compte.ts`). |
| 22 | P_TIERS : types de tiers, numérotation manuelle, automatique ou par racine, longueur | 52 à 54 | FIDÈLE | Cinq types de tiers. Le numéro est proposé sous la racine du collectif et choisi à la création (`GET /tiers/numero-propose`). |
| 23 | P_REGISTRE et F_REGREVISION : registre de révision par écriture (période, réviseur, contrôleur, dates, commentaire) | 54, 55, 165 à 167 | ABSENT | Aucune marque de révision par écriture. La révision passe par le questionnaire et le dossier de révision (ligne 66). |
| 24 | P_DEVISE : trente-deux devises, mode de cotation, cours de clôture, ancienne cotation datée | 55, 56 | PARTIEL | Devises et cours datés avec leur source (`Devise`, `CoursDevise`). Pas de mode de cotation inverse ni d'ancienne cotation. |
| 25 | P_REJET, F_INTERBANCAIRE, F_BANQUEAFB : motifs de rejet, codes d'opération interbancaires avec conditions de valeur et règles de rapprochement | 57, 188 à 192, 196, 197 | ABSENT | Voir M5. |
| 26 | P_BANQUESTRUCT : structures de RIB (locale, étranger, BIN, IBAN), contrôle de la clé | 60, 61 | PARTIEL | Seul l'IBAN est contrôlé (modulo 97) ; les formats nationaux sont gardés sans vérification (`banques/banques.ts`). |
| 27 | P_CRISQUE : codes risques, dépassement d'encours minimum et maximum | 57, 58 | ABSENT | Ni encours, ni code risque. |
| 28 | P_LETTRAGE : ajustements de lettrage (écart de règlement, de conversion, de change), journal et modèles | 58, 59 | PARTIEL | L'écart de change réalisé est proposé au lettrage et passé au clic (`POST /reglements/ecart-change`). Aucun ajustement automatique d'un écart de règlement. |
| 29 | P_FILTREREV : filtres de révision | 59, 60 | ABSENT | Aucun filtre de révision enregistré. |
| 30 | P_CONVEUROCPTA, P_CONVEUROIMMO, P_CONVEUROTRES, P_CONVEUROCIAL : indicateurs de bascule en euro | 61, 248, 456, 503 | DIFFÉRENT, VOULU | Sans objet : la monnaie de tenue est fixée par la loi (ligne 10). |
| 31 | P_SERVICECPTA, P_CONTACT, F_CONTACTT, F_CONTACTB, F_CONTACTD, F_CONTACTR, F_CONTACTA : contacts multiples des tiers, banques, dossiers et sections, par service et type | 61, 62, 67, 107 à 109, 131 à 133, 192 à 194, 210, 211, 214, 215 | PARTIEL | Un seul contact, en texte, sur la fiche du tiers et de la banque. |
| 32 | P_RESULTAT, F_FOURCHETTERESULTAT : comptes de résultat, fourchettes, génération de l'écran de résultat | 62, 199, 200 | DIFFÉRENT, VOULU | Les états financiers suivent les tables de correspondance officielles de chaque référentiel ; les états libres passent par les états personnalisés. |
| 33 | P_FISCAL : régime de TVA français (CA3, CA12), comptes de liquidation, télédéclaration et télépaiement, organisme de gestion agréé | 62 à 65 | DIFFÉRENT, VOULU | Formulaires français. OmegaX sert la déclaration et la liquidation de la TVA congolaise, compte par compte, sans télédéclaration. |
| 34 | P_SECURITYSTRATEGYCPTA (et IMMO, TRES, CIAL) : mot de passe de quatre caractères au moins, renouvellement tous les 90 jours, différent du nom, identique dans les fichiers liés, saisie obligatoire | 65, 66, 266, 458, 459, 503, 504 | DIFFÉRENT, À TRIER | Dix caractères au moins (`changer-mot-de-passe.dto.ts`), verrouillage par compte, double authentification. Aucun renouvellement périodique imposé : à trancher. |
| 35 | P_LITIGE, P_RESOLUTION, F_SCENARIO, F_ESCENARIO, F_DRECOUVREMENT, F_DRECOUVREMENTC, F_DRECOUVREMENTIV : scénarios et dossiers de recouvrement, litiges, résolutions, interventions, promesses de règlement | 66, 203 à 209 | ABSENT | Aucun dossier de recouvrement. Les relances par niveau existent (ligne 20). |
| 36 | P_RECOUVREMENT : journal et modèles de provision, compte de perte, compte client douteux | 67 | DIFFÉRENT, VOULU | Le module des créances douteuses reclasse au 416, déprécie au 491 selon la revue motivée du cabinet, passe la perte au 651 ; les comptes viennent du plan de chaque référentiel, non d'un paramètre (`creances-douteuses/`). |
| 37 | P_ECHANGE et tables eFacture (F_COMPTETINFOS, F_DOCENTETEINFOS, F_DOCLIGNEINFOS, F_ABOENTETEINFOS, F_ABOLIGNEINFOS, P_ECHANGECIAL) : échanges électroniques, facture électronique | 68, 270, 444 à 449 | ABSENT | Aucun échange électronique. OmegaX n'est pas un système de facturation homologué (décret n° 23/10, art. 22), et le dit. |
| 38 | P_BONAPAYER, F_BONAPAYERHISTO, F_BONAPAYERHISTOCIAL : circuit de bon à payer et son historique | 68, 217, 218, 443, 444 | ABSENT | Aucun circuit de bon à payer. |
| 39 | F_COMPTEG : comptes généraux, Détail ou Total, nature, report, sommeil, options, taxe associée, compte reporting, raccourci | 70 à 73 | PARTIEL | `Compte` : type, mode de report, actif ou en sommeil, lettrable, taux de TVA par défaut, collectif. Ni quantité, ni raccourci, ni compte reporting. |
| 40 | F_COMPTEGNOTE : bloc-notes des comptes | 73, 74 | ABSENT | Aucun bloc-notes sur un compte. |
| 41 | F_COMPTEGBUDGET, F_COMPTEGBUDGETA, F_COMPTEABUDGET, F_COMPTEABUDGETG, F_BUDGET, F_EBUDGET : budgets par compte général et par section, six dotations sur 36 mois, postes budgétaires et centralisateurs | 74 à 79, 84 à 89, 150 à 154 | PARTIEL | Budget par section analytique, annuel ou mensuel (`BudgetSection`). Ni budget par compte général, ni postes budgétaires, ni dotations faible ou forte. |
| 42 | F_COMPTEGA, F_MODELEG, F_EMODELEG : répartition analytique par défaut d'un compte, modèles de grille (pourcentage, équilibre, montant) | 79, 80, 139 à 142 | PARTIEL | Clés de répartition d'une section vers d'autres, en pourcentage ou en unités (`CleRepartition`). Pas de répartition attachée au compte général. |
| 43 | F_COMPTEA : sections et affaires, Détail ou Total, niveau d'analyse, domaine, objectifs de chiffre d'affaires, statut et dates d'affaire, mode de facturation | 81 à 84 | PARTIEL | `SectionAnalytique` : type Détail ou Total, dates, bailleur. Pas de gestion d'affaires. |
| 44 | F_COMPTER : plan reporting | 89, 90 | ABSENT | Voir manuel 2, ligne 9. |
| 45 | F_COMPTET : tiers, lettrage automatique, validation automatique des règlements, sommeil, contrôle d'encours, hors rappel, pénalités, statistiques, solvabilité, banque principale, fermeture | 91 à 98 | PARTIEL | `Tiers` : type, actif, hors relance avec motif et date, modèle de règlement, RIB principal. Ni encours, ni solvabilité, ni statistiques. |
| 46 | F_COMPTETMODELE : modèles d'impression par tiers | 99 | ABSENT | Aucun modèle d'impression propre au tiers. |
| 47 | F_COMPTETG : comptes généraux rattachés à un tiers | 99, 100 | FIDÈLE | `TiersCompte`, avec compte principal. |
| 48 | F_COMPTETMEDIA : documents rattachés aux tiers | 101 | FIDÈLE | `DocumentTiers` : la pièce est gardée en base, type lu dans les octets, au plus 5 Mo. |
| 49 | F_COMPTETRAPPEL : historique des rappels, frais d'impayés, pénalités | 102 | PARTIEL | Historique des relances, montant figé à l'émission (`Relance`). Ni frais ni pénalités. |
| 50 | F_BANQUET : banques des tiers, structure, IBAN calculé, BIC, mandat (référence, date) | 103 à 105 | PARTIEL | `RibTiers`, un principal par tiers, IBAN contrôlé. Aucun mandat de prélèvement. |
| 51 | F_REGLEMENTT, F_MODELER, F_EMODELER : modèles de règlement (jour net, fin de mois, jours de tombée, pourcentage, équilibre, montant) | 105 à 107, 142 à 145 | PARTIEL | `ModeleReglement` et `EcheanceReglement` : net ou fin de mois, pourcentage, montant ou équilibre. Pas de jours de tombée. |
| 52 | F_LIVRAISON : lieux de livraison des clients | 109 à 111 | ABSENT | |
| 53 | F_TAXE, F_ETAXE : taux en pourcentage, en montant ou en quantité, TVA sur débits ou sur encaissement, sens, provenance, assujettissement | 111 à 115 | PARTIEL | `TauxTva` en pourcentage, comptes de collecte et de déduction. L'exigibilité se règle au dossier et au tiers, non au taux. Pas de taxe en montant ou en quantité. |
| 54 | F_JOURNAUX : type, numérotation, contrepartie par ligne, saisie analytique, totaux masqués, rapprochement, sommeil, règlement définitif, suivi de trésorerie, compte de trésorerie | 115 à 117 | PARTIEL | `Journal` : cinq types, numérotation, contrepartie à chaque ligne, compte de trésorerie propre, actif. Ni saisie analytique au journal, ni totaux masqués. |
| 55 | F_JOURNAUXA : journaux analytiques | 117, 118 | PARTIEL | Un journal « OD ANA » pour les OD analytiques (`analytique/od-analytique.ts`). |
| 56 | F_BANQUE : banques, mode de remise, conditions de découvert, d'intérêts, de commissions et de frais, formats AFB ou SEPA, délais de télétransmission, comptes OPCVM | 118 à 127 | PARTIEL | `Banque` : identité et coordonnées seules. |
| 57 | F_EBANQUE : RIB de la banque, intra-groupe, journaux d'escompte et d'encaissement, bénéficiaire, devise | 127 à 131 | PARTIEL | `RibBanque`, un RIB pour au plus un journal de banque. Pas de journaux d'escompte. |
| 58 | F_EBANQUECOND, F_AUTORISATIONFINBQ : conditions bancaires par RIB, autorisations de financement | 197 à 200 | ABSENT | |
| 59 | F_PIECE, F_PIECEG, F_PIECEA : modèles de saisie, formules et macros (Saisie, Duplicata, Incrément, Équilibre, Calcul), lignes analytiques | 133 à 139 | PARTIEL | `ModeleSaisie` à fonctions Saisir, Répéter, Calculer, Équilibrer. Incrément et formules libres non repris ; pas de ventilation analytique dans le modèle. |
| 60 | F_MODELEA, F_EMODELEA : modèles d'abonnement, période en jours, semaines, mois ou années, échéances générées | 146 à 149 | PARTIEL | `ModeleAbonnement` : périodicité mensuelle, trimestrielle, semestrielle ou annuelle, échéances suivies. Ni jour ni semaine. |
| 61 | F_LIBELLE : libellés réutilisables avec raccourci | 149, 150 | FIDÈLE | `LibelleEcriture` (code et intitulé), proposé en saisie sans rien imputer. |
| 62 | F_PROTECTIONCPTA, F_EPROTECTIONCPTA (et IMMO, TRES, CIAL) : administrateur, utilisateur, invité ; compte désactivé ; commandes protégées en écriture, en lecture ou en suppression | 154 à 156, 388 à 390, 487 à 489, 519 à 521 | DIFFÉRENT, VOULU | Cinq rôles, profil de fonctions et journaux autorisés par utilisateur. La restriction porte sur ce qui écrit, jamais sur la lecture (`common/fonctions/fonctions-metier.ts`). |
| 63 | F_JMOUV : clôture d'un journal par période (partielle, totale), impression en brouillard ou en journal | 156 à 158 | PARTIEL | Clôtures partielle, totale ou de période (`Cloture`). L'état « non imprimé » n'est pas servi. |
| 64 | F_ECRITUREC : écritures, date distincte de la période, lettrage en montant et en quantité, pointage, centralisation, niveau de rappel, type d'à-nouveau, marque de révision, remise en banque, export expert, pénalités, statut de règlement | 158 à 163 | PARTIEL | `Ecriture` et `LigneEcriture` : date et date de valeur (art. 22, 4°), lettrage, pointage, statut, devise, échéance. Ni lettrage en quantité, ni marque de révision, ni export vers l'expert. |
| 65 | F_ECRITUREA : écritures analytiques avec quantité | 163, 164 | PARTIEL | `VentilationAnalytique` en montant ; pas de quantité. |
| 66 | F_CYCLEOBS, F_REGROUPOBS, F_CYCLECONS, F_ETABLEAU : révision par cycle (observations, consignes, réponses dont « non applicable » et « non significative », tableaux) | 184 à 188 | PARTIEL | Questionnaire de révision du CPCC : réponses, commentaires, exceptions (`questionnaire/`). Pas d'observations par cycle sur cinq exercices. |
| 67 | F_EEXTRAITLIB, F_EXTRAIT, F_EEXTRAIT, F_EEXTRAITEC : extraits bancaires saisis ou téléchargés, état de rapprochement, soldes, lignes avec code opération et motif de rejet, lien aux écritures | 165, 170 à 176 | PARTIEL | Relevé importé en CSV ou XLSX dans un rapprochement, lignes, propositions confirmées (`RapprochementBancaire`, `LigneReleveBancaire`). Pas de téléchargement, pas de code opération. |
| 68 | F_PAYS : pays, zone SEPA, codes ISO | 177, 178 | ABSENT | Le pays est un texte libre. |
| 69 | F_ECRITURER : OD et reports analytiques du nouvel exercice | 178 à 180 | PARTIEL | OD analytiques (`OdAnalytique`). Pas de report analytique d'un exercice sur l'autre. |
| 70 | F_FINANCIER, F_EFINANCIER, F_EFINANCIERA, F_EFINANCIEREC : saisie des financiers, règlements partiels, écarts de règlement, de change et d'escompte | 180 à 184 | PARTIEL | Règlement des tiers : une pièce par tiers, lettrage aussitôt, partiel admis, écart de change sur sa ligne (`reglements/`). Pas d'écart de règlement ni d'escompte. |
| 71 | F_ENUMLIBRECPTA, F_ENUMLIBREIMMO, F_ENUMLIBRECIAL : informations libres de type table (jusqu'à 64 par fichier) | 194, 428, 429, 481 | ABSENT | Aucune information libre. |
| 72 | F_ECRITUREF : écritures de fin d'exercice de la version portugaise | 194 à 196 | DIFFÉRENT, VOULU | Propre à la version portugaise, sans objet. |
| 73 | F_COLLABORATEUR : collaborateurs et leurs rôles (vendeur, caissier, acheteur, contrôleur, financier, chargé de recouvrement) | 201 à 203 | ABSENT | |
| 74 | F_ECRITURECMEDIA : documents rattachés aux écritures | 212 | ABSENT | Seuls les tiers et les virements de fonds portent une pièce jointe. |
| 75 | F_CALENDRIER, F_ECALENDRIER : calendriers, jours ouvrés, jours d'exception | 212 à 214 | DIFFÉRENT, VOULU | Jours fériés et jours ouvrables fixés par les textes, non paramétrés (`retenues/jour-ouvrable.ts`, `personnel/jours-du-code-du-travail.ts`). |
| 76 | F_COMPTEAMEDIA : documents des sections analytiques | 216 | ABSENT | |
| 77 | F_RECTIFICATIONMOTIF : motifs de rectification | 217 | ABSENT | |

## Gestion commerciale (p. 219 à 449)

OmegaX n'a pas de gestion commerciale au sens de Sage. Il tient des factures
comme pièces justificatives, des devis au sens de l'AUDCG, un magasin en
inventaire permanent et les consignations.

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 78 | P_DOSSIERCIAL et paramètres commerciaux : encours, contremarque, analytique, devise, numérotation, arrondis, journaux, caisse, lots, prévision, multi-dépôts, base de la marge | 219 à 226 | ABSENT | |
| 79 | P_INTSTATART, F_ENUMSTATART : statistiques des articles | 227, 270, 271 | ABSENT | |
| 80 | P_UNITE, P_CONDITIONNEMENT, F_ENUMCOND, F_CONDITION, F_TARIFCOND : unités de vente, conditionnements et leurs tarifs | 227 à 229, 274, 275, 315 à 318 | PARTIEL | Une unité de mesure par article (`ArticleStock.uniteMesure`). Pas de conditionnement. |
| 81 | P_ARRONDI : modes d'arrondi | 228 | ABSENT | |
| 82 | P_GAMME, F_ENUMGAMME, F_ARTGAMME, F_ARTENUMREF, F_TARIFGAM, F_GAMSTOCK, F_GAMSTOCKEMPL : gammes et leurs stocks | 228, 229, 272 à 274, 297 à 300, 305, 306, 310 à 313 | ABSENT | |
| 83 | P_PERIOD, P_CONDLIVR, P_EXPEDITION : périodicités, conditions de livraison, modes d'expédition et frais | 229, 236, 237 | ABSENT | |
| 84 | P_SOUCHEVENTE, P_SOUCHEACHAT, P_SOUCHEINTERNE, F_DOCCURRENTPIECE : souches de numérotation des documents et journal associé | 233, 234, 384, 385 | PARTIEL | La facture porte son numéro ; le journal est choisi à la comptabilisation de la facture (`facturation/ecriture-facture.ts`). |
| 85 | P_AGENDAS, F_AGENDADET, F_AGENDA : agenda des tiers, articles et dépôts | 235, 271, 272, 325 à 327 | ABSENT | |
| 86 | P_CATTARIF, F_FAMTARIF, F_FAMCLIENT, F_FAMTARIFQTE, F_ARTCLIENT, F_TARIFQTE, F_TARIF, F_TARIFSELECT, F_TARIFREMISE : catégories tarifaires, tarifs, remises, barèmes, soldes et promotions | 235, 283 à 287, 302 à 308, 332 à 338 | ABSENT | |
| 87 | P_CATCOMPTA, F_FAMCOMPTA, F_ARTCOMPTA : catégories comptables et passerelles comptables des familles et des articles | 235, 236, 287 à 289, 319 à 321 | PARTIEL | Un article de magasin porte son compte de stock (`ArticleStock.compteId`) ; le compte de produit ou de charge d'une facture est choisi à sa comptabilisation. |
| 88 | P_PREFERENCES : alertes d'agenda, remises, poids, codes EAN, stock négatif, création à la volée, caisse de comptoir, facture électronique | 237 à 241 | ABSENT | Seule règle voisine : le magasin ne descend jamais sous zéro (ligne 101). |
| 89 | P_RESILIATION, F_ABONNEMENT, F_ABOPERIODE, F_ABOENTETE, F_ABOLIGNE, F_ABOREGLEMENT : abonnements commerciaux générant des pièces | 241, 391 à 406 | ABSENT | Les abonnements d'OmegaX sont des écritures récurrentes (ligne 60). |
| 90 | P_COMPTOIR, P_SCDREGLEMENT, P_SCDCLAVIER, F_CAISSE, F_AFFICHEUR, F_AFFICHEURCAISSE, F_CLAVIER, F_CAISSECAISSIER, F_TICKETARCHIVE, F_LIGNEARCHIVE, F_REGLEARCHIVE, F_BILLETPIECE : caisse de comptoir, tickets, billets et pièces | 249 à 252, 409 à 419, 430 | ABSENT | La seule ventilation par coupure est celle du procès-verbal de comptage de caisse (`CoupureComptee`). |
| 91 | P_COMMUNICATION, F_COMMPLANIFIE : site marchand, transferts planifiés entre sites | 252, 253, 420 à 422 | ABSENT | |
| 92 | P_PARAMETRELIVR : préparation des livraisons | 253, 254 | ABSENT | |
| 93 | P_INTERNE : documents internes avec mouvement de stock | 254, 255 | ABSENT | Les mouvements du magasin se saisissent un à un (ligne 101). |
| 94 | P_GENAUTO : génération automatique des références et des codes-barres | 262 à 266 | ABSENT | |
| 95 | P_PROJETFAB, P_PROJETAFF, P_FACTUREAFF, F_PROJETFABRICATION, F_PROJETLIGNE, F_PROJETPLANNING, F_PROJETHISTO, F_RESSOURCEPROD, F_ARTCOMPO, F_RESSCENTRE, F_ARTICLERESSOURCE, F_PREVISION, F_NOMENCLAT : fabrication, affaires, ressources, nomenclatures | 267 à 270, 313 à 315, 423 à 441 | ABSENT | |
| 96 | F_FAMILLE, F_FAMFOURNISS, F_FAMMODELE : familles d'articles, suivi de stock (sérialisé, CMUP, FIFO, LIFO, par lot) | 276 à 290 | PARTIEL | Pas de famille d'articles. La méthode se choisit par article parmi celles que le texte admet (P.E.P.S., C.M.P.A.C.E. ; la période de stockage est nommée mais non calculée) ; le CMUP annuel et le LIFO sont exclus (AUDCIF, Titre VI, « Valorisation des biens fongibles »). |
| 97 | F_ARTICLE : articles, suivi de stock, nomenclature, prix TTC, sommeil, tarif daté, coût standard | 290 à 297 | PARTIEL | `ArticleStock` : code, désignation, unité, méthode de valorisation, compte, actif. |
| 98 | F_ARTFOURNISS, F_ARTPRIX : fournisseurs d'un article, dernier prix d'achat | 300 à 302, 322 | ABSENT | |
| 99 | F_ARTGLOSS, F_GLOSSAIRE, F_DOCLIGNETEXT, F_DOCENTETETEXT : glossaires et textes complémentaires | 318, 319, 324, 325, 441 à 443 | ABSENT | |
| 100 | F_ARTMODELE, F_ARTICLEMEDIA, F_CATALOGUE, F_REPCOM, F_CMLIEN, F_MODELE : modèles et médias d'articles, catalogue, commissions des représentants, contremarque, modèles de calcul | 321 à 323, 338, 339, 407, 408, 432, 433 | ABSENT | |
| 101 | F_ARTSTOCK, F_ARTSTOCKEMPL, F_DEPOT, F_DEPOTCONTACT, F_DEPOTEMPL : stocks par dépôt et emplacement, minimum, maximum, réservé, commandé | 308 à 310, 328 à 332 | PARTIEL | Un magasin unique en inventaire permanent : la quantité et la valeur se lisent sur les mouvements, jamais sous zéro (`MouvementStock`). Ni dépôts, ni seuils. |
| 102 | F_DOCENTETE : documents de vente, d'achat, de stock et internes, statuts, frais, taxes, escompte | 339 à 354 | PARTIEL | `Facture` (vente ou achat, facture ou note de crédit, liée à son écriture) et `Devis`. Ni commande, ni bon de livraison, ni document de stock. |
| 103 | F_DOCLIGNE : lignes de documents, remises, taxes, mouvement de stock, séries et lots, conditionnement, dépôt | 355 à 374 | PARTIEL | `LigneFacture` et `LigneDevis` : désignation, quantité, prix unitaire, montant hors taxe, taxe. Pas de remise ni de mouvement de stock. |
| 104 | F_DOCREGL, F_CREGLEMENT, F_REGLECH : acomptes et échéances des documents, règlements, liens aux échéances | 374 à 383 | PARTIEL | Les règlements se tiennent en comptabilité et se lettrent avec la facture (`reglements/`) ; aucun échéancier n'est porté par la facture. |
| 105 | F_LOTSERIE, F_LOTFIFO : lots, numéros de série, couches FIFO ou LIFO | 385 à 388 | PARTIEL | Les couches du P.E.P.S. sont recalculées sur les mouvements. Ni lots ni numéros de série. |
| 106 | F_LIENRECTIF : facture rectifiée et rectificative | 431 | FIDÈLE | La note de crédit pointe la facture qu'elle annule et remplace (`Facture.factureAnnuleeId`). |

## Immobilisations (p. 450 à 494)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 107 | P_DOSSIERIMMO, P_NATUREBIEN, P_NATUREFISC : natures de biens, natures fiscales (taxes professionnelle et foncière, véhicules de tourisme) | 450 à 452 | PARTIEL | Nature fiscale du barème de l'arrêté n° 013/2025 (`natureFiscaleCle`). Taxes françaises sans objet. |
| 108 | P_NATUREACQ : natures d'acquisition | 453 | DIFFÉRENT, VOULU | Non reprise. La contrepartie de l'acquisition se choisit dans une liste fermée tirée des fiches 21 à 24 (`immobilisations/contrepartie-acquisition.ts`). |
| 109 | P_NATURESORTIE : natures de sortie, reprise exceptionnelle, renouvellement d'un composant | 453 | FIDÈLE | Liste fermée des natures de sortie avec leur pièce (`nature-sortie.ts`) ; renouvellement d'un composant par `renouveler`. |
| 110 | P_REGLAGES : base du prorata (360 jours ou jours réels), comptes par défaut, exercices, journaux | 454, 455 | DIFFÉRENT, VOULU | Le prorata se compte en mois (`common/mois-entre.ts`) ; les comptes viennent de la famille. Voir M4. |
| 111 | P_STATIMMO, F_ENUMSTATIMMO : champs statistiques des biens | 455, 489, 490 | ABSENT | |
| 112 | P_CATEGORIETP, F_ENUMSTATTP : catégories de taxe professionnelle | 455, 456, 490, 491 | DIFFÉRENT, VOULU | Impôt français, sans objet. |
| 113 | P_PREFERENCESIMMO : virement de poste à poste, passage du dégressif au linéaire, dotations antérieures cumulées, dotations de cession, report des arrondis, clôture des antérieurs, dotations mensuelles, regroupement des écritures | 456, 457 | PARTIEL | Bascule du dégressif au linéaire (loi n° 23/053, art. 35), dotation arrêtée à la sortie, reclassement et mise en service. Ni dotation mensuelle, ni regroupement des écritures. Voir M4. |
| 114 | P_PARAMETREIMMO : champ analytique, imposition, reprise dérogatoire, plafonnement des locations, date de sortie par mode, IFRS | 458 | PARTIEL | Dérogatoire et sa reprise au SYSCOHADA. Pas d'analytique sur les biens, pas de plan IFRS natif. |
| 115 | F_FAMILLEIMMO, F_FAMAMORT, F_FAMANAL : familles (Détail ou Total), comptes par défaut, modes linéaire, dégressif normal, minoré ou majoré, exceptionnel, manuel, départ, prorata, plafond, plancher, analytique | 459 à 465 | PARTIEL | `FamilleImmobilisation` : comptes, durée, mode. Ni familles totalisatrices, ni analytique. |
| 116 | F_IMMOBILISATION : fiche, neuf ou occasion, état, cession partielle, crédit-bail ou location, bases par régime, composants, numéros de série, contrats, véhicules, quantité restante | 465 à 472 | PARTIEL | `Immobilisation`, avec composants, location acquisition, unités d'œuvre, réserve de propriété. Ni quantité, ni cession partielle, ni plan IFRS natif. Voir M4. |
| 117 | F_IMMOAMORT, F_DOTATION : taux et dotations par type (économique, fiscal, IFRS) et par état (révision, cession, rebut, manuel, antérieur, calculé, clôturé, inventaire, reprise dérogatoire, réévaluation, simulation) | 472, 473, 483 à 485 | PARTIEL | Dotations, dérogatoire, révision du plan, réévaluation, chacun dans sa table. Pas de simulation ni de dotation manuelle. |
| 118 | F_IMMONOTE, F_IMMOBILISATIONMEDIA : bloc-notes et fichiers attachés aux biens | 473, 474, 481, 482 | ABSENT | |
| 119 | F_IMMOANAL : ventilation analytique d'un compte d'immobilisation | 474 à 476 | ABSENT | |
| 120 | F_IMMOHISTO : historique des traitements (reprise anticipée, fractionnement, révision du plan, virement de poste à poste, inventaire, réévaluation, limitation du dérogatoire, fusion) | 476 à 478 | PARTIEL | Chaque acte a sa table et passe au journal d'audit. Ni fractionnement ni fusion de biens. |
| 121 | F_LIEU, F_LIEUCONTACT : lieux des biens, lieu principal, contacts | 478 à 481 | PARTIEL | `LieuBien` : code et intitulé. |
| 122 | F_REGLAGE, F_IMMOEXERCICE : exercices et leur clôture | 482, 483, 616 | FIDÈLE | Les exercices du dossier, communs à la comptabilité. |
| 123 | F_CESSION : nature, règle de TVA d'un immeuble, plus-values à court et long terme, TVA reversée, valeur nette, clôture | 485 à 487 | PARTIEL | Sortie avec sa nature, son prix et sa pièce ; valeur nette au 81. Le régime des plus-values est français, sans objet. |
| 124 | F_LOYER : loyers de crédit-bail ou de location | 491, 492 | PARTIEL | Contrats de location acquisition au SYSCOHADA (`ContratLocationAcquisition`). Voir M4. |
| 125 | F_VIREMENTPOSTE : virements de poste à poste | 492, 493 | FIDÈLE | `ReclassementImmobilisation` (ancien et nouveau compte) ; la mise en service est reconnue comme virement par sa liaison. |
| 126 | F_COEFFICIENT : coefficients du dégressif datés (normal, minoré, majoré) | 493 | DIFFÉRENT, VOULU | Coefficients fixés par la loi n° 23/053, art. 33, non paramétrables (`amortissement-degressif.ts`). |
| 127 | F_IMMOSERIE : numéros de série | 494 | ABSENT | |

## Moyens de paiement et trésorerie (p. 495 à 557)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 128 | P_TDOSSIER : référence d'incorporation, date des effets, exécution, escompte, type d'effet, remises brûlantes, émetteur, écarts | 495 à 497 | ABSENT | Ni effets ni remises. Voir M5. |
| 129 | P_DOSSIERFTRS : délais, TVA des frais bancaires, affectation du RIB, comptes OPCVM, financements, placements | 498, 499 | ABSENT | |
| 130 | P_TSCHEMAS : schémas comptables par étape de remise | 499 à 502 | DIFFÉRENT, À TRIER | Les pièces naissent avec le règlement ou l'ordre de virement, sans étapes. Même point que M5, ligne 19. |
| 131 | F_TREMISES, F_MONTANTS, F_ENTETES, F_ECHEANCES, F_LECRITURES : remises et échéances par mode (chèques, espèces, cartes, prélèvements, LCR-BOR, virements), étapes, périodicité | 504 à 517 | PARTIEL | Ordres de virement fournisseurs nés avec leurs pièces (`OrdreVirement`). Ni chèques remis, ni prélèvements, ni effets. |
| 132 | F_HISTOTRANS, F_LHISTOTRANS, F_RELEVELCR, F_LRELEVELCR, F_MOTIFECO, F_REJETSEPA : transmissions bancaires, relevés de LCR, motifs économiques, rejets SEPA | 517, 518, 521 à 526, 533 | ABSENT | Aucune communication bancaire. Voir M5. |
| 133 | F_REGTAXEMDP : registre des taxes des moyens de paiement | 526, 527 | PARTIEL | Pas de registre des remises ; la taxe à l'encaissement est lue par la déclaration de TVA sur les règlements lettrés. |
| 134 | F_LOTS, F_ELOTS : lots de remise | 527 à 530 | PARTIEL | Lots de virements récurrents qui présélectionnent, sans payer (`reglements/lots-virement.ts`). |
| 135 | F_ECARTREGLEMENT, F_ESCOMPTES : écarts de règlement et escompte | 530 à 533 | ABSENT | |
| 136 | F_UNION, F_EUNION : unions de comptes bancaires | 534, 535 | ABSENT | |
| 137 | F_TAUXREFERENCE, F_HISTOTAUXREFERENCE, F_NATFINANCEMENT, F_NATPLACEMENT, F_OPFINANCEMENT, F_OPPLACEMENT : taux de référence, financements et placements | 536 à 539, 551 à 555 | ABSENT | Les intérêts courus d'un emprunt se déclarent en charge à payer, sans taux (`interets-courus.ts`). |
| 138 | F_REGROUPEMENT, F_EREGROUPEMENT, F_PREVTRESO, F_MODELEAT, F_EMODELEAT : regroupements, prévisions de trésorerie, abonnements de trésorerie | 540 à 543, 549 à 551 | PARTIEL | Échéancier des tiers seulement ; pas de prévision de trésorerie. |
| 139 | F_OPCVM, F_HISTOOPCVM, F_OPCVMEBANQUE, F_TRANSACTIONOPCVM, F_HISTOVENTEOPCVM : OPCVM, valeurs liquidatives, transactions | 544 à 548 | ABSENT | |
| 140 | F_EXTRAITMCF, F_EEXTRAITMCF : extraits reçus au format MCF | 555 à 557 | PARTIEL | Relevé importé en CSV ou XLSX (ligne 67) ; pas de format bancaire. |

## Paie Maestria (p. 558 à 600)

Le détail des écrans de paie est au manuel 7. Ici, la structure seule.

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 141 | P_CATCOMPTA de la paie et comptes de la rubrique par catégorie comptable | 558, 562 à 565 | DIFFÉRENT, VOULU | Les comptes de la paie sont fixés par référentiel, compte par compte (`personnel/passation-paie.ts`). |
| 142 | P_SEQUENCE : séquences de saisie | 558, 559 | ABSENT | |
| 143 | F_ORGANISME : organismes, périodicité, dates d'exigibilité, de dépôt et de règlement | 559 à 561 | DIFFÉRENT, VOULU | Registre et échéancier des retenues (CNSS, IRPP, INPP par trimestre, ONEM), dates tirées des textes et non paramétrées (`retenues/`). |
| 144 | F_TABLE, F_TABLELT : tables de paie à double entrée | 561, 562 | DIFFÉRENT, VOULU | Barèmes codés d'après les textes, et versions datées saisies par le cabinet avec leur référence (`VersionBaremePaie`). |
| 145 | F_RUBRIQUE, F_RUBRIQUEC : rubriques (qualité, nature, formule, assiette, plafond, plancher, tranches, cumuls, impression) | 562 à 567 | DIFFÉRENT, VOULU | La rubrique nomme, la nature décide les assiettes et le compte ; aucune formule libre (`personnel/rubriques-paie.ts`). |
| 146 | F_PROFIL, F_PROFILELT, F_SALPROFIL : profils de paie | 567, 598, 599 | FIDÈLE | Bulletins modèles (`ModeleBulletin`). |
| 147 | F_DUCS, F_RUBDUCS : rubriques de la DUCS | 568, 569 | DIFFÉRENT, VOULU | Déclaration française, sans objet. |
| 148 | P_SDOSSIER : premier mois des congés, période et date de paie, agenda, import, vérification des RIB, compte du net à payer, rubrique d'acompte | 569 à 571 | PARTIEL | Mois de paie et date de mise à disposition au bulletin ; le net va au 422. Ni agenda ni période de congés. |
| 149 | P_SANALYTIQUE, F_POINTAGE, F_POINTHIST : analytique de la paie et pointages | 572, 595, 598 | ABSENT | La paie se passe sans ventilation analytique. |
| 150 | P_SSTATISTIQUE, F_SENUMSTAT, P_INFO, F_ENUMINFO : statistiques et informations libres des salariés | 572 à 574, 581 | ABSENT | |
| 151 | P_SREGLEMENT, F_REGLEMENTS, F_BANQUES : modes de règlement du salarié, banques, répartition entre acompte et solde | 573, 587 à 589 | ABSENT | La fiche du salarié n'a pas de banque. |
| 152 | P_CONVENTION : conventions collectives | 573, 574 | ABSENT | La convention est hors corpus ; la catégorie du contrat reste libre, à côté de la classe du décret n° 25/22. |
| 153 | P_DEPARTEMENT, P_CATSALARIE : départements et catégories de salariés | 574, 575 | PARTIEL | Catégorie libre et classe de 1 à 17 sur le contrat. Pas de département. |
| 154 | P_SNO : dernier numéro de bulletin | 574 | FIDÈLE | Numérotation continue par dossier, annulés compris (`BulletinPaie.numero`). |
| 155 | F_ETABLISSEMENT, F_ETORGANISME, F_RISQUE : établissements, affiliations, tarification des accidents du travail | 575 à 578 | PARTIEL | Numéro d'affiliation CNSS de l'employeur sur le dossier ; risques professionnels au taux du décret n° 18/041, doublé seulement sur décision déclarée. Pas d'établissements. |
| 156 | F_SBANQUE, F_SEBANQUE : banques de l'entreprise pour la paie, journal lié | 578 à 580 | PARTIEL | RIB des banques rattachés aux journaux, sans usage propre à la paie. |
| 157 | F_CONTRAT : contrats (durée, essai, préavis, renouvellement, hors effectif) | 580, 581 | FIDÈLE | `ContratTravail`, les quinze énonciations de l'art. 212 du Code du travail, requalifications rendues. |
| 158 | F_AGENDAG, F_AGENDAD, F_AGENDA : événements (contrat, accident du travail, handicap, variables) avec pré-alerte | 582, 591 à 593 | ABSENT | |
| 159 | F_SALARIE : salariés, situation familiale, nationalité, catégorie, régime, avantages en nature, frais professionnels, carte de séjour, début et fin de paie | 583 à 587 | PARTIEL | `Salarie` : identité, sexe, CNSS, naissance, nationalité, conjoint, aptitude, engagement et départ. Les avantages en nature se saisissent au bulletin. |
| 160 | F_ESACHARGE : personnes à charge, foyer fiscal, part | 588 | PARTIEL | Enfants à charge ; les personnes à charge de l'art. 124 sont proposées, jamais substituées. |
| 161 | F_ADRESSES : adresses du salarié | 590 | ABSENT | |
| 162 | F_VARIABLE : variables du salarié par rubrique | 593, 594 | PARTIEL | Éléments saisis au bulletin, pré-remplis par un bulletin modèle. |
| 163 | F_BULLETIN, F_HISTORIQUE : bulletins et lignes (bases, taux, parts ouvrière et patronale, mise à jour comptable, clôture) | 596 à 598 | FIDÈLE | `BulletinPaie` fige le calcul rejoué par le serveur et pointe l'écriture de la paie du mois. |
| 164 | F_REGLACOMPTE, F_REGLBULLETIN : acomptes et règlement du net | 599, 600 | PARTIEL | Avances et prêts retenus aux bulletins (`AvanceSalaire`). Le paiement du net n'est pas suivi. |

## Manager (p. 601 à 624)

Manager est le gestionnaire de dossiers du cabinet.

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 165 | P_CDOSSIER, P_NIVEAU, F_ENUMNIVEAU, F_LIENNIVEAU, F_UTILISATEUR : organisation du cabinet en niveaux, collaborateurs rattachés | 601, 602, 605, 614, 615 | ABSENT | Un dossier OmegaX est une entité ; seul l'éditeur voit la liste des cabinets, sans leurs données. |
| 166 | F_DOSSIER, F_DOSCONTACT, F_LDOSSIER : dossier client (mission, régime d'imposition et de TVA, arrêt d'activité, redressement, liquidation, groupe, forme juridique, exercices, registres, capital, contacts) | 607 à 614, 619 | PARTIEL | Les faits du dossier sont sur `Tenant` (forme juridique, TVA, dissolution, liquidation, groupe, capital, RCCM) et `Exercice`. Ni mission, ni motifs d'entrée et de sortie, ni liste de contacts. |
| 167 | P_CCONVENTION, P_JURIDIQUE, P_MISSION, P_MOTIFENTREE, P_MOTIFSORTIE, P_SERVICE, P_CPREFERENCE : listes du cabinet | 603, 604 | PARTIEL | Les formes juridiques sont celles des textes, non une liste libre. Pas de missions ni de motifs. |
| 168 | F_FICH, F_LFICH, F_MODELE, F_EMODELE : fichiers rattachés aux dossiers, modèles de création de base | 606, 607, 616 à 618 | DIFFÉRENT, VOULU | Un dossier naît avec le plan, les journaux et les taux de son référentiel ; aucun fichier n'est manipulé. |
| 169 | F_CPAYS : pays de Manager | 615 | ABSENT | Voir ligne 68. |
| 170 | F_LUCEIMPORT, F_LUCETRAIT, F_LUCECOMPTEG, F_LUCECOMPTEA, F_LUCEECRITURE, F_LUCEDOSSIER, F_LUCELIBELLE : anomalies et rejets de l'import Luce | 619 à 624 | PARTIEL | L'import du plan, d'une balance ou d'écritures refuse ligne à ligne en nommant le motif. Pas de format Luce. |

## Jointures (p. 625 à 684)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 171 | Salarié lié à un compte général et à un compte de tiers (lien entre paie et comptabilité) | 629 à 684 | ABSENT | Le salarié n'a pas de compte individuel ; le net de la paie va au 422 global. |
| 172 | Écriture liée au tiers, aux registres, au dossier de recouvrement, aux documents, au bon à payer ; budget croisé compte par section ; poste budgétaire lié à une section | 629 à 684 | PARTIEL | L'écriture se lie au tiers par le compte, à ses lettrages, à son rapprochement et aux modules qui la retiennent (`detenteurs-ecriture.ts`). Le reste est absent (lignes 35, 38, 41, 74). |

## Bilan du manuel

172 fonctions relevées : 16 FIDÈLE, 24 DIFFÉRENT VOULU, 2 DIFFÉRENT À TRIER,
69 PARTIEL, 61 ABSENT, 0 NON VÉRIFIÉ.

Ce manuel donne la mesure de Sage 100 : six bases et plus de trois cents
tables. OmegaX couvre surtout la comptabilité, l'analytique, les
immobilisations et la paie, avec des règles tirées des textes là où Sage
laisse un paramètre. Les absences les plus lourdes sont celles de la gestion
commerciale (tarifs, gammes, dépôts, commandes et livraisons, caisse), du
recouvrement, de la trésorerie prévisionnelle et des échanges bancaires.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et tranche les deux DIFFÉRENT À TRIER (lignes 34
  et 130).
