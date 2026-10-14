# Sage 100 Comptabilité i7, cours « Le Formateur » · fonction par fonction

Manuel 11 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Sage 100 comptabilité i7 », support des vidéos de la chaîne
« Le Formateur » (Drive, fichier « Sage-comptabilite-i7 », id
1KXM7UyzD0wH378S6MKbAeb06ka2qgBnE), 35 pages, sans date. La page de garde
porte « Manuel de référence Sage 100 Comptabilité, version 8.50 » ; le
cours suit le plan comptable marocain (clients au 3421, fournisseurs au
4411, montants en dirhams). Ces numéros ne sont repris nulle part ; seule
la fonction est comparée.

Le texte a été extrait du PDF puis lu en entier le 2026-10-14. Les 26
pages qui portent une capture d'écran ont été lues ensuite en image : elles
précisent plusieurs lignes et en ajoutent trois (section « Vu sur les
captures seulement »). Quelques captures sont coupées ou en partie masquées
(p. 4, 9, 19, 21, 22, 30 et 35) ; rien n'est tiré de ce qui ne s'y lit pas.
Les pages citées sont celles du PDF.

Ce cours recoupe le guide de l'utilisateur (manuel 1) et le support de
formation (manuel 10). Méthode et légende : celles du manuel 1
(`01-guide-utilisateur-i7.md`). « M1-n » à « M10-n » renvoient aux lignes
des autres manuels. Les statuts ont été lus dans le code le même jour, sur
la branche `travail/virement-fonds`, et aucune ligne n'est restée non
vérifiée.

## Présentation et mise en place du fichier (p. 2 à 9)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Présentation des données comptables sous forme de graphique | 2 | ABSENT | Aucun graphique des données comptables ; l'onglet Indicateurs de l'accueil rend des chiffres. |
| 2 | Quatre menus dans l'ordre du travail : Fichier, Structure, Traitement, État | 3, 4 | FIDÈLE | Barre de menus de la fenêtre principale (`MenuBar.tsx`). |
| 3 | Installation depuis une clé USB, clé d'authenticité saisie à l'installation | 6 | DIFFÉRENT, VOULU | En ligne, rien à installer ; sur site, programme d'installation Windows et licence en fichier signé (`installation/`, `src/modules/sur-site/`). |
| 4 | Espace de travail : mode assistant, barre verticale, barres d'outils à afficher ou masquer ; personnalisation des barres, des menus et des raccourcis clavier | 7 | PARTIEL | La barre verticale de l'accueil existe, et les favoris retiennent des commandes ; ni mode assistant, ni barres d'outils, menus ou raccourcis personnalisables. |
| 5 | Création du fichier : dossier de stockage, nom, taille, exercice | 8 | DIFFÉRENT, VOULU | Voir M2-1. Pas de fichier ni de taille : le dossier vit dans la base. |
| 6 | Identification : raison sociale, activité, forme juridique, capital, adresse, téléphone, identifiant, courriel, site | 9 | FIDÈLE | Paramètres du dossier ; le capital n'est demandé qu'aux sociétés (AUSCGIE art. 17, `tenant/mentions-societe.ts`). |
| 7 | Natures de compte : une fourchette de numéros par nature, à modifier | 9 | FIDÈLE | Voir M2-2 ; fourchettes paramétrables par dossier (`comptes/natures-compte.ts`). |
| 8 | Protection du fichier par un mot de passe (Fichier > Autorisation d'accès) | 9 | DIFFÉRENT, VOULU | Un compte par utilisateur, dix caractères au moins, verrouillage temporaire, double authentification (CLAUDE.md § 8). |

## Structure (p. 10 à 17)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 9 | Création d'un compte général : numéro, type Détail ou Total, intitulé | 10 | FIDÈLE | `Compte.typeCompte`. La capture montre aussi abrégé, raccourci et compte reporting, qu'OmegaX n'a pas (voir M10-9). |
| 10 | Compte mouvementé ou utilisé ailleurs non supprimable ; modifier, imprimer la liste, mettre en sommeil | 11 | FIDÈLE | Suppression refusée avec chaque usage nommé (`common/suppression/references.ts`) ; liste à plat imprimable ; compte en sommeil. |
| 11 | Codes journaux : achats, ventes, opérations diverses, trésorerie avec son compte et la contrepartie à chaque ligne | 12, 13 | FIDÈLE | Voir M10-10 et M10-13. |
| 12 | Journal : modifier, supprimer, imprimer la liste, mettre en sommeil | 13 | FIDÈLE | Un journal vide se supprime, un journal se met en sommeil, la liste s'imprime à plat. |
| 13 | Plan tiers : code, intitulé, adresse, compte collectif | 14 | DIFFÉRENT, VOULU | Le tiers a son compte individuel sous le collectif (voir M1-35). |
| 14 | Tiers : consulter, modifier, supprimer, imprimer la liste, mettre en sommeil, attacher des documents | 15 | FIDÈLE | Documents attachés aux tiers (`tiers/documents-tiers.ts`). |
| 15 | Taux de taxe : code unique, sens (déductible ou collectée), intitulé, compte de taxe, taux, comptes HT affectés | 16, 17 | FIDÈLE | Une fiche porte le compte collecté et le compte déductible ; le compte de charge ou de produit porte son taux par défaut (`Compte.tauxTvaDefaut`). Les autres zones de la capture (type, regroupement, assujettissement, provenance) : voir M10-26. |
| 16 | Calcul de la taxe dans un journal d'achats ou de ventes seulement | 17 | FIDÈLE | `modeCalculTva` : aucun calcul hors de ces journaux (CLAUDE.md, « Taux de TVA par défaut dans la grille »). |

## Saisie des écritures (p. 18 à 24)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 17 | Six modes : saisie par pièce, opérations bancaires, saisie des écritures, par lot, OD analytiques, journaux de saisie | 18 | PARTIEL | Voir M10-21 à M10-24 : saisie par pièce, par journal et OD analytiques servies ; pas de fichier de lot ; pas de journal temporaire des opérations bancaires. |
| 18 | Journal ouvert par code et mois ; TVA et net à payer calculés, tiers choisi | 18, 19 | FIDÈLE | Grille par journal et par mois ; ligne de taxe et net à payer (`netAPayer`) au choix du tiers. |
| 19 | Échéance égale à la date d'écriture quand elle n'est pas saisie | 21 | FIDÈLE | Les relances, l'échéancier et la balance âgée lisent la date de l'écriture à défaut d'échéance (`relances.service.ts:549`, `ecriture.service.ts:3000`). |
| 20 | Contrepartie à chaque ligne dans les journaux de caisse et de banque | 22 | FIDÈLE | `Journal.contrepartieChaqueLigne` (`lib/contrepartie-tresorerie.ts`). |
| 21 | Consulter, modifier ou supprimer un journal d'une période, sauf écriture lettrée, pointée, rapprochée ou clôturée | 24 | PARTIEL | Consultation et modification au brouillard ; suppression écriture par écriture, refusée pour une ligne lettrée ou pointée. Pas de suppression du journal d'une période en bloc. |
| 22 | Bilan d'ouverture saisi en opérations diverses | 24 | FIDÈLE | À-nouveau au journal OD, ou bilan d'ouverture importé. |

## Modèles, clôture et fin d'exercice (p. 25 à 35)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 23 | Modèles de saisie : Saisir, Répéter, Incrémenter, Équilibrer, Calculer, Fonction ; appel par F4 dans le journal du type | 25 à 28 | PARTIEL | Voir M10-28 : Incrémenter et Fonction ne sont pas repris. Les captures montrent des formules libres (« =Debit(1)*0.14 ») ; Calculer prend ici le taux de la ligne. |
| 24 | Clôture des journaux partielle, totale, ou par période | 29 à 33 | FIDÈLE | Trois clôtures ; la partielle ne fige rien du lettrage ni de l'analytique (`exercice/gel-cloture.ts`). |
| 25 | Impression des journaux proposée à la clôture totale et à la clôture de période | 32, 33 | DIFFÉRENT, VOULU | La clôture ne commande aucune impression ; les journaux s'exportent à part. |
| 26 | Nouvel exercice : dates, génération des à-nouveaux, report des budgets, compte de résultat selon le sens du solde | 34, 35 | FIDÈLE | Report calculé avec le résultat au compte 13 ; budgets reportés sans écraser ceux qui existent (point 11). |
| 27 | Suppression de l'exercice le plus ancien | 34 | DIFFÉRENT, VOULU | Aucun exercice ne se supprime : les livres se conservent dix ans (AUDCIF art. 24). |
| 28 | Exercices précédents accessibles par le menu Fenêtre | 35 | FIDÈLE | Sélecteur d'exercice (`SelecteurExercice.tsx`). |

## Fonctions citées sans développement (p. 2 à 5)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 29 | Fusion des structures | 5 | FIDÈLE | Fusion des tiers et des comptes (point 10). |
| 30 | Export des documents vers Excel | 3 | FIDÈLE | Exports en classeur. |
| 31 | États analytiques et budgétaires | 3 | PARTIEL | Balance analytique et état budgétaire ; voir M10, « Analytique et budgets ». |
| 32 | Réimputation des comptes | 3 | FIDÈLE | Réimputation (point 9). |
| 33 | Recherche d'écritures | 3, 5 | FIDÈLE | Recherche d'écritures (point 8). |
| 34 | Interrogation et lettrage | 5 | FIDÈLE | Interrogation des comptes et lettrage manuel, automatique et proposé. |
| 35 | Règlements des tiers, relances clients, relevés de tiers, rapprochement bancaire | 2 | FIDÈLE | Règlement des tiers, rappels et relevés, rapprochement avec relevé importé. |
| 36 | Libellés d'écritures | 3 | FIDÈLE | Libellés proposés en liste, sans imputation (point 19). |

## Vu sur les captures seulement

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 37 | Journal de trésorerie : « Affecter le statut Réglé aux écritures » | 22 | ABSENT | Aucun statut de règlement sur les écritures ; une facture se dit réglée par son lettrage. |
| 38 | Report à-nouveau : journal choisi, racine ou intervalle de comptes au lancement | 35 | PARTIEL | Voir M3-39. |
| 39 | Bilan d'ouverture déséquilibré soldé sur un compte d'équilibre choisi | 35 | DIFFÉRENT, VOULU | Le report porte le résultat au compte 13 : l'ouverture est équilibrée par construction (`exercice/report-a-nouveau.ts`). |

## Bilan du manuel

39 fonctions relevées : 24 FIDÈLE, 7 DIFFÉRENT VOULU, 0 DIFFÉRENT À TRIER,
6 PARTIEL, 2 ABSENT, 0 NON VÉRIFIÉ.

Cours d'initiation, il suit le parcours d'un premier dossier : fichier,
structure, saisie, modèles, clôtures, nouvel exercice. OmegaX le couvre
presque entier. Les deux ABSENT sont le graphique des données comptables et
le statut « réglé » posé par un journal de trésorerie. Les PARTIEL renvoient
aux lignes déjà relevées dans les manuels 1, 3 et 10 (espace de travail,
modes de saisie, suppression d'un journal par période, modèles, report
à-nouveau, états analytiques).

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT.
