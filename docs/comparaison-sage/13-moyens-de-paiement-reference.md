# Sage Moyens de paiement, manuel de référence · fonction par fonction

Manuel 13 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Logiciel de gestion des moyens de paiement, version 16.02, Manuel
de référence », Sage, 2009, 555 pages (Drive, fichier « sommaimp », id
1kagysLQZQ5o56v7F-U8Vvt6f7M9kYCO4).

**Ce qui a été lu, et ce qui ne l'a pas été.** Le texte servi par le Drive
s'arrête à la page 80. Le PDF entier n'a pas pu être téléchargé : à cette
taille, le téléchargement fait tomber le connecteur Drive (même échec que
pour les manuels 3 et 8). Il en résulte trois niveaux de lecture, le
2026-10-14 :

- les pages 1 à 80 (introduction, nouveautés de la version 16, menu Fichier
  jusqu'aux modes de règlement) ont été lues en entier, en texte ;
- les pages 81 à 555 ne sont connues que par le sommaire détaillé du manuel,
  qui donne le titre de chaque section et sa page. Chaque ligne qui en vient
  ne compare que la fonction que ce titre nomme ; deux titres dont la
  fonction ne se devine pas (« Montants », p. 265 ; « Registres »,
  p. 309) ne sont pas comparés ;
- aucune capture d'écran n'a été lue, faute du PDF.

C'est le manuel de référence du logiciel dont le manuel 5 est la prise en
main. Il repose sur les mêmes normes françaises et européennes (CFONB, AFB,
SEPA, LCR, ETEBAC, EBICS), qu'aucun texte lu ne rend applicables en RDC.
Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« M1-n » à « M12-n » renvoient aux lignes des autres manuels, « M4 B-n » à
la partie B du manuel 4. Les statuts ont été lus dans le code le même jour,
sur la branche `travail/virement-fonds`, et aucune ligne n'est restée non
vérifiée.

## Introduction et nouveautés de la version 16 (p. 14 à 26)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Norme SEPA : virements (SCT) et prélèvements (SDD) | 17, 18, 23 | ABSENT | Voir M5-23 et M5-44. |
| 2 | Fonctions disponibles selon la version achetée | 20 à 22 | DIFFÉRENT, VOULU | Les modules s'activent par dossier, selon l'abonnement du cabinet (`tenant/modules-optionnels.ts`). |
| 3 | Protocole EBICS de transmission des fichiers bancaires | 23 | ABSENT | Voir M5-13. |
| 4 | Assistant d'enrichissement des données bancaires des tiers | 23 | ABSENT | Les RIB des tiers se saisissent un à un par l'administrateur, IBAN contrôlé (`tiers/ribs-tiers.ts`). |
| 5 | Intégration des relevés de LCR à payer et des extraits reçus de la banque | 23 | PARTIEL | Le relevé de banque s'importe en CSV ou XLSX dans un rapprochement (M5-28). Pas de LCR. |
| 6 | Journal d'escompte et journal d'encaissement par banque | 24, 475 | ABSENT | Un seul journal par RIB (voir M5-10). |
| 7 | Alertes sur les échéances brûlantes, avec un délai de pré-alerte | 24, 61 | ABSENT | Aucune alerte sur les échéances des tiers. Le tableau de bord n'annonce que les échéances fiscales et sociales, à trente jours (`lib/echeances-a-venir.ts`). |
| 8 | Création ou modification du compte bancaire d'un tiers pendant la saisie d'une échéance | 24 | DIFFÉRENT, VOULU | Le RIB d'un tiers est une structure : créé par l'administrateur seul, depuis la fiche du tiers, et inscrit au journal d'audit, parce qu'un RIB changé en silence détourne un paiement (`tiers/ribs-tiers.ts`). |
| 9 | Virements de trésorerie, et lien avec Sage Trésorerie | 17, 24 | FIDÈLE | Virement de fonds d'une trésorerie à une autre, par le 585 (voir M5-45). Ce code est sur la branche `travail/virement-fonds`, pas encore sur `main`. |
| 10 | Édition chaînée des extraits de compte | 25 | ABSENT | Il n'existe pas de liste des extraits (M5-30). |
| 11 | Génération des écarts de change | 25, 473 | FIDÈLE | Écart de change réalisé, proposé au lettrage et passé au seul clic, sur le compte que prescrit le plan (ligne A6, `reglements/ecart-change-realise.ts`). |
| 12 | Effets à vue inclus dans les remises | 25 | ABSENT | OmegaX ne gère pas les effets de commerce. |
| 13 | Traitement multi-sociétés des fichiers bancaires et des extraits | 45, 493 | ABSENT | Un relevé s'importe dans le rapprochement d'un compte du dossier ouvert. |

## Menu Fichier (p. 30 à 161)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 14 | Création du fichier par assistant : fichier comptable lié ou créé, exercice, longueur des comptes, devises, reprise des éléments comptables | 32 à 45 | DIFFÉRENT, VOULU | Voir M5-3 : tout est dans un seul dossier. |
| 15 | Ouvrir, favoris, fermer | 45 à 48 | DIFFÉRENT, VOULU | Voir M4 B-7. |
| 16 | Identification et contacts de la société (type de contact, fonction, téléphone, portable, courriel) | 49 à 55 | PARTIEL | Voir M5-6. |
| 17 | Référence et date proposées pour les échéances reprises de la comptabilité (numéro de facture, de pièce ou référence ; date de la pièce ou du jour) | 56 | PARTIEL | Règlement des tiers lit les échéances ouvertes avec leur pièce, et l'ordre de virement imprime chaque facture réglée avec sa part (`LigneOrdreVirement.imputationDeclaree`). La référence du règlement se saisit ; rien ne se règle par défaut. |
| 18 | Écart de règlement passé d'office sur un compte de charge ou de produit, sous un seuil paramétré | 56, 57, 299 à 303 | ABSENT | Voir M5-40 : un paiement inférieur au dû reste partiel, un paiement supérieur est refusé. |
| 19 | Répartition d'un règlement entre hors taxe et TVA sur encaissement (au prorata, ou les taux sur les débits d'abord) ; registres de taxe | 57, 309, 473 | DIFFÉRENT, VOULU | La taxe exigible à l'encaissement se date par l'imputation des paiements du Code civil, Livre III, art. 151 à 154 : la déclaration du débiteur, sinon les factures échues puis la plus ancienne (`imputation-paiements.ts`). Aucune écriture de transfert n'est passée. |
| 20 | Transfert IFRS des ventilations | 57, 471 | DIFFÉRENT, VOULU | Voir M4 B-11. |
| 21 | Comptes et journal des escomptes financiers (accordés, obtenus) | 58, 421 à 427 | ABSENT | Voir M5-40. |
| 22 | Comptes de perte et de gain de change paramétrés | 58 | DIFFÉRENT, VOULU | Le compte est celui que prescrit le plan du référentiel, sous-comptes offerts (`racinesAdmises`, ligne A6) ; il ne se paramètre pas. |
| 23 | Contrôle de l'équilibre des devises : aucun, alerte, montant en devise ajusté ou cours recalculé | 59 | DIFFÉRENT, VOULU | La ligne en devise doit valoir sa contre-valeur au centime, sinon elle est refusée ; sans cours, le cours se déduit (`ligne-en-devise.ts`, audit final F49). Rien n'est ajusté d'office. |
| 24 | Ouverture d'un compte pendant la saisie d'une échéance | 59 | DIFFÉRENT, VOULU | Seuls les comptes personnalisés se saisissent ; un compte s'ouvre au Plan comptable ou naît avec le tiers (décision de Manasse du 2026-10-09). |
| 25 | Recherche systématique des écritures non lettrées du tiers, avec un écart de sélection ; recherche sur le tiers payeur | 59 à 61, 282, 288 à 294 | PARTIEL | Règlement des tiers liste toutes les échéances ouvertes du tiers (M5-18). Ni écart de sélection, ni tiers payeur. |
| 26 | Interdire les éléments en sommeil ; confirmation des suppressions ; appel des tiers par abrégé ou par numéro | 60 à 62 | PARTIEL | Un compte en sommeil n'est accepté qu'avec confirmation (`confirmerComptesEnSommeil`), et plusieurs écrans demandent confirmation avant une suppression. Aucun de ces comportements ne se règle. |
| 27 | Numéros d'émetteur national et SEPA ; date d'exécution et référence portées dans les fichiers | 60 | ABSENT | Voir M5-7 et M5-11. |
| 28 | Purge des historiques de remises et des extraits ; suppression des relevés après incorporation | 61, 63, 148 à 152 | DIFFÉRENT, VOULU | Voir M5-48 : rien ne se purge. |
| 29 | Paramètres d'un compte créé, repris du compte le plus proche ou de sa nature | 62, 63 | FIDÈLE | Les natures de compte donnent le report et le lettrage par défaut (`comptes/natures-compte.ts`) ; un sous-compte reprend les réglages du compte du plan qu'il subdivise (`CompteService.creer`). |
| 30 | Champs statistiques des tiers, codes risque, informations libres (texte, montant, date, table, valeur calculée) | 64 à 79 | ABSENT | Voir M4 B-14 et M10-102. |
| 31 | Codes interbancaires et modes de règlement (trente au plus) | 64, 67, 80, 131 | ABSENT | Voir M5-8. |
| 32 | Devises : cotation, ancienne cotation | 64, 69 à 72 | PARTIEL | Voir M4 B-17. |
| 33 | Fichiers liés aux autres applications | 64, 73 | DIFFÉRENT, VOULU | Voir M4 B-12. |
| 34 | Tables d'options : motifs de rejet (SEPA compris), motifs économiques, natures de compte, colonnes des fenêtres, pays, plans analytiques, services et types de contact, structure des banques, types de tiers | 64, 81 à 91, 107 à 110 | PARTIEL | Sept natures de compte, plans analytiques, types de tiers fixés (`TypeTiers`), pays en champ libre. Ni motifs de rejet, ni motifs économiques, ni types de contact, ni colonnes réglables. |
| 35 | Schémas comptables : étapes de suivi d'un mode de paiement et comptabilisation de chaque étape | 92 à 98 | DIFFÉRENT, À TRIER | Une seule étape : le règlement passe sa pièce à l'enregistrement. Voir M5-19. |
| 36 | Calendrier bancaire : jours ouvrés et travaillés, pour les dates de remise | 114 à 117 | ABSENT | Aucune date de remise n'est calculée. La seule liste de jours fériés sert aux échéances fiscales (`retenues/jour-ouvrable.ts`). |
| 37 | Calcul des cumuls, lecture des informations, utilisateurs connectés, messages entre utilisateurs | 118 à 121 | ABSENT | Voir M4 B-31. Pas de messagerie entre utilisateurs. |
| 38 | Autorisations d'accès | 123 | DIFFÉRENT, VOULU | Cinq rôles, profil de fonctions et journaux autorisés par utilisateur (CLAUDE.md § 8). |
| 39 | Import et export au format paramétrable (écritures, tiers), contrôle de cohérence, règles d'export | 124 à 140 | PARTIEL | Voir M4 B-32 : plan, balance et écritures s'importent, colonnes désignées par l'utilisateur. |
| 40 | Impression des paramètres société, mise en page, formats d'impression | 143 à 145 | DIFFÉRENT, À TRIER | Voir M1-109 et M4 B-33 : on imprime la fenêtre. |
| 41 | Transmettre et mettre à jour les comptes bancaires des tiers (Sage directDéclaration) | 153, 154 | ABSENT | OmegaX ne communique pas avec les banques. |
| 42 | Recalcul des informations libres, maintenance et son journal, import et export des préférences | 155 à 159 | ABSENT | Voir M4 B-36. |
| 43 | Lancement des applications Sage ; quitter | 160, 161 | DIFFÉRENT, VOULU | Voir M4 B-34. |

## Menu Structure (p. 163 à 266)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 44 | Plan tiers : identification et complément | 165 à 175 | FIDÈLE | Plan des tiers, structure réservée à l'administrateur. |
| 45 | Contacts d'un tiers | 170, 171 | PARTIEL | Un contact par tiers (`Tiers.contact`). |
| 46 | Banques d'un tiers et mandat de prélèvement SEPA | 176 à 179 | PARTIEL | Voir M6-50 : RIB des tiers, aucun mandat. |
| 47 | Solvabilité et surveillance d'un tiers | 179 à 181 | ABSENT | Voir M10-102. |
| 48 | Modèles affectés à un tiers | 182 à 184 | PARTIEL | Un modèle de règlement par tiers (`Tiers.modeleReglementId`), qui ne calcule que les échéances (M5-8). |
| 49 | Duplication d'un tiers | 185 | ABSENT | Pas de duplication. |
| 50 | Statistiques et champs libres d'un tiers | 186, 187 | ABSENT | Voir M4 B-14. |
| 51 | Documents attachés à un tiers | 188, 189 | FIDÈLE | `tiers/documents-tiers.ts`. |
| 52 | Cumuls et graphiques d'un tiers | 189 à 191 | PARTIEL | Voir M10-103. |
| 53 | Banques : identification, contacts, RIB | 192 à 202 | PARTIEL | Voir M3-8, M3-9 et M5-10. |
| 54 | Paramètres Direct d'une banque : contrat, sécurité, services | 195 à 197 | ABSENT | Voir M5-13. |
| 55 | Complément d'une banque (paramètres, délais et heures limites, remise Dailly, donneur d'ordre) ; volet International | 203 à 211 | ABSENT | Voir M5-11, M5-42 et M5-49. |
| 56 | Plan comptable tenu dans le module : assistant de création, fiche (bloc-notes, information libre, analytique et IFRS), cumuls et graphiques | 213 à 227 | DIFFÉRENT, VOULU | Le module se sert du plan du dossier (M4 A-13). La fiche du compte est comparée en M10-9. |
| 57 | Plan analytique : structure des numéros de section, génération automatique des sections | 228 à 243 | PARTIEL | Plans et sections, créés un à un (`analytique.controller.ts`). Pas de génération automatique. |
| 58 | Taux de taxes | 244 à 248 | PARTIEL | Voir M6-53. |
| 59 | Codes journaux : assistant, journaux de trésorerie, numérotation | 249 à 255 | FIDÈLE | Voir M1-77 à M1-84. |
| 60 | Modèles de grille | 256 à 258 | ABSENT | Voir M1-19. |
| 61 | Modèles de règlement | 259 à 262 | PARTIEL | Voir M6-51. |
| 62 | Types de remise | 263, 264 | ABSENT | La seule remise est l'ordre de virement imprimé (M5-20). |
| 63 | Libellés | 266 | FIDÈLE | Libellés proposés en liste, sans imputation (point 19). |

## Menu Traitement (p. 268 à 519)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 64 | Encaissements : saisie d'un règlement ou d'un effet, recherche des écritures non lettrées, association après coup | 271 à 299 | PARTIEL | Règlement des tiers côté clients, lettré aussitôt (M5-18). Pas d'effet (M5-24). |
| 65 | Gestion des règlements et des écarts : partiels, écarts, devises, modification après pointage | 299 à 303 | PARTIEL | Partiels admis, écart de change réalisé passé (ligne A6). Pas d'écart de règlement (M5-40). |
| 66 | Prélèvements émis, réguliers, et leur transmission | 311, 348 à 355 | ABSENT | Voir M5-44. |
| 67 | LCR-BOR à l'encaissement et au décaissement ; relevés de LCR à payer ; bons à payer | 329, 385, 429 à 436 | ABSENT | Voir M5-24 et M5-47. |
| 68 | Transformation et suivi des échéances par étapes ; remise en banque ; différer | 330 à 347 | DIFFÉRENT, À TRIER | Voir M5-19. |
| 69 | Autres encaissements : cartes bancaires, chèques, espèces | 326, 344 à 347, 385 | PARTIEL | Le versement d'espèces passe par le virement de fonds (M5-45). Ni remise de chèques ni de cartes (M5-43, M5-46). |
| 70 | Décaissements : virements émis et réguliers, sélection des écritures non lettrées | 356 à 367 | FIDÈLE | Règlement des tiers côté fournisseurs, ordre de virement, lots (M5-25, M5-27). |
| 71 | Virement de trésorerie, domestique ou international | 368 à 375 | PARTIEL | Virement de fonds domestique par le 585 (M5-45). Pas de virement international. |
| 72 | Virements internationaux | 376 à 384 | FIDÈLE | Voir M5-42 · ordre en devise du RIB du journal depuis la ligne sage-l3 (n° 37). |
| 73 | Assistant de gestion des échéances : incorporer depuis la comptabilité, importer d'une application externe, constituer et transmettre une remise | 386 à 412 | PARTIEL | Les échéances ouvertes se lisent dans le dossier (`GET /reglements/echeances`). Aucune échéance ne s'importe d'ailleurs, et aucune remise ne se transmet. |
| 74 | Remise Dailly | 404 | ABSENT | Voir M5-49. |
| 75 | Exportation des échéances et des écritures au format texte | 405, 406 | ABSENT | Aucun fichier de remise n'est produit (M5-22). |
| 76 | Règlements groupés | 413 à 420 | FIDÈLE | Voir M5-39. |
| 77 | Escomptes financiers | 421 à 427 | ABSENT | Voir M5-40. |
| 78 | Remises en attente ; historique des remises ; réémission d'une échéance | 437 à 445 | PARTIEL | Liste des ordres de virement par état (M5-35). Ni remise en attente ni réémission. |
| 79 | Interrogation des échéances et interrogation comptable des tiers | 446 à 456 | FIDÈLE | Échéancier et interrogation des comptes ; les restes d'une facture réglée en partie sont imputés par la loi (`lettrage/reste-des-lignes-ouvertes.ts`). |
| 80 | Lots préétablis : virements, virements internationaux et prélèvements ; duplication ; modification en rafale | 25, 457 à 464 | PARTIEL | Lots de virements aux fournisseurs (M5-25). Ni lots internationaux, ni lots de prélèvements, ni modification en rafale. |
| 81 | Mise à jour de la comptabilité : journal de trésorerie ou général, devises, période clôturée | 465 à 470 | FIDÈLE | La pièce de règlement passe au journal de trésorerie choisi dès l'enregistrement. Dans une période close, elle se reporte au premier jour ouvert si on le demande (AUDCIF art. 22, 4°, `reporterAuPremierJourOuvert`). |
| 82 | Écritures des virements de trésorerie | 469 | FIDÈLE | Deux pièces par le 585, nées ensemble (M5-45). |
| 83 | Incidence de la norme fiscale française sur la mise à jour de la comptabilité | 473 | DIFFÉRENT, VOULU | Règle française non lue pour la RDC. Les écritures entrent au brouillard et se valident avec les autres pièces (AUDCIF art. 22, 2°). |
| 84 | Extraits : gestion, consultation, saisie manuelle ou modification, incorporation avec la devise du RIB | 476 à 493 | PARTIEL | Le relevé s'importe dans un rapprochement (M5-28, M5-30). Une ligne de relevé ne se saisit pas à la main. |
| 85 | Liste des mouvements bancaires | 494 à 497 | PARTIEL | Les mouvements d'un compte de banque se lisent au grand livre et dans le rapprochement. |
| 86 | Analyse des soldes et tableau de bord | 500 à 506 | PARTIEL | Voir M5-31. |
| 87 | Fichiers bancaires reçus : comptes rendus, cartes affaires, décomptes monétiques, mouvements à comptabilisation future ; transfert de fichiers AFB | 507 à 514 | ABSENT | Voir M5-34 et M5-36. |
| 88 | Téléchargement par internet | 515 | ABSENT | Voir M5-32. |
| 89 | Archivage fiscal des données | 517, 518 | DIFFÉRENT, VOULU | Voir M4 B-73. |

## Menu Fenêtre et interface bancaire (p. 520 à 555)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 90 | Réorganiser, actualiser, personnaliser l'interface (barres d'outils, menus, clavier, répertoires, programmes externes, favoris), les écrans, les listes et leurs colonnes | 521 à 534 | PARTIEL | Voir M4 B-90. |
| 91 | Préférences, barre verticale, mode assistant, mode personnalisé, exercices, fenêtres | 535 à 541 | PARTIEL | Barre verticale de l'accueil et sélecteur d'exercice. Pas de mode assistant (M2-8). |
| 92 | Interface Telbac : paramètres du serveur bancaire, services, transmission, génération des fichiers de remise, incorporation des relevés | 543 à 555 | ABSENT | Voir M5-12. |

## Bilan du manuel

92 fonctions relevées : 12 FIDÈLE, 16 DIFFÉRENT VOULU, 3 DIFFÉRENT À TRIER,
28 PARTIEL, 33 ABSENT, 0 NON VÉRIFIÉ.

Ce manuel de référence confirme ce que la prise en main (manuel 5) avait
montré, sans changer le constat : OmegaX tient le règlement et son
lettrage, le virement de fonds, l'écart de change réalisé et le
rapprochement, mais ne communique pas avec les banques et ne gère ni effets
de commerce, ni prélèvements, ni escomptes, ni virements internationaux. Il
ajoute quelques manques propres : l'alerte sur les échéances proches des
tiers (ligne 7), le calendrier bancaire (36), la duplication d'un tiers (49)
et la saisie manuelle d'une ligne de relevé (84).

Les pages 81 à 555 n'ont été comparées que sur leurs titres. Un relevé plus
fin demande le PDF, à déposer ailleurs que dans le Drive ou en morceaux.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et les DIFFÉRENT, À TRIER (lignes 35, 40 et 68,
  qui renvoient à M5-19 et M1-109).
- Pour une lecture complète des pages 81 à 555 et des captures : un PDF
  accessible autrement que par le connecteur Drive.
