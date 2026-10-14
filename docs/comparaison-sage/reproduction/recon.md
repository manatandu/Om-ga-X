# Carte de reproduction · ce que Sage fait, fonction par fonction

Première pièce de la reproduction des 41 absences cochées « À faire » par
Manasse le 2026-10-14 (`../15-absents-a-trier.md`). Pour chaque fonction :
les lignes des manuels qui la décrivent, avec la section du manuel où elle
se trouve chez Sage et la page, puis ce qu'OmegaX fait aujourd'hui. Les
descriptions sont celles de la comparaison, écrites avec nos mots ; rien
n'est recopié des manuels.

Manuels : M1 `01-guide-utilisateur-i7.md` ; M2 `02-manuel-edm.md` ; M3 `03-manuel-saari.md` ; M4 `04-immobilisations.md` ; M5 `05-moyens-de-paiement.md` ; M6 `06-structure-des-fichiers.md` ; M7 `07-paie.md` ; M8 `08-sage-x3.md` ; M9 `09-prise-en-main-rapide.md` ; M10 `10-support-compta-formation.md` ; M11 `11-cours-sage-i7-le-formateur.md` ; M12 `12-formation-sage-i7.md` ; M13 `13-moyens-de-paiement-reference.md` ; M14 `14-formation-sage-comptabilite.md` ; M15 `15-absents-a-trier.md`.

## 1. Mode de règlement (chèque, virement, espèces) sur le tiers et en saisie ; codes interbancaires

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M5-8 | Options : code interbancaire, information libre, modes de règlement | Installation et société (p. 9 à 52) | 52 |
| M6-19 | P_REGLEMENT : trente modes de règlement, modes de paiement, codes interbancaires principaux, RIB associés | Comptabilité (p. 37 à 218) | 48, 49 |
| M10-44 | Modes de règlement | Tiers (p. 76 à 130) | 83, 84 |
| M13-31 | Codes interbancaires et modes de règlement (trente au plus) | Menu Fichier (p. 30 à 161) | 64, 67, 80, 131 |

Aujourd'hui dans OmegaX : Le journal de trésorerie et la référence de la pièce en tiennent lieu ; rien n'est enregistré comme mode.

## 3. Échéance calculée d'office par le modèle de règlement du tiers ; fenêtre multi-échéance ; validation automatique des règlements

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M3-14 | Échéance calculée d'office selon les conditions de règlement du tiers | Saisie d'une facture et d'un règlement (p. 24 à 32) | 28 |
| M1-89 | Fenêtre multi-échéance selon le modèle de règlement | Saisie des écritures (p. 21 à 24) | 23 |
| M1-46 | Validation automatique des règlements (fenêtre des échéances) | Plan tiers (p. 9 à 14) | 12 |

Aujourd'hui dans OmegaX : Le modèle de règlement se simule, aucune saisie ne l'applique ; l'échéance se saisit ligne par ligne.

## 11. Masquer les totaux d'un journal

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M1-82 | Masquer les totaux | Codes journaux (p. 18 à 20) | 19 |

Aujourd'hui dans OmegaX : Les totaux s'affichent toujours.

## 12. Journal de situation ni clôturable ni compactable

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M1-77 | Journal de situation ni clôturable ni compactable | Codes journaux (p. 18 à 20) | 19 |
| M2-70 | Journal de situation non clôturable | Clôture et nouvel exercice (p. 53 à 59) | 56 |

Aujourd'hui dans OmegaX : Le type existe ; aucune règle ne l'écarte de la clôture.

## 14. Créer un compte pendant la saisie

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M10-17 | Création d'un compte pendant la saisie (option) | Journaux et saisie (p. 18 à 49) | 31 |

Aujourd'hui dans OmegaX : La grille renvoie au Plan comptable (comptes personnalisés).

## 16. Changer à la main la prochaine lettre de lettrage

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M3-19 | Changer à la main la prochaine lettre | Interrogation et lettrage (p. 32 à 45) | 36 |

Aujourd'hui dans OmegaX : La lettre est attribuée par le programme.

## 18. Mode assistant : création guidée d'un compte, d'un journal, d'un bien, d'un règlement ; création enchaînée

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M2-8 | Mode assistant (création guidée d'un compte, d'un journal, de la clôture) | Création du fichier et paramètres (p. 3 à 12) | 13, 20, 53 |
| M3-5 | Assistant de création enchaînée (« valider ce compte pour en créer un nouveau ») | Éléments comptables (p. 11 à 24) | 11, 12, 15 |
| M4-B-42 | Assistant de création d'un bien en huit étapes | Structure : familles et fiches (p. 77 à 140) | 88 à 93 |
| M5-17 | Saisie des règlements en mode Assistant ou en liste | Remises en banque (p. 67 à 85) | 67, 77 |
| M14-13 | Assistant de création d'un compte (numéro et intitulé, puis valider ou continuer) | Plan comptable | · |

Aujourd'hui dans OmegaX : Un formulaire par objet.

## 19. Séquences de saisie

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-142 | P_SEQUENCE : séquences de saisie | Paie Maestria (p. 558 à 600) | 558, 559 |

Aujourd'hui dans OmegaX : Aucune.

## 22. Documents rattachés aux écritures, aux sections, aux biens et aux salariés

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-74 | F_ECRITURECMEDIA : documents rattachés aux écritures | Comptabilité (p. 37 à 218) | 212 |
| M10-98 | Documents rattachés à une écriture, ouverts depuis la saisie | Vu sur les captures seulement | 29 |
| M6-76 | F_COMPTEAMEDIA : documents des sections analytiques | Comptabilité (p. 37 à 218) | 216 |
| M4-B-48 | Documents attachés et bloc-notes de la fiche | Structure : familles et fiches (p. 77 à 140) | 101, 102, 226 |
| M7-37 | Documents et pièces jointes de la fiche | Fiche du personnel | RÉF 299 |

Aujourd'hui dans OmegaX : Seuls les tiers et les virements de fonds portent une pièce jointe.

## 24. Qualité du tiers (société, indépendant…)

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M1-36 | Qualité (société, indépendant…) | Plan tiers (p. 9 à 14) | 10 |

Aujourd'hui dans OmegaX : Aucune.

## 27. Modèles d'impression propres au tiers (extrait, règlement, rappel)

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M1-55 | Volet Modèles d'impression du tiers (extrait, règlement, rappel) | Plan tiers (p. 9 à 14) | 14 |
| M6-46 | F_COMPTETMODELE : modèles d'impression par tiers | Comptabilité (p. 37 à 218) | 99 |

Aujourd'hui dans OmegaX : Aucun.

## 31. Lieux de livraison des clients

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-52 | F_LIVRAISON : lieux de livraison des clients | Comptabilité (p. 37 à 218) | 109 à 111 |

Aujourd'hui dans OmegaX : Aucun.

## 32. Duplication d'un tiers

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M13-49 | Duplication d'un tiers | Menu Structure (p. 163 à 266) | 185 |

Aujourd'hui dans OmegaX : Aucune.

## 36. Écart de règlement passé en charge ou en produit sous un seuil ; escompte financier

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M10-84 | Écart de règlement par modèle de saisie, sous un montant maximum | Devises (p. 183 à 206) | 186, 192, 195 |
| M13-18 | Écart de règlement passé d'office sur un compte de charge ou de produit, sous un seuil paramétré | Menu Fichier (p. 30 à 161) | 56, 57, 299 à 303 |
| M6-135 | F_ECARTREGLEMENT, F_ESCOMPTES : écarts de règlement et escompte | Moyens de paiement et trésorerie (p. 495 à 557) | 530 à 533 |
| M13-21 | Comptes et journal des escomptes financiers (accordés, obtenus) | Menu Fichier (p. 30 à 161) | 58, 421 à 427 |
| M13-77 | Escomptes financiers | Menu Traitement (p. 268 à 519) | 421 à 427 |

Aujourd'hui dans OmegaX : Un paiement inférieur au dû reste partiel, un paiement supérieur est refusé.

## 37. Virements internationaux, ordre de virement depuis un compte en devise

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M5-42 | Virements internationaux | Fonctions nommées en conclusion (p. 123) | 9, 123 |
| M13-72 | Virements internationaux | Menu Traitement (p. 268 à 519) | 376 à 384 |

Aujourd'hui dans OmegaX : L'ordre ne s'émet que depuis un compte en francs.

## 39. Effets de commerce : LCR, effets à vue, bons à payer et leur circuit ; journaux d'escompte et d'encaissement

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M5-24 | Saisie et remise des LCR à l'encaissement : mise en portefeuille, acceptation | Remises en banque (p. 67 à 85) | 68, 69, 73, 123 |
| M5-47 | LCR à décaisser, relevés de LCR à payer et bons à payer | Fonctions nommées en conclusion (p. 123) | 9, 123 |
| M13-6 | Journal d'escompte et journal d'encaissement par banque | Introduction et nouveautés de la version 16 (p. 14 à 26) | 24, 475 |
| M13-12 | Effets à vue inclus dans les remises | Introduction et nouveautés de la version 16 (p. 14 à 26) | 25 |
| M13-67 | LCR-BOR à l'encaissement et au décaissement ; relevés de LCR à payer ; bons à payer | Menu Traitement (p. 268 à 519) | 329, 385, 429 à 436 |
| M14-19 | Journaux de remise à l'encaissement et à l'escompte, de prélèvements remis en banque | Taxes, journaux et banques | · |
| M6-38 | P_BONAPAYER, F_BONAPAYERHISTO, F_BONAPAYERHISTOCIAL : circuit de bon à payer et son historique | Comptabilité (p. 37 à 218) | 68, 217, 218, 443, 444 |
| M6-128 | P_TDOSSIER : référence d'incorporation, date des effets, exécution, escompte, type d'effet, remises brûlantes, émetteur, écarts | Moyens de paiement et trésorerie (p. 495 à 557) | 495 à 497 |

Aujourd'hui dans OmegaX : Aucun effet de commerce.

## 40. Remises de chèques et de cartes bancaires, types de remise, modèles de bordereaux

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M5-43 | Remises de chèques | Fonctions nommées en conclusion (p. 123) | 123 |
| M5-46 | Remises de cartes bancaires | Fonctions nommées en conclusion (p. 123) | 123 |
| M13-62 | Types de remise | Menu Structure (p. 163 à 266) | 263, 264 |
| M5-21 | Modèle de bordereau de remise choisi à l'impression | Remises en banque (p. 67 à 85) | 72, 83, 84, 94, 98 |

Aujourd'hui dans OmegaX : Le chèque reçu se saisit au journal ; la seule remise est l'ordre de virement imprimé.

## 45. Édition chaînée des extraits

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M13-10 | Édition chaînée des extraits de compte | Introduction et nouveautés de la version 16 (p. 14 à 26) | 25 |

Aujourd'hui dans OmegaX : Pas de liste des extraits.

## 46. Conditions bancaires par RIB, autorisations de financement, unions de comptes

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-58 | F_EBANQUECOND, F_AUTORISATIONFINBQ : conditions bancaires par RIB, autorisations de financement | Comptabilité (p. 37 à 218) | 197 à 200 |
| M6-136 | F_UNION, F_EUNION : unions de comptes bancaires | Moyens de paiement et trésorerie (p. 495 à 557) | 534, 535 |

Aujourd'hui dans OmegaX : Aucune.

## 47. Trésorerie : taux de référence, financements, placements, OPCVM

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-129 | P_DOSSIERFTRS : délais, TVA des frais bancaires, affectation du RIB, comptes OPCVM, financements, placements | Moyens de paiement et trésorerie (p. 495 à 557) | 498, 499 |
| M6-137 | F_TAUXREFERENCE, F_HISTOTAUXREFERENCE, F_NATFINANCEMENT, F_NATPLACEMENT, F_OPFINANCEMENT, F_OPPLACEMENT : taux de référence, financements et placements | Moyens de paiement et trésorerie (p. 495 à 557) | 536 à 539, 551 à 555 |
| M6-139 | F_OPCVM, F_HISTOOPCVM, F_OPCVMEBANQUE, F_TRANSACTIONOPCVM, F_HISTOVENTEOPCVM : OPCVM, valeurs liquidatives, transactions | Moyens de paiement et trésorerie (p. 495 à 557) | 544 à 548 |

Aujourd'hui dans OmegaX : Les intérêts courus d'un emprunt se déclarent sans taux.

## 50. Longueur fixe des codes de section

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M14-5 | Longueur des codes de section analytique | Installation et création du dossier | · |

Aujourd'hui dans OmegaX : Codes de longueur libre.

## 59. Modèles d'édition, sauts de ligne ou de page, impression différée, sélections enregistrées

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M2-34 | Modèle d'édition standard ou personnalisé | États de la comptabilité générale (p. 29 à 36) | 33 |
| M1-27 | Saut de ligne ou de page à l'impression | Plan comptable général (p. 4 à 8) | 8 |
| M1-50 | Saut de ligne ou de page à l'impression | Plan tiers (p. 9 à 14) | 13 |
| M1-68 | Saut de ligne ou de page | Plan analytique (p. 15 à 17) | 16 |
| M10-62 | Impression différée | Tiers (p. 76 à 130) | 123 |
| M1-132 | Fenêtre de présélection, formats de sélection enregistrés | Impressions (p. 40 à 43) | 40 |
| M8-57 | Sélections mémorisées (titre 7.1) | Chapitres connus par leur titre seul (p. 82 et suivantes) | sommaire |

Aujourd'hui dans OmegaX : On imprime la fenêtre ; seul le choix de l'exercice est retenu.

## 60. Journal marqué « imprimé » ; refus de clôturer un journal non imprimé

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M2-67 | Édition des journaux clôturés ; refus de clôturer un journal non imprimé | Clôture et nouvel exercice (p. 53 à 59) | 54, 56 |
| M3-29 | Impression du journal qui marque le journal « imprimé » | États standards et états des tiers (p. 51 à 59) | 53 |

Aujourd'hui dans OmegaX : L'impression n'est pas tracée.

## 66. Modifier, supprimer ou dupliquer une fiche

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M4-B-41 | Modifier une fiche (un changement de compte propose un virement de poste) ; supprimer ; dupliquer | Structure : familles et fiches (p. 77 à 140) | 88, 94, 156, 183 |

Aujourd'hui dans OmegaX : Seuls le lieu, la mise en service et la réserve de propriété se posent après la création.

## 67. Annuler une dotation ou un traitement (inventaire, révision, réévaluation, dérogatoire)

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M4-B-54 | Modifier ou supprimer une dotation non clôturée ; saisir une dotation à la main | Traitements (p. 141 à 201) | 143, 145, 146, 289, 290, 293, 294 |
| M4-B-56 | Annulation des calculs ; annulation des traitements (inventaire, révision, réévaluation, dérogatoires) | Traitements (p. 141 à 201) | 159, 160, 317, 318 |

Aujourd'hui dans OmegaX : Chaque geste retient son écriture ; aucune route ne le retire.

## 68. Créer les biens à partir des écritures déjà passées

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M4-B-58 | Création automatique des biens à partir des écritures comptables | Traitements (p. 141 à 201) | 161 à 163 |

Aujourd'hui dans OmegaX : Le bien naît dans le module ; ce qui est passé hors module est signalé.

## 73. Fusion de fichiers d'immobilisations, renumérotation, maintenance

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M4-B-35 | Fusion de deux fichiers d'immobilisations (assistant, correspondance des tables, statut « Fusion ») | Fichier, paramètres et options (p. 9 à 76) | 64 à 73, 141 à 155 |

Aujourd'hui dans OmegaX : Aucune.

## 75. Banques et mode de paiement du salarié ; paiement des salaires (ordres, virements, chèques, billetage)

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M7-9 | Modes de paiement de la société, affectés à chaque salarié | Dossier et paramètres | PÉD 37 ; RÉF 78 ; V8 6 |
| M7-28 | Coordonnées : adresses, banques, mode de paiement | Fiche du personnel | V8 6 ; PÉD 52, 53 |
| M6-151 | P_SREGLEMENT, F_REGLEMENTS, F_BANQUES : modes de règlement du salarié, banques, répartition entre acompte et solde | Paie Maestria (p. 558 à 600) | 573, 587 à 589 |
| M7-60 | Paiement des salaires : ordres de paiement, virements, chèques, billetage | Acomptes, prêts et paiements | RÉF 676 à 687 ; V8 19 |

Aujourd'hui dans OmegaX : Le net va au 422 ; son paiement se saisit en trésorerie.

## 78. Temps de travail : heures, absences, arrêts et indemnités journalières, gestion des temps, assistant de préparation

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M7-10 | Heures effectivement travaillées, compteurs libres, report d'un élément après clôture | Dossier et paramètres | PÉD 41, 43, 77 |
| M7-49 | Saisie des absences : nature, dates, demi-journées, nombre de jours, retenue pour absence | Bulletin | V8 13, 14 ; PÉD 76, 197 à 199 ; RÉF 585 à 592, 655 à 659 ; CI 63 à 66 |
| M7-51 | Arrêts de travail, indemnités journalières, subrogation, calcul à l'envers | Bulletin | PÉD 199 à 202 ; RÉF 612 à 618 |
| M7-56 | Gestion des temps : modèles hebdomadaires, plannings, feuilles de temps, contrôle et enregistrement des heures | Bulletin | PÉD 141 à 167 ; RÉF 514 à 518, 562, 636 à 664 ; CI 70 à 74 |
| M7-77 | Assistant de préparation des bulletins : méthode du taux journalier ou horaire pour les absences (accident du travail, maladie, maternité), durée mensuelle, jours de congé acquis par mois, heures par jour | Vu sur les captures seulement | CI 8, 9 ; PÉD 45 |

Aujourd'hui dans OmegaX : Les éléments se saisissent en montant, sous leur nature.

## 79. Congés acquis chaque mois

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M7-32 | Congés acquis avant la reprise, puis alimentés chaque mois | Fiche du personnel | V8 10 ; PÉD 190 à 192 |

Aujourd'hui dans OmegaX : Le congé n'est calculé qu'au décompte final.

## 85. Questionnaire société et salarié

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M7-26 | Questionnaire (questions sur la société et le salarié) | Organisation et listes | PÉD 44, 62 à 64 ; RÉF 460 à 463 |

Aujourd'hui dans OmegaX : Aucun.

## 88. Ventilation analytique de la paie, pointages

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M7-63 | Ventilation analytique de la paie, pointages | Clôtures et passation comptable | RÉF 316, 525 à 533, 759 |
| M6-149 | P_SANALYTIQUE, F_POINTAGE, F_POINTHIST : analytique de la paie et pointages | Paie Maestria (p. 558 à 600) | 572, 595, 598 |

Aujourd'hui dans OmegaX : Aucune.

## 90. Paramètres commerciaux, statistiques des articles, gammes, tarifs, remises, périodicités et livraisons, agenda, abonnements commerciaux, caisse de comptoir, site marchand, documents internes, codes-barres, fabrication et affaires, fournisseurs des articles, glossaires, catalogue et commissions

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-78 | P_DOSSIERCIAL et paramètres commerciaux : encours, contremarque, analytique, devise, numérotation, arrondis, journaux, caisse, lots, prévision, multi-dépôts, base de la marge | Gestion commerciale (p. 219 à 449) | 219 à 226 |
| M6-79 | P_INTSTATART, F_ENUMSTATART : statistiques des articles | Gestion commerciale (p. 219 à 449) | 227, 270, 271 |
| M6-82 | P_GAMME, F_ENUMGAMME, F_ARTGAMME, F_ARTENUMREF, F_TARIFGAM, F_GAMSTOCK, F_GAMSTOCKEMPL : gammes et leurs stocks | Gestion commerciale (p. 219 à 449) | 228, 229, 272 à 274, 297 à 300, 305, 306, 310 à 313 |
| M6-83 | P_PERIOD, P_CONDLIVR, P_EXPEDITION : périodicités, conditions de livraison, modes d'expédition et frais | Gestion commerciale (p. 219 à 449) | 229, 236, 237 |
| M6-85 | P_AGENDAS, F_AGENDADET, F_AGENDA : agenda des tiers, articles et dépôts | Gestion commerciale (p. 219 à 449) | 235, 271, 272, 325 à 327 |
| M6-86 | P_CATTARIF, F_FAMTARIF, F_FAMCLIENT, F_FAMTARIFQTE, F_ARTCLIENT, F_TARIFQTE, F_TARIF, F_TARIFSELECT, F_TARIFREMISE : catégories tarifaires, tarifs, remises, barèmes, soldes et promotions | Gestion commerciale (p. 219 à 449) | 235, 283 à 287, 302 à 308, 332 à 338 |
| M6-88 | P_PREFERENCES : alertes d'agenda, remises, poids, codes EAN, stock négatif, création à la volée, caisse de comptoir, facture électronique | Gestion commerciale (p. 219 à 449) | 237 à 241 |
| M6-89 | P_RESILIATION, F_ABONNEMENT, F_ABOPERIODE, F_ABOENTETE, F_ABOLIGNE, F_ABOREGLEMENT : abonnements commerciaux générant des pièces | Gestion commerciale (p. 219 à 449) | 241, 391 à 406 |
| M6-90 | P_COMPTOIR, P_SCDREGLEMENT, P_SCDCLAVIER, F_CAISSE, F_AFFICHEUR, F_AFFICHEURCAISSE, F_CLAVIER, F_CAISSECAISSIER, F_TICKETARCHIVE, F_LIGNEARCHIVE, F_REGLEARCHIVE, F_BILLETPIECE : caisse de comptoir, tickets, billets et pièces | Gestion commerciale (p. 219 à 449) | 249 à 252, 409 à 419, 430 |
| M6-91 | P_COMMUNICATION, F_COMMPLANIFIE : site marchand, transferts planifiés entre sites | Gestion commerciale (p. 219 à 449) | 252, 253, 420 à 422 |
| M6-92 | P_PARAMETRELIVR : préparation des livraisons | Gestion commerciale (p. 219 à 449) | 253, 254 |
| M6-93 | P_INTERNE : documents internes avec mouvement de stock | Gestion commerciale (p. 219 à 449) | 254, 255 |
| M6-94 | P_GENAUTO : génération automatique des références et des codes-barres | Gestion commerciale (p. 219 à 449) | 262 à 266 |
| M6-95 | P_PROJETFAB, P_PROJETAFF, P_FACTUREAFF, F_PROJETFABRICATION, F_PROJETLIGNE, F_PROJETPLANNING, F_PROJETHISTO, F_RESSOURCEPROD, F_ARTCOMPO, F_RESSCENTRE, F_ARTICLERESSOURCE, F_PREVISION, F_NOMENCLAT : fabrication, affaires, ressources, nomenclatures | Gestion commerciale (p. 219 à 449) | 267 à 270, 313 à 315, 423 à 441 |
| M6-98 | F_ARTFOURNISS, F_ARTPRIX : fournisseurs d'un article, dernier prix d'achat | Gestion commerciale (p. 219 à 449) | 300 à 302, 322 |
| M6-99 | F_ARTGLOSS, F_GLOSSAIRE, F_DOCLIGNETEXT, F_DOCENTETETEXT : glossaires et textes complémentaires | Gestion commerciale (p. 219 à 449) | 318, 319, 324, 325, 441 à 443 |
| M6-100 | F_ARTMODELE, F_ARTICLEMEDIA, F_CATALOGUE, F_REPCOM, F_CMLIEN, F_MODELE : modèles et médias d'articles, catalogue, commissions des représentants, contremarque, modèles de calcul | Gestion commerciale (p. 219 à 449) | 321 à 323, 338, 339, 407, 408, 432, 433 |

Aujourd'hui dans OmegaX : OmegaX ne tient pas de gestion commerciale ; facturation et devis seulement.

## 91. Collaborateurs et leurs rôles commerciaux

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-73 | F_COLLABORATEUR : collaborateurs et leurs rôles (vendeur, caissier, acheteur, contrôleur, financier, chargé de recouvrement) | Comptabilité (p. 37 à 218) | 201 à 203 |

Aujourd'hui dans OmegaX : Aucun.

## 94. Modes d'arrondi

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-81 | P_ARRONDI : modes d'arrondi | Gestion commerciale (p. 219 à 449) | 228 |

Aujourd'hui dans OmegaX : Aucun.

## 95. Utilisateurs connectés, messagerie interne, lecture des cumuls du module

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M4-B-31 | Lire les informations (totaux par période, nombre d'éléments) ; utilisateurs connectés | Fichier, paramètres et options (p. 9 à 76) | 57 à 59 |
| M13-37 | Calcul des cumuls, lecture des informations, utilisateurs connectés, messages entre utilisateurs | Menu Fichier (p. 30 à 161) | 118 à 121 |

Aujourd'hui dans OmegaX : Aucun.

## 96. Langue de l'application

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M8-25 | Langues d'accès et langue par défaut | Dossiers (p. 15 à 43) | 25 |

Aujourd'hui dans OmegaX : Français seulement.

## 99. Export des seules modifications depuis le dernier export

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M8-38 | Numéro d'export : seuls les enregistrements créés ou modifiés depuis le dernier export partent | Conception d'un objet (p. 45 à 70) | 51, 52 |

Aujourd'hui dans OmegaX : Exports complets.

## 100. Personnalisation des écrans, éditeur de formules, workflow de notification

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M8-40 | Personnalisation des écrans et des objets par le client sans code activité | Conception d'un objet (p. 45 à 70) | 57, 63, 64 |
| M8-45 | Éditeur et assistant de formules, analyse de la formule et des messages | Formules (p. 70 à 79) | 72 à 75 |
| M8-56 | Paramétrage des fonctions : propriétés des objets, transactions de saisie, écrans de consultation, paramétrage générique des écrans, styles (titres 6.1 à 6.7) | Chapitres connus par leur titre seul (p. 82 et suivantes) | sommaire |
| M8-61 | Workflow de notification : principes, codes activité, moniteur et plans de travail (chapitre 10) | Chapitres connus par leur titre seul (p. 82 et suivantes) | sommaire |

Aujourd'hui dans OmegaX : Aucune.

## 101. Organisation du cabinet en niveaux, collaborateurs rattachés

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M6-165 | P_CDOSSIER, P_NIVEAU, F_ENUMNIVEAU, F_LIENNIVEAU, F_UTILISATEUR : organisation du cabinet en niveaux, collaborateurs rattachés | Manager (p. 601 à 624) | 601, 602, 605, 614, 615 |

Aujourd'hui dans OmegaX : Un dossier est une entité ; l'éditeur voit la liste des cabinets, sans leurs données.

## 102. Écritures échangées avec l'expert-comptable, journaux synchronisés

| Renvoi | Fonction chez Sage | Section du manuel | Page |
|---|---|---|---|
| M10-88 | Écritures importées ou exportées avec l'expert-comptable, journaux synchronisés | Devises (p. 183 à 206) | 204 |

Aujourd'hui dans OmegaX : Aucun échange.
