# Plan de la version 1 · stabiliser avant de vendre (2026-10-08)

Décision de Manasse du 2026-10-08 : « Geler les nouveautés et se concentrer sur
les plus importants ». Le logiciel s'est élargi plus vite qu'il n'a été éprouvé
sur ce qui sert tous les jours. Avant la vente, l'ordre s'inverse : on éprouve
ce qu'un client fait chaque mois et chaque année, on corrige ce qui bloque ou
fausse un montant, et rien de neuf n'entre.

## 1. Le gel

- Aucune nouvelle fonction et aucune nouvelle ligne de cas limite n'entrent sur
  `main` avant la version 1.
- Entrent seulement :
  - les deux lignes en cours au moment du gel, `lettrage-cloture` (lettrage
    partiel reconduit à la clôture) et `tva-decisions` (TVA des factures
    annulées, perte d'une créance avec duplicata, trop-payé de liquidation) ;
  - la correction d'un défaut BLOQUANT ou MAJEUR trouvé sur un parcours du
    périmètre ci-dessous.
- Une demande nouvelle, ou un relevé hors périmètre, se note au suivi
  (`docs/suivi-immobilisations-verrouille.md`), il ne se code pas.

## 2. Le périmètre de la version 1 · validé par Manasse le 2026-10-08

Trois dossiers types, chacun tenu sur deux exercices complets, clôture comprise.

### Parcours communs aux trois dossiers

1. Création du dossier depuis la console, utilisateurs et rôles, double
   authentification.
2. Reprise · import de la balance ou du bilan d'ouverture, devises comprises.
3. Saisie · journaux, pièces, modèles de saisie, brouillard, validation.
4. Tiers · comptes individuels, lettrage (manuel, automatique, pré-lettrage),
   Règlement des tiers, relances.
5. Trésorerie · comptes en francs et en dollars, rapprochement bancaire avec
   relevé importé, procès-verbal de comptage de caisse.
6. Immobilisations · acquisition, amortissement linéaire, sortie.
7. Paie · salariés et contrats, bulletins, retenues (CNSS, INPP, ONEM, IRPP),
   passation au journal, échéancier des reversements.
8. Clôture · charges à payer et produits à recevoir, charges et produits
   constatés d'avance, dépréciation d'une créance douteuse, réévaluation des
   devises, clôture annuelle, à-nouveaux, affectation du résultat.
9. États · bilan, compte de résultat, flux de trésorerie, notes annexes,
   liasse Excel, balance, grand livre et journal exportés.
10. Contrôles de clôture et restitution complète du dossier.

### Propre à chaque dossier type

- **Association (SYCEBNL, jeu associations)** · cotisations et méthode déclarée,
  dons et legs, registre des donateurs, fonds affectés, subvention
  d'investissement, bien reçu en don, notes 1 à 35.
- **Projet de développement (SYCEBNL)** · fonds du bailleur, budget par
  rubrique, achats d'équipement, tableau emplois-ressources, exécution
  budgétaire, réconciliation de trésorerie, notes 1 à 24.
- **SARL (SYSCOHADA, système normal, assujettie à la TVA)** · factures de vente
  et d'achat avec TVA, acompte client, facture en dollars réglée en partie,
  stocks en inventaire intermittent, cession d'un bien, déclaration et
  liquidation de la TVA, résultat fiscal, acomptes et écriture d'impôt, notes
  1 à 36.

## 3. Hors version 1 · laissé éteint pour les premiers clients

Rien n'est retiré du logiciel. Ces fonctions restent dans le code, mais elles
ne sont ni activées ni présentées aux premiers clients, et aucune passe ne les
éprouve avant la version 1 :

- modules activables (`tenant/modules-optionnels.ts`) · consolidation, IFRS,
  révision approfondie (circularisation, faiblesses du contrôle interne) et
  gestion commerciale (devis), laissés éteints à la création du dossier ;
- groupe (siège et cellules), dissolution et liquidation d'une société,
  réévaluation légale des immobilisations, couverture de change (non construite).

Ce qu'un texte impose à tous reste toujours au menu : facturation, inventaire
physique, provisions, documents obligatoires, registre des donateurs.

## 4. Les passes

- Une passe, c'est les trois dossiers joués de bout en bout sur une base
  PostgreSQL jetable par l'API du serveur compilé, puis les parcours principaux
  dans le navigateur. Chaque solde est lu contre le montant calculé à la main.
- Après chaque passe, on corrige les défauts BLOQUANT ou MAJEUR du périmètre,
  avec leur test, et le reste va au suivi.
- **La version 1 est prête quand deux passes de suite ne trouvent aucun défaut
  BLOQUANT ni MAJEUR.**

## 5. Le pilote

Un ou deux dossiers réels de VMG Consulting, tenus dans OmegaX en parallèle de
l'outil actuel pendant un à deux mois. À chaque fin de mois, on compare les
balances et les états. La vente commence après un pilote sans écart.

## 6. Version 1 atteinte (2026-10-08)

Deux passes de suite sans défaut BLOQUANT ni MAJEUR sur le périmètre du § 2,
décision de Manasse du 2026-10-08 (« une passe de plus ») · la version 1 est
atteinte, et le pilote du § 5 peut commencer.

- **Passe précédente** · la simulation du logiciel complet (treize lots par
  l'API sur base jetable, 2026 et 2027 clôtures comprises, et un lot d'écrans
  dans le navigateur). Ses défauts du périmètre ont été corrigés et déployés
  (exercice non contigu, ancienneté des relances à travers l'à-nouveau, reste
  d'une facture réglée en partie imputé par la loi) ; ce qu'elle a trouvé hors
  du périmètre ou mineur est au suivi.
- **Passe de clôture**, sur `main` au commit `0288996` (déploiement vert ·
  Cloud Run, Firebase Hosting, tests navigateur), après la correction de la
  clôture d'un dossier de groupe (G1) et de la balance âgée (D1) ·
  - les trois dossiers types et le parcours commercial joués par l'API sur
    base PostgreSQL jetable, deux exercices clôturés · 964 contrôles, 958
    concordants ; les six écarts sont au suivi, deux MINEURS du périmètre
    (`CHARGE_SANS_TIERS` sur le redressement d'un manquant de caisse, fenêtre
    de dates du rapprochement déclarée facultative) et quatre hors périmètre
    (lien du magasin en inventaire permanent, code d'article en double) ;
  - les écrans dans le navigateur · 531 contrôles, 531 concordants ;
  - les tests navigateur du dépôt · 82 sur 82.

Le gel du § 1 tient jusqu'à la fin du pilote · ce qui est au suivi
(`docs/suivi-immobilisations-verrouille.md`, « Relevés en attente ») reste à
trier avec Manasse, il ne se code pas avant.

## 7. Paquet 1 · le gel levé pour lui seul (2026-10-08)

Décision de Manasse du 2026-10-08 : « Lève le gel pour lui et attaque le
paquet 1 », avec la consigne « fais des simulations pour savoir si les
problèmes sont bien traités ». Le paquet 1 réunit les points du suivi qu'un
dossier du pilote touche (périmètre du § 2) · mineurs relevés par les passes,
et questions de fond laissées « à examiner ». Rien d'autre n'entre ; le reste
du suivi attend la fin du pilote.

Chaque point est d'abord REPRODUIT sur une base PostgreSQL jetable par l'API
du serveur compilé (le défaut constaté), puis corrigé avec son test, puis
REJOUÉ sur la même base (le défaut disparu), à travers une clôture quand le
point la touche. Une question de fond se tranche par le texte, et seule celle
que le corpus ne tranche pas remonte à Manasse.

### Ligne A · états et clôture (`travail/paquet1-a`)

INTÉGRÉE le 2026-10-09 · rejouée sur vraie base (379 contrôles sur 379),
deux tours de relecture ; les deux BLOQUANTS du second tour corrigés (une
ouverture du premier jour annulée par un négatif inscrit plus tard fait
déclarer à la clôture, et ne retient plus l'arrêt à la dissolution, sur
l'accord du cabinet) ; A5 sans défaut ; A6 (compte 130) tranché par Manasse le
2026-10-09 et codé (lu dans le résultat au bilan, soldé par l'affectation) ;
le MAJEUR et les mineurs du second tour au suivi (« Relevés en attente »),
les deux requêtes en lecture seule de m5 dans
`docs/requetes-production-paquet-1.md`.

1. Un exercice N clôturé AVANT le virement du résultat non affecté au report
   à nouveau n'est signalé que sur son propre bilan · la colonne N-1 de N+1
   reprend le montant dans CH ou CJ sans le dire, et la liasse de N+1 ne lève
   pas l'anomalie (`comparatifDuBilan`, liasses).
2. `mentionExercicePrecedentVide` conseille d'importer la balance de clôture
   quand l'exercice précédent n'a que du brouillard, sans dire de le valider.
3. Exercice précédent vide · la colonne N-1 du tableau des flux des
   associations rend des zéros avec `exerciceN1Disponible` vrai, sans dire
   « vide ».
4. Premier exercice clos par la nouvelle clôture · `lignesALOuverture(lignesN)`
   présente l'ouverture déjà virée (13 à 0, 12 ou 129 portant le montant) dans
   le comparatif et l'ouverture du tableau des flux · totaux justes,
   reclassement interne aux capitaux propres faux.
5. Tableau des flux SYSCOHADA · la variation des intérêts courus (1662) entre
   en FE (passif circulant) quand le bilan les range en DA · à lire contre le
   Titre IX ch. 5.
6. Compte 130 (« Résultat en instance d'affectation ») hors de CJ et de SP2
   (anomalie n° 7, audit final F218) · bilan intermédiaire déséquilibré de son
   montant · à lire contre la fiche du compte 13 et le ch. 7.
7. Tableau des flux des associations · une ouverture saisie en OD au premier
   jour (sans report) reste lue comme flux, quand le SYSCOHADA la nomme et
   vide ses postes.
8. À vérifier · la contre-passation d'une réévaluation des devises passée au
   premier jour de N+1 (OD, admise N ouvert) serait lue par AU2, à la clôture
   de N, comme une ouverture divergente, et RECTIFIER l'inscrirait en négatif,
   rétablissant en silence l'écart latent au 478 et au tiers.
9. Feuille CONTROLES de la liasse projet · XC comparé à zéro « en régime
   normal » sur un projet au résultat de 120 000.
10. Notes par échéance · la part non ventilée servie par le serveur n'est
    jamais dite à l'écran (`NotesAnnexesRendu.tsx`).

### Ligne B · tiers, lettrage, trésorerie (`travail/paquet1-b`)

INTÉGRÉE le 2026-10-09 · rejouée sur vraie base (112 contrôles, 49 écarts
avant, 0 après), deux tours de relecture, aucun BLOQUANT ; le majeur et les
huit mineurs du second tour sont au suivi (« Relevés en attente »).

1. `CHARGE_SANS_TIERS` se lève sur le redressement du manquant de caisse que
   l'inventaire demande et retient.
2. `CHARGE_SANS_TIERS` se lève sur des intérêts d'emprunt prélevés par la
   banque (6712 contre 521), cas légitime non nommé.
3. Balance âgée · une ligne à solde nul reste rendue sous « Soldes en sens
   inverse ».
4. Balance âgée · la grille de l'écran n'a pas de rôles de tableau pour un
   lecteur d'écran.
5. Reste d'une facture réglée en partie · un groupe qui ne se répartit pas
   sûrement (négatif sans son origine ou à deux origines, reste négatif en
   devise, part déclarée au-delà de la facture) garde la lecture ligne à ligne
   et n'est nommé qu'au journal du serveur, jamais à l'écran.
6. Relances · une facture soldée dans sa devise avec un gain de change non
   passé se lit ligne à ligne, le réalisé n'est pas nommé.
7. Un groupe d'à-nouveaux lettré à la main, sans groupe de N reconduit, garde
   l'ordre de ses lignes au lieu de l'imputation légale.
8. Les doublures des tests de la note et des deux SMT rendent un `groupBy`
   constant, sans ligne au brouillard.
9. `GET /rapprochements/:id/propositions` sans `fenetreJours` rend 400 alors
   que le paramètre est facultatif.
10. Une campagne d'inventaire qui ne porte que la caisse ne se clôt pas.

### Ligne C · paie, fiscal, cloisonnement (`travail/paquet1-c`)

INTÉGRÉE le 2026-10-09 · rejouée sur vraie base (616 contrôles, 0 écart ;
`main` 537 contrôles, 118 écarts), deux tours de relecture, le BLOQUANT du
second tour (millier de l'art. 118) et son jumeau (net négatif au centime)
corrigés ; les majeurs de la relecture ciblée et les mineurs sont au suivi
(« Relevés en attente »), la purge de production R1 dans
`docs/requetes-production-paquet-1.md` · lue le 2026-10-09 par le workflow
`requetes-production.yml`, aucune ligne, purge sans objet ; R2 vide.

1. Plafond de l'art. 69, 1 non arrondi au centime (« seul l'excédent de
   0.00 FC est imposable »).
2. L'abstention des allocations familiales renvoie à un nom de constante
   interne (`RESOLUTION_TAUX_LEGAL_ALLOCATIONS`).
3. Des identifiants d'un autre dossier rendent 400 au lieu de 404 (grand
   livre, contrôles), ou 200 vide (liste, balance, export du journal d'un
   exercice d'un autre dossier), et `POST /ecritures/valider-jusqua` rend 201
   · aucune fuite, une réponse fausse.
4. L'observation « Société unipersonnelle à associé unique » du résultat
   fiscal est servie à toute SARL, SA ou SAS, unipersonnelle ou non.

## 8. Ligne tiers-panoplie · le gel levé pour elle (2026-10-09)

Décision de Manasse du 2026-10-09 · « Lève le gel pour la fonction de chaque
tiers et numéro personnalisée, et corrige ». Trois réponses de Manasse le même
jour · les dossiers existants se complètent par un bouton « Compléter », jamais
d'office ; une ligne saisie sur un collectif qui porte des comptes de tiers est
refusée en le disant ; le salarié n'entre pas encore (« Pas pour l'instant »).

- **Panoplie** (`tiers/collectifs-tiers.ts`, `PANOPLIES_TIERS`), numéros lus dans
  les deux semis · fournisseur 4011, 4081, 4091 aux deux plans ; client
  SYSCOHADA 4111, 4181, 4191, 4161, 4162 ; client-usager SYCEBNL 412, 4182,
  4192, 4162 ; adhérent SYCEBNL 411, 4181, 4191, 4161. Chaque compte au même
  rang que le principal quand il est libre, lié à son collectif.
- **Saisie** · `EcritureService.verifierComptesCollectifs`, au contrôleur seul ;
  modules et imports non touchés ; un collectif sans compte individuel reste
  ouvert.
- **Trésorerie** · un journal de banque ou de caisse ne prend pas le compte
  d'un autre, jugé au choix du compte seulement.
- **Scénario sur vraie base** · `e2e/tests/tiers-panoplie.e2e.ts`, à travers la
  clôture de N et l'imputation de l'avance en N+1.

