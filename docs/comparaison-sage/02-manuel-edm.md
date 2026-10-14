# Sage 100 Comptabilité i7, manuel EDM · fonction par fonction

Manuel 2 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Guide d'utilisation de la comptabilité sur le logiciel Sage
Comptabilité i7 », Enfants Du Monde (E.D.M), cabinet MICROFA, juin 2023,
60 pages (Drive, id 1AE7nAaoL09lXvIQQHhue_Sh0bFvfnIAk), lu en entier le
2026-10-14. C'est le manuel d'une ONG · il montre Sage paramétré pour un
projet (plan analytique PROJETS, budget par section, journaux de situation
pour les engagements).

Les captures d'écran de ce manuel n'ont pas pu être lues : le fichier
dépasse la limite de téléchargement de Drive (10 Mo), et l'outil de lecture
de Drive ne rend que le texte. Les lignes ci-dessous viennent du seul texte
(constat du 2026-10-14, cascade des captures).

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
Seules sont reprises ici les fonctions que le manuel 1 ne décrit pas, ou que
l'EDM décrit plus finement ; un renvoi « M1-n » désigne la ligne n du
manuel 1. Statuts lus dans le code le même jour.

## Création du fichier et paramètres (p. 3 à 12)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Assistant de création d'un fichier : raison sociale, coordonnées, dates du premier exercice, longueur des comptes | 4, 5 | DIFFÉRENT, VOULU | Un dossier naît depuis la console VMG ; inscription publique fermée (CLAUDE.md § 8). |
| 2 | Natures de compte et leurs fourchettes, adaptées au SYSCOHADA (banque 52, caisse 57, résultat 13) | 8, 9 | FIDÈLE | Sept natures à fourchettes, défauts repris des deux plans semés. |
| 3 | Numérotation automatique des tiers par type : longueur, racine (411, 401, 421) | 9, 10 | DIFFÉRENT, VOULU | Numéro proposé sous la racine du collectif, modifiable à la création (décision du 2026-10-09). |
| 4 | Compte collectif choisi par type de tiers dans les paramètres | 10 | DIFFÉRENT, VOULU | Collectifs fixés par référentiel (`collectifs-tiers.ts`, décision de Manasse). |
| 5 | Jusqu'à dix plans analytiques, renommables | 3, 11 | FIDÈLE | Plans analytiques, sans plafond lu. |
| 6 | Option « Gérer les budgets sur les sections analytiques » | 11 | FIDÈLE | `PlanAnalytique.gererBudgets`. |
| 7 | Suivi budgétaire sur l'axe général ou sur l'axe analytique | 3 | PARTIEL | Axe analytique seulement (voir M1-29). |
| 8 | Mode assistant (création guidée d'un compte, d'un journal, de la clôture) | 13, 20, 53 | ABSENT | Déjà noté le 2026-09-25. |
| 9 | Plan reporting parmi les éléments de structure | 12 | ABSENT | Voir M1-16. |

## Structure : comptes, tiers, journaux, sections (p. 12 à 26)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 10 | Numéro de compte non modifiable après création | 15 | FIDÈLE | Absent du DTO de modification. |
| 11 | Type de compte non modifiable après création | 15 | DIFFÉRENT, À TRIER | Voir M1-10. |
| 12 | Suppression refusée si le compte a des écritures, un journal, un tiers ou un taux | 15 | FIDÈLE | Toutes les références comptées, lues dans le schéma. |
| 13 | Imprimer la liste des comptes avec un filtre (numéros de 6 à 69) | 15, 16 | PARTIEL | Liste à plat, complète ou sélection ; le classement par classe (1 à 9) donne la classe 6, sans fourchette de numéros libre. |
| 14 | Aperçu, impression PDF, impression dans un classeur Excel | 17 | PARTIEL | Impression du navigateur (PDF) ; classeur Excel pour les états, pas pour les listes de structures. |
| 15 | Liste des tiers filtrée par type | 18 | FIDÈLE | Filtre de gauche de `TiersPage.tsx`. |
| 16 | Création d'un journal : répartition analytique « Oui » | 21 | DIFFÉRENT, À TRIER | Voir M1-81. |
| 17 | Journal de trésorerie : contrepartie des règlements, « Rapprochement sur » trésorerie ou contrepartie | 22, 23 | PARTIEL | Le rapprochement porte sur le compte de trésorerie ; l'option « sur la contrepartie » n'existe pas. |
| 18 | Section : numéro, type Détail ou Total, intitulé | 25 | FIDÈLE | |
| 19 | Dotation annuelle d'une section répartie également sur les mois, période modifiable | 26 | PARTIEL | Dotation annuelle et dotations mensuelles saisies ; aucune répartition automatique en parts égales trouvée. |

## Saisie (p. 26 à 29)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 20 | Jour seul dans la colonne date (mois et exercice fixés par le journal ouvert) | 28 | FIDÈLE | Grille ouverte sur un journal et un mois. |
| 21 | Numéro de facture et référence de pièce dans deux colonnes | 28 | PARTIEL | Une seule zone « référence » (pièce justificative). |
| 22 | F4 ouvre la liste des comptes, filtrée par le début du numéro tapé | 28 | FIDÈLE | `SaisiePage.tsx`, F4 et filtre. |
| 23 | Compte tiers saisi à côté du compte collectif | 28 | DIFFÉRENT, VOULU | Le tiers a son compte individuel ; le collectif est refusé en saisie (décision du 2026-10-09). |
| 24 | Ligne budgétaire et code projet, actifs sur les classes 2, 6 et 7 | 28, 29 | FIDÈLE | Une colonne par axe, classes ventilées réglées par plan. |
| 25 | Date d'échéance proposée égale à la date de la pièce | 29 | DIFFÉRENT, À TRIER | La zone d'échéance part vide (`SaisiePage.tsx`). |
| 26 | Colonne « Position du journal » (clôturé, édité) sur chaque ligne | 29 | PARTIEL | L'état se lit sur la grille des journaux de saisie, pas sur la ligne. |

## États de la comptabilité générale (p. 29 à 36)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 27 | Journal : base, développé tiers, développé devise ; tri par date ou par pièce | 29, 30 | PARTIEL | Journal et son export ; présentations développées non comparées une à une. |
| 28 | Journal général : synthèse des mouvements par journal et par période | 29 | ABSENT | |
| 29 | Inclure ou non les journaux de situation (engagements) dans les états | 31 | DIFFÉRENT, À TRIER | Les engagements vivent dans un registre à part, hors journaux. |
| 30 | Grand livre complet, général (tiers totalisés), clients, fournisseurs | 31, 32 | PARTIEL | Complet et grand livre des tiers par famille ; pas de « général » qui totalise les tiers. |
| 31 | Grand livre en devise (montants en devise) | 31, 33 | ABSENT | |
| 32 | Grand livre filtré par dates, comptes de/à, journaux de/à | 32 | PARTIEL | L'exercice entier, ou un seul compte ; ni fourchette de dates, ni de comptes, ni de journaux (`export.controller.ts`). |
| 33 | Grand livre « développé paramétrable » (colonnes au choix) | 32, 33 | ABSENT | Présentation FPM fixe ou livre à plat. |
| 34 | Modèle d'édition standard ou personnalisé | 33 | ABSENT | Voir M1-149. |
| 35 | Imprimer ou non les écritures lettrées | 33 | ABSENT | |
| 36 | Ruptures « période antérieure » au grand livre | 33 | FIDÈLE | « Mouvements au » la veille, puis la période (présentation FPM). |
| 37 | Sous-totaux par classe et sous-classe | 33 | PARTIEL | Totaux par classe et par division ; niveau non réglable. |
| 38 | Cumuls des reports à-nouveaux imprimés | 34 | FIDÈLE | |
| 39 | Balance complète, générale (tiers regroupés), clients, fournisseurs, auxiliaire | 34, 35 | FIDÈLE | Balance générale qui fond les comptes de tiers sur leur collectif, balance auxiliaire par famille. |
| 40 | Balance en devise et balance bi-devises | 34, 35 | DIFFÉRENT, VOULU | Balance en monnaie fonctionnelle, second jeu sans valeur légale (CLAUDE.md, M2). |
| 41 | Balance 4, 6 ou 8 colonnes, « développée » avec période comparée | 35 | PARTIEL | Report, mouvements et soldes ; pas de choix du nombre de colonnes ni de période comparée. |
| 42 | Niveau de sous-totaux de 0 à 13 | 36 | PARTIEL | Voir ligne 37. |

## États des tiers (p. 36 à 40)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 43 | Grand livre des tiers par type, comptes de/à, journaux, présentations | 36 à 38 | PARTIEL | Par famille de tiers, un classeur par famille ; plages de comptes non vérifiées. |
| 44 | Balance des tiers : base, développée, 6 ou 8 colonnes | 38, 39 | PARTIEL | Balance auxiliaire ; présentations non comparées une à une. |
| 45 | Balance des tiers : tous, mouvementés, non soldés, soldés | 40 | ABSENT | Aucun de ces filtres trouvé. |

## États analytiques et budgétaires (p. 40 à 49)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 46 | Journal analytique (toutes écritures, ou reports et OD analytiques) | 40, 41 | ABSENT | Voir M1-141. |
| 47 | Balance analytique classique, sur ruptures, inversée (compte puis section) | 42 à 44 | PARTIEL | Balance analytique ; ni ruptures ni présentation inversée. |
| 48 | Balance analytique : sections toutes, mouvementées, non soldées | 43 | ABSENT | Filtres servis : plan, exercice, dates seulement. |
| 49 | Quantités, prix moyen par poste | 44 | ABSENT | |
| 50 | Grand livre analytique, base et inversé | 44, 45 | PARTIEL | Grand livre analytique ; pas de présentation inversée. |
| 51 | Grand livre analytique avec les écritures générales non ventilées | 45 | ABSENT | |
| 52 | État de contrôle des cumuls (général contre analytique, écarts) | 45, 46 | FIDÈLE | Onglet « contrôle » de `EtatsAnalytiquesPage.tsx`. |
| 53 | État budgétaire : réalisé contre budget par section | 46, 47 | FIDÈLE | Onglet « budgétaire » ; tableau officiel d'exécution des projets. |
| 54 | Prévision faible ou forte | 47 | ABSENT | Voir M1-71. |
| 55 | Budgets totalisateurs imprimés | 48 | FIDÈLE | Rubriques budgétaires qui agrègent leurs sections. |
| 56 | Comptes ou sections non budgétisés mais mouvementés | 48 | FIDÈLE | « Hors budget ». |
| 57 | Comparaison avec la réalisation de l'exercice précédent | 48 | ABSENT | |
| 58 | Filtre par norme (nationale, IFRS) | 49 | DIFFÉRENT, VOULU | Voir M1-52. |
| 59 | Devise d'édition des états budgétaires | 49 | ABSENT | Monnaie de tenue seule. |

## Rapprochement bancaire (p. 49 à 53)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 60 | Écritures non rapprochées, rapprochées, toutes | 51 | ABSENT | Aucun de ces filtres trouvé. |
| 61 | Sélection croisée par date, pièce, comptes, montants | 51 | DIFFÉRENT, À TRIER | Correspondances proposées depuis le relevé importé, au montant exact. |
| 62 | Solde de la pièce, cumul non rapproché, solde théorique du relevé | 51 | DIFFÉRENT, À TRIER | Solde de départ déclaré et solde imprimé du relevé ; l'écart est dit. |
| 63 | Pointer par clic droit, « Pointer les éléments sélectionnés » | 52 | DIFFÉRENT, À TRIER | Cases à cocher, sans menu contextuel. |
| 64 | État de rapprochement : rapprochées et non rapprochées, solde progressif | 52, 53 | DIFFÉRENT, À TRIER | Voir M1-129. |

## Clôture et nouvel exercice (p. 53 à 59)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 65 | Clôture partielle, totale, période | 53 | FIDÈLE | |
| 66 | Clôture partielle : journaux choisis, date limite, lettrage et analytique encore possibles | 54 | FIDÈLE | La partielle ne fige rien. |
| 67 | Édition des journaux clôturés ; refus de clôturer un journal non imprimé | 54, 56 | ABSENT | OmegaX ne trace pas l'impression (déjà noté le 2026-09-25). |
| 68 | Après clôture totale : libellé, échéance, mode de règlement et ventilation encore modifiables | 55 | DIFFÉRENT, À TRIER | La clôture totale fige aussi lettrage et analytique (point 12) ; l'EDM dit le contraire pour l'analytique. |
| 69 | Clôture de période valable pour tous les journaux, même créés après | 56 | FIDÈLE | `gel-cloture.ts` : la période close vaut pour tous les journaux. |
| 70 | Journal de situation non clôturable | 56 | ABSENT | Voir M1-77. |
| 71 | Refus de clôturer un journal de caisse créditeur un jour de la période | 56 | PARTIEL | La caisse créditrice est signalée par un contrôle (M1-147) ; elle ne bloque pas la clôture. |
| 72 | Nouvel exercice sans reports | 57 | FIDÈLE | Création d'un exercice par ses dates, le report provisoire étant un geste à part. |
| 73 | Nouvel exercice avec génération des reports | 57 à 59 | DIFFÉRENT, VOULU | À-nouveaux provisoires, jamais validés, remplacés par le report définitif à la clôture (point 11). |
| 74 | Fenêtre d'équilibre : choix du compte qui reçoit le résultat | 59 | DIFFÉRENT, VOULU | Le résultat va au 13 du plan OHADA, sans choix. |
| 75 | Maintenance après une coupure (« fichier en cours d'utilisation ») | 59, 60 | DIFFÉRENT, VOULU | Voir M1-150. |

## Bilan du manuel

75 fonctions relevées en plus du manuel 1 : 21 FIDÈLE, 9 DIFFÉRENT
VOULU, 9 DIFFÉRENT À TRIER, 18 PARTIEL, 18 ABSENT, 0 NON VÉRIFIÉ.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et les DIFFÉRENT, À TRIER.
