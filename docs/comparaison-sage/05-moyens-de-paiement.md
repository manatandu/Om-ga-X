# Sage Moyens de Paiement Banque, prise en main · fonction par fonction

Manuel 5 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Sage Moyens de Paiement Banque, Prise en main », Sage, 2010,
126 pages (Drive, id 1oqyXCbbXky7xFjpnEV_urGLS8eAxN0Sv). Lu en entier le
2026-10-14 après extraction du texte du PDF. Les pages 1, 12, 32, 66, 76, 86,
90, 100, 102, 104 et 122 n'ont pas de texte (couverture, pages blanches ou
captures d'écran).

Les 94 pages qui portent une capture d'écran ont été lues ensuite en image,
le même jour. Elles précisent les lignes 10, 13, 16, 21 et 31, et en
ajoutent quatre (section « Vu sur les captures seulement »). Plusieurs
captures sont en partie illisibles (p. 21, 23, 37, 41, 47, 51, 53, 61, 63 à
65, 69, 75, 77, 88, 89, 92, 101 et 116) ; rien n'est tiré de ce qui ne s'y
lit pas.

C'est un guide de prise en main du logiciel bancaire de Sage pour la France.
Il repose sur des normes françaises et européennes : fichiers CFONB et AFB,
virement SEPA, lettre de change relevé (LCR), télétransmission ETEBAC et
EBICS. Aucune de ces normes n'a été lue pour la RDC. Leur absence dans
OmegaX est notée telle quelle, et c'est à Manasse de la trier.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M1-n », « M2-n » et « M3-n » renvoient aux lignes des trois premiers
tableaux. Les statuts ont été lus dans le code le même jour, sur la branche
`travail/virement-fonds`, et aucune ligne n'est restée non vérifiée.

## Installation et société (p. 9 à 52)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Installation par cédérom avec clé d'authenticité ; clé de référencement qui lève la limite de trente accès | 11, 20, 33 | DIFFÉRENT, VOULU | En ligne, il n'y a rien à installer. Sur site, la licence est un fichier signé, lié au poste (`src/modules/sur-site/`). L'essai dure trente jours par abonnement. |
| 2 | Enregistrement du logiciel : société, dirigeant, utilisateur principal, expert-comptable, banque conseil | 24 à 27 | DIFFÉRENT, VOULU | Le logiciel ne s'enregistre pas auprès de l'éditeur. Le dossier porte sa propre identification. |
| 3 | Fichier Moyens de paiement relié ou non à la comptabilité, en version identique (.MDP et .MAE) | 10, 33 à 44 | DIFFÉRENT, VOULU | Tout est dans un seul dossier : règlements, banques et écritures partagent la même base. Il n'y a ni liaison à établir ni versions à accorder. |
| 4 | Reprise des données d'un autre logiciel par l'outil de maintenance | 10, 11, 45 | PARTIEL | On peut importer le plan des comptes, une balance (bilan d'ouverture compris) et des écritures (`TypeImport`). Les échéances et les fichiers de paiement d'un autre logiciel ne se reprennent pas. |
| 5 | Monnaie de tenue choisie (l'euro par défaut), code ISO de remise | 43, 48, 51 | DIFFÉRENT, VOULU | Le franc congolais est imposé (loi n° 23/053, art. 141, 1° ; AUDCIF art. 17, 1°). |
| 6 | Contacts de la société | 49 | PARTIEL | Le dossier a un téléphone et un courriel, mais pas de liste de contacts. |
| 7 | Numéro d'émetteur national pour les prélèvements | 50 | ABSENT | OmegaX ne gère pas les prélèvements (voir 44). |
| 8 | Options : code interbancaire, information libre, modes de règlement | 52 | ABSENT | Aucun mode de règlement (chèque, virement, espèces) n'est enregistré. Le journal de trésorerie et la référence de la pièce (numéro du chèque ou du virement) en tiennent lieu. Les modèles de règlement des tiers ne calculent que les échéances. |

## Banques et tiers (p. 53 à 65)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 9 | Banques : intitulé, abrégé, coordonnées | 53, 54 | FIDÈLE | `Banque` (adresse, téléphone, courriel, contact) et `RibBanque` (abrégé unique dans le dossier). Voir M3-8 et M3-9. |
| 10 | RIB de la banque : numéros d'émetteur pour le virement et la LCR, BIC, IBAN | 55 | PARTIEL | BIC, code banque, code guichet, numéro de compte, clé et IBAN (contrôlé), un journal par RIB. Pas de numéro d'émetteur. La capture (p. 55) montre aussi, sur le RIB, un journal d'escompte et un journal d'encaissement à côté du journal de banque, un compte intra-groupe et le calcul de l'IBAN à partir du RIB : OmegaX rattache un seul journal au RIB et contrôle l'IBAN saisi sans le calculer. |
| 11 | Mode de remise des fichiers (fichier, messagerie, Internet, papier), site ou courriel de la banque, format CFONB ou SEPA | 56 | ABSENT | La remise à la banque se fait par l'ordre de virement imprimé : aucun fichier, aucun envoi, aucun site enregistré. |
| 12 | Connexion ETEBAC : réseau téléphonique, serveur bancaire, services souscrits, cartes paramètres, modem, préfixe | 27 à 31, 57 à 61 | ABSENT | OmegaX ne communique pas avec les banques. |
| 13 | Connexion EBICS par Sage direct : certificats, banques et services, initialisation | 61, 62, 105 à 115 | ABSENT | Même raison que la ligne 12. Les captures montrent les trois certificats (authentification, chiffrement, signature), les phases d'initialisation de la banque (INI, HIA, HPB) et la définition de chaque service (norme, type de fichier, sens). |
| 14 | Plan des tiers par type : fournisseur, client, salarié, autre | 63, 64 | FIDÈLE | `TypeTiers` reprend ces quatre types, plus l'adhérent au SYCEBNL. |
| 15 | Courriel et site Internet du tiers, avec lien vers la messagerie et le navigateur | 64 | PARTIEL | Courriel, téléphone et contact ; pas de site Internet. |
| 16 | RIB des tiers : intitulé, coordonnées, BIC, IBAN | 65 | FIDÈLE | `RibTiers` : un RIB principal par tiers, IBAN contrôlé. La création des RIB est réservée à l'administrateur et inscrite au journal d'audit. La capture (p. 65) porte aussi le mandat de prélèvement SEPA du tiers (référence, date de signature), sans objet ici faute de prélèvement (ligne 44). |

## Remises en banque (p. 67 à 85)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 17 | Saisie des règlements en mode Assistant ou en liste | 67, 77 | ABSENT | Un seul écran, Règlement des tiers (voir M2-8). |
| 18 | Proposition des écritures non lettrées du tiers, pour rattacher le règlement à sa facture | 69 | FIDÈLE | Règlement des tiers liste les échéances ouvertes (`GET /reglements/echeances`) et lettre aussitôt le règlement avec elles. |
| 19 | Bordereau enregistré, puis remise en deux temps : pointer les échéances, puis les transmettre | 70, 82, 92, 96 | DIFFÉRENT, À TRIER | La pièce de règlement est passée dès l'enregistrement, et l'ordre de virement est créé avec elle. Il n'y a pas d'étape « pointer puis transmettre » avant la comptabilisation. |
| 20 | Paramétrage de la remise : banque de remise, mode de remise, documents à éditer, bordereau obligatoire | 71, 72, 83, 93, 97 | PARTIEL | La banque est le journal de trésorerie du règlement, et seul l'ordre imprimé sert de remise. La règle de Sage « le règlement n'est effectif qu'après impression » est reprise : l'ordre reste « à imprimer », et sa première impression est datée et nominative (`ribs-tiers.ts`). |
| 21 | Modèle de bordereau de remise choisi à l'impression | 72, 83, 84, 94, 98 | ABSENT | L'ordre de virement n'a qu'une présentation. Les captures montrent les modèles livrés : bordereaux d'effets, de remise, de virements et de prélèvements, lettres de virement, de prélèvement et de traite, liste des échéances, relevé du tiers, traites. |
| 22 | Fichier de remise enregistré sous le nom LCR, VIR ou PRE suivi de l'abrégé de la banque | 73, 84, 99 | ABSENT | Aucun fichier n'est produit. |
| 23 | Virement SEPA : banque paramétrée en SEPA, numéro de facture obligatoire, contrôle du BIC et de l'IBAN des deux banques | 74, 75 | PARTIEL | Pas de format SEPA. L'ordre exige le RIB principal de chaque bénéficiaire, contrôle l'IBAN et imprime les factures réglées avec leur part (`LigneOrdreVirement.imputationDeclaree`). |
| 24 | Saisie et remise des LCR à l'encaissement : mise en portefeuille, acceptation | 68, 69, 73, 123 | ABSENT | OmegaX ne gère pas les effets de commerce. |

## Lots de virements et de prélèvements (p. 77 à 84)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 25 | Lot préétabli de virements : intitulé, tiers, libellés, montants, RIB | 77, 78 | DIFFÉRENT, VOULU | `LotVirement` : nom, fournisseurs, montant habituel, journal. Le lot ne paie rien. Quand on le rappelle, il présélectionne les factures ouvertes dans Règlement des tiers, les plus anciennes d'abord, jusqu'au montant habituel. Payer un fournisseur sans facture ouverte serait une avance au 409, donc une autre opération (`lots-virement.ts`). |
| 26 | Lot préétabli de prélèvements | 77, 79 | ABSENT | OmegaX ne gère pas les prélèvements. |
| 27 | Rappel du lot : date d'exécution, banque de remise, modification du lot au moment du rappel | 79 à 81 | FIDÈLE | La date et le journal se choisissent dans Règlement des tiers. Les montants se corrigent avant l'enregistrement, et le lot se met à jour depuis le même écran. |

## Extraits et soldes (p. 87 à 89, 103, 119 à 121)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 28 | Incorporation des extraits de compte reçus de la banque, par télétransmission ou par fichier téléchargé | 87, 119 à 121 | PARTIEL | Le relevé s'importe en CSV ou XLSX dans un rapprochement en cours ; ses colonnes sont reconnues à leur en-tête ou désignées par l'utilisateur (`releve-bancaire.ts`). Aucun format bancaire normalisé n'est lu, et rien n'est reçu automatiquement. |
| 29 | Contrôles à l'incorporation : compte inexistant, extraits discontinus | 121 | FIDÈLE | Le relevé est rattaché au rapprochement d'un compte précis. Un relevé qui ne boucle pas (solde de départ plus opérations différent du solde imprimé) est signalé, et une ligne datée après le relevé est refusée. |
| 30 | Gestion des extraits : consultation par compte, puis par extrait, et impression | 88 | PARTIEL | Les lignes du relevé se lisent dans leur rapprochement ; il n'existe pas de liste des extraits par compte. |
| 31 | Analyse des soldes, imprimable | 89 | PARTIEL | Les soldes se lisent par compte (balance, grand livre, rapprochement), et la trésorerie disponible figure au tableau de bord. Aucune analyse n'est tirée des extraits. Les captures (p. 89, 90) montrent l'analyse de Sage : solde en position ou en valeur, par jour, compte par compte avec un total, et en graphique. |

## Transmission à la banque (p. 91 à 103, 116 à 118)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 32 | Envoi par Internet : connexion au site de la banque, dépôt des fichiers | 91 à 94 | ABSENT | OmegaX ne communique pas avec les banques. |
| 33 | Transmission immédiate, ou génération du fichier seule pour un envoi ultérieur | 95 à 99 | ABSENT | Même raison que la ligne 32. |
| 34 | Transfert à la banque de fichiers AFB venus d'une autre application (virements de salaires par exemple) | 101 | ABSENT | Même raison que la ligne 32. |
| 35 | Historique des remises | 101 | FIDÈLE | Liste des ordres de virement, filtrable par état (à imprimer, imprimé, annulé), avec le total et le nombre d'ordres à imprimer sur tout le dossier. |
| 36 | Téléchargement des fichiers de la banque, édition des fichiers reçus | 103 | ABSENT | Même raison que la ligne 32. |
| 37 | Journal des communications | 118, 121 | ABSENT | Même raison que la ligne 32. |

## Fonctions nommées en conclusion (p. 123)

Le guide cite ces fonctions sans les décrire et renvoie au manuel de
référence.

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 38 | Mise à jour comptable des règlements et lettrage automatique | 10, 123 | FIDÈLE | Le règlement passe une pièce par tiers et la lettre aussitôt avec ses factures. |
| 39 | Règlements groupés | 123 | FIDÈLE | Règlement des tiers règle plusieurs tiers en une seule opération, avec une pièce par tiers (`EnregistrerReglementsDto.reglements`). |
| 40 | Écarts de règlement et escompte | 123 | PARTIEL | Un paiement inférieur au dû reste un règlement partiel, et un paiement supérieur est refusé. Seul l'écart de change réalisé est comptabilisé (ligne A6). Il n'y a ni escompte ni écart de règlement passé en charge ou en produit. |
| 41 | Lettres adressées aux tiers | 9, 123 | ABSENT | Aucun avis de règlement n'est envoyé au tiers. Le courrier ne sert qu'aux relances. |
| 42 | Virements internationaux | 9, 123 | FIDÈLE | Depuis la ligne sage-l3 (n° 37), le RIB du journal porte sa devise et l'ordre de virement part dans cette monnaie · chaque ligne porte le montant en devise que la banque exécute et sa contrevaleur en francs, celle des pièces (loi n° 23/053, art. 141, 1°, qui vise la tenue des comptes, pas la monnaie du compte bancaire). Une ligne réglée en francs ou dans une autre devise que celle du RIB est refusée avant la première pièce, l'issue nommée. L'ordre de paiement des salaires reste en francs. |
| 43 | Remises de chèques | 123 | ABSENT | Pas de bordereau de remise : le chèque reçu se saisit au journal, avec son numéro en référence. |
| 44 | Prélèvements émis | 123 | ABSENT | Pas de prélèvement. |
| 45 | Versements d'espèces | 123 | FIDÈLE | Virement de fonds de la caisse vers la banque : deux pièces passées par le 585, porteur des espèces exigé (`src/modules/virements-fonds/`). Ce code est sur la branche `travail/virement-fonds`, pas encore sur `main`. |
| 46 | Remises de cartes bancaires | 123 | ABSENT | Pas de remise de cartes bancaires. |
| 47 | LCR à décaisser, relevés de LCR à payer et bons à payer | 9, 123 | ABSENT | OmegaX ne gère pas les effets de commerce. |

## Vu sur les captures seulement

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 48 | Purge des remises transmises après un délai (dix jours dans l'exemple) | 50 | DIFFÉRENT, VOULU | Rien ne se purge : un ordre de virement reste dans la liste, et ne s'annule qu'avec un motif (`ribs-tiers.ts`). Les pièces se conservent dix ans (AUDCIF art. 24). |
| 49 | Délais et heures limites de remise par banque ; remise Dailly | 56, 71 | ABSENT | Aucun délai de remise n'est tenu. La remise Dailly est une cession de créances de droit français, non lue pour la RDC. |
| 50 | Virement ou prélèvement urgent | 83, 93, 117 | ABSENT | L'ordre de virement ne porte pas de degré d'urgence. |
| 51 | Imputation des lignes de l'extrait, avec date de valeur et reste à imputer, et passage au journal depuis l'extrait | 89 | PARTIEL | Une ligne du relevé importé sans écriture correspondante est dite « à comptabiliser » ; l'écriture se saisit au journal, rien n'est passé depuis le relevé (`releve-bancaire.ts`). La ligne du relevé ne porte pas de date de valeur. |

## Bilan du manuel

51 fonctions relevées, dont quatre vues sur les captures seulement :
10 FIDÈLE, 6 DIFFÉRENT VOULU, 1 DIFFÉRENT À TRIER, 11 PARTIEL, 23 ABSENT,
0 NON VÉRIFIÉ.

Neuf des vingt et une absences ont une même cause : OmegaX ne communique
pas avec les banques. Il ne produit aucun fichier, ne télétransmet
rien et ne reçoit rien automatiquement (lignes 11 à 13, 22, 32 à 34, 36,
37). Les autres touchent surtout des moyens de paiement qu'il ne gère
pas : prélèvement, LCR, remise de chèques, remise de cartes, virement
international.

## Relevé en passant

- `client/src/pages/ReglementsPage.tsx`, ligne 126 : un échec de lecture des
  lots est traité comme une liste vide (`.catch(() => setLots([]))`). Un
  échec de lecture doit être affiché, et ne doit pas se présenter comme une
  liste vide (CLAUDE.md § 9 ter). Le défaut est noté ici, il n'est pas
  corrigé, le gel tenant.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et le DIFFÉRENT, À TRIER. Deux points touchent
  directement les cabinets de RDC :
  - **Ligne 42**, les virements depuis un compte en dollars : l'ordre de
    virement est refusé sur un compte en dollars.
  - **Ligne 8**, le mode de règlement : il n'est enregistré nulle part.
