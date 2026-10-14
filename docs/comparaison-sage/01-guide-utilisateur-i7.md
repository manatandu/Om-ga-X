# Sage 100 Comptabilité i7, Guide de l'utilisateur · fonction par fonction

Manuel 1 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Guide de l'utilisateur, Sage 100 Comptabilité i7 », 44 pages
(Drive, id 1p0AZjvBs7LCkvbev2m0Y2TZX6UhO1ixY), lu en entier le 2026-10-14.
Méthode : une ligne par fonction que le Guide décrit, sa page, puis le statut
d'OmegaX LU DANS LE CODE le même jour (schéma Prisma, DTO, écrans, menu de
`AppShell.tsx`), jamais de mémoire. Une ligne qui n'a pas pu être lue dans le
code est marquée NON VÉRIFIÉ, jamais devinée.

Ce tableau n'est pas une liste de travaux. Le gel tient (CLAUDE.md § 5) ·
Manasse trie, et chaque fonction absente qu'il retient demande sa phrase
« Lève le gel pour X ».

## Légende

- **FIDÈLE** · OmegaX fait la même chose.
- **DIFFÉRENT, VOULU** · OmegaX fait autrement, et la raison est écrite (texte
  OHADA ou décision de Manasse).
- **DIFFÉRENT, À TRIER** · OmegaX fait autrement sans raison écrite.
- **PARTIEL** · une partie de la fonction existe.
- **ABSENT** · rien de tel dans le code lu.
- **NON VÉRIFIÉ** · je n'ai pas pu trancher à la lecture du code.

## Ouverture de l'application (p. 3)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Ouvrir un fichier comptable (Fichier, Ouvrir) | 3 | DIFFÉRENT, VOULU | Le dossier est choisi à la connexion ; « Ouvrir un autre dossier… » au menu Fichier. Application en ligne, pas de fichier. |
| 2 | Connexion par code utilisateur et mot de passe | 3 | FIDÈLE | Plus la double authentification, ouverte à tous (CLAUDE.md § 8). |

## Plan comptable général (p. 4 à 8)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 3 | Liste des comptes : créer, consulter, modifier, supprimer | 4 | PARTIEL | Les quatre gestes existent ; « Nouveau compte » n'est visible qu'à l'administrateur (`estAdmin`), et le filtre « Comptes personnalisés seulement » n'existe pas chez Sage. Ligne 2 de la reprise. |
| 4 | Clic droit : actions sur le compte | 4 | ABSENT | Aucun menu contextuel dans les pages de l'application. |
| 5 | Bouton « Nouveau », fiche en volets | 4 | PARTIEL | Voir ligne 3. |
| 6 | Date de création du compte affichée | 5 | ABSENT | Le modèle `Compte` n'a pas de date de création. |
| 7 | Bouton « Gérer » vers l'interrogation du compte | 5 | FIDÈLE | `PlanComptesPage.tsx`, bouton Gérer. |
| 8 | Numéro unique | 5 | FIDÈLE | Clé unique (dossier, numéro). |
| 9 | Longueur des numéros fixée à la création, jamais modifiable | 5 | DIFFÉRENT, VOULU | Longueur modifiable vers le haut, jamais sous le plus long numéro ouvert (CLAUDE.md, « Longueur de compte paramétrable »). |
| 10 | Type Détail ou Total, figé après validation | 5 | PARTIEL | Les deux types existent ; le refus de changer de type après création n'a pas été lu. |
| 11 | Intitulé (35 caractères) | 5 | FIDÈLE | Longueur maximale non vérifiée. |
| 12 | Abrégé (17 caractères, classement et recherche) | 5 | ABSENT | Aucun champ sur `Compte`. |
| 13 | Nature du compte déduite du numéro | 5 | FIDÈLE | Sept natures par fourchettes (`NatureCompte`). |
| 14 | Message si la nature du compte est inhabituelle pour le journal (confirmation) | 5 | ABSENT | Aucun contrôle trouvé. |
| 15 | Report à-nouveau : Aucun, Solde, Détail | 6 | FIDÈLE | `ModeReportANouveau`. |
| 16 | Compte reporting | 6 | ABSENT | Déjà noté faute de source (comparaison du 2026-09-25, point 19). |
| 17 | Code taxe par défaut | 6 | FIDÈLE | `tauxTvaDefaut`. |
| 18 | Volet Champs libres (bloc-notes par compte) | 6 | ABSENT | |
| 19 | Grille analytique appliquée au compte | 6 | NON VÉRIFIÉ | Des clés de répartition existent ; leur rattachement à un compte n'a pas été lu. |
| 20 | Saisir dans la devise, devise par défaut du compte | 7 | DIFFÉRENT, À TRIER | Une ligne en devise se saisit sur tout compte (CLAUDE.md F49) ; aucun réglage par compte. |
| 21 | Saisie du compte tiers obligatoire | 7 | DIFFÉRENT, VOULU | Pas d'option ; la saisie refuse le collectif qui porte des comptes de tiers (décision de Manasse du 2026-10-09). |
| 22 | Date d'échéance et mode de règlement obligatoires | 7 | ABSENT | L'échéance d'une ligne reste facultative. |
| 23 | Autoriser le lettrage automatique | 7 | DIFFÉRENT, À TRIER | Un seul réglage, « lettrable », sans distinguer manuel et automatique. |
| 24 | Autoriser la saisie analytique sur le compte | 7 | DIFFÉRENT, À TRIER | Réglée par plan analytique et par classe de comptes, pas par compte. |
| 25 | Mise en sommeil | 7 | FIDÈLE | Confirmation exigée à la saisie. |
| 26 | Comptes tiers rattachés | 7 | FIDÈLE | `TiersCompte`, un principal. |
| 27 | Saut de ligne ou de page à l'impression | 8 | ABSENT | Impression web, sans réglage par compte. |
| 28 | Regroupement mensuel au grand livre | 8 | ABSENT | |
| 29 | Volet Budget du compte général | 8 | ABSENT | Les budgets ne se dotent que par section analytique. |

## Plan tiers (p. 9 à 14)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 30 | Liste des tiers : créer, consulter, modifier, supprimer | 9 | FIDÈLE | Structure réservée à l'administrateur, consultation ouverte (décision du 2026-09-26). |
| 31 | Numéro du tiers unique | 9 | FIDÈLE | Code unique par dossier ; numéro de compte choisi à la création. |
| 32 | Type Client, Fournisseur, Salarié, Autre | 10 | FIDÈLE | Plus Adhérent (SYCEBNL). Type figé après création non vérifié. |
| 33 | Intitulé | 10 | FIDÈLE | |
| 34 | Classement (17 caractères) | 10 | ABSENT | |
| 35 | Compte collectif proposé selon le type, principal automatique | 10 | DIFFÉRENT, VOULU | Compte individuel sous le collectif, et toute la panoplie du type (décisions du 2026-09-25 et du 2026-10-09). |
| 36 | Qualité (société, indépendant…) | 10 | ABSENT | |
| 37 | Contact | 10 | FIDÈLE | Un champ. |
| 38 | Adresse, complément, code postal, ville, région, pays | 10 | PARTIEL | Adresse, boîte postale, ville, pays ; ni complément, ni code postal, ni région. |
| 39 | Téléphone, télécopie, courriel, site (liens cliquables) | 11 | PARTIEL | Téléphone et courriel ; ni télécopie, ni site. |
| 40 | Volet Contacts, nombre illimité | 11 | ABSENT | |
| 41 | Devise du tiers | 12 | ABSENT | La devise se porte par ligne d'écriture, pas par tiers. |
| 42 | Langue | 12 | ABSENT | |
| 43 | Comptes rattachés, un principal | 12 | FIDÈLE | |
| 44 | Raccourci (6 caractères) | 12 | ABSENT | |
| 45 | Lettrage automatique du tiers | 12 | DIFFÉRENT, À TRIER | Porté par le compte, pas par le tiers. |
| 46 | Validation automatique des règlements (fenêtre des échéances) | 12 | ABSENT | Pas de fenêtre multi-échéance en saisie (voir ligne 89). |
| 47 | Hors rappel/relevé | 12 | FIDÈLE | Avec motif et date posée par le serveur, en plus. |
| 48 | Non soumis aux pénalités de retard | 13 | DIFFÉRENT, VOULU | OmegaX ne calcule aucune pénalité de relance (comparaison du 2026-09-25, point 17). |
| 49 | Mise en sommeil du tiers | 13 | FIDÈLE | |
| 50 | Saut de ligne ou de page à l'impression | 13 | ABSENT | |
| 51 | Tiers payeur ou encaisseur | 13 | ABSENT | |
| 52 | Ventilation IFRS | 13 | DIFFÉRENT, VOULU | L'IFRS vit dans des tables à part, jamais dans les écritures (décision du 2026-09-23). |
| 53 | Modèle de règlement : pourcentage, équilibre, montant, délai | 13 | FIDÈLE | `EcheanceReglement`, trois types identiques. |
| 54 | Conditions : jour net, fin de mois civil, fin de mois, jour de tombée | 13 | PARTIEL | « Net » et « fin de mois » seulement ; ni fin de mois civil distincte, ni jour de tombée. |
| 55 | Volet Modèles d'impression du tiers (extrait, règlement, rappel) | 14 | ABSENT | |
| 56 | Volet Cumuls mensuels | 14 | ABSENT | Sur la fiche ; la balance auxiliaire et l'évolution des soldes existent ailleurs. |
| 57 | Informations libres et statistiques | 14 | ABSENT | |
| 58 | Documents liés, commentaire de 69 caractères | 14 | FIDÈLE | `DocumentTiers`, commentaire de 69 caractères, type de fichier contrôlé. |
| 59 | Historique des rappels | 14 | FIDÈLE | Onglet de Rappel et relevé, par compte, pas sur la fiche. |

## Plan analytique (p. 15 à 17)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 60 | Sections : créer, consulter, modifier, supprimer | 15 | FIDÈLE | |
| 61 | Numéro en majuscules, longueur paramétrée | 15 | NON VÉRIFIÉ | |
| 62 | Type Détail ou Total | 15 | FIDÈLE | Le Total ne reçoit ni budget ni ventilation. |
| 63 | Intitulé | 16 | FIDÈLE | |
| 64 | Classement | 16 | ABSENT | |
| 65 | Niveau d'analyse | 16 | ABSENT | |
| 66 | Plusieurs plans analytiques | 16 | FIDÈLE | Plus dates de section et bailleur. |
| 67 | Plan IFRS | 16 | DIFFÉRENT, VOULU | Voir ligne 52. |
| 68 | Saut de ligne ou de page | 16 | ABSENT | |
| 69 | Report à-nouveau de la section | 16 | NON VÉRIFIÉ | |
| 70 | Mise en sommeil de la section | 16 | FIDÈLE | |
| 71 | Budget de section : sens, global, réparti par période | 17 | PARTIEL | Annuel et mensuel ; ni quantité, ni prévision faible ou forte. Sens charge ou produit non vérifié. |
| 72 | Informations libres de la section | 17 | ABSENT | |
| 73 | Cumuls de la section | 17 | DIFFÉRENT, À TRIER | Dans la balance analytique, pas sur la fiche. |

## Codes journaux (p. 18 à 20)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 74 | Code, créer, modifier, supprimer | 18 | FIDÈLE | |
| 75 | Types Achats, Ventes, Trésorerie, Général, Situation | 18 | FIDÈLE | Les cinq. Type figé après création non vérifié. |
| 76 | Curseur placé au débit ou au crédit selon le type et la nature | 18 | ABSENT | |
| 77 | Journal de situation ni clôturable ni compactable | 19 | NON VÉRIFIÉ | |
| 78 | Intitulé | 19 | FIDÈLE | |
| 79 | Numérotation : manuelle, continue par journal, continue pour le fichier, mensuelle | 19 | FIDÈLE | Les quatre modes, et les trous de séquence nommés. |
| 80 | Protection du numéro de pièce | 19 | ABSENT | |
| 81 | Saisie analytique autorisée par journal | 19 | DIFFÉRENT, À TRIER | Réglée par plan et par classe (ligne 24). |
| 82 | Masquer les totaux | 19 | ABSENT | |
| 83 | Journal réservé IFRS | 19 | DIFFÉRENT, VOULU | Voir ligne 52. |
| 84 | Compte de trésorerie du journal | 19 | FIDÈLE | Le compte naît avec le journal (décision du 2026-10-09). |
| 85 | Contrepartie à chaque ligne ou centralisée | 20 | FIDÈLE | |
| 86 | Statut « réglé » posé sur les écritures | 20 | ABSENT | |
| 87 | Mise en sommeil du journal | 20 | FIDÈLE | |

## Saisie des écritures (p. 21 à 24)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 88 | Saisie des écritures et Journaux de saisie | 21 | FIDÈLE | Grille journal par mois, chaque case dans son état. |
| 89 | Fenêtre multi-échéance selon le modèle de règlement | 23 | ABSENT | L'échéance se saisit ligne par ligne. |
| 90 | Tabulation entre zones, Entrée pour valider la ligne | 21 | NON VÉRIFIÉ | |
| 91 | Modifier ou supprimer une écriture non lettrée, non rapprochée, non clôturée | 22 | DIFFÉRENT, VOULU | En plus, seule une écriture au brouillard se modifie (AUDCIF art. 22, 2°). |
| 92 | Appeler un libellé pré-enregistré | 22 | FIDÈLE | |
| 93 | Bouton de saisie analytique | 22 | NON VÉRIFIÉ | La ventilation existe ; sa fenêtre en saisie n'a pas été lue. |
| 94 | Visualiser ou modifier une pièce | 22 | FIDÈLE | Saisie par pièce, Précédent et Suivant. |
| 95 | Interroger le compte général ou tiers depuis la saisie (double-clic) | 22, 26 | ABSENT | Le double-clic n'existe que sur la grille des journaux. |
| 96 | Équilibrer la pièce | 22 | FIDÈLE | Bouton Équilibrer de `SaisiePage.tsx`. |
| 97 | Changer de journal ou de période | 22 | FIDÈLE | |
| 98 | Imprimer le brouillard | 22 | FIDÈLE | État Brouillard. |
| 99 | Ventilation analytique si le journal et le compte l'autorisent | 23 | DIFFÉRENT, À TRIER | Voir ligne 24. |
| 100 | Modifier une ventilation analytique | 24 | NON VÉRIFIÉ | |

## Modèles de saisie (p. 25 et 26)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 101 | Modèle de saisie : reprise, incrément, équilibrage, calcul, fonction | 25 | PARTIEL | Saisir, Répéter, Calculer, Équilibrer ; Incrémenter et Fonction non repris (CLAUDE.md, point 6). |
| 102 | Appel du modèle en saisie | 25 | FIDÈLE | Touche F4. |

## Interrogation et lettrage (p. 26 à 29)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 103 | Gestion des comptes généraux (interroger, lettrer) | 26 | FIDÈLE | Interrogation et lettrage, Analyse des comptes. |
| 104 | Gestion des comptes tiers (interroger, lettrer) | 26 | FIDÈLE | |
| 105 | Pointage dans l'interrogation | 27 | DIFFÉRENT, À TRIER | Le pointage n'existe que dans le rapprochement bancaire. |
| 106 | Prochaine lettre proposée | 27 | FIDÈLE | |
| 107 | Lettrer seulement si le solde est nul | 28 | DIFFÉRENT, VOULU | Le groupe partiel est admis (CLAUDE.md F50). |
| 108 | Délettrer par la lettre | 28 | FIDÈLE | |
| 109 | Extrait de compte tiers imprimé | 29 | NON VÉRIFIÉ | Aucun état nommé « extrait » trouvé ; le grand livre des tiers existe. |
| 110 | Justificatif du solde | 29 | FIDÈLE | État Justificatif de solde. |

## Rappels et relevés (p. 30 et 31)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 111 | Paramétrage des périodes de rappel | 30 | FIDÈLE | Niveaux de relance, jours après échéance. |
| 112 | Sélection et impression des rappels | 30 | FIDÈLE | |
| 113 | Exclure des écritures du circuit de relance | 31 | ABSENT | L'exclusion porte sur le tiers entier. |
| 114 | Envoi des lettres par la messagerie | 31 | FIDÈLE | File des courriers, rien n'est dit envoyé sans transport. |
| 115 | Mise à jour du nombre de relances | 31 | FIDÈLE | Historique des rappels. |
| 116 | Décaler la date d'échéance | 31 | ABSENT | |

## Régularisations (p. 32 à 34)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 117 | Modèles de saisie pour charges et produits constatés d'avance | 32 | DIFFÉRENT, À TRIER | Cinq types de régularisation, sans modèle de saisie. |
| 118 | Marquer une écriture existante et répartir sa charge sur N et N+1 | 33 | DIFFÉRENT, À TRIER | La régularisation se saisit avec sa période ; elle ne part pas d'une écriture marquée. |
| 119 | Génération au 31/12/N et extourne au 01/01/N+1 | 34 | FIDÈLE | Constatation puis reprise à l'ouverture. |

## Règlement des tiers (p. 35 à 37)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 120 | Échéances sélectionnées par critères | 35 | FIDÈLE | |
| 121 | Transmettre les règlements par la messagerie | 35 | ABSENT | |
| 122 | Regrouper plusieurs factures d'un tiers sur un règlement | 36 | FIDÈLE | Une pièce par tiers. |
| 123 | Imprimer la proposition de règlement | 36 | NON VÉRIFIÉ | |
| 124 | Générer les écritures | 36 | FIDÈLE | Lettrage posé aussitôt. |
| 125 | Règlement partiel | 36 | FIDÈLE | Plus que le dû refusé. |
| 126 | Date limite des échéances traitées | 36 | FIDÈLE | Champ « jusqu'au ». |
| 127 | Lettre de règlement ; règlement effectif à l'impression | 37 | DIFFÉRENT, À TRIER | Ordre de virement imprimé et tracé ; l'impression ne conditionne pas la validation. |

## Rapprochement bancaire (p. 38)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 128 | Rapprochement manuel : journal, date, pièce de trésorerie, cocher | 38 | FIDÈLE | Plus import du relevé et correspondances proposées. |
| 129 | Imprimer le rapprochement | 38 | NON VÉRIFIÉ | |

## Écritures d'abonnement (p. 39)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 130 | Modèle d'abonnement appuyé sur un modèle de saisie | 39 | DIFFÉRENT, À TRIER | Le modèle porte lui-même compte au débit, compte au crédit et montant. |
| 131 | Génération des échéances d'abonnement | 39 | FIDÈLE | |

## Impressions (p. 40 à 43)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 132 | Fenêtre de présélection, formats de sélection enregistrés | 40 | ABSENT | Aucun format de sélection enregistré. |
| 133 | Impression dans un fichier | 40 | FIDÈLE | Exports au format tableur. |
| 134 | Grand livre des comptes | 41 | FIDÈLE | |
| 135 | Balance des comptes | 41 | FIDÈLE | |
| 136 | Balance âgée, tranches paramétrables, date de référence | 41 | PARTIEL | Tranches présentes ; leur paramétrage n'a pas été vérifié. |
| 137 | Journal centralisé | 41 | ABSENT | Le mot n'apparaît nulle part dans le code. |
| 138 | Balance des tiers | 41 | FIDÈLE | Balance auxiliaire. |
| 139 | Grand livre des tiers | 41 | FIDÈLE | Présentation des modèles FPM, par famille de tiers. |
| 140 | Statistiques des tiers | 41 | ABSENT | |
| 141 | Journal analytique | 42 | ABSENT | |
| 142 | Balance et grand livre analytiques | 42 | FIDÈLE | |
| 143 | Comparatif multi-exercice | 42 | DIFFÉRENT, À TRIER | États personnalisés sur cinq exercices, évolution des soldes. |
| 144 | Analyse des journaux | 42 | FIDÈLE | Définition d'OmegaX, dite à l'écran. |
| 145 | Palmarès des comptes | 42 | FIDÈLE | Idem. |
| 146 | Tableau de bord personnalisé | 42 | PARTIEL | Tableau de bord et indicateurs ; personnalisation non trouvée. |
| 147 | Contrôle de caisse | 42 | FIDÈLE | Solde de caisse négatif au soir signalé (`controles.service.ts`). |
| 148 | États libres : listes des comptes, tiers, sections | 42 | FIDÈLE | Éditions des structures. |
| 149 | Modèles d'état personnalisés (fichiers) | 43 | DIFFÉRENT, À TRIER | États personnalisés définis dans l'application. |

## Maintenance (p. 44)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 150 | Programme de maintenance du fichier comptable | 44 | DIFFÉRENT, VOULU | En ligne, la base est gérée et sauvegardée chaque nuit ; sur site, sauvegardes et copies avant mise à jour. |

## Bilan du manuel

150 fonctions relevées : 66 FIDÈLE, 11 DIFFÉRENT VOULU, 14 DIFFÉRENT À TRIER,
10 PARTIEL, 39 ABSENT, 10 NON VÉRIFIÉ.

## Ce qui reste à faire sur ce manuel

- Lever les NON VÉRIFIÉ en ouvrant les écrans concernés.
- Manasse trie les ABSENT et les DIFFÉRENT, À TRIER.
