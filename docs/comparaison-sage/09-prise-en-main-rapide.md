# Sage 100 et Sage Paie, Édition pilotée, prise en main rapide · fonction par fonction

Manuel 9 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Sage 100 et Sage Paie, Édition Pilotée, Prise en main rapide »,
Sage, 2011, 50 pages (Drive, id 1AkccBQaOQTaDBZXaAYVkJwT9NG_0SKBZ). Lu en
entier le 2026-10-14 après extraction du texte du PDF. Les 26 pages qui
portent une capture d'écran ont été lues ensuite en image, le même jour :
elles précisent le tableau de bord et ajoutent quatre lignes (section « Vu
sur les captures seulement »). Plusieurs captures ont de petits caractères
ou une liste coupée (p. 7, 11, 14, 16 à 18, 31, 35 à 38, 40) ; rien n'est
tiré de ce qui ne s'y lit pas.

L'Édition pilotée est la couche de pilotage de Sage 100. Elle comprend un
guide interactif, un catalogue d'états, un tableau de bord, une vue
interactive et un simulateur, alimentés par des « cubes » d'analyse. Le
manuel couvre aussi la gestion commerciale, la paie et Multi Devis. Seules
les fonctions qui ont un pendant dans OmegaX ou qui en relèvent sont
comparées. Ce qui ne concerne que la gestion commerciale ou Multi Devis est
noté absent, sans plus.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M1-n » à « M5-n » renvoient aux lignes des autres manuels. Les statuts ont
été lus dans le code le même jour, sur la branche `travail/virement-fonds`,
et aucune ligne n'est restée non vérifiée.

## Le guide interactif (p. 5 à 33)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Guide interactif : point d'entrée unique du pilotage (catalogue, tableau de bord, vue interactive, simulateur, outils) | 7 à 9 | FIDÈLE | L'accueil reprend la fenêtre principale de Sage i7 : barre verticale, onglets Accueil, Favoris et Indicateurs (`AccueilPage.tsx`). |
| 2 | Contenu adapté au métier de l'utilisateur (dirigeant, directeur financier, comptable, gestionnaire de paie) | 10 | FIDÈLE | Accueil par métier (`lib/accueil-par-metier.ts`). |
| 3 | Accès par le groupe « Pilotage » de la barre verticale | 11 | FIDÈLE | Barre verticale de l'accueil. |
| 4 | Accès métier : objectif métier, puis axe d'analyse, puis vue métier, puis état | 12 à 19 | ABSENT | Les états sont rangés dans les menus, par nature (états financiers, contrôle et révision…), et non par objectif métier. |
| 5 | Filtre des états selon le besoin : informer, analyser, anticiper, alerter | 14, 15 | ABSENT | Aucun filtre de ce genre. |
| 6 | Accès direct par domaine : comptabilité générale, analytique, reporting, trésorerie, bilan et compte de résultat | 20 à 25 | PARTIEL | Les menus de la comptabilité générale, de l'analytique, de la trésorerie et des états financiers existent. Pas de reporting (M2-9). |
| 7 | Accès direct en paie : rémunération, présence, absence, formation, carrières, organisation | 20, 24 | PARTIEL | Le module Personnel sert la rémunération, les bulletins et le registre. Ni présence, ni absences, ni formation, ni carrières. |
| 8 | Administration serveur : cubes d'analyse par société, accès, mise à jour des cubes | 26 | DIFFÉRENT, VOULU | Aucun cube : les états sont calculés à la demande sur la base, dont les agrégats font les calculs (`docs/capacite-mesuree.md`). |
| 9 | Administration client : sociétés à piloter, société courante, mode multi-sociétés | 27 | PARTIEL | On passe d'un dossier à l'autre. La vue sur plusieurs sociétés passe par le module groupe (combinaison) et la consolidation SYSCOHADA. Il n'existe pas de pilotage multi-sociétés en dehors d'eux. |
| 10 | Mes favoris : états choisis, thématiques et commentaires personnalisés, partage en réseau | 27 à 29 | PARTIEL | L'onglet Favoris de l'accueil retient des commandes. C'est une préférence du poste : elle n'est pas partagée. |
| 11 | Personnalisation de l'emplacement du catalogue d'états | 29, 30 | ABSENT | Aucun catalogue d'états personnalisable. |
| 12 | Liens vers les autres guides et vers l'outil de requête | 31 | ABSENT | Il n'existe pas d'outil de requête. |
| 13 | Documentation : installation, prise en main, méthode de construction des indicateurs | 31 | PARTIEL | L'aide se donne dans les bulles « ? ». Aucun manuel d'utilisation n'est servi dans l'application. |
| 14 | Bulles d'aide contextuelles | 33 | FIDÈLE | Bulles « ? » (`Aide`). |

## Tableau de bord, vue interactive, simulateur (p. 34 à 42)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 15 | Tableau de bord comptable (chiffre d'affaires, charges, analytique, trésorerie), avec un onglet qui en explique le calcul | 34, 35 | PARTIEL | Le tableau de bord affiche la trésorerie disponible, les produits, les charges, le résultat provisoire et les échéances fiscales. Chaque montant porte sa note de calcul (`DashboardPage.tsx`). Pas d'analytique ni de graphique. La capture de la p. 35 montre en plus la marge, la comparaison à N-1 au mois et en cumul, le suivi par centre de profit et l'équilibre financier (besoin en fonds de roulement, retards de paiement) : rien de cela n'est au tableau de bord. |
| 16 | Vue interactive : indicateurs suivis par exercice, en cumul ou par mois, sur cinq années, avec leur contribution au résultat | 35, 36 | PARTIEL | Les états personnalisés donnent un historique sur cinq exercices (`moteur-etat-personnalise.ts`). Il n'y a pas de vue animée, et rien au mois. |
| 17 | Vue interactive et simulateur de la gestion commerciale (chiffre d'affaires et marge par catégorie, famille, représentant) | 37, 40, 41 | ABSENT | OmegaX ne tient pas de gestion commerciale. |
| 18 | Simulateur comptable : croissance du chiffre d'affaires, poids des charges, compte d'exploitation simulé, réalisé comparé à l'hypothèse, jauge de couleur, simulations enregistrées, chargées ou supprimées, par période ou par hypothèse | 38, 39 | FIDÈLE | Simulateur budgétaire (`simulations/simulateur-budgetaire.ts`, `SimulationBudgetaire`) : produits selon la croissance, charges au réalisé tant qu'aucun taux n'est déclaré, prévu au prorata des jours jusqu'à la date d'arrêté, seuils de couleur, simulations enregistrées, modifiées ou supprimées. |
| 19 | Mise à jour des données des cubes, du tableau de bord, de la vue et du simulateur | 41, 42 | DIFFÉRENT, VOULU | Il n'y a rien à mettre à jour : chaque état lit la base au moment où on l'ouvre. |

## Le catalogue d'états (p. 43 à 48)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 20 | Présentation commune des états : raison sociale, objectif, axe, titre ; onglets ; textes, tableaux et graphiques | 44 | PARTIEL | En-tête d'impression commun (`EnteteImpression.tsx`). Aucun graphique. |
| 21 | Rafraîchissement d'un état avec saisie des valeurs demandées | 45 | FIDÈLE | Chaque état est calculé à la demande, pour l'exercice ou la date choisis. |
| 22 | Enregistrement d'un état, aux formats HTML et PDF compris | 46 | PARTIEL | Les états s'exportent en Excel, et en PDF par l'impression du navigateur. Ils ne s'enregistrent pas dans l'application. |
| 23 | Impression | 47 | FIDÈLE | Impression de la fenêtre (voir M1-109). |
| 24 | Création et personnalisation d'états : requêtes, sources combinées, ruptures, formules, graphiques, exploration, mise en forme | 48 | PARTIEL | Les états personnalisés se définissent par lignes de comptes et totaux (`etats-personnalises/`). Ils n'ont ni requêtes, ni graphiques, ni exploration. |

## Vu sur les captures seulement

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 25 | Catalogue comptable : soldes intermédiaires de gestion (mensuels, sur trois périodes, multi-sociétés), évolution des charges sur cinq ans, rentabilité par section analytique | 14, 16, 22 | PARTIEL | Le compte de résultat SYSCOHADA porte la cascade des soldes (AUDCIF art. 31) ; l'évolution des soldes et les états personnalisés couvrent cinq exercices. Rien au mois, sur trois périodes ni par section. |
| 26 | Axes d'alerte : évolutions anormales des postes de charges et de produits, décroissance d'activité, dégradation de rentabilité, rentabilité négative | 14, 16 | ABSENT | Aucun signalement d'évolution anormale ; l'évolution des soldes se lit sans seuil. |
| 27 | Comparaison de deux périodes choisies, compte par compte, avec écart et pourcentage ; onglets diminution, augmentation, stabilité | 44, 45 | PARTIEL | La colonne N-1 des états et les états personnalisés comparent des exercices entiers (`moteur-etat-personnalise.ts`) ; pas deux périodes libres. |
| 28 | Personnalisation des indicateurs clés | 28, 32, 33 | ABSENT | L'onglet Indicateurs de l'accueil rend une liste fixe (`AccueilPage.tsx`). |

## Bilan du manuel

28 fonctions relevées : 7 FIDÈLE, 2 DIFFÉRENT VOULU, 0 DIFFÉRENT À TRIER,
12 PARTIEL, 7 ABSENT, 0 NON VÉRIFIÉ.

Le simulateur comptable a son équivalent fidèle. OmegaX n'a pas de cube : ses
états se calculent en direct sur la base. Les manques portent sur la
présentation : classement des états par objectif métier, graphiques, vue
animée des indicateurs, outil de requête. Les captures y ajoutent les alertes
sur les évolutions anormales et les indicateurs personnalisables.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT.
