# Sage ERP X3, outils communs · fonction par fonction

Manuel 8 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Sage ERP X3, Outils communs, support de formation », Sage, 2011,
environ 200 pages (Drive, id 1oD33tDi1Y5FrPqUzWFsGhpOiqFbOoCm0). Le fichier
pèse 7,5 Mo ; son téléchargement a fait tomber la connexion à Drive, et le
texte n'a pu être lu que par l'outil de lecture de Drive, qui le rend
jusqu'à la page 81. Le sommaire est lu en entier, le corps des pages 4 à 81
aussi (chapitres 1 à 3 et début du chapitre 4). Les chapitres 4.3 à 13 ne
sont connus que par leurs titres : ils sont comparés à part, sur l'intitulé
seul, et c'est dit sur chaque ligne. Le texte extrait est brouillé par
endroits (pages 28 à 31, 41 et 42, numéros de page du sommaire). Faute de
téléchargement, les captures d'écran n'ont pas pu être lues (constat du
2026-10-14, cascade des captures).

Sage X3 est un progiciel de gestion intégré qui se paramètre et se
développe : dictionnaire des tables, écrans, objets, fenêtres, formules,
codes activité, dossiers hérités les uns des autres. OmegaX n'est pas une
plateforme de développement : son schéma, ses écrans et ses règles sont
écrits dans le dépôt et versionnés, et le cabinet ne les modifie pas. Une
grande partie de ce manuel est donc sans équivalent voulu.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M6 » et « M9 » renvoient aux lignes des manuels Structure des fichiers et
Prise en main rapide. Les statuts ont été lus dans le code le même jour, sur
la branche `travail/virement-fonds`, et aucune ligne n'est restée non
vérifiée.

## Ergonomie (p. 4 à 15, 43, 44)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Contrôles de saisie : format, champ obligatoire coloré, refus de passer à la zone suivante si la précédente est fausse | 4 | PARTIEL | Les refus sont posés par le serveur et affichés avec leur motif ; aucune coloration propre aux champs obligatoires n'a été relevée. |
| 2 | Menu contextuel du champ (clic droit ou F4) : sélections, propriétés, aide sur le champ | 4, 5 | PARTIEL | Bulle d'aide « ? » par cadre ; pas de menu contextuel par champ. F4 appelle les modèles de saisie. |
| 3 | Tunnel (F9) : ouvrir la fiche liée sans quitter la fonction | 5, 7 | PARTIEL | Quelques passages directs, par exemple le double-clic d'une ligne de balance qui ouvre le grand livre du compte. Pas de tunnel général. |
| 4 | Liste de sélection d'une valeur (F12), recherche dès quelques caractères | 5, 6, 61 | PARTIEL | Listes de choix servies par le serveur (comptes, tiers, journaux) et recherche dans les listes. Pas de touche dédiée. |
| 5 | Disposition de la fenêtre : liste gauche, en-tête, onglets, tableau, zone d'information, tiroirs, explorateur de liens | 6 à 11 | DIFFÉRENT, VOULU | La disposition suit Sage 100 i7 et le rendu de Sage Active (CLAUDE.md, § 9 ter) : barre verticale, fenêtres, onglets, barre d'état. |
| 6 | Raccourcis d'aide (F1 et ses variantes), F5 rafraîchir, F6 caractéristiques du champ | 7 | PARTIEL | Aide par la bulle « ? » ; Échap ferme la couche la plus haute (`lib/echap.ts`). Pas de touche d'aide ni d'inspection de champ. |
| 7 | F7, aller à une fonction par son nom | 7, 15 | ABSENT | Aucune recherche de commande par son nom. |
| 8 | Calculatrice (Ctrl+Alt+K) | 7 | FIDÈLE | Calculette (`components/Calculette.tsx`). |
| 9 | Barre d'outils : workflow, fiche en consultation ou verrouillée par un autre utilisateur, pièce jointe, sélection mémorisée, impression et courriel, commentaire, session secondaire | 12 | PARTIEL | Impression de la fenêtre ; un geste concurrent sur certains modules reçoit un 409 qui dit le geste en cours. Ni workflow, ni verrou de fiche, ni commentaire. |
| 10 | Favoris par utilisateur, étoile du chemin d'accès | 10, 15 | FIDÈLE | Onglet Favoris de l'accueil, préférence du poste (voir M9, ligne 10). |
| 11 | Arborescence de menus qui dépend des droits de l'utilisateur | 9, 14 | FIDÈLE | Menus filtrés par profil (`lib/profil-dossier.ts`), le serveur gardant seul les droits. |
| 12 | Sociétés, sites et regroupements qui filtrent habilitations et données | 43 | PARTIEL | Un dossier par entité, cloisonné ; un groupe lit ses cellules (`perimetreDeGroupe`). Pas de site. |
| 13 | Aide en ligne en HTML ou en fichier chm, aides reliées par liens | 44 | PARTIEL | Bulles d'aide ; aucun manuel servi dans l'application (voir M9, ligne 13). |

## Dossiers (p. 15 à 43)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 14 | Gestion des dossiers : un dossier par code, avec ses paramètres, ses règles et ses données, ses répertoires et son utilisateur de base | 15 à 17, 19 | DIFFÉRENT, VOULU | Un dossier est une ligne `Tenant` cloisonnée dans une base commune. Il naît par la console ou par le siège d'un groupe, avec le plan, les journaux et les taux de son référentiel. |
| 15 | Dossier de référence, héritage à la création et à l'exécution, architecture à deux ou trois niveaux, revalidation | 17 à 19 | DIFFÉRENT, VOULU | Aucun héritage entre dossiers : le schéma est commun et migré par le serveur (`prisma/migrations`). |
| 16 | Dossiers standards : X3 (référence), DEMO, SERVX3 | 19 | FIDÈLE | Dossiers de démonstration, une association au SYCEBNL et une SARL au SYSCOHADA (`plateforme/scenario-demonstration.ts`). |
| 17 | Fiche dossier, onglet Général : type de base, volume, taille, format, groupe de fichiers, codage, taille des images et des textes | 19 à 21 | DIFFÉRENT, VOULU | L'hébergement est géré : PostgreSQL en ligne, ou installé sur le poste serveur du client (`installation/`). |
| 18 | Tableau des modules actifs du dossier | 20 | FIDÈLE | Modules activables par dossier (`tenant/modules-optionnels.ts`). |
| 19 | Dossier de copie : données reprises d'un autre dossier à la création | 20, 25 | ABSENT | Une cellule prend le référentiel du siège, pas ses données. |
| 20 | Dossier historique : données figées transférées avant épuration | 17, 20, 33 | DIFFÉRENT, VOULU | Tous les exercices restent dans le dossier, clôturés ; rien n'est épuré (conservation de dix ans, AUDCIF art. 24). |
| 21 | Date de début du premier exercice, figée à la création | 20 | DIFFÉRENT, VOULU | Les exercices se créent un à un, sans chevauchement (CLAUDE.md, § 10 bis), le premier pouvant être long (AUDCIF art. 7). |
| 22 | Dossier test (patchs installés directement), dossier spécifique | 20 | DIFFÉRENT, VOULU | Une seule version déployée par la chaîne de livraison ; en installation sur site, un paquet par version. |
| 23 | Codes activité : options, localisations par législation (France, Espagne, Italie…), spécifiques, dimensionnement | 21 à 26 | DIFFÉRENT, VOULU | Un seul pays. Le référentiel du dossier (SYCEBNL ou SYSCOHADA) aiguille plans, états et contrôles, au client et au serveur. |
| 24 | Codes et formules de dimensionnement des champs, des tableaux et des tables | 22 à 24 | DIFFÉRENT, VOULU | Aucun dimensionnement à régler. |
| 25 | Langues d'accès et langue par défaut | 25 | ABSENT | L'application est en français seulement. |
| 26 | Devise de reporting commune aux sociétés du dossier | 25 | DIFFÉRENT, VOULU | La monnaie de tenue est fixée par la loi ; la monnaie fonctionnelle donne un second jeu de documents sans valeur légale (voir M6, ligne 10). |
| 27 | Liens vers d'autres dossiers ou d'autres solutions : lecture ou écriture des tables d'un autre dossier, lien comptable, test et activation du lien | 28, 29 | PARTIEL | Le siège d'un groupe lit ses cellules et y fait naître les écritures de liaison ; rien d'autre ne lit un autre dossier. |
| 28 | Fichiers et tables de paramètres techniques (param.ini, APL.ini, Solution.xml, X3APPLI.ini, ADOSSIER, ADOPAR, ADOSDIM, ADOSACT) | 26 à 32 | DIFFÉRENT, VOULU | Configuration posée par le déploiement, jamais par l'utilisateur. |
| 29 | Déverrouillage d'un dossier après une validation interrompue | 30 | DIFFÉRENT, VOULU | Les verrous de geste ont une échéance qui reprend la ligne d'un processus tombé (`VerrouProvisionChange`, `VerrouCreancesDouteuses`). |
| 30 | Remise à zéro des mouvements d'un dossier de test | 31 | ABSENT | |
| 31 | Extraction et intégration de données, import d'un dossier, console d'import | 31 à 38 | PARTIEL | Restitution du dossier en archive CSV (M6, ligne 1), sauvegarde chiffrée de la base chaque nuit avec restauration de contrôle, copies avant chaque mise à jour sur site. Pas d'intégration d'un dossier extrait. |
| 32 | Extraction envoyée à l'assistance pour analyse | 34 | DIFFÉRENT, VOULU | VMG ne voit jamais les données d'un client (CLAUDE.md, § 8). |
| 33 | Architecture : serveurs de données, d'application et de traitements, présentation Windows ou web, impression, documentation, multi-tiers et BI | 39 à 43 | DIFFÉRENT, VOULU | Application web servie par Cloud Run sur une base Neon, ou installée sur un poste serveur Windows ; aucun entrepôt BI. |
| 34 | Arborescence de la solution (écrans, tables, menus, traces, traitements, publication) | 40, 41 | DIFFÉRENT, VOULU | Sans objet : rien n'est généré sur le serveur par dossier. |

## Conception d'un objet (p. 45 à 70)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 35 | Dictionnaire des tables : code, champs, types, intitulés, index, table liée, limites ; validation, remise à zéro, suppression | 45 à 52 | DIFFÉRENT, VOULU | Le schéma est écrit dans le dépôt, migrations comprises, et contrôlé par les tests ; le cabinet ne crée ni ne modifie de table. |
| 36 | Trace d'audit des créations, modifications et suppressions | 51 | FIDÈLE | Journal d'audit posé sur le client de la base, chaque événement chaîné au précédent par son empreinte (`common/audit/`). |
| 37 | Champs de date et d'utilisateur de création et de modification tenus d'office | 51 | FIDÈLE | Dates et auteurs de saisie et de validation sur les écritures, restitués au journal exporté (CLAUDE.md, § 10 ter). |
| 38 | Numéro d'export : seuls les enregistrements créés ou modifiés depuis le dernier export partent | 51, 52 | ABSENT | Les exports sont complets à chaque fois. |
| 39 | Dictionnaire des écrans : blocs, zones, champs, obligatoire, tunnel, traitements générés | 53 à 58 | DIFFÉRENT, VOULU | Écrans écrits dans le dépôt. |
| 40 | Personnalisation des écrans et des objets par le client sans code activité | 57, 63, 64 | ABSENT | Aucun écran ne se personnalise. |
| 41 | Objets (simple, tableau, combiné, browser) : code d'accès, zone site, suppression différée, import, statistiques ; vues ; validation | 59 à 64 | DIFFÉRENT, VOULU | Sans objet : modules écrits dans le dépôt. |
| 42 | Sélections : options de filtre, index de parcours, liste hiérarchisée, colonnes de liste calculées, recherche | 61, 62 | PARTIEL | Filtres et recherche par écran (par exemple la recherche d'écritures) ; aucune colonne ne se paramètre (M6, ligne 18). |
| 43 | Fenêtres : écrans, boutons et menus, listes gauches, derniers lus, préchargement, validation | 65 à 70 | DIFFÉRENT, VOULU | Fenêtres écrites dans le dépôt. |

## Formules (p. 70 à 79)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 44 | Formules : constantes, opérateurs, variables de fiche, d'écran et globales, fonctions numériques, de date, de chaîne, agrégatives, sous-programmes | 70 à 79 | PARTIEL | Pas de langage de formule. Les états personnalisés lisent des racines de comptes avec exclusion et des totaux de lignes précédentes (`etats-personnalises/moteur-etat-personnalise.ts`) ; les modèles de saisie ont quatre fonctions. |
| 45 | Éditeur et assistant de formules, analyse de la formule et des messages | 72 à 75 | ABSENT | |

## Utilisateurs (p. 79 à 81)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 46 | Quatre concepts : paramètres utilisateur, profils fonction (sites, sociétés, lecture, écriture, exécution), codes d'accès (transactions, champs, filtres), rôles | 79 | PARTIEL | Cinq rôles, profil de fonctions et journaux autorisés par utilisateur ; la restriction porte sur ce qui écrit, jamais sur la lecture. Pas de code d'accès par champ. |
| 47 | Fiche utilisateur : code de connexion, mot de passe obligatoire, longueur minimale, changement à intervalles réguliers | 79 | DIFFÉRENT, À TRIER | Connexion par l'adresse de courriel, dix caractères au moins, verrouillage par compte, double authentification. Aucun renouvellement périodique imposé : même point que M6, ligne 34. |
| 48 | Utilisateur ADMIN aux droits complets, super-administrateur | 79 | DIFFÉRENT, VOULU | Administrateur du dossier. L'opérateur de la plateforme ouvre la console, jamais les données d'un cabinet. |
| 49 | Connexion interdite, momentanément ou définitivement | 81 | FIDÈLE | Compte désactivé (`User.estActif`) ; verrouillage temporaire après échecs, jamais définitif (`auth/verrouillage.ts`). |
| 50 | Profils de menu et de fonction de l'utilisateur, destination d'impression, filtre des fiches utilisateurs | 81 | PARTIEL | Menus par profil du dossier et profil de fonctions. Pas de destination d'impression. |
| 51 | Paramètres de niveau utilisateur, hérités d'un niveau supérieur | 81 | PARTIEL | Le choix d'exercice et les favoris sont des préférences du poste. Les paramètres eux-mêmes ne sont pas nommés dans le texte extrait. |

## Chapitres connus par leur titre seul (p. 82 et suivantes)

Le corps de ces chapitres n'a pas été lu. La comparaison porte sur
l'intitulé du sommaire.

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 52 | Profils de menu, habilitations fonctionnelles, codes d'accès et leur affectation aux écrans, rôles qui filtrent les données (titres 4.3 à 4.10) | sommaire | PARTIEL | Voir ligne 46. |
| 53 | Gestion des mots de passe (titre 4.11) | sommaire | DIFFÉRENT, À TRIER | Voir ligne 47. |
| 54 | Paramètres généraux (titre 5.1) | sommaire | PARTIEL | Paramètres du dossier (référentiel, longueur des comptes, TVA, méthodes déclarées), sans hiérarchie de niveaux. |
| 55 | Compteurs (titre 5.3) | sommaire | PARTIEL | Numérotation des pièces par journal, des bulletins, des ordres de virement ; formats non paramétrables. |
| 56 | Paramétrage des fonctions : propriétés des objets, transactions de saisie, écrans de consultation, paramétrage générique des écrans, styles (titres 6.1 à 6.7) | sommaire | ABSENT | Aucune variante d'écran ni de style se paramètre. |
| 57 | Sélections mémorisées (titre 7.1) | sommaire | ABSENT | Seul le choix de l'exercice est retenu, par dossier. |
| 58 | Pièces jointes (chapitre 7) | sommaire | PARTIEL | Documents des tiers et pièces des virements de fonds seulement (M6, ligne 74). |
| 59 | Requêteur : structure des tables, requêteur graphique, requêteur SQL, consultation des résultats (chapitre 8) | sommaire | ABSENT | Voir M9, ligne 12. |
| 60 | Statistiques : gestion, déclencheurs, paramètres (chapitre 9) | sommaire | ABSENT | |
| 61 | Workflow de notification : principes, codes activité, moniteur et plans de travail (chapitre 10) | sommaire | ABSENT | Le courrier ne part que pour les relances, les factures de l'éditeur et les avis de sécurité ; aucune règle de notification ne se paramètre. |
| 62 | Imports et exports : modèles, paramètres, imports chronologiques, enchaînements (chapitre 11) | sommaire | PARTIEL | Import du plan, d'une balance ou d'écritures avec correspondance des colonnes ; exports en Excel. Ni modèles enregistrés, ni enchaînements. |
| 63 | Portail : pages, familles, vues, vignettes (chapitre 12) | sommaire | PARTIEL | Accueil à trois onglets (Accueil, Favoris, Indicateurs) et tableau de bord, sans vignette paramétrable. |
| 64 | Processus : éditeur et menu des processus (chapitre 13) | sommaire | PARTIEL | Démarrage guidé d'un dossier sans écriture (`lib/demarrage-guide.ts`) et accueil par métier ; pas d'éditeur de processus. |

## Bilan du manuel

64 fonctions relevées : 8 FIDÈLE, 20 DIFFÉRENT VOULU, 2 DIFFÉRENT À TRIER,
22 PARTIEL, 12 ABSENT, 0 NON VÉRIFIÉ.

Sage X3 est un outil qui se paramètre et se programme ; OmegaX n'en reprend
pas le principe. Les points qui restent utiles pour un cabinet sont
l'audit, les droits et les sauvegardes, déjà tenus. Les absences qui
comptent sont la recherche d'une commande par son nom, le requêteur, les
sélections mémorisées et le workflow de notification.

## Ce qui reste à faire sur ce manuel

- Lire les chapitres 4.3 à 13 dans le PDF, découpé en morceaux de moins de
  10 Mo, pour remplacer les lignes 52 à 64, comparées sur leur titre.
- Manasse trie les ABSENT et tranche le renouvellement des mots de passe
  (lignes 47 et 53).
