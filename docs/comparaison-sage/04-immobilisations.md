# Sage 100 Immobilisations i7 · fonction par fonction

Manuel 4 de la comparaison complète demandée par Manasse le 2026-10-09.
Deux sources, lues en entier le 2026-10-14 :

- **A.** « Sage Immobilisations i7, séances 1 à 6 », 134 pages (Drive, id
  1qbsRt7NxE2kbQoaLdZ_-FpHM1pMaISio). Le texte Drive s'arrêtant à la page 80,
  le PDF a été extrait page par page.
- **B.** « Les fonctions de Sage 100 Immobilisation », manuel de référence de
  311 pages (Drive, id 1BA4x8p1tuRZW1PVlGBxxLCWKXxS-mlmu), extrait du PDF.

Méthode et légende : celles du manuel 1 (`01-guide-utilisateur-i7.md`).
« A-n » et « B-n » renvoient aux lignes des deux parties ci-dessous, et
« M1-n » à « M5-n » aux lignes des autres manuels. Les statuts ont été lus
dans le code le même jour, sur la branche `travail/virement-fonds`, et aucune
ligne n'est restée non vérifiée.

Les captures d'écran ont été lues ensuite en image, le même jour : les 103
pages des séances qui en portent, et les trois pages illustrées du manuel de
référence (p. 1, 2 et 163), qui est un texte. Elles précisent les lignes A-10,
A-14, A-20, A-25 et B-57, et en ajoutent trois (A-27 à A-29). Plusieurs
captures des séances sont coupées ou en partie masquées (p. 21, 27, 29, 31,
33, 34, 40, 60 à 63, 70, 71, 77, 83, 84, 89, 92, 102, 109, 110, 113, 114 et
117) ; rien n'est tiré de ce qui ne s'y lit pas.

## A. Séances de formation

Cours pratique de 2023 (supports de Marnouch Bouchaib, société d'exemple
EM Express). Le cours est marocain : plan comptable CGNC, dirhams,
coefficients dégressifs marocains, liasse fiscale SIMPL. Seules les fonctions
du logiciel sont reprises. La théorie comptable des pages 7 à 22 ne l'est
pas.

### Installation et fichier (p. 29 à 56)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Installation avec clé d'authenticité | 29 à 32 | DIFFÉRENT, VOULU | En ligne, il n'y a rien à installer. Sur site, la licence est un fichier signé, lié au poste (`src/modules/sur-site/`). |
| 2 | Fichier immobilisations distinct, créé par assistant : raison sociale, exercice, longueur des comptes, monnaie | 33 à 41 | DIFFÉRENT, VOULU | Pas de fichier à part : les biens vivent dans le dossier comptable et en reprennent l'exercice, la longueur des comptes et la monnaie de tenue (le franc congolais, imposé). |
| 3 | Paramètres société : identification, comptes, tiers, régime fiscal | 42 à 48 | FIDÈLE | Ce sont les paramètres du dossier, communs à tous les modules. |
| 4 | Base de prorata de 360 jours | 49 | DIFFÉRENT, VOULU | Le prorata se compte en mois, à partir du premier jour du mois de mise en service (loi n° 23/053, art. 34, `immobilisation.service.ts`). Au Système minimal SYSCOHADA, la première année est entière (AUDCIF Titre X). |
| 5 | Natures d'acquisition : acquisition, production, échange, reprise | 51 | FIDÈLE | La contrepartie se choisit dans une liste fermée (trésorerie, 481x, 72 pour la production, apport…, `contrepartie-acquisition.ts`). L'échange (`POST :id/echange`) et le bien repris (`repris`) ont leur propre geste. S'y ajoutent le legs, le prix global, le prix aléatoire et la location-acquisition. |
| 6 | Natures de bien : incorporel ou corporel, amortissable ou non, financier | 52 | DIFFÉRENT, VOULU | La nature n'est pas saisie : elle se lit sur le compte du bien. Un bien non amortissable (terrain, titre) se voit refuser la dotation (`compte-du-bien.ts`). |
| 7 | Coefficients dégressifs saisis par l'utilisateur | 53 | DIFFÉRENT, VOULU | Les coefficients 1,5, 2 et 2,5 sont fixés par la loi n° 23/053, art. 33, et ne se saisissent pas (`amortissement-degressif.ts`). |
| 8 | Natures de sortie : cession, mise hors service, renouvellement de composant | 54 | FIDÈLE | La liste fermée est plus large : vente, échange, rebut, destruction, vol, disparition, remise gratuite, restitution (`nature-sortie.ts`). Le renouvellement de composant a son propre geste (`POST :id/renouvellement`). |
| 9 | Mise hors service avec « dotation aux amortissements exceptionnels » | 54, 128 à 131 | DIFFÉRENT, VOULU | La valeur nette du bien sorti va au 81 (fiche du compte 81) ; aucune dotation exceptionnelle n'est calculée. |
| 10 | Options de sortie | 50 | FIDÈLE | La capture montre le recalcul de la valeur de sortie, la dotation complémentaire jusqu'à la date de sortie, et la date de sortie prise dans le calcul selon le mode (oui en linéaire, exceptionnel et manuel, non en dégressif). OmegaX arrête la dotation à la sortie, mois de sortie compris, quel que soit le mode (fiche du compte 81 ; voir B-24). |
| 11 | Comptabilisation annuelle des dotations | 55 | FIDÈLE | Une dotation par bien et par exercice (`POST :id/dotation`). |
| 12 | Mot de passe du fichier | 56 | DIFFÉRENT, VOULU | L'accès se contrôle par utilisateur : session, rôle, double authentification. |

### Structure (p. 57 à 84)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 13 | Plan comptable et codes journaux propres au module | 58 à 67 | DIFFÉRENT, VOULU | Le module se sert du plan et des journaux du dossier ; la dotation est passée dans le journal choisi. |
| 14 | Lieux des biens | 68, 69 | PARTIEL | `LieuBien` : création et suppression réservées à l'administrateur ; affectation d'un bien par le comptable. Les captures montrent aussi l'adresse, le code postal, la ville et les contacts du lieu, qu'OmegaX n'a pas (voir B-45). |
| 15 | Familles d'immobilisations : identification, amortissement, comptes | 70 à 75 | DIFFÉRENT, VOULU | Depuis la décision de Manasse du 2026-10-01, la famille suit le compte du bien : le 28 et le 68 se lisent dans le plan, et aucune famille ne se saisit (`compte-du-bien.ts`). |
| 16 | Fiche du bien : identification, amortissement, paramètres | 77 à 82 | FIDÈLE | Désignation, numéro d'inventaire, lieu, compte, dates d'acquisition et de mise en service, valeur, durée, mode, valeur résiduelle. |
| 17 | Bien en location avec échéancier des loyers | 83, 84 | DIFFÉRENT, VOULU | La location-acquisition entre au bilan avec sa dette (AUDCIF Titre VIII ch. 8). L'échéancier est mensuel, trimestriel, semestriel ou annuel (`location-acquisition/`). Aucune location simple n'est suivie en dehors de la comptabilité. |

### Traitements (p. 85 à 134)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 18 | Quantité d'un bien et inventaire des quantités | 87 à 89 | ABSENT | La fiche du bien n'a pas de champ quantité. |
| 19 | Fractionnement d'un bien en plusieurs fiches (valeur, quantité, lieu) | 85 à 95 | ABSENT | Pas de fractionnement. Seule une partie non identifiée d'un bien peut être détachée lors d'un remplacement (`partie-remplacee.ts`). |
| 20 | Plan d'amortissement du bien, année par année | 98 à 102 | PARTIEL | Seul le plan fiscal dégressif est montré (`PlanFiscalDegressif.tsx`). Le plan comptable complet n'est pas affiché ; le tableau des amortissements se lit exercice par exercice. Les captures (p. 98, 102) montrent le plan jusqu'à la dernière annuité, chaque ligne marquée de sa position (clôturée, calculée, saisie, simulée, dotation de sortie, révision, réévaluation…), et son impression. |
| 21 | Calcul des amortissements de tous les biens, puis état des amortissements | 103 à 105 | PARTIEL | La dotation se passe bien par bien. Le tableau des amortissements de l'exercice signale une dotation calculée mais pas encore passée (`TableauxImmobilisationsPage.tsx`). |
| 22 | Mise à jour de la comptabilité depuis le module | 106 à 119 | DIFFÉRENT, VOULU | Chaque geste (dotation, sortie, dépréciation) passe sa propre écriture dans le dossier ; il n'y a pas de transfert à part. |
| 23 | Transfert vers la liasse fiscale (logiciel séparé) | 120, 121 | FIDÈLE | Il n'y a pas de transfert : les états et les notes des immobilisations sont produits dans le même dossier. Seules les notes des plus et moins-values de cession font exception (voir A-25). |
| 24 | Cession d'une partie des unités d'un bien | 123 à 127 | ABSENT | La sortie porte sur le bien entier, faute de quantité (voir A-18). |
| 25 | État des sorties | 127, 131 | PARTIEL | Pas d'état dédié. Le tableau des immobilisations nomme, hors total, les biens sortis dans l'exercice. Les notes des plus et moins-values de cession (NOTE 3D au SYSCOHADA, NOTE 5G aux associations) restent entièrement en saisie, alors que le module tient le brut, les amortissements et le prix de chaque bien sorti. Les captures (p. 127, 131) montrent l'état de Sage : une rubrique par nature de sortie, quantité, valeur de sortie, valeur nette corrigée et plus ou moins-value, totaux par nature et général. |
| 26 | Nouvel exercice ouvert après les écritures de fin d'année | 133, 134 | FIDÈLE | C'est l'exercice du dossier : pas de clôture propre au module. |

### Vu sur les captures seulement

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 27 | Date de départ de l'amortissement choisie sur la famille et sur le bien (date d'acquisition dans l'exemple), prorata au mois | 72, 80 | DIFFÉRENT, VOULU | Le plan part de la mise en service, jamais de l'acquisition : sans date de mise en service, aucune dotation (`debutAmortissement`, `incorporel-duree-non-limitee.ts`). Seule la bascule d'un incorporel à durée non limitée fixe une autre date de départ. |
| 28 | Mise à jour de la comptabilité filtrée par nature d'écriture (dotations, sorties, virements, autres), puis proposition de clôturer les écritures transférées | 113, 114 | DIFFÉRENT, VOULU | Chaque geste passe son écriture au brouillard (`EcritureService.creer`), qui se valide avec les autres pièces (AUDCIF art. 22, 2°). La proposition de Sage cite une règle fiscale française. |
| 29 | Date de la dernière mise à jour comptable affichée sur la fiche du bien | 81, 109 | PARTIEL | La fiche ne la porte pas. Le tableau des amortissements signale une dotation calculée mais pas encore passée (voir A-21). |

## B. Manuel de référence (311 pages)

Ce manuel de Sage est écrit pour la France : IR ou IS, plus-values à court
et à long terme, taxe professionnelle, taxe foncière, taxe sur les véhicules
de sociétés, feuillets 2054 à 2059, archivage fiscal. Aucune de ces règles
n'a été lue pour la RDC. Lorsqu'elles manquent à OmegaX, l'absence est
notée sans être jugée.

Pour lire ce manuel, deux agents de relevé ont dressé l'inventaire de ses
options, page par page : 317 sur les pages 1 à 160, 271 sur les pages 161
à 311. Elles sont regroupées ci-dessous par fonction, et le statut de chaque
fonction a été lu dans le code. Les éléments de structure propres à Sage
Comptabilité (plan comptable, tiers, journaux, analytique, devises) sont
traités dans les manuels 1 à 3 et ne sont rappelés ici que par renvoi.

### Fichier, paramètres et options (p. 9 à 76)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Fichier immobilisations (.IMO) lié au fichier comptable, version Windows et Macintosh | 9, 12, 13 | DIFFÉRENT, VOULU | Voir A-2 : les biens vivent dans le dossier comptable. |
| 2 | Connexions réseau comptées, plafonnées par la licence | 13 | DIFFÉRENT, VOULU | La licence suit l'abonnement du cabinet. Aucun plafond de connexions simultanées n'est compté. |
| 3 | Menu Édition : dupliquer, inverseur vers une devise d'équivalence, calculette, rechercher, atteindre | 15 | PARTIEL | La calculette existe (`Calculette.tsx`). Il n'y a ni duplication d'un bien ni affichage dans une devise d'équivalence. |
| 4 | Assistant de création : fichier comptable lié ou créé, reprise d'un plan modèle, capacité du fichier | 18 à 23 | DIFFÉRENT, VOULU | Voir A-2. Le plan du référentiel est semé à la naissance du dossier. |
| 5 | Exercice : durée de 36 mois au plus, exercices antérieurs générés, fin modifiable, dernier exercice supprimable | 22, 23, 32, 196 | DIFFÉRENT, VOULU | Ce sont les exercices du dossier : premier exercice long admis sans plafond à douze mois (AUDCIF art. 7). Aucun exercice ne se supprime (M3-40). |
| 6 | Mot de passe de quatre caractères, autorisations par groupe | 24, 59 | DIFFÉRENT, VOULU | Voir A-12. |
| 7 | Favoris de fichiers, fichier resté ouvert après une panne | 24 | DIFFÉRENT, VOULU | Il n'y a pas de fichier à ouvrir : la session ouvre le dossier de l'utilisateur. |
| 8 | Identification de la société : raison sociale, activité, coordonnées, téléphone, courriel, site, immatriculation | 26, 27 | FIDÈLE | Paramètres du dossier, communs à tous les modules. |
| 9 | Annuaire des contacts de la société : type, civilité, service, fonction | 27, 28, 41 | PARTIEL | Voir M5-6. |
| 10 | Monnaie de tenue, formats, devise d'équivalence | 28, 29 | DIFFÉRENT, VOULU | Le franc congolais est imposé (loi n° 23/053, art. 141, 1° ; AUDCIF art. 17, 1°). |
| 11 | IFRS : plans économique et natif par famille et par bien, journaux réservés, norme choisie à l'édition | 11, 29, 30, 99, 205 | DIFFÉRENT, VOULU | La fiche du bien et le grand livre ne portent que le référentiel légal. L'IFRS se construit à côté, par règles de correspondance et retraitements (`docs/decision-multi-classification.md`). |
| 12 | Fichiers liés : commercial, trésorerie, paie | 30 | DIFFÉRENT, VOULU | Tout est dans un seul dossier. |
| 13 | Préférences : confirmation des suppressions, éléments en sommeil | 30 à 32 | FIDÈLE | Un compte en sommeil n'est accepté qu'avec confirmation, et une famille en sommeil est fermée (audit final F128). |
| 14 | Informations libres (jusqu'à 64, de type texte, montant, date ou table) et dix champs statistiques sur les biens, familles, comptes et tiers | 34 à 38, 52, 86, 101, 182 | ABSENT | Aucun champ libre ni statistique n'existe. |
| 15 | Paramètres des tiers : codification, modes de règlement, codes risque, collectifs | 36 à 38 | PARTIEL | Voir M2-3 et M2-4. Les modes de règlement n'existent pas (M5-8). |
| 16 | Analytique : plan analytique des immobilisations, section sur la famille, ventilation des comptes par grille | 39, 40, 80, 85, 86 | ABSENT | Ni la famille ni la fiche du bien ne portent de section analytique. |
| 17 | Devises : cotation certaine ou incertaine, cours de période, cours de clôture, ancienne cotation ; pays | 42 à 45 | PARTIEL | Les devises ont des cours datés, en francs pour une unité de devise (`coursApplicable`). Il n'y a ni cours de période, ni ancienne cotation, ni cotation incertaine. |
| 18 | Natures fiscales affectées aux familles et aux biens | 46, 47, 96 | FIDÈLE | `Immobilisation.natureFiscaleCle` : la nature du bien au barème de l'arrêté n° 013/2025, qui propose une durée sans jamais l'imposer. |
| 19 | Type d'imposition IR ou IS, et plus ou moins-values à court ou à long terme selon la durée de détention | 46, 149, 173, 174, 304, 305 | ABSENT | Ces règles françaises n'ont pas été lues pour la RDC. OmegaX inscrit la valeur nette au 81 et le prix au 82, sans calculer de plus-value. |
| 20 | Taxe professionnelle, taxe foncière, taxe sur les véhicules de sociétés : paramètres, données par bien, états préparatoires | 46 à 49, 107 à 109, 228 à 232 | ABSENT | Ce sont des taxes françaises. OmegaX ne calcule aucun impôt assis sur les biens. |
| 21 | Transfert vers la liasse paramétrable : rubriques, colonnes, comptes | 49, 50, 195, 196 | DIFFÉRENT, VOULU | Voir A-23. |
| 22 | Base de prorata : 360 jours ou jours réels | 50, 82 | DIFFÉRENT, VOULU | Voir A-4. |
| 23 | Dotations antérieures cumulées sur une ligne, pour un bien acquis avant le premier exercice | 50, 92, 143 | FIDÈLE | Bien repris avec son `amortissementAnterieur`, sans écriture d'acquisition (audit final F32). |
| 24 | Options de sortie : recalcul de la valeur de sortie ; dotation complémentaire jusqu'à la date de sortie, réglée par mode | 51, 52 | FIDÈLE | La dotation s'arrête à la sortie, mois de sortie compris (fiche du compte 81, audit final F27). La règle est fixe et ne se règle pas par mode. |
| 25 | Coefficients dégressifs datés (normal, majoré, minoré) ; passage au linéaire selon la règle belge | 51, 53, 54 | DIFFÉRENT, VOULU | Voir A-7. La bascule au linéaire suit l'art. 35 de la loi n° 23/053. |
| 26 | Report des arrondis sur le dernier exercice | 51 | FIDÈLE | La dernière annuité est bornée par le reliquat (`immobilisation.service.ts`). |
| 27 | Comptes par défaut de la famille : dérogatoire, sortie, exceptionnel, provision, réévaluation | 55, 56, 84, 85, 116 | DIFFÉRENT, VOULU | Le 28 et le 68 se lisent dans le plan à partir du compte du bien (`compte-du-bien.ts`). Les autres comptes se choisissent au moment du geste (le 29 et sa contrepartie pour une dépréciation, par exemple). |
| 28 | Comptabilisation mensuelle ou annuelle, regroupement par compte, journaux général et de situation, sorties comptabilisées à leur date | 56, 57 | PARTIEL | Chaque geste passe sa propre écriture, bien par bien, dans le journal choisi : une dotation annuelle, une sortie à sa date. Il n'y a ni dotation mensuelle, ni écriture de situation, ni regroupement par compte. |
| 29 | Contrôle d'archivage ; création d'exercice refusée tant que deux exercices sont ouverts | 55, 57, 121 | DIFFÉRENT, VOULU | On ouvre N+1 avant de clôturer N (AUDCIF art. 23), et les clôtures se font dans l'ordre. La trace est tenue par le journal d'audit chaîné. |
| 30 | Montants nuls imprimés en blanc ou en zéro | 57 | DIFFÉRENT, VOULU | Une absence s'écrit « · » et ne se confond jamais avec zéro (`lib/montants.ts`). |
| 31 | Lire les informations (totaux par période, nombre d'éléments) ; utilisateurs connectés | 57 à 59 | ABSENT | Il n'existe ni écran de cumuls du module ni liste des utilisateurs connectés. |
| 32 | Import et export : formats Sage, format paramétrable, SYLK, texte, Excel, HTML, modèles d'export ; import complet d'un dossier (biens, plans, dotations, cessions, loyers, numéros de série) | 60 à 62, 254 à 311 | PARTIEL | On peut importer le plan des comptes, une balance et des écritures (`TypeImport`), et exporter les tableaux en Excel. Les biens ne s'importent pas : le registre d'un dossier repris se saisit fiche par fiche. |
| 33 | Mise en page des états, formats d'impression, impression différée, impression des paramètres | 62, 63, 136 | DIFFÉRENT, À TRIER | Voir M1-109 : on imprime la fenêtre. |
| 34 | Lancement des autres applications Sage | 63, 64 | DIFFÉRENT, VOULU | Il n'y a qu'un seul logiciel. |
| 35 | Fusion de deux fichiers d'immobilisations (assistant, correspondance des tables, statut « Fusion ») | 64 à 73, 141 à 155 | ABSENT | Pas de fusion de dossiers. |
| 36 | Renumérotation des codes, recalcul des informations libres, import et export des préférences, maintenance | 64, 74 à 76 | ABSENT | Aucun de ces outils n'existe. |

### Structure : familles et fiches (p. 77 à 140)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 37 | Famille de type détail ou total : code, intitulé, nature, section ; durées et modes économique, fiscal, natif et IFRS ; plancher de base | 77 à 87 | DIFFÉRENT, VOULU | Voir A-15. |
| 38 | Plafond fiscal d'amortissement sur la famille | 81, 166 | DIFFÉRENT, VOULU | L'amortissement qui dépasse le barème fiscal est réintégré au résultat fiscal (`AMORTISSEMENTS_EXCEDENT`), sans plafond sur la famille. |
| 39 | Modes d'amortissement : linéaire, dégressif, exceptionnel (taux saisis année par année), manuel | 81 à 84, 100, 167, 175, 176 | DIFFÉRENT, VOULU | Trois modes, figés au schéma (lot 11 ; AUDCIF art. 45) : linéaire, unités d'œuvre et dégressif. On ne saisit ni taux année par année ni annuité manuelle. |
| 40 | Liste des biens filtrée par lieu ; sélection par type et par état | 87, 88, 141 à 143, 285 | PARTIEL | La route filtre par statut (`GET /immobilisations?statut`), et l'écran affiche le statut et le lieu de chaque bien. Il n'y a pas de filtre par lieu à l'écran. |
| 41 | Modifier une fiche (un changement de compte propose un virement de poste) ; supprimer ; dupliquer | 88, 94, 156, 183 | ABSENT | Une fiche ne se modifie pas et ne se supprime pas. Après la création, seuls le lieu, la mise en service et la réserve de propriété peuvent se poser, et un changement de compte passe par le reclassement (B-57). Aucune duplication. |
| 42 | Assistant de création d'un bien en huit étapes | 88 à 93 | ABSENT | Un seul formulaire. Voir M2-8. |
| 43 | Type du bien : bien, crédit-bail, location, composant, composé ; code unique ; désignation et complément | 87, 95, 184, 190, 200 à 202 | PARTIEL | Désignation et numéro d'inventaire (non unique) ; composants rattachés à leur principal ; crédit-bail par la location-acquisition. Pas de complément de désignation, ni de location simple (A-17). |
| 44 | Acquisition : valeur hors taxes, date d'acquisition, valeur résiduelle, date de mise en service, quantité | 96, 191, 205 à 209 | PARTIEL | Tout y est sauf la quantité. Une date de mise en service vide signifie que le bien n'est pas encore en service. |
| 45 | Lieu obligatoire, lieu principal, adresse et contacts du lieu | 96, 138 à 140, 282, 283 | PARTIEL | Le lieu est facultatif et n'a qu'un code et un intitulé (`LieuBien`). |
| 46 | Code-barres et numéros de série (sérialisation, douchette) | 96 à 98, 169, 170, 177, 178, 211 à 221 | ABSENT | Aucun des deux n'existe. |
| 47 | Paramètres d'acquisition : neuf ou occasion, fournisseur, numéro de pièce, taux et montant de TVA déductible, section analytique | 107, 108, 234 | PARTIEL | La contrepartie (fournisseur au 481, trésorerie, etc.) et la pièce sont portées par l'écriture d'acquisition, pas par la fiche. Le caractère neuf ne se déclare que pour le dégressif fiscal. Ni TVA ni section sur la fiche. |
| 48 | Documents attachés et bloc-notes de la fiche | 101, 102, 226 | ABSENT | Les documents attachés n'existent que pour les tiers. |
| 49 | Composé et composants : nomenclature, affectation, sorties liées | 12, 95, 96, 104, 105, 204, 214, 230 à 232 | FIDÈLE | Approche par composants (`immobilisationPrincipaleId`, AUDCIF Titre VIII ch. 4). |
| 50 | Crédit-bail et location : contrat (dates, loyer, périodicité, prix d'achat résiduel), échéancier des loyers, rachat | 93, 94, 102 à 104, 197, 198, 227 à 229 | DIFFÉRENT, VOULU | Voir A-17. La levée de l'option (`POST /immobilisations/location-acquisition/contrats/:id/option`) et la garantie de valeur résiduelle se déclarent. |
| 51 | Plan comptable, plan analytique, plan tiers, journaux et grilles tenus dans le module | 115 à 138, 238 à 281 | DIFFÉRENT, VOULU | Voir A-13. Les manuels 1 à 3 comparent ces structures. |

### Traitements (p. 141 à 201)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 52 | Gestion d'un bien : plan, numéros de série, sortie, historique, impression de contrôle | 141 à 143, 151, 152, 286, 287, 310 | PARTIEL | Les gestes se lancent depuis la liste, bien par bien. Aucun écran d'historique par bien : l'historique est au journal d'audit du dossier. |
| 53 | Plan d'amortissement par plan (économique, fiscal, dérogatoire, natif, IFRS), avec la position de chaque ligne | 144, 145, 291, 292 | PARTIEL | Voir A-20. |
| 54 | Modifier ou supprimer une dotation non clôturée ; saisir une dotation à la main | 143, 145, 146, 289, 290, 293, 294 | ABSENT | Une dotation passée retient son écriture (`detenteurs-ecriture.ts`), et aucune route ne l'annule. |
| 55 | Calcul des amortissements par plage ou par recherche, avec avertissements | 157 à 159, 161, 314 à 316, 319 | PARTIEL | Voir A-21. |
| 56 | Annulation des calculs ; annulation des traitements (inventaire, révision, réévaluation, dérogatoires) | 159, 160, 317, 318 | ABSENT | Dotation, dépréciation, révision du plan et réévaluation retiennent toutes leur écriture, et aucune route ne permet de les retirer. |
| 57 | Virement de poste à poste : comptes d'immobilisation et d'amortissement, une fois par exercice, avec historique et état | 163 à 166, 186 | FIDÈLE | Reclassement vers la famille d'un autre compte (`POST /immobilisations/:id/reclassement`), avec motif exigé et dépréciation suivie, sans limite d'un reclassement par exercice (la limite que Sage pose, p. 163). La mise en service d'un bien en cours a sa colonne de virements dans les notes (`virements-mise-en-service.ts`). |
| 58 | Création automatique des biens à partir des écritures comptables | 161 à 163 | ABSENT | Le bien naît dans le module, qui passe lui-même l'écriture d'acquisition, ou sans écriture s'il est repris. Une écriture déjà passée ne devient pas une fiche. Ce qui est passé hors module est signalé (`AMORTISSEMENT_IMMO_HORS_MODULE`). |
| 59 | Fractionnement (répartition manuelle ou proportionnelle, arrondi, composé, numéros de série) | 166 à 170 | ABSENT | Voir A-19. |
| 60 | Sortie d'un bien : nature, date, valeur hors taxes, quantité, TVA, commentaire, contrôles de date | 146 à 150, 172, 296 à 302 | PARTIEL | Nature (liste fermée), date, prix, référence et date de la pièce exigées (AUDCIF art. 17), dotation de sortie. Ni quantité ni TVA de cession. |
| 61 | TVA à reverser à la sortie d'un immeuble (règle du dixième ou du vingtième) | 148, 149, 172, 173, 303 | ABSENT | C'est une règle française. Aucune régularisation de TVA n'est calculée à la sortie. |
| 62 | Détail de la cession : valeur, amortissements, valeur nette, dérogatoires résiduels, valeur nette corrigée, plus ou moins-value | 149, 150, 173, 174, 306 | PARTIEL | La valeur nette va au 81 et le prix au 82. La sortie est refusée tant que le 151 porte un dérogatoire, avec l'issue « Reprendre le solde ». Il n'y a pas d'écran qui détaille la plus-value. |
| 63 | Renouvellement d'un composant (fiche dupliquée, acquise à la date de sortie) | 150, 151, 308 | FIDÈLE | `POST /immobilisations/:id/renouvellement` (AUDCIF Titre VIII ch. 4 § 4.1). |
| 64 | Tout sortir : le principal et ses composants ensemble, une valeur globale répartie | 152 à 155, 287, 311 à 313 | DIFFÉRENT, VOULU | Les composants sortent d'abord, un par un, chacun avec sa valeur nette, puis le principal (audit final F127). |
| 65 | Sortie globale de plusieurs biens (cessation d'activité), cession multiple | 170 à 174 | ABSENT | La sortie se fait bien par bien. |
| 66 | Inventaire comptable : valeur actuelle, valeur nette ajustée, provision ou reprise, reprise plafonnée à la valeur sans dépréciation antérieure | 11, 175 à 177 | FIDÈLE | Dépréciation bien par bien, montant et indice saisis (AUDCIF art. 46). Le plafond de reprise est rejoué sans dépréciation (`plafond-reprise-depreciation.ts`), et le plan est ré-étalé. |
| 67 | Inventaire physique : quantité actuelle, lecteur de codes-barres, reprise de la valeur nette | 175 à 179 | PARTIEL | Les fiches de comptage sont créées à partir du registre, une par bien en service, avec le lieu repris (`engendrerFichesImmobilisations`). Ni quantité ni code-barres. |
| 68 | Réévaluation globale : valeur actuelle ou pourcentage, arrondi, biens totalement amortis, allongement de durée | 180 à 183 | PARTIEL | Réévaluation à la clôture de l'ensemble des comptes 22 à 24, 26 et 27, avec un coefficient déclaré plafonné par la valeur actuelle, et l'écart porté au 106 ou au 154 (lot 14). Coefficients par catégorie et valeur actuelle par bien (`ReevaluerImmobilisationsDto`). Aucune durée ne se saisit : le plan repart de la valeur réévaluée. |
| 69 | Révision du plan : durée, valeur d'acquisition, valeur résiduelle, exercice d'effet, redressement fiscal | 183 à 187 | PARTIEL | Seule la durée se révise, de façon prospective ou rétroactive avec reprise au 798 (`ReviserPlanDto`, lot 11). La valeur d'acquisition et la valeur résiduelle ne se révisent pas. |
| 70 | Optimisation des dérogatoires : reprise anticipée, totale ou partielle et répartie ; limitation | 188 à 192 | PARTIEL | Le dérogatoire est passé chaque année, et son solde est repris au 861 avant la sortie (`POST /immobilisations/:id/derogatoire/solde`). Pas de reprise anticipée partielle ni de limitation. |
| 71 | Mise à jour de la comptabilité : par mois, par exercice ou à une date de situation ; dotations à comptabiliser ou toutes ; écritures analytiques ; exports au format Sage | 192 à 195 | PARTIEL | Voir A-22 et B-28. |
| 72 | Nouvel exercice et clôture du module ; à la clôture, suppression des biens sortis et des contrats terminés | 196 à 198 | DIFFÉRENT, VOULU | Voir A-26. Rien n'est supprimé (conservation pendant dix ans, AUDCIF art. 24). |
| 73 | Archivage fiscal en PDF des journaux du module, contrôle d'archivage | 198 à 201 | DIFFÉRENT, VOULU | Le journal d'audit chaîné et la restitution du dossier en tiennent lieu. |

### États (p. 203 à 247)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 74 | Sélection simplifiée, formats enregistrés, impression différée, export TXT, SYLK, Excel ou HTML, états personnalisés | 203 à 206 | PARTIEL | Les deux tableaux s'exportent en Excel (`tableauImmobilisationsExcel`, `tableauAmortissementsExcel`). Il n'y a ni formats enregistrés ni impression différée. |
| 75 | État des immobilisations : base ou développé, situation à une date, ruptures (famille, compte, nature, lieu), biens sortis, composants, tri | 206 à 210 | PARTIEL | Tableau des immobilisations à une date d'arrêté, biens sortis listés hors total. Pas de ruptures au choix. |
| 76 | État des amortissements : base, développé ou étendu ; économique, fiscal ou dérogatoire | 210 à 215 | PARTIEL | Tableau des amortissements de l'exercice, qui indique la part due à la réévaluation. Le plan fiscal dégressif se consulte à part. |
| 77 | État des sorties | 215 à 217 | PARTIEL | Voir A-25. |
| 78 | État des crédits-bails et locations : engagements à un an, de un à cinq ans, au-delà ; échéances | 217 à 220 | PARTIEL | Liste des contrats avec leur dette, et échéancier contrat par contrat. Pas d'état des engagements par tranche d'échéance. |
| 79 | État de rapprochement des amortissements, dépréciations et reprises comptabilisés | 220, 221 | PARTIEL | Trois contrôles nomment ce qui a été passé hors module sur les 28, les 29 et les écarts de réévaluation (`AMORTISSEMENT_IMMO_HORS_MODULE`, `DEPRECIATION_IMMO_HORS_MODULE`, `REEVALUATION_IMMO_HORS_MODULE`). |
| 80 | Journal comptable propre au module (par exercice, mois ou situation, écritures regroupées) | 222 à 224 | PARTIEL | Les écritures du module sont inscrites au journal du dossier. Il n'y a pas de journal propre au module. |
| 81 | États analytiques des immobilisations | 224, 225 | ABSENT | Voir B-16. |
| 82 | États préparatoires fiscaux : feuillets 2054, 2055, 2059 ; réintégrations des biens et des loyers | 226, 227 | DIFFÉRENT, VOULU | Ce sont des feuillets français. Les notes des immobilisations et la réintégration de l'amortissement excédentaire (`AMORTISSEMENTS_EXCEDENT`) en tiennent lieu. |
| 83 | Contrôle des dotations appliquées (dégressif ou exceptionnel comparé au linéaire) | 233, 234 | PARTIEL | Le plan fiscal dégressif montre le passage au linéaire (loi n° 23/053, art. 35). Pas d'état comparatif. |
| 84 | Comparatif comptabilité et immobilisations, flux par compte | 234 à 236 | PARTIEL | Mêmes contrôles qu'en B-79. Pas d'état des flux compte par compte. |
| 85 | Simulation des dotations futures sur plusieurs exercices | 236 à 238 | ABSENT | Voir A-20. |
| 86 | Listes libres : biens en service ou sortis, classements, contrats de crédit-bail | 238 à 241 | PARTIEL | Liste du module et liste des contrats. Pas de choix de classement. |
| 87 | Étiquettes signalétiques ou codes-barres | 241, 242 | ABSENT | Aucune étiquette n'est produite. |
| 88 | Fiche d'inventaire | 243, 244 | FIDÈLE | Fiches de comptage créées à partir du registre (B-67). |
| 89 | Listes des familles, des tiers et des comptes saisis dans les fiches ; impression par Word | 245 à 247 | PARTIEL | Les éditions des structures listent comptes et tiers (`lib/editions-structures.ts`). Pas de liste des familles, qui ne se saisissent plus, ni d'impression par Word. |

### Fenêtres et aide (p. 249 à 253)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 90 | Réorganiser, actualiser, personnaliser l'interface et les listes, ajuster les colonnes, barre verticale, mode assistant, mode personnalisé | 249 à 251 | PARTIEL | La barre verticale de l'accueil existe. Pas de choix des colonnes (M3-34) ni de mode assistant (M2-8). |
| 91 | Aide : rubriques, manuel, site, à propos | 253 | PARTIEL | Bulles d'aide (« ? ») et fenêtre « À propos ». Pas de manuel en ligne. |

## Bilan du manuel

120 fonctions relevées (29 dans les séances, dont trois vues sur les
captures seulement, 91 dans le manuel de référence) : 19 FIDÈLE,
38 DIFFÉRENT VOULU, 1 DIFFÉRENT À TRIER, 39 PARTIEL, 23 ABSENT,
0 NON VÉRIFIÉ.

Les manques qui gênent le plus la tenue d'un registre :

- **Corriger une fiche.** Une fiche ne se modifie pas et ne se supprime pas
  (B-41), et une dotation passée ne s'annule pas (B-54, B-56). Une faute de
  frappe dans une désignation ne se corrige donc pas.
- **Reprendre un dossier.** Le registre des biens ne s'importe pas (B-32), et
  une écriture d'acquisition déjà passée ne devient pas une fiche (B-58). Il
  faut tout ressaisir, fiche par fiche.
- **Gérer des quantités.** Aucune quantité sur un bien (A-18), donc ni
  fractionnement (A-19), ni cession partielle (A-24), ni numéros de série ou
  codes-barres (B-46).
- **Traiter en masse.** Dotation, sortie et calcul se font bien par bien
  (A-21, B-65), sans dotation mensuelle ni simulation des années suivantes
  (B-28, B-85).
- **Produire les états.** Pas d'état des sorties, et les notes des plus et
  moins-values de cession restent à saisir alors que le module en tient les
  chiffres (A-25).

## Relevés en passant

Ces deux défauts sont notés ici et ne sont pas corrigés, le gel tenant :

- `ImmobilisationService.lister` (`GET /immobilisations`) rend tous les biens
  du dossier, sans borne. CLAUDE.md § 8 bis veut qu'aucune route ne rende une
  collection sans borne.
- `LocationAcquisitionService.lister` s'arrête à 500 contrats sans le dire :
  il ne renvoie ni `tronque` ni `total` (CLAUDE.md § 8 bis).

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT et le DIFFÉRENT, À TRIER (B-33).
