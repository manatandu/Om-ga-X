# Audit du manuel Microfina++, module par module, face à OmegaX (2026-10-25)

> **Lecture complète du manuel (2026-10-25).** Ce document a été écrit sans
> pouvoir lire le manuel au-delà du folio 79. Le PDF entier a depuis été lu,
> captures comprises · `audit-manuel-microfina-306-pages.md` le remplace pour
> la lecture du manuel et en corrige les lignes (partie A, § 3 ; partie C,
> § 3). Il reste en place pour son raisonnement et ses renvois à la CAMEC.


Document d'audit, sans décision. Il COMPLÈTE
`docs/comparaison-microfina/analyse-microfina-omegax.md` (2026-10-21), qui
reste en place, et `docs/comparaison-microfina/paie-microfina-omegax.md`,
auquel le module Paie renvoie. Rien n'est codé ; toute idée du § (e) est une
fonction NOUVELLE, sous le gel des nouveautés (CLAUDE.md § 5).

Conventions · « M p. N » renvoie au folio IMPRIMÉ du manuel, lu dans son
texte ; « CAMEC p. N » à une page du manuel telle que la cite la note de la
CAMEC du 22/10/2026 (source SECONDAIRE, page non lue ici) ; « CAMEC-U n° »
renvoie à cette note (26 constats d'usage), « CAMEC-R n° » à la note
« Constats, risques et recommandations » (70 constats). Un chemin renvoie au
fichier d'OmegaX lu sur la révision `e0cc3e1`.

Légende des tableaux · **oui** : la fonction existe dans OmegaX, vérifiée
dans le code ; **partiel** : un équivalent existe, de périmètre ou de sens
différent ; **non** : rien, alors que la fonction servirait une ASBL, une ONG
ou une entreprise ; **hors champ** : la fonction est propre à une COOPEC ou à
une IMF (épargne, crédit à la clientèle, guichets, PCCI, états BCC ou FinA),
qu'OmegaX ne vise pas.

**Pourquoi « hors champ » et non « absent ».** Les textes lus excluent ces
entités du champ des deux référentiels d'OmegaX, et leur imposent un plan à
elles · « les établissements de crédit, les établissements de microfinance
[…] et les entités à but non lucratif ne sont pas assujettis au SYSCOHADA »
(AUDCIF art. 5, al. 3, compétence `audcif-acte-uniforme`) ; « Les
Coopératives d'Epargne et de Crédit ainsi que les Institutions de Micro
Finance sont tenues d'organiser leur comptabilité conformément aux
dispositions du PCCI » (Instruction BCC n° 006, art. 2) ; « Les associations
sans but lucratif ne sont pas autorisées à réaliser les opérations de
Microfinance » (loi n° 11/020, art. 4), soit d'abord « la collecte de
l'épargne » (art. 6) (compétence `reglementation-microfinance-rdc`,
`loi-11-020-activite-microfinance/`). Une ONG cliente d'OmegaX ne peut donc
pas avoir besoin d'un compte de déposant ; l'en priver n'est pas un manque.

---

## (a) Pages réellement lues

### Comment le manuel a été lu

| Voie | Résultat |
|---|---|
| `read_file_content` (Drive, `1OcCKxMz0aS1xRPqQ5SHwxm8bRJrlac_U`) | texte coupé à 62 563 caractères · il s'arrête au folio 79 (« 4.3- Consultation du tableau d'amortissement ») puis donne la liste des liens du document |
| `download_file_content` | refusé · « File too large for download, over limit of 10 MB » (fichier de 10 739 743 octets) |
| téléchargement direct (`drive.google.com/uc?export=download`) | refusé par le relais réseau (`connect_rejected`) |
| recherche plein texte du Drive, mot par mot | résultats contradictoires (un même mot trouvé avec un filtre de titre et absent avec un autre ; « prime » trouvé alors qu'il n'apparaît que dans « PrimeFaces ») · **aucune conclusion tirée** |
| captures d'écran | vues à aucune page |

**Conclusion · folios 1 à 79 lus en texte ; folios 80 à 306 NON LUS.** Le
nombre de 306 pages vient de la note de la CAMEC ; le dernier folio vu est le
79. Toute fonction des folios 80 à 306 citée ci-dessous l'est d'après la
note de la CAMEC, dont les auteurs ont lu le manuel entier, et porte la
mention « CAMEC p. N ». La pagination de la note précède d'une à deux pages
le folio imprimé (« chèque pour crédit » · CAMEC p. 71, M p. 69-70 ;
« Profil » · CAMEC p. 16, M p. 15-16).

Pour lire les folios 80 à 306, il faut scinder le PDF sous 10 Mo ou
l'exporter en texte sur un poste qui l'ouvre, puis le déposer dans le Drive.

### Couverture, folio par folio

| Folios | Contenu | Lu |
|---|---|---|
| 1 à 3 | sommaire (cassé, « Erreur ! Signet non défini »), avant-propos, comprendre le document | oui |
| 4 et 5 | présentation · environnement Java, JSF / PrimeFaces, SQL Server ou Oracle, systèmes et matériels requis | oui |
| 6 à 12 | prise en main · connexion, modules (Microfina++, Paie, Immo, GRH, Stocks, Administration), données de base, contrôles, boîtes de dialogue, enregistrer, annuler, modifier, supprimer | oui |
| 12 à 14 | module principal · barre des menus (Client, Banque, Épargne, Caisse, Crédit, Comptabilité, Budget, Autres, Paramétrage, Administration), bas de page, langues, aide en ligne, déconnexion | oui |
| 14 à 23 | Administration · profils, utilisateurs, guichets, exercice, ouverture de journée, rapport des transactions | oui |
| 23 à 27 | Paramétrage, général · secteurs d'activité, numérotation et frais des clients, motifs de départ | oui |
| 27 à 30 | Paramétrage, budget · centres de coût, types de budget et de période, périodes, plan budgétaire, opérations | oui |
| 30 à 32 | Paramétrage, localisation | oui |
| 32 à 41 | Paramétrage, produits · crédit (général, ordre de remboursement, produit, modèle comptable), épargne | oui |
| 41 et 42 | Paramétrage, comptabilité · numéro de pièce, journaux, « ED DIVERS » | oui |
| 42 à 46 | Paramétrage · société, agences, journées de travail, jours fériés, devises, monnaie et coupures, éléments de facture, référence de commande | oui |
| 47 à 58 | Client · enrôlement, visa, frais, validation, consultation, groupes, prospects, mise à jour, procurations, résiliation, photo et signature, consentement BIC, rapports | oui |
| 59 à 71 | Banque · opérations, virements, déblocage et remboursement de crédit, adhésion, visa, validation, banques, chèques clients et de l'institution, emprunts, rapports | oui |
| 72 à 79 | Épargne · nouveau compte, relevé, dépôt à terme, plan d'épargne (simulation, création, tableau) | oui, jusqu'au folio 79 |
| 80 à 306 | suite de l'Épargne, Caisse, Crédit, Comptabilité, Budget, États financiers, Contrôle, Autres, Paie, Immobilisations, GRH, Stocks (ordre et bornes inconnus, sauf les pages que cite la CAMEC) | **non** |

### Ce que la note de la CAMEC dit des folios non lus

| Module | Ce que la note rapporte du manuel | CAMEC p. |
|---|---|---|
| Épargne | clôture d'un compte d'épargne, signalée en panne | 81 |
| Épargne | bloquer un compte ou un montant | 73 |
| Caisse | billetage par guichet, validation avec solde informatique et solde réel | 91-92 |
| Crédit | visa du dossier à plusieurs niveaux (responsable crédit, comité, service financier), historique | 115-116 |
| Crédit | engagement par signature | 122 |
| Comptabilité | saisie d'écritures, suppression avant validation | 129 |
| Comptabilité | rapprochement bancaire · pointage du relevé, opérations manquantes, export de l'état, historique | 130-131, 155-156 |
| Comptabilité | comptabilisation | 131 |
| Comptabilité | visa et validation des écritures, des OD, des virements et des retraits au-delà du plafond | 131-133 |
| Comptabilité | virement des salaires du personnel et prélèvement automatique, signalés en panne | 137 |
| Contrôle | rapport des annulations | 138 |
| Comptabilité | grand livre général par agence, exercice et période | 139 |
| États financiers | états financiers, hors bilan | 141-142 |
| Comptabilité | indicateurs financiers par exercice et par mois (sans liste, sans renvoi à l'Instruction BCC n° 004) | 143 |
| Budget | menu Budget · suivi et consommation par centre de coût | 143-145 |
| Comptabilité | plan des comptes · nature du compte (actif, passif, charge, produit, hors bilan) et statut | 147, 157 |
| Comptabilité | annulation de règlement | 159 |
| Autres | calculs (intérêts sur DAT) ; « caisse mobile », citée sans être décrite | 164 |
| Paie | types d'avance, mise en place et visa des retenues sur salaire | 275-279 |
| Immobilisations | comptes d'acquisition, de dotation et d'amortissement par famille ; création du bien avec fournisseur et facture | 283-285 |
| Immobilisations | inventaire des biens, liste des inventaires, sortie du patrimoine | 287-288 |
| Immobilisations | module entier | 280-289 |
| GRH, Stocks | **aucune page citée** · rien n'est connu de ces modules au-delà de leur titre (M p. 6) | · |

---

## (b) Module par module

### 1. Prise en main et ergonomie (M p. 4 à 14)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Accès par navigateur, serveur à installer chez le client (Glassfish ou JBoss, SQL Server ou Oracle) | 3 à 5 | oui | en ligne (Cloud Run, `.github/workflows/deploy-cloud-run.yml`) et sur site (`src/modules/sur-site/`, `installation/`) | OmegaX ne demande aucun serveur au cabinet en ligne |
| Monoposte ou client / serveur | 3 | oui | installation sur site, PC Windows serveur (`src/modules/sur-site/`) | |
| Grilles paginées, filtre, export Excel | 7 à 9 | partiel | exports en flux des livres (`src/modules/exports/`), éditions à plat des structures (`client/src/lib/editions-structures.ts`) | pas d'export Excel générique de toute grille |
| Suppression « généralement logique » | 12 | partiel | mise en sommeil, annulations motivées, inscription en négatif (CLAUDE.md § 6, « Suppression des structures ») ; journal d'audit (`src/common/audit/`) | OmegaX REFUSE de supprimer ce qui est utilisé ou validé, au lieu de le masquer |
| Bas de page · utilisateur, serveur, base, journée ouverte | 13 | partiel | barre d'état, exercice choisi (`client/src/lib/exercice-choix.ts`) | aucune notion de journée |
| Langues français et anglais | 14 | non | interface en français seul (CLAUDE.md § 6, « Pages légales et aide ») | voir § (e), idée 9 |
| Aide en ligne | 14 | oui | bulle `Aide` à chaque écran, FAQ (CLAUDE.md § 9 ter, « Pages légales ») | |
| Déconnexion | 14 | oui | `POST /auth/logout`, session fermée sur le serveur (`src/modules/auth/sessions-fermees.ts`) | |

### 2. Administration (M p. 14 à 23)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Profils, droits cochés tâche par tâche | 15, 16 | oui | profils de fonctions (`src/common/fonctions/fonctions-metier.ts`), cinq rôles (`src/common/guards/roles-cantonnes.ts`) | le profil d'OmegaX RESTREINT un rôle sans jamais l'élargir |
| Création d'utilisateur, rattachement à une agence | 16, 17 | oui | `src/modules/utilisateurs/` | l'« agence » d'OmegaX est le dossier |
| Déconnecter un utilisateur | 17, 18 | oui | `POST /utilisateurs/:id/deconnecter` (`src/modules/utilisateurs/*.controller.ts`, l. 117) | ajouté le 2026-10-21, après l'analyse précédente qui le disait partiel |
| Guichets, case « billetage », comptes associés | 18 | hors champ | · | guichet d'une institution de dépôt ; la caisse d'une ASBL a son journal et son compte (CLAUDE.md § 6, point 13) |
| Ouverture et fermeture de guichet | 19 | hors champ | · | idem |
| Affectation d'un guichet à un utilisateur | 19, 20 | partiel | journaux autorisés par utilisateur (`src/common/perimetre/extension-perimetre-journaux.ts`) | un journal de caisse par caissier l'émule |
| Exercice · création, ouverture, « compléter journal détail » | 20, 21 | oui | `src/modules/exercice/`, à-nouveaux (`exercice/report-a-nouveau.ts`) | |
| Ouverture de journée | 21 | partiel | clôture de période et de journal (`exercice/gel-cloture.ts`) | OmegaX fige par période, au plus un mois (AUDCIF art. 22, 2°, tel que le dépôt l'applique) |
| Rapport des transactions sur une période, export | 22, 23 | oui | journal exporté comme l'édition de Sage (`exports/journal-edition.ts`), export des seules modifications (`exports/modifications/`), journal d'audit | |

### 3. Paramétrage (M p. 23 à 46)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Secteurs d'activité des clients | 23 | partiel | code d'activité du dossier, NOTE 36 SYSCOHADA (`Tenant.codeActivitePrincipale`) | pour le dossier, pas pour ses tiers |
| Numérotation des clients | 23, 26 | oui | numéro du compte de tiers proposé et modifiable (`GET /tiers/numero-propose`, `tiers/collectifs-tiers.ts`) | |
| Frais par opération et d'adhésion par type de client | 24 à 26 | hors champ | · | frais de guichet ; la cotisation d'une association est un PRODUIT (CLAUDE.md § 6, « Cotisations ») |
| Motifs de départ d'un client | 26 | non | mise en sommeil d'un tiers, sans motif codifié | |
| Types de centre de coût, centres hiérarchisés | 27 | oui | plans analytiques, sections DÉTAIL et TOTAL (`analytique/rubriques-budgetaires.ts`) | |
| Types de budget, types de période, périodes libres | 28, 29 | partiel | budget annuel et mensuel par section (`doterBudget`, `src/modules/analytique/analytique.service.ts`) | aucune période libre (trimestre d'un bailleur) · § (e), idée 5 |
| Plan budgétaire et lignes, avec centre de coût et bailleur | 29 | oui | bailleurs et conventions de financement (`src/modules/bailleurs/`), exécution budgétaire notes 35 et 24 SYCEBNL | |
| Opérations budgétaires par type | 30 | partiel | OD analytiques (`analytique/od-analytique.ts`) | |
| Localisation hiérarchique (pays à quartier) | 30 à 32 | partiel | adresse, ville et pays du tiers (`model Tiers`) | § (e), idée 10 |
| Produit crédit · type, objet, cycle, zone, degré, terme, périodicité, assurance, gestionnaire | 32 à 36 | hors champ | · | crédit à la clientèle |
| Ordre de remboursement (frais, intérêts, capital) | 37 | hors champ | imputation des paiements par le Code civil, Livre III, art. 151 à 154, pour des FACTURES (`src/modules/tva/imputation-paiements.ts`) | |
| Produit crédit, modèle comptable de crédit | 37 à 40 | hors champ | · | |
| Produits d'épargne | 40, 41 | hors champ | · | |
| Numéro de pièce | 41 | oui | `journaux/numerotation-piece.ts`, trous de séquence (`journaux/sequence-pieces.ts`) | |
| Journaux | 41 | oui | Codes journaux (`src/modules/journaux/`) | |
| « ED DIVERS », écritures paramétrées par type d'opération | 42 | partiel | modèles de saisie à fonctions (`src/modules/modeles-saisie/`) | |
| Société, agences, zones, logo | 42, 43 | partiel | paramètres du dossier, mentions imprimées (`tenant/mentions-immatriculation.ts`), cellules du module Groupe (`src/modules/groupe/`) | |
| Gestionnaires, sensibilisateurs, commerciaux | 43 | hors champ | · | agents de crédit |
| Journées de travail, jours fériés | 44 | partiel | fériés de l'ordonnance n° 23-042, liste fixe (`retenues/jour-ouvrable.ts`) | non paramétrables, et c'est voulu (la liste vient du texte) |
| Devises | 45 | oui | `src/modules/devises/` (cours, lignes en devise, réévaluation) | |
| Types de monnaie et coupures | 45 | partiel | valeur faciale libre au PV de comptage (`CoupureComptee`), billetage déclaré au paiement des salaires (`personnel/paiement-salaires.ts`) | aucune table de coupures · § (e), idée 4 |
| Éléments de facture, référence de commande | 46 | oui | `src/modules/facturation/`, devis et commande (`src/modules/commercial/`) | |

### 4. Client (M p. 47 à 58)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Enrôlement d'une personne, d'une entreprise, d'un groupe | 47 à 50 | partiel | plan des tiers, types ADHERENT, CLIENT, FOURNISSEUR, SALARIE, AUTRE (`enum TypeTiers`) | la fiche d'identification d'un DÉPOSANT est hors champ |
| Personnes liées, signataires, bénéficiaires | 48 à 50 | hors champ | · | |
| Photo et spécimen de signature | 48, 57 | partiel | documents attachés aux tiers (`tiers/documents-tiers.ts`) | spécimen au guichet hors champ |
| Visa de l'enrôlement par un second agent, contrat d'adhésion imprimé | 51 | partiel | visa des RIB par un second utilisateur (`tiers/visa-rib.ts`) | le visa porte sur les coordonnées bancaires, jamais sur la fiche |
| Modifier les frais d'ouverture, valider un client modifié | 52, 53 | hors champ | · | |
| Consulter un client, données initiales et actuelles | 53 | partiel | journal d'audit et pré-image (`src/common/audit/`) | § (e), idée 8 |
| Groupe solidaire, affectation des membres | 53, 54 | hors champ | · | caution solidaire d'IMF |
| Prospects | 54 | non | · | |
| Mise à jour, procurations (titre seul), résiliation | 55, 56 | partiel | modification et mise en sommeil d'un tiers | |
| Consentement BIC | 57 | hors champ | · | le manuel ne définit pas le sigle |
| Rapports multicritères, prospects, clients modifiés | 57, 58 | partiel | éditions des structures (`client/src/lib/editions-structures.ts`) | |

### 5. Banque (M p. 59 à 71)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Encaissement et décaissement | 59, 60 | oui | saisie au journal de banque, contrepartie à chaque ligne (`client/src/lib/contrepartie-tresorerie.ts`) | |
| Virement banque vers caisse, banque vers banque | 60, 61 | oui | virement de fonds par le 585, deux pièces liées (`src/modules/virements-fonds/`) | |
| Virement ou prélèvement sur le compte d'un client | 61 | hors champ | · | compte de déposant |
| Déblocage et remboursement de crédit | 62, 63 | hors champ | · | |
| Adhésion avec premier dépôt | 64, 65 | hors champ | · | |
| Visa, puis validation des opérations (titres seuls) | 65, 66 | partiel | double regard à la validation (`Tenant.doubleRegardValidation`, `prisma/schema.prisma` l. 664) | une seule étape chez OmegaX, sans seuil · § (e), idée 1 |
| Banques des clients et de l'institution | 67 | oui | banques et RIB (`banques/banques.ts`), RIB des tiers (`tiers/ribs-tiers.ts`), conditions bancaires (`banques/conditions-bancaires.ts`) | |
| Chèques clients · dépôt, encaissement, historique | 68, 69 | oui | remises de chèques et de cartes, 513, 514, bordereau, avis, impayé au 413 (`src/modules/remises/`, `remises/remise-en-banque.ts`) | ligne sage-l3 n° 40 (2026-10-22), après l'analyse précédente qui le disait absent |
| Chèques de l'institution · générer un chéquier, chèque pour crédit (titres ; le second en panne) | 69, 70 | non | · | aucun registre des chèques ÉMIS · § (e), idée 6 |
| Emprunts bancaires · mise en place, remboursement (titres seuls) | 70, 71 | partiel | crédit de trésorerie au 561 (deux ans au plus) et dépôts à terme (`tresorerie/operations-tresorerie.ts`) ; intérêts courus (`regularisation/interets-courus.ts`) | l'emprunt long au 16 ou au 18 est « hors de ce module » (`operations-tresorerie.ts`, l. 168) · § (e), idée 2 |
| Rapports par banque, agence et période | 71 | oui | grand livre, balance, extraits bancaires (`rapprochement/extraits-bancaires.ts`) | |

### 6. Épargne (M p. 72 à 79 ; CAMEC p. 73, 81)

| Fonction | Page | OmegaX | Commentaire |
|---|---|---|---|
| Nouveau compte d'épargne par produit | M p. 72 | hors champ | |
| Relevé de compte, situation du client | M p. 73, 74 | hors champ | le « Rappel et relevé » d'OmegaX est un relevé de CRÉANCE |
| Dépôt à terme · mise en place, validation, rupture, recherche | M p. 75 à 77 | hors champ | OmegaX tient les DAT que l'entité PLACE (525, 2784, intérêts au 771 ou 774, courus au 5267, `tresorerie/operations-tresorerie.ts`), pas ceux qu'elle reçoit |
| Plan d'épargne · simulation, création, tableau des échéances | M p. 78, 79 | hors champ | « édition des cotisations » et « rupture » annoncées, non décrites |
| Bloquer un compte ou un montant | M p. 72 ; CAMEC p. 73 | hors champ | |
| Clôturer un compte (en panne selon la CAMEC) | M p. 72 ; CAMEC p. 81 | hors champ | |

### 7. Caisse (CAMEC p. 91-92, folios non lus)

| Fonction | Page | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Opérations de guichet (dépôts, retraits) | M p. 3, 13 (annoncées) | hors champ | · | |
| Billetage par guichet, solde informatique contre solde réel | CAMEC p. 91-92 | partiel | procès-verbal de comptage par caisse, coupures, solde du livre-journal lu à la date du comptage (`ProcesVerbalComptageCaisse`, `inventaire/solde-caisse-au-comptage.ts`) ; caisse qui ne paie que ce qu'elle contient (`comptabilite/caisse-provisionnee.ts`) | OmegaX compte à l'inventaire, pas à chaque fin de journée · § (e), idée 4 |

### 8. Crédit (CAMEC p. 115-122 ; M p. 32 à 40, 62, 63)

Tout le module est **hors champ** (crédit à la clientèle d'une IMF). Seul
point commun · le visa du dossier à plusieurs niveaux (CAMEC p. 115-116),
dont l'idée se retrouve au § (e), idée 1, pour les gestes comptables.
L'« engagement par signature » (CAMEC p. 122) a un équivalent partiel ·
l'engagement de la banque proposé au hors bilan 9011 / 9111 au SYSCOHADA
(`banques/conditions-bancaires.ts`, l. 288 à 302).

### 9. Comptabilité (CAMEC p. 129 à 159, folios non lus)

| Fonction | Page | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Saisie d'écritures, suppression avant validation | CAMEC p. 129 | oui | brouillard, validation irréversible, correction en négatif (`comptabilite/ecriture.service.ts`) | |
| Rapprochement bancaire · pointage, opérations manquantes, état, historique | CAMEC p. 130-131, 155-156 | oui | relevé importé, propositions, clôture, réouverture motivée (`rapprochement/releve-bancaire.ts`) | |
| Comptabilisation (de la journée) | CAMEC p. 131 | hors champ | · | écritures nées des opérations de guichet |
| Visa et validation des écritures, des OD, des virements et des retraits au-delà d'un plafond | CAMEC p. 131-133 | partiel | double regard en option, sans seuil (`Tenant.doubleRegardValidation`) ; visa des RIB (`tiers/visa-rib.ts`) | § (e), idée 1 |
| Virement des salaires, prélèvement automatique (en panne selon la CAMEC) | CAMEC p. 137 | oui pour le virement des salaires | `personnel/paiement-salaires.controller.ts` | voir `paie-microfina-omegax.md` |
| Grand livre général par agence, exercice et période | CAMEC p. 139 | oui | grand livre complet en flux, extrait d'une période (`comptabilite/periode-extrait.ts`, `exports/export-fpm.service.ts`) | |
| Indicateurs financiers par exercice et par mois | CAMEC p. 143 | partiel | tableau de bord ; 24 indicateurs de la NOTE 33 des associations SYCEBNL (`notes-annexes/indicateurs-note-33.ts`) | les indicateurs de l'Instruction BCC n° 004 sont hors champ · § (e), idée 7 |
| Plan des comptes, nature et statut | CAMEC p. 147, 157 | oui | classe tirée du numéro, contradiction refusée (`comptes/classe-du-numero.ts`) ; création réservée à l'administrateur (`comptes/compte.controller.ts`, l. 84-85) ; compte personnalisé (`comptes/comptes-proposes.ts`) | |
| Annulation de règlement | CAMEC p. 159 | oui | annulation motivée, inscription en négatif (règlements, effets, remises, virements de fonds ; CLAUDE.md § 6) | |

### 10. Budget (M p. 27 à 30 ; CAMEC p. 143-145)

| Fonction | Page | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Saisie du budget, suivi, consommation par centre de coût | CAMEC p. 143-145 | oui | budgets par section, état budgétaire, exécution budgétaire SYCEBNL (`analytique/`, notes 35 et 24), simulateur budgétaire (`src/modules/simulations/`) | |

### 11. États financiers (CAMEC p. 141-142)

| Fonction | Page | OmegaX | Commentaire |
|---|---|---|---|
| États financiers | CAMEC p. 141-142 | oui (dans SON champ) | liasses SYCEBNL (trois jeux) et SYSCOHADA (normal, SMT), TFT (`etats-financiers/correspondance-tft.ts`, `etats-financiers-syscohada/correspondance-tft-syscohada.ts`) ; les états PCCI et FinA de la BCC sont **hors champ** |
| Hors bilan | CAMEC p. 141 | partiel | classe 9 semée, engagement bancaire proposé (SYSCOHADA) ; aucun état du hors bilan ; la classe 0 du PCCI est hors champ |

### 12. Contrôle (CAMEC p. 138)

| Fonction | Page | OmegaX | Preuve |
|---|---|---|---|
| Rapport des annulations | CAMEC p. 138 | oui | négatifs liés à leur origine, annulations listées par module, journal d'audit chaîné (`src/common/audit/`) ; test des écritures de journal (`controles/test-ecritures-journal.ts`) |

### 13. Autres (CAMEC p. 164)

| Fonction | Page | OmegaX | Commentaire |
|---|---|---|---|
| Calculs (intérêts sur DAT) | CAMEC p. 164 | hors champ | DAT reçus ; pour les DAT placés, voir module 6 |
| Caisse mobile (citée sans être décrite) | CAMEC p. 164 | hors champ | |

### 14. Paie (M p. 6 ; CAMEC p. 137, 275-279)

Renvoi à `docs/comparaison-microfina/paie-microfina-omegax.md`. En bref ·
types d'avance **oui** (`personnel/avances-salaire.ts`) ; mise en place de
l'avance **partiel** (le versement n'est pas passé) ; **visa des retenues
sur salaire, non** ; virement des salaires **oui**, quand celui de
Microfina++ est signalé en panne.

### 15. Immobilisations (CAMEC p. 280-289)

| Fonction | Page | OmegaX | Preuve |
|---|---|---|---|
| Comptes d'acquisition, de dotation et d'amortissement par famille | CAMEC p. 283-285 | oui | familles d'immobilisations (`immobilisations/famille-immobilisation-seed.ts`), barème et comptes (`immobilisations/bareme-comptes-013-2025.ts`) |
| Création du bien avec fournisseur et facture | CAMEC p. 283-285 | oui | `immobilisations/immobilisation.service.ts`, écriture d'acquisition passée par le module, contrepartie en liste fermée (`contrepartie-acquisition.ts`) ; création depuis les écritures déjà passées (`creation-depuis-ecritures.ts`) |
| Inventaire des biens, liste des inventaires | CAMEC p. 287-288 | oui | campagnes d'inventaire physique (`src/modules/inventaire/`), numéros d'inventaire et renumérotation (`immobilisations/maintenance-immobilisations.ts`) |
| Sortie du patrimoine | CAMEC p. 287-288 | oui | nature et pièce de la sortie (`immobilisations/nature-sortie.ts`) |

### 16. GRH (M p. 6-7)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| « informations concernant le personnel » (données de base du module) | 6-7 | partiel | registre du personnel (`model Salarie`, `ContratTravail`, `EnfantACharge`, `PieceJointeSalarie`), confrontation aux énonciations de l'art. 212 (`GET /personnel/confrontation`) | rien n'est connu du module de Microfina++ au-delà de cette phrase |

### 17. Stocks (M p. 6)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| « gestion des stocks » (titre seul) | 6 | oui | magasin en inventaire permanent, P.E.P.S. et C.M.P.A.C.E., boni et mali, variation de stocks (`src/modules/stocks/`) | aucune page du module de Microfina++ n'est connue |

---

## (c) Ce que le manuel signale lui-même en panne, ou réduit à un titre

| Ce que dit le manuel | Page | Source |
|---|---|---|
| Sommaire cassé · « Erreur ! Signet non défini » | M p. 1 | lu |
| « ///////L'onglet ne marche pas/////////// », placé entre « Chèque pour crédit » et « Emprunts bancaires » | M p. 70 | lu |
| Chèque pour crédit · en panne | CAMEC p. 71 | note CAMEC, § 4 (vraisemblablement la même mention que M p. 70) |
| Clôture d'un compte d'épargne · en panne | CAMEC p. 81 | note CAMEC, § 4 |
| Virement des salaires du personnel et prélèvement automatique · en panne | CAMEC p. 137 | note CAMEC, § 4 |
| Visa (6.1 à 6.4) et Validation (7.1 à 7.4) des opérations bancaires · titres seuls | M p. 65-67 | lu |
| Gestion chèque institution · « générer chéquier », « chèque pour crédit » · titres seuls | M p. 69 | lu |
| Emprunts bancaires · « mise en place », « remboursement » · titres seuls | M p. 70-71 | lu |
| Gestion des procurations · « renseigner le libellé », rien d'autre | M p. 56 | lu |
| Épargne · « clôturer un compte, bloquer compte et montant, rapport » annoncés au folio 72 sans description | M p. 72 | lu (la CAMEC situe le blocage p. 73) |
| Plan d'épargne · « édition des cotisations » et « rupture » annoncées sans description | M p. 78 | lu |
| Caisse mobile · citée sans être décrite | CAMEC p. 164 | note CAMEC, constat d'usage 26 |
| Le manuel se dit « version du document 0.1 » à chaque page, et conforme au « référentiel des SFD » (Afrique de l'Ouest), sans citer la BCC ni le PCCI | M p. 3, pied de chaque page | lu |

---

## (d) Les constats de la CAMEC qui portent sur le LOGICIEL

Ne sont retenus que les constats dont le remède passe par un logiciel. Sont
écartés, parce qu'ils relèvent de l'organisation ou de la gouvernance et
qu'aucun logiciel ne les règle · CAMEC-R 1, 2, 4, 5, 7 à 10, 12, 13, 15, 34,
37, 39, 40, 44, 45, 48, 49, 51 à 54, 56, 58, 60 à 70 (sauf mention).

### (d-1) Les 26 constats d'usage (CAMEC-U)

| N° | Constat | OmegaX le règle ? | Preuve |
|---|---|---|---|
| U1 | grand livre extrait compte par compte | **oui** · grand livre complet en un fichier, avec sommaire | `exports/export-fpm.service.ts` ; CLAUDE.md § 6, « Journal et grand livre exportés en flux » |
| U2 | rapprochements bancaires faits à la main | **oui** | `rapprochement/releve-bancaire.ts`, `rapprochement/extraits-bancaires.ts` |
| U3 | un même utilisateur saisit et valide | **oui, en option** · double regard qui écarte l'écriture de son auteur ; contrôle `VALIDATION_PAR_SON_AUTEUR` sur l'historique | `Tenant.doubleRegardValidation` (schéma, l. 664) ; CLAUDE.md § 10 ter |
| U4 | le chef comptable est administrateur ; l'éditeur décide des droits | **oui** · l'administrateur du dossier gère rôles, profils, journaux autorisés ; le dernier administrateur actif ne se retire pas ; VMG ne voit pas les données | `src/modules/utilisateurs/` ; CLAUDE.md § 8 |
| U5 | corrections et annulations par l'administrateur ou l'éditeur | **oui** · le comptable corrige par négatif ou réimputation, sans l'éditeur | `comptabilite/reimputation.ts` ; `comptabilite/ecriture.service.ts` |
| U6 | visa de la RAF sur le papier seulement | **partiel** · validation tracée (auteur, date) et double regard ; pas de visa à seuil distinct de la validation | `Ecriture.valideeBy`, `valideeAt` restitués à l'export (CLAUDE.md § 10 ter) · § (e), idée 1 |
| U7 | la Commission de crédit n'a pas accès au logiciel | **hors champ** (crédit) ; le rôle LECTURE SEULE existerait pour un tel organe | `common/guards/roles-cantonnes.ts` |
| U8 | budget suivi sur Excel | **oui** | module 10 ci-dessus |
| U9 | écriture d'acquisition des immobilisations passée à la main | **oui** · le module passe l'écriture | `immobilisations/immobilisation.service.ts` |
| U10 | inventaire et sorties d'immobilisations non suivis | **oui** | `src/modules/inventaire/`, `immobilisations/nature-sortie.ts` |
| U11 | avances au personnel sur Excel, puis importées | **partiel** · voir `paie-microfina-omegax.md`, § (c) | `personnel/avances-salaire.ts` |
| U12 | journée comptabilisée sans arrêté de caisse | **partiel** · pas de journée ; la clôture d'exercice est refusée tant qu'une caisse 57 à solde non nul n'a pas son procès-verbal | CLAUDE.md § 6, « Procès-verbal de comptage par caisse » ; `ProcesVerbalComptageCaisse` |
| U13 | types de compte incohérents, comptes créés sans validation | **oui pour la cohérence** · la classe se lit sur le numéro, une classe contradictoire est refusée ; création réservée à l'administrateur, sans second regard | `comptes/classe-du-numero.ts` ; `comptes/compte.controller.ts` l. 84-85 |
| U14 | indicateurs calculés à la main | **hors champ** pour l'Instruction BCC n° 004 ; **partiel** en général (NOTE 33 SYCEBNL) | `notes-annexes/indicateurs-note-33.ts` |
| U15 | hors bilan non tenu ; crédits en perte sortis de la comptabilité | **hors champ** (classe 0 du PCCI, crédits) | · |
| U16 | pénalités non automatiques, frais à la main | **hors champ** (crédit) | · |
| U17 | comptes d'épargne débiteurs | **hors champ** ; le pendant dans le champ d'OmegaX, la caisse créditrice, est REFUSÉ | `comptabilite/caisse-provisionnee.ts` |
| U18 | intérêts courus sur DAT non constatés à la clôture | **hors champ** pour les DAT reçus ; **oui** pour les DAT placés par l'entité (part courue au 5267 proposée à la clôture) | `tresorerie/operations-tresorerie.ts` |
| U19 | aucune trace des modifications de paramètres, de droits et d'écritures | **oui** · journal d'audit chaîné par empreinte, non désactivable, sans route d'écriture | `src/common/audit/` ; CLAUDE.md § 8 |
| U20 | l'activité s'arrête quand internet tombe | **oui, par l'installation sur site** · serveur local, licence en fichier signé, sauvegardes locales | `src/modules/sur-site/` |
| U21 | sauvegardes manuelles, bloquées, jamais restaurées | **oui** · en ligne, `pg_dump` chiffré chaque nuit et restauration de contrôle table par table ; sur site, sauvegarde quotidienne et copie avant chaque mise à jour | `.github/workflows/sauvegarde-base.yml` ; `sur-site/sauvegarde-sur-site.service.ts` |
| U22 | ni règle de mot de passe ni verrouillage automatique des sessions | **oui pour le mot de passe** (dix caractères au moins, verrouillage progressif du compte, double authentification) ; **partiel pour les sessions** (échéance de huit heures, ou sept jours sans usage en session longue ; aucun verrouillage de l'écran à l'inactivité) | `auth/dto/changer-mot-de-passe.dto.ts` l. 12 ; `auth/verrouillage.ts` ; `auth/session-longue.ts` |
| U23 | TFT et tableaux FinA non produits | **oui pour le TFT** dans le champ d'OmegaX ; FinA **hors champ** | `etats-financiers-syscohada/correspondance-tft-syscohada.ts`, `etats-financiers/correspondance-tft.ts` |
| U24 | position de change non suivie | **partiel** · position par devise lue à la réévaluation de clôture et provision ajustée ; aucun suivi quotidien ni limite (les limites de l'Instruction BCC n° 002 sont hors champ) | `src/modules/devises/` |
| U25 | réévaluation des immobilisations sur Excel | **oui** | `immobilisations/reevaluation-bilan.ts`, `reevaluation-suites.ts` |
| U26 | aucune interface avec le mobile ni les banques | **partiel** · import du relevé bancaire en CSV ou XLSX ; aucune connexion directe à une banque ni au mobile money | `rapprochement/releve-bancaire.ts` |

### (d-2) Les 70 constats et recommandations (CAMEC-R), ceux qui touchent au logiciel

Les constats qui doublent un constat d'usage renvoient à lui.

| N° | Objet | OmegaX le règle ? | Preuve |
|---|---|---|---|
| R3 | indicateurs de l'Instruction BCC n° 004 calculés par le logiciel | hors champ | voir U14 |
| R6 | module Budget inutilisé | oui | voir U8 |
| R11 | TFT et tableaux FinA | voir U23 | |
| R14 | ratios prudentiels à la main | hors champ (Instruction BCC n° 002) | · |
| R16 | revue analytique avant transmission | partiel · évolution des soldes, comparatif N-1 des états | `client/src/pages/EvolutionSoldesPage.tsx` |
| R17 | visa de la RAF dans le logiciel | voir U6 | |
| R18 | suivi des subventions par convention | oui dans le champ SYCEBNL · bailleurs, conventions, reprises | `src/modules/bailleurs/`, `immobilisations/subvention-rattachee.ts` |
| R19 | schémas automatiques qui gonflent 678 et 779 | hors champ (comptes du PCCI) ; dans OmegaX, toute écriture d'un module est nommée par sa liaison et retenue | `comptabilite/detenteurs-ecriture.ts` (CLAUDE.md § 10 bis) |
| R20 | écriture validée annulable par l'administrateur ; pièces non numérotées | **oui** · aucune dévalidation ; numéro imposé par le journal, trous de séquence nommés | CLAUDE.md § 10 bis ; `journaux/sequence-pieces.ts` |
| R21 | rapprochements mensuels non formalisés | partiel · rapprochement bancaire, contrôle « banque à rapprocher avant l'arrêté » ; encours de crédit et d'épargne hors champ | `controles/banque-et-cloture-informatique.ts` |
| R22 | aucune liste de contrôle à la clôture ; comptes 42, 45, 47 non justifiés | oui · planning de clôture, contrôles de clôture, dossier de révision, balance âgée qui lit le 47 | `exercice/planning-cloture.ts`, `controles/dossier-revision.service.ts` |
| R23 | comptes créés sans validation, codes à sept chiffres | voir U13 ; longueur des numéros paramétrable, jamais en dessous du plus long ouvert | `Tenant.longueurCompte` (CLAUDE.md § 6) |
| R24 | clôture étalée sur plusieurs mois | partiel · planning de clôture et échéances | `exercice/planning-cloture.ts` |
| R25 | aucune comparaison documentée d'une balance à la précédente | partiel · évolution des soldes ; la trace de la revue n'est pas gardée | `EvolutionSoldesPage.tsx` |
| R26 | grand livre compte par compte | voir U1 | |
| R27 | droits d'administrateur au chef comptable, saisie et validation par la même personne, aucune matrice | partiel · rôles et profils, double regard ; aucune édition de la matrice des habilitations | `common/fonctions/fonctions-metier.ts` |
| R28 | sauvegardes manuelles, aucune restauration | voir U21 | |
| R29 | aucun journal des modifications | voir U19 | |
| R30 | l'éditeur seul corrige, extrait, débloque | oui · le cabinet fait seul ces gestes ; restitution complète du dossier sans l'éditeur | `src/modules/exports/restitution/` |
| R31 | sessions inactives fermées à la main ; mots de passe ; arrêt sans internet | voir U20 et U22 ; « Déconnecter » un collaborateur par l'administrateur | `POST /utilisateurs/:id/deconnecter` |
| R33 | hors bilan (classe 0), crédits en perte, intérêts en souffrance | hors champ | · |
| R35 | conditions d'un crédit approuvé modifiées | hors champ | · |
| R36 | pénalités et frais | voir U16 | |
| R38 | Commission de crédit sans accès | voir U7 | |
| R41 | journée comptabilisée sans caisse arrêtée | voir U12 | |
| R42 | mouvements siège-agences soldés en fin de mois seulement | partiel · virement de fonds par le 585 soldé à l'entrée ; liaison du groupe par le 58 (SYCEBNL) ou les 184 à 187 (SYSCOHADA) ; les 579 et 59 du PCCI sont hors champ | `src/modules/virements-fonds/`, `src/modules/groupe/` |
| R43 | position de change | voir U24 | |
| R46 | manquant de caisse au passif, surplus à l'actif | partiel · la classe se lit sur le numéro ; aucun plan n'ouvre un compte « écart de caisse » et l'excédent n'a pas de compte prescrit, ce qu'OmegaX dit au lieu de l'inventer | CLAUDE.md § 6, « Excédent d'inventaire » |
| R47 | compte client ouvert et validé par une seule personne | hors champ (compte de déposant) | · |
| R50 | comptes d'épargne débiteurs | voir U17 | |
| R55 | avances au personnel sur Excel | voir U11 | |
| R57 | immobilisations non inventoriées, non étiquetées | oui · inventaire physique, numéros d'inventaire | voir U10 |
| R59 | acquisition à la main, réévaluation sur Excel | voir U9 et U25 | |

**Bilan des constats retenus** · sur les 26 constats d'usage, OmegaX en règle
14 (U1 à U5, U8 à U10, U13, U19 à U21, U23, U25), en partie 6 (U6, U11, U12,
U22, U24, U26), et 6 sont hors champ (U7, U14 à U18, U18 réglé pour les DAT
placés).

---

## (e) Verdict

### Où OmegaX est en avance

1. **Le contrôle interne et la piste d'audit**, que la CAMEC met au cœur de
   ses reproches · journal d'audit chaîné (U19, R29), aucune dévalidation
   (R20), corrections faites par le cabinet sans l'éditeur (U5, R30),
   sauvegardes chiffrées et restaurées (U21, R28), double authentification et
   verrouillage (U22).
2. **La conformité comptable** · deux référentiels légaux complets avec leurs
   états, TFT compris (U23), là où le manuel se dit conforme au « référentiel
   des SFD » d'Afrique de l'Ouest (M p. 3).
3. **Ce qui marche** · le virement des salaires et le rapprochement bancaire
   fonctionnent, quand le manuel de Microfina++ dit les siens en panne
   (CAMEC p. 137) ou que la CAMEC les fait à la main (U2).
4. **Paie, fiscalité, immobilisations, stocks, révision** · sourcés article
   par article ; le manuel lu n'en décrit aucun.

### Où OmegaX est en retard

1. **Le visa à plusieurs niveaux et à seuil** · Microfina++ vise puis valide
   les opérations bancaires, les retraits au-delà d'un plafond, les dossiers
   (M p. 65-67 ; CAMEC p. 115-116, 131-133) ; OmegaX n'a qu'une validation,
   avec un second regard en option, sans seuil de montant.
2. **Les objets de trésorerie de tous les jours** · registre des chèques
   émis, échéancier d'emprunt long, arrêté de caisse à la journée.
3. **La langue anglaise et la localisation hiérarchique**, utiles aux ONG
   internationales et aux déclarations par province.
4. **La paie, sur un point attesté** · le visa des retenues sur salaire
   (CAMEC p. 275-279).

Tout le reste du retard apparent (épargne, crédit, guichets, PCCI, FinA,
ratios prudentiels) est **hors champ** par les textes cités en tête.

### Les dix idées de Microfina++ les plus utiles à reprendre

Classées par valeur pour un client d'OmegaX. Toutes sont des fonctions
NOUVELLES sous le gel (CLAUDE.md § 5) · aucune n'est codée ; chacune exige que
Manasse lève le gel pour elle, et la lecture de son texte avant toute ligne
(CLAUDE.md § 1).

| Rang | Idée | Vue chez Microfina++ | Valeur pour un client d'OmegaX | Effort | Texte, ou nature de la règle |
|---|---|---|---|---|---|
| 1 | **Visa à seuil** · au-delà d'un montant que le dossier fixe, une écriture de trésorerie (ou toute écriture) exige le visa d'un second utilisateur avant validation ; en deçà, la règle actuelle | M p. 65-67 ; CAMEC p. 131-133 | très forte · c'est le reproche le plus répété de la CAMEC (U3, U6, R17, R27) et le cœur du contrôle d'une ONG financée | 4 à 6 j | aucun texte ne l'impose · même lecture que le double regard (CLAUDE.md § 10 ter) ; seuil déclaré par le dossier, jamais en dur |
| 2 | **Emprunt bancaire tenu** · mise en place, tableau d'échéances, remboursement en capital et intérêts, intérêts courus à la clôture, reclassement de la part à moins d'un an | M p. 70-71 (titres) | forte pour une entreprise SYSCOHADA | 6 à 8 j | fiche du compte 16 (et 18 au SYCEBNL) des deux plans, à relire ; intérêts courus déjà tenus (`regularisation/interets-courus.ts`) |
| 3 | **Avances au personnel tenues jusqu'au bout** · versement passé, retenue proposée d'office, visa facultatif | CAMEC p. 275-279 | forte (CAMEC-U 11, R55) | 3 à 5 j | Code du travail, art. 112, c) et f) · voir `paie-microfina-omegax.md`, (d), rang 2 |
| 4 | **Arrêté de caisse périodique** · procès-verbal de comptage simplifié à la date choisie (journée, semaine), coupures en table par devise, écart dit | CAMEC p. 91-92 ; M p. 18, 45 | forte pour une association à caisse active | 3 à 5 j | fiche du compte 57 des deux plans (« le solde du compte caisse doit toujours correspondre exactement à la somme disponible réellement », tel que le cite CLAUDE.md § 6) ; le procès-verbal existe déjà |
| 5 | **Périodes budgétaires libres** · trimestre, semestre ou période de convention, à côté de l'annuel et du mensuel | M p. 28-29 | forte pour un projet qui rend compte au bailleur par trimestre | 3 à 4 j | SYCEBNL, Partie 4 ch. 3 (nomenclature budgétaire du projet), à relire |
| 6 | **Registre des chèques émis** · chéquiers reçus de la banque, chèques émis, annulés, en circulation, rapprochés au relevé | M p. 69-70 | moyenne à forte (fraude par chèque, CAMEC-R 58 sur les imprimés de valeur) | 3 à 4 j | fiches des comptes 52 des deux plans, à relire ; aucun texte n'impose le registre |
| 7 | **Indicateurs financiers mensuels** · tableau par mois et par exercice, définis par le cabinet, lus sur la balance | CAMEC p. 143 | moyenne · le gérant revoit chaque mois (CAMEC-R 10) | 3 à 5 j | définition d'OmegaX, dite, comme les états personnalisés (`etats-personnalises/`) ; jamais un indicateur BCC |
| 8 | **Rapport des tiers modifiés** · données initiales et actuelles d'une fiche, ouvert au comptable et non au seul administrateur | M p. 53, 58 | moyenne (contrôle des changements de coordonnées) | 2 j | lecture du journal d'audit existant (`src/common/audit/`), sans champ sensible |
| 9 | **Interface en anglais** | M p. 14 | moyenne à forte pour une ONG internationale ; nulle pour une PME | 15 j et plus | décision commerciale ; les états légaux restent en français (AUDCIF et SYCEBNL dans leur langue) |
| 10 | **Localisation hiérarchique des tiers et des salariés** (province, ville, commune), servie aux états par province | M p. 30-32 | moyenne · la déclaration mensuelle unique ventile « les montants déclarés par province de provenance » | 3 à 4 j | arrêté n° 146/2018, art. 22, point 5 (compétence `cnss-cotisations-sociales-rdc`, lu) |

### Ce qu'il faut pour aller plus loin

Lire les folios 80 à 306. Les modules Caisse, Crédit, Comptabilité, Budget,
États financiers, Contrôle, Autres, Paie, Immobilisations, GRH et Stocks ne
sont connus ici que par une phrase du folio 6 ou par la page que cite la
CAMEC. Aucune fonction de ces modules n'est prêtée à Microfina++ au-delà.
