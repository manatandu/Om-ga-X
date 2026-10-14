# Sage Paie · fonction par fonction, sur cinq documents

Manuel 7 de la comparaison complète demandée par Manasse le 2026-10-09.
Cinq documents Sage Paie se recouvrent largement. Ils sont comparés dans un
seul tableau, une ligne par fonction, avec la page de chaque document qui la
décrit.

| Code | Document | Ce qui a été lu |
|---|---|---|
| V8 | « Manuel de procédure Sage Paie i7 V8 », ATS, janvier 2017, 29 pages (Drive, id 1who2zfFw3UZX0NzqJqxsbqIJCY8XW1Zj) | En entier. Pages imprimées, celles du sommaire. |
| CI | « Sage Paie et RH », support de Daniel Gnopo, Côte d'Ivoire, 86 pages (Drive, id 1GNPizoUiWzyHVLXoKF3-m8hmx5G_ZU37) | En entier. Pages imprimées. |
| PÉD | « Sage Paie, manuel pédagogique », Paie Pack et Pack +, versions 15 et 16, Sage, 2006 et 2009, 214 pages (Drive, id 1OB9R2rNKxys-M_WotbkHmuYuJ1_34DG8) | En entier. |
| RÉF | « Sage Paie », manuel de référence, version 20.00, Sage, 2011 (Drive, id 1GLYmLp_w6T0Tdc4VxdyhSIQ4aB5VdIFx, 16,5 Mo) | Le sommaire en entier ; le corps jusqu'à la page 81 seulement (ergonomie, initialisation, paramètres de paie). Le reste est comparé sur le titre du sommaire, avec sa page. |
| LIV | « Livre de gestion complète de la paie sur Sage i7 », édité à Abidjan (Drive, id 1oUpNxduq_PPnaIOfLpEefUQnbrMU_6Ks, 14,4 Mo) | Les pages 1 à 78 seulement : création du dossier, constantes, barèmes, rubriques. Les chapitres sur la fiche du personnel, le bulletin, les états, la clôture et la passation n'ont pas été atteints. |

Les deux plus gros fichiers dépassent la limite de téléchargement (10 Mo) :
leur texte vient de l'outil de lecture de Drive, qui s'arrête en cours de
route. Pour les lire en entier, il faut les découper en morceaux de moins
de 10 Mo.

Les captures d'écran de V8, CI et PÉD ont été lues ensuite en image, le
14 octobre : 27 pages de V8, 81 de CI et 155 de PÉD, toutes celles qui en
portent. Elles confirment les lignes ci-dessus, en précisent quatre (28, 58,
59 et 61) et en ajoutent quatre (section « Vu sur les captures seulement »).
Aucun nom, matricule ni numéro de personne n'en a été repris. Plusieurs
captures sont en partie illisibles (pages du PDF : V8 5 à 7, 13, 16, 20, 21,
23 à 25 ; CI 4, 11 ; PÉD 58, 125, 128, 137) ; rien n'est tiré de ce qui ne
s'y lit pas. Dans les tableaux, les pages de V8 et de CI restent les pages
imprimées, qui suivent d'une unité celles du PDF. Les
captures de RÉF et de LIV n'ont pas été lues : comme leur texte, elles
demandent le PDF entier, que le connecteur Drive ne livre pas.

Trois documents sont français (PÉD, RÉF) ou ivoiriens (CI, LIV), un est de
2017 sans pays dit (V8, qui cite la CNSS et l'IPTS). Leurs taux, barèmes et
déclarations (CSG, DUCS, DADS-U, IGR, contribution nationale) ne sont pas
ceux de la RDC et ne sont repris nulle part : seule la fonction est
comparée. OmegaX calcule la paie d'après les textes congolais lus, dans le
module Personnel (`src/modules/personnel/`), et ne laisse pas le cabinet
écrire ses propres formules.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M6 » renvoie au manuel Structure des fichiers, dont les tables de paie
(lignes 141 à 164) sont la base de ce logiciel. Les statuts ont été lus
dans le code le même jour, sur la branche `travail/virement-fonds`, et
aucune ligne n'est restée non vérifiée.

## Dossier et paramètres

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Créer une société de paie : à partir du plan de paie Sage, d'un plan utilisateur, d'une société existante, ou vierge | PÉD 33 à 35 ; RÉF 67 à 69 ; CI 4 ; LIV 5 | DIFFÉRENT, VOULU | La paie est un module du dossier comptable, activable par dossier (`tenant/modules-optionnels.ts`) ; aucun fichier de paie à part. |
| 2 | Début d'année, mois en cours, année en cours, date du jour | PÉD 36 ; RÉF 70, 71 ; CI 5 ; LIV 6 | DIFFÉRENT, VOULU | Chaque bulletin porte son mois (`BulletinPaie.moisDePaie`) ; il n'y a pas de mois courant à ouvrir. |
| 3 | Régularisation des bases de cotisations, systématique ou en fin d'année | RÉF 71, 72 | DIFFÉRENT, VOULU | Le mois est annualisé pour le barème de l'art. 118 de la loi n° 23/053 ; la retenue mensuelle de l'art. 119 est un acompte (art. 116 et 121). Aucune régularisation progressive des bases. |
| 4 | Plafond des abattements, rapports des tranches B et C | PÉD 36, 194, 195 ; RÉF 72, 73 ; LIV 6 | DIFFÉRENT, VOULU | Notions françaises. La CNSS n'a pas de plafond d'assiette mais un plancher au SMIG (décret n° 18/041, art. 8). |
| 5 | Format et longueur des codes, nombre de décimales, format des comptes pour la passation | PÉD 38, 39 ; RÉF 79 à 81 ; CI 6 | DIFFÉRENT, VOULU | Montants au centime ; comptes de paie fixés par référentiel (ligne 61). |
| 6 | Types de bulletins (seize formats, préimprimés, personnalisé), double affichage en euros | PÉD 37, 40, 83 ; RÉF 75 à 77, 160 à 167 ; LIV 6 | PARTIEL | Un seul modèle de bulletin, imprimé par le navigateur ; un salaire stipulé en dollars y figure avec le cours retenu. |
| 7 | Duplicatas des bulletins à l'édition, purge des duplicatas | RÉF 78, 768 à 770 ; LIV 6 | FIDÈLE | Le bulletin émis est conservé tel qu'il a été figé, numéroté sans trou, et se réimprime ; il ne se purge pas. |
| 8 | Mois d'embauche dans l'ancienneté, impression de l'en-tête | PÉD 204 ; RÉF 78 ; LIV 6 | PARTIEL | L'en-tête reprend l'identité du dossier. L'ancienneté est déclarée au décompte final, non calculée. |
| 9 | Modes de paiement de la société, affectés à chaque salarié | PÉD 37 ; RÉF 78 ; V8 6 | ABSENT | La fiche du salarié n'a ni mode de paiement ni banque (M6, ligne 151). |
| 10 | Heures effectivement travaillées, compteurs libres, report d'un élément après clôture | PÉD 41, 43, 77 | ABSENT | |
| 11 | Paramètres et fiche signalétique de la société, en-tête du dossier, assistant de société, émetteurs des déclarations | PÉD 44, 45 ; RÉF 93 à 101, 123, 124 ; LIV 10, 11 | PARTIEL | Identité du dossier, numéro d'affiliation CNSS de l'employeur, nature de l'employeur pour l'INPP. Pas d'assistant ni d'émetteur désigné. |
| 12 | Utilisateurs et droits d'accès, mot de passe de la société, code de confidentialité | RÉF 139 à 146 | FIDÈLE | Rôle de gestionnaire de paie, cantonné au personnel et à son propre compte (CLAUDE.md, § 8). |
| 13 | Alertes et instantanés : absences, ancienneté, entretiens, entrées, fins de CDD, fins d'essai, relances, reliquats de congés, sorties, visites médicales | RÉF 17 à 21, 149 à 155, 358 | ABSENT | Le contrat est jugé (essai, durée, requalification) quand on le consulte ; aucune alerte datée n'est posée. |
| 14 | Ergonomie : barre verticale, menus, listes, tri, sélections, impression en PDF ou vers Excel | RÉF 14 à 55 ; PÉD 9 à 15 | DIFFÉRENT, VOULU | Même fenêtre principale que la comptabilité, sur le modèle de Sage i7 et de Sage Active (CLAUDE.md, § 9 ter). |
| 15 | Calculette avec conversion entre deux devises et formules | RÉF 55 à 63 | PARTIEL | Calculette sans conversion de devises (`components/Calculette.tsx`). |
| 16 | Option réseau : commandes réservées à un seul utilisateur, accès uniques | RÉF 64 à 66 | DIFFÉRENT, VOULU | Application web à plusieurs utilisateurs ; les gestes qui ne doivent pas se croiser passent sous un verrou par dossier (émission du décompte final, par exemple). |
| 17 | Importer des fiches de personnel, des valeurs de base et des rubriques, une DADS-U | RÉF 37, 100, 108, 120, 308, 609 | ABSENT | |
| 18 | Purge des historiques, génération des cumuls, vérification, réinitialisation, reprise des données | RÉF 115 à 122 | ABSENT | |
| 19 | Gestion multi-sociétés : transfert du plan de paie, traitements groupés | RÉF 155, 168, 193 ; PÉD 187, 188 ; CI 10 | ABSENT | Chaque dossier tient sa paie. |

## Organisation et listes

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 20 | Établissements : principal, paramètres de déclaration, banques, taux d'accident du travail | PÉD 48 à 50 ; RÉF 469 à 484 ; CI 12 | PARTIEL | Voir M6, ligne 155. |
| 21 | Organisations : départements, services, unités, catégories | PÉD 46, 47 ; RÉF 464 à 466 ; CI 14 ; V8 8 | PARTIEL | Catégorie libre et classe de 1 à 17 du décret n° 25/22 sur le contrat ; ni département, ni service. |
| 22 | Conventions collectives | PÉD 47 ; RÉF 484 à 486 ; LIV 12, 13 | ABSENT | La convention est hors corpus. |
| 23 | Caisses de cotisations, regroupant les rubriques et portant les codes de déclaration | PÉD 47, 48 ; RÉF 486 à 509 ; CI 15, 16 ; LIV 13 à 15 | DIFFÉRENT, VOULU | CNSS, INPP, ONEM et impôt sur le revenu sont fixés par les textes, avec leurs échéances (`retenues/`). |
| 24 | Contrats sociaux (prévoyance, mutuelle) | RÉF 510 à 514 | ABSENT | |
| 25 | Tables : natures de contrat, types d'entrée, motifs d'absence et de départ, emplois, classification, nationalités, pays, fonctions, billetage | RÉF 544 à 560 | PARTIEL | Types de contrat, motif de fin, nationalité et classe sur le registre. Les codes français sont sans objet. |
| 26 | Questionnaire (questions sur la société et le salarié) | PÉD 44, 62 à 64 ; RÉF 460 à 463 | ABSENT | |

## Fiche du personnel

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 27 | État civil et immatriculation | V8 6 ; PÉD 51, 52 ; RÉF 232 à 293 ; CI 54 à 62 | FIDÈLE | `Salarie` : nom, postnom, prénoms, sexe, naissance, nationalité, numéro CNSS, conjoint, selon l'art. 212 du Code du travail. |
| 28 | Coordonnées : adresses, banques, mode de paiement | V8 6 ; PÉD 52, 53 | ABSENT | Les captures (V8 p. 6 ; CI p. 58 ; PÉD p. 53, 125) montrent deux banques par salarié, la répartition du net entre elles, la banque payeuse de l'établissement et le mode de paiement (virement, chèque, espèces). La fiche `Salarie` n'a ni banque ni mode de paiement. |
| 29 | Contrat, entrée, sortie, ancienneté calculée | V8 7 ; PÉD 53 à 55 | PARTIEL | Contrat aux quinze énonciations de l'art. 212, avec ses requalifications (`ContratTravail`). L'ancienneté n'est pas calculée. |
| 30 | Poste : emploi, statut, classification | V8 8 ; PÉD 53 à 55 | PARTIEL | Nature du travail, catégorie et classe sur le contrat. |
| 31 | Page Paie : bulletin modèle, salaire de base, horaire | V8 9 ; PÉD 55 à 57 | PARTIEL | Rémunération de base, périodicité et monnaie sur le contrat ; le bulletin modèle se choisit au bulletin. Pas d'horaire. |
| 32 | Congés acquis avant la reprise, puis alimentés chaque mois | V8 10 ; PÉD 190 à 192 | ABSENT | Le congé n'est calculé qu'au décompte final (ligne 47). |
| 33 | Administratif : personne à prévenir, santé au travail, accident du travail | V8 11 ; PÉD 59, 60 | PARTIEL | Aptitude constatée (date, auteur, caractère provisoire), engagement et départ déclarés. |
| 34 | Compétences, formation, DIF, passeport formation, carrières | V8 11 ; PÉD 61, 62, 107 ; RÉF 156, 780 à 785 | ABSENT | |
| 35 | Personnes à charge et nombre de parts fiscales | LIV 42 à 53 ; PÉD 194 | FIDÈLE | Enfants à charge ; les personnes à charge de l'art. 124 de la loi n° 23/053 sont proposées, jamais substituées. Les parts ivoiriennes sont sans objet. |
| 36 | Historiques administratifs (adresse, situation, contrat, salaire) | PÉD 97, 98 ; RÉF 73, 293 | PARTIEL | Salariés, contrats, bulletins et avances passent au journal d'audit. |
| 37 | Documents et pièces jointes de la fiche | RÉF 299 | ABSENT | |
| 38 | Dupliquer, éditer, supprimer une fiche ; assistant de sortie | RÉF 301 à 308 | PARTIEL | Modification de la fiche, fin de contrat, décompte final. Ni duplication ni suppression. |
| 39 | Informations libres et statistiques du salarié | PÉD 64, 65 | ABSENT | |

## Moteur de paie

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 40 | Constantes : prédéfinies, valeur, calcul, test, tranche, cumul, rubrique, message, date, réponse, nature, utilisateur ; codes mémo | PÉD 66 à 68, 168 à 176 ; RÉF 360 à 395 ; CI 10 ; LIV 12, 15 à 54 | DIFFÉRENT, VOULU | Aucune constante paramétrable : assiettes, cotisations, impôt et net sont codés d'après les textes (`assiettes-paie.ts`, `cotisations-paie.ts`, `bareme-irpp.ts`). |
| 41 | Barèmes à tranches et tests de parts (impôt, contribution) | LIV 23 à 53 ; PÉD 194 à 207 | DIFFÉRENT, VOULU | Barème de l'art. 118 codé ; CNSS, INPP, ONEM et SMIG en versions datées, livrées ou saisies par le cabinet avec leur texte (`VersionBaremePaie`). |
| 42 | Rubriques : brut, cotisation, non soumise ; formule ; gain ou retenue ; impression ; cumuls | PÉD 68 à 70, 177 à 186 ; RÉF 395 à 441 ; CI 20 à 51 ; LIV 54 à 78 ; V8 15 | DIFFÉRENT, VOULU | La rubrique nomme, la nature décide les assiettes et le compte ; fondement exigé ; les cinq exclusions de l'art. 7, point 8 du Code du travail sont refusées à une rubrique (`rubriques-paie.ts`). |
| 43 | Activer ou désactiver une rubrique sur le bulletin ou le modèle | V8 16 ; PÉD 72, 74, 75 ; LIV 55, 56 | PARTIEL | Les éléments s'ajoutent ou se retirent au bulletin ; une rubrique se désactive pour tout le dossier. |
| 44 | Bulletins modèles | V8 9 ; PÉD 71, 72 ; RÉF 566 à 572 ; CI 52 | FIDÈLE | `ModeleBulletin`, qui pré-remplit sans rien décider. |
| 45 | Plan de paie Sage livré et mis à jour, reprise des nouveaux éléments | PÉD 72, 73, 187, 188 ; RÉF 170, 206 | FIDÈLE | Barèmes livrés avec OmegaX, mis à jour par le déploiement ; une version livrée ne se modifie pas. |
| 46 | Variables du salarié, natures d'heures et d'événements liées aux constantes | PÉD 145 à 151 ; RÉF 441 à 460 ; CI 16 à 20 | PARTIEL | Seize natures d'éléments de paie (`NatureElementPaie`). Ni heures ni événements. |

## Bulletin

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 47 | Congés : cumuls, acquisition mensuelle, indemnité, reliquat, clôture des congés | PÉD 77, 190 à 192 ; RÉF 71, 73 | PARTIEL | L'allocation de congé est calculée au décompte final (art. 141 et 142 du Code du travail). Aucune acquisition mensuelle. |
| 48 | Préparer le bulletin : valeurs de base, variables du mois, assistant de préparation | V8 12 à 14 ; PÉD 74 à 80 ; RÉF 572 à 602 ; CI 78 à 81 | PARTIEL | Simulation puis émission : éléments par nature, jours payés, date de mise à disposition. Pas d'assistant. |
| 49 | Saisie des absences : nature, dates, demi-journées, nombre de jours, retenue pour absence | V8 13, 14 ; PÉD 76, 197 à 199 ; RÉF 585 à 592, 655 à 659 ; CI 63 à 66 | ABSENT | |
| 50 | Heures supplémentaires par taux | V8 14 ; PÉD 79, 205, 206 ; RÉF 592 ; CI 70 à 74 ; LIV 63 à 68 | PARTIEL | Elles se saisissent en montant, comme prestation supplémentaire ; aucun calcul par heures et par taux. |
| 51 | Arrêts de travail, indemnités journalières, subrogation, calcul à l'envers | PÉD 199 à 202 ; RÉF 612 à 618 | ABSENT | Les indemnités d'incapacité se saisissent en montant, sous leur nature. |
| 52 | Prime d'ancienneté calculée par tranches | PÉD 203 à 205 ; LIV 30, 59, 60 | ABSENT | |
| 53 | Calculer et valider le bulletin | V8 17 ; PÉD 81, 82 ; RÉF 599 à 607, 665 ; CI 78 à 81 | FIDÈLE | Le serveur rejoue le calcul, fige les chiffres et numérote le bulletin (`personnel/bulletin-paie.ts`). |
| 54 | Éditer les bulletins par lot ou par sélection, date de paiement, aperçu, PDF | V8 17, 18 ; PÉD 83, 84 ; RÉF 605 à 607, 667 à 674 | PARTIEL | Un bulletin à la fois, imprimé par le navigateur ; la remise au salarié se déclare. |
| 55 | Modification en masse des salaires et des états, rappel de salaires | RÉF 770 à 779 | ABSENT | |
| 56 | Gestion des temps : modèles hebdomadaires, plannings, feuilles de temps, contrôle et enregistrement des heures | PÉD 141 à 167 ; RÉF 514 à 518, 562, 636 à 664 ; CI 70 à 74 | ABSENT | |
| 57 | Sortie du salarié : date et motif, dernier bulletin au prorata, indemnité compensatrice de congés, solde de tout compte | PÉD 42, 97 à 101 ; RÉF 308 | FIDÈLE | Décompte final (préavis, congé, indemnités) émis comme un bulletin, qui remplace celui du dernier mois. |

## Acomptes, prêts et paiements

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 58 | Acomptes et avances : saisie, ordre de paiement, génération dans la paie | RÉF 618 à 633 ; CI 75 à 77 ; PÉD 37 | PARTIEL | Avances et acomptes retenus aux bulletins (`AvanceSalaire`) ; le versement est une écriture de trésorerie du cabinet. Pas d'ordre de paiement. Les captures (CI p. 75 à 77) montrent l'acompte régulier ou exceptionnel, l'état des ordres de paiement avec la banque de chaque salarié, et la génération sur la rubrique d'avance. |
| 59 | Prêts au personnel : tableau d'amortissement, déblocage des fonds, impact en paie | CI 67 à 69 ; RÉF 518, 636 | PARTIEL | Prêt au 272 avec retenue mensuelle et solde calculé sur les bulletins non annulés. Ni tableau d'amortissement ni déblocage. Les captures (CI p. 67 à 69) montrent aussi le type de prêt, le taux d'intérêt, les paliers et le mode de paiement du déblocage : le prêt d'OmegaX ne porte pas d'intérêt (`AvanceSalaire`). |
| 60 | Paiement des salaires : ordres de paiement, virements, chèques, billetage | RÉF 676 à 687 ; V8 19 | ABSENT | Le net est porté au 422 ; son paiement se saisit en trésorerie. |

## Clôtures et passation comptable

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 61 | Modélisation comptable : comptes, journaux, structure des pièces (part salariale, part patronale), sélection et montants par ligne | PÉD 108 à 115 ; RÉF 518 à 544 | DIFFÉRENT, VOULU | Comptes fixés par référentiel, compte par compte (`passation-paie.ts`), en trois temps : brut, retenues, charges patronales, puis impôts et taxes sur salaires. Les captures (PÉD p. 39, 109 à 115) montrent un compte d'attente général et analytique : OmegaX n'en a pas, et refuse la passation si le solde du 422 n'est pas le net, sans ligne de bouclage. |
| 62 | Passation comptable : journal de contrôle, fichier vers la comptabilité, simulation ou définitive | V8 21 ; PÉD 115 à 118 ; RÉF 757 à 763 | FIDÈLE | La paie du mois passe directement au journal, sans fichier, au brouillard, et se reprend en négatif après l'annulation d'un bulletin (`comptabilisation-paie.ts`). |
| 63 | Ventilation analytique de la paie, pointages | RÉF 316, 525 à 533, 759 | ABSENT | |
| 64 | Clôture mensuelle (forcée ou non), clôture intermédiaire, ouverture du mois, clôture annuelle | V8 20 à 22 ; PÉD 85 à 87, 119 ; RÉF 687 à 695 | DIFFÉRENT, VOULU | Aucune période de paie à clôturer : un bulletin émis est indélébile et s'annule avec son motif. |

## États

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 65 | Livre de paie | V8 18 ; PÉD 90, 91 ; RÉF 696 | PARTIEL | OmegaX ne tient pas le livre de paie : il vérifie les trente-trois énonciations de l'arrêté du 8 août 2008 (`livre-de-paie.ts`) et ne certifie aucune conformité au modèle. |
| 66 | Fiche individuelle, états des cumuls par rubrique et par constante | PÉD 91, 92 ; RÉF 698, 748 à 750 | ABSENT | |
| 67 | États et résumé des cotisations | PÉD 95, 96 ; RÉF 745, 746 | PARTIEL | Registre et échéancier des retenues, par nature et par mois (`retenues/`). |
| 68 | États de la CNSS et de l'impôt sur salaires | V8 19 | PARTIEL | Même registre ; seul l'imprimé IRPPDR1 de la DGI est nommé. Aucun formulaire n'est édité. |
| 69 | Déclarations françaises : DUCS, DADS-U, attestations, déclarations annuelles, TDS, épargne salariale, DIF | PÉD 93 à 106, 119 à 139 ; RÉF 717 à 745, 753 à 755, 780 à 785, 855 à 958 | DIFFÉRENT, VOULU | Sans objet en RDC. |
| 70 | Mouvements de personnel et de main-d'œuvre, effectif | RÉF 700 à 705 | PARTIEL | Effectif proposé par le registre, part de main-d'œuvre locale (`GET /personnel/effectif`). |
| 71 | Bilan social et indicateurs | RÉF 786 à 813 | PARTIEL | Effectif des notes annexes 27B et 29B, proposé depuis le registre. |
| 72 | États personnalisés de paie (formulaires, documents, listes, sélections), publipostage | V8 22 à 27 ; RÉF 205, 359 | ABSENT | Les états personnalisés d'OmegaX portent sur les comptes, pas sur la paie. |
| 73 | Sortie vers Excel et autres formats | RÉF 35, 37 | ABSENT | Aucun export du module Personnel. |
| 74 | Calendrier, workflow (mise à jour, purge, consultation des événements) | RÉF 147, 633, 765 à 767 | ABSENT | |

## Vu sur les captures seulement

| # | Fonction Sage | Pages | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 75 | Installation avec clé d'authentification, enregistrement de la société, code d'accès ; identification à l'ouverture (mode d'authentification, monoposte) | PÉD 18 à 31 ; V8 3 ; CI 2 | DIFFÉRENT, VOULU | En ligne, rien à installer ; sur site, une licence en fichier signé (`src/modules/sur-site/`). Chaque utilisateur se connecte à son compte, double authentification offerte (CLAUDE.md, § 8). |
| 76 | Compte auxiliaire individuel du salarié, sous le collectif 421, choisi sur sa fiche | PÉD 59, 60, 109 ; V8 11 | ABSENT | Le net va au 422 global. Le salarié n'a pas de compte individuel, et la panoplie des comptes de tiers ne le couvre pas encore (décision de Manasse du 2026-10-09). Voir M6-171. |
| 77 | Assistant de préparation des bulletins : méthode du taux journalier ou horaire pour les absences (accident du travail, maladie, maternité), durée mensuelle, jours de congé acquis par mois, heures par jour | CI 8, 9 ; PÉD 45 | ABSENT | Ni absences ni acquisition mensuelle du congé (lignes 47 et 49). |
| 78 | Modification de la valeur d'une rubrique au bulletin, avec rappel ou régularisation sur une période antérieure | V8 15 ; CI 54 | PARTIEL | Les éléments du bulletin se saisissent en montant, sous leur nature. Une erreur d'un mois passé ne se régularise pas au bulletin suivant : le bulletin émis s'annule et se réémet (P9). |

## Bilan du manuel

78 fonctions relevées, dont quatre vues sur les captures seulement :
9 FIDÈLE, 15 DIFFÉRENT VOULU, 0 DIFFÉRENT À TRIER, 27 PARTIEL, 27 ABSENT,
0 NON VÉRIFIÉ.

OmegaX calcule une paie congolaise juste et la passe au journal, mais il ne
gère pas le temps de travail. Absences, heures supplémentaires par taux,
congés acquis chaque mois et prime d'ancienneté ne sont pas calculés. Il
n'y a pas non plus de paiement des salaires, d'import, ni d'état par
salarié en dehors du bulletin. Là où Sage laisse le cabinet écrire
constantes et formules, OmegaX code la règle d'après le texte.

## Ce qui reste à faire sur ce manuel

- Lire la fin du manuel de référence (RÉF, après la page 81) et du livre
  ivoirien (LIV, après la page 78), découpés en morceaux de moins de 10 Mo.
- Manasse trie les ABSENT.
