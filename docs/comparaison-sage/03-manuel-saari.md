# Sage 100 Comptabilité (SAARI) ou génération i7, formation · fonction par fonction

Manuel 3 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Formation Sage (SAARI) Comptabilité 100 ou génération i7 »,
74 pages (Drive, id 1EV0hSoCgA0YaXVBwSf8PzlitmdJTTgj8), lu en entier le
2026-10-14. Manuel de formation pas à pas (ETS KKB, clients MAQUIS CANARI et
BONPRIX, fournisseurs SOLIBRA et BRASSIVOIRE).

Les captures d'écran de ce manuel n'ont pas pu être lues : le
téléchargement du fichier (8 Mo) a fait tomber la connexion à Drive, et
l'outil de lecture de Drive ne rend que le texte. Les lignes ci-dessous
viennent du seul texte (constat du 2026-10-14, cascade des captures).

Méthode et légende : celles du manuel 1. Seules sont reprises les fonctions
que les manuels 1 et 2 ne décrivent pas, ou que celui-ci décrit plus
finement ; « M1-n » et « M2-n » renvoient aux lignes des deux premiers
tableaux. Statuts lus dans le code le même jour, aucune ligne laissée non
vérifiée.

## Création de la société (p. 4 à 10)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Monnaie de tenue choisie à la création (F CFA dans l'exemple) | 5, 6 | DIFFÉRENT, VOULU | Le franc congolais est imposé, sans choix (loi n° 23/053, art. 141, 1° ; AUDCIF art. 17, 1°). |
| 2 | Longueur des comptes de 3 à 13 caractères | 5 | FIDÈLE | Plage 3 à 13, modifiable vers le haut (voir M1-9). |
| 3 | Fiche « Paramètres société » : identification, paramètres comptables, fiscaux, options | 9, 10 | FIDÈLE | Paramètres du dossier. |
| 4 | Barre de navigation et barres verticales | 8 | FIDÈLE | Barre verticale de l'accueil, barre de menus. |

## Éléments comptables (p. 11 à 24)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 5 | Assistant de création enchaînée (« valider ce compte pour en créer un nouveau ») | 11, 12, 15 | ABSENT | Voir M2-8. |
| 6 | Taux de taxes : code, compte de taxe rattaché | 13, 14 | FIDÈLE | Une fiche porte 443 et 445 (comparaison du 2026-09-25). |
| 7 | Supprimer un journal par clic droit | 21 | DIFFÉRENT, À TRIER | Suppression servie (journal vide), sans menu contextuel (M1-4). |
| 8 | Fiche banque : adresse, contact, site de la banque | 22, 23 | PARTIEL | Adresse, téléphone, courriel, contact ; ni site ni volet de contacts multiples. |
| 9 | Compte bancaire : abrégé obligatoire, code banque, guichet, numéro, clé, journal rattaché | 23, 24 | FIDÈLE | `RibBanque` : abrégé, codes, numéro, clé, IBAN contrôlé, un journal par RIB. |
| 10 | Raccourcis clavier (Ctrl+F4 fermer, Ctrl+M ouvrir, Ctrl+T atteindre) | 24, 38 | PARTIEL | En saisie : F4, F5, Ctrl+D ; Échap ferme ; pas de « Atteindre ». |

## Saisie d'une facture et d'un règlement (p. 24 à 32)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 11 | Numéro de pièce proposé : le dernier plus un | 26 | FIDÈLE | Numérotation du journal. |
| 12 | Ligne de TVA générée d'office après la ligne hors taxes | 27 | FIDÈLE | D'office pour un dossier assujetti, proposée sinon. |
| 13 | Ligne du tiers : compte général repris du tiers, solde de la pièce reporté d'office | 27, 28 | FIDÈLE | « Net à payer » au choix d'un compte de tiers. |
| 14 | Échéance calculée d'office selon les conditions de règlement du tiers | 28 | ABSENT | Le modèle de règlement n'est pas appliqué en saisie. |
| 15 | Recherche d'un compte par les premiers caractères de son nom | 28, 31 | FIDÈLE | La liste filtre sur le début du numéro et sur l'intitulé (`comptes-proposes.ts`). |
| 16 | Journal de trésorerie à contrepartie ligne à ligne, montant proposé | 30, 31 | FIDÈLE | Voir M1-85. |

## Interrogation et lettrage (p. 32 à 45)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 17 | Afficher les écritures lettrées, non lettrées ou toutes | 34, 35 | PARTIEL | Bascule « non lettrées seulement » ; pas de vue des seules lettrées. |
| 18 | Lettrage manuel, lettre majuscule proposée | 34 | FIDÈLE | |
| 19 | Changer à la main la prochaine lettre | 36 | ABSENT | La lettre est attribuée par le programme. |
| 20 | Lettrage automatique : type (montant, numéro de pièce, numéro de facture), période, « puissance » | 39, 40 | PARTIEL | Passes fixes (référence, paires, plusieurs pour une, plusieurs pour plusieurs) ; ni choix du type, ni période, ni puissance. |
| 21 | Délettrage depuis la fenêtre de lettrage automatique | 41 | FIDÈLE | Délettrage servi. |
| 22 | Extrait de compte tiers imprimé sur un modèle, page de garde | 41 à 43 | DIFFÉRENT, À TRIER | Voir M1-109. |
| 23 | Aperçu avant impression dans toutes les impressions | 42, 43 | DIFFÉRENT, À TRIER | Aperçu du navigateur. |
| 24 | Pré-lettrage : lettres minuscules sur des lignes qui ne s'équilibrent pas | 43 à 45 | FIDÈLE | Le groupe partiel en tient lieu (CLAUDE.md F50) ; chez OmegaX, « pré-lettrage » désigne la proposition à confirmer. |

## Relance client (p. 45 à 50)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 25 | Relance préventive, rappel, relevé | 47 | FIDÈLE | Trois états de Rappel et relevé. |
| 26 | Règlement partiel déduit du total réclamé | 48 | FIDÈLE | La relance réclame le net (lot M, M2). |
| 27 | Lettre de rappel sur un modèle paramétré | 49 | FIDÈLE | Texte par niveau de relance. |

## États standards et états des tiers (p. 51 à 59)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 28 | Brouillard imprimé depuis l'état ou depuis la saisie | 51, 52 | FIDÈLE | État Brouillard. |
| 29 | Impression du journal qui marque le journal « imprimé » | 53 | ABSENT | Voir M2-67. |
| 30 | Balance âgée : date de situation, d'après la date d'écriture ou d'échéance, délais de 30, 60, 90 jours | 56, 57 | DIFFÉRENT, À TRIER | Voir M1-136. |
| 31 | Échéancier des règlements à venir | 57, 58 | FIDÈLE | Échéancier de trésorerie. |
| 32 | Balance des tiers par type | 58, 59 | FIDÈLE | Balance auxiliaire par famille. |

## Rapprochement bancaire (p. 59 à 65)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 33 | Annuler le rapprochement d'une ligne | 63 | FIDÈLE | Dépointer dénoue la ligne. |
| 34 | Personnaliser les colonnes d'une liste (ajouter « Pièce trésorerie ») | 64 | ABSENT | Aucun choix de colonnes. |
| 35 | Rapprochement sur le compte de contrepartie (colonnes inversées) | 62 | PARTIEL | Voir M2-17. |

## Fin d'exercice (p. 66 à 74)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 36 | Bilan et compte de résultat imprimés | 66 | FIDÈLE | États financiers complets des deux référentiels, notes comprises. |
| 37 | Nouvel exercice créé avant la clôture du précédent | 66, 67 | FIDÈLE | Point 11 ; le sélecteur d'exercice le prévoit. |
| 38 | Date de fin proposée sur douze mois | 67 | FIDÈLE | Exercice suivant ouvert d'office (`exerciceSuivantApres`) ; à la création manuelle, les dates se saisissent. |
| 39 | Report à-nouveau : journal, sélection des comptes, mode, libellé paramétrable | 68, 69 | PARTIEL | Mode par compte ; libellé fixé par OmegaX ; pas de sélection de comptes au lancement. |
| 40 | Jusqu'à cinq exercices par fichier, suppression d'un exercice ancien | 70, 71 | DIFFÉRENT, VOULU | Aucune limite, aucune suppression (conservation de dix ans, AUDCIF art. 24). |
| 41 | Clôture d'exercice après clôture et impression des journaux, archivage | 70 à 73 | DIFFÉRENT, À TRIER | La clôture refuse le brouillard et suit l'ordre des exercices ; elle n'exige ni clôture préalable des journaux ni impression ; l'exercice clos reste consultable dans le dossier. |

## Bilan du manuel

41 fonctions relevées en plus des manuels 1 et 2 : 23 FIDÈLE,
2 DIFFÉRENT VOULU, 5 DIFFÉRENT À TRIER, 6 PARTIEL, 5 ABSENT,
0 NON VÉRIFIÉ.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et les DIFFÉRENT, À TRIER.
