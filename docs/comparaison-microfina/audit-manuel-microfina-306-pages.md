# Audit du manuel Microfina++, 306 pages, face à OmegaX (2026-10-25)

Document d'audit, sans décision. Il REMPLACE, pour la lecture du manuel,
`audit-complet-manuel-microfina.md` (folios 1 à 79 seulement, le reste
d'après la note de la CAMEC) et corrige `paie-microfina-omegax.md` ; ces
deux documents restent en place, sous un bandeau qui renvoie ici. Rien n'est
codé ; toute idée de ce document est une fonction NOUVELLE, sous le gel des
nouveautés (CLAUDE.md § 5).

**Source lue · le PDF lui-même** (`Manuel_MICROFINA__Document_final.pdf`,
306 pages, Word 2013, MEDIASOFT), transmis par Manasse le 2026-10-25. Les 306
pages ont été lues en texte, page par page, ET regardées en image · chaque
capture d'écran a été relevée champ par champ. Révision d'OmegaX comparée ·
`90a226b` de `main`. Chaque « oui » ou « partiel » porte un chemin de
fichier vérifié dans le code.

## Pagination · à lire avant tout renvoi

| Pages du PDF | Folio imprimé | Partie |
|---|---|---|
| 2 à 279 | page du PDF moins un, sans exception | Partie A (folios 13 à 166), Partie B (folios 166 à 268), Paie |
| 280 et 304 | aucun | ouverture du chapitre Immobilisation ; tickets de valeur |
| 281 à 303 | 1 à 23, la numérotation repart | Immobilisation et Stock, collés d'un autre document |
| 305 et 306 | 1 et 2, elle repart encore | |

Dans les parties A et B, « M p. N » renvoie au FOLIO IMPRIMÉ. Dans la
partie C, il renvoie à la PAGE DU PDF, deux pages portant le même folio.
La note de la CAMEC numérote par la page du PDF · « CAMEC p. N » égale le
folio N moins un (vérifié sur ses vingt renvois de la partie A ; l'audit
précédent disait l'inverse).

## Synthèse

| Partie | Pages du PDF | oui | partiel | non | hors champ | Total |
|---|---|---|---|---|---|---|
| A · module Microfina++ (administration, paramétrage, client, banque, épargne, caisse, crédit, comptabilité, budget, autres) | 14 à 167 | 54 | 59 | 9 | 42 | 164 |
| B · gestion des ressources humaines | 167 à 269 | 11 | 23 | 50 | 2 | 86 |
| C · paie, immobilisation, stock | 270 à 306 | 20 | 33 | 22 | 0 | 75 |
| **Total** | | **85** | **115** | **81** | **44** | **325** |

S'y ajoutent une quarantaine de fonctions d'épargne et de crédit, relevées
en paragraphe dans la partie A, toutes hors champ (COOPEC et IMF, fondement
au début de la partie A).

**Ce que la lecture complète change.**

1. **La comptabilité de Microfina++ est d'abord celle d'une institution de
   dépôt** · sur les fonctions générales (saisie, journaux, lettrage, balance,
   états), OmegaX tient tout ou presque, et plus finement (deux référentiels,
   notes annexes, clôture, refus nommés). L'écart utile est ailleurs · le
   CIRCUIT D'APPROBATION (visa puis validation, objet par objet, partie A,
   idée 1) et les DOCUMENTS D'AMONT (bon de commande, chéquier, arrêté de
   caisse, partie A, idées 2 à 4).
2. **La paie du manuel ne calcule rien qu'il décrive** · paramétrage, fiche de
   l'employé et retenues, sans calcul, sans écriture, sans INPP ni ONEM
   (partie C, § 2.1). La conclusion de `paie-microfina-omegax.md` (OmegaX en
   avance sur le calcul et la passation) tient, pour une autre raison.
3. **La gestion du personnel est le vrai domaine où OmegaX est absent** · 50
   fonctions sur 86 n'y ont aucun équivalent (missions, formation, demandes
   de congé, recrutement, évaluation). Peu sont imposées par un texte lu ; la
   partie B, § 3, dit lesquelles.
4. **Le manuel porte des règles contraires aux textes congolais** · un
   paramétrage d'un autre pays (titre de congé à « l'article 158 », partie B),
   des coefficients de dégressivité de 0,5 à 5 et une TVA à 10 et 18 %
   (partie C), un avantage en nature dit « non imposable » (partie C), des
   stocks négatifs sans méthode de valorisation (partie C). À ne jamais
   reprendre.
5. **La confidentialité du personnel est plus large chez Microfina++** · groupe
   sanguin recueilli et servant de critère de recherche, numéro CNSS sur une
   liste de participants, motifs d'absence et notations sans droit indiqué
   (partie B, § 1.2). OmegaX ne recueille rien de cela.
6. **Des sections du manuel ne décrivent pas Microfina++** · textes
   publicitaires d'autres éditeurs recopiés (gestion des absences, gestion des
   postes, partie B), menus réduits à leur titre (sanction, retraite,
   statistiques, stage), folios 97 à 110 doublant 85 à 96 (partie A).

## Les idées les plus utiles, toutes parties confondues

Toutes sont des fonctions nouvelles, sous le gel ; aucune n'est décidée. Le
détail, la page et l'état dans OmegaX sont dans la partie citée.

| Rang | Idée | Partie | Texte qui l'imposerait (lu) |
|---|---|---|---|
| 1 | Visa puis validation, objet par objet (écriture, OD, facture, règlement, commande), fiche « Saisie par / Approuvée par » | A, idée 1 | aucun · organisation (AUDCIF art. 69 ; SYCEBNL art. 16, 2)) |
| 2 | Bon de commande fournisseur qui crée l'engagement budgétaire, exécuté par la facture | A, idée 2 | aucun · il servirait l'engagement déjà tenu (SYCEBNL, Guide, Application 22) |
| 3 | Missions et frais de mission, avec leur pièce comptable | B, idée 1 | aucun pour l'ordre de mission ; loi n° 23/053 art. 68, 1° et O.-L. n° 10/001 art. 41, 1° pour le traitement |
| 4 | Détenteur d'un bien · affectation à un salarié, transfert, reçu signé | C, idée 1 | aucun |
| 5 | Arrêté de caisse par coupures et plafond d'encaisse | A, idée 3 | aucun pour le plafond |
| 6 | Retenue étalée sur une durée, reprise d'office au bulletin | C, idée 2 | Code du travail art. 112 (liste fermée des retenues) |
| 7 | Demande de congé validée par un second utilisateur, titre de congé | B, idée 3 | Code du travail art. 140, al. 4 (date fixée de commun accord) |
| 8 | Plan et suivi de la formation | B, idée 2 | Code du travail art. 8 ; ordonnance n° 84/186 art. 1er, al. 2 (réduction INPP) |
| 9 | Registre des chèques émis | A, idée 4 | aucun |
| 10 | Échéancier des fins de CDD et de période d'essai | B, idée 5 | Code du travail art. 42 et 43, al. 4 |
| 11 | Déclaration annuelle de la main-d'œuvre, chiffres seuls | B, idée 4 | Code du travail art. 218 (formulaire de l'art. 219, arrêté absent du corpus) |
| 12 | Écran unique de concordance des modules avec la comptabilité | A, idée 5 | aucun |

Les articles cités ici l'ont été par les lecteurs de chaque partie, qui
nomment le fichier lu ; ils sont à relire avant toute ligne de code.

---

## Partie A · le module « Microfina++ », folios 13 à 166, face à OmegaX (2026-10-25)

Prolonge `docs/comparaison-microfina/audit-complet-manuel-microfina.md`
(branche `travail/paie-microfina`), dont elle reprend les conventions sans les
réécrire · « M p. N » renvoie au folio IMPRIMÉ ; légende **oui**, **partiel**,
**non**, **hors champ** ; le fondement du « hors champ » (AUDCIF art. 5, al. 3 ;
Instruction BCC n° 006, art. 2 ; loi n° 11/020, art. 4 et 6) est celui de
l'audit précédent. Chaque chemin d'OmegaX a été vérifié sur le disque, révision
`90a226b` de `main`. Rien n'est codé ; toute idée du § 4 est une fonction
NOUVELLE, sous le gel des nouveautés (CLAUDE.md § 5).

Sources lues · le PDF (306 pages, 22 Mo) page par page en IMAGE pour les pages
PDF 14 à 167, et son texte extrait (`manuel-pages.txt`) pour les mêmes pages.

**Pagination.** Le folio imprimé égale la page PDF MOINS UN, sans exception
des pages PDF 2 à 279 (relevé automatique du pied de page, puis vu sur chaque
image) ; à la page PDF 280 la numérotation repart à 1 (autre partie du
document, hors de cette section). Les folios 13 à 166 sont donc les pages PDF
14 à 167. **La note de la CAMEC numérote par la page PDF** · « CAMEC p. N » =
folio N − 1, vérifié sur ses vingt renvois de cette partie (chèque pour
crédit CAMEC p. 71 = folio 70 ; clôture d'un compte d'épargne CAMEC p. 81 =
folio 80 ; virement des salaires CAMEC p. 137 = folio 136 ; annulation de
règlement CAMEC p. 159 = folio 158 ; caisse mobile CAMEC p. 164 = folio 163 et
164). L'audit précédent écrivait que la note « précède d'une à deux pages le
folio imprimé » · c'est l'inverse, elle le suit d'une page, toujours.

---

### 1. Couverture, folio par folio

Toutes les pages ont été regardées en image (154 pages) ; toutes portent au
moins une capture d'écran ou un menu capturé, et le texte extrait a été relu
pour chacune. Aucune page ne reste non lue. Deux pages n'ont AUCUN texte et
ne sont connues que par leur capture (folios 159 et 165) ; les folios 97 à 110
redisent mot pour mot, captures comprises, les folios 85 à 96.

| Folio | Contenu | Capture regardée |
|---|---|---|
| 13 | généralités · menu général, barre des menus, menus d'accès rapide à gauche | oui · la barre montre aussi « Part sociale » ; l'accès rapide liste « Processus de sélection, Appuis institutionnels, Fonds de facilitations, Fonds de garanties, Accords de financements, Passation de marchés, Planification et suivi », jamais décrits |
| 14 | bas de page, internationalisation (menus Langue et Template), aide, déconnexion ; ouverture d'Administration | oui |
| 15 | menu Administration ; Profil, création | oui |
| 16 | octroi et modification des droits d'un profil ; sous-menus Utilisateur | oui |
| 17 | création d'un utilisateur ; gestion des profils utilisateur | oui |
| 18 | utilisateurs (connecté, machine) ; déconnexion ; guichets (texte) | oui |
| 19 | gestion des guichets ; ouverture et fermeture | oui |
| 20 | affectation d'un guichet ; exercice (texte) | oui |
| 21 | nouvel exercice ; ouverture ; compléter journal détail ; ouverture de journée (texte) | oui |
| 22 | ouverture de journée (liste) ; rapport des transactions | oui |
| 23 | Paramétrage · menu ; secteurs d'activité et listes de référence des clients | oui |
| 24 | paramétrages liés aux clients ; frais | oui |
| 25 | paramétrage des frais et des frais d'adhésion ; modification | oui |
| 26 | modification des frais d'adhésion ; numéro de compte client ; motifs de départ | oui |
| 27 | budget · types de centre de coût ; centres de coût | oui |
| 28 | types de budget ; types de période | oui |
| 29 | périodes ; plan budgétaire ; ligne de plan (texte) | oui |
| 30 | ligne de plan budgétaire ; liaison du budget aux opérations ; localisation, pays | oui |
| 31 | département ; commune | oui |
| 32 | arrondissement ; quartier ; produit crédit, type objet (texte) | oui |
| 33 | type objet ; objet crédit ; type produit crédit | oui |
| 34 | cycle ; zone ; degré (texte) | oui |
| 35 | degré (table) ; terme ; périodicité | oui |
| 36 | type d'assurance ; assureur ; gestionnaire de portefeuille | oui |
| 37 | ordre de remboursement ; produit crédit, création (Fig. 1) | oui |
| 38 | liste des produits crédit (Fig. 2), sans texte | oui |
| 39 | produit crédit, détail ; activation et désactivation | oui |
| 40 | modèle de produit crédit ; produits d'épargne | oui |
| 41 | paramétrage des produits d'épargne ; numéro de pièce ; journal (texte) | oui |
| 42 | journal ; ED DIVERS ; information société | oui |
| 43 | agence · gestionnaire, sensibilisateur | oui |
| 44 | commercial ; journées de travail ; jours fériés | oui |
| 45 | devises ; types de monnaie | oui |
| 46 | monnaies ; élément de facture ; référence de commande (texte) | oui |
| 47 | référence de commande (capture) ; Client · menu, enrôlement | oui |
| 48 | enrôlement d'une personne physique | oui |
| 49 | enregistrement d'une entreprise | oui |
| 50 | enregistrement d'un groupe | oui |
| 51 | visa d'un client | oui |
| 52 | demande d'adhésion imprimée (COOPEC) ; modifier les frais (capture) | oui |
| 53 | modifier les frais (texte) ; valider un client modifié ; consulter un client ; groupe solidaire | oui |
| 54 | groupe solidaire, affectation ; titre « nouveau prospect » | oui |
| 55 | prospect ; mise à jour d'un client (capture) | oui |
| 56 | mise à jour (texte) ; procurations ; résiliation | oui |
| 57 | photo et signature ; consentement Bic ; titre rapport | oui |
| 58 | rapport multicritère ; rapport des prospects ; titre clients modifiés | oui |
| 59 | rapport des clients modifiés (capture) ; Banque · menu | oui |
| 60 | encaissement et décaissement ; banque vers caisse | oui |
| 61 | banque vers banque ; virement prélèvement | oui |
| 62 | déblocage de crédit | oui |
| 63 | remboursement de crédit | oui |
| 64 | adhésion | oui |
| 65 | visa · menu et quatre grilles | oui |
| 66 | validation · menu et trois grilles | oui |
| 67 | validation virement / prélèvement ; banque client ; banque de l'institution | oui |
| 68 | chèques des clients · dépôt | oui |
| 69 | encaisser ; historique ; chèques de l'institution, générer un chéquier | oui |
| 70 | « l'onglet ne marche pas » (chèque pour crédit) ; emprunts, menu et mise en place | oui |
| 71 | remboursement d'emprunt ; rapports de banque | oui |
| 72 | Épargne · menu ; nouveau compte | oui |
| 73 | création d'un compte d'épargne ; relevé | oui |
| 74 | relevé imprimé ; situation du client | oui |
| 75 | dépôt à terme, menu | oui |
| 76 | mise en place ; validation d'un DAT | oui |
| 77 | rupture ; recherche multicritère DAT | oui |
| 78 | plan d'épargne ; simulation | oui |
| 79 | nouveau plan ; tableau d'amortissement | oui |
| 80 | édition des cotisations ; rupture (titre seul) ; clôturer un compte (« l'onglet ne marche pas ») | oui |
| 81 | blocage d'un compte et d'un montant | oui |
| 82 | rapports · virements compte à compte, garanties | oui |
| 83 | recherche multicritère ; indicateur crédit épargne | oui |
| 84 | comptes inactifs, dormants ; Caisse · menu | oui |
| 85 | adhésion à la caisse ; recherche d'un client | oui |
| 86 | dépôt et retrait ; titre déblocage | oui |
| 87 | déblocage ; remboursement de crédit | oui |
| 88 | brouillard des remboursements ; part sociale | oui |
| 89 | validation de l'adhésion par banque ; ED divers, encaissement | oui |
| 90 | ED divers, décaissement ; titre billetage | oui |
| 91 | arrêté de caisse par coupures | oui |
| 92 | validation de l'arrêté ; caisse vers caisse | oui |
| 93 | caisse vers banque ; validation d'une OD initiée à la comptabilité | oui |
| 94 | confirmation ; opérations déplacées ; titre rapport | oui |
| 95 | journal des opérations de caisse ; gestion des guichets | oui |
| 96 | ouverture et fermeture ; affectation | oui |
| 97 | reprise du menu Caisse ; ED divers (doublon) | oui |
| 98 | ED divers, capture d'écran du navigateur ; adhésion (doublon) | oui |
| 99 | recherche d'un client (doublon) | oui |
| 100 | dépôt et retrait (doublon) | oui |
| 101 | déblocage (doublon) | oui |
| 102 | remboursement ; brouillard (doublon) | oui |
| 103 | part sociale (doublon) | oui |
| 104 | adhésion par banque (doublon) | oui |
| 105 | arrêté de caisse (doublon) | oui |
| 106 | validation de l'arrêté ; caisse vers caisse (doublon) | oui |
| 107 | caisse vers banque ; validation d'une OD (doublon) | oui |
| 108 | confirmation ; opérations déplacées (doublon) | oui |
| 109 | journal de caisse ; gestion des guichets (doublon) | oui |
| 110 | ouverture et fermeture ; affectation (doublon) | oui |
| 111 | Crédit · plan d'amortissement ; titre analyse financière | oui |
| 112 | analyse allégée et développée ; titre dossier de crédit | oui |
| 113 | dossier · analyse, contrôle, approbation | oui |
| 114 | approbation ; mise en place ; visa du responsable et du comité | oui |
| 115 | visa du service financier ; historique ; crédits validés non débloqués ; état de crédit | oui |
| 116 | situation des crédits ; ajout de caution | oui |
| 117 | libération de caution ; dépôt de garantie | oui |
| 118 | libération de nantissement ; rapport ; consulter un prêt | oui |
| 119 | consultation ; affectation de dossier ; liste rouge | oui |
| 120 | liste rouge ; génération de la balance âgée | oui |
| 121 | déclassement et provisionnement ; engagement par signature ; rapports | oui |
| 122 | Comptabilité · plan des comptes, création et consultation | oui |
| 123 | plan des tiers ; modèle de plan ; taxes (texte) | oui |
| 124 | taxes ; déblocage de crédit ; remboursement par prélèvement (texte) | oui |
| 125 | remboursement par prélèvement (capture) ; bon de commande | oui |
| 126 | recherche d'un produit ; enregistrement de facture (texte) | oui |
| 127 | enregistrement de facture ; règlement ; titre journal | oui |
| 128 | journal des achats ; rapport des factures ; déclaration des taxes ; titre saisie | oui |
| 129 | saisie d'écritures ; rapprochement bancaire | oui |
| 130 | comptabilisation ; historique du rapprochement ; titre visa | oui |
| 131 | visa · six grilles | oui |
| 132 | visa compte à compte ; validation · six grilles | oui |
| 133 | validation compte à compte ; journaux comptables ; autres opérations | oui |
| 134 | virement / prélèvement ; compte à compte ; titre opération diverse | oui |
| 135 | opération diverse ; opérations déplacées ; domiciliation des salaires | oui |
| 136 | virement de salaire ; salaire du personnel et prélèvement automatique (« l'onglet ne marche pas ») ; contrôle des comptes | oui |
| 137 | contrôle de trésorerie ; rapport des annulations ; titre état des revenus | oui |
| 138 | état des revenus ; lettrage ; grand livre général (texte) | oui |
| 139 | grand livre général et analytique ; titre balance | oui |
| 140 | balance générale et analytique ; bilan | oui |
| 141 | hors bilan ; résultat ; état annexe (texte) | oui |
| 142 | état annexe ; indicateurs ; Budget · nouveau budget | oui |
| 143 | consultation ; suivi budgétaire ; consommation ; financement | oui |
| 144 | lignes et types de financement ; titre bailleur | oui |
| 145 | bailleurs ; récapitulatif de la comptabilité ; modèle de plan | oui |
| 146 | création des comptes d'utilisation (« plan général Syscohada ») | oui |
| 147 | consultation du plan SYSCOHADA ; bon de commande | oui |
| 148 | recherche d'un produit | oui |
| 149 | enregistrement de facture ; tranches de paiement | oui |
| 150 | état de validation du bon de commande ; facture d'un acompte | oui |
| 151 | menu Visa | oui |
| 152 | menu Validation ; validation d'une facture | oui |
| 153 | règlement de facture ; validation du règlement, informations du chèque | oui |
| 154 | fiche d'imputation ; recherche des factures ; rapprochement (texte) | oui |
| 155 | rapprochement (fin) ; comptabilisation ; taxes | oui |
| 156 | taxes ; concordance des comptes ; plan des tiers | oui |
| 157 | déblocage ; remboursement par prélèvement | oui |
| 158 | annulation de règlement d'un crédit ; bon de commande (texte) | oui |
| 159 | bon de commande · **capture seule, aucun texte** | oui |
| 160 | menu Comptabilité complet, états financiers ; lettrage | oui |
| 161 | transfert entre comptes ; virement / prélèvement | oui |
| 162 | opérations diverses ; contrôle de la trésorerie | oui |
| 163 | contrôle des comptes ; Autres · menu, clôture, état des provisions | oui |
| 164 | calculs ; caisse mobile ; le texte s'arrête sur « Le sous menu Gestion de réunion affiche » | oui |
| 165 | gestion de réunion · **capture seule, aucun texte** | oui |
| 166 | « Chapitre 5 · Module GRH », page principale · hors des modules de cette section (relevée pour la couverture seulement) | oui |

---

### 2. Module par module

« (capture) » signale une fonction connue SEULEMENT par sa capture ; sans
mention, le texte et la capture la décrivent.

Décompte · 164 lignes de tableau (54 oui, 59 partiel, 9 non, 42 hors champ,
dont 23 connues par leur seule capture), plus une quarantaine de fonctions
d'Épargne et de Crédit relevées en paragraphe, toutes hors champ.

#### 2.0 Généralités du module (M p. 13 et 14)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Barre des menus du module (Client, Part sociale, Banque, Épargne, Caisse, Crédit, Comptabilité, Budget, Autres, Paramétrage, Administration) | 13 | oui | barre de menus de Sage, `client/src/components/chrome/` | « Part sociale » figure sur la barre (capture) et dans l'arbre des droits (M p. 16), sans section à elle · ses gestes sont à la Caisse (M p. 88) |
| Menus d'accès rapide à gauche · processus de sélection, appuis institutionnels, fonds de facilitations, fonds de garanties, accords de financements, passation de marchés, planification et suivi (capture) | 13, 16 | non | · | jamais décrits dans les 154 pages · « passation de marchés » et « accords de financements » serviraient un projet de développement, mais rien n'en est connu au-delà du nom |
| Bas de page · serveur (adresse IP), base, journée ouverte, utilisateur (capture) | 14 | partiel | barre d'état, exercice choisi (`client/src/lib/exercice-choix.ts`) | déjà dans l'audit précédent |
| Menu « Langue » (français, anglais) et menu « Template » (capture) | 14 | non | interface en français seul | « Template » n'est pas décrit |
| Aide en ligne ; déconnexion | 14 | oui | bulle `Aide` ; `src/modules/auth/sessions-fermees.ts` | |

#### 2.1 Administration (M p. 14 à 22)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Profil · création (nom du droit, description ; exemple « AUDITEUR ») | 15 | oui | profils de fonctions, `src/common/fonctions/fonctions-metier.ts` | |
| Profil · octroi des droits par arbre de tâches, filtré par module (Microfina standard, GRH, Immobilisation, Paie, Administration, Stock), droits restants contre droits octroyés | 16 | oui | `fonctions-metier.ts` ; cinq rôles, `src/common/guards/roles-cantonnes.ts` | le profil d'OmegaX restreint un rôle sans l'élargir ; Microfina++ part des droits cochés |
| Modifier les droits d'un profil | 16 | oui | idem | |
| Créer un utilisateur · nom, agence, case « contrôle utilisateur connecté », identifiant, mot de passe et confirmation, adresse, portable, courriel | 17 | oui | `src/modules/utilisateurs/`, `src/modules/auth/` | la case « contrôle utilisateur connecté » n'est pas définie |
| Gestion des profils de l'utilisateur · profil choisi, modules liés, bouton « historique profil » | 17 | partiel | journal d'audit chaîné (`src/common/audit/`), filtrable par objet et par acteur (`src/common/audit/filtre-journal-audit.dto.ts`) | aucun écran d'historique du profil |
| Liste des utilisateurs · connecté ou non, MACHINE (adresse IP), actif | 18 | partiel | utilisateurs actifs (`src/modules/utilisateurs/`) | OmegaX ne montre ni qui est connecté ni depuis quel poste ; l'adresse IP n'est gardée qu'au journal d'audit (`adresseIp`, `prisma/schema.prisma`) |
| Déconnecter un utilisateur | 18 | oui | `POST /utilisateurs/:id/deconnecter` | |
| Gestion des guichets · type, journal, « maximum autorisé en caisse », « retrait plafonné », comptes guichet, liaison, surplus, manquant, billetage autorisé, actif | 18, 19 | hors champ | · | guichet d'une institution de dépôt ; le plafond d'encaisse seul est repris au § 4 |
| Ouverture et fermeture d'un guichet · dernière journée ouverte | 19 | hors champ | · | |
| Affecter un guichet à un utilisateur · cases « voir solde client » et « voir solde client VIP » | 20 | partiel | journaux autorisés par utilisateur (`src/common/perimetre/extension-perimetre-journaux.ts`) | les deux cases visent des comptes de déposants |
| Nouvel exercice · l'ANNÉE seule, cases actif, ouvert, validé | 20, 21 | oui | `src/modules/exercice/` | l'exercice de Microfina++ est une année civile ; OmegaX tient des bornes de dates (premier exercice long) |
| Ouvrir un exercice · liste des journaux de l'exercice avec leur compteur | 21 | partiel | numérotation par journal et par exercice (`src/modules/journaux/numerotation-piece.ts`) | |
| Compléter le journal détail de l'exercice en cours (capture d'une liste vide) | 21 | oui | les journaux valent pour tous les exercices (`src/modules/journaux/`) | la fonction n'est pas expliquée |
| Ouverture de journée · dernière journée, date à ouvrir, ouverte par, heure, fermée par | 21, 22 | partiel | clôture de période et de journal (`src/modules/exercice/gel-cloture.ts`) | |
| Rapport des transactions · par utilisateur, nombre d'opérations, d'annulations et de transactions, total, export | 22 | partiel | journal d'audit filtré par acteur et période (`filtre-journal-audit.dto.ts` · `acteurEmail`, `depuis`, `jusqua`) ; journal exporté (`src/modules/exports/journal-edition.ts`) | aucun décompte par utilisateur · voir § 3 |

#### 2.2 Paramétrage (M p. 23 à 47)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Listes de référence des clients · secteur, type d'activité, profession, catégorie, type de pièce, civilité, type de groupe, type client, sous-type, forme juridique, catégorie de groupe, filiation, situation matrimoniale, motif de départ, type de guichet (capture) | 23 | partiel | qualité du tiers (`src/modules/tiers/qualite-tiers.ts`) | la plupart identifient un déposant, hors champ |
| Secteurs d'activité (numéro, libellé) | 23 | partiel | `Tenant.codeActivitePrincipale` | pour le dossier, pas pour ses tiers |
| Numérotation des clients · institution, préfixe, suffixe, agence, catégorie, position, compteur, générer | 24, 26 | partiel | numéro proposé sous le collectif, modifiable (`GET /tiers/numero-propose`, `src/modules/tiers/collectifs-tiers.ts`) | aucun numéro composé de segments (exemple de capture « 25121200-INS000SA000001-E-05 ») · voir § 3 |
| Frais par opération et d'adhésion · nature (montant), valeur, compte, sous-types de client (femme, entreprise, SARL, SA, groupement, association, église, ONG…) | 24 à 26 | hors champ | · | |
| Motifs de départ d'un client (départ du pays, déménagement, « ne veut plus prendre de crédit », transfert d'agence…) | 26 | non | mise en sommeil d'un tiers, sans motif codifié | |
| Types de centre de coût hiérarchisés (institution, direction, agence, département, service) | 27 | oui | sections DÉTAIL et TOTAL (`src/modules/analytique/rubriques-budgetaires.ts`) | |
| Centres de coût (code, libellé, type, parent) | 27 | oui | `src/modules/analytique/analytique.service.ts` | |
| Types de budget avec « paramètre compte » par racine (ressources 1*, 2*, 5*, 7* ; fonctionnement 6* ; opérations 2* ; investissements 4*) (capture) | 28 | partiel | plan analytique qui ventile des classes (`classesVentilees`, lu par `verifierVentilationObligatoire`, `analytique.service.ts`) | le « budget des investissements » y lit le 4*, sans explication |
| Types de période (durée en mois et en jours · mensuel, trimestriel, semestriel, quinzaine, annuel, tous les quatre mois) | 28 | partiel | budget annuel et mensuel (`doterBudget`) | idée 5 de l'audit précédent, confirmée par la capture |
| Périodes budgétaires (code, type, début et fin en JJ/MM) | 29 | partiel | idem | |
| Plan budgétaire (année, code, libellé) | 29 | oui | budgets par section et par exercice (`analytique.service.ts`) | |
| Ligne de plan budgétaire · centre de coût et bailleur | 29, 30 | oui | `src/modules/bailleurs/` ; tableau emplois ressources (`src/modules/etats-financiers/correspondance-projet-emplois-ressources.ts`) | |
| Liaison du budget aux opérations (type d'opération vers type de budget) | 30 | partiel | OD analytiques (`src/modules/analytique/od-analytique.ts`) ; modèles de saisie | |
| Localisation · pays (nationalité, code, zone), département, commune, arrondissement, quartier, export | 30 à 32 | partiel | adresse, ville et pays du tiers (`model Tiers`) | exemples du Bénin dans les captures |
| Produit crédit, général · type objet, objet, type produit, cycle, zone, degré (encours classés par jours de retard, taux de 0 à 100, ordre de remboursement), terme, périodicité, type d'assurance, assureur, gestionnaire de portefeuille | 32 à 36 | hors champ | · | |
| Ordre de répartition des remboursements (intérêt, capital, pénalité, épargne, solidarité) | 37 | hors champ | pour des FACTURES, Code civil, Livre III, art. 151 à 154 (`src/modules/tva/imputation-paiements.ts`) | |
| Produit crédit · création (minimum et maximum, différé, taux, mode de calcul, types de client, périodicité, perception anticipée, âge maximum), liste, activation | 37 à 39 | hors champ | · | |
| Modèle de produit crédit (degrés, termes, comptes capital, interne, intérêt) | 40 | hors champ | · | |
| Produits d'épargne et leur paramétrage (épargne, courant, DAT, bloqué) | 40, 41 | hors champ | · | |
| Numéro de pièce · exercice, positions institution, agence, journal, compteur, aperçu | 41 | partiel | `numerotation-piece.ts`, trous de séquence (`src/modules/journaux/sequence-pieces.ts`) | OmegaX numérote par journal, par fichier ou par mois, sans préfixe composé · voir § 3 |
| Journal · type, libellé, code, actif, « détail journal », export | 42 | oui | `src/modules/journaux/` | |
| ED DIVERS · opérations paramétrées (sens produit ou charge, compte, libellé, statut) | 42 | partiel | modèles de saisie (`src/modules/modeles-saisie/`) | |
| Information société · code, dénomination, type de base, description, directeur, N° d'agrément, « journée maxi ouverte », comptes hors bilan 1 et 2, IFU, adresse, LOGO, « info sécurité » (capture) | 42 | partiel | `model Tenant` (adresse, téléphone, `numeroImpot`, `idNat`, `rccm`) ; mentions imprimées (`src/modules/tenant/mentions-immatriculation.ts`) | aucun logo au schéma d'OmegaX ; « info sécurité » coupée sur la capture |
| Agence et zone (onglets) | 42 | partiel | cellules du module Groupe (`src/modules/groupe/`) | |
| Gestionnaire, sensibilisateur, commercial (identité, agence, profession) | 43, 44 | hors champ | · | agents de crédit |
| Journées de travail par agence (dimanche à samedi) | 44 | partiel | jours tirés des textes (`src/modules/retenues/jour-ouvrable.ts`, `src/modules/personnel/jours-du-code-du-travail.ts`) | non paramétrables chez OmegaX, et c'est voulu |
| Jours fériés · institution, date, description, exercice, « jours fériés variables » | 44 | partiel | liste de l'ordonnance (`jour-ouvrable.ts`) | idem |
| Devises (devise, code, unité, subdivision) | 45 | oui | `src/modules/devises/` | |
| Types de monnaie (pièce de 1 à billet de 5 000) et monnaies (valeur fiduciaire, type, devise) | 45, 46 | partiel | valeur faciale libre au procès-verbal de comptage (`CoupureComptee`) | aucune table des coupures · idée 4 de l'audit précédent |
| Élément de facture · libellé, compte, taux, « taux A. », « taux N.A. », retenue, désactivation | 46 | partiel | taux de TVA (`src/modules/tva/taux-tva.service.ts`) ; registre des retenues (`src/modules/retenues/retenues.service.ts`) | les sigles A. et N.A. ne sont pas définis · voir § 3 |
| Référence de commande · positions institution, exercice, compteur par exercice (capture) | 46, 47 | partiel | série des factures unique par dossier et par sens (`model Facture`, `src/modules/facturation/facturation.service.ts`) | aucune commande fournisseur chez OmegaX |

#### 2.3 Client (M p. 47 à 59)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Enrôlement d'une personne physique · informations de base, renseignements généraux, autres renseignements ; type de compte à créer, premier dépôt, résident, prélever agios, calculer intérêt | 48 | partiel | plan des tiers (`enum TypeTiers`, `src/modules/tiers/`) | l'identité seule a un équivalent ; le reste ouvre un compte de déposant |
| Enregistrement d'une entreprise · dirigeant, signataires | 49 | partiel | tiers et documents attachés (`src/modules/tiers/documents-tiers.ts`) | |
| Enregistrement d'un groupe · nombres d'hommes et de femmes, membres du groupe | 50 | hors champ | · | |
| Personnes liées, bénéficiaires du compte, signataires | 48 à 50 | hors champ | · | |
| Photo et spécimen de signature, prise de vue par caméra (« Capturer ») | 48, 57 | partiel | documents attachés aux tiers (PDF, PNG, JPEG) | aucune prise de vue |
| Visa d'un client · frais liés (droit d'entrée, frais de livret), date du visa, impression du contrat (capture d'une « demande d'adhésion » de COOPEC) | 51, 52 | partiel | visa des RIB par un second utilisateur (`src/modules/tiers/visa-rib.ts`) | le visa d'OmegaX porte sur les coordonnées bancaires seules |
| Modifier les frais d'ouverture | 52, 53 | hors champ | · | |
| Valider un client modifié (« activer client », liste des comptes du membre) | 53 | partiel | `visa-rib.ts` | |
| Consulter un client · renseignements, photo, onglets dépôts, crédits, part sociale ; données initiales et actuelles | 53 | partiel | journal d'audit et pré-image (`src/common/audit/pre-image.ts`) | |
| Groupe solidaire, affectation des membres | 53, 54 | hors champ | · | |
| Nouveau prospect (sensibilisateur, commercial, identité, adresse) | 54, 55 | non | · | |
| Mise à jour d'un client | 55, 56 | oui | modification d'un tiers (`src/modules/tiers/`) | |
| Procurations · liste des TYPES de procuration (libellé) (capture) | 56 | hors champ | · | |
| Résilier un contrat · motif, frais de résiliation, soldes des comptes, impression | 56 | partiel | mise en sommeil ; suppression refusée tant que le tiers est utilisé (`src/common/suppression/references.ts`) | aucun motif |
| Consentement Bic (code, début, fin, commentaire) | 57 | hors champ | · | le sigle n'est pas défini |
| Rapport multicritère · période ou date fixe ; clients actifs, inactifs, départs ; détaillé ou synthèse ; agence, catégorie, nationalité, commercial, secteur, type, zone, gestionnaire, sensibilisateur, genre ; ordre | 58 | partiel | éditions des structures (`client/src/lib/editions-structures.ts`) | |
| Rapport des prospects | 58 | non | · | |
| Rapport des clients modifiés · date, utilisateur, N° de membre, agence, NOMBRE de modifications | 58, 59 | partiel | journal d'audit filtré par objet et par acteur | idée 8 de l'audit précédent |

#### 2.4 Banque (M p. 59 à 71)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Encaissement et décaissement · numéro de pièce, date, « type écriture multiligne », banque, compte, N° de chèque, SOLDE DE LA BANQUE affiché, compte, libellé, montant, TYPE DE BUDGET, LIGNE BUDGÉTAIRE, BAILLEUR | 60 | oui | saisie au journal de banque (`src/modules/comptabilite/ecriture.service.ts`), contrepartie à chaque ligne (`client/src/lib/contrepartie-tresorerie.ts`), ventilation analytique envoyée avec la saisie (`verifierVentilationObligatoire`, `analytique.service.ts`) | OmegaX n'affiche pas le solde du compte de trésorerie pendant la saisie (`client/src/pages/SaisiePage.tsx` ne montre que le solde de la pièce) |
| Banque vers caisse · N° de chèque, soldes de la banque et de la caisse affichés | 60 | oui | virement de fonds par le 585, deux pièces liées (`src/modules/virements-fonds/`) | |
| Banque vers banque | 61 | oui | idem | |
| Virement ou prélèvement sur le compte d'un client | 61 | hors champ | · | |
| Déblocage de crédit par la banque · frais, financement (type de budget, ligne), contrat de prêt | 62 | hors champ | · | |
| Remboursement de crédit par la banque · mandataire, répartition, détail, budget | 63 | hors champ | · | |
| Adhésion à la banque | 64 | hors champ | · | |
| Visa des opérations · encaissement et décaissement, banque vers caisse, banque vers banque, virement ou prélèvement · grilles à cocher (date, opération, montant, banque, compte, numéro comptable) (capture) | 65 | partiel | double regard à la validation (`Tenant.doubleRegardValidation`) | une étape chez OmegaX, sans seuil · voir § 3 |
| Validation des mêmes opérations, numéro de pièce et date (capture) | 66, 67 | partiel | idem | |
| Banque client · code, libellé, compte de liaison, adresse | 67 | oui | `src/modules/banques/banques.ts` | |
| Banque de l'institution · banque, compte, N° de compte bancaire, journal, contact, « imprimer tous les comptes » | 67 | oui | un RIB pour un journal (`banques.ts`) ; conditions bancaires (`src/modules/banques/conditions-bancaires.ts`) | le texte cite un « compte de pénalité » absent de la capture |
| Dépôt de chèque · tireur, banque du tireur, banque de dépôt, DÉPOSANT et sa pièce d'identité | 68 | partiel | remises, réception D 513 / C tiers (`src/modules/remises/remise-en-banque.ts`) | le déposant n'est pas demandé |
| Encaisser un chèque · date d'encaissement, « Encaisser », « Retourner », imprimer | 69 | oui | bordereau, avis de crédit, impayé au 413 (`src/modules/remises/`) | |
| Historique des chèques par banque | 69 | oui | listes des remises (`src/modules/remises/`) | |
| Générer un chéquier · banque, compte, NOMBRE DE FEUILLETS, numéros de début et de fin, barré, visé, certifié (capture) | 69 | non | · | aucun registre des chèques émis · voir § 3 et § 4 |
| Chèque pour crédit · « l'onglet ne marche pas » | 69, 70 | hors champ | · | |
| Mise en place d'un emprunt · banque, référence, montant, durée, date, TAUX ANNUEL, total des intérêts, des commissions et des frais, compte d'emprunt, N° de pièce (capture) | 70 | partiel | crédit de trésorerie au 561, deux ans au plus (`src/modules/tresorerie/operations-tresorerie.ts`) ; intérêts courus (`src/modules/regularisation/interets-courus.ts`) | l'emprunt au 16 ou au 18 « se passe hors de ce module » (`operations-tresorerie.ts`, l. 168 à 170) · voir § 3 |
| Remboursement d'un emprunt · N° de compte, banque, CAPITAL RESTANT, date, amortissement, intérêt, commission (capture) | 71 | partiel | idem | |
| Édition du journal des opérations de banque · exercice, période, banque, compte, agence, recherche « commençant par » | 71 | oui | `journal-edition.ts` ; recherche d'écritures (`src/modules/comptabilite/recherche-ecritures.ts`) | |

#### 2.5 Épargne (M p. 72 à 84)

Tout le module est **hors champ** (comptes de déposants, DAT reçus, plans
d'épargne). Fonctions relevées, toutes décrites par texte et capture sauf
mention · menu (M p. 72) ; nouveau compte par produit · dépôts de garantie,
dépôts à terme, à vue, épargne scolaire, placement bonifié, part sociale,
part spéciale, compte courant (M p. 72, 73) ; relevé de compte, solde
comptable et indicatif, relevé imprimé sous l'en-tête d'une association
cliente, situation du client avec signature (M p. 73, 74) ; DAT · mise en
place (certificat, montant, durée, taux d'intérêt et de pénalité, compte DAT,
intérêt et montant à verser, reconduction automatique, bénéficiaire),
validation, rupture (taux et montant « IRC »), recherche multicritère (M p. 75
à 77) ; plan d'épargne · simulation, création, tableau des échéances, édition
des cotisations (M p. 78 à 80), rupture (titre seul, M p. 80) ; clôturer un
compte · « l'onglet ne marche pas » (M p. 80) ; blocage d'un compte ou d'un
montant · solde, montant bloqué et débloqué, épargne libre, motif, « voir
historique des actions » (M p. 81) ; rapports · virements compte à compte,
garanties, recherche multicritère, indicateur crédit épargne par sexe,
comptes inactifs par nombre de jours, comptes dormants (M p. 82 à 84).

Deux rapprochements sans portée sur le classement · OmegaX tient les DAT que
l'entité PLACE (`tresorerie/operations-tresorerie.ts`) ; et il signale les
comptes GÉNÉRAUX dormants (`src/modules/controles/controles.controller.ts`,
écran de contrôle).

#### 2.6 Caisse (M p. 84 à 110 ; 97 à 110 en doublon de 85 à 96)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Menu Caisse · opération, billetage, transfert entre caisses, valider opérations, « RÈGLEMENT FACTURE ESPÈCE », rapport (capture) | 84, 97 | partiel | règlement des tiers par la caisse (`src/modules/reglements/reglements.service.ts`), caisse qui ne paie que ce qu'elle contient (`src/modules/comptabilite/caisse-provisionnee.ts`) | « Règlement facture espèce » n'est décrit nulle part |
| Adhésion à la caisse · info guichet (agence, caisse, caissier, solde) | 85, 97 à 99 | hors champ | · | |
| Dépôt et retrait sur compte livret · mandataire, motif, frais, billetage, montant EN LETTRES | 86, 100 | hors champ | · | |
| Déblocage de crédit par la caisse · échéancier, reconnaissance de dette | 86, 87, 101 | hors champ | · | |
| Remboursement de crédit · répartition (capital, TVA, fonds de solidarité, intérêt, épargne, pénalité), degré et jours de retard, brouillard des remboursements, situation, plan, réel, mémo, « MP » | 87, 88, 102, 103 | hors champ | · | |
| Achat et retrait de parts sociales | 88, 89, 103 | hors champ | · | |
| Validation à la caisse de l'adhésion par banque | 89, 104 | hors champ | · | |
| ED divers à la caisse · encaissement ou décaissement d'une opération paramétrée, compte proposé et modifiable (« récupération sur créances amorties » au 76900000, « avance de fonds » au 3791), solde de la caisse affiché | 89, 90, 97, 98 | partiel | modèles de saisie ; `caisse-provisionnee.ts` | comptes d'un plan d'IMF |
| Enregistrer le billetage · « Arrêtée de caisse » par JOURNÉE · solde de caisse, BON DE CAISSE, coupures (billet de 10 000 à pièce de 1) par nombre, total (capture) | 90, 91, 104, 105 | partiel | procès-verbal de comptage par caisse (`ProcesVerbalComptageCaisse`, `CoupureComptee`), solde du livre-journal à la date du comptage (`src/modules/inventaire/solde-caisse-au-comptage.ts`) | OmegaX compte pour l'inventaire, pas à chaque journée |
| Valider le billetage · « Validation arrêtée temporaire » · solde informatique, solde réel, compte comptable, guichet, journée, bon de caisse, total du billetage, imprimer | 91, 92, 105, 106 | partiel | idem | |
| Caisse vers caisse (alimentation de guichet, soldes des deux caisses, montant en lettres) | 92, 106 | oui | `src/modules/virements-fonds/` | |
| Caisse vers banque (N° de chèque, soldes) | 92, 93, 106, 107 | oui | idem | |
| Valider à la caisse une OD INITIÉE À LA COMPTABILITÉ · liste (date, pièce, libellé, débit, crédit, client), détail par compte, confirmation | 93, 94, 107, 108 | non | · | le comptable prépare, le caissier confirme le mouvement d'espèces ; le double regard d'OmegaX (`Tenant.doubleRegardValidation`) n'est pas cela · voir § 4 |
| Opérations déplacées (client d'une agence servi dans une autre) | 94, 108 | hors champ | · | |
| Journal des opérations de caisse · guichet, période, recherche, export | 95, 109 | oui | `journal-edition.ts` | |
| Créer une caisse ou gérer les guichets (comptes et « droits ») | 95, 109 | hors champ | · | |
| Ouverture et fermeture des guichets (douze caisses sur la capture) | 96, 110 | hors champ | · | |
| Ajout et retrait d'un guichet à un utilisateur | 96, 110 | partiel | journaux autorisés (`extension-perimetre-journaux.ts`) | |

#### 2.7 Crédit (M p. 111 à 121)

Tout le module est **hors champ** (crédit à la clientèle). Fonctions relevées ·
simulation d'un tableau d'amortissement (produit, périodicité, mode de calcul,
différé, taux, « T.E.G.R. » et « T.E.G.A. », M p. 111) ; analyse financière
allégée et développée (bilan, garanties, indicateurs, ratios,
recommandations), capture seule (M p. 111, 112) ; dossier de crédit · analyse
(effectifs et montants par sexe, région, préfecture, ligne de financement,
BAILLEUR, structure de référencement), contrôle, approbation, mise en place
(épargne obligatoire, fonds de solidarité, assureur, objet, zone, agent)
(M p. 112 à 114) ; visa du responsable crédit, du comité de crédit et du
service financier, grilles filtrées par agent (M p. 114, 115) ; historique du
suivi par niveau hiérarchique et avis (M p. 115) ; crédits validés non
débloqués (M p. 115) ; état et situation des crédits (M p. 115, 116) ; caution,
dépôt de garantie, nantissement, ajout et libération, rapport (M p. 116 à
118) ; consulter un prêt (M p. 118, 119) ; affectation d'un dossier d'un
gestionnaire à un autre (M p. 119) ; liste rouge avec motif (M p. 119, 120) ;
génération de la balance âgée (M p. 120) ; déclassement et provisionnement,
« provisionner tous les crédits », « radier par anticipation » (M p. 121) ;
engagement par signature (type, description, dates, montant, durée,
pourcentage, forfait, frais, garantie, comptes, banque, impression) (M p. 121) ;
menu des rapports · journal, rapports de base, multicritère, synthèse de la
balance âgée, taux de remboursement, encours prévisionnel, exigibles,
indicateur de gestion, capture seule (M p. 121).

Équivalents d'OmegaX DANS SON CHAMP, sans portée sur le classement · balance
âgée des tiers (`src/modules/comptabilite/ecriture.service.ts`) ; créances
douteuses reclassées une à une, dépréciation déclarée (`src/modules/creances-douteuses/`) ;
engagement de la banque proposé au hors bilan (`banques/conditions-bancaires.ts`).
Le visa à trois niveaux nourrit l'idée 1 du § 4.

#### 2.8 Comptabilité (M p. 122 à 142, 145 à 163)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Créer un compte · parent, numéro (deux cases), libellé, statut, NATURE (actif, passif, charge, produit, hors bilan) ; cases saisie analytique, clé de répartition analytique, saisie de l'échéance, lettrage automatique, saisie compte tiers, immobilisation, compte de taxe, compte taxable, type de suivi | 122, 146 | oui | sous-compte proposé (`src/modules/comptes/comptes-proposes.ts`), classe lue sur le numéro (`src/modules/comptes/classe-du-numero.ts`), `lettrable` et `tauxTvaDefaut` (`model Compte`) ; clés de répartition (`src/modules/analytique/gestion/cles-repartition.ts`) | la nature se CHOISIT chez Microfina++, elle se LIT sur le numéro chez OmegaX |
| Consultation du plan en arbre, recherche, export | 122, 147 | oui | `client/src/pages/PlanComptesPage.tsx` | |
| Deux plans dans le même dossier · « nouveau référentiel » (plan d'IMF) et « plan général Syscohada » (captures) | 122, 146, 147 | hors champ | un référentiel par dossier (`Tenant.referentiel`) | le premier est le plan d'une institution de microfinance |
| Concordance des comptes · affecter les comptes d'un plan à ceux du référentiel de base | 156 | hors champ | · | passage d'un plan d'IMF au SYSCOHADA |
| Plan des tiers · type, intitulé, qualité, date, compte, pays, banque | 123, 156 | oui | `src/modules/tiers/`, `qualite-tiers.ts`, RIB des tiers (`src/modules/tiers/ribs-tiers.ts`) | |
| Modèle de plan · classe, poste, compte général, compte, sous-compte, groupe de compte | 123, 145 | oui | plans semés (`src/modules/comptes/compte-seed.ts`, `compte-seed-syscohada.ts`) | |
| Taxes · code, désignation, taux (capture · droits de douane, impôt sur le chiffre d'affaires, IRPP, TVA, avec des taux d'un autre pays) | 123, 124, 155, 156 | oui | taux de TVA et routage du compte de taxe (`taux-tva.service.ts`, `src/modules/tva/routage-tva.ts`) | |
| Déblocage de crédit, remboursement par prélèvement sur compte d'épargne | 124, 125, 156 à 158 | hors champ | · | |
| BON DE COMMANDE FOURNISSEUR · type de commande, fournisseur, libellé, date ; lignes « produit » ou « besoin » tirés du stock, compte, désignation, unité, quantité, prix, TVA, retenue (« AIB » à 1 %), « joindre des documents », TYPE DE BUDGET et LIGNE BUDGÉTAIRE obligatoires, BAILLEUR ; totaux HT, TVA, TTC ; tranches | 125, 126, 147, 148, 158, 159 | partiel | engagements de dépense hors comptabilité, bons de commande remis non exécutés (`src/modules/analytique/engagement.service.ts`, `model EngagementDepense`) ; magasin (`src/modules/stocks/`) ; pièces jointes (`PieceJointeEcriture`) | OmegaX n'a aucun DOCUMENT de commande fournisseur lié à la facture ; ses devis et commandes sont de VENTE (`src/modules/commercial/`) · idée 2 du § 4 |
| État de validation du bon de commande · quantité, désignation, prix, TVA, HT, TTC, « arrêté à la somme de » EN LETTRES | 150 | non | · | |
| Enregistrer une facture fournisseur · facture directe ou issue d'une commande, référence, dates de facture et d'échéance, HT, TVA, TTC, « fournisseur à jour », IFU, retenues fiscales, montant à payer | 126, 127, 149, 150 | oui | factures d'achat et écriture tirée de la facture (`src/modules/facturation/`, `ecriture-facture.ts`) | la retenue sur la facture n'a qu'un équivalent partiel (`retenues/retenues.service.ts`) |
| Tranches de paiement d'une facture · montant, taux en %, date ; facture d'acompte sur une tranche | 149, 150 | partiel | échéancier du modèle de règlement (`src/modules/tiers/echeancier-modele.ts`) | |
| Régler une facture · mode (chèque, espèces, prélèvement, virement), charges, observations ; à la validation, N° de chèque, banque, compte, date d'émission | 127, 153 | oui | règlement des tiers et modes de règlement (`src/modules/reglements/`, `modes-reglement.ts`) | OmegaX ne garde pas le numéro du chèque émis |
| Fiche d'imputation imprimée · journal, date, pièce, libellé, référence, comptes, débit, crédit, échéance, « Saisie par », « Approuvée par » | 154 | partiel | piste de révision du journal exporté, auteur et validateur (`journal-edition.ts`) | aucune pièce imprimée écriture par écriture |
| Journal des achats · exercice, mois, mouvement, montant, UTILISATEUR, pièce (commençant, contenant, terminant par), libellé | 127, 128 | partiel | `recherche-ecritures.ts` ; `journal-edition.ts` | la recherche d'OmegaX n'a pas le critère de l'auteur |
| Rapport des factures · période, détaillé ou groupé, visée ou validée, soldée, en cours ou annulée, type, fournisseur, produit | 128, 154 | partiel | `src/modules/facturation/` | ni visa ni validation de facture chez OmegaX |
| Déclaration des taxes · exercice, mois, taxe, export | 128 | partiel | déclaration de TVA (`src/modules/tva/`), registre des retenues (`src/modules/retenues/`) | |
| Saisie d'écritures · journal et période, jour, référence, libellé, compte auxiliaire, compte, débit, crédit, type de budget, ligne budgétaire, financement | 128, 129 | oui | `SaisiePage.tsx`, `ecriture.service.ts`, ventilation à la saisie (`analytique.service.ts`) | |
| Rapprochement bancaire · banque, compte, période, solde de début et de fin, opérations à cocher, « Nouveau » pour saisir une opération du relevé, export de l'état | 129, 154, 155 | oui | relevé importé, propositions, clôture (`src/modules/rapprochement/releve-bancaire.ts`) | OmegaX ne saisit pas l'écriture depuis le rapprochement (ligne « à comptabiliser ») |
| Comptabilisation · journée non comptabilisée, brouillard de la journée, « Comptabiliser » | 130, 155 | hors champ | · | écritures nées au guichet ; OmegaX écrit au brouillard puis valide (`ecriture.service.ts`) |
| Historique des rapprochements · période, banque, compte | 130 | oui | extraits bancaires (`src/modules/rapprochement/extraits-bancaires.ts`) | |
| VISA · virement et prélèvement, retrait plafonné, opérations diverses et déplacées, écritures, facture, règlement, virement compte à compte (grilles) | 130, 131, 151 | partiel | `Tenant.doubleRegardValidation` ; `visa-rib.ts` | colonnes visibles en capture, aucun seuil décrit · idée 1 du § 4 |
| VALIDATION · virement et prélèvement, écritures, commande, liste des commandes validées, facture, règlement, virement compte à compte (grilles) | 132, 133, 152 | partiel | idem | |
| Journaux comptables · exercice, mois, type de journal, journal (« centralisé »), mouvement, montant, utilisateur, pièce, libellé, export | 133 | partiel | `journal-edition.ts`, `recherche-ecritures.ts` | pas de critère d'auteur |
| Autres opérations · virement ou prélèvement d'un client, compte à compte (DAV, tontine) | 133, 134, 161 | hors champ | · | |
| Opération diverse · multiligne, type, date, compte, libellé, montant, budget, bailleur ; liste avec DATE DE VISA et DATE DE VALIDATION | 134, 135, 162 | oui | journal d'OD ; validation tracée (`Ecriture.valideeBy`, `valideeAt`) | |
| Opérations déplacées | 135 | hors champ | · | |
| Domiciliation des salaires · salaires d'une institution cliente versés sur les comptes de ses employés, fichier importé | 135, 136 | hors champ | · | |
| Salaire du personnel · « l'onglet ne marche pas » | 136 | oui | paiement des salaires (`src/modules/personnel/paiement-salaires.ts`) | |
| Prélèvement automatique · « l'onglet ne marche pas » | 136 | hors champ | · | |
| CONTRÔLE DES COMPTES · soldes « gestion » et « comptabilité » et écart par famille (épargne, crédits, caisse, banque, balance), « DATES NON TRANSFÉRÉES » | 136, 162, 163 | partiel | confrontations module par module · registre des biens contre la balance (`src/modules/immobilisations/maintenance-immobilisations.ts`), tiers contre collectifs (`src/modules/exports/export-fpm.service.ts`) | la capture montre quarante-deux dates non transférées et des écarts non nuls · idée 5 du § 4 |
| Contrôle de trésorerie · soldes des caisses et des banques à une date | 136, 137, 162 | partiel | trésorerie disponible du tableau de bord (`client/src/pages/DashboardPage.tsx`) ; balance d'une période (`src/modules/comptabilite/periode-extrait.ts`) | |
| Rapport des annulations · guichet, période, type d'opération, utilisateur ; pièce ancienne et pièce nouvelle | 137 | oui | négatifs liés à leur origine ; journal d'audit (`src/common/audit/`) | |
| État des revenus · par jour et par agence · dépenses, recettes, résultat ; détaillé ou synthèse | 137, 138 | partiel | états personnalisés (`src/modules/etats-personnalises/`) ; tableau de bord | |
| Lettrage · compte, période, non lettrées, lettrées, toutes ; totaux de la sélection | 138, 160 | oui | `src/modules/lettrage/` | |
| Grand livre général · type (global), agence, exercice, période, case « avec vidage » | 138, 139 | oui | grand livre en flux, extrait d'une période (`export-fpm.service.ts`, `periode-extrait.ts`) | « vidage » n'est défini nulle part |
| Grand livre analytique | 139 | oui | `src/modules/analytique/etats-analytiques.service.ts` (`grandLivre`) | |
| Balance générale · « à 8 colonnes », groupée, agences, période, comptes de / à, NIVEAU DE RUPTURE, « sans vidage » | 139, 140 | oui | balance de la présentation du cabinet, totaux par division (`src/modules/exports/balance-fpm.ts`) | |
| Balance analytique | 140 | oui | `etats-analytiques.service.ts` (`balance`) | |
| Bilan (« version développée », état « création », agence, période) ; compte de résultat | 140, 141 | oui | `src/modules/etats-financiers/`, `src/modules/etats-financiers-syscohada/` | dans SON champ |
| Hors bilan (« développé ») | 140, 141 | partiel | classe 9 semée, engagement bancaire proposé (`conditions-bancaires.ts`) | aucun état du hors bilan |
| État annexe · « Annexe 1 · tableau des emplois et ressources » | 141, 142 | oui | `correspondance-projet-emplois-ressources.ts` (projets SYCEBNL) | |
| Indicateurs financiers · exercice, indicateur « mensuel », mois | 142 | partiel | 24 indicateurs de la NOTE 33 (`src/modules/notes-annexes/indicateurs-note-33.ts`) ; tableau de bord | liste des indicateurs non montrée |
| Annulation du règlement d'un CRÉDIT prélevé sur compte · capital, intérêt, épargne, fonds de solidarité, pénalité | 157, 158 | hors champ | · | voir § 3 |
| Transfert entre comptes ; virement ou prélèvement sur compte | 161 | hors champ | · | |

#### 2.9 Budget (M p. 142 à 145)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Nouveau budget · définir, ou RECONDUIRE l'ancien | 142 | oui | report des budgets (`budgetsAReporter`, `src/modules/exercice/report-a-nouveau.ts` ; `reporterBudgets`, `src/modules/exercice/exercice.controller.ts`) | |
| Consulter et modifier · budget, type, période, ligne, financement, compte, valeur ; imprimer global ou par type | 143 | oui | `doterBudget`, `modifierBudgetMois`, `budget` (`analytique.service.ts`) | |
| Suivi budgétaire · budget, type, période, centre de coût ; « financement », « résultat analytique », export | 143 | oui | état budgétaire (`etats-analytiques.service.ts`, `etatBudgetaire`) ; exécution budgétaire, notes 35 et 24 (`src/modules/etats-financiers/etats-financiers-projet-budget.service.ts`) | |
| Consommation par centre de coût · exercice, période, ligne, centre | 143 | oui | idem ; rubriques (`rubriques-budgetaires.ts`) | |
| Lignes de financement (libellé, montant, type « ressources affectées ») | 143, 144 | oui | `src/modules/bailleurs/` | |
| Types de financement · fonds propres, ressources affectées | 144 | partiel | idem | vocabulaire d'IMF |
| Bailleurs (type, code, nom) | 144, 145 | oui | idem | |

#### 2.10 Autres (M p. 163 à 165)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Clôture · crédit (état des provisions de crédits · degré, terme, encours, retard, provisions, comptes) et dépôt | 163 | hors champ | · | |
| Clôture · comptabilité (intitulé de menu, capture) | 163 | oui | clôture annuelle (`src/modules/exercice/exercice.service.ts`) | non décrite |
| Trésorerie (intitulé de menu seul) | 163 | partiel | trésorerie disponible du tableau de bord | rien n'est décrit |
| Calculs · frais de tenue de compte, intérêts sur DAV et DAT, état des provisions de crédits (capture) | 163, 164 | hors champ | · | |
| Caisse mobile · transfert de la collecte, paramètres (capture) | 164 | hors champ | · | voir § 3 |
| GESTION DE RÉUNION · nouvelle réunion, liste, catégorie, ORGANE, poste, PV, affectation, statistique, type, VALIDATION DU PERDIEM (capture seule) | 165 | non | · | voir § 4 |

---

### 3. Corrections à l'audit précédent

| Ligne de l'audit précédent | Ce qui était écrit | Ce que dit la page |
|---|---|---|
| (a), pagination de la CAMEC | « La pagination de la note précède d'une à deux pages le folio imprimé » | elle le SUIT d'une page · CAMEC p. N = page PDF N = folio N − 1, sur les vingt renvois de cette partie |
| (a), couverture | folios 80 à 306 « non » lus | 80 à 166 lus, texte et captures |
| 2. Administration, rapport des transactions | « oui », M p. 22, 23 | folio 22 seul ; le rapport COMPTE les opérations, annulations et transactions PAR UTILISATEUR (capture), ce qu'OmegaX ne fait pas · **partiel** |
| 3. Paramétrage, numérotation des clients | « oui » | le numéro se compose de segments (préfixe, institution, agence, catégorie, compteur, suffixe, capture M p. 26) · **partiel** |
| 3. Paramétrage, numéro de pièce | « oui » | positions institution, agence, journal, compteur (M p. 41) · OmegaX n'a que des modes de numérotation · **partiel** |
| 3. Paramétrage, éléments de facture et référence de commande | « oui » | « élément de facture » paramètre un TAUX (taux, « taux A. », « taux N.A. », retenue) et « référence commande » une numérotation de commandes (M p. 46, 47) · **partiel** l'un et l'autre |
| 3. Paramétrage, « Société, agences, zones, logo » | sans détail | la capture ajoute N° d'agrément, IFU, « journée maxi ouverte », comptes hors bilan 1 et 2, « info sécurité » (M p. 42) |
| 4. Client, enrôlement d'un groupe | compris dans « partiel » | les membres et les effectifs par sexe sont propres au groupe solidaire · **hors champ** (M p. 50) |
| 4. Client, « Mise à jour, procurations (titre seul), résiliation » · partiel | une ligne | trois fonctions · mise à jour **oui** ; procurations = une liste de TYPES (capture « Nouveau type procuration ») **hors champ** ; résiliation (motif, frais, soldes) **partiel** (M p. 55, 56) |
| 5. Banque, encaissement et décaissement | M p. 59, 60 | folio 60 (59 est le menu) ; la capture montre en plus « type écriture multiligne », le SOLDE de la banque, et le type de budget, la ligne et le bailleur |
| 5. Banque, visa et validation | « titres seuls » | grilles à cocher en capture (date, opération, montant, banque, compte, numéro comptable), sans texte (M p. 65 à 67) |
| 5. Banque, chèques de l'institution | « titres ; le second en panne » | « Générer chéquier » a son écran · banque, compte, nombre de feuillets, début, fin, barré, visé, certifié (M p. 69) ; seul « chèque pour crédit » est en panne (M p. 70) |
| 5. Banque, emprunts bancaires | « titres seuls » | deux écrans en capture · mise en place (taux annuel, durée, intérêts, commissions, frais, compte d'emprunt) et remboursement (capital restant, amortissement, intérêt, commission) (M p. 70, 71) |
| 5. Banque, adhésion | M p. 64, 65 | folio 64 |
| 6. Épargne, blocage | « M p. 72 ; CAMEC p. 73 » | décrit au folio 81 · solde, montant bloqué et débloqué, épargne libre, motif, historique des actions ; CAMEC p. 73 = folio 72, le seul menu |
| 6. Épargne et (c), « édition des cotisations et rupture annoncées, non décrites » | les deux | l'édition des cotisations a son écran (M p. 80) ; la rupture seule est un titre |
| 6. Épargne et (c), rapports | « annoncés sans description » | six rapports en capture (M p. 82 à 84) |
| 7. Caisse, billetage | CAMEC p. 91-92, « folios non lus » | folios 90 à 92 (et 104 à 106) · arrêté par JOURNÉE avec « bon de caisse », validation solde informatique contre solde réel |
| 8. Crédit, visa à plusieurs niveaux | CAMEC p. 115-116 | folios 114 et 115 ; trois grilles (responsable, comité, service financier) et un historique par niveau et par avis |
| 8. Crédit, engagement par signature | CAMEC p. 122 | folio 121, écran complet en capture |
| 9. Comptabilité, saisie | CAMEC p. 129, « suppression avant validation » | folios 128 et 129 ; le manuel dit seulement « [Supprimer] en cas de mauvais enregistrement », sans parler de validation |
| 9. Comptabilité, comptabilisation | CAMEC p. 131 | folios 130 et 155 |
| 9. Comptabilité, visa et validation | CAMEC p. 131-133 | folios 130 à 133 et 151, 152 · sept grilles de visa et sept de validation, VISA PUIS VALIDATION, sans seuil décrit |
| 9. Comptabilité, virement des salaires | CAMEC p. 137 | folio 136 · confirmé, les deux onglets « ne marchent pas » |
| 9. Comptabilité, grand livre | CAMEC p. 139 | folios 138 et 139 ; balance aux folios 139 et 140 |
| 9. Comptabilité, indicateurs | CAMEC p. 143 | folio 142 · confirmé, aucune liste d'indicateurs |
| 9. Comptabilité, plan des comptes | CAMEC p. 147, 157 | folios 122 et 146 ; la NATURE se choisit à la main (actif, passif, charge, produit, hors bilan) |
| 9. Comptabilité, annulation de règlement | **oui** (CAMEC p. 159) | folio 158 · « Annulation de règlement d'un CRÉDIT effectué par prélèvement sur compte » · **hors champ** |
| 11. États financiers | CAMEC p. 141-142 | folios 140 à 142 ; l'état annexe est le tableau des emplois et ressources |
| 12. Contrôle, rapport des annulations | CAMEC p. 138 | folio 137 · confirmé |
| 10. Budget | CAMEC p. 143-145 | folios 142 à 145 ; la RECONDUCTION de l'ancien budget est décrite (OmegaX la tient) |
| 13. Autres, caisse mobile | « citée sans être décrite » | la capture montre « Transfert collecte » et « Paramètres » (M p. 164) |
| 13. Autres | deux lignes | le menu porte aussi Clôture (crédit, dépôt, comptabilité), Trésorerie et GESTION DE RÉUNION, que l'audit précédent ne nommait pas (M p. 163 à 165) |
| (c), mentions de panne | quatre | confirmées · chèque pour crédit (M p. 70), clôturer un compte d'épargne (M p. 80), salaire du personnel et prélèvement automatique (M p. 136) ; à quoi s'ajoutent deux pages sans texte (M p. 159, 165) et un texte coupé (M p. 164) |

---

### 4. Les fonctions utiles à OmegaX

Toutes seraient des fonctions NOUVELLES, sous le gel (CLAUDE.md § 5) ; aucune
n'est proposée comme décidée. Aucune n'est imposée par un texte lu ici ; une
seule, l'idée 7, toucherait un domaine régi (les organes d'une association),
dont le texte serait à lire avant toute ligne (compétence `droit-asbl-ong-rdc`).

| N° | Fonction de Microfina++ | M p. | Ce qu'elle apporterait à OmegaX | État dans OmegaX |
|---|---|---|---|---|
| 1 | **Visa PUIS validation, par objet** · écritures, OD, factures, règlements, commandes, virements, « retrait plafonné » ; dates de visa et de validation sur la liste ; fiche d'imputation « Saisie par / Approuvée par » | 130 à 133, 135, 151, 152, 154 | le contrôle d'une ONG financée · une dépense visée par le responsable avant que le comptable la passe au livre-journal, et une pièce imprimée qui porte les deux noms | partiel · un double regard en option, sur l'écriture seule, sans seuil (`Tenant.doubleRegardValidation`) |
| 2 | **Bon de commande fournisseur** lié à la facture puis au règlement, avec ligne budgétaire et bailleur OBLIGATOIRES à chaque ligne, état de validation imprimé | 125, 126, 147 à 150, 159 | le bon de commande remis non exécuté est déjà un terme de l'engagement budgétaire (SYCEBNL, Guide d'application, ch. 7, Application 22, règle (d), tel que le cite `engagement.service.ts`) ; un document qui CRÉE l'engagement et que la facture EXÉCUTE supprimerait la double saisie | partiel · engagements saisis à part (`src/modules/analytique/engagement.service.ts`) |
| 3 | **Arrêté de caisse périodique et plafond d'encaisse** · comptage par coupures à la journée, « bon de caisse », solde informatique contre solde réel ; « maximum autorisé en caisse » par caisse | 19, 90 à 92, 95 | l'arrêté quotidien d'une caisse active, et un AVERTISSEMENT quand une caisse dépasse le plafond que le dossier fixe (convention du dossier, aucun texte lu ici n'en fixe) | partiel · procès-verbal de comptage d'inventaire ; plancher à zéro seulement (`caisse-provisionnee.ts`) |
| 4 | **Registre des chèques émis** · chéquier reçu (numéros de début et de fin, barré, visé, certifié), numéro saisi au règlement | 69, 153 | savoir quel chèque est parti, lequel est annulé, lequel attend sa présentation, et le rapprocher du relevé | non |
| 5 | **Écran de concordance « gestion / comptabilité »** · par famille, solde du module contre solde du grand livre, écart, dates non transférées | 136, 162, 163 | réunir en UN écran les confrontations qu'OmegaX fait déjà module par module (biens, tiers, paie, stocks) | partiel · confrontations dispersées (`maintenance-immobilisations.ts`, `export-fpm.service.ts`) |
| 6 | **Emprunt bancaire tenu** · taux annuel, durée, intérêts, commissions, frais, capital restant, remboursement en capital et intérêts | 70, 71 | confirme par les captures l'idée 2 de l'audit précédent | partiel · crédit de trésorerie au 561, l'emprunt long « hors de ce module » |
| 7 | **Gestion des réunions des organes** · organe, poste, PV, affectation, statistique, validation du perdiem (capture seule) | 165 | une association tient ses assemblées et ses conseils, et le perdiem versé aux membres est une dépense à justifier | non · rien n'en est connu au-delà du menu |
| 8 | **Solde du compte de trésorerie affiché à la saisie** | 60, 85, 89, 92 | voir avant d'enregistrer ce que la caisse ou la banque contient, à côté du refus de la caisse créditrice | non · `SaisiePage.tsx` ne montre que le solde de la pièce |
| 9 | **Montant en lettres** sur les pièces (bon de commande, opérations de caisse) | 86, 89, 92, 150 | pièce de caisse et bon de commande lisibles sans ambiguïté | non |
| 10 | **Activité par utilisateur et utilisateurs connectés** · nombre d'opérations et d'annulations par utilisateur sur une période ; qui est connecté, depuis quel poste | 18, 22 | une revue de l'activité par le responsable, que le journal d'audit permet déjà de filtrer sans la compter | partiel · `filtre-journal-audit.dto.ts` |
| 11 | **Tranches de paiement en pourcentage** d'une facture fournisseur, facture d'acompte sur une tranche | 149, 150 | le paiement par acomptes d'un marché | partiel · échéancier du modèle de règlement (`tiers/echeancier-modele.ts`) |
| 12 | **Critère « utilisateur » dans la recherche d'écritures** | 128, 133 | retrouver ce qu'a saisi un collaborateur | non · `recherche-ecritures.ts` n'a pas ce critère |

---

### 5. Mieux fait, moins bien fait

#### Ce que le manuel fait mieux qu'OmegaX

| Point | Microfina++ | OmegaX |
|---|---|---|
| Chaîne de la dépense | commande, facture, règlement liés, chacun visé et validé, états « soldée, en cours, annulée » (M p. 125 à 133, 147 à 154) | facture et règlement liés ; l'engagement se saisit à part (`analytique/engagement.service.ts`) ; aucun visa de facture ni de règlement |
| Deux étapes de contrôle par objet | sept listes de visa et sept de validation (M p. 130 à 133) | un double regard optionnel sur l'écriture (`Tenant.doubleRegardValidation`) |
| Imputation budgétaire au même écran que le geste | type de budget, ligne, bailleur sur l'opération de banque, l'OD et la saisie (M p. 60, 129, 135) | comparable · la ventilation s'envoie avec la saisie (`verifierVentilationObligatoire`, `analytique.service.ts`) ; pas de « bailleur » sur la ligne |
| Arrêté de caisse | par journée, par coupures, « bon de caisse » (M p. 91, 92) | à l'inventaire seulement (`ProcesVerbalComptageCaisse`) |
| Soldes à l'écran | solde de la banque et de la caisse affiché à chaque opération (M p. 60, 85, 92) | refus de la caisse créditrice (`caisse-provisionnee.ts`), solde non affiché en saisie |
| Rapprochement | « Nouveau » saisit l'opération du relevé depuis l'écran du rapprochement (M p. 155) | la ligne reste « à comptabiliser », à passer au journal (`releve-bancaire.ts`) |
| Activité des utilisateurs | qui est connecté, depuis quelle machine ; décompte par utilisateur (M p. 18, 22) | déconnexion par l'administrateur, journal d'audit sans décompte |
| Concordance des sous-systèmes | un écran, toutes familles, dates non transférées (M p. 136) | confrontations dispersées par module |

#### Ce que le manuel fait moins bien qu'OmegaX

| Point | Microfina++ | OmegaX |
|---|---|---|
| Ce qui ne marche pas | quatre onglets « ne marche pas » (M p. 70, 80, 136 deux fois), deux pages sans texte (M p. 159, 165), un texte coupé (M p. 164), quatorze pages en doublon (M p. 97 à 110), une section entière réduite à son menu (accès rapide, M p. 13) | les fonctions décrites sont servies ; « jamais de bientôt disponible qui soit faux » (CLAUDE.md § 4) |
| Nature d'un compte | choisie à la main (actif, passif, charge, produit, hors bilan, M p. 146) · la CAMEC y voit des types incohérents (U13) | lue sur le numéro, contradiction refusée (`comptes/classe-du-numero.ts`) |
| Suppression | « [Supprimer] en cas de mauvais enregistrement » à la saisie et au plan des comptes (M p. 122, 129) | refusée tant qu'une référence existe (`src/common/suppression/references.ts`) ; une écriture validée ne se corrige qu'en négatif (`ecriture.service.ts`) |
| Écarts tolérés | la capture du contrôle des comptes montre des écarts gestion / comptabilité non nuls et quarante-deux dates non transférées (M p. 136) | une écriture déséquilibrée, hors exercice ou sans numéro est refusée à la racine (CLAUDE.md § 10 bis) |
| Options non définies sur les livres | « avec vidage », « sans vidage » au grand livre, à la balance, au bilan et au résultat (M p. 139 à 141), jamais expliqué | l'extrait d'une période se dit, numéroté et daté (`periode-extrait.ts`) |
| Exercice | une année, rien d'autre (M p. 21) | bornes de dates, premier exercice long (`src/modules/exercice/`) |
| Plan et taxes | plan d'IMF et plan SYSCOHADA côte à côte, concordance à la main (M p. 122, 146, 156) ; taux et sigles d'un autre pays dans les captures (AIB, IFU ; M p. 124, 125, 127) | un référentiel légal par dossier (`Tenant.referentiel`) ; compte de taxe routé, taux semés par référentiel (`tva/routage-tva.ts`, `tva/taux-tva-seed.ts`) |
| Identité des pièces | numéros composés de segments libres (M p. 26, 41) sans contrôle des trous | trous de séquence nommés (`journaux/sequence-pieces.ts`) |

---

## Partie B · le module GRH du manuel Microfina++ face à OmegaX (2026-10-25)

Partie d'audit, sans décision. Elle prolonge
`docs/comparaison-microfina/audit-complet-manuel-microfina.md` (branche
`travail/paie-microfina`), dont elle reprend la légende et les colonnes, et
remplace sa ligne « 16. GRH (M p. 6-7) », écrite sans avoir lu le module. Rien
n'est codé ; toute idée du § 3 est une FONCTION NOUVELLE, sous le gel des
nouveautés (CLAUDE.md § 5).

**Conventions** · « M p. N » renvoie au folio IMPRIMÉ du manuel. Un chemin
renvoie au fichier d'OmegaX lu sur la révision `90a226b` (`main`). « (capture) »
signale une fonction connue SEULEMENT par une capture d'écran, sans texte qui la
décrive. Légende · **oui** : la fonction existe dans OmegaX, vérifiée dans le
code ; **partiel** : un équivalent existe, de périmètre ou de sens différent ;
**non** : rien, alors que la fonction servirait une ASBL, une ONG ou une
entreprise ; **hors champ** : la fonction est propre à une COOPEC ou une IMF, ou
étrangère à la gestion d'une entité (ici, seulement le texte publicitaire d'un
autre éditeur, voir § 1.2).

**Pagination, vérifiée** · le folio imprimé vaut la page du PDF MOINS UN, sur
toute la plage (page PDF 167 · folio 166 « Chapitre 5 Module GRH » ; page PDF
270 · folio 269 « Chapitre 6 Module Paie » ; page PDF 271 · folio 270). Le
module GRH occupe les folios **166 à 268** (pages PDF 167 à 269). La demande
visait les folios 167 à 269 · pour ne rien laisser au bord, ont été lues les
pages PDF 167 à 271, soit les folios 166 à 270, dont les deux premiers folios
du module Paie (269, 270), qui relèvent du document de la paie
(`docs/comparaison-microfina/paie-microfina-omegax.md`).

**Ce qui a été lu** · le texte extrait page par page
(`scratchpad/microfina/manuel-pages.txt`) ET chacune des 105 pages en image,
par l'outil de lecture du PDF (six appels, pages 167 à 186, 187 à 206, 207 à
226, 227 à 246, 247 à 266, 267 à 271). 86 pages portent au moins une capture
d'écran, toutes regardées ; 19 sont du texte seul.

---

### 1. Couverture

#### 1.1 Folio par folio

| Folio (page PDF) | Contenu | Capture regardée |
|---|---|---|
| 166 (167) | Chapitre 5, « Page principale de la GRH » · barre de menus (Données de bases, Recrutement, Personnel, Affectation, Absence, Sanction, Formation, Stage, Mission, Retraite) et volet (Recrutement ; Personnel · Nouvel employé, Personne en charge, Liste des employés, Liste des contractuels, Dossier du personnel ; Mouvements, Absence, Sanction, Stage, Formation, Mission, Retraite, Statistiques) | oui |
| 167 (168) | texte · ce que comprend la gestion du personnel (recrutement, rémunération, évaluation, absences et congés, gestion prévisionnelle des emplois, formations et stages) | sans capture |
| 168 (169) | texte · le module dit conçu « grâce au document de la convention collective du travail », « imprimés recommandés par la convention de droit de travail, vos supérieurs ou vos bailleurs » ; titre « Paramétrage des données de base » | sans capture |
| 169 (170) | menu Données de bases (Processus de dotation, Évaluation du personnel, Mouvement du personnel, Paie) ; liste du processus de dotation (Centre de coût, Civilités, Critère de recrutement, Fonction d'employé, Groupe sanguin, Lieu de naissance, Pays, Pièces, Profession, Situation matrimoniale, Type de centre de coût, Type de critère de recrutement, Type d'employé) | oui |
| 170 (171) | Type d'employé (Code, Libellé · ouvrier, cadre, agent de maîtrise, employé, permanent, saisonnier) ; Type de critère de recrutement (responsabilité, expérience, profil, niveau d'études, aptitudes, général, technique) | oui |
| 171 (172) | Critère de recrutement (Critère, Type de critère, Description) ; Fonction d'employé | oui |
| 172 (173) | Situation matrimoniale, la même capture deux fois · la liste montre des doublons (« Célibataire » et « CELIBATAIRE », « Marié(e) » deux fois) | oui |
| 173 (174) | Pièces à fournir (Code, Pièce · carte d'identité, CV, diplôme, certificat de mariage ; le texte dit à tort « Situation matrimoniale ») ; Lieu de naissance (Lieu, Pays) | oui |
| 174 (175) | Critères d'évaluation (Critère, Point prévu, Type de critère) et leur liste | oui |
| 175 (176) | Motif et type d'affectation ; Motif d'absence (Déduction sur salaire, Type · absence ou permission, Nature · exceptionnelle ou non, Durée réglementaire, Nombre maximal autorisé, Crédit requis, Justification requise) | oui |
| 176 (177) | Formation · catégorie, compétence, destination (Destination, Zone, Pays), motif ; Stage (texte) | oui |
| 177 (178) | Stage · domaine de compétence, niveau d'études, type de stage ; Mission (texte) | oui |
| 178 (179) | Élément de frais de mission (Code, Élément · hébergement, déjeuner, petit-déjeuner, divers) ; Motif de mission (case « Pour formation ») | oui |
| 179 (180) | Moyen de transport (Code, Désignation) ; Paramétrage des frais de mission (Catégorie, Classe, Échelon, Zone, Élément, Montant, total, liste des enregistrements) | oui |
| 180 (181) | Véhicule utilisé (Immatriculation, Modèle, Assuré ; le texte décrit à tort un montant) ; Zone (texte) | oui |
| 181 (182) | Zone (Libellé, Internationale) ; Allocation familiale (Nombre de personnes, Taux, Limite d'assurance, Montant) | oui |
| 182 (183) | Barème d'impôt (Minimum, Maximum, Taux) ; Catégorie de paie | oui |
| 183 (184) | Classe, Échelon ; Grande famille d'élément (texte) | oui |
| 184 (185) | Grande famille (salaire de base, primes et indemnités, heures supplémentaires, retenues fiscales, retenues sociales, avances, acomptes et oppositions) ; Grande rubrique (Code, Libellé, Imposable) | oui |
| 185 (186) | Grille salariale (Classe, Catégorie, Échelon, Salaire, Points) ; Type d'avance (Code, Libellé, Compte 422000) ; Type d'heure supplémentaire (texte) | oui |
| 186 (187) | Type d'heure supplémentaire (Code, Libellé, Taux, Élément salaire) ; Type de grille (fiscale, indiciaire, sociale, primes et indemnités) ; Type de retenue (texte) | oui |
| 187 (188) | Type de retenue (Code, Libellé, Compte · la CNSS rattachée au 6610043 « Rémunérations directes versées au personnel national ») ; menu Recrutement (Emploi, Avis de recrutement, Dossier de candidature, Délibération, Classement par ordre de mérite, Liste des candidatures, Annulation et clôture d'avis) | oui |
| 188 (189) | Création d'un emploi (Poste, Direction ou cellule, Service, Modèle de contrat, Responsabilité, Poste du responsable, Qualifications, État du poste, Poste sensible, Description) ; Liste des postes (filtre Tous, Vacant, Non vacant ; Imprimer) | oui |
| 189 (190) | Avis de recrutement · informations de base (Code automatique, Date de publication, Date de clôture du dépôt, Adresse de dépôt, Description, Postes concernés) ; sélection des postes | oui |
| 190 (191) | Critères requis par poste ; sélection des critères | oui |
| 191 (192) | Critère éliminatoire Oui ou Non | oui |
| 192 (193) | Pièces à fournir par avis, éliminatoires ; bouton « Imprimer l'avis de recrutement » | oui |
| 193 (194) | Sélection des pièces | oui |
| 194 (195) | Liste des avis (Code, Dates, Adresse, Imprimer) ; dossier de candidature (texte) | oui |
| 195 (196) | Recherche de candidat (Externe ou Interne ; N°, Nom, Prénoms, Sexe, Date de naissance) ; enregistrement du dossier (Avis, Candidat, Date de dépôt, Commentaire, détails de l'avis) | oui |
| 196 (197) | Vérification du dossier (pièces et critères, Éliminatoire, Présent) ; délibération (texte) | oui |
| 197 (198) | Délibération (Avis, Date) ; liste des candidats (Nom, Sexe, Date de naissance, Poste, Appréciation, Note) | oui |
| 198 (199) | Classement par ordre de mérite (Rang, Nom, Sexe, Date de naissance, Poste, Appréciation, Note ; Imprimer) | oui |
| 199 (200) | Liste des dossiers délibérés (Avis, Nom, Poste, Date de dépôt, Appréciation, Date de délibération) ; annulation ou clôture (texte) | oui |
| 200 (201) | Liste des avis, Clôturer, Annuler ; « Clôturer un avis » (Code, Date de clôture) ; titre « Enregistrement d'un employé » | oui |
| 201 (202) | Enregistrement d'un employé, onglet Informations générales (Matricule, N° sécurité sociale, Sexe, Civilité, Nom, Prénoms, Nom de jeune fille, Situation matrimoniale, Date et lieu de naissance, Nationalité, Groupe sanguin, Contacts 1 et 2, Adresse, Email, BP, Profession, Personne à prévenir, Date de début de carrière, Date d'embauche, Personnes à charge, photo) ; boutons Visualiser le contrat, Importer un candidat | oui |
| 202 (203) | Recherche d'un employé (Matricule, Nom, Prénoms, N° CNSS) | oui |
| 203 (204) | Personne à charge (Nom, Prénoms, Date de naissance, Conjoint, Employé, Enfant propre) | oui |
| 204 (205) | Recherche d'un candidat ; Liste des diplômes à ajouter (Diplôme, Date d'obtention, Actif) | oui |
| 205 (206) | Onglet Formation de la fiche (diplômes) | oui |
| 206 (207) | Onglet Classification (Catégorie, Classe, Échelon, Salaire de base prédéfini « Régime indiciaire », Salaire de base et sursalaire au point, ancienneté acquise · date de référence et taux de prime d'ancienneté, durée, montant, congés dus ; grilles) ; critère technique associé au poste (texte) | oui |
| 207 (208) | Critères techniques ; critère technique associé au poste (Direction, Poste) | oui |
| 208 (209) | Notation de rendement (Employé, Évaluateur, Période, Points prévus et obtenus par critère, Total, Imprimer ; confirmation avec commentaire) ; « Rapport · Liste des contractuels » | oui |
| 209 (210) | Liste des contractuels (Matricule, Employé, Type de contrat, Dates de début et de fin) ; Liste du personnel (Matricule, Nom, Catégorie salariale, Date d'embauche, Poste, Fonction ; Exporter, Répartition par sexe) ; le texte de la recherche multicritère recopie celui de la notation | oui |
| 210 (211) | Recherche multicritère (période ou date fixe ; détaillé ou groupé ; Liste, Fichier ou Coût salariaux ; Agence, Département, Service, Poste, Profession, Plan de carrière, Catégorie, Classe, Échelon, Régime, Nationalité, Groupe sanguin, Situation matrimoniale, dates, Type et modèle de contrat, Type d'employé) ; dossier du personnel (texte) | oui |
| 211 (212) | Dossier d'un employé (Mouvements, Absences, Sanction, Formation, Mission) ; Gestion des affectations (Référence, Direction, Poste, Agence, Type et motif, Dates, détails du poste, ancien occupant, Commentaire, Imprimer) | oui |
| 212 (213) | Liste et historique des affectations (ancien et nouveau poste et agence) ; Planification de congés (Motif, Dates de départ et de retour, « Soit 15 jours ouvrables », Exercice ; jours dus, crédit de l'exercice, crédit restant ; caractéristiques du motif) | oui |
| 213 (214) | Recherche d'une planification ; Édition de titres de congés administratifs (liste des employés) | oui |
| 214 (215) | Titre de congés (« conformément à l'article 158 du code du travail », nom, fonction, jours, dates ; Exporter) ; Demande d'autorisation d'absence (Durée, Dates, Motif, Description ; détails du motif) | oui |
| 215 (216) | Liste des demandes ; Absences en attente de validation (Validé, Non validé) ; traitement (texte) | oui |
| 216 (217) | Traitement des demandes (À traiter, Traitées ; Accordée, Rejetée ; durées demandée et accordée ; Exporter) ; annulation (texte) | oui |
| 217 (218) | Annuler une demande ; Notification des absences, liste des absences constatées | oui |
| 218 (219) | Justification d'absence constatée (Justifiée, Retenue sur crédit de congés, Retenue sur salaire, Montant) ; Rapport de base (permissions, absences constatées, planification de congés, restauration des jours dus ; filtres) ; Formateur (Raison sociale, Nature interne ou externe, Adresse, Contact, Email) | oui |
| 219 (220) | Liste des formateurs ; Planning de formation (Employé, Catégorie, Cabinet, Financement, Lieu, Dates, Thème, Coût estimatif, Nombre de participants) | oui |
| 220 (221) | Liste des plannings ; Mise en œuvre (Code, Motif, Lieu, Destination, Dates, Coût de la formation, Autres frais, Commentaire) | oui |
| 221 (222) | Mise en œuvre, participants (Matricule, Nom, Prénoms, N° CNSS) ; mise à jour des participants | oui |
| 222 (223) | Sélection de la formation ; Validation d'une formation (Date de début réelle, participants) | oui |
| 223 (224) | Mise à jour des participants ; Annuler une formation | oui |
| 224 (225) | Suivi de réalisation (prévu contre réel, par thème, formateur, participant) ; Détails des formations | oui |
| 225 (226) | Clôturer une formation ; Gestion des missions, informations de base (Durée, Départ, Retour, Motif, Lieu de départ, Destination, Adresse, Moyen de transport, Véhicule ; Imprimer l'ordre de mission) | oui |
| 226 (227) | Mission · participants et éléments de frais (Frais supplémentaire, total) ; accompagnants | oui |
| 227 (228) | Recherche d'une mission ; Frais de mission des accompagnants (montant par accompagnant) | oui |
| 228 (229) | Liste des véhicules en mission (Assuré, Disponible ; Libérer le véhicule) ; Notification de mission (missions en cours) | oui |
| 229 (230) | Paramétrage des frais de mission, deux états (restauration, hébergement, divers, total) | oui |
| 230 (231) | Liste des missions par période (Toutes, Accompli, En cours ; Imprimer) ; texte « A · Gestion des missions » | oui |
| 231 (232) à 236 (237) | texte · ordre de mission en trois onglets, participants, frais supplémentaires, accompagnants externes, liste des missions en quatre onglets, frais des accompagnants, notification de fin de mission | sans capture (six folios) |
| 237 (238) | Figures A00 et A01 · interface d'une version antérieure · menu Mission (Nouvelle mission, Liste, Notification, Frais pour accompagnant, Paramétrage, Enregistrement de moyen de transport) ; volet Personnel (Nouvel employé, Personne en charge, Liste des employés, Mise à jour des contrats, Nouvelle demande de préavis, Nouvelle période d'essai, Paramétrage durée préavis, Paramétrage période essai) ; mission avec heures de départ et de retour | oui |
| 238 (239) | Figures A02, A02-1 · participants | oui |
| 239 (240) | Figures A02-2, A02-3 · frais supplémentaire (Code, Montant), liste des frais et total | oui |
| 240 (241) | Figures A03, A03-1 · sélection des participants | oui |
| 241 (242) | Figures A04, A04-1 · accompagnants (Nom, Prénoms, Sexe, Téléphone) | oui |
| 242 (243) | Figures A04-2, A04-3 · enregistrement et sélection d'un accompagnant | oui |
| 243 (244) | Figures A04-40, A04-5 · suppression d'un accompagnant, sélection | oui |
| 244 (245) | Figures A05-6, A04-7 · accompagnants retenus | oui |
| 245 (246) | Figures A05, A05-1 · liste des missions par période | oui |
| 246 (247) | Figures A05-2, A05-3 · « Format du fichier » (PDF, Excel, HTML, RTF, XML, CSV) ; missionnaires et frais, participants et accompagnants par période avec montant | oui |
| 247 (248) | Figure A05-4 · dépenses par élément de frais sur une période, total ; Figure A06 · écran « Liste des retraites » (Matricule, Nom, Prénoms, Date de naissance, Date de retraite) | oui |
| 248 (249) | Figure A06-1 · frais des accompagnants ; Figure A07 · de nouveau « Liste des retraites » | oui |
| 249 (250) | Figures A07-1, A07-2 · missions en cours | oui |
| 250 (251) | Figure A07-3 · « Voulez-vous notifier la mission comme accomplie ? » ; texte « B · Gestion des recrutements », qui décrit en fait la formation (voir § 1.2) | oui |
| 251 (252) | texte « C · Gestion des absences » · publicité de deux produits d'autres éditeurs (voir § 1.2) | sans capture |
| 252 (253) | même publicité ; « D · Gestion du personnel », nouvel employé en quatre onglets | sans capture |
| 253 (254) | immatriculation manuelle ou automatique, import d'un candidat ; « b · Classification », « c · Affectation », titres seuls | sans capture |
| 254 (255) | « d · Contrat », « Personne en charge », « Notification de rendements », « Liste des employés », « Liste des contractuels », « Dossier du personnel », titres seuls ; « E · Gestion des postes », texte d'un prestataire informatique (voir § 1.2) | sans capture |
| 255 (256) | suite de ce texte ; « F · Gestion des mouvements » (Nouvelle affectation, Nouveau poste, Plan de carrière, titres seuls) ; « G · Gestion des formations » | sans capture |
| 256 (257) à 260 (261) · texte | formateurs, catalogue, planning (création, mise à jour, annulation, validation) · le folio 259 et le folio 260 recopient la création sous le titre de la mise à jour | sans capture (cinq folios) |
| 261 (262) | Figure G-00 · menu Formation (Formateur, Formation, Planning formation, Clôture de formations, Réorientation, Liste formations) sur une fiche d'employé d'une version antérieure (Plan carrière obligatoire) ; Figure G-01 · formateur (Nature · consultant, société, individu) | oui |
| 262 (263) | Figure G01-0 · données de base d'une version antérieure (dont Type sanction, Mode de calcul d'élément variable, Statut d'affectation, Type de déduction, Plan de carrière) ; menu Structure de bases, Traitement Retenue, Traitements de la paie, Session, Comptabilité, États, Statistiques ; Figure 01-1 · confirmation | oui |
| 263 (264) | Figures 01-2, 01-3 · enregistrement d'un formateur | oui |
| 264 (265) | Figures 01-4, 01-5 · modification | oui |
| 265 (266) | Figures 01-6, 01-7 · suppression demandée | oui |
| 266 (267) | Figures 01-8, 01-9 · suppression faite | oui |
| 267 (268) | Figure G02 · catalogue de formation (Catégorie, Libellé, Compétence, Formateur, Nombre maximal de participants) ; Figure G02-0 · compétences (liste des données de base, dont « Période d'essai ») ; « H · Gestion des stages » puis « Remarque : », sans contenu | oui |
| 268 (269) | Remarque d'ergonomie (astérisque rouge, zones grisées, listes déroulantes) ; tableau dont seule la ligne « Onglet » est remplie | sans capture |
| 269 (270) | Chapitre 6, Module Paie · données de base (hors de cette section) | oui |
| 270 (271) | Allocation, Barème d'imposition (Min, Max, Taux, « Montant TCS ») (hors de cette section) | oui |

Aucun folio de 166 à 270 n'est resté non lu.

#### 1.2 Ce que le manuel ne dit pas, ou dit de travers

- **Trois sections recopient le texte publicitaire d'AUTRES éditeurs.**
  « C · Gestion des absences » (M p. 251-252) décrit « Workforce Absence
  Manager™ » et « So'Horsys » (compteurs de RTT et de CET, demandes à
  l'heure, synchronisation Outlook®, application mobile, délégation du
  manager) ; « E · Gestion des postes » (M p. 254-255) décrit la gestion des
  postes de travail INFORMATIQUES de « Fujitsu Canada ». Aucune de ces
  fonctions n'est prêtée à Microfina++ ici · elles sont classées **hors champ**
  et ne servent pas de comparaison.
- **Des menus sans un mot** · Sanction, Retraite, Statistiques (M p. 166),
  Stage (titre seul, M p. 267 ; seules ses données de base, M p. 176-177),
  Plan de carrière, Nouveau poste (M p. 255), Réorientation (M p. 261,
  capture), préavis et période d'essai (M p. 237, capture d'une version
  antérieure). La « Liste des retraites » n'est connue que par deux captures
  prises par erreur sous la légende des frais de mission (M p. 247, 248).
- **Des légendes et textes faux** · pièces à fournir décrites comme la
  situation matrimoniale (M p. 173) ; véhicule utilisé décrit comme un montant
  (M p. 180) ; recherche multicritère décrite comme la notation de rendement
  (M p. 209) ; « Gestion des recrutements » décrite comme la formation (M
  p. 250) ; deux onglets de la liste des missions sous la même description
  (M p. 235).
- **Le paramétrage n'est pas congolais** · la base de démonstration est celle
  d'un fonds togolais (Lomé, zones CEDEAO et UEMOA, « 1 000 000 XOF », M
  p. 220), et le titre de congé imprimé dit « conformément à l'article 158 du
  code du travail » (M p. 214). Au Code du travail de la RDC (loi n° 015/2002
  modifiée par la loi n° 16/010), l'article 158 porte le règlement
  d'entreprise (« Le contenu, les modalités de communication, de dépôt et
  d'affichage du règlement d'entreprise sont fixés par arrêté »), et le congé
  annuel les articles 140 et suivants (compétence `droit-travail-congolais`,
  `references/texte-loi-verbatim/06-titre-vi-des-conditions-generales-de-travail.md`).
  Un cabinet congolais qui imprimerait ce titre tel quel citerait un article
  faux.
- **Aucune règle de calcul n'est décrite** · le crédit de congés (« 30
  jours », M p. 212), la retenue sur salaire d'une absence constatée (montant
  saisi, M p. 218), la prime d'ancienneté (taux saisi, M p. 206), le barème
  des frais de mission (montant saisi par catégorie, classe, échelon et zone,
  M p. 179) sont des SAISIES. Le manuel ne dit pas d'où vient la valeur.

---

### 2. Tableaux par sous-module

#### 2.1 Structure du module et données de base générales (M p. 166 à 174)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Module GRH à part, menus Recrutement, Personnel, Affectation, Absence, Sanction, Formation, Stage, Mission, Retraite, Statistiques | 166 | partiel | fenêtre Personnel, onglets `registre`, `confrontation`, `effectif`, `simulation`, `bulletins`, `conges`, `absences`, `rubriques`, `baremes`, `decompte`, `livre` (`client/src/lib/onglets-personnel.ts`) | OmegaX tient le REGISTRE et la PAIE ; ni recrutement, ni évaluation, ni formation, ni mission |
| Centre de coût et type de centre de coût du personnel | 169 | partiel | ventilation analytique de la paie, par salarié et par plan, versions par mois (`src/modules/personnel/ventilation-analytique-paie.ts`, `repartitions-analytiques-paie.service.ts`) | OmegaX ventile la CHARGE au journal ; Microfina rattache l'employé |
| Civilités | 169 | non | `model Salarie` n'a pas de civilité (`prisma/schema.prisma`) | sans enjeu ; le sexe est porté (`SexeTravailleur`) |
| Type d'employé (ouvrier, cadre, permanent, saisonnier…) | 170 | partiel | type de contrat (`enum TypeContratTravail` · durée déterminée, indéterminée, au jour le jour, apprentissage), `ContratTravail.emploiPermanent`, `categorieProfessionnelle` libre, `classeProfessionnelle` 1 à 17 (`prisma/schema.prisma`) | OmegaX lit le TYPE dans le Code (art. 40 à 45), pas dans une liste libre |
| Fonction d'employé, profession | 171, 169 | partiel | `ContratTravail.natureTravail`, texte libre (art. 212, point 8) | aucune table de fonctions |
| Situation matrimoniale | 172 | partiel | `Salarie.nomConjoint` (art. 212, point 7) | OmegaX ne porte que ce que l'art. 212 énonce · le manuel laisse des doublons dans la liste (M p. 172) |
| Pièces à fournir (catalogue) | 173 | partiel | pièces jointes du salarié, type lu dans les octets, 5 Mo (`src/modules/personnel/pieces-jointes-salarie.ts`, `src/common/pieces-jointes/`) | aucune liste de pièces EXIGÉES par dossier |
| Lieu de naissance rattaché à un pays | 173 | partiel | `Salarie.lieuNaissance`, `nationalite`, texte libre (art. 212, point 6) | |
| Groupe sanguin | 169, 201, 210 | non, voulu | `model Salarie` ne le porte pas | donnée relative à la santé · voir § 4.2 |

#### 2.2 Données de base de la GRH (M p. 174 à 181)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Critères d'évaluation, points prévus, types | 174 | non | · | aucune évaluation dans OmegaX |
| Motifs et types d'affectation | 175 | non | · | |
| Motifs d'absence paramétrés (déductible ou non, permission ou absence, exceptionnelle ou non, durée réglementaire, maximum, crédit, justification) | 175 | oui, autrement | treize causes FERMÉES, chacune son régime lu au Code (art. 57, 59, 93, 105, 106, 130, 146 ; `src/modules/personnel/absences.ts`), catalogue servi (`GET /personnel/absences/catalogue`, `absences.controller.ts`) | OmegaX ne laisse pas l'utilisateur décider qu'une absence est « déductible » · le texte le dit |
| Catégories, compétences, destinations, motifs de formation | 176 | non | · | |
| Domaines, niveaux et types de stage | 176, 177 | non | · | |
| Éléments de frais de mission, motifs, moyens de transport, zones | 178 à 181 | non | · | les comptes existent au plan semé · 63840000 « Missions » et 61810000 « Voyages et déplacements » aux deux plans (`src/modules/comptes/compte-seed.ts` l. 863 et 931, `compte-seed-syscohada.ts` l. 1088 et 1172) |
| Barème des frais de mission par catégorie, classe, échelon et zone | 179, 229 | non | · | un forfait n'est pas un remboursement · voir § 3, idée 1 |
| Véhicules utilisés (immatriculation, modèle, assuré) | 180 | non | · | aucun registre de véhicules ; un véhicule de l'entité est une immobilisation (`src/modules/immobilisations/`) sans suivi d'usage |

#### 2.3 Paramètres de paie rangés dans la GRH (M p. 181 à 187)

Comparés en détail par `paie-microfina-omegax.md`. Ici, ce que les captures
ajoutent.

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Allocation familiale (nombre de personnes, taux, limite d'assurance, montant trimestriel) | 181 | partiel | allocations au taux de la colonne 19 du décret n° 25/22, enfants bénéficiaires (`src/modules/personnel/bareme-smig.ts`, `assiettes-paie.ts`) | Microfina saisit un taux et un montant ; OmegaX calcule sur le texte |
| Barème d'impôt saisi (minimum, maximum, taux) | 182 | oui, autrement | barème de l'art. 118 de la loi n° 23/053 réservé à OmegaX (`src/modules/personnel/bareme-irpp.ts`, `baremes-dossier.ts`) | un barème saisi par l'utilisateur peut être faux sans que rien ne le dise |
| Catégorie, classe, échelon, grille salariale (salaire, points) | 182 à 185 | partiel | `classeProfessionnelle` 1 à 17 du décret n° 25/22, minimum de la classe (`regles-contrat-travail.ts`), `categorieProfessionnelle` libre | aucune grille propre au dossier ni échelon |
| Grandes familles, grandes rubriques (imposable ou non) | 184 | oui, autrement | rubriques de paie, la NATURE (art. 7, point 8) décide les assiettes (`src/modules/personnel/rubriques-paie.ts`, `assiettes-paie.ts`) | OmegaX refuse qu'une rubrique se dise non imposable par choix |
| Types d'avance avec compte (422000) | 185 | oui | `src/modules/personnel/avances-salaire.ts`, comptes par type | |
| Types d'heure supplémentaire (taux) | 186 | oui | taux déclaré avec sa source, aucun au corpus (`src/modules/personnel/heures-majorees.ts`, `majorations-heures.controller.ts`) | |
| Types de retenue avec compte · CNSS au 6610043 | 187 | oui, autrement | parts ouvrière et patronale aux 431x et 6641, retraite obligatoire au 43130000 ou 43210000 (`src/modules/personnel/passation-paie.ts`) | la capture rattache une retenue SOCIALE à un compte de CHARGE de rémunération · signalé, non jugé (paramétrage de démonstration) |

#### 2.4 Recrutement (M p. 187 à 200)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Création d'un emploi (poste, direction, service, modèle de contrat, qualifications, état, poste sensible) | 187, 188 | non | · | aucune table de postes ni d'organigramme |
| Liste des postes, vacants ou non | 188 | non | · | |
| Avis de recrutement (dates, adresse de dépôt, postes) et impression | 189, 192, 194 | non | · | aucun texte lu n'oblige à publier un avis |
| Critères requis par poste, éliminatoires | 190, 191 | non | · | |
| Pièces exigées par avis, éliminatoires | 192, 193 | non | · | |
| Dossier de candidature, candidat interne ou externe | 194, 195 | non | · | |
| Vérification du dossier (pièces et critères présents) | 196 | non | · | |
| Délibération, appréciation et note | 196, 197 | non | · | |
| Classement par ordre de mérite | 198 | non | · | |
| Liste des dossiers délibérés | 199 | non | · | |
| Clôture ou annulation d'un avis | 199, 200 | non | · | |
| Import d'un candidat retenu dans la fiche de l'employé | 201, 253 | non | · | |

#### 2.5 Personnel · la fiche, les listes, le dossier (M p. 200 à 211 ; 252 à 254)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Fiche de l'employé · identité, sexe, nom, prénoms, nationalité, date et lieu de naissance, N° de sécurité sociale | 201 | oui | `model Salarie` (nom, postNom, prenoms, sexe, numeroAffiliationCnss, dateNaissance ou millesimeNaissance, lieuNaissance, nationalite), confrontation aux quinze énonciations de l'art. 212 (`GET /personnel/confrontation`, `personnel.controller.ts`) | OmegaX porte le post-nom, que le Code exige (art. 212, point 3) et que Microfina n'a pas |
| Matricule manuel ou automatique | 201, 253 | partiel | `Salarie.matricule`, facultatif, unique par dossier, refus nommé d'un doublon (`personnel.service.ts`, `verifierMatriculeLibre`) | aucune numérotation automatique ; le Code dit le numéro d'ordre « éventuel » (art. 212, point 4) |
| Adresse, contacts, email, BP, personne à prévenir, profession, photo | 201 | non, voulu | `model Salarie` ne les porte pas | voir § 4.2 |
| Date de début de carrière, date d'embauche | 201 | partiel | date d'entrée en vigueur du contrat (`ContratTravail.dateEntreeEnVigueur`), chaîne des renouvellements (`renouvelleDeId`) | aucune « carrière » antérieure |
| Personnes à charge (nom, prénoms, naissance, conjoint, employé, enfant propre) | 203, 254 | partiel | `model EnfantACharge`, `Salarie.nomConjoint` ; personnes à charge PROPOSÉES à l'impôt (loi n° 23/053, art. 124 et 125) | OmegaX ne marque pas « enfant employé » ni « conjoint employé » |
| Diplômes (date d'obtention, diplôme de base actif) | 204, 205 | non | · | |
| Classification · catégorie, classe, échelon, salaire de base au point, sursalaire | 206 | partiel | `classeProfessionnelle`, `remunerationBase`, `periodiciteRemuneration`, `deviseRemuneration` (`ContratTravail`) | OmegaX confronte le contrat au minimum de sa classe (`regles-contrat-travail.ts`) ; Microfina ne le fait pas, d'après le manuel |
| Ancienneté acquise · taux et montant de prime d'ancienneté, congés dus | 206 | partiel | ancienneté et tranche de l'art. 141 pour les congés (`src/modules/personnel/conges-acquis.ts`) ; une prime d'ancienneté n'est qu'une rubrique de nature PRIME (`assiettes-paie.ts`) | aucun calcul de prime d'ancienneté · aucun texte lu ne la fixe |
| Onglets Affectation et Contrat de la fiche ; bouton « Visualiser le contrat » | 201, 253, 254 | partiel | contrat de travail, renouvellement, fin, monnaie (`POST /personnel/salaries/:salarieId/contrats`, `contrats/:contratId/fin`, `personnel.controller.ts`) | les deux onglets ne sont ni décrits ni montrés ; OmegaX n'imprime pas de contrat |
| Recherche d'un employé (matricule, nom, N° CNSS) | 202 | partiel | registre en liste bornée, filtres inactifs et « à compléter » (`personnel.service.ts`, `lister`) | |
| Liste des employés, export, répartition par sexe | 209 | partiel | effectif à une date, hommes, femmes, permanents, nationaux (`src/modules/personnel/effectif-registre.ts`, `GET /personnel/effectif`) | pas d'export du registre |
| Liste des contractuels (type de contrat, dates) | 208, 209 | partiel | contrats à durée déterminée, date de fin prévue, requalifications des art. 40 à 45 rendues (`regles-contrat-travail.ts`) | aucune liste des fins de contrat à venir · voir § 3, idée 5 |
| Recherche multicritère (agence, service, poste, régime, nationalité, groupe sanguin…), sortie « Coût salariaux » | 210 | non | · | voir § 4.2 pour le critère groupe sanguin |
| Dossier du personnel (mouvements, absences, sanction, formation, mission) | 211 | partiel | registre, absences, congés, bulletins et pièces jointes par salarié, sous les droits du registre | rien sur les mouvements, sanctions, formations, missions |
| Mise à jour des contrats, demande de préavis, période d'essai, durées paramétrées | 237 (capture) | oui, autrement | clause d'essai plafonnée et réduite de plein droit (art. 43, `verdictEssai`), durée du préavis (art. 212, point 12 ; `ContratTravail.dureePreavisJours`), préavis du décompte final (art. 63 à 67, `decompte-final.ts`) | connu seulement par la capture d'une version antérieure ; OmegaX lit les durées dans le Code, sans paramètre |
| Déclarations d'engagement et de départ | · | oui (OmegaX seul) | `declarationEngagementLe`, `declarationDepartLe`, échéance de quinze jours (art. 217, `regles-contrat-travail.ts`, `declarationsDues`) | absent du manuel |

#### 2.6 Évaluation du personnel (M p. 174, 206 à 208)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Critères techniques associés à un poste | 206, 207 | non | · | |
| Notation de rendement (évaluateur, période, points par critère, total, commentaire, impression) | 208 | non | · | aucun texte lu ne l'impose ; données de la personne (§ 4.2) |
| « Notification de rendements » | 254 | non | · | titre seul |

#### 2.7 Affectations et mouvements (M p. 175, 211, 212, 255)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Affectation (référence, direction, poste, agence, type, motif, dates, ancien occupant, impression) | 211 | non | · | le lieu d'exécution est une énonciation du contrat (art. 212, point 10 ; `ContratTravail.lieuExecution`), sans historique |
| Liste et historique des affectations | 212 | non | · | |
| Nouvelle affectation, nouveau poste, plan de carrière | 255 | non | · | titres seuls |

#### 2.8 Absences et congés (M p. 175, 212 à 218)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Planification de congés (dates, jours ouvrables, exercice, crédit de l'exercice, crédit restant) | 212, 213 | oui | compteur par période annuelle de date à date, droits nés à l'expiration de l'année (art. 140, al. 3), jours par l'art. 141, solde, congé au-delà du solde DIT (`src/modules/personnel/conges-acquis.ts`, `conges.service.ts`, `client/src/components/paie/CongesPaie.tsx`) | Microfina montre un crédit fixe de « 30 jours » ; OmegaX le calcule |
| Édition du titre de congé | 213, 214 | non | · | le modèle du manuel cite un article qui n'est pas celui du congé en RDC (§ 1.2) |
| Demande d'autorisation d'absence (durée, motif, description) | 214, 215 | partiel | absence enregistrée par le cabinet, nature, pièce, observation, demi-journées (`model AbsenceSalarie`, `POST /personnel/salaries/:salarieId/absences`) | pas de DEMANDE · OmegaX n'a aucun accès du salarié |
| Absences en attente de validation, traitement (accordée, rejetée), demandes traitées | 215, 216 | non | · | aucun circuit de validation · voir § 3, idée 3 |
| Annulation d'une demande | 216, 217 | oui | annulation motivée d'une absence ou d'un congé (`POST /personnel/absences/:id/annulation`, `conges/:id/annulation`) | |
| Absence constatée, justifiée ou non, retenue sur crédit de congés ou sur salaire, montant saisi | 217, 218 | oui, autrement | `ABSENCE_NON_AUTORISEE` non payée (art. 93), proposée au bulletin, jamais substituée (`absences.ts`) ; un mois qui contient un jour hors service n'est pas un mois entier de service (art. 141, al. 2, `conges-acquis.ts`) | OmegaX calcule la retenue ; Microfina fait saisir un montant |
| Rapport de base (permissions, absences constatées, planification, restauration des jours dus ; filtres) | 218 | partiel | absences et congés par salarié et par mois (`GET /personnel/salaries/:salarieId/absences/mois/:mois`, `conges/du-mois/:mois`) | aucune édition transversale à tout le dossier |
| Indemnités de la Caisse sur un arrêt | · | oui (OmegaX seul) | `IndemniteCaisseAbsence`, déduite ou subrogée (arrêté n° 146/2018, art. 139, `absences.controller.ts`) | absent du manuel |

#### 2.9 Formation (M p. 176, 218 à 225, 255 à 267)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Formateurs (raison sociale, nature interne, consultant, société, individu, contacts) | 218, 219, 256, 261 à 266 | non | · | un formateur externe est un fournisseur du plan des tiers (`src/modules/tiers/`), sans autre qualité |
| Catalogue de formation (catégorie, libellé, compétence, formateur, nombre maximal de participants) | 256, 257, 267 | non | · | |
| Planning de formation (employé, catégorie, cabinet, financement, lieu, dates, thème, coût estimatif, participants) | 219, 258 à 260 | non | · | voir § 3, idée 2 |
| Mise en œuvre (motif, lieu, destination, dates, coût, autres frais), participants | 220, 221 | non | · | la liste des participants affiche le N° CNSS (§ 4.2) |
| Mise à jour, annulation, validation, clôture d'une formation | 221 à 225 | non | · | |
| Suivi de réalisation, prévu contre réel | 224 | non | · | |
| Réorientation, liste des formations | 261 (capture) | non | · | menu seul |
| Éditions annoncées · contrats de formation, attestations et fiches de présence, fiches d'évaluation, programmes | 255 | non | · | annoncées, jamais montrées |

#### 2.10 Missions (M p. 178 à 181, 225 à 250)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Ordre de mission (durée, dates et heures, motif, lieux, destination, moyen de transport, véhicule) et son impression | 225, 231, 237 | non | · | voir § 3, idée 1 |
| Participants, frais par élément, frais supplémentaires, total | 226, 232, 238, 239 | non | · | |
| Accompagnants externes (nom, sexe, téléphone), création, suppression | 226, 232, 233, 241 à 244 | non | · | personnes extérieures à l'entité (§ 4.2) |
| Frais de mission des accompagnants | 227, 235, 236, 248 | non | · | |
| Véhicules en mission, libération du véhicule | 228 | non | · | |
| Notification de fin de mission | 228, 236, 249, 250 | non | · | |
| Liste des missions par période, en cours ou accomplies | 230, 234, 245 | non | · | |
| Missionnaires et frais par période ; dépenses par élément de frais ; dépenses par mission | 234 à 236, 246, 247 | non | · | |
| Export en PDF, Excel, HTML, RTF, XML, CSV | 235, 246 | partiel | exports en flux des livres et des balances (`src/modules/exports/`) | rien pour le personnel |
| Comptabilisation des frais de mission (absente du manuel) | · | partiel | saisie ordinaire au 63840000 ou au 61810000 ; la TVA qui les grève n'ouvre pas droit à déduction (`src/modules/tva/taux-tva.service.ts`, `EXCLUSIONS_ART_41`, O.-L. n° 10/001, art. 41, 1°) | le manuel ne relie la mission à aucune écriture |

#### 2.11 Stages, sanctions, retraite, statistiques (M p. 166, 176, 177, 247, 248, 267)

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Gestion des stages | 267 | non | contrat d'APPRENTISSAGE seulement comme type de contrat (`TypeContratTravail.APPRENTISSAGE`) | le manuel n'en donne que le titre |
| Sanctions disciplinaires | 166, 211, 262 (captures) | partiel | la MISE À PIED est une cause de suspension, refusée au-delà de quinze jours de calendrier par mesure (art. 57, 5° ; `absences.ts`, `MISE_A_PIED_JOURS_AU_PLUS`) ; faute lourde au décompte final (art. 72, `decompte-final.ts`) | menu et type de sanction vus, jamais décrits |
| Liste des retraites (date de retraite) | 247, 248 (captures) | non | · | capture seule, sous une légende fausse |
| Statistiques | 166 (capture) | partiel | effectif par sexe et nationalité (`effectif-registre.ts`) | menu seul |

#### 2.12 Hors champ

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Compteurs de RTT, CET, heures de récupération, synchronisation Outlook®, application mobile, délégation du manager | 251, 252 | hors champ | · | texte publicitaire de « So'Horsys » et « Workforce Absence Manager™ », pas une fonction de Microfina++ |
| Gestion et virtualisation des postes de travail informatiques | 254, 255 | hors champ | · | texte de « Fujitsu Canada » |

#### 2.13 Décompte par légende

Sur les **89 lignes** des tableaux 2.1 à 2.12 · **oui** 13 (dont 6 « oui,
autrement », où OmegaX tient la fonction par une autre règle, et 2 fonctions
d'OmegaX absentes du manuel), **partiel** 24 (dont la comptabilisation des
frais de mission, absente du manuel), **non** 50 (dont 2 « non,
voulu »), **hors champ** 2. Fonctions tirées du manuel · 86 · oui 11, partiel 23, non 50, hors champ 2.

---

### 3. Fonctions utiles à OmegaX

Toutes seraient des fonctions NOUVELLES, sous le gel (CLAUDE.md § 5). Rangées
par utilité pour le cabinet et ses clients. « Obligatoire » n'est écrit que
lorsqu'un texte LU l'impose ; sinon la fonction est dite utile, sans plus.

1. **Missions et frais de mission** (M p. 178 à 181, 225 à 250) · ordre de
   mission numéroté et imprimé, participants et accompagnants, frais par
   élément, état des dépenses par mission et par élément sur une période, et
   ce que le manuel ne fait pas · la pièce comptable proposée au 63840000
   « Missions » ou au 61810000 « Voyages et déplacements », semés aux deux
   plans, la ventilation analytique par projet ou bailleur. Pour une ONG à
   projets, c'est la dépense de personnel la plus contrôlée après les
   salaires. **Aucun texte lu n'impose un ordre de mission.** Deux textes lus
   en bornent le traitement · le Code du travail exclut de la rémunération
   « les frais de voyage ainsi que les avantages accordés exclusivement en vue
   de faciliter au travailleur l'accomplissement de ses fonctions » (art. 7,
   point 8, `texte-loi-verbatim/01-titre-i-des-dispositions-generales.md`) ;
   la loi n° 23/053 rend imposables « les traitements, salaires, émoluments,
   indemnités qui ne représentent pas le remboursement de dépenses
   professionnelles effectives » (art. 68, 1°, compétence `fiscalite-rdc`,
   `code-general-2026/references/05-loi23-053-titre3-irpp.md`). Un barème
   FORFAITAIRE par catégorie et par zone, comme celui du manuel (M p. 179),
   est donc une question de qualification à poser au cabinet, jamais un
   remboursement présumé. La TVA qui grève hébergement, restauration et
   transport n'ouvre pas droit à déduction (O.-L. n° 10/001, art. 41, 1°,
   `code-general-2026/references/10-tva-ol10-001-loi-base-ch1-10.md`),
   qu'OmegaX applique déjà au 6384 et au 6181.

2. **Plan et suivi de la formation** (M p. 218 à 225, 255 à 267) ·
   formateurs, catalogue, planning avec coût estimatif et financement (fonds
   propres ou bailleur), participants, réalisation contre prévision, coût
   réel au 63300000 (« Frais de formation » au SYCEBNL, « Frais de formation
   du personnel » au SYSCOHADA, `compte-seed.ts` l. 916,
   `compte-seed-syscohada.ts` l. 1155). **Une obligation lue** · « Tout
   employeur public ou privé a l'obligation d'assurer la formation, le
   perfectionnement ou l'adaptation professionnelle des travailleurs qu'il
   emploie » (Code du travail, art. 8,
   `texte-loi-verbatim/02-titre-ii-de-la-formation-et-du-perfectionnement-professionnels.md`).
   Et un usage direct pour la paie d'OmegaX · « dans le cas où l'employeur
   assure lui-même la formation de son personnel, le département du Travail
   et de la Prévoyance sociale peut accorder une réduction du taux » de la
   cotisation INPP, au plus du quart, sur avis de la délégation syndicale et
   de l'INPP (ordonnance n° 84/186, art. 1er, al. 2,
   `smig-cotisations-textes-application/ordonnance-84-186-inpp-modalites-paiement.md`).
   OmegaX déclare déjà cette réduction avec son acte
   (`src/modules/personnel/cotisations-paie.ts`,
   `src/modules/retenues/inpp-trimestriel.ts`) ; le suivi des formations
   serait la pièce du dossier de demande. Les attestations de présence
   annoncées (M p. 255) n'ont été montrées nulle part.

3. **Demande d'absence ou de congé et son circuit de validation** (M p. 214
   à 217) · demande datée, attente, accord ou rejet par un second
   utilisateur, annulation, liste des demandes traitées. OmegaX enregistre ce
   que le cabinet déclare, sans trace de l'accord. **Aucun texte lu n'impose
   le circuit**, mais l'art. 140, al. 4 veut que « la date du congé [soit]
   fixée de commun accord » (`texte-loi-verbatim/06-titre-vi-des-conditions-generales-de-travail.md`) ·
   un accord daté et nommé en est la preuve. Le modèle serait celui du visa
   des RIB (`src/modules/tiers/visa-rib.ts`), auteur et validateur distincts.
   L'**édition du titre de congé** (M p. 213, 214) en serait la suite, sur le
   congé d'OmegaX, en citant les art. 140 et 141 et non l'« article 158 » du
   modèle.

4. **Déclaration annuelle de la main-d'œuvre, à partir de la répartition par
   sexe et des statistiques** (M p. 209, 166) · OmegaX compte déjà l'effectif
   par sexe et par nationalité (`effectif-registre.ts`). **Une obligation
   lue** · « Toute entreprise ou tout établissement fait parvenir, au moins une
   fois par an, [...] une déclaration sur la situation de la main-d'œuvre
   nationale et étrangère employée. En outre, l'entreprise ou l'établissement
   fournit chaque année son bilan social » (Code du travail, art. 218,
   `texte-loi-verbatim/10-titre-x-des-moyens-de-controle.md`). Les
   modalités relèvent d'un arrêté (art. 219) absent du corpus · OmegaX ne
   pourrait servir que les chiffres, en le disant, jamais le formulaire.

5. **Échéancier des contrats · fins de contrat à durée déterminée et fins de
   période d'essai** (M p. 208, 209, liste des contractuels ; M p. 237,
   période d'essai et préavis en capture) · OmegaX contrôle déjà la clause
   d'essai et les requalifications, mais ne liste pas ce qui arrive à terme.
   **Une conséquence lue** · « La prolongation des services au-delà de cette
   durée maximale entraîne automatiquement la confirmation du contrat de
   travail » (art. 43, al. 4) ; un CDD pour un emploi permanent est « réputé
   conclu pour une durée indéterminée » (art. 42), tous deux dans
   `texte-loi-verbatim/04-titre-iv-du-contrat-de-travail.md`. L'échéancier
   dirait la date avant qu'elle ne passe, comme `declarationsDues` le fait
   pour l'art. 217.

6. **Historique des affectations** (M p. 211, 212) · poste, service, lieu,
   dates. Le lieu d'exécution et la nature du travail sont des énonciations
   du contrat (art. 212, points 8 et 10), qu'OmegaX porte sans historique ;
   l'historique servirait aussi la ventilation analytique de la paie, dont
   les versions sont par mois. Utile, aucune obligation lue au-delà de
   l'art. 212.

7. **Liste des départs à la retraite** (M p. 247, 248, captures) · « Le droit
   à la pension de retraite s'ouvre à l'âge de soixante ans » (loi n° 16/009,
   art. 82, compétence `cnss-cotisations-sociales-rdc`,
   `references/loi-16-009-2016-regime-general-securite-sociale.md`). Une
   liste des salariés qui l'atteignent, tirée de la date de naissance du
   registre, préparerait les décomptes. Information seulement ; le texte lu
   n'oblige pas l'employeur à la tenir.

8. **Registre des sanctions disciplinaires** (menu Sanction, M p. 166, 211,
   262, captures) · OmegaX ne tient que la mise à pied, comme absence. Le
   règlement d'entreprise porte la discipline et « toutes les autres clauses
   [...] notamment celles prévoyant des amendes à l'encontre des travailleurs,
   seront considérées comme nulles de plein droit » (art. 157) · un registre
   devrait refuser toute sanction pécuniaire. Faible priorité.

9. **Recrutement, évaluation, stages** (M p. 174, 187 à 200, 206 à 208, 267)
   · aucun texte lu ne les impose, et ils feraient entrer dans OmegaX des
   données de candidats et d'appréciations sans lien avec la comptabilité.
   **Non recommandés** pour un logiciel comptable ; notés pour mémoire.

---

### 4. Mieux fait d'un côté ou de l'autre

#### 4.1 Mieux fait dans le manuel

- **Le cycle de la mission, de l'ordre à la clôture** (M p. 225 à 250) ·
  OmegaX n'en a aucun ; seule la passation de la dépense existe.
- **Le cycle de la formation** (M p. 218 à 225) · planning, réalisation,
  prévu contre réel ; OmegaX n'a rien.
- **Un circuit de demande et de validation des absences** (M p. 214 à 217),
  même sommaire ; OmegaX n'a qu'une saisie par le cabinet
  (`absences.controller.ts`, `conges.controller.ts`).
- **Des éditions de liste** (liste des contractuels, liste du personnel avec
  export, missions par période en six formats, M p. 209, 246) ; le registre
  d'OmegaX ne s'exporte pas (`client/src/pages/PersonnelPage.tsx` n'a aucun
  export du registre).
- **La numérotation automatique du matricule** (M p. 253) ; OmegaX le laisse
  à la main (`personnel.service.ts`).
- **Un écran par sujet dans un module à part**, que le gestionnaire des
  ressources humaines reconnaît ; OmegaX range tout sous une fenêtre à onze
  onglets (`client/src/lib/onglets-personnel.ts`).

#### 4.2 Mieux fait dans OmegaX

- **La règle vient du texte, pas d'une saisie.** Le régime de chaque
  absence est lu au Code, treize causes fermées (`absences.ts`) ; Microfina
  fait choisir « déductible sur salaire » ou non (M p. 175) et saisir le
  montant de la retenue (M p. 218). Les droits à congé sont calculés de date
  à date (`conges-acquis.ts`), là où Microfina affiche un crédit de « 30
  jours » sans source (M p. 212). La clause d'essai est réduite de plein droit
  au plafond de l'art. 43 (`regles-contrat-travail.ts`, `verdictEssai`) ; la
  mise à pied refusée au-delà de quinze jours (art. 57, 5°). Le barème d'impôt
  et le minimum de la classe ne se saisissent pas (`bareme-irpp.ts`,
  `bareme-smig.ts`), quand le manuel les fait saisir (M p. 182, 185).
- **Le registre suit l'art. 212** (quinze énonciations, post-nom, aptitude
  médicale, `GET /personnel/confrontation`) et les déclarations de
  l'art. 217 sont échéancées (`declarationsDues`) ; le manuel n'en dit rien.
- **La donnée est minimale, et la loi le demande** · « Les données à
  caractère personnel collectées doivent être fiables, adéquates,
  pertinentes, exactes, intègres et non excessives » (ordonnance-loi n° 23/10
  du 13 mars 2023 portant Code du numérique, art. 194, compétence
  `droit-numerique-ua-rdc-corpus`,
  `references/06-ordonnance-loi-23-10-code-numerique-rdc-2023/partie-2-transactions-donnees-p43-p121.md`).
  La fiche de Microfina recueille groupe sanguin, photo, adresse, contacts,
  personne à prévenir (M p. 201), et fait du **groupe sanguin un critère de
  recherche multicritère** (M p. 210). Une donnée « relative à l'état de
  santé » est interdite de traitement (art. 195, al. 1er) sauf exceptions,
  dont « le traitement nécessaire afin d'exécuter les obligations et les
  droits spécifiques du responsable du traitement en matière de droit du
  travail » (art. 195, al. 2, point 12) · aucune obligation lue du Code du
  travail ne demande le groupe sanguin. OmegaX ne le recueille pas.
- **Ce que le manuel expose plus largement que ne le ferait OmegaX** ·
  - la liste des participants d'une formation affiche le **N° CNSS** de
    chacun (M p. 221) · dans OmegaX ce numéro est masqué au journal d'audit
    (`src/common/audit/champs-audites.ts`, `Salarie`) ;
  - le **motif de l'absence** (« visite de conjoint à l'hôpital », « naissance
    au foyer », M p. 175, 215) circule dans les listes de demandes et le
    dossier du personnel · OmegaX masque la NATURE de l'absence, sa pièce et
    son observation au journal d'audit, que tout le dossier lit
    (`champs-audites.ts`, ligne sage-l5) ;
  - la sortie **« Coût salariaux »** de la recherche multicritère et l'export
    de la liste du personnel (M p. 209, 210), et la **notation de rendement**
    avec commentaire (M p. 208), ne sont rattachés à aucun droit dans le
    manuel · dans OmegaX la rémunération est masquée au journal d'audit
    (`ContratTravail`, `CongeSalarie`), le personnel est fermé à
    l'aide-comptable et ouvert au gestionnaire de paie cantonné
    (`@AccesRolesCantonnes({ aideComptable: false, gestionnairePaie: true })`,
    `personnel.controller.ts`, `absences.controller.ts`,
    `conges.controller.ts`, `pieces-jointes-salarie.controller.ts` ;
    `src/common/guards/roles-cantonnes.ts`), et le nom et le commentaire des
    pièces d'un salarié restent hors du journal d'audit
    (`champs-audites.ts`, `PieceJointeSalarie`) ;
  - le module enregistre des **personnes extérieures** (candidats externes,
    M p. 195 ; accompagnants avec sexe et téléphone, M p. 241) et les supprime
    d'un clic (M p. 243), sans dire combien de temps elles sont gardées.
  Remarque dans l'autre sens · OmegaX ouvre la LECTURE du registre au rôle
  « lecture seule » (`@Roles(... LECTURE_SEULE)` sur `GET
  /personnel/salaries`, `personnel.controller.ts`) ; c'est un choix existant,
  non comparé ici à Microfina, dont le manuel ne dit pas qui voit la GRH.
- **Le texte cité est juste** · OmegaX cite l'article qu'il applique ; le titre
  de congé du manuel cite l'art. 158, qui est en RDC celui du règlement
  d'entreprise (§ 1.2).
- **Ce qui n'existe que dans OmegaX** · déclarations de l'art. 217, aptitude
  provisoire à confirmer sous trois mois (art. 38, `aptitudeProvisoirePerimee`),
  indemnités de la Caisse sur un arrêt (`IndemniteCaisseAbsence`), effectif
  et part de main-d'œuvre locale pour l'accord-cadre (loi n° 004/2001,
  art. 37, `effectif-registre.ts`), décompte final (`decompte-final.ts`).

---

## Partie C · manuel Microfina++, pages 270 à 306 (Paie, Immobilisation, Stock), face à OmegaX

Audit sans décision, établi le 2026-10-25 sur la révision `90a226b` de `main`
d'OmegaX. Rien n'est codé ; toute idée du § 4 est une fonction NOUVELLE, sous
le gel des nouveautés (CLAUDE.md § 5). Il complète, et corrige au § 3,
`docs/comparaison-microfina/audit-complet-manuel-microfina.md` et
`docs/comparaison-microfina/paie-microfina-omegax.md` (branche
`travail/paie-microfina`).

**Source lue cette fois · le PDF lui-même**
(`Manuel_MICROFINA__Document_final.pdf`, 306 pages selon `pdfinfo`, ce qui
confirme le nombre que donnait la note de la CAMEC). Les 37 pages 270 à 306 ont
été lues en texte (extraction page par page) ET regardées en image, une par une ;
70 captures d'écran y ont été relevées champ par champ (les petites icônes de
bouton insérées dans une phrase ne sont pas comptées, sauf celle de la p. 279,
seule image de sa page). Deux zones ont été agrandies à 200 points par pouce
pour lire une grille coupée (p. 276).

**Pagination · le numéro de page du PDF n'égale PAS le folio imprimé, et le
folio n'est pas continu.**

| Pages du PDF | Folio imprimé en pied | Observation |
|---|---|---|
| 270 à 279 (Chapitre 6, Paie) | 269 à 278 | page du PDF = folio + 1 |
| 280 (Chapitre 7, Immobilisation, page d'ouverture) | aucun, ni en-tête MEDIASOFT ni pied | |
| 281 à 289 | 1 à 9 | la numérotation REPART à 1 |
| 290 à 303 (Chapitre 8, Stock) | 10 à 23 | suit celle de l'Immobilisation |
| 304 (tickets de valeur) | aucun, ni en-tête ni pied | |
| 305 et 306 | 1 et 2 | elle repart encore à 1 |

Les chapitres 7 et 8 ont donc été collés d'un autre document. La convention des
deux documents précédents (« M p. N » = folio imprimé) ne peut pas servir ici :
deux pages portent le folio 1, deux le folio 2. **Dans cette section, « M p. N »
désigne la page du PDF**, et la note de la CAMEC suit elle aussi la page du PDF
(ses « p. 275-279 », « 283-285 », « 287-288 » tombent exactement sur les pages du
PDF qui portent ces fonctions).

Légende des tableaux · reprise sans changement · **oui** : la fonction existe
dans OmegaX, vérifiée dans le code ; **partiel** : un équivalent existe, de
périmètre ou de sens différent ; **non** : rien, alors que la fonction servirait
une ASBL, une ONG ou une entreprise ; **hors champ** : propre à une COOPEC ou à
une IMF. Aucune fonction des pages 270 à 306 n'est hors champ.

---

### 1. Couverture, page par page

| M p. (PDF) | Folio | Contenu | Captures regardées |
|---|---|---|---|
| 270 | 269 | Chapitre 6 « Module Paie » ; 1. Structure de base, 2.1 Traitement de la paie ; liste des dix données de base ; début de (a) Allocation | 1 (liste : Allocation, Barème d'imposition, Catégorie Classe et Echelon, Grande famille d'élément, Grande rubrique d'élément, Grille salariale, Type d'avance, Type d'heure supplémentaire, Type de grille, Type de retenue) |
| 271 | 270 | (a) allocations familiales ; (b) barème d'imposition ; (c) catégorie | 2 |
| 272 | 271 | catégorie (A, B, C), classe (I à IV), début d'échelon | 2 |
| 273 | 272 | échelon (1, 2, 3, INDEF, 4) ; (d) grande famille d'élément ; début de (e) | 2 |
| 274 | 273 | (e) grande rubrique d'élément ; (f) grille de salaire | 2 |
| 275 | 274 | (g) type d'avance ; (h) type d'heure supplémentaire ; (i) type de grille | 2 |
| 276 | 275 | liste des types de grille ; (j) type de retenue (sans capture) ; 2.2 gestion des grilles | 2 |
| 277 | 276 | 2.3 gestion des états ; 1.3.1 signataires des états ; 2. Personnel, 2.1 nouvel employé (onglets Information général, Classification, Affectation) | 1 |
| 278 | 277 | fin du nouvel employé (onglet Contrat, modèle de contrat) ; 2.2 rubriques de paie ; 2.3 maquette de paie ; 2.4 liste des employés ; 3. Traitement des retenues, 3.1 mise en place, 3.2 liste | 0 (texte seul) |
| 279 | 278 | bouton « Liste des retenues sur salaire » ; 3.3 visa des retenues, en deux puces ; le reste de la page est BLANC, et le chapitre s'arrête là | 1 (le bouton) |
| 280 | · | Chapitre 7 « Module Immobilisation » ; interface principale ; début des données de base | 1 (menus et palette) |
| 281 | 1 | type d'immobilisation ; utilisation de bien | 2 |
| 282 | 2 | coefficient de dégressivité ; catégorie de biens | 2 |
| 283 | 3 | famille de biens ; localisation des biens | 2 |
| 284 | 4 | création de bien ; affectation de biens | 2 |
| 285 | 5 | transfert par bien ; transfert d'un employé à un autre | 2 |
| 286 | 6 | libération d'un bien ; amortissement d'un bien | 2 |
| 287 | 7 | inventaire des biens ; sortie du patrimoine (texte seul) ; rapport des biens par localisation | 2 |
| 288 | 8 | liste des inventaires ; simulation du tableau d'amortissement | 2 |
| 289 | 9 | état de suivi des biens (transferts) ; recherche multicritère des biens acquis | 2 |
| 290 | 10 | Chapitre 8 « Module Stock » ; page principale ; famille de produit ; titre « 1.2 Client » | 2 |
| 291 | 11 | client ; magasin (deux captures) ; titre de l'affectation des magasins | 3 |
| 292 | 12 | affectation d'un magasin à un utilisateur ; produit | 2 |
| 293 | 13 | initialisation du produit ; alerte du stock ; génération de code-barres | 3 |
| 294 | 14 | code-barres par produit, étiquette imprimée | 2 |
| 295 | 15 | code-barres par lots de produits | 1 |
| 296 | 16 | planche d'étiquettes ; 3. Saisies, 3.1 expression des besoins | 2 |
| 297 | 17 | expression des besoins (suite) ; commande interne ; titre « Lancement de la commande » | 2 |
| 298 | 18 | commande client ; demande de fourniture (commande interne) | 2 |
| 299 | 19 | livraison fournisseur ; livraison interne | 2 |
| 300 | 20 | vente de produit ; règlement des commandes clients | 2 |
| 301 | 21 | migration entre magasins ; Traitement, visualisation du stock | 2 |
| 302 | 22 | régularisation du stock ; Statistique, consommation sur une année | 3 (la deuxième reprend, par erreur, l'écran de livraison interne de la p. 299) |
| 303 | 23 | mise à jour de l'inventaire ; inventaire général (choix des états) | 2 |
| 304 | · | gestion des tickets de valeur ; types de ticket ; lots de tickets | 2 |
| 305 | 1 | liste des lots ; sortie de tickets | 2 |
| 306 | 2 | recherche de mission ; recherche multicritère sur les lots | 2 |

**Total · 37 pages lues, 70 captures regardées.** Aucune page de 270 à 306 n'est
restée non lue. Le module GRH n'est pas dans cette plage · le texte extrait le
place au Chapitre 5, à partir de la page 167 du PDF (hors de cette section, non
regardé ici).

**État du manuel dans cette plage, relevé en passant** · les dates des captures
vont du 06/07/2015 au 25/03/2016 (le manuel décrit un logiciel d'avant la loi
n° 23/053) ; la numérotation des titres se contredit (« 1. Structure de base »
puis « 2.1 », « 2.3 » puis « 1.3.1 », deux « 3.1 » aux p. 296 et 297) ; le texte
et la capture divergent (« Enregistrer » contre « Exécuter » à l'amortissement,
p. 286-287 ; « montant à régulariser » contre « Quantité à régulariser », p. 302 ;
« sélectionner le bien à amortir » pour une SORTIE, p. 287 ; lots de tickets
ouverts par « Type de ticket », p. 304) ; la liste des lots affiche un message
d'un autre module (« Sélectionner le fonds de facilitation pour voir les
mouvements de fonds », p. 305) ; le chemin de la liste des retenues est celui de
leur mise en place (p. 278).

---

### 2. Module par module

#### 2.1 Paie (M p. 270 à 279)

Le chapitre ne décrit QUE du paramétrage, la fiche de l'employé et les
retenues. Il ne dit rien du calcul de la paie (brut, cotisations, impôt, net),
ni de l'émission ou de l'impression du bulletin, ni de sa comptabilisation, ni
du virement · ces gestes n'apparaissent que comme TITRES d'états paramétrés
(p. 277). INPP et ONEM ne sont nommés nulle part dans ces dix pages.

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Écran des données de base de la paie, dix tables dans une liste | 270 | partiel | barèmes datés (`src/modules/personnel/baremes-dossier.ts`), rubriques (`personnel/rubriques-paie.ts`), majorations (`personnel/majorations-heures.controller.ts`) | OmegaX ne laisse paramétrer que ce que le texte laisse à l'employeur ; le reste se lit dans la loi |
| Allocations familiales · « Nombre personne », « Taux » (%), « Limite assurance », « Montant », tous obligatoires | 271 | oui | allocation calculée par le texte, colonne 19 de l'annexe du décret n° 25/22 (`personnel/bareme-smig.ts`) | le manuel ne dit pas ce que signifient « Limite assurance » ni « Taux » ; non jugeable |
| Barème d'imposition · tranche « Min » / « Max », « Taux » (%), « Montant TCS » | 271 | oui | barème de la loi n° 23/053, art. 118, réservé à OmegaX, choisi au mois (`personnel/bareme-irpp.ts`, `TRANCHES_IRPP`, `baremeApplicableAuMois`) | l'écran de Microfina++ n'a AUCUNE date d'effet · réécrire la table change toute paie recalculée ; « TCS » n'est pas expliqué |
| Catégorie, classe et échelon, trois tables libres (A, B, C ; I à IV ; 1, 2, 3, 4, « INDEF ») | 272, 273 | partiel | classe du décret n° 25/22, 1 à 17 (`ContratTravail.classeProfessionnelle`, `prisma/schema.prisma`), catégorie libre (`categorieProfessionnelle`), minimum de la classe (`personnel/regles-contrat-travail.ts`) | OmegaX n'a pas d'échelon libre ; les échelons du décret sont DANS ses dix-sept classes |
| Grande famille d'élément (salaire de base, primes et indemnités, heures supplémentaires, autres retenues, crédit aux personnels) | 273 | partiel | natures d'élément en liste fermée (`personnel/assiettes-paie.ts`, `NatureElementPaie`) | regroupement libre chez Microfina++, nature légale chez OmegaX |
| Grande rubrique d'élément · code, libellé, « Imposable » oui / non | 274 | oui | la NATURE décide l'assiette sociale et fiscale, la rubrique ne fait que nommer (`personnel/rubriques-paie.ts`, `assiettes-paie.ts`) | chez Microfina++ l'imposabilité est une case ; voir § 5, règle R3 |
| Grille de salaire · classe × catégorie × échelon, « Salaire » ou « Points » selon le régime | 274 | partiel | grille de tension salariale du décret n° 25/22, art. 4 (`personnel/bareme-smig.ts`), confrontée au contrat (`regles-contrat-travail.ts`) | OmegaX tient le MINIMUM légal, pas une grille conventionnelle de l'entreprise, ni un régime à points (§ 4, idée 12) |
| Type d'avance · code, libellé, COMPTE (liste) | 275 | oui | `TypeAvanceSalaire` (avance, acompte, prêt, saisie-arrêt), compte par type (`personnel/avances-salaire.ts`, `compteDeLAvance`) | liste fermée chez OmegaX, chaque type porte son littera de l'art. 112 |
| Type d'heure supplémentaire · code, libellé, taux (%), élément de salaire | 275 | oui | `MajorationHeures` (taux, SOURCE, date d'effet, `prisma/schema.prisma`), `personnel/heures-majorees.ts` | OmegaX exige la source du taux (Code du travail, art. 120, e), renvoie à un arrêté) |
| Type de grille (fiscale, indiciaire, sociale, primes et indemnités) | 276 | partiel | barèmes CNSS, INPP, ONEM, SMIG (`baremes-dossier.ts`, `BAREMES_SERVIS`) | |
| Type de retenue · libellé seul | 276 | oui | sept retenues autorisées en liste FERMÉE (`personnel/retenues-autorisees.ts`) | liste libre chez Microfina++ ; voir § 5, règle R4 |
| Gestion des grilles · nom, type ; lignes visibles « 34 » (fiscale), « CNSS » et « CRT » (sociales), « salaire de base » (indiciaire), une cinquième coupée (« IRPP » ou « IPR », illisible) | 276 | partiel | versions de barème datées, texte exigé (`baremes-dossier.ts`, `VersionBaremePaie`) | « CRT » et « 34 » ne sont pas expliqués |
| Gestion des états · code, titre, description ; états E1 « BULLETIN », E2 « ETAT IRPP », EG « ETAT GLOBAL » des salaires, EVS « ETAT DE VIREMENT DE SALAIRE » | 277 | partiel | bulletin émis (`personnel/bulletin-paie.ts`), ordre de paiement des salaires (`personnel/paiement-salaires.ts`), registre des retenues (`src/modules/retenues/retenues.service.ts`) | aucun état fiscal IRPP produit par OmegaX ; le manuel ne montre le contenu d'aucun de ses états, seulement leur titre |
| Signataires d'un état (recherche par matricule ou nom) | 277 | non | · | § 4, idée 9 |
| Nouvel employé · onglet « Information général » | 277 | oui | `Salarie` (`prisma/schema.prisma`), `POST /personnel/salaries` (`personnel/personnel.controller.ts`), registre de l'art. 212 | aucun champ n'est visible dans le manuel (pas de capture) |
| Onglet « Classification » · grilles fiscales et sociales affectées à l'employé | 277 | partiel | régime de la retenue déclaré à la simulation (`regimeSalarial`, `personnel/dto/personnel.dto.ts`), classe au contrat | OmegaX ne pose pas de barème par salarié · le barème vient de la loi ou du dossier |
| Onglet « Affectation » · centres et poste d'affectation | 278 | partiel | répartition analytique de la paie par salarié (`personnel/ventilation-analytique-paie.ts`) | aucun poste ni fonction sur la fiche du salarié |
| Onglet « Contrat » · type de contrat, type d'employé, début et fin, MODÈLE de contrat | 278 | partiel | `ContratTravail` (type, dates), requalifications (`regles-contrat-travail.ts`) | aucun modèle de contrat à éditer |
| Rubrique de paie · famille, grande rubrique, rubrique, paramétrage | 278 | oui | `RubriquePaie` (code, libellé, nature, fondement), `personnel/avances-rubriques.controller.ts` | |
| Maquette de paie PAR EMPLOYÉ · rubrique, montant « des différentes sessions », active, intersessions, permanente sur le bulletin | 278 | partiel | bulletins modèles par catégorie (`personnel/modeles-bulletin.ts`) | pas de maquette propre au salarié, aucun élément permanent repris d'office (§ 4, idée 8) ; « session » n'est pas défini |
| Liste des employés, recherche multicritère | 278 | partiel | `GET /personnel/salaries`, filtres « tous » et « à compléter » (`personnel.controller.ts`) | |
| Mise en place d'une RETENUE · matricule, type de retenue, session, montant, DURÉE DU PRÉLÈVEMENT | 278 | partiel | `AvanceSalaire` (montant, retenue mensuelle convenue `retenueMensuelleFc`), retenue au bulletin bornée (`personnel/personnel.service.ts`) | OmegaX n'a pas de durée et ne propose pas la retenue d'office (§ 4, idée 2) |
| Liste des retenues sur salaire | 278, 279 | oui | `GET /personnel/avances` (`avances-rubriques.controller.ts`) | |
| Visa des retenues · menu « Visa de retenue », recherche de l'employé par matricule, et RIEN D'AUTRE | 279 | non | `AvanceSalaire` sans auteur ni date de visa (`prisma/schema.prisma`) | le manuel s'interrompt après deux puces · ni qui vise, ni ce que le visa change au bulletin |

#### 2.2 Immobilisation (M p. 280 à 289)

Le chapitre décrit surtout la GESTION MATÉRIELLE du bien (où il est, qui le
détient, dans quel état). Il ne décrit aucune écriture · ni l'acquisition, ni
la dotation, ni la sortie ne disent ce qui est passé au journal ; seuls les
comptes de la famille (p. 283) relient le module à la comptabilité.

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Interface · menus Données de base, Biens immobiliers, Affectations, Transfert, Amortissement, Inventaire de biens, Sortie de biens, Rapports | 280 | oui | fenêtre Immobilisations (`client/src/pages/ImmobilisationsPage.tsx`) | |
| Type de sortie de biens, paramétrable (cité dans la palette, non décrit) | 280 | partiel | nature de la sortie en liste FERMÉE, chaque nature son texte (`immobilisations/nature-sortie.ts`) | |
| Type d'immobilisation (CORP corporelle, INCORP incorporelle) | 281 | oui | classe 2 du plan et familles (`immobilisations/famille-immobilisation-seed.ts`) | |
| Utilisation de bien (entreprise, individuelle, mixte), « TVA applicable », taux | 281 | non | la taxe d'un bien d'investissement n'est pas portée par sa fiche · lacune nommée (`src/modules/tva/taux-tva.service.ts`, l. 729, art. 36, point 4) | voir § 5, règle R2 (taux de 10 % et 18 %) |
| Coefficient de dégressivité · coefficient par tranche de durée en années, libre | 282 | oui | coefficients de la loi, jamais saisis (`immobilisations/amortissement-degressif.ts`, l. 75 à 77) | voir § 5, règle R1 |
| Catégorie de biens (agencement, matériel de bureau, informatique, mobilier, terrain bâti) | 282 | partiel | natures du barème de l'arrêté n° 013/2025 (`immobilisations/bareme-amortissement-013-2025.ts`, `bareme-comptes-013-2025.ts`) | |
| Famille de biens · type, « Système », catégorie ; durée minimale et maximale, périodicité, coefficient ; comptes d'acquisition, de dotation, d'amortissement, de PRODUITS et de « charge VCN » | 283 | oui | `FamilleImmobilisation` (compte du bien, d'amortissement, de dotation, durée, mode, `prisma/schema.prisma`) ; durée proposée au barème, écart averti | les comptes de cession (81, 82) ne sont pas sur la famille chez OmegaX · ils viennent des fiches de ces comptes, à la sortie |
| Options supplémentaires de la famille · immatriculation, n° de châssis, carburant, référence du titre foncier, description | 283 | non | · | § 4, idée 11 |
| Localisation des biens · code hiérarchique (« 10.DG.01 »), libellé | 283 | oui | `LieuBien`, routes `lieux` (`immobilisations/immobilisation.controller.ts`, l. 114 à 135) | |
| Création de bien · codification, référence du constructeur, catégorie, famille, libellé, date d'acquisition, durée de vie, utilisation, localisation, mise en service, statut « LIBRE », amortissable oui / non, subventionné oui / non | 284 | oui | `immobilisations/immobilisation.service.ts`, mise en service (`PATCH :id/mise-en-service`), subvention rattachée (`immobilisations/subvention-rattachee.ts`) | aucune référence du constructeur chez OmegaX |
| Création de bien · FOURNISSEUR (recherche) et FACTURE (liste), « Montant TTC », « T.V.A », « Prix acquis. » | 284 | partiel | écriture d'acquisition passée par le module contre le 4811 ou le 4812 selon la nature (`immobilisations/contrepartie-acquisition.ts`) ; création depuis une écriture déjà passée (`creation-depuis-ecritures.ts`) | la fiche d'OmegaX ne garde ni le tiers fournisseur ni la facture |
| Code-barres du bien (bouton de la fiche) | 284 | non | · | § 4, idée 3 |
| Affectation d'un bien à un EMPLOYÉ · matricule, localisation, date, reçu imprimé | 284, 285 | non | · | § 4, idée 1 |
| Transfert par bien · nouveau détenteur, département, localisation, date, reçu | 285 | partiel | changement de lieu (`PATCH :id/lieu`, `immobilisation.controller.ts` l. 132), tracé au journal d'audit (`src/common/audit/champs-audites.ts`, l. 77) | aucun détenteur, aucun reçu |
| Transfert des biens d'un employé à un autre | 285, 286 | non | · | § 4, idée 1 |
| Libération d'un bien en cours d'utilisation, reçu | 286 | non | · | § 4, idée 1 |
| Amortissement · « par matériel » ou « par lot de matériel », exercice, dernier amortissement, date | 286, 287 | partiel | dotation bien par bien (`POST :id/dotation`, `immobilisation.controller.ts` l. 300) | aucune dotation d'un lot ou de tout le registre en un geste |
| Inventaire des biens · code, ÉTAT DU BIEN, date, observation ; détenteur, direction, localisation | 287 | partiel | campagnes d'inventaire, fiches tirées du registre (`POST :id/fiches/immobilisations`, `src/modules/inventaire/inventaire.controller.ts`), lieu recopié (`inventaire/lieu-sur-fiche.ts`) | aucun état du bien ni observation sur la fiche de comptage (§ 4, idée 14) |
| Sortie du patrimoine · type de sortie, bien, date, observation, état imprimé (texte seul) | 287 | oui | nature et pièce exigées (`immobilisations/nature-sortie.ts`), `POST :id/sortie` | |
| Rapport des biens par localisation (« Éléments immobilisés sur une période donnée » · sur une période, à une date fixe, jusqu'à une date fixe) | 287, 288 | partiel | lieu sur la fiche, tableau des immobilisations à une date (`GET /immobilisations/tableau`, `dateArret`) | aucun état par lieu |
| État des inventaires sur une période, douze critères (catégorie, famille, type, utilisation, employé, bien, direction, statut, subventionné, amorti, état, localisation) | 288 | partiel | éditions de la campagne (`inventaire/editions-inventaire.ts`) | |
| Simulation d'un tableau d'amortissement (système, coefficient, périodicité, date, durée, montant), sans bien enregistré | 288 | partiel | tableau des amortissements des biens enregistrés (`GET /immobilisations/tableau-amortissements`) ; simulation pour la seule location-acquisition (`POST location-acquisition/simulation`) | § 4, idée 10 |
| État de suivi des affectations, transferts et libérations, multicritère (ancien et nouveau département, détenteur, localisation) | 289 | non | · | § 4, idée 1 |
| Recherche multicritère des biens acquis · détaillé ou groupé, « biens à amortir », type de sortie | 289 | partiel | tableau des immobilisations (`GET /immobilisations/tableau`), liste des biens | |

#### 2.3 Stock (M p. 290 à 306)

Le chapitre décrit une LOGISTIQUE (magasins, produits, besoins, commandes,
livraisons, ventes, inventaire) en QUANTITÉS. Aucune méthode de valorisation
n'est dite, aucune écriture n'est décrite ; seule la famille de produit porte
un compte (p. 290). Voir § 5, règles R5 et R6.

| Fonction | M p. | OmegaX | Preuve | Commentaire |
|---|---|---|---|---|
| Page principale · Produits, Saisies, Traitements, Statistiques, Paramétrages ; palette Tickets de valeur ; « Suivi des commandes fournisseurs » (cité, non décrit) | 290 | partiel | fenêtre Magasin (`client/src/pages/MagasinPage.tsx`) | |
| Famille de produit · code, libellé, compte | 290 | partiel | l'article porte son compte de stock (`ArticleStock.compteId`), numéros de stock par référentiel (`stocks/nomenclature-stocks.ts`) | dans l'exemple, des familles sont rattachées à « 10140 CAPITAL » et à « 90001 » (hors bilan) · aucun contrôle de classe |
| Client · référence, civilité, nom, contact, adresse, pays, ville, BP, téléphones, fax | 291 | oui | tiers et compte individuel (`src/modules/tiers/tiers.service.ts`, `tiers/collectifs-tiers.ts`) | |
| Magasins multiples · référence, type, nom, téléphone (magasin central, de secours, général 2) | 291 | non | `ArticleStock` sans magasin (`prisma/schema.prisma`) | § 4, idée 6 |
| Affectation d'un magasin à un utilisateur (case « Ouvert ») | 292 | non | · | les journaux autorisés par utilisateur (`src/common/perimetre/extension-perimetre-journaux.ts`) ne portent pas sur le magasin |
| Produit · référence, type, nom, STOCK D'ALERTE, STOCK DE SÉCURITÉ, périssable ; quantité, prix d'achat et de vente initiaux | 292 | partiel | article (code, désignation, unité, compte, méthode de valorisation, `POST /magasin/articles`, `stocks/magasin.controller.ts`) | ni seuil, ni périssable, ni prix de vente |
| Initialisation du stock · produit, PA, PU, PV, quantité | 293 | oui | entrée valorisée au coût (`MouvementStock.cout`, `POST articles/:articleId/mouvements`) | |
| Alerte du stock · produits sous le seuil, surlignés | 293 | non | · | § 4, idée 5 |
| Code-barres par produit et par lots, planche d'étiquettes imprimée | 293 à 296 | non | · | § 4, idée 3 |
| Expression des besoins · libellé, date, produits et quantités à commander | 296, 297 | non | · | § 4, idée 7 |
| Commande interne, demande de fourniture · direction ou cellule, auteur, produit, stock en cours, quantité, prix d'achat | 297, 298 | non | · | § 4, idée 7 |
| Commande client · référence, client, lignes avec réduction ; facturation (délais, autres frais, TVA, à livrer le, solde), « Confirmer » | 298 | partiel | devis et commande au sens de l'AUDCG, SYSCOHADA seul (`src/modules/commercial/vente-commerciale.ts`) ; facture (`src/modules/facturation/facturation.service.ts`) | |
| Livraison fournisseur contre commande · quantité commandée, livrée, RESTANTE ; impression | 299 | partiel | entrée au magasin (`MouvementStock`, sens entrée) | aucune commande fournisseur, aucun reste à livrer (§ 4, idée 7) |
| Livraison interne · servir la commande d'une direction, en tout ou en partie, état imprimé | 299 | partiel | sortie au magasin (`MouvementStock`, sens sortie), refusée au-delà du stock (`stocks/valorisation-stocks.ts`, `sortiesAuDelaDuStock`) | aucun bon de sortie lié à une demande |
| Vente de produit · client, lignes, réduction, autres frais, TVA, date de livraison, MODE DE RÈGLEMENT | 300 | partiel | facture et son écriture (`facturation/ecriture-facture.ts`) ; sortie de stock à part | aucun lien entre la facture et la sortie du magasin (§ 4, idée 15) |
| Règlement des commandes clients · factures, montant payé, solde, mode de règlement | 300 | oui | règlement des tiers et lettrage (`src/modules/reglements/reglement-tiers.ts`, `reglements/modes-reglement.ts`) | |
| Migration de produits entre magasins | 301 | non | · | § 4, idée 6 |
| Visualisation du stock sur une période · stock initial, entrées, surplus, total des entrées, sorties, pertes, avarié, total des sorties, stock final | 301 | partiel | fiche de l'article, en quantités ET en valeur (`GET articles/:articleId/fiche`, `stocks/valorisation-stocks.ts`) | pas d'état de tous les articles sur une période |
| Régularisation du stock · manquant, surplus ou AVARIE, quantité, prix unitaire | 302 | partiel | boni et mali comptabilisés depuis un comptage (`stocks/boni-mali-inventaire.ts`, `POST /magasin/inventaire/regularisation`) ; l'avarie renvoie à la voie de la dépréciation, nommée (`src/modules/inventaire/inventaire.service.ts`) | OmegaX ne régularise qu'APRÈS un comptage ; l'avarie n'a pas de geste à elle |
| Statistique des consommations mensuelles · douze mois, total, CMM sur 3, 6 et 12 mois | 302 | non | · | § 4, idée 13 |
| Mise à jour de l'inventaire · inventaire nommé (« du 1er trimestre »), quantité théorique et physique, surplus, perte, avarié, « Inventorier » | 303 | oui | confrontation du comptage (`stocks/boni-mali-inventaire.ts`, `confronterInventaire`, l. 144 ; `POST /magasin/inventaire/confrontation`) | OmegaX chiffre l'écart par la méthode de l'article ; Microfina++ ne montre que des quantités |
| États généraux · règlements clients et fournisseurs, livraisons clients et fournisseurs, fiche des ventes, ventes générales, « indicateur de gestion des produits » | 303 | partiel | balances et grands livres des tiers (`src/modules/exports/export-fpm.service.ts`), factures | aucun état des livraisons ni des ventes par produit |
| Types de ticket de valeur | 304 | non | · | § 4, idée 4 |
| Lot de tickets · référence, type (« Bon d'essence pour diesel »), fournisseur, date de livraison, nombre, valeur unitaire, numérotation générée (initiale, nombre de caractères) | 304 | non | · | § 4, idée 4 |
| Liste des lots de tickets | 305 | non | · | |
| Sortie de tickets · date, description, observation, motif MISSION, par ticket ou par lot, bénéficiaire | 305, 306 | non | · | § 4, idée 4 |
| Recherche de mission ; recherche multicritère des lots (type, bénéficiaire, motif, fournisseur ; entrée ou sortie ; détaillé ou groupé) | 306 | non | · | |

#### 2.4 Décompte par légende

| Module | oui | partiel | non | hors champ | Total |
|---|---|---|---|---|---|
| Paie | 9 | 13 | 2 | 0 | 24 |
| Immobilisation | 7 | 10 | 7 | 0 | 24 |
| Stock | 4 | 10 | 13 | 0 | 27 |
| **Total** | **20** | **33** | **22** | **0** | **75** |

---

### 3. Corrections aux deux documents précédents

#### 3.1 `docs/comparaison-microfina/audit-complet-manuel-microfina.md`

| Ligne | Ce qui était écrit | Ce que disent les pages |
|---|---|---|
| (a), « Conclusion » | « folios 80 à 306 NON LUS » ; « Le nombre de 306 pages vient de la note de la CAMEC » | le PDF a bien 306 pages (`pdfinfo`) ; 270 à 306 sont lus, texte et captures |
| (a), dernière phrase avant la couverture | « La pagination de la note précède d'une à deux pages le folio imprimé » | entre 270 et 306, la note suit la PAGE DU PDF ; le folio vaut page moins un en Paie, et repart à 1 en Immobilisation (p. 281) et aux tickets (p. 305) |
| Couverture, ligne « 80 à 306 » | « Paie, Immobilisations, GRH, Stocks (ordre et bornes inconnus) » | Chapitre 5 GRH à partir de la p. 167 (texte extrait, hors de cette section) ; Chapitre 6 Paie, p. 270 à 279 ; Chapitre 7 Immobilisation, p. 280 à 289 ; Chapitre 8 Stock, p. 290 à 306, tickets de valeur compris |
| Table CAMEC, ligne Paie | « types d'avance, mise en place et visa des retenues sur salaire · 275-279 » | exact mais partiel · 270 à 279 portent aussi dix tables de paramétrage, la gestion des grilles et des états, les signataires, la fiche de l'employé, les rubriques et la maquette de paie ; le type d'avance est p. 275, la mise en place d'une RETENUE p. 278, le visa p. 279 en deux puces sans capture |
| Table CAMEC, ligne Immobilisations « 283-285 » | « comptes d'acquisition, de dotation et d'amortissement par famille ; création du bien avec fournisseur et facture » | famille p. 283, qui porte aussi un compte de PRODUITS et un compte de « charge VCN » ; création p. 284 ; la p. 285 porte l'affectation et les transferts |
| Table CAMEC, ligne « 287-288 » | « inventaire des biens, liste des inventaires, sortie du patrimoine » | inventaire et sortie p. 287 (la sortie sans capture), liste des inventaires p. 288 |
| Table CAMEC, ligne « GRH, Stocks » | « aucune page citée · rien n'est connu de ces modules » | Stock lu en entier, p. 290 à 306 (§ 2.3) |
| § 14 Paie, « En bref » | « mise en place de l'avance partiel (le versement n'est pas passé) » | le manuel ne décrit aucune mise en place d'AVANCE ni aucun versement · il décrit la mise en place d'une RETENUE (type, session, montant, durée du prélèvement, p. 278) ; « partiel » tient, pour une autre raison (OmegaX n'a ni durée ni retenue proposée d'office) |
| § 14 Paie, « En bref » | « visa des retenues sur salaire, non » | « non » tient ; mais le visa n'est attesté que comme un MENU (p. 279), son effet n'est pas décrit |
| § 15, « Création du bien avec fournisseur et facture » | **oui** | **partiel** · OmegaX passe l'écriture contre le 4811 ou le 4812, mais sa fiche ne garde ni le fournisseur ni la facture (`prisma/schema.prisma`, `model Immobilisation` ; `immobilisations/contrepartie-acquisition.ts`) |
| § 15, « Inventaire des biens, liste des inventaires » | **oui** | **partiel** · la fiche de comptage d'OmegaX ne porte ni l'ÉTAT du bien ni d'observation (`model FicheInventaire`), que la p. 287 exige (« Etat du bien » obligatoire) |
| § 15, colonne « Page » | « CAMEC p. 283-285 », « 287-288 » | pages lues · 283 et 284, 287 et 288 |
| § 15 (absent) | rien sur l'affectation, le transfert, la libération, le code-barres, la simulation | 24 fonctions relevées au § 2.2, dont 7 « non » |
| § 17 Stocks | « gestion des stocks (titre seul) · oui » | remplacé par le § 2.3 · 27 fonctions, 4 « oui », 10 « partiel », 13 « non » |
| (d-1), U10 | « inventaire et sorties d'immobilisations non suivis · oui » | sortie oui ; inventaire partiel (voir ci-dessus) |
| (e), « Où OmegaX est en avance », point 4 | « Paie, fiscalité, immobilisations, stocks, révision · […] le manuel lu n'en décrit aucun » | le manuel les décrit maintenant · OmegaX reste en avance sur le CALCUL et l'ÉCRITURE (le manuel n'en décrit aucun), il est en retard sur la gestion matérielle des biens et la logistique des stocks (§ 5) |
| (e), « Où OmegaX est en retard », point 4 | « La paie, sur un point attesté · le visa des retenues (CAMEC p. 275-279) » | M p. 279 ; à compléter par la durée du prélèvement (p. 278), les signataires des états (p. 277), la maquette de paie par employé (p. 278), et hors paie par le détenteur des biens (p. 284 à 289) et la logistique des stocks (p. 291 à 306) |
| (e), idée 3, colonne « Vue chez Microfina++ » | « CAMEC p. 275-279 » | M p. 275 (type d'avance et son compte), 278 (retenue, durée du prélèvement), 279 (visa, menu seul) |
| (e), « Ce qu'il faut pour aller plus loin » | « Lire les folios 80 à 306 » | 270 à 306 lus ; restent 80 à 269, hors de cette section |

#### 3.2 `docs/comparaison-microfina/paie-microfina-omegax.md`

| Ligne | Ce qui était écrit | Ce que disent les pages |
|---|---|---|
| (a), table des sources, colonne « Non lu » | « folios 80 à 306, donc la totalité des modules Paie et GRH » | Paie lu, p. 270 à 279 ; GRH au Chapitre 5 (p. 167 et suivantes, hors de cette section) |
| (a), « trois phrases, et rien d'autre » | le manuel ne dirait de la paie que trois phrases | dix pages de paramétrage, de fiche de l'employé et de retenues (§ 2.1) |
| (a), écart de pagination | « la note (qui suit vraisemblablement le folio du PDF) » | confirmé · la note suit la page du PDF, le folio imprimé vaut page moins un dans ce chapitre |
| (a), « Conséquence » | l'audit ne peut pas dire ce que calcule la paie « (brut, CNSS, INPP, ONEM, IRPP, net) » | la conclusion TIENT, mais pour une autre raison · le manuel ne décrit aucun calcul. Il donne des paramètres (barème « Min, Max, Taux, Montant TCS », grilles « CNSS » et « CRT », allocations) et des titres d'états ; INPP et ONEM n'y figurent nulle part |
| (b-1), n° 1, commentaire | « le manuel lu n'en dit que le titre ; la comparaison du calcul est impossible » | le manuel en dit le paramétrage ; le calcul reste non décrit |
| (b-1), n° 3, commentaire | « Microfina++ paramètre des types (le manuel n'est pas lu pour dire comment) » | code, libellé et COMPTE choisi dans une liste (p. 275) |
| (b-1), n° 4 | « Mise en place d'une avance · CAMEC p. 275-279 » | « Mise en place de retenue », M p. 278 · matricule, type de retenue, session, montant, DURÉE DU PRÉLÈVEMENT ; aucun versement décrit chez Microfina++ non plus. Le reproche fait à OmegaX (versement non passé) n'a donc pas d'équivalent attesté dans le manuel ; le vrai écart est la durée et la retenue reprise d'office |
| (b-1), n° 5 | « Visa des retenues sur salaire · CAMEC p. 275-279 » | M p. 279 · deux puces (menu, recherche par matricule), aucune capture, la page s'arrête ; ni l'auteur, ni l'effet du visa ne sont décrits |
| (b-1), n° 6 | « Virement des salaires · CAMEC p. 137 » | la p. 137 est hors de cette section ; le module Paie ne cite qu'un état « ETAT DE VIREMENT DE SALAIRE » (code EVS, p. 277), sans le montrer |
| (d), « Où OmegaX est en retard », point 1 | le visa est « le seul point de paie sur lequel une fonction de Microfina++ est attestée et absente d'OmegaX » | faux · sont aussi attestés et absents ou partiels · les signataires des états (p. 277, non), la maquette de paie par employé avec éléments permanents (p. 278), une grille salariale conventionnelle à montants ou à points (p. 274), le poste d'affectation (p. 278), le modèle de contrat (p. 278), la durée du prélèvement d'une retenue (p. 278) |
| (d), point 3 | « On ne sait pas si Microfina++ les produit (folios non lus) » | les états E1 bulletin, E2 état IRPP, EG état global, EVS état de virement sont paramétrés (p. 277) ; leur contenu n'est pas montré, on ne sait toujours pas ce qu'ils impriment |
| (d), rang 2, commentaire | « rattrape la seule fonction de paie attestée chez Microfina++ » | à reformuler · l'une de plusieurs ; la durée du prélèvement (p. 278) en fait partie |
| (d), « Ce qui reste à lire » | « d'abord les pages que la note désigne pour la paie (275 à 279) et le virement (137) » | 270 à 279 lus ; reste la p. 137, et le Chapitre 5 GRH |

---

### 4. Fonctions utiles à OmegaX (idées, sous le gel)

Toutes « non » ou « partiel » ci-dessus. Aucune n'est codée ; chacune exige
que Manasse lève le gel pour elle, et la lecture de son texte avant toute
ligne (CLAUDE.md § 1). Aucun compte n'est proposé ici · un compte se lit dans
la fiche du plan au moment de coder.

| N° | Idée | M p. | Ce qu'elle apporterait | Nature de la règle |
|---|---|---|---|---|
| 1 | **Détenteur d'un bien** · affectation à un salarié, transfert d'un détenteur à un autre, libération, reçu imprimé à signer, état de suivi sur une période | 284 à 286, 289 | savoir QUI détient l'ordinateur ou le véhicule d'un projet, et le faire signer · c'est le reproche CAMEC-R 57 (biens non inventoriés) côté personnes ; aucune écriture | geste de gestion, aucun texte ne l'impose ; lien avec `Salarie` et `LieuBien` déjà existants |
| 2 | **Retenue planifiée** · durée du prélèvement (nombre de mois ou date de fin), retenue proposée d'office sur chaque bulletin jusqu'au solde, visa facultatif par un second utilisateur | 278, 279 | ferme « une avance peut être oubliée » (CAMEC-U 11, R55) | Code du travail, art. 112, c) et f) (`droit-travail-congolais`, `texte-loi-verbatim/05-titre-v-du-salaire.md`) ; visa sur le modèle de `tiers/visa-rib.ts` |
| 3 | **Étiquettes à code-barres** des biens (numéro d'inventaire) et des articles, à l'unité ou par lot, et lecture à l'inventaire | 284, 293 à 296 | étiqueter le parc (CAMEC-R 57, biens « non étiquetés ») et compter plus vite | convention d'OmegaX ; le code est le numéro d'inventaire existant (`immobilisations/maintenance-immobilisations.ts`) |
| 4 | **Bons et tickets de valeur** · lots numérotés reçus d'un fournisseur (bons de carburant), valeur unitaire, sortie par ticket ou par lot vers un bénéficiaire et une mission, reste en main | 304 à 306 | une ONG distribue des bons de carburant par mission ; aujourd'hui rien ne suit le reste en main ni le bénéficiaire | le traitement comptable de ces bons reste à lire dans les fiches des deux plans avant toute ligne |
| 5 | **Seuil d'alerte et stock de sécurité** par article, article périssable, liste des articles sous le seuil | 292, 293 | prévenir la rupture d'un intrant de projet | convention d'OmegaX, sans effet comptable |
| 6 | **Plusieurs magasins** et transfert entre eux, magasin affecté à un utilisateur | 291, 292, 301 | dépôt central et dépôts de terrain d'une ONG | aucune écriture pour un transfert interne ; le cloisonnement suit les journaux autorisés (`src/common/perimetre/`) |
| 7 | **Demandes internes servies par le magasin** · expression des besoins, demande de fourniture par direction, livraison interne en tout ou en partie, reste à servir ; et commande fournisseur avec reste à livrer | 296 à 299 | tracer QUI a demandé et reçu quoi, contrôle des consommations | convention d'OmegaX ; la sortie reste le mouvement existant (`MouvementStock`) |
| 8 | **Maquette de paie par salarié** · éléments permanents (prime fixe, indemnité de logement) repris d'office au bulletin du mois, modifiables | 278 | le geste mensuel ; prolonge le rang 1 de `paie-microfina-omegax.md` | la nature décide toujours l'assiette (`personnel/assiettes-paie.ts`) |
| 9 | **Signataires d'un état** · bulletin, ordre de paiement des salaires, état des retenues, avec nom et qualité | 277 | un document remis au salarié ou à la banque porte ses signataires | aucun texte lu ne l'impose pour la paie |
| 10 | **Simulation libre d'un tableau d'amortissement** (mode, durée, montant, date, coefficient légal) sans créer le bien | 288 | répondre au client avant l'achat | même moteur que la dotation (`immobilisations/amortissement-degressif.ts`, plan du bien), coefficients de la loi seulement |
| 11 | **Champs propres à une famille** · immatriculation, n° de châssis, carburant, référence du titre foncier | 283 | identifier un véhicule ou un terrain sur la fiche | aucun effet comptable |
| 12 | **Grille salariale de l'entreprise** (classe × catégorie × échelon, montant ou points), confrontée au minimum du décret | 274 à 276 | une ONG à grille interne cesse de la tenir sur Excel | le minimum légal reste le plancher (`personnel/regles-contrat-travail.ts`) |
| 13 | **Consommation mensuelle par article** et moyenne sur 3, 6 et 12 mois | 302 | prévoir les achats, justifier un budget | lecture des mouvements existants |
| 14 | **État du bien à l'inventaire** (bon, usé, hors d'usage) et observation sur la fiche de comptage | 287 | une sortie ou une dépréciation se prépare sur un constat écrit | AUDCIF art. 42 (recensement), Titre VIII ch. 12 pour la dépréciation, à relire |
| 15 | **Vente qui sort du magasin** · la facture d'un produit suivi crée sa sortie de stock | 300 | une seule saisie au lieu de deux, aucun écart entre facture et magasin | les deux moteurs existent (`facturation/`, `stocks/`) |

---

### 5. Comparaison et règles contraires à un texte lu

#### Mieux fait dans le manuel que dans OmegaX

1. **La gestion matérielle des biens** · détenteur, reçus imprimés, transferts,
   libération, suivi par période (p. 284 à 289). OmegaX ne connaît que le lieu.
2. **La logistique des stocks** · magasins multiples, besoins, demandes internes,
   commandes et livraisons avec reste, codes-barres, alertes, consommations
   moyennes (p. 291 à 303). OmegaX tient un magasin comptable, pas un entrepôt.
3. **Les bons et tickets de valeur** par lot et par mission (p. 304 à 306).
4. **La recherche multicritère** systématique, avec les trois bornes « sur une
   période », « à une date fixe », « jusqu'à une date fixe » (p. 287 à 289, 306).
5. **Le paramétrage de la paie par l'utilisateur** (grilles, états, signataires,
   maquette par employé) · souple, au prix des règles R1, R3 et R4 ci-dessous.

#### Mieux fait dans OmegaX que dans le manuel

1. **Le calcul et l'écriture** · le manuel ne décrit ni le calcul de la paie, ni
   une seule écriture d'acquisition, de dotation, de sortie ou de stock ; OmegaX
   calcule CNSS, INPP, ONEM et IRPP au texte (`personnel/cotisations-paie.ts`,
   `bareme-irpp.ts`) et passe chaque écriture par son module.
2. **Des barèmes datés et tirés de la loi** · le barème d'impôt de Microfina++
   n'a pas de date d'effet (p. 271) et ses coefficients dégressifs sont libres
   (p. 282) ; OmegaX choisit le barème au mois et prend les coefficients de la
   loi.
3. **Les retenues en liste fermée** (art. 112) et l'assiette décidée par la
   nature de l'élément, non par une case « Imposable ».
4. **La valorisation des stocks** · P.E.P.S. ou C.M.P.A.C.E. à chaque sortie
   (`stocks/valorisation-stocks.ts`), boni et mali comptabilisés ; le manuel
   n'affiche que des quantités.
5. **Un magasin qui ne descend jamais sous zéro** (`sortiesAuDelaDuStock`) ; les
   captures de Microfina++ montrent des stocks de -17 et de -5 (p. 292, 293).

#### Règles du manuel contraires à un texte lu

Les captures datent de 2015-2016 ; les constats se jugent sur le droit EN
VIGUEUR, que l'écran laisse saisir aujourd'hui.

| N° | Ce que montre le manuel | M p. | Texte lu | Constat |
|---|---|---|---|---|
| R1 | Coefficients de dégressivité 0,50 de 1 à 5 ans, 1,50 de 6 à 11, 2,50 de 12 à 20, 3,00 de 21 à 30, 5,00 de 23 à 35 | 282 | loi n° 23/053, art. 32 (exclut les durées « inférieure à quatre (4) ans ou supérieure à vingt (20) ans ») et art. 33 (coefficients « 1,5 ; 2 ou 2,5 ») · compétence `fiscalite-rdc`, `code-general-2026/references/04-loi23-053-titre2-impot-societes.md` ; l'ancien régime disait « 2, 2,5 ou 3 » (`historique-fiscal-abroge/references/ol-69-009-1969-impots-cedulaires-texte-origine.md`, l. 427) | contraire au texte en vigueur ET à l'ancien ; les tranches se chevauchent (21-30 et 23-35) ; l'écran admet tout coefficient |
| R2 | Utilisation « ENTREPRISE » à TVA de 10,00 et « MIXE » à 18,00 | 281 | O.-L. n° 10/001, art. 35 modifié (taux normal 16 %, réduits 1 % et 5 %, zéro) · `fiscalite-rdc`, `tva/references/04-base-imposition-taux.md`, `code-general-2026/references/10-tva-ol10-001-loi-base-ch1-10.md` l. 798 ; avant 2026, réduit de 8 % (même fichier, « ex-taux réduit de 8 % ») | aucun de ces deux taux n'est congolais ; taux libres, sans contrôle |
| R3 | Grande rubrique G07 « Avantage en nature Concédé », Imposable « Non » | 274 | loi n° 23/053, art. 68 (« tous les avantages en argent et en nature », « comptés pour leur valeur réelle ») ; immunités limitées par l'art. 69, 8° (logement, transport, frais médicaux, sous conditions) · `fiscalite-rdc`, `code-general-2026/references/05-loi23-053-titre3-irpp.md` l. 158 à 215 | contraire à l'art. 68 pour tout avantage hors des cas de l'art. 69 ; la case « Imposable » le permet en un clic |
| R4 | « Type de retenue » saisi en libellé libre ; grande famille « AUTRES ERETENUES » | 273, 276 | Code du travail, art. 112 (« Est nulle de plein droit […] Toutefois, les retenues ci-après sont autorisées », sept litterae) · `droit-travail-congolais`, `texte-loi-verbatim/05-titre-v-du-salaire.md` l. 122 à 136 | RISQUE, non constat · l'écran laisse créer une retenue que la loi n'autorise pas ; aucune retenue illicite n'est montrée |
| R5 | Stock suivi en quantités, aucune méthode de valorisation dite (initialisation à « PA », « PU », « PV ») | 292 à 303 | AUDCIF art. 44 (P.E.P.S. ou coût moyen pondéré à la sortie ou à l'inventaire) · `audcif-acte-uniforme`, `titre-1-ch4-evaluation-resultat.md` l. 95 à 105 ; fiches des comptes 31 à 33 (« crédité, à chaque sortie de stock […] selon P.E.P.S. ou C.M.P. ») · `titre-7-comptes-classe-3.md` l. 59 | ABSENCE, non contradiction · la conformité ne peut pas être jugée sur le manuel |
| R6 | Stocks négatifs (-17 classeurs, -5 « PRODUIT ZED ») dans la liste et dans l'alerte | 292, 293 | aucun texte lu ne le nomme ; en inventaire permanent le compte se crédite « à chaque sortie » d'un stock existant (`titre-7-comptes-classe-3.md` l. 59) | incohérence de gestion, signalée sans article |
| R7 | Création du bien en « Montant TTC », avec « T.V.A » et « Prix acquis. » à côté | 284 | AUDCIF art. 37 (prix d'achat « net de […] taxes récupérables ») · `titre-1-ch4-evaluation-resultat.md` l. 23 à 30 | NON JUGEABLE · l'écran semble déduire le hors taxes, le manuel ne dit pas le calcul |
| R8 | Familles de produits rattachées à « 10140 CAPITAL » et à « 90001 » (hors bilan et analytique) | 290 | les comptes de stock sont ceux de la classe 3 (`titre-7-comptes-classe-3.md`) ; le plan de Microfina++ n'est pas dit | données de démonstration incohérentes ; l'écran ne contrôle pas la classe du compte |

---

