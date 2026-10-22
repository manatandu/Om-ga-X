# Support de formation Sage Comptabilité (« Comptalia ») · fonction par fonction

Manuel 14 de la comparaison complète demandée par Manasse le 2026-10-09,
et le dernier du dossier Drive. Source : « Support de formation SAGE
Comptabilité », marqué Comptalia, dossier d'exemple « Diamant vert »
(exercice 2010, plan comptable français) (Drive, fichier
« 342285752-Formation-SAGE-Comptabilite_compressed.pdf », id
16Rg_bkmIPKy9DqPu3U3ogxZXaP-zomQE, 27 Mo).

**Ce qui a été lu, et ce qui ne l'a pas été.** Le fichier pèse 27 Mo, au-delà
de la limite de téléchargement du connecteur Drive (10 Mo) : le PDF n'a pas
pu être ouvert. Le seul texte disponible est celui que Drive a reconnu sur
les captures d'écran du support, lu en entier le 2026-10-14. Il couvre la
création du dossier, la fenêtre principale, le plan comptable, les taux de
taxe, les journaux, les banques, la fiche du tiers, la saisie d'un journal
et la saisie analytique, puis s'arrête : la suite du support (lettrage,
rapprochement, états, clôture, s'il les traite) n'a pas été atteinte, et
rien n'en est tiré. Ce texte ne porte aucun numéro de page ; la colonne
« Page » vaut donc « · » partout. Une ligne n'a été écrite que si la capture
nomme la fonction sans ambiguïté.

Le support recoupe presque entièrement le support de formation du manuel 10
et le guide du manuel 1 : la plupart des lignes y renvoient. Méthode et
légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`). « M1-n » à
« M13-n » renvoient aux lignes des autres manuels. Les statuts ont été lus
dans le code le même jour, sur la branche `travail/virement-fonds`, et
aucune ligne n'est restée non vérifiée.

## Installation et création du dossier

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Référencement du logiciel, code d'accès, nombre d'accès restants | · | DIFFÉRENT, VOULU | Voir M5-1. |
| 2 | Assistant de création du dossier : raison sociale reprise de l'installation, coordonnées de l'entreprise | · | DIFFÉRENT, VOULU | Voir M10-1. |
| 3 | Dates de début et de fin de l'exercice | · | FIDÈLE | Fenêtre Exercices ; le premier exercice peut être long (AUDCIF art. 7), et une période n'est couverte que par un exercice. |
| 4 | Longueur des comptes généraux, variable ou fixe de 3 à 13, non modifiable après la création des comptes | · | PARTIEL | Voir M10-6 : la longueur est un plafond de 3 à 13, qui s'élargit sans jamais descendre sous le plus long numéro ouvert. |
| 5 | Longueur des codes de section analytique | · | ABSENT | Les codes de section sont de longueur libre. |
| 6 | Monnaie de tenue : euro ou autre, décimales, séparateurs, code ISO, sigle | · | DIFFÉRENT, VOULU | Voir M10-3 ; deux décimales fixes (`lib/montants.ts`). |
| 7 | Reprise des éléments du modèle standard, en tout ou en partie, ou paramétrage manuel | · | FIDÈLE | Voir M10-4. |
| 8 | Nom, emplacement et capacité du fichier comptable | · | DIFFÉRENT, VOULU | Voir M10-5. |

## Fenêtre principale et paramètres

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 9 | Barre d'outils commune : ajouter, consulter, modifier, supprimer, précédent, suivant, rechercher, atteindre, inverseur, calculette | · | PARTIEL | Voir M1-152. |
| 10 | Barre verticale : saisie des écritures, gestion et suivi des tiers, fonctions avancées, traitements périodiques, états comptables et fiscaux, fin d'exercice | · | PARTIEL | Voir M1-151 : la barre verticale existe, avec les groupes d'OmegaX. |
| 11 | À propos de la société : identification, contacts, fiscal, ajustement du lettrage, synchronisation comptable, paramètres, options, préférences | · | PARTIEL | Paramètres du dossier (identité, forme, régimes déclarés). Ni contacts multiples (M5-6), ni écart de lettrage passé d'office (M13-18), ni synchronisation. |

## Plan comptable

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 12 | Liste du plan comptable et son menu : voir, consulter, supprimer, sélectionner, ajouter, atteindre, rechercher, interroger le compte, personnaliser la liste, ajuster les colonnes | · | PARTIEL | Création, recherche, modification et interrogation (M10-8). Les colonnes ne se choisissent pas (M3-34). |
| 13 | Assistant de création d'un compte (numéro et intitulé, puis valider ou continuer) | · | ABSENT | Voir M2-8 : un formulaire, sans assistant. |
| 14 | Fiche du compte : fiche principale, analytique et IFRS, bloc-notes, information libre, cumuls ; type, abrégé, nature, report, compte reporting, comptes tiers rattachés, code taxe, raccourci, options de saisie, mise en sommeil | · | PARTIEL | Voir M10-9. |

## Taxes, journaux et banques

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 15 | Taux de taxe : code, sens, intitulé, compte, taux, type (sur les débits ou les encaissements), provenance, comptes généraux rattachés, regroupement, assujettissement, taxe non perçue ; taxe en unités | · | PARTIEL | Voir M10-26. |
| 16 | Codes journaux : liste et assistant (type, code, intitulé, ventilation analytique par journal) | · | FIDÈLE | Voir M10-10. La ventilation analytique se règle par plan et par classe, non par journal (M3-81). |
| 17 | Journal de trésorerie : compte, contrepartie à chaque règlement ou centralisation en fin de mois, rapprochement sur le compte de contrepartie ou de trésorerie | · | PARTIEL | Voir M10-13. Le rapprochement porte sur le compte de banque. |
| 18 | Numérotation des pièces : manuelle, continue par journal, continue pour le fichier, mensuelle | · | FIDÈLE | Voir M10-11. |
| 19 | Journaux de remise à l'encaissement et à l'escompte, de prélèvements remis en banque | · | PARTIEL | Depuis la ligne sage-l3 (n° 39), la remise à l'encaissement et à l'escompte d'un effet se passe dans le journal de la banque de remise (voir M13-6) ; les prélèvements restent à M5-44. |
| 20 | Banques : liste, identification, contacts, complément | · | PARTIEL | Voir M3-8. |
| 21 | RIB de la banque : devise, pays, BIC, codes, clé, calcul automatique de l'IBAN, compte intra-groupe, journal de banque | · | PARTIEL | Voir M5-10. |

## Tiers

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 22 | Créer un client ; identification du tiers (numéro, type, intitulé, abrégé, qualité, collectif, contact, adresse, identifiants, téléphones) | · | FIDÈLE | Voir M10-41. |
| 23 | Contacts du tiers : nom, fonction, service, type, téléphones | · | PARTIEL | Voir M10-42. |
| 24 | Complément du tiers : devise, raccourci, langue, représentant, comptes rattachés, lettrage automatique, validation automatique des règlements, hors rappel, non soumis aux pénalités, mise en sommeil, tiers payeur, ventilation IFRS | · | PARTIEL | Comptes rattachés (la panoplie du type), tiers hors relance avec motif, mise en sommeil. Le reste manque (M10-101). |
| 25 | Modèle de règlement du tiers (valeur, jours, condition fin de mois) et mode de règlement | · | PARTIEL | Voir M10-45 et M10-46. Pas de mode de règlement (M5-8). |
| 26 | Banques du tiers : RIB, banque principale, calcul de l'IBAN | · | PARTIEL | RIB des tiers, un principal (M5-16). L'IBAN se contrôle, il ne se calcule pas. |
| 27 | Solvabilité et surveillance : contrôle de l'encours, plafond d'assurance crédit, code risque, échus par mois, risque réel ; informations financières du client | · | ABSENT | Voir M10-102. |
| 28 | Champs libres du tiers : statistiques, information libre, documents | · | PARTIEL | Documents attachés (`tiers/documents-tiers.ts`). Ni statistiques ni informations libres (M4 B-14). |
| 29 | Cumuls du tiers par mois et par devise | · | PARTIEL | Voir M10-103. |
| 30 | Interrogation et courrier depuis la fiche du tiers | · | PARTIEL | Interrogation des comptes de tiers (M10-43). Le courrier ne sert qu'aux relances (M5-41). |

## Saisie

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 31 | Journaux de saisie par période | · | PARTIEL | Voir M10-14. |
| 32 | Saisie d'un journal : équilibrer, appeler un modèle, ancien solde, totaux du journal, nouveau solde | · | PARTIEL | Saisie par journal et modèles appelés par F4 (M1-102). La fenêtre affiche les totaux du journal et le solde de la pièce, pas l'ancien ni le nouveau solde du compte. |
| 33 | Personnalisation des colonnes de saisie (date de saisie, contreparties, code taxe, provenance, mode de règlement, échéance, devise, position) | · | ABSENT | Voir M10-15. |
| 34 | Sélection d'un compte, avec ou sans les comptes en sommeil | · | PARTIEL | Voir M10-99. |
| 35 | Saisie analytique d'une ligne : plan, section, quantité ou devise, montant, grille, équilibrage, total imputé et solde | · | PARTIEL | Ventilation des lignes que le plan ventile (M10-73). Ni quantité ni grille rattachée au compte (M10-74). |

## Bilan du manuel

35 fonctions relevées : 5 FIDÈLE, 4 DIFFÉRENT VOULU, 0 DIFFÉRENT À TRIER,
21 PARTIEL, 5 ABSENT, 0 NON VÉRIFIÉ.

Le support ne montre rien que les manuels 1, 5 et 10 n'aient déjà relevé :
toutes ses fonctions y ont leur ligne, sauf la longueur fixe des codes de
section analytique (ligne 5). Ses manques sont ceux que ces manuels
nomment déjà : fiche du compte et du tiers moins riche, solvabilité et
encours, modes de règlement, colonnes de saisie à choisir.

## Ce qui reste à faire sur ce manuel

- Pour lire la suite du support : le PDF découpé en morceaux de moins de
  10 Mo, ou déposé ailleurs que dans le Drive.
- Manasse trie les ABSENT.
