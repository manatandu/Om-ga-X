# Sage 100 Comptabilité, support de formation · fonction par fonction

Manuel 10 de la comparaison complète demandée par Manasse le 2026-10-09.
Source : « Support compta formation, Sage comptabilité » (Drive, id
1hihSdE44FphQcWdhRE_UPV2Q0OH-NuKe), 222 pages, sans auteur ni date. Le
support porte sur Sage 100 Comptabilité, version 16 citée page 109, et suit
le plan comptable marocain (clients au 3421, fournisseurs au 4411, montants
en dirhams). Ces numéros ne sont repris nulle part ; seule la fonction est
comparée.

Le texte a été extrait du PDF puis lu en entier le 2026-10-14. Les
captures d'écran ont été lues ensuite, page par page, sur les 222 pages
rendues en image : elles précisent plusieurs lignes et en ajoutent treize
(section « Vu sur les captures seulement »). Quelques captures sont en
partie masquées par une bulle ou coupées (notamment p. 17, 20, 31, 72, 85,
120, 189 et 216) ; rien n'est tiré de ce qui ne s'y lit pas. Les chapitres
10 à 12 (contrôle comptable, import et export, objets calculés) n'ont que
leur titre, page 222, sans contenu. Les pages citées sont celles du PDF, le
support n'en imprimant pas.

Ce support recoupe largement le guide de l'utilisateur (manuel 1) et le
manuel EDM (manuel 2). Méthode et légende : celles du manuel 1
(`01-guide-utilisateur-i7.md`). « M5 » et « M6 » renvoient aux lignes des
manuels Moyens de paiement et Structure des fichiers. Les statuts ont été
lus dans le code le même jour, sur la branche `travail/virement-fonds`, et
aucune ligne n'est restée non vérifiée.

## Dossier et plan comptable (p. 4 à 18)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 1 | Création du fichier comptable, avec ou sans assistant ; raison sociale reprise de l'installation | 4 à 12 | DIFFÉRENT, VOULU | Un dossier naît par la console ou par le siège d'un groupe ; un démarrage guidé accompagne le dossier sans écriture (`lib/demarrage-guide.ts`). |
| 2 | Durée d'un exercice limitée à 36 mois | 7 | DIFFÉRENT, VOULU | Aucun plafond n'est posé au premier exercice, qui peut être long (AUDCIF art. 7) ; une période n'est couverte que par un exercice. |
| 3 | Monnaie de tenue choisie (euro ou autre) | 8 | DIFFÉRENT, VOULU | La monnaie de tenue ne se choisit pas (loi n° 23/053 art. 141, 1° ; AUDCIF art. 17, 1°). |
| 4 | Reprise des éléments comptables livrés (plan, journaux), en tout ou en partie, ou création manuelle | 9, 10 | FIDÈLE | Le dossier naît avec le plan, les journaux et les taux de son référentiel, SYCEBNL ou SYSCOHADA. |
| 5 | Taille du fichier estimée au nombre de lignes d'écriture | 12 | DIFFÉRENT, VOULU | Rien à dimensionner. |
| 6 | Longueur des comptes généraux et complément à zéro | 7, 13, 14 | PARTIEL | Longueur des comptes de 3 à 13 (`Tenant.longueurCompte`) ; le plan semé est complété à huit chiffres (CLAUDE.md, § 7). Un numéro tapé court n'est pas complété d'office. |
| 7 | Natures de compte définies par fourchettes ; nature affectée d'office à la création. La capture en liste quatorze (client, fournisseur, salarié, banque, caisse, amortissement et provision, résultat bilan, charge, produit, résultat gestion, immobilisation, capitaux, stock, titre), chacune avec ses options par défaut (regroupement, analytique, échéance, quantité, devise, lettrage automatique, compte tiers, report) | 14 à 16 | PARTIEL | Les sept natures du manuel i7, à fourchettes, qui ne donnent que le report et le lettrage par défaut ; la nature s'affiche sans être stockée (`comptes/natures-compte.ts`). Voir M6, ligne 21. |
| 8 | Plan comptable : liste de tous les comptes, actifs ou en sommeil ; création, recherche, modification, suppression | 16, 17 | FIDÈLE | Fenêtre Plan comptable ; un compte mouvementé ou utilisé ne se supprime pas, il se met en sommeil. |
| 9 | Fiche du compte : numéro, type Détail ou Total, intitulé, abrégé, nature, code taxe, raccourci, comptes tiers rattachés, options de saisie (analytique, échéance, quantité, devise, compte tiers, lettrage automatique) ; onglets Bloc-notes, Information libre, Budgets, Cumuls | 18 | PARTIEL | Numéro, type, intitulé, mode de report, lettrage, taux de taxe par défaut, sommeil (`Compte`). Ni abrégé, ni raccourci, ni bloc-notes, ni information libre ; les options de saisie ne se règlent pas compte par compte. |

## Journaux et saisie (p. 18 à 49)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 10 | Codes journaux : type (achats, ventes, trésorerie, général, situation), code, intitulé | 18 à 22 | FIDÈLE | `Journal`, les cinq mêmes types. |
| 11 | Numérotation des pièces : manuelle, continue par journal, continue pour le fichier, mensuelle ; zone pièce protégée | 20, 21 | FIDÈLE | Les quatre mêmes modes (`NumerotationPiece`), le numéro imposé par le journal. |
| 12 | Masquer les cumuls d'un journal ; journal en sommeil, utilisable après confirmation | 20 | PARTIEL | Un journal se met en sommeil. Les totaux ne se masquent pas. |
| 13 | Compte de trésorerie du journal ; contrepartie à chaque ligne, sinon ligne de centralisation non modifiable | 43 | PARTIEL | Compte de trésorerie propre au journal et contrepartie à chaque ligne (`lib/contrepartie-tresorerie.ts`). Pas de ligne de centralisation. |
| 14 | Saisie dans un journal par période, état du journal (brouillard, non imprimé, imprimé, clôturé) | 24, 25, 30 | PARTIEL | Saisie par journal et état des journaux de saisie (brouillard, validé, figé) ; l'état « non imprimé » n'est pas servi. |
| 15 | Personnaliser les colonnes de saisie (disponible, obligatoire, masquée) | 25 à 29 | ABSENT | Voir M6, ligne 18. |
| 16 | Appeler un compte par sa classe puis Tab ou F4 | 30 | PARTIEL | La grille propose les comptes du dossier à mesure qu'on tape ; F4 y appelle les modèles de saisie. |
| 17 | Création d'un compte pendant la saisie (option) | 31 | ABSENT | La grille nomme le compte non personnalisé et renvoie au Plan comptable (M6, ligne 5). |
| 18 | Extourne d'une écriture, notamment des comptes transitoires à l'ouverture, en négatif au choix | 29, 31 | PARTIEL | Pas de commande générale d'extourne. La réimputation inscrit le négatif puis l'écriture exacte ; les régularisations et la réévaluation se contre-passent à l'ouverture. |
| 19 | Suppression des écritures après validation (option) | 31 | DIFFÉRENT, VOULU | Une écriture validée ne se supprime pas (AUDCIF art. 22, 2°) ; elle se corrige en négatif (art. 20, al. 2). |
| 20 | Modifier ou supprimer une écriture | 32 | FIDÈLE | Au brouillard. |
| 21 | Saisie par pièce, navigation par Précédent et Suivant | 32 à 34 | FIDÈLE | Mode de la fenêtre de saisie (`lib/saisie-par-piece.ts`). |
| 22 | Saisie par lot dans un fichier à part, puis mise à jour de la comptabilité | 34 à 36 | DIFFÉRENT, VOULU | Pas de fichier de lot : l'import passe au brouillard, et la validation fait la mise à jour. |
| 23 | Saisie d'un journal sur une période choisie | 37 | FIDÈLE | |
| 24 | Saisie des opérations bancaires : extraits saisis ou incorporés dans un journal temporaire, associés et lettrés avec les écritures à régler, puis transférés | 37 à 43 | PARTIEL | Le règlement des tiers passe une pièce par tiers et la lettre aussitôt ; le relevé s'importe pour le rapprochement. Pas de journal temporaire. |
| 25 | Banques : établissement, RIB par pays, contrôle de la clé | 38 à 41 | PARTIEL | Banques et RIB rattachés aux journaux ; seul l'IBAN est contrôlé (M6, ligne 26). |
| 26 | Taux de taxe : code, sens, intitulé, compte, sept types, taux en pourcentage, montant ou quantité, provenance, regroupement, comptes rattachés | 44, 45 | PARTIEL | Taux en pourcentage avec ses comptes ; taux par défaut sur un compte. Voir M6, ligne 53. |
| 27 | Calcul de la TVA pendant la saisie | 45, 46 | FIDÈLE | Ligne de taxe posée d'office pour un dossier assujetti, proposée sinon ; compte routé selon la contrepartie (`lib/tva-saisie.ts`). |
| 28 | Modèles de saisie : valeur saisie, reprise, incrément, équilibre, calcul, fonctions ; seuls ceux du type du journal sont proposés | 46 à 48 | PARTIEL | Fonctions Saisir, Répéter, Calculer, Équilibrer, rattachées à un journal ou à un type. Incrément non repris. |
| 29 | Modèles d'abonnement et génération des écritures d'abonnement (jour, semaine, mois, année) | 50 à 52 | PARTIEL | Abonnements mensuels, trimestriels, semestriels ou annuels. Voir M6, ligne 60. |

## TVA et rapprochement bancaire (p. 53 à 69)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 30 | TVA sur encaissement, par la contrepartie générale ou par le registre de taxe | 53 à 56 | PARTIEL | La taxe à l'encaissement devient exigible par le lettrage du règlement (O.-L. n° 10/001, art. 25, 2°), lu par la déclaration. Pas de registre de taxe. |
| 31 | TVA sur les débits, à la date de la facture | 57 | FIDÈLE | Régime des débits lu à la date de la facture. |
| 32 | Registre de taxe et états préparatoires | 56 à 59 | PARTIEL | Déclaration et liquidation de la TVA par compte. Pas de registre par pièce. |
| 33 | Rapprochement bancaire manuel : pièce de trésorerie, situation comptable et situation bancaire théorique, annulation | 60 à 62 | FIDÈLE | Rapprochement par relevé, lignes pointées, clôture, réouverture motivée du dernier (`RapprochementBancaire`). |
| 34 | Gestion des extraits : saisie, incorporation, récupération par modem ou messagerie, impression | 62 à 65 | PARTIEL | Relevé importé en CSV ou XLSX. Ni téléchargement ni réception. |
| 35 | Rapprochement automatique par code opération, numéro de pièce, numéro de facture ou montant, dans une fourchette | 66 à 68 | FIDÈLE | Propositions par référence puis par montant dans une fenêtre de dates, cases décochées, confirmation rejouée (`rapprochement/releve-bancaire.ts`). |
| 36 | Écriture d'équilibre d'un rapprochement déséquilibré, par un modèle de saisie | 69 | DIFFÉRENT, VOULU | Aucune tolérance : l'écart se comptabilise par une écriture ordinaire. |

## Éditions courantes (p. 70 à 75)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 37 | Brouillard d'un journal sur une période, aperçu avant impression | 70 à 72 | FIDÈLE | Le journal se lit et s'exporte avec le statut de chaque écriture, brouillard compris. |
| 38 | Journal général : synthèse des mouvements par journal et par période | 73 | PARTIEL | Analyse des journaux (brouillard par journal, trous de la séquence des pièces). Pas d'état de totaux par journal et par période. |
| 39 | Balance des comptes | 73 | FIDÈLE | Balance à trois colonnes, export dans la présentation du cabinet. |
| 40 | Grand livre, avec regroupement et journaux de situation | 74, 75 | FIDÈLE | Grand livre complet ou par compte, export en flux. |

## Tiers (p. 76 à 130)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 41 | Plan tiers : clients, fournisseurs, salariés, autres ; compte collectif ; identification | 76 à 78 | FIDÈLE | Cinq types de tiers, compte individuel né avec le tiers sous son collectif, numéro choisi. |
| 42 | Contacts du tiers par service et par type | 79 | PARTIEL | Un contact en texte. |
| 43 | Interrogation d'un compte de tiers et extrait de compte | 80 à 82 | FIDÈLE | Écritures du compte, lettrées ou non, et grand livre des tiers. |
| 44 | Modes de règlement | 83, 84 | ABSENT | Voir M5, ligne 8. |
| 45 | Modèles de règlement : jours nets, fin de mois, fin de mois civil ; pourcentage, montant ou équilibre | 85, 86 | PARTIEL | Net ou fin de mois, pourcentage, montant, équilibre (`ModeleReglement`). Pas de fin de mois civil. |
| 46 | Échéance calculée en saisie selon le modèle du tiers ; multi-échéances | 87 à 90 | PARTIEL | L'échéancier du modèle se simule ; aucune saisie ne l'applique encore (`TiersService.calculerEcheances`). L'échéance se saisit sur la ligne. |
| 47 | Lettrage manuel par lettre, annulation d'un lettrage | 91 à 93 | FIDÈLE | |
| 48 | Pré-lettrage d'écritures partiellement réglées | 93 | FIDÈLE | Lettrage partiel : le groupe garde son solde jusqu'au règlement complet. |
| 49 | Lettrage automatique par puissance (4 à 36 lignes), par pièce, montant ou facture | 93 à 97 | FIDÈLE | Quatre passes (référence, paires exactes, plusieurs pour une, plusieurs pour plusieurs), et une proposition confirmée par le comptable (`calculerPropositions`). |
| 50 | Rappels et relevés : périodes de rappel, relance préventive, relevé, tiers exclus, solde minimum | 97 à 101 | PARTIEL | Niveaux de relance par jours de retard, relance préventive, relevé, tiers hors relance avec motif. Pas de solde minimum. |
| 51 | Pénalités de retard, frais d'impayés, décalage d'échéance, exclusion d'une écriture, comptabilisation des intérêts | 101 à 105 | ABSENT | |
| 52 | Lettre de rappel sur un modèle de mise en page | 104 | FIDÈLE | Lettres de relance à partir d'un modèle de texte, mises en file d'envoi. |
| 53 | Règlement des tiers : sélection des échéances, règlement partiel, écritures de règlement, lettrage, ordre de paiement, banque et journal | 106 à 109 | FIDÈLE | Règlement des tiers et ordre de virement nés ensemble (`reglements/`, `OrdreVirement`). |
| 54 | Scénarios, dossiers de recouvrement, interventions, gestion des actions | 109 à 119 | ABSENT | Voir M6, ligne 35. |
| 55 | Provisions des dossiers de recouvrement : dotation, reprise, créance irrécouvrable | 120, 121 | DIFFÉRENT, VOULU | Module des créances douteuses : reclassement au 416, dépréciation selon la revue motivée du cabinet, perte au 651 (M6, ligne 36). |
| 56 | Grand livre des tiers | 122, 123 | FIDÈLE | Grand livre par famille de tiers, avec le contrôle contre les collectifs. |
| 57 | Balance des tiers : de base, développée, à six ou huit colonnes | 123, 124 | PARTIEL | Balance auxiliaire et balance âgée. Pas de choix entre ces présentations. |
| 58 | Justificatif du solde à une date | 124 | FIDÈLE | Justificatif du solde recoupé contre la balance (`EcritureService.justificatifSolde`). |
| 59 | Statistiques des tiers : chiffre d'affaires, croissance, délai moyen de règlement, vulnérabilité, encours | 125 à 128 | ABSENT | |
| 60 | Historique des rappels | 129 | FIDÈLE | Total et somme sur tout le périmètre, montant figé à l'émission. |
| 61 | État des dossiers de recouvrement | 130 | ABSENT | |
| 62 | Impression différée | 123 | ABSENT | |

## Fin d'exercice (p. 131 à 147)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 63 | Nouvel exercice ouvert avant la clôture de l'ancien ; exercice courant choisi et affiché | 131, 132 | FIDÈLE | Sélecteur d'exercice : le choix de l'utilisateur prime, mémorisé par dossier, et un choix implicite est signalé. |
| 64 | Cinq exercices en ligne au plus, archivage du plus ancien dans un fichier d'archive | 132, 145 à 147 | DIFFÉRENT, VOULU | Tous les exercices restent dans le dossier, clôturés (conservation de dix ans, AUDCIF art. 24). |
| 65 | Nouvel exercice avec ou sans génération des reports, ou exercice antérieur ; reports relançables, corrigés des modifications de l'ancien exercice | 132 à 134 | FIDÈLE | À-nouveau provisoire, relancé autant que voulu sur le livre-journal, puis report définitif à la clôture (`exercice/report-a-nouveau.ts`). |
| 66 | Report en détail ou en solde selon le compte ou selon le lettrage ; traitement des incohérences avec la nature | 135 à 138 | FIDÈLE | Mode de report par compte ; les incohérences avec la nature sont listées dans les paramètres du dossier et alignées à la demande, jamais d'office. |
| 67 | Paramètres du report : numéro de pièce, libellé structuré, reprise du numéro et du libellé d'origine, comptes de résultat | 139 à 141 | DIFFÉRENT, VOULU | Libellés et numéros posés par OmegaX ; le résultat va au compte 13. |
| 68 | Clôture partielle d'un journal (jusqu'à une date ou une pièce) et clôture totale | 142, 143 | FIDÈLE | Clôtures partielle, totale ou de période (`Cloture`). |
| 69 | Clôture de l'exercice : dans l'ordre, journaux clôturés, irréversible | 143, 144 | FIDÈLE | Clôture dans l'ordre, définitive ; les deux écritures de clôture entrent validées. |
| 70 | État de clôture | 144 | ABSENT | |

## Analytique et budgets (p. 148 à 182)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 71 | Plans analytiques : plan structuré par ruptures, plan principal, plan obligatoire, section d'attente, plan en colonne de saisie | 148 à 155 | PARTIEL | Voir M6, ligne 16. |
| 72 | Sections : création, report, sommeil ; niveaux d'analyse (jusqu'à trente) | 156, 166, 167 | PARTIEL | Sections Détail et Total actives ou non. Pas de niveau d'analyse. |
| 73 | Saisie analytique sur les journaux et les comptes ventilables | 157, 158 | FIDÈLE | Ventilation des lignes des classes que le plan ventile (`VentilationAnalytique`). |
| 74 | Modèles de grille analytique | 158, 159 | PARTIEL | Clés de répartition d'une section vers d'autres (M6, ligne 42). |
| 75 | Codes journaux analytiques et OD analytiques | 160 à 163 | FIDÈLE | OD analytiques équilibrées dans un journal « OD ANA » (`analytique/od-analytique.ts`). |
| 76 | Recherche et interrogation analytiques : montant analytique, écritures sans ventilation, interrogation d'une section | 163 à 166 | PARTIEL | Le grand livre analytique d'une section tient lieu d'interrogation (`analytique.controller.ts`, `etats/grand-livre`). La recherche d'écritures n'a aucun critère analytique (`recherche-ecritures.ts`). |
| 77 | États analytiques : journaux, balance (sur rupture, inversée), grand livre (inversé), contrôle des cumuls, journal des reports, bilan et compte de résultat analytiques avec soldes intermédiaires de gestion | 168 à 173 | PARTIEL | Balance analytique, grand livre par section et contrôle des cumuls (`analytique.controller.ts`). Ni journal analytique, ni ruptures, ni état inversé, ni bilan ou compte de résultat par section. |
| 78 | Budget par compte général ou par section : charge ou produit, dotation faible ou forte, quantité et valeur, répartition mensuelle avec l'arrondi sur la dernière | 174 à 178 | PARTIEL | Budget par section, annuel ou mensuel (M6, ligne 41). |
| 79 | Postes budgétaires (détail, total, centralisateur) | 179, 180 | ABSENT | |
| 80 | États budgétaires : prévu, réalisé, écart, par poste, compte ou section | 181, 182 | PARTIEL | État budgétaire et tableau d'exécution budgétaire officiel par section, au SYCEBNL. |

## Devises (p. 183 à 206)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 81 | Devises : intitulé, unité, sigle ISO, cotation certaine ou incertaine, devise de cotation, zone euro | 183, 184 | PARTIEL | Voir M6, ligne 24. |
| 82 | Devise attachée aux comptes généraux et aux tiers ; monnaie d'équivalence ; colonnes devise, parité et montant en devise en saisie | 184 à 188 | PARTIEL | Une ligne se saisit en devise avec son montant et son cours, le cours déduit à défaut (AUDCIF art. 52). Aucune devise n'est attachée au compte. |
| 83 | Lettrage en devise et calcul de la différence de change | 188 à 195 | FIDÈLE | Groupe soldé en devise : écart de change réalisé proposé au lettrage, passé au clic sur son compte (AUDCIF art. 55). |
| 84 | Écart de règlement par modèle de saisie, sous un montant maximum | 186, 192, 195 | ABSENT | |
| 85 | Écart de conversion entre monnaies de la zone euro | 196 | DIFFÉRENT, VOULU | Sans objet. |
| 86 | Réévaluation des dettes et créances en devise à la clôture : natures, journaux, devises, cours, provision, extourne à l'ouverture | 197 à 202 | FIDÈLE | Réévaluation à la date de clôture, provision ajustée par l'écart, extourne des 478 et 479 (AUDCIF art. 54 ; Titre VIII ch. 22). |
| 87 | Réévaluation périodique, mensuelle | 198, 201 | DIFFÉRENT, VOULU | La réévaluation se fait à la clôture et à elle seule (art. 54, ch. 22 § 2.2) ; toute autre date est refusée. |
| 88 | Écritures importées ou exportées avec l'expert-comptable, journaux synchronisés | 204 | ABSENT | |
| 89 | États en devise : journal développé avec montant, devise et parité ; balance et grand livre | 204 à 206 | PARTIEL | Balance dans la monnaie fonctionnelle, ligne à ligne au cours historique (CLAUDE.md, M2). |

## IFRS et révision (p. 207 à 221)

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 90 | IFRS : journaux IFRS, type de norme (IFRS, nationale, les deux), plan IFRS par zone et secteur, éditions selon la norme | 207 à 212 | DIFFÉRENT, VOULU | IFRS par retraitements tenus à côté, jamais dans les écritures (M6, ligne 13). |
| 91 | Fichier expert et cycles de révision : regroupements de comptes, observations par exercice, consignes avec filtres, tableaux | 213 à 218 | PARTIEL | Voir M6, ligne 66. |
| 92 | Révision par cycle : réponse à chaque consigne (oui, non, non répondue, non applicable, non significative), annexée ou non | 219 | PARTIEL | Questionnaire de révision du CPCC, réponses et commentaires ; aucune consigne ne se crée. |
| 93 | Registres de révision par écriture : annotation, période de régularisation | 220 | ABSENT | Voir M6, ligne 23. |
| 94 | Régularisation calculée au prorata de la période saisie au registre (charge constatée d'avance) | 221 | DIFFÉRENT, VOULU | Rien ne se proratise : une charge ou un produit qui appartient à deux exercices se passe en deux opérations (module des régularisations). |

## Vu sur les captures seulement

| # | Fonction Sage | Page | OmegaX | Où, ou pourquoi |
|---|---|---|---|---|
| 95 | Identification de la société : raison sociale, activité, adresse, code postal et ville, pays, identifiants, téléphone, télécopie, courriel, site | 7, 13 | FIDÈLE | Paramètres du dossier, avec les identifiants congolais (RCCM, identification nationale, numéro d'impôt) (`Tenant`). Ni code postal ni télécopie. |
| 96 | Journal des à-nouveaux et journal OD analytique des à-nouveaux choisis dans les paramètres | 14, 135 | PARTIEL | Voir M3-39 : le report se passe au journal OD, à défaut au premier journal de type Général (`exercice.service.ts:2747`). |
| 97 | Créer un modèle de saisie depuis la pièce en cours | 29 | ABSENT | Les modèles se créent dans leur propre fenêtre. |
| 98 | Documents rattachés à une écriture, ouverts depuis la saisie | 29 | ABSENT | Voir M6, ligne 74. |
| 99 | Option qui interdit en saisie les comptes et journaux en sommeil | 31 | PARTIEL | Un compte en sommeil n'entre qu'après confirmation (`confirmerComptesEnSommeil`) ; aucune option ne l'interdit. |
| 100 | Format d'import et d'export paramétrable | 5 | PARTIEL | L'import propose la correspondance des colonnes, que l'utilisateur ajuste (`import.service.ts:381`) ; les exports ont leur présentation fixe. |
| 101 | Volet Complément du tiers : devise, langue, représentant, tiers payeur, validation automatique des règlements, tiers non soumis aux pénalités | 87, 103, 186 | ABSENT | Le tiers porte type, nom, adresse, contact, exclusion des relances et modèle de règlement (`Tiers`) ; rien d'autre de ce volet. |
| 102 | Codes risque, encours maximum autorisé, plafond d'assurance crédit ; volet Solvabilité (échus par mois, risque réel, dernière facture, dernier règlement) | 111, 128 | ABSENT | Les échus se lisent à la balance âgée ; ni encours ni code risque. |
| 103 | Cumuls mensuels d'un compte ou d'un tiers (débit, crédit, solde par mois) | 127 | PARTIEL | Évolution des soldes sur plusieurs exercices (`ecriture.controller.ts`, `evolution-soldes`) ; pas de cumuls mois par mois. |
| 104 | Budget de la sélection des règlements : plafond et solde du budget | 107 | PARTIEL | Un lot de virements présélectionne les factures jusqu'à son montant habituel (`reglements/lots-virement.ts`) ; la sélection libre n'a pas de plafond. |
| 105 | Libellés d'écriture appelés par raccourci clavier | 163 | PARTIEL | Libellés proposés en liste à la saisie, sans imputation ; pas de raccourci. |
| 106 | Journal centralisé, classé par compte général, avec les ventilations analytiques | 205, 206 | ABSENT | Le journal s'exporte pièce par pièce. |
| 107 | Compaction du fichier (menu Traitement, titre seul) | 24 | DIFFÉRENT, VOULU | Rien à compacter : la base est gérée (voir M1-150). |

## Bilan du manuel

107 fonctions relevées : 34 FIDÈLE, 15 DIFFÉRENT VOULU, 0 DIFFÉRENT À
TRIER, 40 PARTIEL, 18 ABSENT, 0 NON VÉRIFIÉ.

Le support confirme ce que les manuels 1 et 2 avaient montré : le cœur de la
tenue (journaux, numérotation des pièces, saisie, lettrage, rapprochement,
règlement des tiers, clôtures, réévaluation des devises) est fidèle. Les
écarts voulus tiennent à la loi (monnaie de tenue imposée, écriture validée
jamais supprimée, réévaluation à la seule clôture, aucun prorata) ou à la
nature d'OmegaX (aucun fichier à créer, dimensionner, compacter ou archiver).

Les ABSENT se rangent en trois familles. Le recouvrement de Sage (pénalités,
frais d'impayés, décalage d'échéance, scénarios et dossiers, codes risque et
encours, statistiques des tiers) ; les compléments de fiche (modes de
règlement, volet Complément du tiers, documents rattachés aux écritures) ;
quelques éditions (état de clôture, journal centralisé, impression
différée, postes budgétaires). Les captures ont surtout précisé des PARTIEL :
fiche du compte, natures, analytique.

## Ce qui reste à faire sur ce manuel

- Manasse trie les ABSENT.
