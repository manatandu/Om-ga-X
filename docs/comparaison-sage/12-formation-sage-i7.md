# Sage 100 Comptabilité i7, formation d'avril 2023 · fonction par fonction

Manuel 12 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Formation, session avril 2023, Sage 100 Comptabilité i7 »,
encadreur MANGOUMBA B. Théo Dimitri, 30 pages (Drive, fichier
« formation-sage », id 1VrsziWJE43u-9JYJint4_X_m5tuIB5m3). Le support suit le référentiel OHADA et un cas
gabonais (montants en francs CFA).

Le texte a été extrait du PDF puis lu en entier le 2026-10-14, et les 30
pages ont été lues ensuite en image : aucune ne porte de capture du
logiciel, toutes sont des diapositives de texte. Le sommaire annonce un
titre II (écran de saisie, saisie classique, journal de trésorerie,
éditions, ouverture d'un nouvel exercice) que le support ne développe pas :
les pages 23 à 25 sont vides sous leur bandeau, et les exercices des pages
26 à 30 renvoient à ces opérations. L'annexe 2 (plan comptable) citée par
l'exercice 4 n'y figure pas. Les pages citées sont celles du PDF.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M1-n » à « M10-n » renvoient aux lignes des autres manuels. Les statuts
ont été lus dans le code le même jour, sur la branche
`travail/virement-fonds`, et aucune ligne n'est restée non vérifiée.

## Création et ouverture du dossier (p. 5 à 11)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Création du fichier par Fichier > Nouveau : nom ou raison sociale, dates de début et de fin du premier exercice | 5 | DIFFÉRENT, VOULU | Voir M2-1. |
| 2 | Longueur des comptes fixe, ou flottante en tapant 0 | 5 | PARTIEL | La longueur du dossier est un plafond de 3 à 13 chiffres (voir M1-9) : sous lui, les numéros sont de longueur libre (`compte.service.ts:185`). Aucun mode à longueur fixe ne complète les numéros saisis ; seul le plan semé est complété à huit chiffres (CLAUDE.md § 7). |
| 3 | Onglet Identification : raison sociale, activité, adresse, code postal et ville, région et pays | 6 | FIDÈLE | Paramètres du dossier : nom, activité, adresse, ville, pays, téléphone, site (`Tenant`). Ni code postal ni région. |
| 4 | Onglet Paramètre : code du journal des à-nouveaux (RAN), qui doit exister dans les journaux | 7 | PARTIEL | Voir M3-39. Le report se passe au journal OD, à défaut au premier journal de type Général (`exercice.service.ts:2747`), sans paramètre. |
| 5 | Onglet Initialisation : monnaie de tenue (intitulé, unité, sous-unité) | 7 | DIFFÉRENT, VOULU | Voir M10-3. |
| 6 | Format des montants : décimales supprimées | 7 | DIFFÉRENT, VOULU | Deux décimales fixes (`lib/montants.ts`, audit final F256) : le franc congolais garde ses centimes. |
| 7 | Onglet Options : pays de la société | 8 | FIDÈLE | `Tenant.pays`, « RD Congo » par défaut. |
| 8 | Natures de compte par fourchettes | 8 | FIDÈLE | Voir M2-2. |
| 9 | Types de tiers : clients, fournisseurs, salariés | 8 | FIDÈLE | `TypeTiers` : adhérent, client, fournisseur, salarié, autre. |
| 10 | Ouvrir et fermer un dossier par le menu Fichier ; nom du dossier et exercice en barre de titre | 9 | DIFFÉRENT, VOULU | Le dossier s'ouvre à la connexion de son utilisateur et se ferme à la déconnexion. Son nom s'affiche en barre de titre (`AppShell.tsx:681`) et en barre d'état ; l'exercice se choisit au sélecteur. |
| 11 | Maintenance après une coupure de courant (« ce dossier est déjà ouvert ») | 10, 11 | DIFFÉRENT, VOULU | Voir M1-150. |

## Structure du dossier (p. 12 à 22)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 12 | Plan comptable : créer, consulter, modifier, supprimer par le menu contextuel | 12 à 14 | FIDÈLE | Plan comptable ; un compte mouvementé ou utilisé ne se supprime pas (suppression des structures, `common/suppression/references.ts`). |
| 13 | Type Détail ou Total | 13 | FIDÈLE | `Compte.typeCompte`. |
| 14 | Nature proposée, « Aucun » hors des fourchettes | 13 | FIDÈLE | Hors nature quand le numéro n'entre dans aucune fourchette (`comptes/natures-compte.ts`). |
| 15 | Report à-nouveau proposé : Solde au bilan, Aucun en gestion | 13 | FIDÈLE | `Compte.modeReportANouveau` (aucun, solde, détail), défaut donné par la nature, modifiable par compte. |
| 16 | Plan des tiers : créer (numéro, intitulé, type), consulter, modifier, supprimer | 15 à 17 | FIDÈLE | Plan des tiers, structure réservée à l'administrateur. |
| 17 | « Associer les comptes » : rattacher le tiers à une racine, le compte général 411 créé s'il manque | 15, 16 | DIFFÉRENT, VOULU | Voir M1-35. |
| 18 | Ctrl+J pour passer au tiers suivant | 16 | ABSENT | Aucun raccourci dans la fiche du tiers ; les raccourcis d'OmegaX sont ceux de la saisie (voir M3-10). |
| 19 | Au moins trois journaux : caisse, opérations diverses, à-nouveaux | 18 | PARTIEL | Le dossier naît avec Achats, Ventes, Banque, Caisse et Opérations diverses (`journal-seed.ts`), sans journal d'à-nouveaux (voir la ligne 4). |
| 20 | Journal : code, type (achat, vente, trésorerie, général), compte de trésorerie pour un journal de trésorerie | 18, 19 | FIDÈLE | `TypeJournal` : achats, ventes, trésorerie, général, situation. Le journal de banque ou de caisse a son propre compte (décision du 2026-10-09). |
| 21 | Taux de taxe : intitulé (35 caractères), compte, taux | 20, 21 | FIDÈLE | `TauxTva` : code, intitulé, taux, compte 443 et compte 445 sur la même fiche. Longueur de l'intitulé non bornée. |
| 22 | Type de taxe : TVA sur les débits, TVA sur les encaissements | 20, 21 | DIFFÉRENT, VOULU | L'exigibilité ne se porte pas sur le taux : elle se lit sur la nature de la contrepartie (O.-L. n° 10/001, art. 25 ; passe F2a, `lib/tva-syscohada.ts`). |
| 23 | Comptes généraux associés au taux, base du calcul automatique | 21 | FIDÈLE | Le compte de charge ou de produit porte son taux par défaut (`Compte.tauxTvaDefaut`), que la saisie propose. |
| 24 | Code taxe et « taxe non perçue », réservés à la gestion commerciale | 21 | ABSENT | Aucune gestion commerciale (voir M9). |
| 25 | Modèles : saisie d'écritures, grilles de ventilation, règlements, abonnements | 22 | PARTIEL | Modèles de saisie (point 6) et abonnements (`ModeleAbonnement`) ; le modèle de règlement n'est qu'une simulation (`tiers.service.ts:887`) ; les clés de répartition ne se rattachent à aucun compte (voir M1-19). |

## Exercices d'application (p. 26 à 30)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 26 | Création de dix journaux (achats, deux banques, caisse, à-nouveaux, opérations diverses, salaires, déclarations mensuelles, ventes, travaux extra-comptables) | 27, 28 | FIDÈLE | Journaux en nombre libre ; un journal de banque par compte bancaire. |
| 27 | Saisie des opérations du mois, achats et ventes avec TVA | 29, 30 | FIDÈLE | Saisie par journal ; la TVA se calcule en journal d'achats ou de ventes (`modeCalculTva`). |
| 28 | Automatiser les ventes et les achats répétitifs | 29 | FIDÈLE | Modèles de saisie appelés par F4. |
| 29 | Éditions : journal général, grand livre, balance complète | 29 | FIDÈLE | Exports du journal, du grand livre et de la balance. |
| 30 | Ouvrir un nouvel exercice après les travaux d'inventaire | 29 | FIDÈLE | Fenêtre Exercices ; à-nouveau provisoire, puis report à la clôture. |

## Bilan du manuel

30 fonctions relevées : 17 FIDÈLE, 7 DIFFÉRENT VOULU, 0 DIFFÉRENT À TRIER,
4 PARTIEL, 2 ABSENT, 0 NON VÉRIFIÉ.

Support d'initiation, il ne couvre que la mise en place du dossier et sa
structure, sans rien que les manuels 1, 2 et 10 n'aient déjà montré. Les
deux ABSENT sont mineurs : le raccourci Ctrl+J de la fiche du tiers, et le
code taxe et la « taxe non perçue » de la gestion commerciale. Les PARTIEL
tiennent à la longueur des comptes, au journal des à-nouveaux et aux
modèles (règlement simulé seulement, grille non rattachée à un compte).

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT.
