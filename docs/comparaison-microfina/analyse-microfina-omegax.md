# Microfina++ et OmegaX · analyse comparative (2026-10-21)

Document d'analyse, sans décision. Il ne prescrit aucun développement :
CLAUDE.md § 5 tient le GEL DES NOUVEAUTÉS jusqu'à la fin du pilote, et rien
de ce qui suit ne se code sans une décision expresse de Manasse.

Convention de renvoi · « M p. N » renvoie à la page N du manuel Microfina++
(numéro imprimé en pied de page) ; « CLAUDE.md § N » au règlement du dépôt ;
un chemin renvoie au fichier d'OmegaX lu sur `main` (révision `0a9ea6f`).

---

## 0. Sources lues, et ce qui ne l'a pas été

**Microfina++.** « Guide de l'utilisateur · Microfina++ », version du document
0.1, Copyright MEDIASOFT (fichier Drive « Manuel MICROFINA ++( Document
final)_compressed.pdf »).

- Lu : le texte intégral rendu par l'extraction du Drive, pages 1 à 79, du
  sommaire jusqu'à « Consultation du tableau d'amortissement » du plan
  d'épargne (M p. 79). L'extraction se termine par la liste des liens du
  document, ce qui laisse penser qu'elle a atteint la fin du fichier ; je ne
  peux pas le garantir.
- Non lu : le PDF lui-même. Il pèse 10,7 Mo, au-dessus de la limite de
  téléchargement de l'outil Drive (10 Mo), et le relais réseau refuse le
  téléchargement direct (403). Les CAPTURES d'écran n'ont donc pas été vues ;
  seul le texte qui les décrit l'a été. Le nombre exact de pages n'est pas
  confirmé.
- Le manuel est un BROUILLON : sommaire cassé (« Erreur ! Signet non
  défini », M p. 1), une note interne laissée en clair (« L'onglet ne marche
  pas », M p. 70), plusieurs sections réduites à un titre (Visa et Validation
  bancaires, M p. 65 et 66 ; Emprunts bancaires, M p. 70 ; Procurations, M p.
  56). Les menus **Caisse, Crédit, Comptabilité (opérations), Budget
  (opérations) et Autres**, annoncés M p. 13, ne sont décrits dans aucune page
  lue. Ce document ne prête donc à Microfina++ aucune fonction de ces menus
  au-delà de l'annonce de la M p. 3.
- Le site de l'éditeur (cité M p. 2) n'a pas été consulté.

**OmegaX.** CLAUDE.md en entier ; menus de `client/src/components/chrome/AppShell.tsx` ;
liste des modules de `src/modules/` ; vérifications ponctuelles dans
`prisma/schema.prisma`, `src/modules/import/`, `src/modules/utilisateurs/`,
`client/src/lib/formes-juridiques-syscohada.ts`, `docs/hebergement-en-rdc.md`.

**Réglementation de la microfinance en RDC.** Compétence
`reglementation-microfinance-rdc`, fichiers LUS : loi n° 11/020 du 15
septembre 2011 (art. 1 à 14, 35 à 50) ; Instruction BCC n° 006 du 14 avril
2012 (texte entier) ; PCCI, juillet 2009, parties 1 à 4 et 9 à 11, classe 3
(comptes 30 à 38), extraits des règles d'évaluation ; loi n° 002/2002 (art.
63 à 67) ; loi n° 22-069 du 27 décembre 2022 (champ d'application, Titre II
section 5) ; en-têtes et articles d'objet des Instructions n° 5, 36, 38 et
41. Compétence `audcif-acte-uniforme` : AUDCIF art. 5.

**Non lu, et qui manque pour trancher** : l'Instruction n° 1 aux IMF (citée
par le PCCI et l'Instruction n° 006, absente du corpus) ; l'instruction BCC
qui fixe le « statut des créances litigieuses ou en souffrance » (le PCCI
§ 10.4 y renvoie, elle n'est pas au corpus) ; les Instructions n° 17, 21 et
22 (contrôle interne, gouvernance, gestion des risques, citées par
l'Instruction n° 36, absentes) ; le format des états périodiques que la BCC
reçoit. Rien n'est dit ci-dessous sur le provisionnement des crédits par
âge, les ratios prudentiels ou le reporting BCC au-delà de ce que les textes
lus disent.

---

## 1. Ce qu'est Microfina++ (a)

| Point | Ce que dit le manuel | Renvoi |
|---|---|---|
| Éditeur | Société MEDIASOFT (site mediasofthome.net) | M p. 2, 3 |
| Cible | « logiciel de gestion des opérations pour les IF (Institutions Financières) », « adapté à différents types d'IMF (Institution de Micro Finance) et banques » | M p. 3 |
| Promesse | gestion des clients (adhésion, parts sociales), de l'épargne (comptes, dépôts, retraits), du crédit (dossier, approbation, déboursement, suivi des remboursements), paramétrage des produits, administration (sécurité, traitements de fin de journée) | M p. 3 |
| Référentiel annoncé | « conforme aux dispositions du nouveau référentiel des SFD » ; aucune mention de la BCC, du PCCI, de la RDC ni du franc congolais dans les pages lues | M p. 3 |
| Technique | Java (JDK 1.7), JSF / PrimeFaces, Glassfish 4 ou JBoss ; SQL Server 2008 R2 ou Oracle 11g ; monoposte ou client / serveur ; serveur Windows 2008 R2 et RedHat 5 ; accès par navigateur (`https://NomDuServeur:Port/Microfina`) | M p. 3, 4, 5 |
| Matériel | serveur de base et serveur d'application (Core i3), disque de sauvegarde RDX, onduleur | M p. 4 |
| Langues | français et anglais | M p. 14 |
| Modules | Microfina++ (principal), Paie, Immo, GRH, Stocks, Administration | M p. 6 |
| Menus du module principal | Client, Banque, Épargne, Caisse, Crédit, Comptabilité, Budget, Autres, Paramétrage, Administration | M p. 13 |
| Journée | la journée ouverte figure en bas de page ; une « ouverture de journée » se fait en Administration | M p. 13, 21 |
| Suppression | « généralement logiques » (la donnée reste en base pour l'historique) | M p. 12 |

En une phrase · Microfina++ est un **système de gestion des opérations
d'une institution financière** (un « core banking » de microfinance), dont
la comptabilité est une conséquence des opérations de guichet ; OmegaX est un
**logiciel de comptabilité légale et de révision** pour ASBL, ONG et
entreprises (CLAUDE.md, en-tête et § 6), qui ne tient aucun compte de
déposant ni aucun prêt à la clientèle.

---

## 2. Inventaire fonction par fonction (b)

Légende · **oui** : la fonction existe dans OmegaX ; **partiel** : un
équivalent existe avec un périmètre ou un sens différent ; **non** : rien.

### 2.1 Administration

| Module | Fonction | M p. | OmegaX | Où dans OmegaX | Remarque |
|---|---|---|---|---|---|
| Administration | Profils et droits par tâche (cocher les tâches d'un profil) | 15, 16 | oui | `src/common/fonctions/fonctions-metier.ts`, `src/common/guards/roles-cantonnes.ts` ; CLAUDE.md § 6 point 15, § 8 | OmegaX : cinq rôles plus un profil de fonctions qui RESTREINT sans élargir |
| Administration | Création d'utilisateur, rattachement à une agence | 16, 17 | oui | Fichier > Autorisations d'accès (`/utilisateurs`, `src/modules/utilisateurs/`) | l'« agence » d'OmegaX est le dossier |
| Administration | Déconnecter un utilisateur | 18 | partiel | `utilisateur.service.ts` pose `sessionsInvalidesAvant` au changement de rôle, de profil, de journaux, à la désactivation et à la réinitialisation ; CLAUDE.md § 8 | pas de bouton « déconnecter » seul côté administrateur ; le titulaire a « Déconnecter mes autres appareils » |
| Administration | Gestion des guichets, case « billetage », comptes associés | 18 | partiel | journal de caisse avec son compte (CLAUDE.md § 6, « un journal de banque ou de caisse a son propre compte ») ; ventilation par coupure du PV de caisse (`CoupureComptee`, `prisma/schema.prisma`) | le billetage d'OmegaX est un COMPTAGE d'inventaire, pas une saisie au guichet |
| Administration | Ouverture et fermeture de guichet | 19 | non | · | aucune notion de session de caisse |
| Administration | Affectation d'un guichet à un utilisateur | 19, 20 | partiel | journaux autorisés par utilisateur (`src/common/perimetre/extension-perimetre-journaux.ts`, CLAUDE.md priorité 5) | restreint la SAISIE par journal ; un journal de caisse par guichet l'émule |
| Administration | Exercice · création, ouverture, « compléter journal détail » | 20, 21 | oui | État > Exercices (`ExercicePage.tsx`, `src/modules/exercice/`) | OmegaX ajoute la clôture dans l'ordre, l'arrêté des comptes, le report à-nouveau (CLAUDE.md § 6) |
| Administration | Ouverture de journée | 21 | non | · | OmegaX fige par CLÔTURE DE PÉRIODE ou de journal (`exercice/gel-cloture.ts`), pas par journée |
| Administration | Rapport des transactions sur une période, export | 22 | oui | Journal, grand livre exportés en flux, balance et grand livre d'une période (CLAUDE.md § 6, « Journal et grand livre exportés en flux », « Balance et grand livre d'une période ») ; export des seules modifications (ligne sage-l7) ; Journal d'audit (`src/common/audit/`) | |

### 2.2 Paramétrage (« Info de base »)

| Module | Fonction | M p. | OmegaX | Où dans OmegaX | Remarque |
|---|---|---|---|---|---|
| Client | Secteurs d'activité | 23 | partiel | code d'activité de la NOTE 36, SYSCOHADA seul (`Tenant.codeActivitePrincipale`, CLAUDE.md § 6 « Nomenclatures ») | pour le dossier, pas pour ses tiers |
| Client | Numérotation des clients, structure du numéro de compte client | 23, 26 | oui | numéro du compte de tiers proposé et modifiable, panoplie (`GET /tiers/numero-propose`, CLAUDE.md § 6 point 13) | |
| Client | Frais par opération, frais d'adhésion par type de client | 24 à 26 | non | · | OmegaX ne facture aucune opération de guichet ; la cotisation SYCEBNL est un produit, pas un frais (CLAUDE.md § 6, « Cotisations ») |
| Client | Motifs de départ d'un client | 26 | non | mise en sommeil d'un tiers (CLAUDE.md § 6, « Compte en sommeil », « Suppression des structures ») | sans motif codifié |
| Budget | Types de centres de coût, centres de coût hiérarchisés | 27 | oui | Plans analytiques, sections DÉTAIL et TOTAL (`analytique/rubriques-budgetaires.ts`, CLAUDE.md § 6 « Rubriques budgétaires ») | |
| Budget | Types de budget, types de période, périodes | 28, 29 | partiel | budgets annuels et mensuels par section (`doterBudget`, CLAUDE.md § 6 « Budgets ») | pas de périodes libres |
| Budget | Plan budgétaire et lignes, avec centre de coût et BAILLEUR | 29 | oui | Bailleurs, Dossier de subvention, Registre des engagements, exécution budgétaire (notes 35 et 24 SYCEBNL) (CLAUDE.md § 6) | OmegaX va plus loin pour un projet financé |
| Budget | Opérations budgétaires par type | 30 | partiel | OD analytiques (`analytique/od-analytique.ts`) | |
| Localisation | Pays, département, commune, arrondissement, quartier | 30 à 32 | partiel | adresse, ville et pays du tiers (`model Tiers`, `prisma/schema.prisma`) | hiérarchie figée dans Microfina++ ; aucune source lue ne dit si elle suit les entités territoriales de la RDC |
| Produit crédit | Type et objet de crédit, type de produit, cycle, zone, degré, terme, périodicité | 32 à 35 | non | · | |
| Produit crédit | Type d'assurance, assureur crédit, gestionnaire de portefeuille | 36 | non | · | |
| Produit crédit | Ordre de remboursement (frais, intérêts, capital…) | 37 | partiel | imputation des paiements par le Code civil, Livre III, art. 151 à 154 (`imputation-paiements.ts`, CLAUDE.md § 6 « TVA à l'encaissement ») | pour des FACTURES, jamais pour des échéances de prêt |
| Produit crédit | Produit de crédit (garanties financières, assurance, frais), activation | 37 à 39 | non | · | |
| Produit crédit | Modèle comptable de crédit (comptes capital, interne, intérêt) | 40 | non | · | |
| Produit épargne | Produits d'épargne, paramétrage des comptes (épargne, courant, DAT, bloqué) | 40, 41 | non | · | |
| Comptabilité | Numéro de pièce | 41 | oui | modes de numérotation par journal (`journaux/numerotation-piece.ts`, `journaux/sequence-pieces.ts`, CLAUDE.md § 6 point 17 et § 10 bis) | OmegaX contrôle aussi les TROUS de séquence |
| Comptabilité | Journaux | 41 | oui | Codes journaux (`/journaux`) | |
| Comptabilité | « ED DIVERS » · écritures paramétrées par type d'opération | 42 | partiel | Modèles de saisie à fonctions (`/modeles-saisie`, CLAUDE.md § 6 point 6) | |
| Société | Informations de la société, agences, zones, logo | 42, 43 | partiel | Paramètres du dossier ; agences en cellules du module Groupe (CLAUDE.md § 6 « Module groupe ») ; mentions imprimées (`tenant/mentions-immatriculation.ts`) | |
| Agence | Gestionnaires, sensibilisateurs, commerciaux | 43 | non | · | |
| Agence | Journées de travail, jours fériés | 44 | partiel | jours fériés de l'ordonnance n° 23-042, liste fixe (`retenues/jour-ouvrable.ts`, CLAUDE.md § 6 « Le jour ouvrable fiscal ») | servis aux échéances, non paramétrables |
| Préférences | Devises | 45 | oui | Devises et réévaluation (`src/modules/devises/`, CLAUDE.md § 6 M2, F49, A5, A6) | |
| Préférences | Types de monnaie et coupures | 45 | partiel | valeur faciale libre au PV de comptage (`CoupureComptee.valeurUnitaire`) | pas de table de coupures |
| Facture | Éléments de facture, référence de commande | 46 | oui | Facturation, Devis et commande client (CLAUDE.md § 6 « Facturation », « Devis et commande client ») | |

### 2.3 Client (membres)

| Module | Fonction | M p. | OmegaX | Où dans OmegaX | Remarque |
|---|---|---|---|---|---|
| Client | Enrôlement d'une personne physique, d'une entreprise, d'un groupe | 47 à 50 | partiel | Plan des tiers, types ADHERENT, CLIENT, FOURNISSEUR, SALARIE, AUTRE (`enum TypeTiers`) | aucune fiche d'identification de déposant |
| Client | Personnes liées, bénéficiaires, dirigeants, signataires | 48 à 50 | non | · | |
| Client | Photo et spécimen de signature | 48, 57 | partiel | documents attachés aux tiers, PDF ou image (`tiers/documents-tiers.ts`) ; pièces jointes des écritures et des salariés (CLAUDE.md § 6, ligne sage-l6) | pièce jointe, pas un spécimen consultable au guichet |
| Client | Visa de l'enrôlement par un second agent, contrat d'adhésion imprimé | 51 | non | le double regard d'OmegaX porte sur la VALIDATION des écritures (CLAUDE.md § 10 ter), pas sur les fiches | |
| Client | Modifier les frais d'ouverture, valider un client modifié | 52, 53 | non | · | |
| Client | Consulter le client, données initiales et actuelles | 53 | partiel | Journal d'audit, pré-image des modifications (`src/common/audit/`) | réservé à l'administrateur |
| Client | Groupe solidaire et affectation des membres | 53, 54 | non | · | loi n° 11/020, art. 44, organise cette solidarité |
| Client | Prospects | 54 | non | · | |
| Client | Mise à jour, procurations, résiliation | 55, 56 | partiel | modification et mise en sommeil d'un tiers | ni procuration ni résiliation de contrat |
| Client | « Consentement BIC » | 57 | non | · | le manuel ne définit pas le sigle |
| Client | Rapports multicritères, prospects, clients modifiés | 57, 58 | partiel | éditions des structures (`lib/editions-structures.ts`, CLAUDE.md § 6 point 18) | |

### 2.4 Banque

| Module | Fonction | M p. | OmegaX | Où dans OmegaX | Remarque |
|---|---|---|---|---|---|
| Banque | Encaissement et décaissement bancaires | 59, 60 | oui | saisie au journal de banque, contrepartie à chaque ligne (CLAUDE.md § 6 point 5) | |
| Banque | Virement banque vers caisse, banque vers banque | 60, 61 | oui | Virement de fonds par le 585, deux pièces liées, porteur exigé pour une caisse (`src/modules/virements-fonds/`, CLAUDE.md § 6) | OmegaX refuse la trésorerie en devise à cet écran |
| Banque | Virement ou prélèvement sur le compte d'un client | 61 | non | · | suppose un compte de déposant |
| Banque | Déblocage de crédit par chèque, contrat de prêt | 62 | non | · | |
| Banque | Remboursement de crédit par banque | 63 | non | · | |
| Banque | Adhésion avec premier dépôt par banque | 64, 65 | non | · | |
| Banque | Visa, puis validation des opérations bancaires | 65, 66 | partiel | double regard à la validation, en option (`Tenant.doubleRegardValidation`, CLAUDE.md § 10 ter) | Microfina++ sépare deux étapes ; le manuel n'en dit que les titres |
| Banque | Banques des clients, banques de l'institution (compte, journal, gestionnaire) | 67 | partiel | Banques et RIB, IBAN contrôlé, un RIB par journal (`banques/banques.ts`, CLAUDE.md § 6 point 19) ; RIB des tiers (`tiers/ribs-tiers.ts`) | |
| Banque | Dépôt, encaissement et historique de chèques clients | 68, 69 | non | · | les fiches SYCEBNL du compte 51 en règlent l'écriture ; aucun registre de chèques |
| Banque | Génération de chéquiers, chèques pour crédit | 69, 70 | non | · | « L'onglet ne marche pas » (M p. 70) |
| Banque | Emprunts bancaires · mise en place, remboursement | 70 | partiel | intérêts courus sur emprunts (`regularisation/interets-courus.ts`, CLAUDE.md § 6 ligne A12) | aucun échéancier d'emprunt ; le manuel ne décrit que les titres |
| Banque | Rapports par banque, agence et période | 71 | oui | grand livre, balance, rapprochement bancaire sur relevé importé (`rapprochement/releve-bancaire.ts`) | |

### 2.5 Épargne

| Module | Fonction | M p. | OmegaX | Où dans OmegaX | Remarque |
|---|---|---|---|---|---|
| Épargne | Ouverture d'un compte d'épargne par produit | 72 | non | · | |
| Épargne | Relevé de compte (livret, dépôt de garantie, capitalisation), situation du client | 73, 74 | non | le « Rappel et relevé » d'OmegaX est un relevé de CRÉANCE (`/relances`) | |
| Épargne | Dépôt à terme · mise en place (échéance, intérêt, montant calculés), reconduction, validation, rupture, recherche | 75 à 77 | non | · | |
| Épargne | Plan d'épargne · simulation, création, tableau des échéances cotisées ou non | 78, 79 | non | · | « édition des cotisations » et « rupture » annoncées, non décrites |
| Épargne | Clôturer, bloquer un compte ou un montant ; rapports | 72 | non | · | annoncés seulement |

### 2.6 Annoncé, non décrit dans les pages lues

| Module | Fonction | M p. | OmegaX | Remarque |
|---|---|---|---|---|
| Crédit | Dossier de crédit, approbation, déboursement, suivi des remboursements | 3, 13 | non | aucune page lue ne décrit le menu Crédit |
| Caisse | Opérations de guichet (dépôts, retraits) | 3, 13 | non | idem pour le menu Caisse |
| Comptabilité | Opérations comptables | 13 | oui (OmegaX) | le manuel ne dit pas ce que fait ce menu |
| Administration | « traitements de fin de journée » | 3 | non | |
| Paie, Immo, GRH, Stocks | modules complémentaires | 6 | oui | OmegaX : Registre du personnel, paie, congés acquis, absences, paiement des salaires (`src/modules/personnel/`, CLAUDE.md § 6, P1 à P9 et ligne sage-l5), Immobilisations, Magasin et variation des stocks ; le manuel ne décrit aucun de ces modules |
| Rapports | « états personnalisés » | 3 | oui | États personnalisés (`etats-personnalises/moteur-etat-personnalise.ts`) |

---

## 3. Ce que Microfina++ fait et qu'OmegaX ne fait pas (c)

### 3.1 Le métier propre à la microfinance

Tout le cœur de Microfina++ est absent d'OmegaX, et ce n'est pas un manque
de finition : OmegaX n'a aucun objet « compte de déposant », « prêt », «
échéance », « garantie » ni « membre », et aucune écriture née d'une
opération de guichet.

- **Membres et clients** · identification complète, personnes liées,
  signataires, photo et signature, visa à l'entrée, contrat d'adhésion,
  groupes solidaires (M p. 47 à 58). La loi n° 11/020, art. 44, fait de la
  solidarité une sûreté propre aux IMF.
- **Épargne** · produits, comptes, relevés, dépôts à terme avec intérêts
  calculés et reconduction, plans d'épargne (M p. 40, 41, 72 à 79). Le PCCI
  range ces dettes en classe 3 (comptes 33 « Epargnes et dépôts ordinaires »,
  34 « Dépôts à terme », 35 « Dépôts à régime spécial »).
- **Crédit** · produits paramétrés, ordre de remboursement, assurance,
  déblocage, remboursement (M p. 32 à 40, 62, 63) ; le suivi, l'approbation
  et le reste du cycle sont annoncés (M p. 3) mais non décrits.
- **Guichet** · guichets, billetage, ouverture et fermeture, affectation
  aux agents, ouverture de journée (M p. 18 à 21), chèques clients et
  chéquiers (M p. 68 à 70).
- **Portefeuille à risque et provisionnement des crédits** · le manuel lu
  n'en dit RIEN (pas de PAR, pas de classement des créances, pas de
  provision). Le PCCI l'exige pourtant : créances en retard au compte 39,
  provisions au 38, intérêts des créances en retard comptés en produits «
  qu'après leur encaissement effectif », fraction d'intérêts des échéances
  impayées provisionnée « intégralement » (PCCI, classe 3 et § 6, règles
  d'évaluation). Le classement lui-même est renvoyé à une instruction BCC
  non lue (PCCI § 10.4).
- **Reporting BCC** · le manuel n'en dit rien de précis (seulement des «
  rapports comprenant notamment les informations comptables », M p. 3). Les
  textes lus l'imposent : états mensuels, trimestriels et annuels (PCCI
  § 2.2) ; « situation financière détaillée » à la périodicité fixée par la
  BCC, comptes annuels certifiés dans les quatre mois (loi n° 22-069, Titre
  II, section 5) ; pour les COOPEC, rapport annuel et états consolidés du
  réseau dans les six mois (loi n° 002/2002, art. 64 à 66). S'y ajoutent la
  centrale des risques (Instruction n° 5, art. 1er : données signalétiques,
  concours, sûretés, habitudes de remboursement), le TEG (Instruction n° 38)
  et la gestion des plaintes (Instruction n° 39), dont les pages lues ne
  disent rien.

### 3.2 Le métier comptable et de gestion général

Peu de choses, et toutes de second rang :

- localisation hiérarchique des tiers (M p. 30 à 32) ;
- frais paramétrés par opération et par type de client (M p. 24 à 26) ;
- périodes budgétaires libres (M p. 28, 29) ;
- coupures de monnaie en table (M p. 45) ;
- bouton de déconnexion d'un utilisateur par l'administrateur (M p. 18) ;
- interface en anglais (M p. 14) · OmegaX est en français seul (« la langue
  (français, seule) », CLAUDE.md § 6, « Pages légales et aide » ; aucune
  bibliothèque de traduction dans `client/package.json`) ;
- registre des chèques reçus et émis (M p. 68 à 70) ;
- échéancier d'emprunt bancaire (annoncé M p. 70, non décrit).

---

## 4. Ce qu'OmegaX fait mieux, ou que Microfina++ n'a pas (d)

Comparé au manuel lu, qui ne décrit aucun état financier, aucune clôture
d'exercice et aucun contrôle :

- **Deux référentiels légaux complets et cloisonnés** · SYCEBNL (trois jeux,
  45, 26 et 5 notes) et SYSCOHADA (Système normal et SMT, bilan, résultat,
  TFT, 36 notes), avec fiches par compte citées du texte (CLAUDE.md § 6).
  Microfina++ ne revendique qu'un « référentiel des SFD » (M p. 3).
- **Clôture et livre-journal conformes à l'AUDCIF art. 22** · validation
  irréversible, correction par inscription en négatif, clôture de période,
  date de valeur au premier jour ouvert, à-nouveaux contrôlés (CLAUDE.md § 6,
  points 11 et 12, « AUDCIF art. 22, 4° »).
- **Révision et contrôle** · dossier de révision, test des écritures de
  journal (ISA 240), circularisation (ISA 505), inventaire physique,
  procès-verbaux de caisse, registre des faiblesses (ISA 265), registre des
  provisions, questionnaire CPCC (CLAUDE.md § 6, § 10 ter ; menu État >
  Contrôle et révision).
- **Fiscalité congolaise** · TVA (déclaration, liquidation, encaissement),
  retenues et échéancier, résultat fiscal et IS, acomptes (CLAUDE.md § 6).
- **Paie congolaise sourcée** · SMIG, CNSS, INPP, ONEM, IRPP, bulletins
  indélébiles, décompte final (CLAUDE.md § 6, P0 à P9). Le manuel cite un
  module Paie sans le décrire (M p. 6).
- **Immobilisations, stocks, consolidation SYSCOHADA, IFRS** (CLAUDE.md § 6).
- **Piste d'audit chaînée** · journal d'audit dont chaque événement porte
  l'empreinte du précédent (CLAUDE.md § 8, « Journal d'audit »). Le manuel ne
  parle que de suppression logique « afin de retracer les historiques » (M p.
  12).
- **Sécurité** · double authentification, verrouillage progressif,
  révocation des sessions, cloisonnement par dossier refusé au niveau du
  client Prisma, restitution complète du dossier (CLAUDE.md § 8). Le manuel
  décrit un nom d'utilisateur et un mot de passe (M p. 5).
- **Déploiement** · en ligne et sur site (licence signée, sauvegardes
  chiffrées, CLAUDE.md § 6 « Installation sur site »), contre un serveur à
  monter et maintenir chez le client (M p. 3, 4).
- **Import d'écritures, de balances et de bilans d'ouverture** en CSV ou
  XLSX, colonnes mises en correspondance, devise comprise
  (`src/modules/import/import.service.ts`, champs date, journal, pièce,
  référence, compte, libellé, débit, crédit, devise, cours).

---

## 5. Ergonomie, contrôle interne, sécurité, piste d'audit, multi-agences, clôture, états réglementaires (e)

| Axe | Microfina++ (manuel lu) | OmegaX |
|---|---|---|
| Ergonomie | pages à onglets, assistant Suivant / Précédent, grilles paginées avec filtre et export Excel, boîtes de confirmation à chaque geste (M p. 7 à 12) | disposition de Sage i7, fenêtres multiples, aucune explication à l'écran, aide en bulle, Échap gardé (CLAUDE.md § 9 ter) |
| Langues | français, anglais (M p. 14) | français |
| Contrôle interne | profils par tâche, visa puis validation des opérations bancaires et des fiches clients (M p. 15, 51, 65, 66) | rôles, profils de fonctions, journaux autorisés, double regard optionnel à la validation (CLAUDE.md § 8, § 10 ter) |
| Sécurité | identifiant et mot de passe (M p. 5) ; rien d'autre dans les pages lues | 2FA, verrouillage, sessions révocables, cloisonnement vérifié par sa valeur (CLAUDE.md § 8) |
| Piste d'audit | suppression logique, rapport des transactions (M p. 12, 22) | journal d'audit chaîné, auteur et validateur restitués à l'export (CLAUDE.md § 8, § 10 ter) |
| Multi-agences | agences et zones, utilisateurs et guichets par agence (M p. 17, 34, 42, 43) | un dossier par entité ; groupe et cellules liés par le 58 ou les 184 à 187, sans consolidation au SYCEBNL (CLAUDE.md § 6) |
| Clôture | journée ouverte, ouverture de journée, exercice (M p. 13, 20, 21) ; fin de journée annoncée (M p. 3) | clôture de période, de journal et d'exercice, dans l'ordre, avec les contrôles de clôture (CLAUDE.md § 6) |
| États réglementaires | « rapports standard », états personnalisés (M p. 3) ; aucun état BCC nommé | liasses SYCEBNL et SYSCOHADA, documents obligatoires, déclarations fiscales ; AUCUN état BCC ni PCCI |

Le point le plus utile de ce tableau · le PCCI demande, au § 3.4, ce
qu'OmegaX fait déjà pour l'AUDCIF art. 22 : validation qui rend
l'enregistrement définitif « au terme de chaque période qui ne peut excéder
le mois », « clôture informatique » mensuelle, opération d'une période close
enregistrée au premier jour non clôturé avec sa date de valeur, correction «
exclusivement par inscription en négatif » (PCCI § 3.3 et 3.4). Le moteur
comptable d'OmegaX répond déjà à ces exigences ; c'est le PLAN, les ÉTATS et
les OPÉRATIONS qui manquent.

---

## 6. Analyse stratégique (f)

### 6.1 Ce que disent les textes lus

1. **Le référentiel des IMF et des COOPEC en RDC est le PCCI, pas le
   SYSCOHADA ni le SYCEBNL.** Instruction BCC n° 006 du 14 avril 2012, art. 2
   : les COOPEC et les IMF « sont tenues d'organiser leur comptabilité
   conformément aux dispositions du PCCI » ; loi n° 11/020, art. 38 : comptes
   tenus « selon les règles fixées par un plan comptable spécifique ».
   L'AUDCIF art. 5, al. 3, le confirme côté OHADA : « les établissements de
   microfinance […] ne sont pas assujettis au SYSCOHADA » (le code d'OmegaX
   le rappelle déjà, `client/src/lib/formes-juridiques-syscohada.ts`).
2. **Le PCCI a sa propre numérotation**, incompatible avec les deux plans
   d'OmegaX : classe 3 « Comptes d'opérations avec la clientèle », classe 5
   trésorerie, classe 8 soldes de gestion, classe 0 hors bilan (PCCI § 9).
   Un numéro, deux sens, à l'échelle d'une classe entière.
3. **La BCC verrouille le plan** · ouvrir un sous-compte que le PCCI ne
   prévoit pas exige son « autorisation préalable » (Instruction n° 006, art.
   3). Le PCCI permet pourtant d'ouvrir « tout autre compte divisionnaire »
   (§ 9) · les deux textes ne se recouvrent pas exactement, à faire trancher
   si le projet avance.
4. **Une ASBL ne peut pas faire de microfinance** · « Les associations sans
   but lucratif ne sont pas autorisées à réaliser les opérations de
   Microfinance » (loi n° 11/020, art. 4), soit la collecte de l'épargne et
   l'octroi de micro-crédit (art. 6). Les clients SYCEBNL d'OmegaX ne sont
   donc pas une porte vers ce marché, et une ONG cliente qui distribuerait
   du micro-crédit poserait une question de droit, pas de logiciel.
5. **Le PCCI exige des attributs** que ni Microfina++ (dans les pages lues)
   ni OmegaX ne portent tous · résidence, agent économique, appartenance au
   réseau, statut des créances en retard, durées initiale et résiduelle,
   type de garantie, monnaie (PCCI § 10).
6. **Statut à vérifier.** Le PCCI date de juillet 2009 et se fonde sur la loi
   n° 76-020 et la loi n° 003/2002, abrogée par la loi n° 22-069 ; la loi n°
   22-069 range désormais COOPEC et sociétés de microfinance parmi les
   établissements de crédit (Titre I). Le corpus lu ne dit pas si un plan
   nouveau a remplacé le PCCI. À vérifier auprès de la BCC avant toute ligne
   de code.

### 6.2 Trois options

**Option A · module microfinance complet (membres, épargne, crédit, guichet,
PCCI, états BCC).** C'est refaire Microfina++. Il faudrait un troisième
référentiel cloisonné aux deux endroits comme les deux premiers (CLAUDE.md §
6), le plan PCCI semé, ses états périodiques, un moteur de prêts et
d'échéanciers, le classement et le provisionnement des créances selon une
instruction non lue, la centrale des risques (Instruction n° 5), le TEG
(Instruction n° 38), la LBC/FT (loi n° 11/020, art. 37 ; Instruction n° 15),
les plaintes (Instruction n° 39), un plan de continuité avec secours
informatique (Instruction n° 36). Coût · estimation de l'auteur, non mesurée
: au moins l'ordre de grandeur de tout ce qu'OmegaX a construit pour un
référentiel, plus un métier opérationnel qu'il n'a jamais tenu. Risques ·
une erreur ne fausse plus seulement des états, elle touche des DÉPÔTS DU
PUBLIC, remboursés par préférence à tout autre créancier en liquidation (loi
n° 11/020, art. 42) ; les données d'identification et les photos des membres
sont des données personnelles soumises à l'hébergement en RDC (Code du
numérique, art. 201, lu dans `docs/hebergement-en-rdc.md`) ; l'éditeur en
place a une avance fonctionnelle.

**Option B · référentiel PCCI pour la tenue et la révision des comptes,
alimenté par import.** OmegaX ne gère aucune opération de guichet ; il
reçoit les écritures (ou la balance) du logiciel d'opérations de l'IMF,
Microfina++ ou un autre, par l'import existant
(`src/modules/import/`), et sert ce qu'il sait faire · livre-journal
validé et clos, balance, contrôles, dossier de révision, états PCCI
annuels, mensuels et trimestriels. Coût · un troisième plan et ses états
(au lieu d'un métier entier), plus l'apprentissage des formats BCC. Risque
· limité à la justesse des états, déjà la discipline du dépôt (CLAUDE.md §
1) ; dépend d'un export propre du logiciel source, que le manuel lu ne
décrit pas (aucune fonction d'export comptable n'y figure, seulement l'export
Excel des grilles, M p. 9). Il ne couvre pas le PAR ni le provisionnement si
le logiciel source ne les produit pas.

**Option C · rester hors du marché.** OmegaX garde son champ (ASBL, ONG,
entreprises SYSCOHADA), que les textes lus ferment de toute façon à la
microfinance (§ 6.1, points 1 et 4). Coût nul. Le cabinet peut toujours
RÉVISER une IMF avec ses propres outils ; il ne le fera pas dans OmegaX, dont
les contrôles sont écrits pour le SYCEBNL et le SYSCOHADA.

### 6.3 Le gel

CLAUDE.md § 5 · « Aucune nouvelle fonction ni ligne de cas limite n'entre
sur `main` avant la version 1 », gel tenu « jusqu'à la fin du pilote » ; «
Une demande nouvelle se note au suivi, elle ne se code pas. » Chacune des
options A et B est une fonction nouvelle et ne peut entrer que par une
demande expresse de Manasse. Ce document ne vaut pas cette demande.

---

## 7. Recommandation (g)

1. **Maintenant · option C, et ne rien coder.** Noter au suivi « référentiel
   PCCI (IMF, COOPEC) », avec ce document en renvoi. Aucun texte lu ne
   rattache les IMF ni les COOPEC au SYSCOHADA ou au SYCEBNL, et le gel
   l'interdit de toute façon.
2. **Ne pas viser l'option A.** Refaire un système d'opérations de
   microfinance sort du métier d'OmegaX (comptabilité légale et révision),
   expose le cabinet à la garde de dépôts du public et entre en concurrence
   frontale avec un produit installé. Rien dans les pages lues de Microfina++
   ne montre une faiblesse qu'OmegaX comblerait sur les opérations.
3. **Si Manasse veut ce marché après le pilote · instruire l'option B, en
   trois temps, chacun sur sa décision.**
   - (a) Lire ce qui manque : l'Instruction n° 1 aux IMF, l'instruction de
     classement des créances, les Instructions n° 17, 21 et 22, les
     formats des états périodiques BCC, et confirmer auprès de la BCC que le
     PCCI de 2009 est toujours le plan applicable (§ 6.1, point 6).
   - (b) Obtenir de MEDIASOFT, ou d'un client qui utilise Microfina++, un
     export d'écritures réel, pour juger si l'import d'OmegaX le lit tel quel
     (le manuel lu n'en décrit aucun).
   - (c) Seulement alors, chiffrer le troisième référentiel (plan, états,
     cloisonnement), à la manière des lots verrouillés d'OmegaX.
4. **À noter au suivi, hors microfinance, sans coder** (idées d'ergonomie
   que Microfina++ montre et qu'un client d'OmegaX pourrait demander) ·
   déconnexion d'un utilisateur par l'administrateur (M p. 18) ; session de
   caisse ouverte et fermée par un agent avec billetage (M p. 18, 19) ; visa
   d'une fiche de tiers par un second utilisateur (M p. 51) ; interface en
   anglais (M p. 14). Chacune reste soumise au gel.

Ce que ce document ne peut pas dire · tout ce que décrivent les pages
manquantes ou les captures non vues de Microfina++ (Crédit, Caisse,
Comptabilité, fin de journée), et toute règle de provisionnement ou de
reporting BCC au-delà des textes listés au § 0.
